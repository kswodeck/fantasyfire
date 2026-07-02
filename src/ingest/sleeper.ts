// Sleeper Picks line ingest — UNOFFICIAL public endpoint
// (api.sleeper.app/lines/available), no auth.
//
// ⚠️ Not an official/contracted API: no SLA, ToS gray area, can change or IP-block.
// All failures are non-fatal upstream; the app falls back to its computed line.
// Source id: "sleeper".
//
// WHY A DIRECT SCRAPER (Sleeper also comes through RotoWire): RotoWire only gives the
// line number + American odds. Sleeper's own feed carries the exact PER-SIDE PAYOUT
// MULTIPLIER on every line — its whole pricing model. Sleeper posts ONE line per
// player+stat (no PrizePicks-style alternate ladder); instead each side (over/under)
// has its own decimal payout, e.g. over 1.62× / under 1.98×. We convert each side's
// multiplier to American odds and store them as over/under odds on a STANDARD line, so
// the de-vig market-consensus + market-implied-breakeven math treats Sleeper like any
// two-way book; the over multiplier is also kept in `multiplier` for the payout readout.
//
// Shape: an array of "lines", each with `sport`, `wager_type` (the stat), and an
// `options[]` array of sides, each { outcome: "over"|"under", outcome_value (the line),
// payout_multiplier }. Lines carry only `subject_id` (Sleeper's player id), so names are
// resolved from the once-per-sport bulk player map (api.sleeper.app/players/<sport>).
import type { Sport } from '../lib/sports';
import type { StatKey } from '../lib/stats';
import type { ProvidedLineRow } from './providedTypes';
import { scrapeFetch } from './scrapeFetch';

const LINES_URL = 'https://api.sleeper.app/lines/available';
const PLAYERS_URL = (sport: Sport) => `https://api.sleeper.app/players/${sport}`;
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
  Referer: 'https://sleeper.com/',
};

/** Sleeper `sport` string → our Sport (others — cs/golf/tennis/soccer — are ignored). */
const SLEEPER_SPORT: Record<string, Sport> = { nba: 'nba', mlb: 'mlb', nfl: 'nfl' };

/** Sleeper `wager_type` → our StatKey, scoped by sport. MLB is confirmed live; NBA/NFL
 *  names are best-guess (both off-season as of mid-2026) — verify in season. Unmapped
 *  wager types (singles, first_inning_runs, fantasy score, …) are skipped. */
const SLEEPER_STAT_MAP: Record<Sport, Record<string, StatKey>> = {
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
    bat_walks: 'bb', // batter walks
    doubles: 'doubles',
    hits_runs_rbis: 'hrr',
    strike_outs: 'k', // pitcher strikeouts
    earned_runs: 'er',
    outs: 'outs',
    hits_allowed: 'ha',
    walks: 'bba', // pitcher walks allowed
  },
  nfl: {
    pass_yards: 'passYds',
    pass_tds: 'passTds',
    pass_completions: 'passCmp',
    pass_attempts: 'passAtt',
    pass_interceptions: 'ints',
    rush_yards: 'rushYds',
    rush_attempts: 'carries',
    rush_tds: 'rushTds',
    receiving_yards: 'recYds',
    receptions: 'rec',
    receiving_tds: 'recTds',
  },
};

interface SleeperOption {
  outcome?: string; // 'over' | 'under'
  outcome_value?: number | string;
  payout_multiplier?: number | string; // decimal payout for THIS side, e.g. "1.62"
}
interface SleeperLine {
  sport?: string;
  subject_id?: string;
  wager_type?: string;
  options?: SleeperOption[];
}
interface SleeperPlayer {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  metadata?: { full_name?: string };
}

function toNum(v: number | string | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Decimal payout (total return per 1 staked) → American odds. Sleeper's
 * payout_multiplier is a decimal price, so 1.62 → −161, 2.40 → +140. Returns null for
 * a non-positive/degenerate multiplier.
 */
function decimalToAmerican(mult: number | null): number | null {
  if (mult == null || mult <= 1) return null;
  return mult >= 2 ? Math.round((mult - 1) * 100) : -Math.round(100 / (mult - 1));
}

function todayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Bulk id→name map for a sport (one ~8 MB call), used to resolve each line's
 *  `subject_id`. Best-effort: a failure just means that sport's lines are dropped. */
async function playerNames(sport: Sport): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await scrapeFetch(PLAYERS_URL(sport), { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as Record<string, SleeperPlayer>;
    for (const [id, p] of Object.entries(body)) {
      const name =
        p.full_name ??
        p.metadata?.full_name ??
        `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
      if (name) map.set(id, name);
    }
  } catch (e) {
    console.warn(`[sleeper] player map (${sport}) failed: ${(e as Error).message}`);
  }
  return map;
}

export async function fetchSleeperLines(): Promise<ProvidedLineRow[]> {
  const out: ProvidedLineRow[] = [];
  let lines: SleeperLine[];
  try {
    const res = await scrapeFetch(LINES_URL, { headers: HEADERS });
    if (!res.ok) throw new Error(`Sleeper HTTP ${res.status}`);
    lines = (await res.json()) as SleeperLine[];
  } catch (e) {
    console.warn(`[sleeper] lines fetch failed: ${(e as Error).message}`);
    return out;
  }

  // Resolve names only for the sports that actually appear (skips the 8 MB fetch when a
  // league is off-season / absent from the feed).
  const sportsPresent = new Set<Sport>();
  for (const l of lines) {
    const sport = l.sport ? SLEEPER_SPORT[l.sport] : undefined;
    if (sport) sportsPresent.add(sport);
  }
  const names = new Map<Sport, Map<string, string>>();
  for (const sport of sportsPresent) names.set(sport, await playerNames(sport));

  const gameDate = todayUtc(); // current slate; the recent-window lookup keys on the day
  for (const l of lines) {
    const sport = l.sport ? SLEEPER_SPORT[l.sport] : undefined;
    if (!sport) continue;
    const stat = l.wager_type ? SLEEPER_STAT_MAP[sport][l.wager_type] : undefined;
    if (!stat) continue;
    const over = l.options?.find((o) => o.outcome === 'over');
    const under = l.options?.find((o) => o.outcome === 'under');
    const line = toNum((over ?? under ?? l.options?.[0])?.outcome_value);
    if (line == null) continue;
    const name = l.subject_id ? names.get(sport)?.get(l.subject_id) : undefined;
    if (!name) continue;
    const overMult = toNum(over?.payout_multiplier);
    out.push({
      sport,
      source: 'sleeper',
      externalPlayerId: l.subject_id ?? '',
      externalPlayerName: name,
      stat,
      line,
      // Per-side payouts are decimal prices → American, so the de-vig / market-implied
      // breakeven treats Sleeper as a two-way book.
      overOdds: decimalToAmerican(overMult),
      underOdds: decimalToAmerican(toNum(under?.payout_multiplier)),
      // Sleeper posts a single line per player+stat (no alternate ladder); the over
      // payout rides along for the payout-weighted readout.
      oddsType: 'standard',
      multiplier: overMult,
      gameDate,
    });
  }
  return out;
}
