// Cross-request cache for league-wide reads.
//
// React cache() only dedupes within ONE render, so every player page re-ran the same
// season-wide scans (DvP tables, pace, league rates) even though their answer is
// identical for every player in the sport and only moves when the nightly ingest
// lands. Under a crawl burst that was thousands of identical aggregate scans over
// PlayerGameStat, holding pool connections for seconds each — the load behind Sentry's
// "Slow DB Query" issues and the "timeout exceeded when trying to connect" 500s.
//
// unstable_cache stores the result in Next's data cache (shared across instances on
// Vercel), keyed by `keyParts` + the call's arguments. Results are JSON-serialized, so
// cached functions must return plain data (no Map, no Date). A throw is never cached.
//
// Outside Next (tsx ingest scripts, vitest) there is no incremental cache and
// unstable_cache throws, so there the function simply runs uncached.
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

export function sharedCache<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[],
  revalidateSeconds: number,
): (...args: A) => Promise<R> {
  const cached = unstable_cache(fn, keyParts, { revalidate: revalidateSeconds });
  // cache() on top keeps the per-render dedupe the callers relied on before.
  return cache((...args: A) => (process.env.NEXT_RUNTIME ? cached(...args) : fn(...args)));
}

/**
 * Season aggregates: inputs change once a night when box scores land.
 *
 * Must be >= the revalidate of EVERY page that reads it. During an ISR render
 * unstable_cache lowers the page's revalidate to its own TTL (next/dist/server/web/
 * spec-extension/unstable-cache.js), so a 6h entry would quietly turn the 24h player
 * pages into 6h pages — 4x the regenerations and ISR writes this is meant to save.
 * 24h matches the longest consumer (player/stat pages). Shorter-lived pages (15-min
 * boards) may see a table up to a day old; a season average barely moves in a day.
 */
export const SEASON_AGGREGATE_TTL = 24 * 60 * 60;
