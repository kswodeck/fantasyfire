// Central site configuration used across metadata, sitemap, OG images, and chrome.
// Framework-agnostic (no Next/React imports) so it ports to any client.

const rawUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const SITE = {
  name: 'FantasyFire',
  /** Short tagline used in titles and OG. */
  tagline: 'Player Props Research',
  description:
    "NBA, MLB, and NFL player-prop research that's honest about uncertainty: hit rates over recent windows and the full season, matchup context, sample-size confidence intervals, and fair-price math — from public game logs.",
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
