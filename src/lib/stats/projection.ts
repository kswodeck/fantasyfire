// Recent-form ESTIMATE (descriptive) — the base for the FireScore "good prop"
// signal. Pure (no React/Next/db). This is NOT a forecast of a specific game:
// it is a recency-weighted, sample-stabilized read of a player's recent values,
// always surfaced as a small RANGE (raw L5/L10 + median + stabilized), never one
// hero number. Honest framing lives in the UI + /methodology.
import { median } from '../format';

/** EWMA decay. α=0.28 ⇒ the last ~2 games carry roughly half the weight. */
export const EWMA_ALPHA = 0.28;
/** Pseudo-games of regression toward the season baseline (shrinkage strength). */
export const SHRINKAGE_K = 5;

export interface RecentFormEstimate {
  /** Simple mean of the last 5 games. */
  rawL5: number | null;
  /** Simple mean of the last 10 games. */
  rawL10: number | null;
  /** Recency-weighted average (EWMA). */
  ewma: number | null;
  /** Median of the last 10 games (robust to outliers). */
  medianL10: number | null;
  /** EWMA regressed toward the season baseline — the headline stabilized read. */
  stabilized: number | null;
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/**
 * Exponentially-weighted moving average over MOST-RECENT-FIRST values.
 * weight_i = α(1−α)^i, so index 0 (most recent) gets the most weight.
 */
export function ewma(values: number[], alpha = EWMA_ALPHA): number | null {
  if (values.length === 0) return null;
  let num = 0;
  let den = 0;
  for (let i = 0; i < values.length; i++) {
    const w = alpha * Math.pow(1 - alpha, i);
    num += w * values[i];
    den += w;
  }
  return den === 0 ? null : num / den;
}

/**
 * Pull `recent` toward `baseline` by `k` pseudo-games (regression to the mean):
 * (n·recent + k·baseline) / (n + k). With few games it sits near the baseline;
 * with many it sits near the recent estimate. Damps small-sample hot streaks.
 */
export function shrinkToBaseline(
  recent: number,
  n: number,
  baseline: number,
  k = SHRINKAGE_K,
): number {
  return (n * recent + k * baseline) / (n + k);
}

/**
 * Recent-form estimate from most-recent-first values + a season baseline mean.
 * Returns all four reference numbers so the UI shows a range, plus the
 * regression-stabilized headline. Descriptive recent form — not a prediction.
 */
export function recentFormEstimate(
  values: number[],
  seasonMean: number | null,
): RecentFormEstimate {
  if (values.length === 0) {
    return { rawL5: null, rawL10: null, ewma: null, medianL10: null, stabilized: null };
  }
  const e = ewma(values);
  // Baseline for shrinkage: the season mean when available, else the EWMA itself
  // (so a player with no season history isn't shrunk toward an arbitrary number).
  const baseline = seasonMean ?? e ?? 0;
  const n = Math.min(values.length, 10);
  const stabilized =
    e === null ? null : Math.max(0, shrinkToBaseline(e, n, baseline, SHRINKAGE_K));
  return {
    rawL5: mean(values.slice(0, 5)),
    rawL10: mean(values.slice(0, 10)),
    ewma: e,
    medianL10: median(values.slice(0, 10)),
    stabilized,
  };
}
