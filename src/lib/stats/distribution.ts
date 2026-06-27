// Projection → probability. Turns a point projection (a mean) plus the player's
// own game-to-game dispersion into P(stat clears the line) — the missing step that
// lets us compare a model number to a market price. Pure (no React/Next/db).
//
// Two families, chosen per stat (see STAT_FAMILY):
//  - CONTINUOUS (passing/rushing/receiving yards): Normal(μ, σ). Yards are
//    effectively continuous, so a normal CDF is the right, simplest model.
//  - COUNT (everything else — points, rebounds, strikeouts, home runs, …): a
//    discrete model. We use the NEGATIVE BINOMIAL when the player is overdispersed
//    (variance > mean, the usual case — it has an extra shape parameter that
//    encodes streakiness), and fall back to POISSON when variance ≤ mean. The
//    negative binomial → Poisson → Normal as the mean grows, so high-count stats
//    (points, total bases) are handled gracefully by the same path.
//
// Half-point lines can't push; integer lines can, so we return the push mass
// explicitly and never fold it into either side.
import type { StatKey } from './types';

export interface LineProbabilities {
  /** P(stat > line). */
  over: number;
  /** P(stat < line). */
  under: number;
  /** P(stat == line) — 0 for a half-point line, the push mass for an integer line. */
  push: number;
}

/** Stats modeled as continuous (Normal); everything else is a non-negative count. */
const CONTINUOUS_STATS: ReadonlySet<StatKey> = new Set<StatKey>([
  'passYds',
  'rushYds',
  'recYds',
]);

export type DistributionFamily = 'continuous' | 'count';

export function statFamily(stat: StatKey): DistributionFamily {
  return CONTINUOUS_STATS.has(stat) ? 'continuous' : 'count';
}

// ---- numerics ----------------------------------------------------------------

/** erf via Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7) — enough for prop probs. */
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

/** Standard normal CDF Φ(z). */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// Lanczos approximation (g=7) for ln Γ(x). Stable for the small positive x and the
// (possibly non-integer) shape parameters the negative binomial produces.
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];
function lgamma(x: number): number {
  if (x < 0.5) {
    // Reflection formula for the (rare) small/edge inputs.
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  }
  let a = LANCZOS[0];
  const t = x - 1 + 7.5;
  for (let i = 1; i < LANCZOS.length; i++) a += LANCZOS[i] / (x - 1 + i);
  return 0.5 * Math.log(2 * Math.PI) + (x - 1 + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Upper sum bound for a count PMF — well past where the tail is negligible. */
function countCeiling(mean: number, sd: number, line: number): number {
  return Math.max(Math.ceil(mean + 20 * sd), Math.ceil(line) + 60, 30);
}

// ---- continuous (Normal) -----------------------------------------------------

export function normalLineProbabilities(
  mean: number,
  sd: number,
  line: number,
): LineProbabilities {
  const s = Math.max(sd, 1e-6);
  const over = 1 - normalCdf((line - mean) / s);
  return { over, under: 1 - over, push: 0 };
}

// ---- count (Negative Binomial / Poisson) -------------------------------------

/** ln PMF of NB(r, p) at k: ln Γ(k+r) − ln Γ(r) − ln k! + r·ln p + k·ln(1−p). */
function nbLogPmf(k: number, r: number, p: number): number {
  return (
    lgamma(k + r) - lgamma(r) - lgamma(k + 1) + r * Math.log(p) + k * Math.log(1 - p)
  );
}

/** ln PMF of Poisson(λ) at k: k·ln λ − λ − ln k!. */
function poissonLogPmf(k: number, lambda: number): number {
  return k * Math.log(lambda) - lambda - lgamma(k + 1);
}

/**
 * P(over/under/push) for a non-negative count with the given mean and variance.
 * Negative binomial when overdispersed (variance > mean), Poisson otherwise. The
 * PMF is summed directly (counts are small and bounded) and renormalized to absorb
 * any truncated tail, so the three masses always sum to 1.
 */
export function countLineProbabilities(
  mean: number,
  variance: number,
  line: number,
): LineProbabilities {
  const m = Math.max(mean, 0);
  // Degenerate: no spread → a point mass at the rounded mean.
  if (m <= 0) return { over: 0, under: line > 0 ? 1 : 0, push: line === 0 ? 1 : 0 };

  const sd = Math.sqrt(Math.max(variance, 0));
  const ceiling = countCeiling(m, sd || Math.sqrt(m), line);
  const logPmf =
    variance > m
      ? (() => {
          // Method of moments: p = mean/variance, r = mean²/(variance − mean).
          const p = m / variance;
          const r = (m * m) / (variance - m);
          return (k: number) => nbLogPmf(k, r, p);
        })()
      : (k: number) => poissonLogPmf(k, m);

  let over = 0;
  let under = 0;
  let push = 0;
  let total = 0;
  for (let k = 0; k <= ceiling; k++) {
    const pk = Math.exp(logPmf(k));
    total += pk;
    if (k > line) over += pk;
    else if (k < line) under += pk;
    else push += pk;
  }
  if (total <= 0) return { over: 0, under: 1, push: 0 };
  return { over: over / total, under: under / total, push: push / total };
}

/**
 * Model probabilities that a stat clears `line`, given a projection (`mean`) and the
 * player's per-game standard deviation (`sd`). Dispatches on the stat's family.
 * Returns null when there's nothing to model (no projection).
 */
export function lineProbabilities(
  stat: StatKey,
  mean: number | null,
  sd: number | null,
  line: number,
): LineProbabilities | null {
  if (mean === null) return null;
  const s = sd ?? 0;
  return statFamily(stat) === 'continuous'
    ? normalLineProbabilities(mean, s, line)
    : countLineProbabilities(mean, s * s, line);
}
