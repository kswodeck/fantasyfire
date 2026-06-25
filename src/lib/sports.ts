// Multi-sport configuration. Sport keys are lowercase and used in URLs, the DB
// `sport` column, and API paths. Framework-agnostic (no React/Next imports).

export type Sport = 'nba' | 'mlb' | 'nfl';

export const SPORT_LIST: Sport[] = ['nba', 'mlb', 'nfl'];

export interface SportConfig {
  key: Sport;
  /** Short label, e.g. "NBA". */
  name: string;
  /** The athletes' noun, e.g. "players". */
  noun: string;
  /** One-line description for the sport home / dashboard card. */
  tagline: string;
  /** Accent color for sport chrome (cards, headers). */
  accent: string;
}

export const SPORTS: Record<Sport, SportConfig> = {
  nba: {
    key: 'nba',
    name: 'NBA',
    noun: 'players',
    tagline: 'Basketball player props — points, rebounds, assists, threes and more.',
    accent: '#c2410c', // orange-700 — dark enough that white CTA text clears AA
  },
  mlb: {
    key: 'mlb',
    name: 'MLB',
    noun: 'players',
    tagline: 'Baseball player props — hits, home runs, RBIs, strikeouts and more.',
    accent: '#2563eb', // blue
  },
  nfl: {
    key: 'nfl',
    name: 'NFL',
    noun: 'players',
    tagline: 'Football player props — passing yards, rushing yards, receptions and more.',
    accent: '#047857', // emerald-700 — distinct from NBA/MLB, white CTA text clears AA
  },
};

export function isSport(value: string | undefined | null): value is Sport {
  return value === 'nba' || value === 'mlb' || value === 'nfl';
}

export function getSport(key: Sport): SportConfig {
  return SPORTS[key];
}
