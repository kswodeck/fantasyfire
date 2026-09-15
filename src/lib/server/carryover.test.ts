import { describe, it, expect } from 'vitest';
import {
  CARRYOVER_TARGET_GAMES,
  mergeCarryover,
  needsCarryover,
  qualifyGames,
} from './players';
import { FIREFACTOR_MIN_GAMES } from '@/lib/stats';
import type { PlayerGame } from '@/lib/types';

/** An NFL receiver's game. `targets` is the opportunity signal qualifyGames filters on. */
function wrGame(date: string, targets: number, recYards = 60): PlayerGame {
  return {
    gameDate: date,
    opponentTeamId: 1,
    opponentAbbreviation: 'OPP',
    opponentExternalId: 1,
    isHome: true,
    wl: 'W',
    plusMinus: null,
    targets,
    receptions: Math.max(0, Math.round(targets * 0.6)),
    recYards,
  };
}

/** N games ending the day before `before`, newest first — a stand-in for a season. */
function season(count: number, startDay: number, targets = 8): PlayerGame[] {
  return Array.from({ length: count }, (_, i) =>
    wrGame(`2025-${String(startDay - i).padStart(2, '0')}-01`.slice(0, 10), targets),
  );
}

describe('needsCarryover', () => {
  it('flags the opening weeks of a season, when nobody can clear the games gate', () => {
    // Week 1: one game played. This is the state that blanked the whole NFL board —
    // every player fell short of FIREFACTOR_MIN_GAMES, so every row was dropped.
    expect(needsCarryover('nfl', 'WR', [wrGame('2026-09-11', 9)])).toBe(true);
    // A team that has not kicked off yet has no log at all.
    expect(needsCarryover('nfl', 'WR', [])).toBe(true);
  });

  it('leaves a player alone once the current season can carry the read by itself', () => {
    const played = Array.from({ length: FIREFACTOR_MIN_GAMES }, (_, i) =>
      wrGame(`2026-09-${11 + i}`, 8),
    );
    expect(needsCarryover('nfl', 'WR', played)).toBe(false);
  });

  it('asks the same question computeBoardRows asks — AFTER the opportunity filter', () => {
    // Six games, but four were cameos (1 target against a ~8-target norm). Only two
    // survive qualifyGames, so a raw length check would wrongly call this player ready.
    const games = [
      wrGame('2026-10-10', 9),
      wrGame('2026-10-03', 10),
      wrGame('2026-09-26', 1),
      wrGame('2026-09-19', 1),
      wrGame('2026-09-12', 1),
      wrGame('2026-09-05', 1),
    ];
    expect(games.length).toBeGreaterThanOrEqual(FIREFACTOR_MIN_GAMES);
    expect(qualifyGames('nfl', 'WR', games).length).toBeLessThan(FIREFACTOR_MIN_GAMES);
    expect(needsCarryover('nfl', 'WR', games)).toBe(true);
  });
});

describe('mergeCarryover', () => {
  it('fills the recent-form window from last season, newest first', () => {
    const current = [wrGame('2026-09-11', 9)];
    // A 17-game NFL season is all there is to draw on, so the window lands at 18
    // rather than the 20 target — take what exists instead of reaching further back.
    const prior = season(17, 20);
    const { games, carried } = mergeCarryover(current, prior);

    expect(games).toHaveLength(18);
    expect(carried).toBe(17);
    // This season's game stays at the front, so FIREFACTOR_WINDOW_RECENCY weights it
    // heaviest and the carryover sits in the lighter buckets behind it.
    expect(games[0]).toBe(current[0]);
    expect(games[1]).toBe(prior[0]);
  });

  it('caps at the window even when last season has far more to give (NBA/NHL)', () => {
    const current = [wrGame('2026-10-22', 9)];
    const prior = Array.from({ length: 82 }, (_, i) => wrGame(`2026-04-${i + 1}`, 8));
    const { games, carried } = mergeCarryover(current, prior);
    expect(games).toHaveLength(CARRYOVER_TARGET_GAMES);
    expect(carried).toBe(CARRYOVER_TARGET_GAMES - 1);
  });

  it('takes only what the window is short, never a full extra season', () => {
    const current = Array.from({ length: 18 }, (_, i) => wrGame(`2026-10-${i + 1}`, 8));
    const { games, carried } = mergeCarryover(current, season(17, 20));
    expect(carried).toBe(CARRYOVER_TARGET_GAMES - 18);
    expect(games).toHaveLength(CARRYOVER_TARGET_GAMES);
  });

  it('is a no-op once the window is already full, so mid-season reads are untouched', () => {
    const current = Array.from({ length: CARRYOVER_TARGET_GAMES }, (_, i) =>
      wrGame(`2026-11-${String(i + 1).padStart(2, '0')}`, 8),
    );
    const { games, carried } = mergeCarryover(current, season(17, 20));
    expect(carried).toBe(0);
    expect(games).toBe(current); // same reference — nothing was rebuilt
  });

  it('is a no-op for a rookie with no prior season to draw on', () => {
    const current = [wrGame('2026-09-11', 9)];
    const { games, carried } = mergeCarryover(current, []);
    expect(carried).toBe(0);
    expect(games).toBe(current);
  });
});

describe('the season-rollover cliff this fixes', () => {
  it('turns a Week 1 log that the board would drop into one it can grade', () => {
    const weekOne = [wrGame('2026-09-11', 9)];
    // Before: the board's gate rejects this player outright — the empty NFL board.
    expect(qualifyGames('nfl', 'WR', weekOne).length).toBeLessThan(FIREFACTOR_MIN_GAMES);

    const { games } = mergeCarryover(weekOne, season(17, 20));
    // After: a full window, so the row is computed instead of skipped.
    expect(qualifyGames('nfl', 'WR', games).length).toBeGreaterThanOrEqual(
      FIREFACTOR_MIN_GAMES,
    );
  });
});
