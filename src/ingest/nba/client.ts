// src/ingest/nba/client.ts
//
// High-level client for the two endpoints the MVP needs. One nightly call to
// each fetches the entire league — no per-player rate-limit hell.
//
//   getPlayerIndex()   -> /playerindex   : all players + positions + team
//   getLeagueGameLog() -> /leaguegamelog : every player game line for the season
//
// Both use the same PLAYER_ID so they join cleanly. leaguegamelog returns the
// FULL season in a single response (there is no real pagination).

import {
  NBA_STATS_BASE_URL,
  RateLimiter,
  fetchNbaJson,
  type FetchOptions,
} from './http';
import {
  selectResultSet,
  rowsFromResultSet,
  assertColumns,
  toNum,
  toNumOrNull,
  toStr,
  toStrOrNull,
  parseMinutes,
} from './columnar';
import { parseMatchup } from './matchup';
import type { NbaStatsResponse, PlayerGameLogRow, PlayerIndexRow } from './types';

export interface NbaStatsClientOptions {
  /** Season string, e.g. "2025-26". */
  season: string;
  /** "Regular Season" | "Playoffs" | "Pre Season" (default "Regular Season"). */
  seasonType?: string;
  /** Minimum ms between requests (default 1200). */
  minIntervalMs?: number;
  /** Per-request fetch tuning (attempts/timeout/backoff). */
  fetchOptions?: FetchOptions;
}

// Column names we depend on. assertColumns() warns if any go missing.
const PLAYER_INDEX_COLUMNS = [
  'PERSON_ID',
  'PLAYER_FIRST_NAME',
  'PLAYER_LAST_NAME',
  'PLAYER_SLUG',
  'TEAM_ID',
  'TEAM_ABBREVIATION',
  'POSITION',
  'JERSEY_NUMBER',
  'HEIGHT',
  'WEIGHT',
  'COLLEGE',
  'COUNTRY',
  'DRAFT_YEAR',
  'DRAFT_ROUND',
  'DRAFT_NUMBER',
  'FROM_YEAR',
];

const LEAGUE_GAME_LOG_COLUMNS = [
  'SEASON_ID',
  'PLAYER_ID',
  'PLAYER_NAME',
  'TEAM_ID',
  'TEAM_ABBREVIATION',
  'GAME_ID',
  'GAME_DATE',
  'MATCHUP',
  'WL',
  'MIN',
  'FGM',
  'FGA',
  'FG3M',
  'FG3A',
  'FTM',
  'FTA',
  'OREB',
  'DREB',
  'REB',
  'AST',
  'STL',
  'BLK',
  'TOV',
  'PF',
  'PTS',
  'PLUS_MINUS',
];

export class NbaStatsClient {
  private readonly season: string;
  private readonly seasonType: string;
  private readonly limiter: RateLimiter;
  private readonly fetchOptions?: FetchOptions;

  constructor(opts: NbaStatsClientOptions) {
    this.season = opts.season;
    this.seasonType = opts.seasonType ?? 'Regular Season';
    this.limiter = new RateLimiter(opts.minIntervalMs ?? 1200);
    this.fetchOptions = opts.fetchOptions;
  }

  private url(endpoint: string, params: Record<string, string>): string {
    const qs = new URLSearchParams(params).toString();
    return `${NBA_STATS_BASE_URL}/${endpoint}?${qs}`;
  }

  private get<T = NbaStatsResponse>(
    endpoint: string,
    params: Record<string, string>
  ): Promise<T> {
    const url = this.url(endpoint, params);
    return this.limiter.schedule(() => fetchNbaJson<T>(url, this.fetchOptions));
  }

  /** All players for the season with positions + current team. One request. */
  async getPlayerIndex(): Promise<PlayerIndexRow[]> {
    const resp = await this.get('playerindex', {
      LeagueID: '00',
      Season: this.season,
      SeasonType: this.seasonType,
      Historical: '0',
      TeamID: '0',
      // These keys must be present even when empty, or the endpoint 400s.
      College: '',
      Country: '',
      DraftPick: '',
      DraftRound: '',
      DraftYear: '',
      Height: '',
      Weight: '',
    });

    const rs = selectResultSet(resp, 'PlayerIndex');
    assertColumns(rs, PLAYER_INDEX_COLUMNS, 'playerindex');

    return rowsFromResultSet(rs).map((r): PlayerIndexRow => {
      const firstName = toStr(r['PLAYER_FIRST_NAME']);
      const lastName = toStr(r['PLAYER_LAST_NAME']);
      const position = toStrOrNull(r['POSITION']);
      return {
        personId: toNum(r['PERSON_ID']),
        firstName,
        lastName,
        slug: toStrOrNull(r['PLAYER_SLUG']) ?? slugify(`${firstName} ${lastName}`),
        teamId: toNumOrNull(r['TEAM_ID']),
        teamAbbreviation: toStrOrNull(r['TEAM_ABBREVIATION']),
        position,
        posBucket: toPosBucket(position),
        jerseyNumber: toStrOrNull(r['JERSEY_NUMBER']),
        height: toStrOrNull(r['HEIGHT']),
        weight: toNumOrNull(r['WEIGHT']),
        college: toStrOrNull(r['COLLEGE']),
        country: toStrOrNull(r['COUNTRY']),
        draftYear: toNumOrNull(r['DRAFT_YEAR']),
        draftRound: toNumOrNull(r['DRAFT_ROUND']),
        draftNumber: toNumOrNull(r['DRAFT_NUMBER']),
        fromYear: toNumOrNull(r['FROM_YEAR']),
      };
    });
  }

  /** Every player's game-by-game box score for the season. One request. */
  async getLeagueGameLog(): Promise<PlayerGameLogRow[]> {
    const resp = await this.get('leaguegamelog', {
      LeagueID: '00',
      PlayerOrTeam: 'P',
      Season: this.season,
      SeasonType: this.seasonType,
      Counter: '1000',
      Direction: 'DESC',
      Sorter: 'DATE',
    });

    const rs = selectResultSet(resp, 'LeagueGameLog');
    assertColumns(rs, LEAGUE_GAME_LOG_COLUMNS, 'leaguegamelog');

    const out: PlayerGameLogRow[] = [];
    for (const r of rowsFromResultSet(rs)) {
      const matchupRaw = toStr(r['MATCHUP']);
      let parsed;
      try {
        parsed = parseMatchup(matchupRaw);
      } catch {
        console.warn(`[nba] skipping row with unparseable MATCHUP "${matchupRaw}"`);
        continue;
      }

      out.push({
        seasonId: toStr(r['SEASON_ID']),
        playerId: toNum(r['PLAYER_ID']),
        playerName: toStr(r['PLAYER_NAME']),
        teamId: toNum(r['TEAM_ID']),
        teamAbbreviation: toStr(r['TEAM_ABBREVIATION']),
        gameId: toStr(r['GAME_ID']), // keep zero-padded string
        gameDate: normalizeGameDate(toStr(r['GAME_DATE'])),
        opponentAbbreviation: parsed.opponentAbbreviation,
        isHome: parsed.isHome,
        wl: toStrOrNull(r['WL']),
        minutes: parseMinutes(r['MIN']),
        fgm: toNum(r['FGM']),
        fga: toNum(r['FGA']),
        fg3m: toNum(r['FG3M']),
        fg3a: toNum(r['FG3A']),
        ftm: toNum(r['FTM']),
        fta: toNum(r['FTA']),
        oreb: toNum(r['OREB']),
        dreb: toNum(r['DREB']),
        reb: toNum(r['REB']),
        ast: toNum(r['AST']),
        stl: toNum(r['STL']),
        blk: toNum(r['BLK']),
        tov: toNum(r['TOV']),
        pf: toNum(r['PF']),
        pts: toNum(r['PTS']),
        plusMinus: toNumOrNull(r['PLUS_MINUS']),
      });
    }
    return out;
  }
}

/** Coarse position bucket for DvP. Uses the PRIMARY listed position. */
export function toPosBucket(position: string | null): 'G' | 'F' | 'C' | null {
  if (!position) return null;
  const primary = position.toUpperCase().split(/[-/]/)[0].trim();
  if (primary.startsWith('G')) return 'G';
  if (primary.startsWith('F')) return 'F';
  if (primary.startsWith('C')) return 'C';
  // Fallback: scan the whole string (G > F > C).
  const p = position.toUpperCase();
  if (p.includes('G')) return 'G';
  if (p.includes('F')) return 'F';
  if (p.includes('C')) return 'C';
  return null;
}

/** URL-safe slug from a player name (strips accents). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** NBA GAME_DATE is usually "2025-12-07"; tolerate "DEC 07, 2025" too. */
function normalizeGameDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toISOString().slice(0, 10);
}
