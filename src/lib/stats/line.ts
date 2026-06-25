import type { GameStatLine, StatKey } from './types';
import { statValue } from './types';
import { median } from '../format';

/**
 * Default research line for a stat over a set of games: the season MEDIAN game,
 * floored to 0.5.
 *
 * We use the RAW median (an integer for count stats like hits/points) rather
 * than the median rounded UP to the next half-point. Rounding up placed the line
 * half a point ABOVE the typical game, so the player came out "Under" by
 * construction — which made the board ~100% Under. With the line at the median
 * and pushes (games exactly on the line) excluded from the hit rate, Over/Under
 * comes out balanced and the lean reflects real recent form, not line placement.
 */
export function defaultLine(games: GameStatLine[], stat: StatKey): number {
  if (games.length === 0) return 0.5;
  return Math.max(0.5, median(games.map((g) => statValue(stat, g))));
}
