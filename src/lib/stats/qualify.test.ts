import { describe, it, expect } from 'vitest';
import { blendedRoleThreshold } from './qualify';

// Used for NBA minutes and MLB hitter plate appearances alike — same blend.
describe('blendedRoleThreshold', () => {
  it('returns 0 when there are no appearances', () => {
    expect(blendedRoleThreshold([])).toBe(0);
    expect(blendedRoleThreshold([null, undefined, 0])).toBe(0);
  });

  it('equals the value when the metric is constant', () => {
    expect(blendedRoleThreshold([30, 30, 30, 30])).toBe(30);
  });

  it('blends season mean with the last-10 mean (most-recent-first)', () => {
    // 12 appearances: first 10 are 40, last 2 are 10.
    // season = (10*40 + 2*10)/12 = 35; recent (first 10) = 40; blend = 37.5
    const m = [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 10, 10];
    expect(blendedRoleThreshold(m)).toBeCloseTo(37.5, 6);
  });

  it('ignores non-appearances (null / 0) when averaging', () => {
    expect(blendedRoleThreshold([null, 0, 25, 25])).toBe(25);
  });

  it('keeps part-time players non-zero (a fixed floor would zero them out)', () => {
    // NBA bench (~8 min) or an MLB platoon bat (~3 PA): still gets a usable bar.
    expect(blendedRoleThreshold([9, 8, 7, 8])).toBeGreaterThan(0);
    expect(blendedRoleThreshold([3, 2, 4, 3])).toBeCloseTo(3, 0);
  });
});
