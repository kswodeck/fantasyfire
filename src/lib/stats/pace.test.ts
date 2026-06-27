import { describe, it, expect } from 'vitest';
import { possessions, teamPace, paceMultiplier, PACE_MULTIPLIER_BOUNDS } from './pace';

describe('possessions', () => {
  it('applies the box-score formula FGA + 0.44·FTA − OREB + TOV', () => {
    expect(possessions({ fga: 90, fta: 20, oreb: 10, tov: 14 })).toBeCloseTo(
      90 + 0.44 * 20 - 10 + 14,
      9,
    );
  });
  it('never goes negative', () => {
    expect(possessions({ fga: 0, fta: 0, oreb: 50, tov: 0 })).toBe(0);
  });
});

describe('teamPace', () => {
  it('averages possessions across games', () => {
    const a = { fga: 90, fta: 20, oreb: 10, tov: 14 };
    const b = { fga: 100, fta: 24, oreb: 12, tov: 12 };
    expect(teamPace([a, b])).toBeCloseTo((possessions(a) + possessions(b)) / 2, 9);
  });
  it('null with no games', () => {
    expect(teamPace([])).toBeNull();
  });
});

describe('paceMultiplier', () => {
  it('is 1 at league-average pace', () => {
    expect(paceMultiplier(100, 100, 100)).toBeCloseTo(1, 9);
  });
  it('rises above 1 for two fast teams', () => {
    expect(paceMultiplier(104, 106, 100)).toBeGreaterThan(1);
  });
  it('falls below 1 for two slow teams', () => {
    expect(paceMultiplier(95, 96, 100)).toBeLessThan(1);
  });
  it('clamps to the bounds for an extreme mismatch', () => {
    expect(paceMultiplier(130, 130, 100)).toBe(PACE_MULTIPLIER_BOUNDS.max);
    expect(paceMultiplier(70, 70, 100)).toBe(PACE_MULTIPLIER_BOUNDS.min);
  });
  it('is neutral when any input is missing', () => {
    expect(paceMultiplier(null, 100, 100)).toBe(1);
    expect(paceMultiplier(100, 100, null)).toBe(1);
  });
});
