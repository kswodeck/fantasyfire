// Underdog Fantasy line ingest — UNOFFICIAL public endpoint
// (api.underdogfantasy.com/beta/v5/over_under_lines).
//
// ⚠️ Not an official/contracted API: no SLA, ToS gray area, can change or IP-block.
// All failures are non-fatal upstream; the app falls back to its computed line.
// Source id: "underdog".
//
// Shape: { over_under_lines[], appearances[], players[], … }. A line carries
// `stat_value` (the number), `over_under.appearance_stat.{stat, appearance_id}`,
// and `options[]` ({choice: higher|lower, american_price}). Resolve the player via
// appearance_id → appearances → players (with sport_id). We keep "balanced" (non-
// boosted) player_prop lines for NBA/MLB/NFL.
import type { Sport } from '../lib/sports';
import type { StatKey } from '../lib/stats';
import type { ProvidedLineRow } from './providedTypes';

const URL = 'https://api.underdogfantasy.com/beta/v5/over_under_lines';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
  Origin: 'https://underdogfantasy.com',
  Referer: 'https://underdogfantasy.com/',
};

const UD_SPORT: Record<string, Sport> = { NBA: 'nba', MLB: 'mlb', NFL: 'nfl' };

/** Underdog machine stat name → our StatKey, scoped by sport.
 *  MLB confirmed live; NBA/NFL are best-guess (off-season) — verify in season. */
const UD_STAT_MAP: Record<Sport, Record<string, StatKey>> = {
  nba: {
    points: 'pts',
    rebounds: 'reb',
    assists: 'ast',
    three_pointers_made: 'fg3m',
    pts_rebs_asts: 'pra',
    pts_rebs: 'pr',
    pts_asts: 'pa',
    rebs_asts: 'ra',
    steals: 'stl',
    blocks: 'blk',
    steals_blocks: 'stocks',
    turnovers: 'tov',
  },
  mlb: {
    hits: 'hits',
    total_bases: 'tb',
    home_runs: 'hr',
    rbis: 'rbi',
    runs: 'runs',
    stolen_bases: 'sb',
    walks: 'bb',
    batter_strikeouts: 'so',
    hits_runs_rbis: 'hrr',
    doubles: 'doubles',
    strikeouts: 'k', // pitcher strikeouts
    pitch_outs: 'outs',
    hits_allowed: 'ha',
    walks_allowed: 'bba',
  },
  nfl: {
    passing_yards: 'passYds',
    passing_tds: 'passTds',
    completions: 'passCmp',
    pass_attempts: 'passAtt',
    interceptions: 'ints',
    rushing_yards: 'rushYds',
    rush_attempts: 'carries',
    rushing_tds: 'rushTds',
    receiving_yards: 'recYds',
    receptions: 'rec',
    receiving_tds: 'recTds',
  },
};

interface UdOption {
  choice?: string; // 'higher' | 'lower'
  american_price?: string;
}
interface UdLine {
  stat_value?: number | string;
  line_type?: string;
  options?: UdOption[];
  over_under?: {
    category?: string;
    appearance_stat?: { stat?: string; appearance_id?: string };
  };
}
interface UdAppearance {
  id: string;
  player_id?: string;
}
interface UdPlayer {
  id: string;
  first_name?: string;
  last_name?: string;
  sport_id?: string;
}
interface UdResponse {
  over_under_lines?: UdLine[];
  appearances?: UdAppearance[];
  players?: UdPlayer[];
}

function americanToInt(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s.replace('+', ''), 10);
  return Number.isFinite(n) ? n : null;
}

function todayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function fetchUnderdogLines(): Promise<ProvidedLineRow[]> {
  const res = await fetch(URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`Underdog HTTP ${res.status}`);
  const body = (await res.json()) as UdResponse;
  const appearances = new Map<string, UdAppearance>();
  for (const a of body.appearances ?? []) appearances.set(a.id, a);
  const players = new Map<string, UdPlayer>();
  for (const p of body.players ?? []) players.set(p.id, p);

  const gameDate = todayUtc(); // current slate; the recent-window lookup keys on the day
  const out: ProvidedLineRow[] = [];
  for (const l of body.over_under_lines ?? []) {
    const ou = l.over_under;
    if (ou?.category !== 'player_prop') continue;
    if (l.line_type && l.line_type !== 'balanced') continue; // skip boosted/insurance lines
    const appId = ou.appearance_stat?.appearance_id;
    const appearance = appId ? appearances.get(appId) : undefined;
    const player = appearance?.player_id ? players.get(appearance.player_id) : undefined;
    if (!player) continue;
    const sport = UD_SPORT[String(player.sport_id)];
    if (!sport) continue;
    const stat = ou.appearance_stat?.stat ? UD_STAT_MAP[sport][ou.appearance_stat.stat] : undefined;
    if (!stat) continue;
    const line = typeof l.stat_value === 'number' ? l.stat_value : parseFloat(String(l.stat_value));
    if (!Number.isFinite(line)) continue;
    const name = `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim();
    if (!name) continue;
    const over = l.options?.find((o) => o.choice === 'higher');
    const under = l.options?.find((o) => o.choice === 'lower');
    out.push({
      sport,
      source: 'underdog',
      externalPlayerId: player.id,
      externalPlayerName: name,
      stat,
      line,
      overOdds: americanToInt(over?.american_price),
      underOdds: americanToInt(under?.american_price),
      gameDate,
    });
  }
  return out;
}
