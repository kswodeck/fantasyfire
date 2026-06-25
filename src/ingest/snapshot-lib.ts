// Shared helpers for the projection backtest / snapshot / grade jobs.
import type { StatKey, GameStatLine } from '../lib/stats';
import type { Sport } from '../lib/sports';

// NFL board stats are position-specific (a QB's markets differ from a WR's).
const BOARD_NFL: Record<string, StatKey[]> = {
  QB: ['passYds', 'passTds'],
  RB: ['rushYds', 'rec'],
  WR: ['recYds', 'rec'],
  TE: ['recYds', 'rec'],
};

/** Stats to snapshot/backtest for a player, by sport (and NFL position). */
export function boardStatsForSnapshot(sport: Sport, posBucket: string | null): StatKey[] {
  if (sport === 'nba') return ['pts', 'reb', 'ast', 'pra', 'fg3m'];
  if (sport === 'nfl') return BOARD_NFL[posBucket ?? ''] ?? [];
  return posBucket === 'P' ? [] : ['hits', 'tb', 'hr', 'rbi', 'runs'];
}

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
  passYards: true,
  passTds: true,
  passCompletions: true,
  passAttempts: true,
  passInts: true,
  rushYards: true,
  rushAttempts: true,
  rushTds: true,
  receptions: true,
  targets: true,
  recYards: true,
  recTds: true,
  fumblesLost: true,
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
  passYards: number | null;
  passTds: number | null;
  passCompletions: number | null;
  passAttempts: number | null;
  passInts: number | null;
  rushYards: number | null;
  rushAttempts: number | null;
  rushTds: number | null;
  receptions: number | null;
  targets: number | null;
  recYards: number | null;
  recTds: number | null;
  fumblesLost: number | null;
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
    passYards: r.passYards,
    passTds: r.passTds,
    passCompletions: r.passCompletions,
    passAttempts: r.passAttempts,
    passInts: r.passInts,
    rushYards: r.rushYards,
    rushAttempts: r.rushAttempts,
    rushTds: r.rushTds,
    receptions: r.receptions,
    targets: r.targets,
    recYards: r.recYards,
    recTds: r.recTds,
    fumblesLost: r.fumblesLost,
  };
}

/** Per-game opportunity for the qualify filter (NBA minutes / MLB plate apps /
 *  NFL role involvement). Mirrors opportunityFor in the server layer. */
export function opportunity(
  sport: Sport,
  posBucket: string | null,
  g: GameStatLine,
): number | null {
  if (sport === 'nba') return g.minutes ?? null;
  if (sport === 'nfl') {
    if (posBucket === 'QB') return g.passAttempts ?? 0;
    if (posBucket === 'RB') return (g.rushAttempts ?? 0) + (g.receptions ?? 0);
    return g.targets ?? 0; // WR / TE
  }
  if (posBucket === 'P') return null;
  return (g.atBats ?? 0) + (g.walks ?? 0) + (g.hbp ?? 0);
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
