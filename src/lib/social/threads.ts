// Threads poster via the official Threads API (graph.threads.net, own-account
// tester app so no App Review; see docs/MARKETING.md §8). Same two-step shape
// as Instagram: create a container (image + text, or text-only — links in
// Threads text ARE clickable), then publish it.

const GRAPH = 'https://graph.threads.net/v1.0';

export interface ThreadsTarget {
  /** The Threads profile's user id (GET /me?fields=id). */
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
    throw new Error(`threads ${path} failed (HTTP ${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as { id: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Create + publish a post (image when a card URL exists, else text-only). */
export async function postToThreads(
  target: ThreadsTarget,
  post: { text: string; imageUrl?: string },
): Promise<string> {
  const container = await graphPost(`${target.userId}/threads`, {
    ...(post.imageUrl
      ? { media_type: 'IMAGE', image_url: post.imageUrl }
      : { media_type: 'TEXT' }),
    text: post.text,
    access_token: target.accessToken,
  });

  // Meta recommends allowing the container a moment to process before publish.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(5_000);
    try {
      const published = await graphPost(`${target.userId}/threads_publish`, {
        creation_id: container.id,
        access_token: target.accessToken,
      });
      return published.id;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('threads publish failed');
}
