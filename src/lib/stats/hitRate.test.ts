import { describe, it, expect } from 'vitest';
import { computeHitRate, computeHitRatesAllWindows } from './hitRate';
import { statValue, type GameStatLine } from './types';

function line(p: Partial<GameStatLine>): GameStatLine {
  return {
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fgm: 0,
    fga: 0,
    fg3m: 0,
    fg3a: 0,
    ftm: 0,
    fta: 0,
    minutes: 30,
    ...p,
  };
}

/** Build pts-only games (most-recent-first) from an array of point values. */
function ptsGames(values: number[]): GameStatLine[] {
  return values.map((v) => line({ points: v }));
}

describe('computeHitRate — basic windows', () => {
  // Most-recent-first.
  const games = ptsGames([30, 20, 25, 10, 25, 40]);

  it('L5 over a line, pushes excluded, mean + population stdev', () => {
    const r = computeHitRate(games, 'pts', 24.5, 5);
    expect(r.games).toBe(5);
    expect(r.values).toEqual([30, 20, 25, 10, 25]);
    expect(r.overs).toBe(3); // 30,25,25
    expect(r.unders).toBe(2); // 20,10
    expect(r.pushes).toBe(0);
    expect(r.decided).toBe(5);
    expect(r.hitRateOver).toBeCloseTo(0.6, 10);
    expect(r.hitRateUnder).toBeCloseTo(0.4, 10);
    expect(r.mean).toBeCloseTo(22, 10); // 110/5
    expect(r.stdev).toBeCloseTo(Math.sqrt(46), 6); // ~6.7823
  });

  it('season window uses all games', () => {
    const r = computeHitRate(games, 'pts', 24.5, 'season');
    expect(r.games).toBe(6);
    expect(r.overs).toBe(4); // 30,25,25,40
    expect(r.unders).toBe(2); // 20,10
    expect(r.hitRateOver).toBeCloseTo(4 / 6, 10);
  });
});

describe('computeHitRate — pushes', () => {
  it('excludes pushes from the denominator but counts them in games + mean', () => {
    const r = computeHitRate(ptsGames([25, 25, 30, 20]), 'pts', 25, 'season');
    expect(r.overs).toBe(1); // 30
    expect(r.unders).toBe(1); // 20
    expect(r.pushes).toBe(2); // 25,25
    expect(r.decided).toBe(2);
    expect(r.games).toBe(4);
    expect(r.hitRateOver).toBeCloseTo(0.5, 10);
    expect(r.mean).toBeCloseTo(25, 10);
  });

  it('all pushes => no decided games => null hit rates', () => {
    const r = computeHitRate(ptsGames([10, 10]), 'pts', 10, 'season');
    expect(r.decided).toBe(0);
    expect(r.hitRateOver).toBeNull();
    expect(r.hitRateUnder).toBeNull();
    expect(r.mean).toBeCloseTo(10, 10);
    expect(r.stdev).toBeCloseTo(0, 10);
  });
});

describe('computeHitRate — edge cases', () => {
  it('fewer games than the window uses what exists', () => {
    const r = computeHitRate(ptsGames([30, 20, 10]), 'pts', 15, 5);
    expect(r.games).toBe(3);
    expect(r.overs).toBe(2);
    expect(r.unders).toBe(1);
  });

  it('no games => zeros and nulls', () => {
    const r = computeHitRate([], 'pts', 20, 5);
    expect(r.games).toBe(0);
    expect(r.values).toEqual([]);
    expect(r.overs).toBe(0);
    expect(r.decided).toBe(0);
    expect(r.hitRateOver).toBeNull();
    expect(r.mean).toBeNull();
    expect(r.stdev).toBeNull();
  });
});

describe('composite stats', () => {
  it('PRA sums points + rebounds + assists', () => {
    const g = line({ points: 20, rebounds: 8, assists: 7 });
    expect(statValue('pra', g)).toBe(35);
    expect(statValue('pr', g)).toBe(28);
    expect(statValue('pa', g)).toBe(27);
    expect(statValue('ra', g)).toBe(15);
  });

  it('stocks sums steals + blocks', () => {
    expect(statValue('stocks', line({ steals: 2, blocks: 3 }))).toBe(5);
  });

  it('computeHitRate works on a composite', () => {
    const games = [
      line({ points: 20, rebounds: 10, assists: 10 }), // PRA 40
      line({ points: 10, rebounds: 5, assists: 5 }), // PRA 20
    ];
    const r = computeHitRate(games, 'pra', 30, 'season');
    expect(r.overs).toBe(1);
    expect(r.unders).toBe(1);
  });
});

describe('computeHitRatesAllWindows', () => {
  it('returns L5/L10/L20/season keys', () => {
    const r = computeHitRatesAllWindows(ptsGames([30, 20, 25]), 'pts', 24.5);
    expect(Object.keys(r).sort()).toEqual(['10', '20', '5', 'season']);
    expect(r['season'].games).toBe(3);
    expect(r['5'].games).toBe(3);
  });
});
