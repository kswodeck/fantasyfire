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
};

export function isSport(value: string | undefined | null): value is Sport {
  return value === 'nba' || value === 'mlb' || value === 'nfl';
}

export function getSport(key: Sport): SportConfig {
  return SPORTS[key];
}
