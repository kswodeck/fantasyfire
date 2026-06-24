// Shared helpers for the projection backtest / snapshot / grade jobs.
import type { StatKey, GameStatLine } from '../lib/stats';

export const BOARD_STATS: Record<'nba' | 'mlb', StatKey[]> = {
  nba: ['pts', 'reb', 'ast', 'pra', 'fg3m'],
  mlb: ['hits', 'tb', 'hr', 'rbi', 'runs'],
};

/** Games needed before a snapshot is made. */
export const MIN_PRIOR = 12;

/** Prisma select for the stat fields the board stats + qualify filter need. */
export const STAT_SELECT = {
  playerId: true,
  gameDate: true,
  minutes: true,
  points: true,
  rebounds: true,
  assists: true,
  fg3m: true,
  atBats: true,
  walks: true,
  hbp: true,
  hits: true,
  totalBases: true,
  homeRuns: true,
  rbi: true,
  runs: true,
} as const;

export interface StatRow {
  playerId: number;
  gameDate: Date;
  minutes: number | null;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  fg3m: number | null;
  atBats: number | null;
  walks: number | null;
  hbp: number | null;
  hits: number | null;
  totalBases: number | null;
  homeRuns: number | null;
  rbi: number | null;
  runs: number | null;
}

export function rowToGameStatLine(r: StatRow): GameStatLine {
  return {
    minutes: r.minutes,
    points: r.points,
    rebounds: r.rebounds,
    assists: r.assists,
    fg3m: r.fg3m,
    atBats: r.atBats,
    walks: r.walks,
    hbp: r.hbp,
    hits: r.hits,
    totalBases: r.totalBases,
    homeRuns: r.homeRuns,
    rbi: r.rbi,
    runs: r.runs,
  };
}

/** Per-game opportunity for the qualify filter (NBA minutes / MLB plate apps). */
export function opportunity(
  sport: 'nba' | 'mlb',
  posBucket: string | null,
  g: GameStatLine,
): number | null {
  if (sport === 'nba') return g.minutes ?? null;
  if (posBucket === 'P') return null;
  return (g.atBats ?? 0) + (g.walks ?? 0) + (g.hbp ?? 0);
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
