// Retry a DB call whose CONNECTION could not be obtained.
//
// Under load (the ~09:00-13:00 UTC ingest + crawl window) the Supabase transaction
// pooler can leave a request waiting past the pool's 10s connectionTimeoutMillis, and
// pg-pool rejects with "timeout exceeded when trying to connect". Unretried, that
// 500s the page (Sentry SENTRY-FANTASYFIRE-APP-Q: ~1K events in a few hours on
// /[sport]/[playerSlug]/[stat]) — even though in the captured trace the very next
// query on the same request got a connection 1.4s later.
//
// Only failures to GET a connection qualify. At that point no statement has been
// sent, so a retry is safe even for a write. Errors that can happen mid-statement
// (ECONNRESET, "Connection terminated" without the connect-timeout suffix) are
// deliberately excluded: the server may already have applied it.

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const CONNECT_FAILURE_MESSAGES = [
  // pg-pool: waited connectionTimeoutMillis for a client (queue or socket).
  'timeout exceeded when trying to connect',
  // pg Client: the socket connect itself exceeded connectionTimeoutMillis.
  'Connection terminated due to connection timeout',
  // Prisma's wording for an unreachable server / exhausted pool.
  "Can't reach database server",
  'Timed out fetching a new connection',
  // Supabase's pooler (Supavisor) found no free server connection for the
  // transaction — it never reached Postgres (Sentry SENTRY-FANTASYFIRE-APP-S).
  'ECHECKOUTTIMEOUT',
];
const CONNECT_FAILURE_CODES = new Set(['ECONNREFUSED', 'EAI_AGAIN', 'P1001']);

/** True when `e` (or anything in its `cause` chain) means no connection was obtained. */
export function isConnectFailure(e: unknown): boolean {
  for (let cur = e, depth = 0; cur && depth < 5; cur = (cur as { cause?: unknown }).cause, depth++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === 'string' && CONNECT_FAILURE_CODES.has(code)) return true;
    const msg = cur instanceof Error ? cur.message : typeof cur === 'string' ? cur : '';
    if (CONNECT_FAILURE_MESSAGES.some((m) => msg.includes(m))) return true;
  }
  return false;
}

/**
 * Run `fn`, retrying connect failures up to `attempts` total tries with a short
 * jittered backoff. Any other error is rethrown immediately.
 */
export async function retryOnConnectFailure<T>(
  fn: () => Promise<T>,
  { attempts = 2, baseMs = 300, wait = sleep }: { attempts?: number; baseMs?: number; wait?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= attempts || !isConnectFailure(e)) throw e;
      const backoff = baseMs * 2 ** (attempt - 1) + Math.random() * baseMs;
      console.warn(
        // Prisma prefixes a multi-line call-site excerpt; the cause is the last line.
        `[db] connect failed (attempt ${attempt}/${attempts}): ${String(e instanceof Error ? e.message : e).trim().split('\n').pop()}; ` +
          `retrying in ${Math.round(backoff)}ms`,
      );
      await wait(backoff);
    }
  }
}
