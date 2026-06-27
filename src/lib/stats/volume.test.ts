import { describe, it, expect } from 'vitest';
import { volumeMultiplier, VOLUME_MULTIPLIER_BOUNDS } from './volume';

describe('volumeMultiplier', () => {
  it('is neutral when recent matches the baseline', () => {
    expect(volumeMultiplier([30, 30, 30, 30, 30, 30])).toBeCloseTo(1, 9);
  });
  it('boosts when recent opportunity is up (expanded role)', () => {
    // last-5 avg 36 vs season avg ~31 ⇒ > 1
    expect(volumeMultiplier([36, 36, 36, 36, 36, 20, 20, 20])).toBeGreaterThan(1);
  });
  it('cuts when recent opportunity is down (shrunk role)', () => {
    expect(volumeMultiplier([18, 18, 18, 18, 18, 34, 34, 34])).toBeLessThan(1);
  });
  it('clamps an extreme swing', () => {
    expect(volumeMultiplier([40, 40, 40, 40, 40, 5, 5, 5, 5, 5])).toBe(VOLUME_MULTIPLIER_BOUNDS.max);
    expect(volumeMultiplier([4, 4, 4, 4, 4, 40, 40, 40, 40, 40])).toBe(VOLUME_MULTIPLIER_BOUNDS.min);
  });
  it('ignores zeros / nulls (non-appearances)', () => {
    expect(volumeMultiplier([30, 0, 30, null, 30, 30])).toBeCloseTo(1, 9);
  });
  it('is neutral on a thin sample', () => {
    expect(volumeMultiplier([30, 30])).toBe(1);
    expect(volumeMultiplier([])).toBe(1);
  });
});
