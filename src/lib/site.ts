// Central site configuration used across metadata, sitemap, OG images, and chrome.
// Framework-agnostic (no Next/React imports) so it ports to any client.

const rawUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const SITE = {
  name: 'FantasyFire',
  /** Short tagline used in titles and OG. */
  tagline: 'NBA Player Props Research',
  description:
    'Free NBA player prop research: hit rates over L5/L10/L20/season, defense-vs-position matchups, sample-size confidence intervals, and fair-price math — all from public game logs.',
  /** Canonical origin with no trailing slash. */
  url: rawUrl.replace(/\/+$/, ''),
  /** Public contact email. */
  email: 'hello@fantasyfire.app',
} as const;

/** Build an absolute URL from a path (for canonical/OG/sitemap). */
export function absoluteUrl(path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${SITE.url}${p}`;
}
