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
  // NFL
  passYards?: number | null;
  passTds?: number | null;
  passCompletions?: number | null;
  passAttempts?: number | null;
  passInts?: number | null;
  rushYards?: number | null;
  rushAttempts?: number | null;
  rushTds?: number | null;
  receptions?: number | null;
  targets?: number | null;
  recYards?: number | null;
  recTds?: number | null;
  fumblesLost?: number | null;
  // Optional context for display / charts.
  minutes?: number | null;
  gameDate?: string;
  opponentAbbreviation?: string;
  isHome?: boolean;
}

/** Position buckets. NBA: G/F/C (DvP). MLB: H/P. NFL: QB/RB/WR/TE. */
export type PosBucket = 'G' | 'F' | 'C' | 'H' | 'P' | 'QB' | 'RB' | 'WR' | 'TE';

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
  | 'bba'
  // NFL — passing
  | 'passYds'
  | 'passTds'
  | 'passCmp'
  | 'passAtt'
  | 'ints'
  // NFL — rushing
  | 'rushYds'
  | 'carries'
  | 'rushTds'
  // NFL — receiving
  | 'rec'
  | 'targets'
  | 'recYds'
  | 'recTds'
  // NFL — misc
  | 'fumbles';

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

  // ---- NFL passing ----
  passYds: { key: 'passYds', sport: 'nfl', label: 'Passing Yards', short: 'PASS YDS', value: (g) => n(g.passYards) },
  passTds: { key: 'passTds', sport: 'nfl', label: 'Passing TDs', short: 'PASS TD', value: (g) => n(g.passTds) },
  passCmp: { key: 'passCmp', sport: 'nfl', label: 'Completions', short: 'CMP', value: (g) => n(g.passCompletions) },
  passAtt: { key: 'passAtt', sport: 'nfl', label: 'Pass Attempts', short: 'PASS ATT', value: (g) => n(g.passAttempts) },
  ints: { key: 'ints', sport: 'nfl', label: 'Interceptions', short: 'INT', value: (g) => n(g.passInts) },

  // ---- NFL rushing ----
  rushYds: { key: 'rushYds', sport: 'nfl', label: 'Rushing Yards', short: 'RUSH YDS', value: (g) => n(g.rushYards) },
  carries: { key: 'carries', sport: 'nfl', label: 'Carries', short: 'CAR', value: (g) => n(g.rushAttempts) },
  rushTds: { key: 'rushTds', sport: 'nfl', label: 'Rushing TDs', short: 'RUSH TD', value: (g) => n(g.rushTds) },

  // ---- NFL receiving ----
  rec: { key: 'rec', sport: 'nfl', label: 'Receptions', short: 'REC', value: (g) => n(g.receptions) },
  targets: { key: 'targets', sport: 'nfl', label: 'Targets', short: 'TGT', value: (g) => n(g.targets) },
  recYds: { key: 'recYds', sport: 'nfl', label: 'Receiving Yards', short: 'REC YDS', value: (g) => n(g.recYards) },
  recTds: { key: 'recTds', sport: 'nfl', label: 'Receiving TDs', short: 'REC TD', value: (g) => n(g.recTds) },

  // ---- NFL misc ----
  fumbles: { key: 'fumbles', sport: 'nfl', label: 'Fumbles Lost', short: 'FUM', value: (g) => n(g.fumblesLost) },
};

export const STAT_KEYS = Object.keys(STAT_DEFS) as StatKey[];

export const NBA_STAT_KEYS: StatKey[] = [
  'pts', 'reb', 'oreb', 'dreb', 'ast', 'fg3m', 'stl', 'blk', 'tov', 'fouls', 'pra', 'pr', 'pa', 'ra', 'stocks',
];
export const MLB_HITTING_KEYS: StatKey[] = [
  'hits', 'tb', 'hr', 'rbi', 'runs', 'sb', 'bb', 'so', 'doubles', 'hrr',
];
export const MLB_PITCHING_KEYS: StatKey[] = ['k', 'er', 'outs', 'ha', 'bba'];

// NFL stat keys are position-specific: a QB's markets (passing, plus rushing for
// mobile QBs) are disjoint from a pass-catcher's (receiving). RBs span both the
// ground game and the passing game.
export const NFL_QB_KEYS: StatKey[] = ['passYds', 'passTds', 'passCmp', 'passAtt', 'ints', 'rushYds'];
export const NFL_RB_KEYS: StatKey[] = ['rushYds', 'carries', 'rushTds', 'rec', 'targets', 'recYds', 'recTds', 'fumbles'];
export const NFL_WR_KEYS: StatKey[] = ['rec', 'targets', 'recYds', 'recTds'];
export const NFL_TE_KEYS: StatKey[] = ['rec', 'targets', 'recYds', 'recTds'];

/** Ordered stat keys offered for a sport (and role: MLB hitter/pitcher, NFL position). */
export function statKeysForSport(sport: Sport, posBucket?: string | null): StatKey[] {
  if (sport === 'mlb') {
    return posBucket === 'P' ? MLB_PITCHING_KEYS : MLB_HITTING_KEYS;
  }
  if (sport === 'nfl') {
    switch (posBucket) {
      case 'QB':
        return NFL_QB_KEYS;
      case 'RB':
        return NFL_RB_KEYS;
      case 'WR':
        return NFL_WR_KEYS;
      case 'TE':
        return NFL_TE_KEYS;
      default:
        return NFL_QB_KEYS; // fallback (shouldn't happen — every NFL player has a bucket)
    }
  }
  return NBA_STAT_KEYS;
}

/** The default stat to open a player page on. */
export function defaultStatForSport(sport: Sport, posBucket?: string | null): StatKey {
  if (sport === 'mlb') return posBucket === 'P' ? 'k' : 'hits';
  if (sport === 'nfl') {
    switch (posBucket) {
      case 'QB':
        return 'passYds';
      case 'RB':
        return 'rushYds';
      case 'WR':
      case 'TE':
        return 'recYds';
      default:
        return 'passYds';
    }
  }
  return 'pts';
}

/** Get a stat's value from a game line. */
export function statValue(stat: StatKey, g: GameStatLine): number {
  return STAT_DEFS[stat].value(g);
}

/** Analysis windows. Numeric = last N games; 'season' = all games. */
export type StatWindow = 5 | 10 | 20 | 'season';
export const STAT_WINDOWS: StatWindow[] = [5, 10, 20, 'season'];
