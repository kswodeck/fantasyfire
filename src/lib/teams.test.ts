import { describe, it, expect } from 'vitest';
import { getTeam, playerHeadshotUrl, teamLogoUrl, readableTextColor } from './teams';

// The exact 30 abbreviations present in our ingested data, per sport.
const NBA_ABBRS = [
  'ATL', 'BKN', 'BOS', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
];
const MLB_ABBRS = [
  'ATH', 'ATL', 'AZ', 'BAL', 'BOS', 'CHC', 'CIN', 'CLE', 'COL', 'CWS',
  'DET', 'HOU', 'KC', 'LAA', 'LAD', 'MIA', 'MIL', 'MIN', 'NYM', 'NYY',
  'PHI', 'PIT', 'SD', 'SEA', 'SF', 'STL', 'TB', 'TEX', 'TOR', 'WSH',
];

describe('getTeam', () => {
  it('covers every NBA team with name, city, colors', () => {
    for (const abbr of NBA_ABBRS) {
      const t = getTeam('nba', abbr);
      expect(t.abbr).toBe(abbr);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.fullName).toBe(`${t.city} ${t.name}`);
      expect(t.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.secondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('covers every MLB team with name and colors', () => {
    for (const abbr of MLB_ABBRS) {
      const t = getTeam('mlb', abbr);
      expect(t.abbr).toBe(abbr);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.secondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('builds full names correctly', () => {
    expect(getTeam('nba', 'NYK').fullName).toBe('New York Knicks');
    expect(getTeam('mlb', 'NYY').fullName).toBe('New York Yankees');
  });

  it('returns a neutral fallback for unknown / null', () => {
    expect(getTeam('nba', null).primary).toBe('#ea580c');
    expect(getTeam('mlb', 'ZZZ').abbr).toBe('ZZZ');
  });
});

describe('image URLs', () => {
  it('NBA headshot url by size', () => {
    expect(playerHeadshotUrl('nba', 2544)).toBe(
      'https://cdn.nba.com/headshots/nba/latest/260x190/2544.png',
    );
    expect(playerHeadshotUrl('nba', 2544, 'lg')).toContain('1040x760/2544.png');
  });
  it('MLB headshot url by size', () => {
    expect(playerHeadshotUrl('mlb', 592450)).toBe(
      'https://midfield.mlbstatic.com/v1/people/592450/spots/120',
    );
    expect(playerHeadshotUrl('mlb', 592450, 'lg')).toContain('/spots/240');
  });
  it('logo url by team id', () => {
    expect(teamLogoUrl('nba', 1610612747)).toBe(
      'https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg',
    );
    expect(teamLogoUrl('mlb', 147)).toBe('https://www.mlbstatic.com/team-logos/147.svg');
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
