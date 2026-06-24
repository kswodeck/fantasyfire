// Consistency / floor-ceiling — does a player clear the line RELIABLY, or is he
// boom-or-bust? Pure (no React/Next/db). A high ceiling with a low floor is a
// very different bet than a steady producer, even at the same hit rate.

export type ConsistencyBadge = 'Steady' | 'Variable' | 'Boom-Bust';

/** Coefficient-of-variation cutoffs for the badge (single-sourced for /methodology). */
export const CONSISTENCY_CV_THRESHOLDS = { steady: 0.3, boomBust: 0.6 } as const;

export interface Consistency {
  /** Coefficient of variation = stdev / |mean| (null when mean is 0/null). */
  cv: number | null;
  /** 20th-percentile "floor" of the window's values. */
  floor: number | null;
  /** 80th-percentile "ceiling". */
  ceiling: number | null;
  /** Share of games at or above the line (0..1); null when no line/games. */
  shareOverLine: number | null;
  badge: ConsistencyBadge;
}

/** Linear-interpolated percentile of an ascending-sorted, non-empty array. */
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = p * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

/**
 * Consistency read for a window's values (order-independent). `mean`/`stdev`
 * come from computeHitRate; pass the line to also get the share at/over it.
 */
export function computeConsistency(
  values: number[],
  mean: number | null,
  stdev: number | null,
  line?: number,
): Consistency {
  if (values.length === 0) {
    return { cv: null, floor: null, ceiling: null, shareOverLine: null, badge: 'Variable' };
  }
  const cv = mean === null || mean === 0 || stdev === null ? null : stdev / Math.abs(mean);
  const sorted = [...values].sort((a, b) => a - b);
  const shareOverLine =
    line === undefined ? null : values.filter((v) => v >= line).length / values.length;

  let badge: ConsistencyBadge = 'Variable';
  if (cv !== null) {
    if (cv < CONSISTENCY_CV_THRESHOLDS.steady) badge = 'Steady';
    else if (cv >= CONSISTENCY_CV_THRESHOLDS.boomBust) badge = 'Boom-Bust';
  }

  return {
    cv,
    floor: percentile(sorted, 0.2),
    ceiling: percentile(sorted, 0.8),
    shareOverLine,
    badge,
  };
}
