// Framework-agnostic stat model (no React/Next/Prisma imports) so the whole
// compute core ports unchanged to a future mobile/native client (PLAN §3b #5).

/** A single game's box-score line, decoupled from the DB row shape. */
export interface GameStatLine {
  points: number;
  rebounds: number;
  oreb: number;
  dreb: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  minutes: number | null;
  // Optional context for display / charts.
  gameDate?: string; // ISO yyyy-mm-dd
  opponentAbbreviation?: string;
  isHome?: boolean;
}

/** Position buckets for DvP (coarse on purpose — see PLAN §5b). */
export type PosBucket = 'G' | 'F' | 'C';

/** Stats a user can research, including composites derived in code (PLAN §4). */
export type StatKey =
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
  | 'stocks';

export interface StatDef {
  key: StatKey;
  /** Full label, e.g. "Points + Rebounds + Assists". */
  label: string;
  /** Short label for chips/axes, e.g. "PRA". */
  short: string;
  /** Extract the stat's value from a game line. */
  value: (g: GameStatLine) => number;
}

export const STAT_DEFS: Record<StatKey, StatDef> = {
  pts: { key: 'pts', label: 'Points', short: 'PTS', value: (g) => g.points },
  reb: { key: 'reb', label: 'Rebounds', short: 'REB', value: (g) => g.rebounds },
  oreb: { key: 'oreb', label: 'Offensive Rebounds', short: 'OREB', value: (g) => g.oreb },
  dreb: { key: 'dreb', label: 'Defensive Rebounds', short: 'DREB', value: (g) => g.dreb },
  ast: { key: 'ast', label: 'Assists', short: 'AST', value: (g) => g.assists },
  fg3m: { key: 'fg3m', label: '3-Pointers Made', short: '3PM', value: (g) => g.fg3m },
  stl: { key: 'stl', label: 'Steals', short: 'STL', value: (g) => g.steals },
  blk: { key: 'blk', label: 'Blocks', short: 'BLK', value: (g) => g.blocks },
  tov: { key: 'tov', label: 'Turnovers', short: 'TOV', value: (g) => g.turnovers },
  fouls: { key: 'fouls', label: 'Personal Fouls', short: 'PF', value: (g) => g.fouls },
  pra: {
    key: 'pra',
    label: 'Points + Rebounds + Assists',
    short: 'PRA',
    value: (g) => g.points + g.rebounds + g.assists,
  },
  pr: {
    key: 'pr',
    label: 'Points + Rebounds',
    short: 'PR',
    value: (g) => g.points + g.rebounds,
  },
  pa: {
    key: 'pa',
    label: 'Points + Assists',
    short: 'PA',
    value: (g) => g.points + g.assists,
  },
  ra: {
    key: 'ra',
    label: 'Rebounds + Assists',
    short: 'RA',
    value: (g) => g.rebounds + g.assists,
  },
  stocks: {
    key: 'stocks',
    label: 'Steals + Blocks',
    short: 'STOCKS',
    value: (g) => g.steals + g.blocks,
  },
};

export const STAT_KEYS = Object.keys(STAT_DEFS) as StatKey[];

/** Get a stat's value from a game line. */
export function statValue(stat: StatKey, g: GameStatLine): number {
  return STAT_DEFS[stat].value(g);
}

/** Analysis windows. Numeric = last N games; 'season' = all games. */
export type StatWindow = 5 | 10 | 20 | 'season';
export const STAT_WINDOWS: StatWindow[] = [5, 10, 20, 'season'];
