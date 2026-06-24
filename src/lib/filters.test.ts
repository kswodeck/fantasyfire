import { describe, it, expect } from 'vitest';
import { positionFilterOptions, playerMatchesPosition, teamFilterOptions } from './filters';

describe('positionFilterOptions', () => {
  it('returns G/F/C for NBA', () => {
    expect(positionFilterOptions('nba').map((o) => o.value)).toEqual(['G', 'F', 'C']);
  });
  it('returns fielding buckets for MLB', () => {
    expect(positionFilterOptions('mlb').map((o) => o.value)).toEqual(['P', 'C', 'IF', 'OF', 'DH']);
  });
});

describe('playerMatchesPosition — NBA (inclusive of dual positions)', () => {
  it('empty category matches everyone', () => {
    expect(playerMatchesPosition('nba', '', 'G', 'G')).toBe(true);
  });
  it('a G-F matches both Guards and Forwards but not Centers', () => {
    expect(playerMatchesPosition('nba', 'G', 'G-F', 'G')).toBe(true);
    expect(playerMatchesPosition('nba', 'F', 'G-F', 'G')).toBe(true);
    expect(playerMatchesPosition('nba', 'C', 'G-F', 'G')).toBe(false);
  });
  it('a F-C matches Forwards and Centers', () => {
    expect(playerMatchesPosition('nba', 'C', 'F-C', 'F')).toBe(true);
    expect(playerMatchesPosition('nba', 'F', 'F-C', 'F')).toBe(true);
    expect(playerMatchesPosition('nba', 'G', 'F-C', 'F')).toBe(false);
  });
  it('falls back to posBucket when position is null', () => {
    expect(playerMatchesPosition('nba', 'C', null, 'C')).toBe(true);
    expect(playerMatchesPosition('nba', 'G', null, 'C')).toBe(false);
  });
});

describe('playerMatchesPosition — MLB (exact abbreviation membership)', () => {
  it('Catcher matches C but NOT CF (no substring bug)', () => {
    expect(playerMatchesPosition('mlb', 'C', 'C', 'H')).toBe(true);
    expect(playerMatchesPosition('mlb', 'C', 'CF', 'H')).toBe(false);
  });
  it('Outfield matches CF/LF/RF', () => {
    expect(playerMatchesPosition('mlb', 'OF', 'CF', 'H')).toBe(true);
    expect(playerMatchesPosition('mlb', 'OF', 'RF', 'H')).toBe(true);
  });
  it('Infield matches SS/1B/2B/3B but not OF', () => {
    expect(playerMatchesPosition('mlb', 'IF', 'SS', 'H')).toBe(true);
    expect(playerMatchesPosition('mlb', 'IF', '1B', 'H')).toBe(true);
    expect(playerMatchesPosition('mlb', 'IF', 'RF', 'H')).toBe(false);
  });
  it('Pitcher matches P, TWP, or posBucket P', () => {
    expect(playerMatchesPosition('mlb', 'P', 'P', 'P')).toBe(true);
    expect(playerMatchesPosition('mlb', 'P', 'TWP', 'H')).toBe(true);
    expect(playerMatchesPosition('mlb', 'P', null, 'P')).toBe(true);
    expect(playerMatchesPosition('mlb', 'P', 'SS', 'H')).toBe(false);
  });
  it('DH matches only DH', () => {
    expect(playerMatchesPosition('mlb', 'DH', 'DH', 'H')).toBe(true);
    expect(playerMatchesPosition('mlb', 'DH', '1B', 'H')).toBe(false);
  });
});

describe('teamFilterOptions', () => {
  it('dedups, drops nulls, sorts by label', () => {
    const opts = teamFilterOptions('nba', ['LAL', 'BOS', null, 'LAL', undefined, 'GSW']);
    expect(opts.map((o) => o.value)).toEqual(['BOS', 'GSW', 'LAL']);
    expect(opts.find((o) => o.value === 'LAL')?.label).toContain('Lakers');
  });
  it('returns empty for an all-null dataset', () => {
    expect(teamFilterOptions('mlb', [null, undefined])).toEqual([]);
  });
});
