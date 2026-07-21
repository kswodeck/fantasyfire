// PrizePicks ENTRY-level EV math — pure (no React/Next/db), unit-tested.
//
// Turns per-leg win-probability estimates into what an actual entry pays:
// P(full sweep), P(exactly k misses) (Flex pays partials), expected value per $1,
// and the uniform per-leg rate the entry needs to break even. Payout multiples
// come from the hand-maintained PP tables in ppPayouts.ts ("typical" — they can
// vary by state/promo, and demons/goblins change an entry's multiplier, which is
// why the UI only feeds STANDARD legs in here).
//
// Honesty contract (mirror in any UI): legs are treated as INDEPENDENT — same-game
// or same-player legs are correlated in reality, which makes the numbers here
// optimistic about certainty; per-leg probabilities are model estimates from
// historical logs, not truths; the output is descriptive math, never advice.
import { PP_FLEX_PLAY, PP_POWER_PLAY } from './ppPayouts';

/**
 * P(exactly k of the legs MISS), k = 0..n, assuming independence.
 * `ps` are per-leg WIN probabilities. Standard Poisson-binomial DP — exact, O(n²).
 */
export function missDistribution(ps: number[]): number[] {
  let dist = [1];
  for (const p of ps) {
    const next = new Array<number>(dist.length + 1).fill(0);
    for (let k = 0; k < dist.length; k++) {
      next[k] += dist[k] * p; // this leg hits → miss count unchanged
      next[k + 1] += dist[k] * (1 - p); // this leg misses
    }
    dist = next;
  }
  return dist;
}

export interface EntryEv {
  type: 'power' | 'flex';
  picks: number;
  /** Payout multiples (return per $1 staked, stake included). */
  pays: { allHit: number; oneMiss?: number; twoMiss?: number };
  /** P(every leg hits). */
  pAll: number;
  /** Expected value per $1 staked (return − stake); > 0 = +EV under the model. */
  ev: number;
  /** The uniform per-leg win rate at which this entry breaks even. */
  breakevenPerLeg: number;
}

function evFor(
  ps: number[],
  pays: { allHit: number; oneMiss?: number; twoMiss?: number },
): { pAll: number; ev: number } {
  const dist = missDistribution(ps);
  const ret =
    pays.allHit * (dist[0] ?? 0) +
    (pays.oneMiss ?? 0) * (dist[1] ?? 0) +
    (pays.twoMiss ?? 0) * (dist[2] ?? 0);
  return { pAll: dist[0] ?? 0, ev: ret - 1 };
}

/** The uniform per-leg p where the entry's EV crosses 0 (bisection; EV is
 *  monotonically increasing in p). */
function breakevenPerLeg(
  n: number,
  pays: { allHit: number; oneMiss?: number; twoMiss?: number },
): number {
  let lo = 0.01;
  let hi = 0.999;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const { ev } = evFor(new Array<number>(n).fill(mid), pays);
    if (ev >= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Power Play EV for these legs (every pick must hit), or null when PrizePicks
 *  doesn't offer a Power entry of this size. */
export function powerPlayEv(ps: number[]): EntryEv | null {
  const row = PP_POWER_PLAY.find((r) => r.picks === ps.length);
  if (!row) return null;
  const pays = { allHit: row.pays };
  return {
    type: 'power',
    picks: ps.length,
    pays,
    ...evFor(ps, pays),
    // Closed form: pays × pⁿ = 1.
    breakevenPerLeg: Math.pow(1 / row.pays, 1 / ps.length),
  };
}

/** Flex Play EV for these legs (partial misses still pay), or null when
 *  PrizePicks doesn't offer a Flex entry of this size. */
export function flexPlayEv(ps: number[]): EntryEv | null {
  const row = PP_FLEX_PLAY.find((r) => r.picks === ps.length);
  if (!row) return null;
  const pays = { allHit: row.allHit, oneMiss: row.oneMiss, twoMiss: row.twoMiss };
  return {
    type: 'flex',
    picks: ps.length,
    pays,
    ...evFor(ps, pays),
    breakevenPerLeg: breakevenPerLeg(ps.length, pays),
  };
}

/** Every entry type PrizePicks offers at this pick count, Power first. */
export function entryEvs(ps: number[]): EntryEv[] {
  return [powerPlayEv(ps), flexPlayEv(ps)].filter((e): e is EntryEv => e !== null);
}

/** Simple mean of the legs' win probabilities — shown against breakevenPerLeg. */
export function avgLegProb(ps: number[]): number {
  return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0;
}
