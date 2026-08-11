// Sleeper Picks line ingest — UNOFFICIAL public endpoints (api.sleeper.app/lines/*),
// no auth.
//
// ⚠️ Not an official/contracted API: no SLA, ToS gray area, can change or IP-block.
// All failures are non-fatal upstream; the app falls back to its computed line.
// Source id: "sleeper".
//
// WHY A DIRECT SCRAPER (Sleeper also comes through RotoWire): RotoWire only gives the
// line number + American odds. Sleeper's own feeds carry the exact PAYOUT MULTIPLIERS —
// its whole pricing model — for BOTH the standard line (per-side over/under payouts,
// e.g. over 1.62× / under 1.98×; stored as American odds so the de-vig consensus +
// market-implied breakevens treat Sleeper as a two-way book, with the leaned side's
// payout shown) AND a full Underdog-style ALTERNATE ladder (over-only rungs at
// different lines, each with its own multiplier → 0.5/multiplier breakeven).
//
// Two feeds, both no-auth:
//   • /lines/available      — the STANDARD line per player+stat (line_type "normal"):
//     one line, over/under priced separately.
//   • /lines/available_alt  — the ALTERNATE-line ladder (line_type "alt"): each line
//     object's options[] are several over-only rungs at different outcome_values, each
//     with its own payout_multiplier — Sleeper's Underdog-style alt ladder.
//
// Shape: an array of "lines", each with `sport`, `wager_type` (the stat), `line_type`,
// and an `options[]` array, each option { outcome: "over"|"under", outcome_value (the
// line), payout_multiplier }. Lines carry only `subject_id`, so names are resolved from
// the once-per-sport bulk player map (api.sleeper.app/players/<sport>).
import type { Sport } from '../lib/sports';
import type { StatKey } from '../lib/stats';
import type { ProvidedLineRow } from './providedTypes';
import { scrapeFetch } from './scrapeFetch';

const LINES_URLS = [
  'https://api.sleeper.app/lines/available',
  'https://api.sleeper.app/lines/available_alt',
];
const PLAYERS_URL = (sport: Sport) => `https://api.sleeper.app/players/${sport}`;
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
  Referer: 'https://sleeper.com/',
};

/** Sleeper `sport` string → our Sport (others — cs/golf/tennis/soccer — are ignored). */
const SLEEPER_SPORT: Record<string, Sport> = { nba: 'nba', mlb: 'mlb', nfl: 'nfl', wnba: 'wnba', nhl: 'nhl', ncaaf: 'cfb', ncaab: 'cbb' };

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
  // WNBA shares the NBA wager types (best-guess — verify in season).
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
  // Best-guess NHL wager types (off-season) — verify in season.
  nhl: {
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
  // Sleeper's soccer feed mixes competitions — not ingested for MLS.
  mls: {},
  // College mirrors the pro wager types (best-guess — verify in season).
  cfb: {
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

interface SleeperOption {
  outcome?: string; // 'over' | 'under'
  outcome_value?: number | string;
  payout_multiplier?: number | string; // decimal payout for THIS side, e.g. "1.62"
}
interface SleeperLine {
  sport?: string;
  subject_id?: string;
  wager_type?: string;
  line_type?: string; // 'normal' | 'alt' | 'line_promotion'
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
  // Merge the standard + alternate feeds (either may fail independently).
  const lines: SleeperLine[] = [];
  const failures: string[] = [];
  for (const url of LINES_URLS) {
    try {
      const res = await scrapeFetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      lines.push(...((await res.json()) as SleeperLine[]));
    } catch (e) {
      failures.push(`${url}: ${(e as Error).message}`);
      console.warn(`[sleeper] ${url} failed: ${(e as Error).message}`);
    }
  }
  // Both feeds down → an outage, not an empty board. See the note in prizepicks.ts.
  if (failures.length === LINES_URLS.length) {
    throw new Error(`Sleeper: all ${failures.length} line feeds failed — ${failures.join('; ')}`);
  }
  if (lines.length === 0) return out;

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
  const seen = new Set<string>(); // `${subject}:${wager}:${line}:${oddsType}` across feeds
  const push = (row: ProvidedLineRow) => {
    const key = `${row.externalPlayerId}:${row.stat}:${row.line}:${row.oddsType}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(row);
  };

  for (const l of lines) {
    const sport = l.sport ? SLEEPER_SPORT[l.sport] : undefined;
    if (!sport) continue;
    const stat = l.wager_type ? SLEEPER_STAT_MAP[sport][l.wager_type] : undefined;
    if (!stat) continue;
    const name = l.subject_id ? names.get(sport)?.get(l.subject_id) : undefined;
    if (!name) continue;
    const base = {
      sport,
      source: 'sleeper',
      externalPlayerId: l.subject_id ?? '',
      externalPlayerName: name,
      stat,
      gameDate,
    } as const;

    if (l.line_type === 'alt') {
      // Alternate ladder: each option is its own over-only rung at a different line,
      // carrying its exact payout multiplier — modeled exactly like Underdog alternates
      // (0.5 / multiplier breakeven).
      for (const o of l.options ?? []) {
        if (o.outcome !== 'over') continue;
        const line = toNum(o.outcome_value);
        const mult = toNum(o.payout_multiplier);
        if (line == null || mult == null) continue;
        push({ ...base, line, overOdds: null, underOdds: null, oddsType: 'alternate', multiplier: mult });
      }
      continue;
    }
    if (l.line_type && l.line_type !== 'normal') continue; // skip promos / unknown types

    // Standard line: over and under priced separately. Store each side's decimal payout
    // as American odds so the de-vig consensus / market-implied breakevens treat Sleeper
    // as a two-way book; the over multiplier rides along (display picks the leaned side).
    const over = l.options?.find((o) => o.outcome === 'over');
    const under = l.options?.find((o) => o.outcome === 'under');
    const line = toNum((over ?? under ?? l.options?.[0])?.outcome_value);
    if (line == null) continue;
    push({
      ...base,
      line,
      overOdds: decimalToAmerican(toNum(over?.payout_multiplier)),
      underOdds: decimalToAmerican(toNum(under?.payout_multiplier)),
      oddsType: 'standard',
      multiplier: toNum(over?.payout_multiplier),
    });
  }
  return out;
}
