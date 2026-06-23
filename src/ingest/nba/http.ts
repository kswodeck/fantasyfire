// src/ingest/nba/http.ts
//
// Low-level HTTP for stats.nba.com: required browser-like headers, a serialized
// rate limiter, and a fetch with timeout + retry/backoff. Crucially, it detects
// the most common failure mode — stats.nba.com silently hanging on requests from
// datacenter/cloud IPs — and throws a clear, actionable error instead of looping
// or (worse) letting callers fabricate data.

export const NBA_STATS_BASE_URL = 'https://stats.nba.com/stats';

/** Without these headers, stats.nba.com hangs forever. */
export const NBA_STATS_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.nba.com/',
  Origin: 'https://www.nba.com',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  Connection: 'keep-alive',
};

export class NbaHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`NBA stats HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = 'NbaHttpError';
  }
}

export class NbaTimeoutError extends Error {
  constructor(
    public readonly url: string,
    public readonly timeoutMs: number
  ) {
    super(`NBA stats request timed out after ${timeoutMs}ms: ${url}`);
    this.name = 'NbaTimeoutError';
  }
}

/** Every retry timed out — almost always a datacenter/cloud IP block. */
export class NbaLikelyBlockedError extends Error {
  constructor(public readonly url: string) {
    super(
      `NBA stats request repeatedly timed out: ${url}\n` +
        `This is almost always stats.nba.com blocking the host's IP range ` +
        `(common on AWS / Vercel / cloud runners). Fixes:\n` +
        `  - run the ingest from GitHub Actions, a small VPS, or locally\n` +
        `  - or switch to the ESPN fallback endpoints\n` +
        `This is NOT a code bug — do not fabricate or stub data to get around it.`
    );
    this.name = 'NbaLikelyBlockedError';
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Serializes calls and spaces them at least `minIntervalMs` apart. */
export class RateLimiter {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly minIntervalMs: number) {}

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const start = Date.now();
      try {
        return await fn();
      } finally {
        const wait = this.minIntervalMs - (Date.now() - start);
        if (wait > 0) await sleep(wait);
      }
    });
    // Keep the chain alive even if a call rejects.
    this.tail = run.catch(() => undefined);
    return run as Promise<T>;
  }
}

export interface FetchOptions {
  /** Total attempts including the first (default 4). */
  attempts?: number;
  /** Per-attempt timeout in ms (default 20_000). */
  timeoutMs?: number;
  /** Base for exponential backoff in ms (default 1_000). */
  baseBackoffMs?: number;
}

export async function fetchNbaJson<T = unknown>(
  url: string,
  opts: FetchOptions = {}
): Promise<T> {
  const attempts = opts.attempts ?? 4;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const baseBackoff = opts.baseBackoffMs ?? 1_000;

  let allTimeouts = true; // tracks whether *every* failure was a timeout
  let lastErr: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, { headers: NBA_STATS_HEADERS, signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      if (isAbortError(err)) {
        lastErr = new NbaTimeoutError(url, timeoutMs);
      } else {
        allTimeouts = false; // genuine network error, not a hang
        lastErr = err;
      }
      if (attempt < attempts) {
        await backoff(attempt, baseBackoff);
        continue;
      }
      break;
    }
    clearTimeout(timer);

    // Retryable server-side conditions.
    if (res.status === 429 || res.status >= 500) {
      allTimeouts = false;
      lastErr = new NbaHttpError(res.status, await safeText(res));
      if (attempt < attempts) {
        await backoff(attempt, baseBackoff);
        continue;
      }
      break;
    }

    // Non-retryable client error.
    if (!res.ok) {
      throw new NbaHttpError(res.status, await safeText(res));
    }

    return (await res.json()) as T;
  }

  if (allTimeouts) throw new NbaLikelyBlockedError(url);
  throw lastErr ?? new Error(`NBA stats request failed: ${url}`);
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException) return err.name === 'AbortError';
  return (err as { name?: string })?.name === 'AbortError';
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<no body>';
  }
}

function backoff(attempt: number, base: number): Promise<void> {
  const jitter = Math.random() * base;
  return sleep(base * 2 ** (attempt - 1) + jitter);
}
