// Hit-rate computation — PLAN §5a.
//
// Pushes (value == line) are EXCLUDED from the hit-rate denominator. The mean
// and population standard deviation are computed over every game in the window
// (pushes included) for the volatility readout.
import {
  type GameStatLine,
  type StatKey,
  type StatWindow,
  STAT_WINDOWS,
  statValue,
} from './types';

export interface HitRateResult {
  stat: StatKey;
  line: number;
  window: StatWindow;
  /** Number of games actually used (may be < requested N if the player has fewer). */
  games: number;
  /** Per-game stat values used, most-recent-first. */
  values: number[];
  overs: number;
  unders: number;
  pushes: number;
  /** overs + unders (the hit-rate denominator). */
  decided: number;
  /** overs / decided; null when there are no decided games. */
  hitRateOver: number | null;
  /** unders / decided; null when there are no decided games. */
  hitRateUnder: number | null;
  /** Mean of the stat over the window; null when no games. */
  mean: number | null;
  /** Population standard deviation over the window; null when no games. */
  stdev: number | null;
}

function take(values: number[], window: StatWindow): number[] {
  return window === 'season' ? values : values.slice(0, window);
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function populationStdev(xs: number[], mu: number): number {
  const variance = xs.reduce((a, x) => a + (x - mu) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

/**
 * Compute the hit rate for a stat/line over a window.
 * @param games  Player's games, sorted MOST-RECENT-FIRST.
 */
export function computeHitRate(
  games: GameStatLine[],
  stat: StatKey,
  line: number,
  window: StatWindow,
): HitRateResult {
  const allValues = games.map((g) => statValue(stat, g));
  const values = take(allValues, window);

  let overs = 0;
  let unders = 0;
  let pushes = 0;
  for (const v of values) {
    if (v > line) overs++;
    else if (v < line) unders++;
    else pushes++;
  }
  const decided = overs + unders;
  const mu = values.length ? mean(values) : null;

  return {
    stat,
    line,
    window,
    games: values.length,
    values,
    overs,
    unders,
    pushes,
    decided,
    hitRateOver: decided === 0 ? null : overs / decided,
    hitRateUnder: decided === 0 ? null : unders / decided,
    mean: mu,
    stdev: mu === null ? null : populationStdev(values, mu),
  };
}

/** Compute hit rates for all standard windows (L5/L10/L20/season) at once. */
export function computeHitRatesAllWindows(
  games: GameStatLine[],
  stat: StatKey,
  line: number,
): Record<string, HitRateResult> {
  const out: Record<string, HitRateResult> = {};
  for (const w of STAT_WINDOWS) {
    out[String(w)] = computeHitRate(games, stat, line, w);
  }
  return out;
}
