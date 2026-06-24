// Sample-size honesty — 95% Wilson score interval (PLAN §5c).
//
// This is the product's differentiator: a 4/5 streak should read as uncertain,
// not as a real edge. Always show the interval, not just the badge.

export const WILSON_Z_95 = 1.96;

export interface WilsonInterval {
  /** Successes (e.g. overs). */
  successes: number;
  /** Trials (e.g. decided games = overs + unders). */
  n: number;
  /** Point estimate successes/n (0.5 when n === 0, by convention). */
  pHat: number;
  center: number;
  lower: number;
  upper: number;
  /** upper - lower; wider = less certain. */
  width: number;
}

export type ConfidenceBadge = 'High' | 'Medium' | 'Low';

/**
 * 95% Wilson score interval for x successes in n trials.
 * With n === 0 the estimate is undefined, so we return the maximally-uncertain
 * interval [0, 1] (width 1) — which maps to the "Low" badge.
 */
export function wilsonInterval(
  successes: number,
  n: number,
  z: number = WILSON_Z_95,
): WilsonInterval {
  if (n <= 0) {
    return { successes, n: 0, pHat: 0.5, center: 0.5, lower: 0, upper: 1, width: 1 };
  }
  const pHat = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (pHat + z2 / (2 * n)) / denom;
  const margin =
    (z * Math.sqrt((pHat * (1 - pHat) + z2 / (4 * n)) / n)) / denom;
  const lower = Math.max(0, center - margin);
  const upper = Math.min(1, center + margin);
  return { successes, n, pHat, center, lower, upper, width: upper - lower };
}

/**
 * Interval-width cutoffs for the confidence badge (narrower interval = more
 * certain). Exported so the public methodology page documents the exact numbers
 * the code uses, with no chance of drift.
 */
export const CONFIDENCE_BADGE_WIDTHS = { high: 0.25, medium: 0.45 } as const;

/** Map an interval width to a 3-level confidence badge (PLAN §5c). */
export function confidenceBadge(width: number): ConfidenceBadge {
  if (width < CONFIDENCE_BADGE_WIDTHS.high) return 'High';
  if (width < CONFIDENCE_BADGE_WIDTHS.medium) return 'Medium';
  return 'Low';
}

export interface Confidence {
  interval: WilsonInterval;
  badge: ConfidenceBadge;
}

/** Convenience: Wilson interval + badge for x successes in n trials. */
export function hitRateConfidence(
  successes: number,
  n: number,
  z: number = WILSON_Z_95,
): Confidence {
  const interval = wilsonInterval(successes, n, z);
  return { interval, badge: confidenceBadge(interval.width) };
}
