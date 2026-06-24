import { describe, it, expect } from 'vitest';
import { parseSlate, matchStat, normalizeName } from './slate';

describe('matchStat', () => {
  it('maps common aliases to stat keys', () => {
    expect(matchStat('LeBron James 25.5 points')).toBe('pts');
    expect(matchStat('Luka 8.5 assists')).toBe('ast');
    expect(matchStat('Maxey 4.5 threes')).toBe('fg3m');
    expect(matchStat('Jokic 45.5 PRA')).toBe('pra');
    expect(matchStat('Judge total bases 1.5')).toBe('tb');
    expect(matchStat('Acuna 2.5 home runs')).toBe('hr');
  });
  it('returns null when no stat is present', () => {
    expect(matchStat('Some Player 25.5')).toBeNull();
  });
});

describe('normalizeName', () => {
  it('folds accents and lowercases', () => {
    expect(normalizeName('Luka Dončić')).toBe('luka doncic');
    expect(normalizeName('  Nikola  Jokić ')).toBe('nikola jokic');
  });
});

describe('parseSlate', () => {
  it('parses name / stat / line / odds from varied formats', () => {
    const out = parseSlate(
      [
        'LeBron James 25.5 Points',
        'Luka Doncic Over 8.5 Assists -115',
        'Maxey 4.5 threes',
        '   ', // blank -> dropped
      ].join('\n'),
    );
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ name: 'LeBron James', stat: 'pts', line: 25.5, odds: null });
    expect(out[1]).toMatchObject({ name: 'Luka Doncic', stat: 'ast', line: 8.5, odds: -115 });
    expect(out[2]).toMatchObject({ name: 'Maxey', stat: 'fg3m', line: 4.5 });
  });

  it('keeps the line and drops the odds value from the line detection', () => {
    const [e] = parseSlate('Aaron Judge total bases 1.5 -120');
    expect(e.name).toBe('Aaron Judge');
    expect(e.stat).toBe('tb');
    expect(e.line).toBe(1.5);
    expect(e.odds).toBe(-120);
  });

  it('records a missing stat/line rather than guessing', () => {
    const [e] = parseSlate('Mystery Player 30');
    expect(e.name).toBe('Mystery Player');
    expect(e.stat).toBeNull();
    expect(e.line).toBe(30);
  });
});
