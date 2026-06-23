// Odds / fair-price math — PLAN §5d.
//
// All pure. American odds <-> implied probability, multiplicative de-vig, and
// an edge calculator. Label results honestly in the UI: "based on recent history
// vs. the price you entered — not a guarantee."

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

  const edgeValue =
    historicalHitRateOver === null ||
    historicalHitRateOver === undefined ||
    referenceProbOver === null
      ? null
      : edge(historicalHitRateOver, referenceProbOver);

  return {
    impliedOver,
    impliedUnder,
    fairOver,
    fairUnder,
    overround,
    fairAmericanOver,
    referenceProbOver,
    edge: edgeValue,
  };
}
