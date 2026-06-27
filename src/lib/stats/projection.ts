// Player PROJECTION. Pure (no React/Next/db). A recency-weighted, sample-stabilized
// read of a player's recent values, then ADJUSTED for the specific matchup it faces:
// opponent strength, game pace, and game environment. The raw L5/L10/median are kept
// alongside as the descriptive context the projection is built from.
//
// The base = EWMA of recent games regressed toward the season baseline (damps
// small-sample streaks). The headline `projection` = base × a gentle, clamped
// adjustment multiplier, so a soft matchup or fast-paced game nudges the number
// without ever letting context swing it wildly.
import { median } from '../format';

/** EWMA decay. α=0.28 ⇒ the last ~2 games carry roughly half the weight. */
export const EWMA_ALPHA = 0.28;
/** Pseudo-games of regression toward the season baseline (shrinkage strength). */
export const SHRINKAGE_K = 5;
/** Overall clamp on the combined matchup adjustment — context nudges, never swings. */
export const PROJECTION_ADJ_BOUNDS = { min: 0.82, max: 1.22 } as const;

/** Per-factor matchup multipliers (1 = neutral). Each defaults to neutral when its
 *  data is unavailable, so the projection degrades to the pure recent-form base. */
export interface ProjectionAdjustments {
  /** Opponent strength (DvP / opposing-pitcher derived). */
  opponent?: number | null;
  /** Game pace — more possessions ⇒ more counting-stat opportunity. */
  pace?: number | null;
  /** Game environment (Vegas total / implied team total). */
  environment?: number | null;
  /** Recent opportunity/usage trend vs the season baseline (minutes, targets, …). */
  volume?: number | null;
}

export interface RecentFormEstimate {
  /** Simple mean of the last 5 games. */
  rawL5: number | null;
  /** Simple mean of the last 10 games. */
  rawL10: number | null;
  /** Recency-weighted average (EWMA). */
  ewma: number | null;
  /** Median of the last 10 games (robust to outliers). */
  medianL10: number | null;
  /** EWMA regressed toward the season baseline — the pre-adjustment base. */
  stabilized: number | null;
  /** The headline projection: `stabilized` × the clamped matchup adjustment. */
  projection: number | null;
  /** The combined, clamped multiplier applied to `stabilized` (1 = neutral). */
  adjustment: number;
  /** The per-factor multipliers actually folded in (for the breakdown UI). */
  factors: ProjectionAdjustments;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/**
 * Combine the available matchup factors into one clamped multiplier. Missing/neutral
 * factors contribute nothing; the product is bounded by PROJECTION_ADJ_BOUNDS so no
 * single game's context can dominate the recent-form base.
 */
export function combineAdjustments(adj: ProjectionAdjustments = {}): number {
  const factors = [adj.opponent, adj.pace, adj.environment, adj.volume];
  let product = 1;
  for (const f of factors) {
    if (f != null && Number.isFinite(f) && f > 0) product *= f;
  }
  return clamp(product, PROJECTION_ADJ_BOUNDS.min, PROJECTION_ADJ_BOUNDS.max);
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
 * Player projection from most-recent-first values + a season baseline mean, with an
 * optional matchup adjustment (opponent / pace / environment). Returns the raw L5/L10/
 * median context, the recency-stabilized base, and the adjusted headline `projection`.
 */
export function recentFormEstimate(
  values: number[],
  seasonMean: number | null,
  adjustments: ProjectionAdjustments = {},
): RecentFormEstimate {
  const adjustment = combineAdjustments(adjustments);
  if (values.length === 0) {
    return {
      rawL5: null,
      rawL10: null,
      ewma: null,
      medianL10: null,
      stabilized: null,
      projection: null,
      adjustment,
      factors: adjustments,
    };
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
    projection: stabilized === null ? null : Math.max(0, stabilized * adjustment),
    adjustment,
    factors: adjustments,
  };
}
