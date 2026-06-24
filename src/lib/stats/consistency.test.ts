import { describe, it, expect } from 'vitest';
import { computeConsistency } from './consistency';

describe('computeConsistency', () => {
  it('Steady when variation is low; shareOverLine counts >= line', () => {
    const vals = [10, 10, 10, 11, 9]; // mean 10, stdev 0.632
    const c = computeConsistency(vals, 10, Math.sqrt(0.4), 8.5);
    expect(c.cv!).toBeLessThan(0.3);
    expect(c.badge).toBe('Steady');
    expect(c.shareOverLine).toBeCloseTo(1, 6); // all 5 are >= 8.5
  });
  it('Boom-Bust when the coefficient of variation is high', () => {
    const vals = [0, 0, 30, 0, 30]; // mean 12
    const stdev = Math.sqrt((144 * 3 + 324 * 2) / 5);
    const c = computeConsistency(vals, 12, stdev, 10);
    expect(c.cv!).toBeGreaterThanOrEqual(0.6);
    expect(c.badge).toBe('Boom-Bust');
  });
  it('floor < ceiling for a spread of values', () => {
    const c = computeConsistency([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5.5, 2.872, 5);
    expect(c.floor!).toBeLessThan(c.ceiling!);
  });
  it('empty -> nulls and a default badge', () => {
    const c = computeConsistency([], null, null);
    expect(c.cv).toBeNull();
    expect(c.floor).toBeNull();
    expect(c.shareOverLine).toBeNull();
  });
});
