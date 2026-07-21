import { describe, it, expect } from 'vitest';
import {
  missDistribution,
  powerPlayEv,
  flexPlayEv,
  entryEvs,
  avgLegProb,
} from './entryEv';

describe('missDistribution', () => {
  it('sums to 1 and matches the closed form for equal legs', () => {
    const d = missDistribution([0.6, 0.6, 0.6]);
    expect(d).toHaveLength(4); // 0..3 misses
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(d[0]).toBeCloseTo(0.6 ** 3, 10); // all hit
    expect(d[3]).toBeCloseTo(0.4 ** 3, 10); // all miss
  });

  it('handles a certain leg (p=1) and an impossible leg (p=0)', () => {
    expect(missDistribution([1, 1])[0]).toBeCloseTo(1, 10); // never misses
    expect(missDistribution([0, 0])[2]).toBeCloseTo(1, 10); // always both miss
  });

  it('is exact for unequal legs (Poisson-binomial)', () => {
    // 2 legs at 0.7 and 0.4: P(0 miss)=.28, P(1)=.7*.6+.3*.4=.54, P(2)=.3*.6=.18
    const d = missDistribution([0.7, 0.4]);
    expect(d[0]).toBeCloseTo(0.28, 10);
    expect(d[1]).toBeCloseTo(0.54, 10);
    expect(d[2]).toBeCloseTo(0.18, 10);
  });
});

describe('powerPlayEv', () => {
  it('is null for a pick count PrizePicks does not offer', () => {
    expect(powerPlayEv([0.6])).toBeNull(); // no 1-pick power
    expect(powerPlayEv([0.6, 0.6, 0.6, 0.6, 0.6])).toBeNull(); // no 5-pick power
  });

  it('prices a 2-pick power (3× if both hit)', () => {
    const e = powerPlayEv([0.6, 0.6])!;
    expect(e.type).toBe('power');
    expect(e.pAll).toBeCloseTo(0.36, 10);
    // return = 3 × 0.36 = 1.08 → EV = +0.08
    expect(e.ev).toBeCloseTo(0.08, 10);
  });

  it('breakeven per leg makes EV ~0', () => {
    const e = powerPlayEv([0.5, 0.5, 0.5])!; // 3-pick pays 5×
    // 5 × b³ = 1 → b = (1/5)^(1/3) ≈ 0.585
    expect(e.breakevenPerLeg).toBeCloseTo(Math.pow(1 / 5, 1 / 3), 6);
  });
});

describe('flexPlayEv', () => {
  it('pays on a partial miss (3-pick: 2.25× all, 1.25× one miss)', () => {
    const e = flexPlayEv([0.6, 0.6, 0.6])!;
    expect(e.type).toBe('flex');
    const d = missDistribution([0.6, 0.6, 0.6]);
    const ret = 2.25 * d[0] + 1.25 * d[1];
    expect(e.ev).toBeCloseTo(ret - 1, 10);
  });

  it('breakeven is a valid per-leg rate in (0,1) where EV crosses 0', () => {
    const e = flexPlayEv([0.55, 0.55, 0.55, 0.55, 0.55])!; // 5-pick flex
    expect(e.breakevenPerLeg).toBeGreaterThan(0);
    expect(e.breakevenPerLeg).toBeLessThan(1);
    const atBreakeven = flexPlayEv(new Array(5).fill(e.breakevenPerLeg))!;
    expect(atBreakeven.ev).toBeCloseTo(0, 4);
  });
});

describe('entryEvs / avgLegProb', () => {
  it('returns both entry types for a size with power AND flex (3 or 4)', () => {
    const evs = entryEvs([0.6, 0.6, 0.6]);
    expect(evs.map((e) => e.type)).toEqual(['power', 'flex']);
  });

  it('returns flex-only for 5-6 picks (no power at those sizes)', () => {
    expect(entryEvs([0.6, 0.6, 0.6, 0.6, 0.6]).map((e) => e.type)).toEqual(['flex']);
  });

  it('averages the leg probabilities', () => {
    expect(avgLegProb([0.4, 0.6])).toBeCloseTo(0.5, 10);
    expect(avgLegProb([])).toBe(0);
  });
});
