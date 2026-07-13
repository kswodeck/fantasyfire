// Instagram poster via the Content Publishing API ("Instagram API with
// Instagram Login" — graph.instagram.com, professional account, own-account
// tester app so no App Review; see docs/MARKETING.md §8). Two-step publish:
// create a media container from a PUBLIC JPEG URL, then publish it. Instagram
// rejects PNG — the poster passes the /api/og/daily/[sport]/jpeg card variant.
// Captions can't carry clickable links (Instagram strips them) — traffic goes
// through the bio link; the caption still names the site.

const GRAPH = 'https://graph.instagram.com/v23.0';

export interface InstagramTarget {
  /** The professional account's IG user id. */
  userId: string;
  /** Long-lived access token (60-day; refresh per docs/MARKETING.md). */
  accessToken: string;
}

async function graphPost(path: string, params: Record<string, string>): Promise<{ id: string }> {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`instagram ${path} failed (HTTP ${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as { id: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Create + publish a single-image post; returns the published media id. */
export async function postToInstagram(
  target: InstagramTarget,
  post: { imageUrl: string; caption: string },
): Promise<string> {
  const container = await graphPost(`${target.userId}/media`, {
    image_url: post.imageUrl,
    caption: post.caption,
    access_token: target.accessToken,
  });

  // Images are usually ready immediately; retry publish briefly in case the
  // container is still processing.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(5_000);
    try {
      const published = await graphPost(`${target.userId}/media_publish`, {
        creation_id: container.id,
        access_token: target.accessToken,
      });
      return published.id;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('instagram publish failed');
}
