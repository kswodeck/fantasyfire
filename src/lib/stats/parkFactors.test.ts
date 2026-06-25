import { describe, it, expect } from 'vitest';
import {
  MLB_PARK_FACTORS,
  parkFor,
  parkFactor,
  parkTilt,
  parkAdjust,
} from './parkFactors';

describe('park factors', () => {
  it('covers all 30 MLB teams with sane (0.8–1.3) factors', () => {
    const ids = Object.keys(MLB_PARK_FACTORS);
    expect(ids).toHaveLength(30);
    for (const pf of Object.values(MLB_PARK_FACTORS)) {
      expect(pf.runs).toBeGreaterThanOrEqual(0.8);
      expect(pf.runs).toBeLessThanOrEqual(1.3);
      expect(pf.hr).toBeGreaterThanOrEqual(0.8);
      expect(pf.hr).toBeLessThanOrEqual(1.3);
      expect(pf.name.length).toBeGreaterThan(0);
    }
  });

  it('classifies Coors as hitter-friendly and Oracle as pitcher-friendly', () => {
    expect(parkFor(115)?.tilt).toBe('hitter'); // COL
    expect(parkFor(137)?.tilt).toBe('pitcher'); // SF
  });

  it('returns null/neutral for an unknown team id', () => {
    expect(parkFor(99999)).toBeNull();
    expect(parkFor(null)).toBeNull();
    expect(parkFactor(99999, 'hr')).toBe(1);
    expect(parkFactor(undefined, 'runs')).toBe(1);
  });

  it('parkTilt honors the threshold', () => {
    expect(parkTilt(1.04)).toBe('hitter');
    expect(parkTilt(0.96)).toBe('pitcher');
    expect(parkTilt(1.0)).toBe('neutral');
    expect(parkTilt(1.03)).toBe('neutral');
  });

  it('parkAdjust shrinks the effect toward no-op', () => {
    // factor 1.20 at shrink 0.5 -> effective 1.10
    expect(parkAdjust(10, 1.2, 0.5)).toBeCloseTo(11, 10);
    // shrink 0 -> unchanged
    expect(parkAdjust(10, 1.2, 0)).toBeCloseTo(10, 10);
    // shrink 1 -> full factor
    expect(parkAdjust(10, 1.2, 1)).toBeCloseTo(12, 10);
  });
});
