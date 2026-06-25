// SportsGameOdds API client — pulls real player-prop lines (incl. the DFS pick'em
// books: PrizePicks / Underdog / Sleeper / DraftKings) so the app can show the
// number users actually see instead of our computed median line.
//
// SCAFFOLD / STUB: the statID → internal-stat map below is built from the API
// docs, but several spellings were not verifiable from docs alone (casing of
// multi-word stats). As a hedge we map BOTH snake_case and camelCase variants to
// the same internal key — and `scripts/check-sportsgameodds.ts` dumps the live
// statIDs/bookmakers so you can confirm coverage before flipping the feature on.
//
// Docs: https://sportsgameodds.com/docs  (auth: X-Api-Key header; base /v2)
// No DB or @/ imports here so it stays a pure, tsx-runnable client.
import type { Sport } from '../lib/sports';
import type { StatKey } from '../lib/stats';
import type { ProvidedLineRow } from './providedTypes';

export type { ProvidedLineRow } from './providedTypes';

const BASE = 'https://api.sportsgameodds.com/v2';

export const SGO_LEAGUE: Record<Sport, string> = { nba: 'NBA', mlb: 'MLB', nfl: 'NFL' };

/**
 * statID (SportsGameOdds) → our StatKey, scoped per sport (e.g. SGO reuses
 * `points` for NBA points and, per the MLB guide, for batter runs — so the maps
 * must be sport-scoped). Multiple spellings point to one key to absorb the
 * snake_case/camelCase ambiguity noted above. Verify/trim with the check script.
 */
export const SGO_STAT_MAP: Record<Sport, Record<string, StatKey>> = {
  nba: {
    points: 'pts',
    rebounds: 'reb',
    assists: 'ast',
    threePointersMade: 'fg3m',
    three_pointers_made: 'fg3m',
    'points+rebounds+assists': 'pra',
    steals: 'stl',
    blocks: 'blk',
    turnovers: 'tov',
  },
  mlb: {
    // Confirmed live against the API (2026-06-25 MLB slate).
    batting_hits: 'hits',
    batting_totalBases: 'tb',
    batting_homeRuns: 'hr',
    batting_RBI: 'rbi',
    points: 'runs', // SGO reuses `points` for a batter's Runs (MLB-scoped here)
    batting_stolenBases: 'sb',
    batting_basesOnBalls: 'bb', // walks
    batting_strikeouts: 'so',
    batting_doubles: 'doubles',
    'batting_hits+runs+rbi': 'hrr',
    pitching_strikeouts: 'k',
    pitching_earnedRuns: 'er',
    pitching_outs: 'outs',
    pitching_hits: 'ha', // hits allowed
    pitching_basesOnBalls: 'bba', // walks allowed
  },
  nfl: {
    passing_yards: 'passYds',
    passing_touchdowns: 'passTds',
    passing_completions: 'passCmp',
    passing_attempts: 'passAtt',
    passing_interceptions: 'ints',
    interceptions: 'ints',
    rushing_yards: 'rushYds',
    rushing_attempts: 'carries',
    rushing_touchdowns: 'rushTds',
    receiving_yards: 'recYds',
    receiving_touchdowns: 'recTds',
    receiving_receptions: 'rec',
    receptions: 'rec',
    receiving_targets: 'targets',
    targets: 'targets',
  },
};

// ---- Loosely-typed API shapes (only the fields we read) ----
interface SgoBook {
  odds?: string;
  overUnder?: string;
  available?: boolean;
}
interface SgoOdd {
  statID?: string;
  statEntityID?: string;
  periodID?: string;
  betTypeID?: string;
  sideID?: string;
  bookOverUnder?: string;
  byBookmaker?: Record<string, SgoBook>;
}
interface SgoPlayer {
  playerID?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}
interface SgoEvent {
  status?: { startsAt?: string };
  odds?: Record<string, SgoOdd>;
  players?: Record<string, SgoPlayer>;
}
interface SgoEventsResponse {
  success?: boolean;
  nextCursor?: string | null;
  data?: SgoEvent[];
}

function americanToInt(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s.replace('+', ''), 10);
  return Number.isFinite(n) ? n : null;
}

function dateOnlyUtc(iso: string | undefined): Date {
  const d = iso ? new Date(iso) : new Date();
  const valid = Number.isNaN(d.getTime()) ? new Date() : d;
  return new Date(Date.UTC(valid.getUTCFullYear(), valid.getUTCMonth(), valid.getUTCDate()));
}

async function getJson(path: string, apiKey: string): Promise<SgoEventsResponse> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
  });
  if (res.status === 429) throw new Error('SportsGameOdds rate limit (HTTP 429) — slow down.');
  if (!res.ok) throw new Error(`SportsGameOdds HTTP ${res.status} for ${path}`);
  return (await res.json()) as SgoEventsResponse;
}

/**
 * Fetch player-prop over/under lines for one sport, restricted to the given
 * bookmakers. Paginates via cursor. Best-effort parsing — anything it can't read
 * is skipped, not guessed. Throttle the caller to ≤10 req/min on the free tier.
 */
export async function fetchProvidedLines(
  sport: Sport,
  bookmakerIds: string[],
  apiKey: string,
  opts: { maxPages?: number } = {},
): Promise<ProvidedLineRow[]> {
  const { maxPages = 5 } = opts;
  const league = SGO_LEAGUE[sport];
  const statMap = SGO_STAT_MAP[sport];
  const books = bookmakerIds.join(',');
  const out: ProvidedLineRow[] = [];

  let cursor: string | null | undefined;
  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams({
      leagueID: league,
      oddsAvailable: 'true',
      bookmakerID: books,
      limit: '50',
    });
    if (cursor) qs.set('cursor', cursor);
    const body = await getJson(`/events?${qs.toString()}`, apiKey);
    const events = body.data ?? [];

    for (const ev of events) {
      const gameDate = dateOnlyUtc(ev.status?.startsAt);
      const players = ev.players ?? {};
      for (const odd of Object.values(ev.odds ?? {})) {
        // Only player game-long over/under markets; take the OVER row (the line
        // value is shared with its under twin).
        if (odd.periodID !== 'game' || odd.betTypeID !== 'ou' || odd.sideID !== 'over') continue;
        const stat = odd.statID ? statMap[odd.statID] : undefined;
        if (!stat) continue;
        const entity = odd.statEntityID;
        if (!entity) continue;
        const player = players[entity];
        if (!player) continue; // team/"all" entity, or unknown — skip
        const name = (player.name ?? `${player.firstName ?? ''} ${player.lastName ?? ''}`).trim();
        if (!name) continue;

        for (const [bookId, book] of Object.entries(odd.byBookmaker ?? {})) {
          if (!bookmakerIds.includes(bookId)) continue;
          if (book.available === false) continue;
          const lineStr = book.overUnder ?? odd.bookOverUnder;
          const line = lineStr != null ? parseFloat(lineStr) : NaN;
          if (!Number.isFinite(line)) continue;
          out.push({
            sport,
            source: bookId,
            externalPlayerId: entity,
            externalPlayerName: name,
            stat,
            line,
            overOdds: americanToInt(book.odds),
            underOdds: null, // DFS pick'em are fixed-payout; under price rarely posted
            gameDate,
          });
        }
      }
    }

    cursor = body.nextCursor;
    if (!cursor) break;
  }

  return out;
}
