// Underdog Fantasy line ingest — UNOFFICIAL public endpoint
// (api.underdogfantasy.com/beta/v5/over_under_lines).
//
// ⚠️ Not an official/contracted API: no SLA, ToS gray area, can change or IP-block.
// All failures are non-fatal upstream; the app falls back to its computed line.
// Source id: "underdog".
//
// Shape: { over_under_lines[], appearances[], players[], … }. A line carries
// `stat_value` (the number), `line_type` (balanced|alternate), `over_under.
// appearance_stat.{stat, appearance_id}`, and `options[]` ({choice: higher|lower,
// american_price, payout_multiplier}). Resolve the player via appearance_id →
// appearances → players (with sport_id). We keep balanced (1.0×) AND alternate
// (numeric payout_multiplier) player_prop lines for NBA/MLB/NFL.
import type { Sport } from '../lib/sports';
import type { StatKey } from '../lib/stats';
import type { ProvidedLineRow } from './providedTypes';
import { scrapeFetch } from './scrapeFetch';

const BASE = 'https://api.underdogfantasy.com/beta/v5/over_under_lines';
// One filtered request per sport (vs the full ~10 MB feed) — cheaper proxy bandwidth.
// Every sport we can map (UD_SPORT + the stat tables below) — WNBA was missing
// here for weeks, so Underdog silently never had WNBA lines despite full stat
// mappings. Off-season ids just return empty payloads (one cheap request each).
const UD_SPORT_IDS = ['NBA', 'MLB', 'NFL', 'WNBA', 'NHL'] as const;
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
  Origin: 'https://underdogfantasy.com',
  Referer: 'https://underdogfantasy.com/',
};

const UD_SPORT: Record<string, Sport> = { NBA: 'nba', MLB: 'mlb', NFL: 'nfl', WNBA: 'wnba', NHL: 'nhl', CFB: 'cfb', CBB: 'cbb' };

/** line_type values we ingest: the standard balanced line + numeric alternates. */
const UD_LINE_TYPES = new Set(['balanced', 'alternate']);

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
  // WNBA shares the NBA machine names (best-guess — verify in season).
  wnba: {
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
  // Best-guess NHL machine names (off-season) — verify in season.
  nhl: {
    shots: 'sog',
    shots_on_goal: 'sog',
    points: 'pts',
    goals: 'goals',
    assists: 'ast',
    hits: 'nhlHits',
    blocked_shots: 'blocked',
    faceoffs_won: 'fow',
    saves: 'saves',
    goals_against: 'ga',
  },
  // Underdog mixes soccer competitions in one feed — not ingested for MLS.
  mls: {},
  // College mirrors the pro machine names (best-guess — verify in season).
  cfb: {
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
  cbb: {
    points: 'pts',
    rebounds: 'reb',
    assists: 'ast',
    three_pointers_made: 'fg3m',
    pts_rebs_asts: 'pra',
    steals: 'stl',
    blocks: 'blk',
    turnovers: 'tov',
  },
};

interface UdOption {
  choice?: string; // 'higher' | 'lower'
  american_price?: string;
  payout_multiplier?: string; // '1.0' balanced, e.g. '1.31' alternate
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

function parseUdBody(body: UdResponse, out: ProvidedLineRow[]): void {
  const appearances = new Map<string, UdAppearance>();
  for (const a of body.appearances ?? []) appearances.set(a.id, a);
  const players = new Map<string, UdPlayer>();
  for (const p of body.players ?? []) players.set(p.id, p);

  const gameDate = todayUtc(); // current slate; the recent-window lookup keys on the day
  for (const l of body.over_under_lines ?? []) {
    const ou = l.over_under;
    if (ou?.category !== 'player_prop') continue;
    // Keep the balanced (1.0×) line AND alternates (each carrying an exact
    // payout_multiplier, e.g. 1.31×). Skip other/promo line_types.
    const oddsType = typeof l.line_type === 'string' ? l.line_type : null;
    if (oddsType && !UD_LINE_TYPES.has(oddsType)) continue;
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
    // Alternates usually carry a single 'higher' option; take whichever exists.
    const priced = over ?? under ?? l.options?.[0];
    const multiplier = priced?.payout_multiplier != null ? parseFloat(priced.payout_multiplier) : null;
    out.push({
      sport,
      source: 'underdog',
      externalPlayerId: player.id,
      externalPlayerName: name,
      stat,
      line,
      overOdds: americanToInt(over?.american_price),
      underOdds: americanToInt(under?.american_price),
      oddsType, // "balanced" | "alternate"
      multiplier: Number.isFinite(multiplier as number) ? multiplier : null,
      gameDate,
    });
  }
}

export async function fetchUnderdogLines(): Promise<ProvidedLineRow[]> {
  const out: ProvidedLineRow[] = [];
  for (let i = 0; i < UD_SPORT_IDS.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1500)); // space requests to be polite
    const sportId = UD_SPORT_IDS[i];
    try {
      const res = await scrapeFetch(`${BASE}?sport_id=${sportId}`, { headers: HEADERS });
      if (!res.ok) throw new Error(`Underdog HTTP ${res.status} (${sportId})`);
      parseUdBody((await res.json()) as UdResponse, out);
    } catch (e) {
      console.warn(`[underdog] ${sportId} fetch failed: ${(e as Error).message}`);
    }
  }
  return out;
}
