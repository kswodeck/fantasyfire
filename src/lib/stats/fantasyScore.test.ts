import { describe, it, expect } from 'vitest';
import {
  nbaFantasyScore,
  mlbHitterFantasyScore,
  nflFantasyScore,
  STAT_DEFS,
} from './types';

// PrizePicks scoring tables (see the block comment in types.ts — verify against
// the app when they change).
describe('nbaFantasyScore', () => {
  it('scores PTS + 1.2 REB + 1.5 AST + 3 STL + 3 BLK − TOV', () => {
    expect(
      nbaFantasyScore({ points: 20, rebounds: 10, assists: 4, steals: 1, blocks: 2, turnovers: 3 }),
    ).toBeCloseTo(20 + 12 + 6 + 3 + 6 - 3, 10);
  });

  it('treats missing columns as zero', () => {
    expect(nbaFantasyScore({ points: 10 })).toBe(10);
  });
});

describe('mlbHitterFantasyScore', () => {
  it('derives singles from hits and scores each event', () => {
    // 4 hits = 1 single + 1 double + 1 triple + 1 HR.
    expect(
      mlbHitterFantasyScore({
        hits: 4, doubles: 1, triples: 1, homeRuns: 1,
        runs: 2, rbi: 3, walks: 1, hbp: 1, stolenBases: 1,
      }),
    ).toBe(3 + 5 + 8 + 10 + 4 + 6 + 2 + 2 + 5);
  });

  it('an 0-fer with a walk scores just the walk', () => {
    expect(mlbHitterFantasyScore({ hits: 0, walks: 1 })).toBe(2);
  });

  it('clamps derived singles at zero on inconsistent data', () => {
    // 1 hit but 2 doubles recorded — singles must not go negative.
    expect(mlbHitterFantasyScore({ hits: 1, doubles: 2 })).toBe(10);
  });
});

describe('nflFantasyScore', () => {
  it('scores a passing + rushing QB line', () => {
    expect(
      nflFantasyScore({ passYards: 300, passTds: 2, passInts: 1, rushYards: 30, rushTds: 1 }),
    ).toBeCloseTo(12 + 8 - 1 + 3 + 6, 10);
  });

  it('scores a full-PPR receiving line with a fumble', () => {
    expect(
      nflFantasyScore({ receptions: 6, recYards: 80, recTds: 1, fumblesLost: 1 }),
    ).toBeCloseTo(6 + 8 + 6 - 2, 10);
  });
});

describe('FS stat registration', () => {
  it('registers one FS key per sport with the FS short code', () => {
    expect(STAT_DEFS.fs.sport).toBe('nba');
    expect(STAT_DEFS.hitterFs.sport).toBe('mlb');
    expect(STAT_DEFS.fantasyScore.sport).toBe('nfl');
    for (const k of ['fs', 'hitterFs', 'fantasyScore'] as const) {
      expect(STAT_DEFS[k].short).toBe('FS');
    }
  });
});
