// src/ingest/run-ingest-providedlines.ts
//
// Pull REAL prop lines into the ProvidedLine table, so the board / player pages can
// show the number users actually see instead of our computed median line. Sources:
//   • prizepicks, underdog  — direct scrapers (prizepicks.ts / underdog.ts)
//   • rotowire              — public picks aggregator (rotowire.ts) that adds Sleeper,
//                             DraftKings Pick6, RT Sports + sportsbooks in one call,
//                             each fanned out to its own `source`.
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
import { fetchRotowireLines } from './rotowire';
import type { ProvidedLineRow } from './providedTypes';
import { normalizeName } from '../lib/slate';
import type { Sport } from '../lib/sports';
import { isPropStat } from '../lib/propStats';
import { SITE } from '../lib/site';
import { submitRevalidate } from '../lib/revalidate';

const SOURCES: Array<{ id: string; fetch: () => Promise<ProvidedLineRow[]> }> = [
  { id: 'prizepicks', fetch: fetchPrizePicksLines },
  { id: 'underdog', fetch: fetchUnderdogLines },
  // RotoWire aggregator — one public, proxy-free call returns rows for many books at
  // once (Sleeper, DraftKings Pick6, RT Sports + sportsbooks). Each row carries its
  // own `source`; PrizePicks/Underdog are excluded there (scraped directly above).
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

  type Resolved = {
    sport: Sport;
    playerId: number;
    stat: string;
    source: string;
    gameDate: Date;
    line: number;
    overOdds: number | null;
    underOdds: number | null;
  };

  let unmatched = 0;
  const resolved: Resolved[] = [];
  const perSource = new Map<string, number>();
  for (const r of rows) {
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
    });
  }

  // Which player+stat lines actually MOVED this run — computed against the current
  // rows BEFORE we overwrite them, so on-demand revalidation touches only the pages
  // whose number changed (the whole point: don't regenerate identical HTML).
  const changed = await changedPlayerStats(resolved);

  const ops = resolved.map((d) => () => {
    const data = { line: d.line, overOdds: d.overOdds, underOdds: d.underOdds, fetchedAt: new Date() };
    return db.providedLine.upsert({
      where: {
        sport_playerId_stat_source_gameDate: {
          sport: d.sport,
          playerId: d.playerId,
          stat: d.stat,
          source: d.source,
          gameDate: d.gameDate,
        },
      },
      create: { sport: d.sport, playerId: d.playerId, stat: d.stat, source: d.source, gameDate: d.gameDate, ...data },
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

  const summary = [...perSource.entries()].map(([s, n]) => `${s}=${n}`).join(', ');
  console.log(`[providedlines] upserted ${ops.length} (${summary}); ${unmatched} skipped (unmatched/ambiguous).`);

  // Revalidate the changed pages — best-effort, only when the site actually shows
  // these lines (PROVIDED_LINES_ENABLED). Never fail the ingest on a revalidate blip.
  await revalidateChanged(changed);

  return ops.length;
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
    overOdds: number | null;
    underOdds: number | null;
  }>,
): Promise<Set<string>> {
  const changed = new Set<string>();
  if (resolved.length === 0) return changed;

  const keyOf = (x: { sport: string; playerId: number; stat: string; source: string; gameDate: Date }) =>
    `${x.sport}|${x.playerId}|${x.stat}|${x.source}|${x.gameDate.getTime()}`;

  try {
    const sports = [...new Set(resolved.map((d) => d.sport))];
    const gameDates = [...new Set(resolved.map((d) => d.gameDate.getTime()))].map((t) => new Date(t));
    const existing = await withDbRetry(
      () =>
        db.providedLine.findMany({
          where: { sport: { in: sports }, gameDate: { in: gameDates } },
          select: { sport: true, playerId: true, stat: true, source: true, gameDate: true, line: true, overOdds: true, underOdds: true },
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
