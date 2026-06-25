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
    expect(matchStat('Mahomes 274.5 passing yards')).toBe('passYds');
    expect(matchStat('CMC 89.5 rushing yards')).toBe('rushYds');
    expect(matchStat('Jefferson 89.5 receiving yards')).toBe('recYds'); // combo before bare 'rec'
    expect(matchStat('Hill 6.5 receptions')).toBe('rec');
    expect(matchStat('Allen 1.5 passing touchdowns')).toBe('passTds');
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

  it('parses NFL lines (receiving yards resolves before receptions)', () => {
    const out = parseSlate(
      ['Patrick Mahomes 274.5 passing yards', 'Justin Jefferson over 89.5 receiving yards -110'].join('\n'),
    );
    expect(out[0]).toMatchObject({ name: 'Patrick Mahomes', stat: 'passYds', line: 274.5 });
    expect(out[1]).toMatchObject({ name: 'Justin Jefferson', stat: 'recYds', line: 89.5, odds: -110 });
  });

  it('records a missing stat/line rather than guessing', () => {
    const [e] = parseSlate('Mystery Player 30');
    expect(e.name).toBe('Mystery Player');
    expect(e.stat).toBeNull();
    expect(e.line).toBe(30);
  });
});
