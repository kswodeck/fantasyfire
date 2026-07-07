// Central site configuration used across metadata, sitemap, OG images, and chrome.
// Framework-agnostic (no Next/React imports) so it ports to any client.

const rawUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Official brand profiles. Leave a `url` empty until the handle is actually
 * reserved and tidy — an empty/abandoned profile reads as worse than no profile,
 * and a wrong `sameAs` hurts E-E-A-T. Only entries with a non-empty `url` are
 * emitted (into Organization `sameAs`, `twitter.site`, and the footer social row).
 * The `handle` (with leading `@`) is used for `twitter.site` when `key === 'x'`.
 */
export interface SocialProfile {
  key: 'x' | 'bluesky' | 'reddit' | 'youtube' | 'discord';
  label: string;
  url: string;
  /** e.g. "@fantasyfire" — only needed for X's twitter:site card tag. */
  handle?: string;
}

export const SITE = {
  name: 'FantasyFire',
  /** Short tagline used in titles and OG. */
  tagline: 'Player Props Research',
  description:
    "NBA, WNBA, MLB, NFL, NHL, and MLS player-prop research that's honest about uncertainty: hit rates over recent windows and the full season, matchup context, sample-size confidence intervals, and fair-price math — from public game logs.",
  /** Canonical origin with no trailing slash. */
  url: rawUrl.replace(/\/+$/, ''),
  /** Public contact email. */
  email: 'hello@fantasyfire.app',
  /**
   * Fill a `url` in once the handle exists and is set up. Until then the brand
   * has no fabricated/abandoned profiles — the honest default.
   */
  socials: [
    { key: 'x', label: 'X', url: '', handle: '@fantasyfire' },
    { key: 'bluesky', label: 'Bluesky', url: '' },
    { key: 'reddit', label: 'Reddit', url: '' },
    { key: 'youtube', label: 'YouTube', url: '' },
  ] satisfies SocialProfile[],
} as const;

/** Configured social profiles that actually have a URL (so nothing fake ships). */
export function activeSocials(): readonly SocialProfile[] {
  return SITE.socials.filter((s) => s.url.trim().length > 0);
}

/** The X handle (e.g. "@fantasyfire") if the X profile is live, else undefined. */
export function twitterHandle(): string | undefined {
  const x = SITE.socials.find((s) => s.key === 'x' && s.url.trim().length > 0);
  return x?.handle;
}

/** Build an absolute URL from a path (for canonical/OG/sitemap). */
export function absoluteUrl(path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${SITE.url}${p}`;
}
