import type { Sport } from './sports';
import type { StatKey } from './stats';

/**
 * The stats that get their own programmatic per-player prop page — the real
 * betting markets, not every box-score column (no /[player]/oreb or /fouls thin
 * pages). Niche stats remain reachable on the player page's stat selector.
 */
export const PROP_STATS: Record<Sport, StatKey[]> = {
  nba: ['pts', 'reb', 'ast', 'fg3m', 'pra', 'stl', 'blk', 'tov', 'fs'],
  wnba: ['pts', 'reb', 'ast', 'fg3m', 'pra', 'stl', 'blk', 'tov', 'fs'],
  mlb: ['hits', 'tb', 'hr', 'rbi', 'runs', 'sb', 'so', 'bb', 'hitterFs'],
  // The union of prop-page-worthy NFL markets. getPropStatParams intersects this
  // with a player's position keys, so a WR never gets a passing-yards page.
  nfl: ['passYds', 'passTds', 'passCmp', 'rushYds', 'carries', 'rushTds', 'rec', 'targets', 'recYds', 'recTds', 'fantasyScore'],
  // NHL: skater markets + goalie saves (intersected with the player's role keys,
  // so a goalie never gets a shots-on-goal page and vice versa).
  nhl: ['sog', 'pts', 'goals', 'ast', 'nhlHits', 'blocked', 'saves'],
  mls: ['shots', 'sot', 'goals', 'ast', 'saves'],
  // College mirrors the pro football/basketball markets (same shared keys).
  cfb: ['passYds', 'passTds', 'passCmp', 'rushYds', 'carries', 'rushTds', 'rec', 'recYds', 'recTds', 'fantasyScore'],
  cbb: ['pts', 'reb', 'ast', 'fg3m', 'pra', 'stl', 'blk', 'tov', 'fs'],
};

export function isPropStat(sport: Sport, stat: string): stat is StatKey {
  return (PROP_STATS[sport] as string[]).includes(stat);
}
