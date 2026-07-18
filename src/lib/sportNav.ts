import type { Sport } from './sports';

/**
 * Display order for sport lists in the navigation — by mainstream US prop/pick'em
 * popularity (NFL first), NOT the registry's insertion order. Every sport in the
 * registry must appear exactly once (asserted by a unit test).
 */
export const NAV_SPORT_ORDER: readonly Sport[] = [
  'nfl',
  'nba',
  'mlb',
  'cfb',
  'cbb',
  'nhl',
  'wnba',
  'mls',
];

export interface SportSection {
  label: string;
  seg: string;
  desc: string;
}

/** Where a section lives: `/[sport]/[seg]`, except the Heat Check (seg ''), which IS
 *  the sport home — the old /[sport]/board URL permanently redirects there. */
export function sectionHref(sport: Sport, seg: string): string {
  return seg ? `/${sport}/${seg}` : `/${sport}`;
}

/**
 * The per-sport section pages — the single source shared by the header hover menu
 * (SportsMenu), the in-page sub-nav (SportNav), and the mobile nav (MobileNav). `seg` is
 * the path segment under /[sport] ('' = the sport home; build hrefs via sectionHref);
 * `desc` is the one-line hint shown in the dropdowns.
 *
 * Sport-aware so the Matchups hint reads "pitching allowed" only for MLB and "defense vs
 * position" for the others — the rest of the list is identical across sports.
 */
export function sportSections(sport: Sport): SportSection[] {
  return [
    { label: 'Heat Check', seg: '', desc: "Strongest reads + today's slate" },
    { label: 'Trends', seg: 'trends', desc: 'Form swings + current streaks' },
    { label: 'Injuries', seg: 'injuries', desc: "Who's out, GTD + on the IL" },
    { label: 'Players', seg: 'players', desc: 'Browse + filter every player' },
    { label: 'Leaders', seg: 'leaders', desc: 'Per-game stat leaders' },
    {
      label: 'Matchups',
      seg: 'matchups',
      desc: sport === 'mlb' ? 'Pitching allowed by team' : 'Defense vs position',
    },
    { label: 'Accuracy', seg: 'accuracy', desc: 'How past leans settled, day by day' },
  ];
}
