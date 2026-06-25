// Alt-line explorer — how the over hit rate (and its Wilson interval) shifts as
// the line moves around the one currently selected. Pure (no React/Next/db).
//
// Lines are user-entered here, so there's no single "the line" — this surfaces the
// inflection: where a soft-looking 70% over collapses to a coin flip one point up.
// Feed it the per-game values for one window (season is the most stable sample).
import { wilsonInterval } from './confidence';

export interface AltLineRow {
  line: number;
  overs: number;
  unders: number;
  pushes: number;
  /** overs + unders (the hit-rate denominator). */
  decided: number;
  /** overs / decided; null when no decided games at this line. */
  hitRateOver: number | null;
  /** 95% Wilson bounds on the over rate. */
  wilsonLower: number;
  wilsonUpper: number;
  /** True for the line currently selected on the page. */
  isCurrent: boolean;
}

export interface AltLineOptions {
  /** How many steps to span on each side of the current line (default 3). */
  steps?: number;
  /** Line increment per step (default 1 — keeps a .5 line at .5, so no pushes). */
  step?: number;
}

/** Smallest line we'll ever show (a 0-or-negative prop line is meaningless). */
const MIN_LINE = 0.5;

/**
 * Build the hit-rate-vs-line table centered on `currentLine`. Values are
 * line-independent, so this recomputes purely on the client as the user moves the
 * line — no refetch needed. Rows are returned ascending by line.
 */
export function altLineTable(
  values: number[],
  currentLine: number,
  opts: AltLineOptions = {},
): AltLineRow[] {
  const steps = opts.steps ?? 3;
  const step = opts.step ?? 1;

  const lineSet = new Set<number>();
  for (let i = -steps; i <= steps; i++) {
    const line = Number((currentLine + i * step).toFixed(1));
    if (line >= MIN_LINE) lineSet.add(line);
  }
  // Always include the current line even if it fell below the span floor.
  if (currentLine >= MIN_LINE) lineSet.add(Number(currentLine.toFixed(1)));

  const lines = [...lineSet].sort((a, b) => a - b);

  return lines.map((line) => {
    let overs = 0;
    let unders = 0;
    let pushes = 0;
    for (const v of values) {
      if (v > line) overs++;
      else if (v < line) unders++;
      else pushes++;
    }
    const decided = overs + unders;
    const w = wilsonInterval(overs, decided);
    return {
      line,
      overs,
      unders,
      pushes,
      decided,
      hitRateOver: decided === 0 ? null : overs / decided,
      wilsonLower: w.lower,
      wilsonUpper: w.upper,
      isCurrent: Math.abs(line - currentLine) < 1e-9,
    };
  });
}
