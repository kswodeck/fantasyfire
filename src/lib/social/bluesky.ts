// Minimal Bluesky (AT Protocol) poster — raw XRPC over fetch, no new dependency.
// Auth is an app password (Settings → App Passwords — NEVER the account password);
// see docs/MARKETING.md §3 + §8. Endpoints used: com.atproto.server.createSession,
// com.atproto.repo.uploadBlob, com.atproto.repo.createRecord.
//
// Links in Bluesky posts are NOT auto-detected — they must be declared as "facets"
// with UTF-8 BYTE ranges into the post text. buildLinkFacet is exported for tests
// (an emoji before the link shifts byte offsets vs. character offsets).

const DEFAULT_SERVICE = 'https://bsky.social';

export interface BlueskyCredentials {
  /** Handle or email, e.g. "fantasyfire.app". */
  identifier: string;
  /** An app password, not the real password. */
  appPassword: string;
  service?: string;
}

interface LinkFacet {
  index: { byteStart: number; byteEnd: number };
  features: { $type: 'app.bsky.richtext.facet#link'; uri: string }[];
}

interface TagFacet {
  index: { byteStart: number; byteEnd: number };
  features: { $type: 'app.bsky.richtext.facet#tag'; tag: string }[];
}

/** Bluesky's own cap on tags it will index for a post. */
const MAX_TAGS = 8;

/**
 * Facet turning the FIRST occurrence of `display` inside `text` into a link to
 * `uri`. Byte offsets are UTF-8 (not character indexes). Null when not found.
 */
export function buildLinkFacet(text: string, display: string, uri: string): LinkFacet | null {
  const at = text.indexOf(display);
  if (at < 0) return null;
  const enc = new TextEncoder();
  const byteStart = enc.encode(text.slice(0, at)).length;
  const byteEnd = byteStart + enc.encode(display).length;
  return {
    index: { byteStart, byteEnd },
    features: [{ $type: 'app.bsky.richtext.facet#link', uri }],
  };
}

/**
 * Facets marking every "#tag" in `text` as a Bluesky tag. WITHOUT these a
 * hashtag is inert plain text — not clickable, not in tag search, not picked up
 * by the hashtag-driven custom feeds — so this is what makes the tags we append
 * actually worth their characters.
 *
 * Byte offsets are UTF-8 (the flame emoji earlier in our captions shifts them
 * vs. character indexes). The stored `tag` value omits the leading '#'. Matches
 * letters/digits/underscore, so trailing punctuation isn't swallowed.
 */
export function buildTagFacets(text: string): TagFacet[] {
  const enc = new TextEncoder();
  const facets: TagFacet[] = [];
  // (^|\s) keeps "C#" or a mid-word '#' from matching; the tag must start a word.
  const re = /(^|\s)#([A-Za-z0-9_]+)/g;
  for (const m of text.matchAll(re)) {
    const tag = m[2];
    // Offset of the '#' itself: match start + the leading whitespace we captured.
    const at = (m.index ?? 0) + m[1].length;
    const byteStart = enc.encode(text.slice(0, at)).length;
    const byteEnd = byteStart + enc.encode(`#${tag}`).length;
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag }],
    });
    if (facets.length >= MAX_TAGS) break;
  }
  return facets;
}

/** A created record's address — pass back as reply refs to build threads. */
export interface BlueskyRef {
  uri: string;
  cid: string;
}

export interface BlueskyPostInput {
  text: string;
  /** Display substring of `text` to hyperlink (with `linkTarget`). */
  linkDisplay?: string;
  linkTarget?: string;
  image?: { data: ArrayBuffer; alt: string; width?: number; height?: number };
  /** Up to 4 images in one post (Bluesky's embed limit); wins over `image`. */
  images?: { data: ArrayBuffer; alt: string; width?: number; height?: number }[];
  /** Thread this post under root/parent (both from earlier postToBluesky returns). */
  reply?: { root: BlueskyRef; parent: BlueskyRef };
}

async function xrpc<T>(
  service: string,
  method: string,
  body: BodyInit,
  headers: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${service}/xrpc/${method}`, { method: 'POST', body, headers });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`bluesky ${method} failed (HTTP ${res.status}): ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Create the post; returns its ref (for threading). Throws on any failure (caller catches). */
export async function postToBluesky(
  creds: BlueskyCredentials,
  post: BlueskyPostInput,
): Promise<BlueskyRef> {
  const service = creds.service ?? DEFAULT_SERVICE;

  const session = await xrpc<{ accessJwt: string; did: string }>(
    service,
    'com.atproto.server.createSession',
    JSON.stringify({ identifier: creds.identifier, password: creds.appPassword }),
    { 'content-type': 'application/json' },
  );
  const auth = { authorization: `Bearer ${session.accessJwt}` };

  let embed: Record<string, unknown> | undefined;
  const imageList = post.images?.length ? post.images.slice(0, 4) : post.image ? [post.image] : [];
  if (imageList.length > 0) {
    const images = [];
    for (const img of imageList) {
      const uploaded = await xrpc<{ blob: unknown }>(
        service,
        'com.atproto.repo.uploadBlob',
        img.data,
        { ...auth, 'content-type': 'image/png' },
      );
      images.push({
        image: uploaded.blob,
        alt: img.alt,
        ...(img.width && img.height
          ? { aspectRatio: { width: img.width, height: img.height } }
          : {}),
      });
    }
    embed = { $type: 'app.bsky.embed.images', images };
  }

  const facet =
    post.linkDisplay && post.linkTarget
      ? buildLinkFacet(post.text, post.linkDisplay, post.linkTarget)
      : null;
  // Link + tag facets ship together; tags are inert without their facets.
  const facets = [...(facet ? [facet] : []), ...buildTagFacets(post.text)];

  const created = await xrpc<{ uri: string; cid: string }>(
    service,
    'com.atproto.repo.createRecord',
    JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text: post.text,
        createdAt: new Date().toISOString(),
        ...(facets.length > 0 ? { facets } : {}),
        ...(embed ? { embed } : {}),
        ...(post.reply ? { reply: post.reply } : {}),
      },
    }),
    { ...auth, 'content-type': 'application/json' },
  );
  return { uri: created.uri, cid: created.cid };
}
