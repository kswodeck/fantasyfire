import { describe, it, expect } from 'vitest';
import {
  tierSegmentOf,
  rowMatches,
  computeBreakdown,
  recordFor,
} from './accuracySegments';
import type { RecapRow } from './types';

function row(partial: Partial<RecapRow>): RecapRow {
  return {
    sport: 'nba',
    player: { fullName: 'Test Player', slug: 'test-player', teamAbbreviation: 'AAA' },
    stat: 'pts',
    statShort: 'PTS',
    line: 24.5,
    side: 'over',
    score: 60,
    tier: 'Lean',
    actual: 27,
    result: 'hit',
    ...partial,
  };
}

describe('tierSegmentOf', () => {
  it('maps tiers to strength segments (extreme/normal/slight)', () => {
    expect(tierSegmentOf('Strong lean')).toBe('extreme');
    expect(tierSegmentOf('Lean')).toBe('normal');
    expect(tierSegmentOf('Slight lean')).toBe('slight');
  });
  it('returns null for non-leans (never settled)', () => {
    expect(tierSegmentOf('No lean')).toBeNull();
    expect(tierSegmentOf('Pass')).toBeNull();
  });
});

describe('rowMatches', () => {
  const r = row({ tier: 'Strong lean', side: 'under' });
  it('all/both matches everything', () => {
    expect(rowMatches(r, 'all', 'both')).toBe(true);
  });
  it('filters by tier segment', () => {
    expect(rowMatches(r, 'extreme', 'both')).toBe(true);
    expect(rowMatches(r, 'normal', 'both')).toBe(false);
    expect(rowMatches(r, 'slight', 'both')).toBe(false);
  });
  it('filters by side', () => {
    expect(rowMatches(r, 'all', 'under')).toBe(true);
    expect(rowMatches(r, 'all', 'over')).toBe(false);
  });
  it('requires both conditions', () => {
    expect(rowMatches(r, 'extreme', 'under')).toBe(true);
    expect(rowMatches(r, 'extreme', 'over')).toBe(false);
  });
});

describe('computeBreakdown', () => {
  const rows: RecapRow[] = [
    row({ tier: 'Strong lean', side: 'over', result: 'hit' }),
    row({ tier: 'Strong lean', side: 'under', result: 'miss' }),
    row({ tier: 'Lean', side: 'over', result: 'hit' }),
    row({ tier: 'Lean', side: 'over', result: 'push' }),
    row({ tier: 'Slight lean', side: 'under', result: 'hit' }),
    row({ tier: 'Slight lean', side: 'under', result: 'miss' }),
  ];
  const b = computeBreakdown(rows);

  it('all/both tallies every row', () => {
    expect(b.all.both).toEqual({ hits: 3, misses: 2, pushes: 1 });
  });
  it('splits all by side', () => {
    expect(b.all.over).toEqual({ hits: 2, misses: 0, pushes: 1 });
    expect(b.all.under).toEqual({ hits: 1, misses: 2, pushes: 0 });
    // over + under sides sum to both
    const s = (k: 'hits' | 'misses' | 'pushes') => b.all.over[k] + b.all.under[k];
    expect([s('hits'), s('misses'), s('pushes')]).toEqual([3, 2, 1]);
  });
  it('records per tier segment', () => {
    expect(b.extreme.both).toEqual({ hits: 1, misses: 1, pushes: 0 });
    expect(b.normal.both).toEqual({ hits: 1, misses: 0, pushes: 1 });
    expect(b.slight.both).toEqual({ hits: 1, misses: 1, pushes: 0 });
  });
  it('records per tier × side', () => {
    expect(b.extreme.over).toEqual({ hits: 1, misses: 0, pushes: 0 });
    expect(b.extreme.under).toEqual({ hits: 0, misses: 1, pushes: 0 });
    expect(b.slight.under).toEqual({ hits: 1, misses: 1, pushes: 0 });
    expect(b.slight.over).toEqual({ hits: 0, misses: 0, pushes: 0 });
  });
  it('recordFor reads the right cell', () => {
    expect(recordFor(b, 'all', 'both')).toEqual(b.all.both);
    expect(recordFor(b, 'slight', 'under')).toEqual(b.slight.under);
  });
});
