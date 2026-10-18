// Guards for the season-wide "league scans" (DvP tables, basketball pace) that the
// player page and boards run over PlayerGameStat.
//
// In the 09:00-13:00 UTC slow-database window one of these ran for 2m7s before
// Postgres's own statement_timeout cancelled it (Sentry SENTRY-FANTASYFIRE-APP-W:
// cbb rebounds DvP). For that whole time it held one of the process's 3 pool
// connections AND one of the Supabase pooler's server connections — a few of those at
// once is what starves everything else into "timeout exceeded when trying to
// connect" / ECHECKOUTTIMEOUT. Healthy, an NBA scan takes ~14-25ms (measured — see
// boardMatchupContext); cbb is the largest table and unmeasured, but it only fails
// inside the slow window, so outside it it finishes well within Postgres's limit.
//
// Two guards:
//  - leagueScanRaw caps each scan with a transaction-local statement_timeout, so a
//    doomed scan gives its connection back in seconds, not minutes.
//  - optionalScan lets the player read treat a failed scan as "no matchup context"
//    instead of a 500, and stops re-asking for a minute so a crawl burst doesn't
//    re-run the same doomed scan on every request.
import { db } from '@/lib/db';
import { isConnectFailure, isStatementTimeout } from '@/lib/dbConnectRetry';

/**
 * Server-side cap for one league scan on the request path: ~1000x a healthy NBA scan,
 * ~6x shorter than the 2m+ hold that pinned the pooler. During `next build` there is
 * no cap — prerendering is throughput work where a slow page is fine and a failed one
 * costs the deploy (same reasoning as db.ts's build-phase pool settings).
 */
export const LEAGUE_SCAN_TIMEOUT_MS: number | null =
  process.env.NEXT_PHASE === 'phase-production-build' ? null : 20_000;

/**
 * $queryRawUnsafe with a statement_timeout of `timeoutMs`. SET LOCAL scopes it to one
 * transaction, which is the only scope that survives Supabase's TRANSACTION pooler
 * (a session-level SET would leak onto whichever client gets that server connection
 * next). `null` runs the query plainly.
 */
export async function leagueScanRaw<T>(
  sql: string,
  params: unknown[],
  timeoutMs: number | null = LEAGUE_SCAN_TIMEOUT_MS,
): Promise<T> {
  if (timeoutMs == null) return db.$queryRawUnsafe<T>(sql, ...params);
  const ms = Math.max(1, Math.trunc(timeoutMs));
  return db.$transaction(
    async (tx) => {
      // Integer literal, not a bind parameter: SET does not accept parameters.
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${ms}`);
      return tx.$queryRawUnsafe<T>(sql, ...params);
    },
    // maxWait matches the pool's connect wait (db.ts); the client-side transaction
    // timeout sits past the server-side one so Postgres's 57014 is what surfaces.
    { maxWait: 10_000, timeout: ms + 10_000 },
  );
}

/** A failure that says the database is too slow / unreachable right now — not a bug. */
export function isDbUnavailable(e: unknown): boolean {
  // P2028: Prisma's interactive-transaction API error (couldn't start or expired).
  return isStatementTimeout(e) || isConnectFailure(e) || (e as { code?: unknown })?.code === 'P2028';
}

/** After a scan fails, how long this instance serves the fallback without re-asking. */
export const OPTIONAL_SCAN_COOLDOWN_MS = 60_000;
const cooldownUntil = new Map<string, number>();

/**
 * Run an optional league scan; on a database-unavailable failure return `fallback`
 * and skip `key` for OPTIONAL_SCAN_COOLDOWN_MS. Any other error (a real bug) throws.
 */
export async function optionalScan<T>(
  key: string,
  fn: () => Promise<T>,
  fallback: T,
  now: () => number = Date.now,
): Promise<T> {
  const until = cooldownUntil.get(key);
  if (until !== undefined && now() < until) return fallback;
  try {
    const result = await fn();
    cooldownUntil.delete(key);
    return result;
  } catch (e) {
    if (!isDbUnavailable(e)) throw e;
    cooldownUntil.set(key, now() + OPTIONAL_SCAN_COOLDOWN_MS);
    console.warn(
      `[leagueScan] ${key} unavailable; continuing without it for ${OPTIONAL_SCAN_COOLDOWN_MS / 1000}s:`,
      String(e instanceof Error ? e.message : e).trim().split('\n').pop(),
    );
    return fallback;
  }
}

/** Test hook: forget every cooldown. */
export function resetOptionalScanCooldowns(): void {
  cooldownUntil.clear();
}
