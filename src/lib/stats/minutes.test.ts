import { describe, it, expect } from 'vitest';
import { nbaMinutesThreshold } from './minutes';

describe('nbaMinutesThreshold', () => {
  it('returns 0 when there are no appearances', () => {
    expect(nbaMinutesThreshold([])).toBe(0);
    expect(nbaMinutesThreshold([null, undefined, 0])).toBe(0);
  });

  it('equals the value when minutes are constant', () => {
    expect(nbaMinutesThreshold([30, 30, 30, 30])).toBe(30);
  });

  it('blends season mean with the last-10 mean (most-recent-first)', () => {
    // 12 appearances: first 10 are 40, last 2 are 10.
    // season = (10*40 + 2*10)/12 = 35; recent (first 10) = 40; blend = 37.5
    const m = [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 10, 10];
    expect(nbaMinutesThreshold(m)).toBeCloseTo(37.5, 6);
  });

  it('ignores DNPs (null / 0) when averaging', () => {
    expect(nbaMinutesThreshold([null, 0, 25, 25])).toBe(25);
  });

  it('keeps bench players non-zero (small role still gets a usable bar)', () => {
    // averages ~8 min — a fixed 10-min floor would zero this player out.
    const thr = nbaMinutesThreshold([9, 8, 7, 8]);
    expect(thr).toBeGreaterThan(0);
    expect(thr).toBeLessThan(10);
  });
});
