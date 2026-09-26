// Retry transient Postgres connection failures around an ingest DB call.
//
// The Supabase transaction pooler can momentarily refuse or time out a connect —
// surfacing through Prisma/node-postgres as ETIMEDOUT / ECONNRESET / "Can't reach
// database server" / "Timed out fetching a new connection". These are infrastructure
// blips, not query bugs: a short backoff almost always clears them. Because the pg
// pool connects lazily, the FIRST query after a long scrape phase is the one that
// eats the blip — and with no retry a single timeout fails an entire cron run (and
// cascades into the IngestRun audit insert failing too).
//
// Only connection-class errors are retried; a real query error (bad SQL, constraint
// violation, …) is rethrown immediately so we never mask genuine bugs.

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Codes / message fragments node-postgres + Prisma use for transient connectivity.
const TRANSIENT = [
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'EAI_AGAIN',
  'Connection terminated',
  "Can't reach database server",
  'Timed out fetching a new connection',
];

function isTransient(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  if (typeof code === 'string' && TRANSIENT.includes(code)) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return TRANSIENT.some((t) => msg.includes(t));
}

/**
 * Postgres cancelled the statement for running past `statement_timeout` (SQLSTATE
 * 57014). Deliberately NOT in TRANSIENT: re-running the same statement against a
 * database that just took too long to finish it mostly buys another timeout, and at
 * a multi-second timeout four attempts can eat a cron run's whole budget. A caller
 * that can make the retry cheaper — send less work per statement — should catch
 * this and do that instead (see the upsert loop in run-ingest-providedlines.ts).
 * The cancelled statement is rolled back in full, so retrying is always safe.
 */
export function isStatementTimeout(e: unknown): boolean {
  if ((e as { meta?: { code?: string } })?.meta?.code === '57014') return true;
  // Postgres's exact text for a 57014 raised by statement_timeout. Prisma's P2010
  // wraps it in its own message, so match the text rather than a bare code number.
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('canceling statement due to statement timeout');
}

/**
 * Run a DB operation, retrying transient connection failures with exponential
 * backoff. Defaults: 4 attempts, ~0.5s base backoff (0.5s / 1s / 2s + jitter).
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  label = 'db',
  attempts = 4,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isTransient(e) || attempt === attempts) throw e;
      const backoff = 500 * 2 ** (attempt - 1) + Math.random() * 500;
      console.warn(
        `[dbRetry] ${label} attempt ${attempt}/${attempts} failed ` +
          `(${e instanceof Error ? e.message : String(e)}); retrying in ${Math.round(backoff)}ms`,
      );
      await sleep(backoff);
    }
  }
  throw lastErr;
}
