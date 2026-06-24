import { describe, it, expect } from 'vitest';
import { splitHomeAway, splitByRest, computeSplits } from './splits';
import type { GameStatLine } from './types';

function g(points: number, isHome: boolean, gameDate: string): GameStatLine {
  return { points, isHome, gameDate };
}

describe('splitHomeAway', () => {
  const games = [
    g(20, true, '2026-01-10'),
    g(30, true, '2026-01-08'),
    g(10, true, '2026-01-06'),
    g(5, false, '2026-01-04'),
    g(25, false, '2026-01-02'),
  ];
  it('splits into home/away with correct counts and hit rates', () => {
    const [home, away] = splitHomeAway(games, 'pts', 15);
    expect(home.label).toBe('Home');
    expect(home.games).toBe(3);
    expect(home.hitRate.overs).toBe(2); // 20, 30 over 15; 10 under
    expect(away.games).toBe(2);
    expect(away.hitRate.overs).toBe(1); // 25 over; 5 under
    expect(home.confidence.badge).toBeDefined();
  });
  it('drops an empty side', () => {
    const homeOnly = splitHomeAway([g(20, true, '2026-01-10')], 'pts', 15);
    expect(homeOnly).toHaveLength(1);
    expect(homeOnly[0].key).toBe('home');
  });
});

describe('splitByRest', () => {
  // most-recent-first; gaps to the next-older game: 1d (b2b), 2d (r1), 4d (r3).
  const games = [
    g(20, true, '2026-01-10'), // rest = 1 -> b2b
    g(10, true, '2026-01-09'), // rest = 2 -> r1
    g(30, true, '2026-01-07'), // rest = 4 -> r3
    g(5, true, '2026-01-03'), // oldest -> excluded (no prior game)
  ];
  it('buckets games by days since the last game and excludes the oldest', () => {
    const splits = splitByRest(games, 'pts', 15);
    const byKey = Object.fromEntries(splits.map((s) => [s.key, s]));
    expect(Object.keys(byKey).sort()).toEqual(['b2b', 'r1', 'r3']); // r2 empty, dropped
    expect(byKey.b2b.games).toBe(1);
    expect(byKey.b2b.hitRate.overs).toBe(1); // 20 > 15
    expect(byKey.r1.hitRate.overs).toBe(0); // 10 < 15
    expect(byKey.r3.hitRate.overs).toBe(1); // 30 > 15
  });
});

describe('computeSplits', () => {
  it('returns both split families', () => {
    const s = computeSplits([g(20, true, '2026-01-10'), g(10, false, '2026-01-08')], 'pts', 15);
    expect(s.homeAway.length).toBe(2);
    expect(Array.isArray(s.rest)).toBe(true);
  });
});
