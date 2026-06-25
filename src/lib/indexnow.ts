// IndexNow — instant recrawl ping for Bing / Yandex / DuckDuckGo / Seznam (NOT
// Google, which ignores it). A natural fit for a nightly ingest that changes a
// known set of URLs. The key is PUBLIC (it's served at /<key>.txt), so it's baked
// in like the Umami id and works on deploy with no env config; override via env.
//
// Framework-agnostic (global fetch only) so it ports anywhere. Strictly
// best-effort: callers should never let a ping failure fail the ingest.

/** Public IndexNow key. Must match the filename hosted at /public/<key>.txt. */
export const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'e40767357039e27f307f25ca508fd6d8';

const ENDPOINT = 'https://api.indexnow.org/indexnow';
/** IndexNow caps a single submission at 10,000 URLs. */
const MAX_URLS_PER_REQUEST = 10_000;

export interface IndexNowResult {
  submitted: number;
  ok: boolean;
  /** HTTP status of the last batch, or null if skipped/no URLs. */
  status: number | null;
  skippedReason?: string;
}

/**
 * Submit a set of absolute URLs to IndexNow. No-ops (without throwing) when:
 *  - there are no URLs,
 *  - the site origin is localhost (IndexNow needs a public, verifiable host).
 * All URLs must share the same host as `siteUrl` (IndexNow rejects cross-host).
 */
export async function submitIndexNow(
  urls: string[],
  siteUrl: string,
  key: string = INDEXNOW_KEY,
): Promise<IndexNowResult> {
  const unique = [...new Set(urls)];
  if (unique.length === 0) return { submitted: 0, ok: true, status: null, skippedReason: 'no-urls' };

  let host: string;
  try {
    host = new URL(siteUrl).host;
  } catch {
    return { submitted: 0, ok: false, status: null, skippedReason: 'bad-site-url' };
  }
  if (host === 'localhost' || host.startsWith('localhost:') || host.startsWith('127.0.0.1')) {
    return { submitted: 0, ok: true, status: null, skippedReason: 'localhost' };
  }

  const keyLocation = `${siteUrl.replace(/\/+$/, '')}/${key}.txt`;
  let lastStatus: number | null = null;
  let allOk = true;
  let submitted = 0;

  for (let i = 0; i < unique.length; i += MAX_URLS_PER_REQUEST) {
    const urlList = unique.slice(i, i + MAX_URLS_PER_REQUEST);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation, urlList }),
    });
    lastStatus = res.status;
    // 200 and 202 both mean accepted. 422/400 = invalid URLs/key (don't retry).
    if (res.status !== 200 && res.status !== 202) allOk = false;
    else submitted += urlList.length;
  }

  return { submitted, ok: allOk, status: lastStatus };
}
