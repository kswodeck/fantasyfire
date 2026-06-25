import { describe, it, expect } from 'vitest';
import { computeStreak } from './streak';

describe('computeStreak', () => {
  it('counts a current over run from the most-recent games', () => {
    expect(computeStreak([30, 28, 26, 18, 25], 20)).toEqual({
      side: 'over',
      length: 3,
      values: [30, 28, 26],
    });
  });

  it('counts an under run', () => {
    expect(computeStreak([10, 12, 14, 30], 20)).toEqual({
      side: 'under',
      length: 3,
      values: [10, 12, 14],
    });
  });

  it('treats a push as transparent (skips it, does not break the run)', () => {
    expect(computeStreak([30, 20, 28, 15], 20)).toEqual({
      side: 'over',
      length: 2,
      values: [30, 28],
    });
  });

  it('returns a null side when every game pushes', () => {
    expect(computeStreak([20, 20], 20)).toEqual({ side: null, length: 0, values: [] });
  });

  it('handles an empty list', () => {
    expect(computeStreak([], 20)).toEqual({ side: null, length: 0, values: [] });
  });
});
