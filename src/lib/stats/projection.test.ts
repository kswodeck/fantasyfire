import { describe, it, expect } from 'vitest';
import {
  ewma,
  shrinkToBaseline,
  recentFormEstimate,
  combineAdjustments,
  PROJECTION_ADJ_BOUNDS,
} from './projection';

describe('ewma', () => {
  it('a single value returns that value', () => {
    expect(ewma([12])).toBe(12);
  });
  it('a constant series returns the constant', () => {
    expect(ewma([7, 7, 7, 7])).toBeCloseTo(7, 10);
  });
  it('weights recent games more than older ones', () => {
    // recent high, older low -> above the simple mean (10)
    expect(ewma([20, 20, 0, 0])!).toBeGreaterThan(10);
  });
  it('empty -> null', () => {
    expect(ewma([])).toBeNull();
  });
});

describe('shrinkToBaseline', () => {
  it('pulls toward the baseline by k pseudo-games', () => {
    expect(shrinkToBaseline(10, 10, 0, 5)).toBeCloseTo(100 / 15, 10);
  });
  it('no movement when recent already equals the baseline', () => {
    expect(shrinkToBaseline(8, 6, 8, 5)).toBeCloseTo(8, 10);
  });
});

describe('recentFormEstimate', () => {
  it('emits raw/ewma/median/stabilized, all >= 0', () => {
    const r = recentFormEstimate([30, 28, 26, 22, 31, 18, 27, 24, 29, 20], 25);
    expect(r.rawL5).toBeCloseTo((30 + 28 + 26 + 22 + 31) / 5, 6);
    expect(r.rawL10).toBeCloseTo((30 + 28 + 26 + 22 + 31 + 18 + 27 + 24 + 29 + 20) / 10, 6);
    expect(r.ewma).not.toBeNull();
    expect(r.medianL10).not.toBeNull();
    expect(r.stabilized!).toBeGreaterThanOrEqual(0);
  });
  it('stabilized sits between the EWMA and a lower season baseline (regression)', () => {
    const r = recentFormEstimate([40, 40, 40], 10); // hot recent, low baseline
    expect(r.stabilized!).toBeLessThan(r.ewma!);
    expect(r.stabilized!).toBeGreaterThan(10);
  });
  it('empty -> all null', () => {
    const r = recentFormEstimate([], 10);
    expect(r.rawL5).toBeNull();
    expect(r.stabilized).toBeNull();
    expect(r.projection).toBeNull();
  });
  it('projection equals the base when no adjustment is given', () => {
    const r = recentFormEstimate([20, 22, 18, 21, 19], 20);
    expect(r.adjustment).toBe(1);
    expect(r.projection).toBeCloseTo(r.stabilized!, 9);
  });
  it('a soft matchup + fast pace nudges the projection up', () => {
    const base = recentFormEstimate([20, 22, 18, 21, 19], 20);
    const adj = recentFormEstimate([20, 22, 18, 21, 19], 20, { opponent: 1.08, pace: 1.05 });
    expect(adj.projection!).toBeGreaterThan(base.projection!);
    expect(adj.adjustment).toBeCloseTo(1.08 * 1.05, 9);
  });
});

describe('combineAdjustments', () => {
  it('is neutral with no factors', () => {
    expect(combineAdjustments()).toBe(1);
    expect(combineAdjustments({ opponent: null, pace: undefined })).toBe(1);
  });
  it('multiplies the present factors', () => {
    expect(combineAdjustments({ opponent: 1.1, pace: 0.95 })).toBeCloseTo(1.1 * 0.95, 9);
  });
  it('clamps an extreme product to the bounds', () => {
    expect(combineAdjustments({ opponent: 2, pace: 2, environment: 2 })).toBe(
      PROJECTION_ADJ_BOUNDS.max,
    );
    expect(combineAdjustments({ opponent: 0.1, pace: 0.1 })).toBe(PROJECTION_ADJ_BOUNDS.min);
  });
  it('ignores non-positive / non-finite factors', () => {
    expect(combineAdjustments({ opponent: 0, pace: NaN, environment: 1.1 })).toBeCloseTo(1.1, 9);
  });
});
