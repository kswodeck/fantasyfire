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
  pick6: 'DraftKings Pick6',
  rtsports: 'RT Sports',
  dabble: 'Dabble',
  betr: 'Betr',
  parlayplay: 'ParlayPlay',
  // Sportsbooks (from RotoWire's picks aggregator + SportsGameOdds)
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
