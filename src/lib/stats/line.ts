import type { GameStatLine, StatKey } from './types';
import { statValue } from './types';
import { median } from '../format';

/**
 * Our "typical-game" line for a stat: the season MEDIAN game, floored to 0.5.
 *
 * Used wherever we RANK leans — the board, streaks, and trends (the board
 * literally labels these "our typical-game (median) line"). The raw median sits
 * at the typical game, and with pushes (games exactly
 * on the line) excluded from the hit rate, Over/Under comes out balanced — so a
 * lean reflects real recent form, not where the line was placed. Rounding the
 * median UP to the next half-point instead put the line above the typical game and
 * forced ~every count stat Under (a ~100%-Under board), which is why we don't.
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

  // Whole-number median: choose the straddling half-point with the most balanced
  // over-rate. Half-point lines never push, so every game is decided.
  const candidates = [m - 0.5, m + 0.5].filter((l) => l >= 0.5);
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
