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
