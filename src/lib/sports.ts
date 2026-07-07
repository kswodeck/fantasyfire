// Multi-sport configuration. Sport keys are lowercase and used in URLs, the DB
// `sport` column, and API paths. Framework-agnostic (no React/Next imports).

export type Sport = 'nba' | 'mlb' | 'nfl' | 'nhl' | 'wnba' | 'mls' | 'cfb' | 'cbb';

export const SPORT_LIST: Sport[] = ['nba', 'mlb', 'nfl', 'nhl', 'wnba', 'mls', 'cfb', 'cbb'];

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
  /** Lighter accent for text on dark surfaces — the 700-level `accent` values
   *  fall under 4.5:1 on the near-black theme, so text uses light-dark(accent, accentDark). */
  accentDark: string;
}

export const SPORTS: Record<Sport, SportConfig> = {
  nba: {
    key: 'nba',
    name: 'NBA',
    noun: 'players',
    tagline: 'Basketball player props — points, rebounds, assists, threes and more.',
    accent: '#c2410c', // orange-700 — dark enough that white CTA text clears AA
    accentDark: '#fb923c', // orange-400 — AA as text on the dark surfaces
  },
  mlb: {
    key: 'mlb',
    name: 'MLB',
    noun: 'players',
    tagline: 'Baseball player props — hits, home runs, RBIs, strikeouts and more.',
    accent: '#2563eb', // blue
    accentDark: '#60a5fa', // blue-400 — AA as text on the dark surfaces
  },
  nfl: {
    key: 'nfl',
    name: 'NFL',
    noun: 'players',
    tagline: 'Football player props — passing yards, rushing yards, receptions and more.',
    accent: '#047857', // emerald-700 — distinct from NBA/MLB, white CTA text clears AA
    accentDark: '#34d399', // emerald-400 — AA as text on the dark surfaces
  },
  nhl: {
    key: 'nhl',
    name: 'NHL',
    noun: 'players',
    tagline: 'Hockey player props — shots on goal, points, goals, assists and saves.',
    accent: '#0e7490', // cyan-700 — white CTA text clears AA
    accentDark: '#22d3ee', // cyan-400 — AA as text on the dark surfaces
  },
  wnba: {
    key: 'wnba',
    name: 'WNBA',
    noun: 'players',
    tagline: 'Basketball player props — points, rebounds, assists, threes and more.',
    accent: '#be185d', // pink-700 — white CTA text clears AA
    accentDark: '#f472b6', // pink-400 — AA as text on the dark surfaces
  },
  mls: {
    key: 'mls',
    name: 'MLS',
    noun: 'players',
    tagline: 'Soccer player props — shots, shots on target, goals and keeper saves.',
    accent: '#b91c1c', // red-700 — white CTA text clears AA
    accentDark: '#f87171', // red-400 — AA as text on the dark surfaces
  },
  cfb: {
    key: 'cfb',
    name: 'CFB',
    noun: 'players',
    tagline: 'College football player props — passing, rushing and receiving yards and more.',
    accent: '#b45309', // amber-700 — white CTA text clears AA
    accentDark: '#fbbf24', // amber-400 — AA as text on the dark surfaces
  },
  cbb: {
    key: 'cbb',
    name: 'CBB',
    noun: 'players',
    tagline: "Men's college basketball player props — points, rebounds, assists and more.",
    accent: '#4338ca', // indigo-700 — white CTA text clears AA
    accentDark: '#818cf8', // indigo-400 — AA as text on the dark surfaces
  },
};

export function isSport(value: string | undefined | null): value is Sport {
  return typeof value === 'string' && (SPORT_LIST as string[]).includes(value);
}

export function getSport(key: Sport): SportConfig {
  return SPORTS[key];
}
