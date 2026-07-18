import type { GameStatLine, StatKey } from './types';
import { statValue } from './types';
import { median } from '../format';

/**
 * Our "typical-game" line for a stat: the season MEDIAN game, floored to 0.5.
 *
 * HISTORY: this was the board's ranking line. The board now ranks against
 * defaultPropLine below (the book-style x.5 that never pushes) so the number a
 * user sees matches the number a book would post — an integer median with pushes
 * excluded could overstate an edge that vanishes at the bettable half-point.
 * Kept for the API's "season median to 0.5" fallback semantics and tests.
 * (Historical note: rounding the median UP to the next half-point put the line
 * above the typical game and forced ~every count stat Under — defaultPropLine
 * avoids that by choosing the STRADDLING half-point that best balances O/U.)
 */
export function defaultLine(games: GameStatLine[], stat: StatKey): number {
  if (games.length === 0) return 0.5;
  return Math.max(0.5, median(games.map((g) => statValue(stat, g))));
}

/**
 * Book-style default line for the player research page: a half-point line (x.5)
 * so the default can never push — the way a sportsbook posts a prop. We center on
 * the player's typical game (season median) and pick whichever straddling
 * half-point (m − 0.5 or m + 0.5) splits their games CLOSEST to 50/50 over–under,
 * so the default isn't tilted either way. Ties break toward the half-point nearer
 * the mean (so a right-skewed stat leans the way its big games pull it), then
 * toward the lower line. Floored at 0.5.
 *
 * Distinct from defaultLine on purpose: the board ranks leans against the balanced
 * typical-game line, while a fresh player page shows a familiar book-style number
 * you can then adjust to the exact figure on your card.
 */
export function defaultPropLine(games: GameStatLine[], stat: StatKey): number {
  if (games.length === 0) return 0.5;
  const values = games.map((g) => statValue(stat, g));
  const m = median(values);

  // An even-game median can already be a half-point (e.g. 12.5) — a no-push line
  // sitting at the center, so use it as-is.
  if (Math.abs(m % 1) === 0.5) return Math.max(0.5, m);

  // Otherwise choose the straddling half-point with the most balanced over-rate.
  // Half-point lines never push, so every game is decided. The median is rounded
  // first so continuous stats (fantasy score's 1.2/1.5-weighted sums can median
  // at e.g. 27.3) still land on a familiar x.5 book line — a no-op for the
  // whole-number medians every counting stat produces.
  const base = Math.round(m);
  const candidates = [base - 0.5, base + 0.5].filter((l) => l >= 0.5);
  if (candidates.length <= 1) return Math.max(0.5, candidates[0] ?? 0.5);

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const overRate = (line: number) => values.filter((v) => v > line).length / values.length;
  const imbalance = (line: number) => Math.abs(overRate(line) - 0.5);

  const [lower, upper] = candidates;
  const lo = imbalance(lower);
  const up = imbalance(upper);
  if (lo !== up) return lo < up ? lower : upper;
  // Equally balanced → the half-point nearer the mean; a final exact tie → lower.
  return Math.abs(lower - mean) <= Math.abs(upper - mean) ? lower : upper;
}
