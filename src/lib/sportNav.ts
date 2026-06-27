import type { Sport } from './sports';

export interface SportSection {
  label: string;
  seg: string;
  desc: string;
}

/**
 * The per-sport section pages — the single source shared by the header hover menu
 * (SportMenu), the in-page sub-nav (SportNav), and the mobile nav (MobileNav). `seg` is
 * the path segment under /[sport]; `desc` is the one-line hint shown in the dropdowns.
 *
 * Sport-aware so the Matchups hint reads "pitching allowed" only for MLB and "defense vs
 * position" for the others — the rest of the list is identical across sports.
 */
export function sportSections(sport: Sport): SportSection[] {
  return [
    { label: 'Heat Check', seg: 'board', desc: "Strongest reads + today's slate" },
    { label: 'Trends', seg: 'trends', desc: 'Form swings + current streaks' },
    { label: 'Leaders', seg: 'leaders', desc: 'Per-game stat leaders' },
    {
      label: 'Matchups',
      seg: 'matchups',
      desc: sport === 'mlb' ? 'Pitching allowed by team' : 'Defense vs position',
    },
    { label: 'Injuries', seg: 'injuries', desc: "Who's out, GTD + on the IL" },
    { label: 'Players', seg: 'players', desc: 'Browse + filter every player' },
  ];
}
