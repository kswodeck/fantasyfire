// PrizePicks line ingest — UNOFFICIAL public endpoint (partner-api.prizepicks.com).
//
// ⚠️ Not an official/contracted API: no SLA, ToS gray area, and it can change or
// IP-block (cloud IPs especially — like stats.nba.com, this may need to run off a
// datacenter IP). All failures are non-fatal upstream; the app falls back to its
// computed line. Source id: "prizepicks".
//
// Shape: JSON:API. `data[]` = projection { attributes:{ line_score, stat_type,
// odds_type, start_time }, relationships:{ new_player, league } }; `included[]` =
// new_player { attributes:{ display_name, league, combo } } + league + … We keep
// all payout variants — odds_type "standard" | "goblin" | "demon" — for
// NBA/MLB/NFL. Goblin = easier line/reduced payout, demon = harder/boosted. PP
// ships no numeric multiplier, so we store the label only.
import type { Sport } from '../lib/sports';
import type { StatKey } from '../lib/stats';
import type { ProvidedLineRow } from './providedTypes';
import { scrapeFetch } from './scrapeFetch';

const BASE = 'https://partner-api.prizepicks.com/projections';
// One filtered request per league shrinks the payload from ~15 MB (all leagues) to
// just the ones we use — cheaper proxy bandwidth + faster runs. IDs from /leagues.
// Partial: PP folds ALL soccer competitions into one SOCCER league, so EPL/MLS are
// deliberately absent — cross-league name matching would mis-attribute players.
const PP_LEAGUE_IDS: Partial<Record<Sport, number>> = { nba: 7, mlb: 2, nfl: 9, wnba: 3, nhl: 8 };
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
  Origin: 'https://app.prizepicks.com',
  Referer: 'https://app.prizepicks.com/',
};

const PP_LEAGUE: Record<string, Sport> = { NBA: 'nba', MLB: 'mlb', NFL: 'nfl', WNBA: 'wnba', NHL: 'nhl' };

/** Payout variants we ingest. Anything else (promos, flash sales) is skipped. */
const PP_ODDS_TYPES = new Set(['standard', 'goblin', 'demon']);

/** PrizePicks `stat_type` display string → our StatKey, scoped by sport. */
const PP_STAT_MAP: Record<Sport, Record<string, StatKey>> = {
  nba: {
    Points: 'pts',
    Rebounds: 'reb',
    Assists: 'ast',
    '3-PT Made': 'fg3m',
    'Pts+Rebs+Asts': 'pra',
    'Pts+Rebs': 'pr',
    'Pts+Asts': 'pa',
    'Rebs+Asts': 'ra',
    Steals: 'stl',
    'Blocked Shots': 'blk',
    'Blks+Stls': 'stocks',
    Turnovers: 'tov',
    'Offensive Rebounds': 'oreb',
    'Defensive Rebounds': 'dreb',
    // PrizePicks' own scoring — ONLY PrizePicks FS markets may map to the FS keys
    // (other books score fantasy differently; see the block in stats/types.ts).
    'Fantasy Score': 'fs',
  },
  mlb: {
    Hits: 'hits',
    'Total Bases': 'tb',
    'Home Runs': 'hr',
    RBIs: 'rbi',
    Runs: 'runs',
    'Stolen Bases': 'sb',
    Walks: 'bb',
    'Hitter Strikeouts': 'so',
    'Hits+Runs+RBIs': 'hrr',
    Doubles: 'doubles',
    'Pitcher Strikeouts': 'k',
    'Earned Runs Allowed': 'er',
    'Pitching Outs': 'outs',
    'Hits Allowed': 'ha',
    'Walks Allowed': 'bba',
    // Hitters only — Pitcher Fantasy Score stays unmapped (scored on the pitching
    // WIN, a decision our box scores don't carry, so history can't be computed).
    'Hitter Fantasy Score': 'hitterFs',
  },
  nfl: {
    'Pass Yards': 'passYds',
    'Pass TDs': 'passTds',
    'Pass Completions': 'passCmp',
    'Pass Attempts': 'passAtt',
    INT: 'ints',
    'Rush Yards': 'rushYds',
    'Rush Attempts': 'carries',
    'Rush TDs': 'rushTds',
    'Receiving Yards': 'recYds',
    Receptions: 'rec',
    'Receiving TDs': 'recTds',
    // PrizePicks' own scoring — see the NBA note above.
    'Fantasy Score': 'fantasyScore',
  },
  // WNBA uses the same market vocabulary (and PP fantasy scoring) as the NBA.
  wnba: {
    Points: 'pts',
    Rebounds: 'reb',
    Assists: 'ast',
    '3-PT Made': 'fg3m',
    'Pts+Rebs+Asts': 'pra',
    'Pts+Rebs': 'pr',
    'Pts+Asts': 'pa',
    'Rebs+Asts': 'ra',
    Steals: 'stl',
    'Blocked Shots': 'blk',
    'Blks+Stls': 'stocks',
    Turnovers: 'tov',
    'Offensive Rebounds': 'oreb',
    'Defensive Rebounds': 'dreb',
    'Fantasy Score': 'fs',
  },
  // Best-guess NHL market names (off-season as of mid-2026) — verify in season.
  // No Fantasy Score mapping: we don't compute an NHL FS (no verified scoring table).
  nhl: {
    'Shots On Goal': 'sog',
    Points: 'pts',
    Goals: 'goals',
    Assists: 'ast',
    Hits: 'nhlHits',
    'Blocked Shots': 'blocked',
    'Faceoffs Won': 'fow',
    'Goalie Saves': 'saves',
    Saves: 'saves',
    'Goals Against': 'ga',
  },
  // PP folds all soccer into one SOCCER league (see PP_LEAGUE_IDS) — not ingested.
  epl: {},
  mls: {},
};

interface PpResource {
  type: string;
  id: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, { data?: { type: string; id: string } | null }>;
}
interface PpResponse {
  data?: PpResource[];
  included?: PpResource[];
}

function dateOnlyUtc(iso: unknown): Date {
  const d = typeof iso === 'string' ? new Date(iso) : new Date();
  const v = Number.isNaN(d.getTime()) ? new Date() : d;
  return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
}

function parsePpBody(body: PpResponse, out: ProvidedLineRow[]): void {
  const players = new Map<string, PpResource>();
  for (const inc of body.included ?? []) if (inc.type === 'new_player') players.set(inc.id, inc);

  for (const p of body.data ?? []) {
    const a = p.attributes;
    // Keep all payout variants: "standard" | "goblin" (easier/reduced) | "demon"
    // (harder/boosted). PP ships no per-line multiplier — the label is all we get.
    const oddsType = typeof a.odds_type === 'string' ? a.odds_type : null;
    if (oddsType && !PP_ODDS_TYPES.has(oddsType)) continue; // skip unknown/promo variants
    const playerId = p.relationships?.new_player?.data?.id;
    const player = playerId ? players.get(playerId) : undefined;
    if (!player) continue;
    const pa = player.attributes;
    if (pa.combo === true) continue; // combo props reference a synthetic player
    const sport = PP_LEAGUE[String(pa.league)];
    if (!sport) continue;
    const stat = PP_STAT_MAP[sport][String(a.stat_type)];
    if (!stat) continue;
    const line = typeof a.line_score === 'number' ? a.line_score : parseFloat(String(a.line_score));
    if (!Number.isFinite(line)) continue;
    const name = String(pa.display_name ?? pa.name ?? '').trim();
    if (!name) continue;
    out.push({
      sport,
      source: 'prizepicks',
      externalPlayerId: playerId!,
      externalPlayerName: name,
      stat,
      line,
      overOdds: null, // PrizePicks lines are fixed-payout (no American odds)
      underOdds: null,
      oddsType, // "standard" | "goblin" | "demon"
      multiplier: null, // PP never exposes a numeric multiplier in the feed
      gameDate: dateOnlyUtc(a.start_time),
    });
  }
}

export async function fetchPrizePicksLines(): Promise<ProvidedLineRow[]> {
  const out: ProvidedLineRow[] = [];
  const leagueIds = Object.values(PP_LEAGUE_IDS);
  for (let i = 0; i < leagueIds.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1500)); // space requests — PP rate-limits bursts
    const leagueId = leagueIds[i];
    try {
      const res = await scrapeFetch(`${BASE}?league_id=${leagueId}&per_page=25000`, { headers: HEADERS });
      if (!res.ok) throw new Error(`PrizePicks HTTP ${res.status} (league ${leagueId})`);
      parsePpBody((await res.json()) as PpResponse, out);
    } catch (e) {
      console.warn(`[prizepicks] league ${leagueId} fetch failed: ${(e as Error).message}`);
    }
  }
  return out;
}
