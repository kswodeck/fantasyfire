// Odds / fair-price math — PLAN §5d.
//
// All pure. American odds <-> implied probability, multiplicative de-vig, and
// an edge calculator. Label results honestly in the UI: "based on recent history
// vs. the price you entered — not a guarantee."

/**
 * Is this number actually American odds?
 *
 * American odds are defined relative to a 100-unit stake, so the scale has a hole in
 * it: the shortest price expressible is ±100 (an even-money coin flip), and nothing
 * lands strictly inside (-100, 100). A number in that hole is therefore NOT American
 * odds — overwhelmingly it is a DECIMAL payout (1.90) or a pick'em multiplier (2.5)
 * that a feed labelled "over"/"under" and we took at face value.
 *
 * Why this matters enough to have its own guard: a decimal payout read as American
 * odds implies a ~98% payout probability, so `sidedBreakevens` clamps the rung's
 * breakeven to 0.95 and FireFactor scores every read on that book against an
 * impossible bar. A 70%-over player that grades a 68 (Lean) on a flat line grades an
 * 8 (Pass) instead — below the boards' no-read cutoff, so the ENTIRE book silently
 * filters out of the Heat Check while still appearing in the book selector.
 * Cheap to check, and the failure it prevents is invisible from the outside.
 */
export function isAmericanOdds(odds: number | null | undefined): odds is number {
  return odds != null && Number.isFinite(odds) && Math.abs(odds) >= 100;
}

/** American odds -> implied probability. Throws on 0 (not valid American odds). */
export function americanToImplied(odds: number): number {
  if (!Number.isFinite(odds) || odds === 0) {
    throw new Error(`Invalid American odds: ${odds}`);
  }
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
}

/**
 * Implied probability -> fair American odds (rounded to the nearest integer).
 * p must be strictly between 0 and 1.
 */
export function impliedToAmerican(p: number): number {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) {
    throw new Error(`Probability must be in (0, 1): ${p}`);
  }
  return p > 0.5
    ? -Math.round((100 * p) / (1 - p))
    : Math.round((100 * (1 - p)) / p);
}

export interface DeVigResult {
  fairOver: number;
  fairUnder: number;
  /** Total implied probability across both sides (1 + the vig). */
  overround: number;
}

/**
 * Remove the vig from a two-way market (multiplicative / proportional method).
 * Inputs are the two sides' implied probabilities (which sum to > 1).
 */
export function deVigTwoWay(impliedOver: number, impliedUnder: number): DeVigResult {
  const overround = impliedOver + impliedUnder;
  if (overround <= 0) {
    throw new Error('Implied probabilities must sum to a positive number');
  }
  return {
    fairOver: impliedOver / overround,
    fairUnder: impliedUnder / overround,
    overround,
  };
}

/**
 * Edge = historical hit rate (over) − reference probability (over).
 * The reference is the no-vig fair prob when both sides are entered, otherwise
 * the single-side implied prob. Positive ⇒ history suggests value on the over
 * relative to this price (NOT a guarantee).
 */
export function edge(historicalHitRateOver: number, referenceProbOver: number): number {
  return historicalHitRateOver - referenceProbOver;
}

/** Profit per $1 staked at American odds (the decimal payout minus the $1 stake). */
export function profitPerDollar(odds: number): number {
  if (!Number.isFinite(odds) || odds === 0) {
    throw new Error(`Invalid American odds: ${odds}`);
  }
  return odds > 0 ? odds / 100 : 100 / -odds;
}

/**
 * Expected value per $1 staked, given a win probability and American odds:
 * winProb·profit − (1 − winProb). Positive ⇒ recent history suggests value vs
 * THIS price — not a guarantee, and only as good as the win-prob estimate.
 */
export function evPerDollar(winProb: number, odds: number): number {
  return winProb * profitPerDollar(odds) - (1 - winProb);
}

export interface FairPriceReadout {
  impliedOver: number | null;
  impliedUnder: number | null;
  /** No-vig fair probabilities (only when BOTH sides were entered). */
  fairOver: number | null;
  fairUnder: number | null;
  overround: number | null;
  /** Fair American odds for the over, from the best available probability. */
  fairAmericanOver: number | null;
  /** The probability the edge was measured against (fair if available, else implied). */
  referenceProbOver: number | null;
  /** historicalHitRateOver − referenceProbOver (null if neither side entered). */
  edge: number | null;
  /** Win rate needed to break even at the over price (= its implied prob). */
  breakEvenOver: number | null;
  /** EV per $1 on the over, using the historical hit rate as the win prob. */
  evPerDollarOver: number | null;
}

/**
 * Build the full fair-price readout from optional over/under American odds and a
 * historical over hit rate. Any of the inputs may be null/undefined.
 */
export function fairPriceReadout(params: {
  overOdds?: number | null;
  underOdds?: number | null;
  historicalHitRateOver?: number | null;
}): FairPriceReadout {
  const { overOdds, underOdds, historicalHitRateOver } = params;

  const impliedOver =
    overOdds === null || overOdds === undefined ? null : americanToImplied(overOdds);
  const impliedUnder =
    underOdds === null || underOdds === undefined ? null : americanToImplied(underOdds);

  let fairOver: number | null = null;
  let fairUnder: number | null = null;
  let overround: number | null = null;
  if (impliedOver !== null && impliedUnder !== null) {
    const dv = deVigTwoWay(impliedOver, impliedUnder);
    fairOver = dv.fairOver;
    fairUnder = dv.fairUnder;
    overround = dv.overround;
  }

  const referenceProbOver = fairOver ?? impliedOver;
  const fairAmericanOver =
    referenceProbOver !== null && referenceProbOver > 0 && referenceProbOver < 1
      ? impliedToAmerican(referenceProbOver)
      : null;

  const hasHitRate =
    historicalHitRateOver !== null && historicalHitRateOver !== undefined;

  const edgeValue =
    !hasHitRate || referenceProbOver === null
      ? null
      : edge(historicalHitRateOver, referenceProbOver);

  // Break-even = the over price's implied prob; EV uses the historical hit rate
  // as the win-prob estimate. Both require the over odds (and a hit rate for EV).
  const evPerDollarOver =
    !hasHitRate || overOdds === null || overOdds === undefined
      ? null
      : evPerDollar(historicalHitRateOver, overOdds);

  return {
    impliedOver,
    impliedUnder,
    fairOver,
    fairUnder,
    overround,
    fairAmericanOver,
    referenceProbOver,
    edge: edgeValue,
    breakEvenOver: impliedOver,
    evPerDollarOver,
  };
}
