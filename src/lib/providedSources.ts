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
  dabble: 'Dabble',
  betr: 'Betr',
  parlayplay: 'ParlayPlay',
  // Sportsbooks (available if the SportsGameOdds source is ingested too)
  draftkings: 'DraftKings',
  fanduel: 'FanDuel',
  betmgm: 'BetMGM',
  caesars: 'Caesars',
  espnbet: 'ESPN BET',
  pointsbet: 'PointsBet',
  unibet: 'Unibet',
  williamhill: 'William Hill',
  bovada: 'Bovada',
};

const ORDER = [
  'prizepicks', 'underdog', 'sleeper', 'dabble', 'betr', 'parlayplay',
  'draftkings', 'fanduel', 'betmgm', 'caesars', 'espnbet', 'pointsbet', 'unibet', 'williamhill', 'bovada',
];

export function sourceLabel(id: string): string {
  return PROVIDED_SOURCE_LABELS[id] ?? id;
}

/** Order a set of source ids for display: curated order first, then by label. */
export function orderSources(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const ia = ORDER.indexOf(a);
    const ib = ORDER.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || sourceLabel(a).localeCompare(sourceLabel(b));
  });
}
