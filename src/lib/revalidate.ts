// On-demand ISR revalidation client — the ingest's side of POST /api/revalidate.
//
// After an ingest writes data that actually changed, it calls this to tell the
// deployed site to rebuild just those pages, instead of every page regenerating on
// a timer (the ISR Writes that blew past the Vercel limit). Framework-agnostic
// (global fetch only) and strictly best-effort: callers must never let a failed
// revalidation fail the ingest.

export interface RevalidateResult {
  submitted: number;
  ok: boolean;
  /** HTTP status, or null when skipped before any request. */
  status: number | null;
  skippedReason?: string;
}

/** A single POST can carry at most this many paths (matches the route's cap). */
const MAX_PATHS_PER_REQUEST = 5_000;

/**
 * Ask the deployed site to revalidate `paths`. No-ops (without throwing) when:
 *  - there are no paths,
 *  - REVALIDATE_SECRET is unset (feature off),
 *  - the site origin is localhost (nothing to revalidate in dev).
 */
export async function submitRevalidate(paths: string[], siteUrl: string): Promise<RevalidateResult> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return { submitted: 0, ok: true, status: null, skippedReason: 'no-paths' };

  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return { submitted: 0, ok: true, status: null, skippedReason: 'no-secret' };

  let host: string;
  try {
    host = new URL(siteUrl).host;
  } catch {
    return { submitted: 0, ok: false, status: null, skippedReason: 'bad-site-url' };
  }
  if (host === 'localhost' || host.startsWith('localhost:') || host.startsWith('127.0.0.1')) {
    return { submitted: 0, ok: true, status: null, skippedReason: 'localhost' };
  }

  const endpoint = `${siteUrl.replace(/\/+$/, '')}/api/revalidate`;
  let lastStatus: number | null = null;
  let allOk = true;
  let submitted = 0;

  for (let i = 0; i < unique.length; i += MAX_PATHS_PER_REQUEST) {
    const batch = unique.slice(i, i + MAX_PATHS_PER_REQUEST);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ paths: batch }),
    });
    lastStatus = res.status;
    if (res.status !== 200) allOk = false;
    else submitted += batch.length;
  }

  return { submitted, ok: allOk, status: lastStatus };
}
