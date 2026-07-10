// src/ingest/run-ingest-providedlines.ts
//
// Pull REAL prop lines into the ProvidedLine table, so the board / player pages can
// show the number users actually see instead of our computed median line. Sources:
//   • prizepicks, underdog  — direct scrapers (prizepicks.ts / underdog.ts)
//   • sleeper, pick6        — direct scrapers (sleeper.ts / pick6.ts) carrying each
//                             book's payout multipliers + alternate-line ladders
//   • rotowire              — public picks aggregator (rotowire.ts) that adds RT Sports
//                             + sportsbooks in one call, each fanned out to its own
//                             `source`.
//
//   pnpm ingest:providedlines   (runs on the cloud cron — ingest-providedlines.yml)
//
// These are UNOFFICIAL public endpoints (ToS gray area, no SLA) but all reachable
// directly from GitHub Actions — no proxy. The web app only PREFERS these lines when
// PROVIDED_LINES_ENABLED=true, so ingesting alone never changes what's rendered.
import 'dotenv/config';
import { db } from '../lib/db';
import { recordIngestRun } from './ingestRun';
import { withDbRetry } from './dbRetry';
import { fetchPrizePicksLines } from './prizepicks';
import { fetchUnderdogLines } from './underdog';
import { fetchSleeperLines } from './sleeper';
import { fetchPick6Lines } from './pick6';
import { fetchRotowireLines } from './rotowire';
import type { ProvidedLineRow } from './providedTypes';
import { staleRows, normalizeClubName, RETIRED_SOURCE_TAGS, type RowKey } from './providedSync';
import { normalizeName } from '../lib/slate';
import type { Sport } from '../lib/sports';
import { isPropStat } from '../lib/propStats';
import { SITE } from '../lib/site';
import { submitRevalidate } from '../lib/revalidate';

const SOURCES: Array<{ id: string; fetch: () => Promise<ProvidedLineRow[]> }> = [
  { id: 'prizepicks', fetch: fetchPrizePicksLines },
  { id: 'underdog', fetch: fetchUnderdogLines },
  // Sleeper + DK Pick6 scraped DIRECTLY (not via RotoWire) so we get their exact payout
  // multipliers / alternate-line ladders — RotoWire only exposes the line + odds.
  { id: 'sleeper', fetch: fetchSleeperLines },
  { id: 'pick6', fetch: fetchPick6Lines },
  // RotoWire aggregator — one public, proxy-free call returns rows for the remaining
  // books (RT Sports + sportsbooks). Each row carries its own `source`; PrizePicks,
  // Underdog, Sleeper, and Pick6 are excluded there (scraped directly above).
  { id: 'rotowire', fetch: fetchRotowireLines },
];

/** name → playerId for a sport, with collisions collapsed to null so we never guess. */
async function playerIndex(sport: Sport): Promise<Map<string, number | null>> {
  const players = await withDbRetry(
    () =>
      db.player.findMany({
        where: { sport },
        select: { id: true, firstName: true, lastName: true },
      }),
    `playerIndex(${sport})`,
  );
  const map = new Map<string, number | null>();
  for (const p of players) {
    const key = normalizeName(`${p.firstName} ${p.lastName}`);
    map.set(key, map.has(key) ? null : p.id); // second sighting → ambiguous
  }
  return map;
}

async function main(): Promise<number> {
  const rows: ProvidedLineRow[] = [];
  for (const s of SOURCES) {
    try {
      const r = await s.fetch();
      console.log(`[providedlines:${s.id}] fetched ${r.length} mapped lines`);
      rows.push(...r);
    } catch (e) {
      console.warn(`[providedlines:${s.id}] fetch failed: ${(e as Error).message}`);
    }
  }
  if (rows.length === 0) {
    console.log('[providedlines] no lines fetched — nothing to write.');
    return 0;
  }

  // Per-sport name→id index (built once).
  const indexBySport = new Map<Sport, Map<string, number | null>>();
  for (const sport of new Set(rows.map((r) => r.sport))) {
    indexBySport.set(sport, await playerIndex(sport));
  }

  // MLS rows come from COMBINED soccer feeds (PP folds MLS/NWSL/EPL/… into one
  // SOCCER league), so name matching alone could attach another competition's
  // same-named player to ours. Gate: an MLS row must carry a club that matches an
  // MLS team of ours — rows without a club, or from any other competition, drop.
  const mlsClubs = new Set<string>();
  if (rows.some((r) => r.sport === 'mls')) {
    const teams = await withDbRetry(
      () => db.team.findMany({ where: { sport: 'mls' }, select: { name: true } }),
      'teamIndex(mls)',
    );
    for (const t of teams) mlsClubs.add(normalizeClubName(t.name));
  }

  type Resolved = {
    sport: Sport;
    playerId: number;
    stat: string;
    source: string;
    gameDate: Date;
    line: number;
    overOdds: number | null;
    underOdds: number | null;
    oddsType: string;
    multiplier: number | null;
  };

  let unmatched = 0;
  let clubRejected = 0;
  const resolved: Resolved[] = [];
  const perSource = new Map<string, number>();
  for (const r of rows) {
    if (r.sport === 'mls') {
      const club = r.externalTeamName ? normalizeClubName(r.externalTeamName) : '';
      if (!club || !mlsClubs.has(club)) {
        clubRejected++; // another competition (NWSL/EPL/…) or no club context
        continue;
      }
    }
    const playerId = indexBySport.get(r.sport)?.get(normalizeName(r.externalPlayerName));
    if (!playerId) {
      unmatched++;
      continue;
    }
    perSource.set(r.source, (perSource.get(r.source) ?? 0) + 1);
    resolved.push({
      sport: r.sport,
      playerId,
      stat: r.stat,
      source: r.source,
      gameDate: r.gameDate,
      line: r.line,
      overOdds: r.overOdds ?? null,
      underOdds: r.underOdds ?? null,
      // The column is NOT NULL (part of the unique key): books with no variant
      // concept store 'standard', which the app treats as the plain line.
      oddsType: r.oddsType ?? 'standard',
      multiplier: r.multiplier ?? null,
    });
  }

  // Which player+stat lines actually MOVED this run — computed against the current
  // rows BEFORE we overwrite them, so on-demand revalidation touches only the pages
  // whose number changed (the whole point: don't regenerate identical HTML).
  const changed = await changedPlayerStats(resolved);

  const ops = resolved.map((d) => () => {
    // Keyed by line AND oddsType, so a source's variant rungs (PrizePicks demon/
    // goblin, Underdog alternates) coexist instead of overwriting the standard
    // line — even when a variant shares the standard line's number.
    const data = {
      overOdds: d.overOdds,
      underOdds: d.underOdds,
      multiplier: d.multiplier,
      fetchedAt: new Date(),
    };
    return db.providedLine.upsert({
      where: {
        sport_playerId_stat_source_gameDate_line_oddsType: {
          sport: d.sport,
          playerId: d.playerId,
          stat: d.stat,
          source: d.source,
          gameDate: d.gameDate,
          line: d.line,
          oddsType: d.oddsType,
        },
      },
      create: { sport: d.sport, playerId: d.playerId, stat: d.stat, source: d.source, gameDate: d.gameDate, line: d.line, oddsType: d.oddsType, ...data },
      update: data,
    });
  });

  // Concurrent batches (no $transaction — it times out over a remote pooler).
  // Each batch retries transient pooler blips so one ETIMEDOUT doesn't fail the run.
  const BATCH = 20;
  for (let i = 0; i < ops.length; i += BATCH) {
    const batch = ops.slice(i, i + BATCH);
    await withDbRetry(() => Promise.all(batch.map((fn) => fn())), `upsert batch ${i / BATCH}`);
  }

  // Authoritative sync: a successful scrape returns a source's ENTIRE current board for
  // a slate, so any stored row for that (source, sport, gameDate) we did NOT just write
  // is a line the book no longer offers — dropped (scratch, news, board tightening) or
  // re-classified under a different oddsType — and is deleted so the site stops showing
  // it. We only touch slates we actually fetched (a failed source contributes no rows →
  // no deletes), and a suspiciously thin slate falls back to the narrow
  // re-classification-only prune (see providedSync.ts), so a half-broken scraper can't
  // erase a valid board.
  const pruned = await pruneStaleRows(resolved);

  // Retired tag vocabularies (see RETIRED_SOURCE_TAGS): rows tagged with a kind a
  // source's scraper no longer emits are definitionally stale, and the slate-scoped
  // prune above can't reach them on past game days that are never re-fetched but
  // still sit inside the read windows. Swept every run — indexed, idempotent, and
  // empty once the backlog clears.
  const retired = await sweepRetiredTags();

  const summary = [...perSource.entries()].map(([s, n]) => `${s}=${n}`).join(', ');
  console.log(
    `[providedlines] upserted ${ops.length} (${summary}); ${unmatched} skipped; ${clubRejected} non-MLS soccer row(s) club-gated; ${pruned.removed} stale + ${retired.removed} retired-tag row(s) removed.`,
  );

  // Revalidate the changed pages — best-effort, only when the site actually shows
  // these lines (PROVIDED_LINES_ENABLED). Removed lines count as changes too: the
  // player page's static HTML must stop showing a rung the book pulled.
  for (const key of pruned.changedKeys) changed.add(key);
  for (const key of retired.changedKeys) changed.add(key);
  await revalidateChanged(changed);

  return ops.length;
}

/** Delete rows whose oddsType a source's scraper has retired (RETIRED_SOURCE_TAGS).
 *  Best-effort: a failure is logged, never fatal. Returns the count plus the
 *  `${sport}|${playerId}|${stat}` keys of removed rows for revalidation. */
async function sweepRetiredTags(): Promise<{ removed: number; changedKeys: Set<string> }> {
  const changedKeys = new Set<string>();
  let removed = 0;
  for (const [source, tags] of Object.entries(RETIRED_SOURCE_TAGS)) {
    try {
      const where = { source, oddsType: { in: [...tags] } };
      const stale = await withDbRetry(
        () => db.providedLine.findMany({ where, select: { sport: true, playerId: true, stat: true } }),
        `retired-tag scan ${source}`,
      );
      if (stale.length === 0) continue;
      await withDbRetry(
        () => db.providedLine.deleteMany({ where }),
        `retired-tag delete ${source}`,
      );
      for (const r of stale) changedKeys.add(`${r.sport}|${r.playerId}|${r.stat}`);
      removed += stale.length;
    } catch (e) {
      console.warn(`[providedlines] retired-tag sweep failed for ${source}: ${(e as Error).message}`);
    }
  }
  return { removed, changedKeys };
}

/**
 * Delete the stored rows of each fetched slate that this run proved stale — the
 * decision logic lives in providedSync.ts (pure, unit-tested): full boards sync
 * authoritatively, thin boards only prune re-classifications. Best-effort per
 * slate; a failure is logged, never fatal. Returns the count plus the
 * `${sport}|${playerId}|${stat}` keys of removed rows for revalidation.
 */
async function pruneStaleRows(
  resolved: Array<{
    sport: Sport;
    playerId: number;
    stat: string;
    source: string;
    gameDate: Date;
    line: number;
    oddsType: string;
  }>,
): Promise<{ removed: number; changedKeys: Set<string> }> {
  const changedKeys = new Set<string>();
  if (resolved.length === 0) return { removed: 0, changedKeys };

  // Group this run's writes per slate (source, sport, gameDate).
  const writtenBySlate = new Map<string, RowKey[]>();
  const slates = new Map<string, { source: string; sport: Sport; gameDate: Date }>();
  for (const d of resolved) {
    const slate = `${d.source}|${d.sport}|${d.gameDate.getTime()}`;
    if (!slates.has(slate)) slates.set(slate, { source: d.source, sport: d.sport, gameDate: d.gameDate });
    let written = writtenBySlate.get(slate);
    if (!written) writtenBySlate.set(slate, (written = []));
    written.push({ playerId: d.playerId, stat: d.stat, line: d.line, oddsType: d.oddsType });
  }

  let removed = 0;
  for (const [slate, { source, sport, gameDate }] of slates) {
    try {
      const existing = await withDbRetry(
        () =>
          db.providedLine.findMany({
            where: { source, sport, gameDate },
            select: { id: true, playerId: true, stat: true, line: true, oddsType: true },
          }),
        `stale scan ${slate}`,
      );
      const stale = staleRows(existing, writtenBySlate.get(slate)!);
      const staleIds = stale.map((e) => e.id);
      for (let i = 0; i < staleIds.length; i += 200) {
        const chunk = staleIds.slice(i, i + 200);
        await withDbRetry(
          () => db.providedLine.deleteMany({ where: { id: { in: chunk } } }),
          `stale delete ${slate}`,
        );
      }
      for (const e of stale) changedKeys.add(`${sport}|${e.playerId}|${e.stat}`);
      removed += staleIds.length;
    } catch (e) {
      console.warn(`[providedlines] stale prune failed for ${slate}: ${(e as Error).message}`);
    }
  }
  return { removed, changedKeys };
}

/**
 * Set of `${sport}|${playerId}|${stat}` whose line/odds differ from what's already
 * stored (or are brand new). Reads existing rows once for the sports + game days in
 * play; `fetchedAt` is ignored (it always moves). Best-effort: a read failure just
 * means we revalidate nothing rather than failing the run.
 */
async function changedPlayerStats(
  resolved: Array<{
    sport: Sport;
    playerId: number;
    stat: string;
    source: string;
    gameDate: Date;
    line: number;
    oddsType: string;
    overOdds: number | null;
    underOdds: number | null;
  }>,
): Promise<Set<string>> {
  const changed = new Set<string>();
  if (resolved.length === 0) return changed;

  // Include `line` + `oddsType` (the unique key's tail) so each variant rung is
  // compared to its own prior value; a page is flagged changed if any rung moved.
  const keyOf = (x: {
    sport: string;
    playerId: number;
    stat: string;
    source: string;
    gameDate: Date;
    line: number;
    oddsType: string;
  }) => `${x.sport}|${x.playerId}|${x.stat}|${x.source}|${x.gameDate.getTime()}|${x.line}|${x.oddsType}`;

  try {
    const sports = [...new Set(resolved.map((d) => d.sport))];
    const gameDates = [...new Set(resolved.map((d) => d.gameDate.getTime()))].map((t) => new Date(t));
    const existing = await withDbRetry(
      () =>
        db.providedLine.findMany({
          where: { sport: { in: sports }, gameDate: { in: gameDates } },
          select: { sport: true, playerId: true, stat: true, source: true, gameDate: true, line: true, oddsType: true, overOdds: true, underOdds: true },
        }),
      'providedLine.findMany(existing)',
    );
    const prev = new Map(existing.map((e) => [keyOf(e), e] as const));

    for (const d of resolved) {
      const p = prev.get(keyOf(d));
      if (!p || p.line !== d.line || (p.overOdds ?? null) !== d.overOdds || (p.underOdds ?? null) !== d.underOdds) {
        changed.add(`${d.sport}|${d.playerId}|${d.stat}`);
      }
    }
  } catch (e) {
    console.warn('[providedlines] change detection failed (skipping revalidate):', (e as Error).message);
    return new Set();
  }
  return changed;
}

/** POST the changed player/stat paths to the site's on-demand revalidation route. */
async function revalidateChanged(changed: Set<string>): Promise<void> {
  if (changed.size === 0) return;
  // Only meaningful when the site renders these lines; otherwise revalidating would
  // just burn ISR Writes regenerating pages that show our daily computed line.
  if (process.env.PROVIDED_LINES_ENABLED !== 'true') {
    console.log(`[providedlines] ${changed.size} player/stat lines moved; PROVIDED_LINES_ENABLED off — skipping revalidate.`);
    return;
  }

  try {
    const ids = [...new Set([...changed].map((k) => Number(k.split('|')[1])))];
    const players = await withDbRetry(
      () => db.player.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true } }),
      'player slugs for revalidate',
    );
    const slugById = new Map(players.map((p) => [p.id, p.slug] as const));

    const paths = new Set<string>();
    for (const key of changed) {
      const [sport, idStr, stat] = key.split('|');
      const slug = slugById.get(Number(idStr));
      if (!slug) continue;
      paths.add(`/${sport}/${slug}`); // player page (default view)
      if (isPropStat(sport as Sport, stat)) paths.add(`/${sport}/${slug}/${stat}`); // per-stat page
    }

    const result = await submitRevalidate([...paths], SITE.url);
    if (result.skippedReason) {
      console.log(`[providedlines] revalidate skipped: ${result.skippedReason} (${paths.size} paths).`);
    } else if (result.ok) {
      console.log(`[providedlines] revalidated ${result.submitted} paths (${changed.size} lines moved).`);
    } else {
      console.warn(`[providedlines] revalidate not accepted (HTTP ${result.status}, ${paths.size} paths).`);
    }
  } catch (e) {
    console.warn('[providedlines] revalidate error (non-fatal):', (e as Error).message);
  }
}

recordIngestRun('providedlines', main)
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
