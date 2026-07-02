// Market-implied payout breakevens — real payouts instead of tuned bars.
//
// PrizePicks ships no per-line payout numbers, so demon/goblin rungs are otherwise
// scored against hand-tuned breakeven approximations (PP_BREAKEVEN_STEPS). But we
// already scrape real sportsbooks (DraftKings/FanDuel/BetMGM/…) whose TWO-SIDED
// American odds at the same line reveal the market's fair probability once the vig
// is removed. When any book quotes a variant rung's exact line, that de-vigged
// consensus IS the bar a fairly-priced variant must clear — market-implied rather
// than hand-calibrated. Pure (no React/Next/db).
import { noVigOver } from './marketConsensus';

/** A book quote reduced to what breakeven derivation needs (the book is irrelevant —
 *  every two-sided quote at the line is one vote on the fair probability). */
export interface RungQuote {
  line: number;
  overOdds: number | null;
  underOdds: number | null;
}

const SAME_LINE_EPS = 1e-9;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Median de-vigged P(over) across books quoting two-sided odds at EXACTLY this line
 * — odds at a different line aren't commensurable, so near-misses don't count.
 * Null when no book quotes it (or none quotes both sides).
 */
export function marketFairProbAt(quotes: RungQuote[], line: number): number | null {
  const probs: number[] = [];
  for (const q of quotes) {
    if (Math.abs(q.line - line) >= SAME_LINE_EPS) continue;
    const p = noVigOver(q.overOdds, q.underOdds);
    if (p != null) probs.push(p);
  }
  return probs.length ? median(probs) : null;
}

/**
 * Market-implied breakeven for a payout-variant rung, in FireFactor's convention
 * that the STANDARD line anchors at 0.5. A fair book prices every rung so its
 * breakeven equals the true P(over) there, so the bar is simply the market's
 * de-vigged probability at the rung's line — rescaled by the standard line's own
 * market probability when books quote that too (the standard line DEFINES 0.5 in
 * this convention; without a quote there it's assumed to already be 0.5).
 * Null when no book quotes the rung's exact line.
 */
export function marketImpliedBreakeven(
  quotes: RungQuote[],
  rungLine: number,
  standardLine: number | null,
): number | null {
  const pRung = marketFairProbAt(quotes, rungLine);
  if (pRung == null) return null;
  const pStd =
    standardLine != null && Math.abs(standardLine - rungLine) >= SAME_LINE_EPS
      ? marketFairProbAt(quotes, standardLine)
      : null;
  const scaled = pStd != null && pStd > 0 ? pRung * (0.5 / pStd) : pRung;
  return Math.max(0.05, Math.min(0.95, scaled));
}
