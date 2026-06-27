import { describe, it, expect } from 'vitest';
import {
  impliedTeamTotal,
  environmentMultiplier,
  ENVIRONMENT_MULTIPLIER_BOUNDS,
} from './environment';

describe('impliedTeamTotal', () => {
  it('splits the total evenly at a pick-em', () => {
    expect(impliedTeamTotal(9, 0)).toBe(4.5);
  });
  it('bumps the favorite up and the dog down', () => {
    expect(impliedTeamTotal(9, -1.5)).toBe(5.25); // favored team
    expect(impliedTeamTotal(9, 1.5)).toBe(3.75); // underdog
  });
  it('null when an input is missing', () => {
    expect(impliedTeamTotal(null, -1.5)).toBeNull();
    expect(impliedTeamTotal(9, null)).toBeNull();
  });
});

describe('environmentMultiplier', () => {
  it('is neutral at the league-average team total', () => {
    expect(environmentMultiplier(4.5, 4.5)).toBeCloseTo(1, 9);
  });
  it('rises in a high implied-total spot', () => {
    expect(environmentMultiplier(5.0, 4.5)).toBeGreaterThan(1);
  });
  it('falls in a low implied-total spot', () => {
    expect(environmentMultiplier(4.0, 4.5)).toBeLessThan(1);
  });
  it('clamps an extreme implied total', () => {
    expect(environmentMultiplier(10, 4.5)).toBe(ENVIRONMENT_MULTIPLIER_BOUNDS.max);
    expect(environmentMultiplier(1, 4.5)).toBe(ENVIRONMENT_MULTIPLIER_BOUNDS.min);
  });
  it('is neutral when inputs are missing', () => {
    expect(environmentMultiplier(null, 4.5)).toBe(1);
    expect(environmentMultiplier(5, null)).toBe(1);
    expect(environmentMultiplier(5, 0)).toBe(1);
  });
});
