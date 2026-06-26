// src/ingest/run-ingest-providedlines.ts
//
// Pull REAL DFS pick'em lines (PrizePicks + Underdog) into the ProvidedLine table,
// so the board / player pages can show the number users actually see instead of our
// computed median line. Source ids: "prizepicks", "underdog".
//
//   pnpm ingest:providedlines
//
// NOTE: these are UNOFFICIAL public endpoints (see prizepicks.ts / underdog.ts) —
// ToS gray area, no SLA, may IP-block from datacenter IPs. Running this script is
// the opt-in; it is deliberately NOT wired into the nightly ingest.yml. The WEB APP
// only PREFERS these lines when PROVIDED_LINES_ENABLED=true (separate switch), so
// ingesting alone never changes what's rendered.
//
// SportsGameOdds (sportsbook lines) is a separate, contracted alternative — see
// fetchProvidedLines in sportsgameodds.ts — intentionally not wired here since the
// chosen sources are the DFS books.
import 'dotenv/config';
import { db } from '../lib/db';
import { recordIngestRun } from './ingestRun';
import { fetchPrizePicksLines } from './prizepicks';
import { fetchUnderdogLines } from './underdog';
import { fetchRotowireLines } from './rotowire';
import type { ProvidedLineRow } from './providedTypes';
import { normalizeName } from '../lib/slate';
import type { Sport } from '../lib/sports';

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
  const players = await db.player.findMany({
    where: { sport },
    select: { id: true, firstName: true, lastName: true },
  });
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

  let unmatched = 0;
  const ops: Array<() => Promise<unknown>> = [];
  const perSource = new Map<string, number>();
  for (const r of rows) {
    const playerId = indexBySport.get(r.sport)?.get(normalizeName(r.externalPlayerName));
    if (!playerId) {
      unmatched++;
      continue;
    }
    perSource.set(r.source, (perSource.get(r.source) ?? 0) + 1);
    const data = { line: r.line, overOdds: r.overOdds, underOdds: r.underOdds, fetchedAt: new Date() };
    ops.push(() =>
      db.providedLine.upsert({
        where: {
          sport_playerId_stat_source_gameDate: {
            sport: r.sport,
            playerId,
            stat: r.stat,
            source: r.source,
            gameDate: r.gameDate,
          },
        },
        create: { sport: r.sport, playerId, stat: r.stat, source: r.source, gameDate: r.gameDate, ...data },
        update: data,
      }),
    );
  }

  // Concurrent batches (no $transaction — it times out over a remote pooler).
  const BATCH = 20;
  for (let i = 0; i < ops.length; i += BATCH) {
    await Promise.all(ops.slice(i, i + BATCH).map((fn) => fn()));
  }

  const summary = [...perSource.entries()].map(([s, n]) => `${s}=${n}`).join(', ');
  console.log(`[providedlines] upserted ${ops.length} (${summary}); ${unmatched} skipped (unmatched/ambiguous).`);
  return ops.length;
}

recordIngestRun('providedlines', main)
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
