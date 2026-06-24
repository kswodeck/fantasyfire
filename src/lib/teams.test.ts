import { describe, it, expect } from 'vitest';
import { getTeam, playerHeadshotUrl, teamLogoUrl, readableTextColor } from './teams';

// The exact 30 abbreviations present in our ingested data.
const DB_ABBRS = [
  'ATL', 'BKN', 'BOS', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
];

describe('getTeam', () => {
  it('covers every team in our dataset with id, name, city, colors', () => {
    for (const abbr of DB_ABBRS) {
      const t = getTeam(abbr);
      expect(t.abbr).toBe(abbr);
      expect(t.nbaId).toBeGreaterThan(1610612736);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.fullName).toBe(`${t.city} ${t.name}`);
      expect(t.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.secondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('builds full names correctly', () => {
    expect(getTeam('NYK').fullName).toBe('New York Knicks');
    expect(getTeam('LAL').fullName).toBe('Los Angeles Lakers');
  });

  it('returns a neutral fallback for unknown / null', () => {
    expect(getTeam(null).primary).toBe('#ea580c');
    expect(getTeam('ZZZ').abbr).toBe('ZZZ');
    expect(getTeam('ZZZ').nbaId).toBe(0);
  });
});

describe('image URLs', () => {
  it('headshot url by size', () => {
    expect(playerHeadshotUrl(2544)).toBe(
      'https://cdn.nba.com/headshots/nba/latest/260x190/2544.png',
    );
    expect(playerHeadshotUrl(2544, 'lg')).toContain('1040x760/2544.png');
  });
  it('logo url by team id', () => {
    expect(teamLogoUrl(getTeam('LAL').nbaId)).toBe(
      'https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg',
    );
  });
});

describe('readableTextColor', () => {
  it('dark text on light, white text on dark', () => {
    expect(readableTextColor('#FDB927')).toBe('#1c1917'); // gold -> dark
    expect(readableTextColor('#0E2240')).toBe('#ffffff'); // navy -> white
    expect(readableTextColor('#FFFFFF')).toBe('#1c1917');
    expect(readableTextColor('#000000')).toBe('#ffffff');
  });
});
