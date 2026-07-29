// Registry for the "provided line" sources (the DFS books we scrape + any
// sportsbooks) — display labels, the default, and a stable display order. Pure and
// client-safe (no db / server-only), so both the server data layer and the client
// dropdown import it.

/** The source shown first / used by default (PrizePicks, per product decision). */
export const DEFAULT_PROVIDED_SOURCE = 'prizepicks';

/** Pretty label per source id. Unknown ids fall back to the raw id. */
export const PROVIDED_SOURCE_LABELS: Record<string, string> = {
  // DFS pick'em
  prizepicks: 'PrizePicks',
  underdog: 'Underdog',
  sleeper: 'Sleeper',
  pick6: 'DK Pick6',
  rtsports: 'RT Sports',
  dabble: 'Dabble',
  betr: 'Betr',
  parlayplay: 'ParlayPlay',
  // Sportsbooks (from RotoWire's picks aggregator)
  draftkings: 'DraftKings',
  fanduel: 'FanDuel',
  betmgm: 'BetMGM',
  caesars: 'Caesars',
  hardrock: 'Hard Rock Bet',
  betrivers: 'BetRivers',
  espnbet: 'ESPN BET',
  pointsbet: 'PointsBet',
  unibet: 'Unibet',
  williamhill: 'William Hill',
  bovada: 'Bovada',
};

const ORDER = [
  'prizepicks', 'underdog', 'sleeper', 'pick6', 'rtsports', 'dabble', 'betr', 'parlayplay',
  'draftkings', 'fanduel', 'betmgm', 'caesars', 'hardrock', 'betrivers', 'espnbet', 'pointsbet', 'unibet', 'williamhill', 'bovada',
];

export function sourceLabel(id: string): string {
  return PROVIDED_SOURCE_LABELS[id] ?? id;
}

/** Canonical site domain per source — used to fetch the book's real logo. */
const PROVIDED_SOURCE_DOMAINS: Record<string, string> = {
  prizepicks: 'prizepicks.com',
  underdog: 'underdogfantasy.com',
  sleeper: 'sleeper.com',
  pick6: 'pick6.draftkings.com',
  rtsports: 'rtsports.com',
  draftkings: 'draftkings.com',
  fanduel: 'fanduel.com',
  betmgm: 'betmgm.com',
  caesars: 'caesars.com',
  hardrock: 'hardrock.bet',
  betrivers: 'betrivers.com',
  espnbet: 'espnbet.com',
  pointsbet: 'pointsbet.com',
  unibet: 'unibet.com',
  williamhill: 'williamhill.com',
  bovada: 'bovada.lv',
  dabble: 'dabble.com',
  betr: 'betr.app',
  parlayplay: 'parlayplay.io',
};

/**
 * REFERRAL (affiliate) links per source, keyed by source id.
 *
 * Empty by default and configured PER DEPLOYMENT via the NEXT_PUBLIC_REF_LINKS env
 * var — a JSON object like {"prizepicks":"https://prizepicks.com/?ref=…"} — so
 * adding, changing or pulling a deal never needs a code change or a rebuild of this
 * file. Values are public by nature (they ship in the page), hence NEXT_PUBLIC_.
 *
 * The distinction between a configured referral link and a plain domain link is
 * load-bearing for compliance, not cosmetic:
 *   - a REFERRAL link is a paid link -> rel must include "sponsored", and the
 *     affiliate disclosure must be shown (FTC).
 *   - a plain domain link earns us nothing -> no "sponsored", no disclosure claim.
 * See refLinkFor / isSponsoredLink / hasAnyRefLink below, and AffiliateDisclosure.
 */
// Memoized on the raw env string: each BookLink calls through here a few times, so
// re-parsing per render is wasted work — but keying on the value (rather than
// caching once) keeps it correct if the env is swapped, which the tests do.
let refCache: { raw: string; parsed: Record<string, string> } | null = null;

function parseRefLinks(raw: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [id, url] of Object.entries(parsed as Record<string, unknown>)) {
      // Only accept absolute https URLs — a malformed entry must never render as
      // a broken or protocol-relative link.
      if (typeof url === 'string' && /^https:\/\//i.test(url)) out[id] = url;
    }
    return out;
  } catch {
    // A malformed env var degrades to "no referral links" rather than breaking
    // every book mention on the site.
    return {};
  }
}

function configuredRefLinks(): Record<string, string> {
  const raw = process.env.NEXT_PUBLIC_REF_LINKS;
  if (!raw) return {};
  if (refCache?.raw !== raw) refCache = { raw, parsed: parseRefLinks(raw) };
  return refCache.parsed;
}

/** True when this source has a real, paid referral link configured. */
export function isSponsoredLink(id: string): boolean {
  return !!configuredRefLinks()[id];
}

/** True when ANY book has a referral link — gates the affiliate disclosure copy. */
export function hasAnyRefLink(): boolean {
  return Object.keys(configuredRefLinks()).length > 0;
}

/**
 * Where a book's name should link to: its referral URL when one is configured,
 * otherwise the book's plain homepage. Null when we don't even know the domain
 * (the caller then renders plain text).
 */
export function refLinkFor(id: string): string | null {
  const ref = configuredRefLinks()[id];
  if (ref) return ref;
  const domain = PROVIDED_SOURCE_DOMAINS[id];
  return domain ? `https://${domain}` : null;
}

/**
 * The `rel` for a book link. "sponsored" ONLY on actually-paid links (Google's
 * spec, and misapplying it is its own problem); "nofollow" on every outbound
 * commercial link; noopener/noreferrer because they all open in a new tab.
 */
export function refLinkRel(id: string): string {
  return `${isSponsoredLink(id) ? 'sponsored ' : ''}nofollow noopener noreferrer`;
}

/**
 * Real-logo URL for a source: the book's OWN favicon, served through DuckDuckGo's
 * privacy-respecting icon proxy (no tracking, reliable across all our books). Returns
 * null when the domain is unknown — the caller then shows the monogram badge. We
 * reference the book's published mark rather than bundling artwork.
 */
export function sourceLogoUrl(id: string): string | null {
  const domain = PROVIDED_SOURCE_DOMAINS[id];
  return domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : null;
}

/**
 * PNG variant of the book's favicon (Google's s2 service re-encodes to PNG).
 * The card image renderer (satori) can't decode .ico, so the browser-facing
 * DuckDuckGo URL above doesn't work there. Null for unknown domains.
 */
export function sourceLogoPngUrl(id: string, px = 64): string | null {
  const domain = PROVIDED_SOURCE_DOMAINS[id];
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=${px}` : null;
}

/**
 * Lightweight brand mark per source: a short monogram + colors for a logo badge.
 * These are placeholders (best-effort brand colors) so the UI can show a logo
 * next to a source without bundling copyrighted artwork. To swap in a real logo,
 * drop a file at public/books/<id>.svg and render it instead of the monogram.
 */
export interface SourceBrand {
  /** 1–3 char monogram shown in the badge. */
  monogram: string;
  /** Badge background (brand-ish). */
  bg: string;
  /** Monogram color — picked for contrast on `bg`. */
  fg: string;
}

const PROVIDED_SOURCE_BRANDS: Record<string, SourceBrand> = {
  // DFS pick'em
  prizepicks: { monogram: 'PP', bg: '#6c2bd9', fg: '#ffffff' },
  underdog: { monogram: 'UD', bg: '#111827', fg: '#fbbf24' },
  sleeper: { monogram: 'SL', bg: '#14b8a6', fg: '#062925' },
  pick6: { monogram: 'P6', bg: '#53d337', fg: '#0b2200' },
  rtsports: { monogram: 'RT', bg: '#1d4ed8', fg: '#ffffff' },
  dabble: { monogram: 'DB', bg: '#00c2a8', fg: '#08312b' },
  betr: { monogram: 'BT', bg: '#22c55e', fg: '#052e16' },
  parlayplay: { monogram: 'PL', bg: '#2563eb', fg: '#ffffff' },
  // Sportsbooks
  draftkings: { monogram: 'DK', bg: '#53d337', fg: '#0b2200' },
  fanduel: { monogram: 'FD', bg: '#1493ff', fg: '#ffffff' },
  betmgm: { monogram: 'BM', bg: '#c9a227', fg: '#1a1407' },
  caesars: { monogram: 'CZ', bg: '#1a1a1a', fg: '#c5a572' },
  hardrock: { monogram: 'HR', bg: '#000000', fg: '#e6c200' },
  betrivers: { monogram: 'BR', bg: '#003087', fg: '#ffffff' },
  espnbet: { monogram: 'EB', bg: '#cc0000', fg: '#ffffff' },
  pointsbet: { monogram: 'PB', bg: '#e4002b', fg: '#ffffff' },
  unibet: { monogram: 'UB', bg: '#147b45', fg: '#ffffff' },
  williamhill: { monogram: 'WH', bg: '#0a3d62', fg: '#ffd23f' },
  bovada: { monogram: 'BV', bg: '#c8102e', fg: '#ffffff' },
};

/** Brand mark for a source. Unknown ids fall back to a neutral first-two-letters badge. */
export function sourceBrand(id: string): SourceBrand {
  return (
    PROVIDED_SOURCE_BRANDS[id] ?? {
      monogram: sourceLabel(id).replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || '?',
      bg: '#57534e',
      fg: '#ffffff',
    }
  );
}

/** Order a set of source ids for display: curated order first, then by label. */
export function orderSources(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const ia = ORDER.indexOf(a);
    const ib = ORDER.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || sourceLabel(a).localeCompare(sourceLabel(b));
  });
}
