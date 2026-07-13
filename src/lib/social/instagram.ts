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

/** Publish a container with a brief retry while it finishes processing. */
async function publishContainer(target: InstagramTarget, creationId: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(5_000);
    try {
      const published = await graphPost(`${target.userId}/media_publish`, {
        creation_id: creationId,
        access_token: target.accessToken,
      });
      return published.id;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('instagram publish failed');
}

/**
 * Create + publish a single image; returns the published media id.
 * kind 'story' publishes to Stories (vertical 1080x1920 image, no caption —
 * the API ignores captions on STORIES containers); default is a feed post.
 */
export async function postToInstagram(
  target: InstagramTarget,
  post: { imageUrl: string; caption?: string; kind?: 'feed' | 'story' },
): Promise<string> {
  const container = await graphPost(`${target.userId}/media`, {
    image_url: post.imageUrl,
    ...(post.kind === 'story'
      ? { media_type: 'STORIES' }
      : post.caption
        ? { caption: post.caption }
        : {}),
    access_token: target.accessToken,
  });

  return publishContainer(target, container.id);
}

/**
 * Create + publish a carousel post of 2-10 images (the multi-sport digest):
 * one child container per image, then a CAROUSEL parent, then publish.
 */
export async function postInstagramCarousel(
  target: InstagramTarget,
  post: { imageUrls: string[]; caption: string },
): Promise<string> {
  const urls = post.imageUrls.slice(0, 10);
  if (urls.length < 2) throw new Error('instagram carousel needs 2-10 images');
  const children: string[] = [];
  for (const imageUrl of urls) {
    const child = await graphPost(`${target.userId}/media`, {
      image_url: imageUrl,
      is_carousel_item: 'true',
      access_token: target.accessToken,
    });
    children.push(child.id);
  }
  const parent = await graphPost(`${target.userId}/media`, {
    media_type: 'CAROUSEL',
    children: children.join(','),
    caption: post.caption,
    access_token: target.accessToken,
  });
  return publishContainer(target, parent.id);
}
