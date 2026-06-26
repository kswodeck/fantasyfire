// Fetch wrapper for the DFS scrapers (PrizePicks / Underdog).
//
// PrizePicks + Underdog block datacenter IPs, so a cloud scheduler (GitHub Actions,
// a VPS, etc.) usually can't reach them directly. Set SCRAPE_PROXY_URL to a
// residential proxy / web-unblocker and these requests route through it, giving the
// scrape a residential IP from anywhere. Unset → a plain direct fetch (works from a
// residential machine, e.g. the local scheduled task).
//
//   SCRAPE_PROXY_URL=http://user:pass@gateway.residential-provider.com:7000
//
// The undici ProxyAgent is imported lazily, so nothing is required unless a proxy
// is actually configured.
let resolved: { dispatcher: unknown } | null | undefined;

async function proxyDispatcher(): Promise<unknown | null> {
  if (resolved !== undefined) return resolved?.dispatcher ?? null;
  const url = process.env.SCRAPE_PROXY_URL?.trim();
  if (!url) {
    resolved = null;
    return null;
  }
  const { ProxyAgent } = await import('undici');
  resolved = { dispatcher: new ProxyAgent(url) };
  return resolved.dispatcher;
}

/** fetch(), routed through SCRAPE_PROXY_URL when set; otherwise a direct request. */
export async function scrapeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const dispatcher = await proxyDispatcher();
  if (!dispatcher) return fetch(url, init);
  // `dispatcher` is undici's non-standard fetch option (Node's global fetch IS undici).
  return fetch(url, { ...init, dispatcher } as RequestInit & { dispatcher: unknown });
}
