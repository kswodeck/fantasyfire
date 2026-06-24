// Framework-agnostic stat model (no React/Next/Prisma imports) so the whole
// compute core ports unchanged. Multi-sport: one superset GameStatLine + one
// combined STAT_DEFS registry; each sport exposes its own ordered key list.
import type { Sport } from '@/lib/sports';

const n = (x: number | null | undefined): number => x ?? 0;

/**
 * A single game's box-score line. All stat fields are optional — a game only
 * populates its sport's columns; value extractors coalesce missing to 0.
 */
export interface GameStatLine {
  // NBA box score
  points?: number | null;
  rebounds?: number | null;
  oreb?: number | null;
  dreb?: number | null;
  assists?: number | null;
  steals?: number | null;
  blocks?: number | null;
  turnovers?: number | null;
  fouls?: number | null;
  fgm?: number | null;
  fga?: number | null;
  fg3m?: number | null;
  fg3a?: number | null;
  ftm?: number | null;
  fta?: number | null;
  // MLB hitting
  atBats?: number | null;
  hits?: number | null;
  doubles?: number | null;
  triples?: number | null;
  homeRuns?: number | null;
  runs?: number | null;
  rbi?: number | null;
  walks?: number | null;
  strikeouts?: number | null;
  stolenBases?: number | null;
  totalBases?: number | null;
  hbp?: number | null;
  // MLB pitching
  outs?: number | null;
  hitsAllowed?: number | null;
  runsAllowed?: number | null;
  earnedRuns?: number | null;
  walksAllowed?: number | null;
  strikeoutsPitched?: number | null;
  // Optional context for display / charts.
  minutes?: number | null;
  gameDate?: string;
  opponentAbbreviation?: string;
  isHome?: boolean;
}

/** Position buckets. NBA: G/F/C (DvP). MLB: H (hitter) / P (pitcher). */
export type PosBucket = 'G' | 'F' | 'C' | 'H' | 'P';

/** All researchable stat keys across sports (kept unique so one registry works). */
export type StatKey =
  // NBA
  | 'pts'
  | 'reb'
  | 'oreb'
  | 'dreb'
  | 'ast'
  | 'fg3m'
  | 'stl'
  | 'blk'
  | 'tov'
  | 'fouls'
  | 'pra'
  | 'pr'
  | 'pa'
  | 'ra'
  | 'stocks'
  // MLB hitting
  | 'hits'
  | 'tb'
  | 'hr'
  | 'rbi'
  | 'runs'
  | 'sb'
  | 'bb'
  | 'so'
  | 'doubles'
  | 'hrr'
  // MLB pitching
  | 'k'
  | 'er'
  | 'outs'
  | 'ha'
  | 'bba';

export interface StatDef {
  key: StatKey;
  sport: Sport;
  label: string;
  short: string;
  value: (g: GameStatLine) => number;
}

export const STAT_DEFS: Record<StatKey, StatDef> = {
  // ---- NBA ----
  pts: { key: 'pts', sport: 'nba', label: 'Points', short: 'PTS', value: (g) => n(g.points) },
  reb: { key: 'reb', sport: 'nba', label: 'Rebounds', short: 'REB', value: (g) => n(g.rebounds) },
  oreb: { key: 'oreb', sport: 'nba', label: 'Offensive Rebounds', short: 'OREB', value: (g) => n(g.oreb) },
  dreb: { key: 'dreb', sport: 'nba', label: 'Defensive Rebounds', short: 'DREB', value: (g) => n(g.dreb) },
  ast: { key: 'ast', sport: 'nba', label: 'Assists', short: 'AST', value: (g) => n(g.assists) },
  fg3m: { key: 'fg3m', sport: 'nba', label: '3-Pointers Made', short: '3PM', value: (g) => n(g.fg3m) },
  stl: { key: 'stl', sport: 'nba', label: 'Steals', short: 'STL', value: (g) => n(g.steals) },
  blk: { key: 'blk', sport: 'nba', label: 'Blocks', short: 'BLK', value: (g) => n(g.blocks) },
  tov: { key: 'tov', sport: 'nba', label: 'Turnovers', short: 'TOV', value: (g) => n(g.turnovers) },
  fouls: { key: 'fouls', sport: 'nba', label: 'Personal Fouls', short: 'PF', value: (g) => n(g.fouls) },
  pra: { key: 'pra', sport: 'nba', label: 'Points + Rebounds + Assists', short: 'PRA', value: (g) => n(g.points) + n(g.rebounds) + n(g.assists) },
  pr: { key: 'pr', sport: 'nba', label: 'Points + Rebounds', short: 'PR', value: (g) => n(g.points) + n(g.rebounds) },
  pa: { key: 'pa', sport: 'nba', label: 'Points + Assists', short: 'PA', value: (g) => n(g.points) + n(g.assists) },
  ra: { key: 'ra', sport: 'nba', label: 'Rebounds + Assists', short: 'RA', value: (g) => n(g.rebounds) + n(g.assists) },
  stocks: { key: 'stocks', sport: 'nba', label: 'Steals + Blocks', short: 'STOCKS', value: (g) => n(g.steals) + n(g.blocks) },

  // ---- MLB hitting ----
  hits: { key: 'hits', sport: 'mlb', label: 'Hits', short: 'H', value: (g) => n(g.hits) },
  tb: { key: 'tb', sport: 'mlb', label: 'Total Bases', short: 'TB', value: (g) => n(g.totalBases) },
  hr: { key: 'hr', sport: 'mlb', label: 'Home Runs', short: 'HR', value: (g) => n(g.homeRuns) },
  rbi: { key: 'rbi', sport: 'mlb', label: 'RBIs', short: 'RBI', value: (g) => n(g.rbi) },
  runs: { key: 'runs', sport: 'mlb', label: 'Runs', short: 'R', value: (g) => n(g.runs) },
  sb: { key: 'sb', sport: 'mlb', label: 'Stolen Bases', short: 'SB', value: (g) => n(g.stolenBases) },
  bb: { key: 'bb', sport: 'mlb', label: 'Walks', short: 'BB', value: (g) => n(g.walks) },
  so: { key: 'so', sport: 'mlb', label: 'Strikeouts (batter)', short: 'SO', value: (g) => n(g.strikeouts) },
  doubles: { key: 'doubles', sport: 'mlb', label: 'Doubles', short: '2B', value: (g) => n(g.doubles) },
  hrr: { key: 'hrr', sport: 'mlb', label: 'Hits + Runs + RBIs', short: 'H+R+RBI', value: (g) => n(g.hits) + n(g.runs) + n(g.rbi) },

  // ---- MLB pitching ----
  k: { key: 'k', sport: 'mlb', label: 'Strikeouts (pitcher)', short: 'K', value: (g) => n(g.strikeoutsPitched) },
  er: { key: 'er', sport: 'mlb', label: 'Earned Runs', short: 'ER', value: (g) => n(g.earnedRuns) },
  outs: { key: 'outs', sport: 'mlb', label: 'Outs Recorded', short: 'OUTS', value: (g) => n(g.outs) },
  ha: { key: 'ha', sport: 'mlb', label: 'Hits Allowed', short: 'HA', value: (g) => n(g.hitsAllowed) },
  bba: { key: 'bba', sport: 'mlb', label: 'Walks Allowed', short: 'BBA', value: (g) => n(g.walksAllowed) },
};

export const STAT_KEYS = Object.keys(STAT_DEFS) as StatKey[];

export const NBA_STAT_KEYS: StatKey[] = [
  'pts', 'reb', 'oreb', 'dreb', 'ast', 'fg3m', 'stl', 'blk', 'tov', 'fouls', 'pra', 'pr', 'pa', 'ra', 'stocks',
];
export const MLB_HITTING_KEYS: StatKey[] = [
  'hits', 'tb', 'hr', 'rbi', 'runs', 'sb', 'bb', 'so', 'doubles', 'hrr',
];
export const MLB_PITCHING_KEYS: StatKey[] = ['k', 'er', 'outs', 'ha', 'bba'];

/** Ordered stat keys offered for a sport (and role, for MLB hitter vs pitcher). */
export function statKeysForSport(sport: Sport, posBucket?: string | null): StatKey[] {
  if (sport === 'mlb') {
    return posBucket === 'P' ? MLB_PITCHING_KEYS : MLB_HITTING_KEYS;
  }
  return NBA_STAT_KEYS;
}

/** The default stat to open a player page on. */
export function defaultStatForSport(sport: Sport, posBucket?: string | null): StatKey {
  if (sport === 'mlb') return posBucket === 'P' ? 'k' : 'hits';
  return 'pts';
}

/** Get a stat's value from a game line. */
export function statValue(stat: StatKey, g: GameStatLine): number {
  return STAT_DEFS[stat].value(g);
}

/** Analysis windows. Numeric = last N games; 'season' = all games. */
export type StatWindow = 5 | 10 | 20 | 'season';
export const STAT_WINDOWS: StatWindow[] = [5, 10, 20, 'season'];
