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

describe('float-artifact rounding (nearest hundredth)', () => {
  it('renders the reported 1 REB / 1 TOV case as 0.2, not 0.19999999999999996', () => {
    // The exact WNBA row from the settled-leans strip: 1.2×1 − 1 evaluates to
    // 0.19999999999999996 in binary floating point and was printed in full.
    const fs = nbaFantasyScore({ rebounds: 1, turnovers: 1 });
    expect(fs).toBe(0.2);
    expect(String(fs)).toBe('0.2');
  });

  it('never prints a long decimal for any plausible NBA/WNBA box score', () => {
    for (let reb = 0; reb <= 20; reb++) {
      for (let ast = 0; ast <= 15; ast++) {
        for (const tov of [0, 1, 3]) {
          const s = String(nbaFantasyScore({ points: 7, rebounds: reb, assists: ast, turnovers: tov }));
          const decimals = s.includes('.') ? s.split('.')[1].length : 0;
          expect(decimals).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('keeps NFL per-yard scoring exact to the hundredth', () => {
    // 0.04 × 3 = 0.12000000000000001 raw; 0.1 × 7 = 0.7000000000000001 raw.
    expect(nflFantasyScore({ passYards: 3 })).toBe(0.12);
    expect(nflFantasyScore({ rushYards: 7 })).toBe(0.7);
    // A realistic stat line stays exact rather than drifting.
    expect(nflFantasyScore({ passYards: 267, passTds: 2, passInts: 1, rushYards: 23 })).toBe(
      0.04 * 267 + 8 - 1 + 2.3,
    );
  });

  it('rounding does not change any true value (weights have ≤2 decimals)', () => {
    // Full stat line: the rounded result equals the exact decimal arithmetic.
    expect(
      nbaFantasyScore({ points: 20, rebounds: 10, assists: 4, steals: 1, blocks: 2, turnovers: 3 }),
    ).toBe(44);
    expect(nbaFantasyScore({ rebounds: 5, assists: 3 })).toBe(10.5); // 6 + 4.5
    expect(mlbHitterFantasyScore({ hits: 2, doubles: 1, runs: 1 })).toBe(3 + 5 + 2);
  });
});
