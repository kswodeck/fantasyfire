/**
 * The per-sport section pages — the single source shared by the header hover
 * menu (SportMenu) and the in-page sub-nav (SportNav). `seg` is the path segment
 * under /[sport]; `desc` is the one-line hint shown in the header dropdown.
 */
export const SPORT_SECTIONS: { label: string; seg: string; desc: string }[] = [
  { label: 'Top Leans', seg: 'board', desc: "Strongest leans + today's slate" },
  { label: 'Streaks', seg: 'streaks', desc: 'Longest current over/under runs' },
  { label: 'Trends', seg: 'trends', desc: 'Heating up vs the baseline' },
  { label: 'Leaders', seg: 'leaders', desc: 'Per-game stat leaders' },
  { label: 'Matchups', seg: 'matchups', desc: 'Defense / pitching allowed' },
  { label: 'Players', seg: 'players', desc: 'Browse + filter every player' },
];
