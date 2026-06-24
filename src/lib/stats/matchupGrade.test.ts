import { describe, it, expect } from 'vitest';
import { matchupGrade, opponentMultiplier, type DvpCell } from './dvp';

function cell(rank: number, totalRanked: number, lowSample = false, avgAllowed = 25): DvpCell {
  return {
    opponentTeamId: 1,
    posBucket: 'G',
    stat: 'pts',
    avgAllowed,
    sampleSize: lowSample ? 4 : 40,
    rank,
    totalRanked,
    lowSample,
  };
}

describe('matchupGrade', () => {
  it('rank 1 of 30 (allows the most) grades A', () => {
    expect(matchupGrade(cell(1, 30))).toBe('A');
  });
  it('the toughest rank grades F', () => {
    expect(matchupGrade(cell(30, 30))).toBe('F');
  });
  it('low-sample cells are NR (not rated)', () => {
    expect(matchupGrade(cell(1, 30, true))).toBe('NR');
  });
});

describe('opponentMultiplier', () => {
  it('clamps a soft matchup to +10%', () => {
    expect(opponentMultiplier(cell(1, 30, false, 30), 25)).toBeCloseTo(1.1, 10);
  });
  it('clamps a tough matchup to -10%', () => {
    expect(opponentMultiplier(cell(30, 30, false, 20), 25)).toBeCloseTo(0.9, 10);
  });
  it('is neutral (1.0) on a low-sample cell', () => {
    expect(opponentMultiplier(cell(1, 30, true, 30), 25)).toBe(1);
  });
});
