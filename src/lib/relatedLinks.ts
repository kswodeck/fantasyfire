import { SPORTS, type Sport } from './sports';

/**
 * Cross-links between a sport's research surfaces — the internal-link mesh that
 * keeps every page reachable (no orphans). `excludeSeg` drops the current page.
 */
export function sportMeshLinks(
  sport: Sport,
  excludeSeg?: string,
): { label: string; href: string; hint?: string }[] {
  const name = SPORTS[sport].name;
  const leadersStat = sport === 'mlb' ? 'hits' : sport === 'nfl' ? 'passYds' : 'pts';
  const items: { seg: string; label: string; href: string; hint: string }[] = [
    { seg: 'board', label: `${name} Heat Check`, href: `/${sport}/board`, hint: "Strongest FireFactor reads + today's slate." },
    { seg: 'trends', label: `${name} Trends`, href: `/${sport}/trends`, hint: 'Form swings + current streaks vs the line.' },
    { seg: 'leaders', label: `${name} Leaders`, href: `/${sport}/leaders/${leadersStat}`, hint: 'Season per-game leaders by stat.' },
    {
      seg: 'matchups',
      label: sport === 'mlb' ? 'Pitching Allowed' : 'Defense vs Position',
      href: `/${sport}/matchups`,
      hint: 'Which teams give up the most of each stat.',
    },
    { seg: 'players', label: `All ${name} players`, href: `/${sport}/players`, hint: 'Browse and filter every player.' },
  ];
  return items
    .filter((i) => i.seg !== excludeSeg)
    .map((i) => ({ label: i.label, href: i.href, hint: i.hint }));
}
