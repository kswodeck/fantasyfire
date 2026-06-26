// Fetch wrapper for the line scrapers (PrizePicks / Underdog / RotoWire).
//
// All current sources are reachable directly from GitHub Actions (datacenter IPs) —
// this project deliberately uses NO proxy and no residential dependency. The wrapper
// just adds a request timeout so a stalled endpoint fails fast instead of hanging the
// whole ingest.
const DEFAULT_TIMEOUT_MS = 30_000;

/** fetch() with a default timeout (a caller-supplied `signal` takes precedence). */
export async function scrapeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS) });
}
