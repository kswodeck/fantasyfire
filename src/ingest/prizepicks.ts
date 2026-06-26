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
// only odds_type "standard" (skip demon/goblin alt lines) for NBA/MLB/NFL.
import type { Sport } from '../lib/sports';
import type { StatKey } from '../lib/stats';
import type { ProvidedLineRow } from './providedTypes';
import { scrapeFetch } from './scrapeFetch';

const URL = 'https://partner-api.prizepicks.com/projections?per_page=25000';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
  Origin: 'https://app.prizepicks.com',
  Referer: 'https://app.prizepicks.com/',
};

const PP_LEAGUE: Record<string, Sport> = { NBA: 'nba', MLB: 'mlb', NFL: 'nfl' };

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
  },
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

export async function fetchPrizePicksLines(): Promise<ProvidedLineRow[]> {
  const res = await scrapeFetch(URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`PrizePicks HTTP ${res.status}`);
  const body = (await res.json()) as PpResponse;
  const players = new Map<string, PpResource>();
  for (const inc of body.included ?? []) if (inc.type === 'new_player') players.set(inc.id, inc);

  const out: ProvidedLineRow[] = [];
  for (const p of body.data ?? []) {
    const a = p.attributes;
    if (a.odds_type !== 'standard') continue; // skip demon/goblin alt lines
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
      overOdds: null, // PrizePicks standard lines are fixed-payout (no American odds)
      underOdds: null,
      gameDate: dateOnlyUtc(a.start_time),
    });
  }
  return out;
}
