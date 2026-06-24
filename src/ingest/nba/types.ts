// src/ingest/nba/types.ts
//
// Shared types for the stats.nba.com client. These endpoints are UNOFFICIAL
// and can change without notice. The client maps columns by NAME (see
// columnar.ts), so column *reordering* by the NBA won't break anything — only
// renamed columns require updating the field maps in client.ts.

/** Raw columnar result set as returned by stats.nba.com. */
export interface NbaResultSet {
  name: string;
  headers: string[];
  rowSet: Array<Array<string | number | null>>;
}

/** Top-level stats.nba.com response. Most endpoints use `resultSets` (array);
 *  a few legacy ones use `resultSet` (singular). We handle both. */
export interface NbaStatsResponse {
  resource?: string;
  parameters?: Record<string, unknown>;
  resultSets?: NbaResultSet[];
  resultSet?: NbaResultSet;
}

/** A row after columnar flattening: header name -> value. */
export type NbaRow = Record<string, string | number | null>;

/** Normalized roster/index entry (from /playerindex). One per player. */
export interface PlayerIndexRow {
  personId: number;
  firstName: string;
  lastName: string;
  /** NBA-provided slug when present, otherwise generated from the name. */
  slug: string;
  teamId: number | null;
  teamAbbreviation: string | null;
  /** Raw position label, e.g. "G", "F-C", or null. */
  position: string | null;
  /** Coarse bucket for DvP grouping. */
  posBucket: 'G' | 'F' | 'C' | null;
  jerseyNumber: string | null;
  /** Listed height, e.g. "6-6" (feet-inches), or null. */
  height: string | null;
  /** Listed weight in pounds, or null. */
  weight: number | null;
}

/** Normalized single-game box score line (from /leaguegamelog, PlayerOrTeam=P). */
export interface PlayerGameLogRow {
  seasonId: string;
  playerId: number;
  playerName: string;
  teamId: number;
  teamAbbreviation: string;
  /** NBA GAME_ID — a zero-padded string (e.g. "0022500123"). Keep as a string. */
  gameId: string;
  /** ISO yyyy-mm-dd. */
  gameDate: string;
  opponentAbbreviation: string;
  isHome: boolean;
  wl: string | null;
  minutes: number | null;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  pts: number;
  plusMinus: number | null;
}
