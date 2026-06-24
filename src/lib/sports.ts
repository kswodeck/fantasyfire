// Multi-sport configuration. Sport keys are lowercase and used in URLs, the DB
// `sport` column, and API paths. Framework-agnostic (no React/Next imports).

export type Sport = 'nba' | 'mlb';

export const SPORT_LIST: Sport[] = ['nba', 'mlb'];

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
    accent: '#ea580c', // orange
  },
  mlb: {
    key: 'mlb',
    name: 'MLB',
    noun: 'players',
    tagline: 'Baseball player props — hits, home runs, RBIs, strikeouts and more.',
    accent: '#2563eb', // blue
  },
};

export function isSport(value: string | undefined | null): value is Sport {
  return value === 'nba' || value === 'mlb';
}

export function getSport(key: Sport): SportConfig {
  return SPORTS[key];
}
