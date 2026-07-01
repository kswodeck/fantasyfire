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
    const data = {
      overOdds: r.overOdds,
      underOdds: r.underOdds,
      oddsType: r.oddsType ?? null,
      multiplier: r.multiplier ?? null,
      fetchedAt: new Date(),
    };
    ops.push(() =>
      db.providedLine.upsert({
        where: {
          sport_playerId_stat_source_gameDate_line: {
            sport: r.sport,
            playerId,
            stat: r.stat,
            source: r.source,
            gameDate: r.gameDate,
            line: r.line,
          },
        },
        create: { sport: r.sport, playerId, stat: r.stat, source: r.source, gameDate: r.gameDate, line: r.line, ...data },
        update: data,
      }),
    );
  }

  // Concurrent batches (no $transaction — it times out over a remote pooler).
  // Each batch retries transient pooler blips so one ETIMEDOUT doesn't fail the run.
  const BATCH = 20;
  for (let i = 0; i < ops.length; i += BATCH) {
    const batch = ops.slice(i, i + BATCH);
    await withDbRetry(() => Promise.all(batch.map((fn) => fn())), `upsert batch ${i / BATCH}`);
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
