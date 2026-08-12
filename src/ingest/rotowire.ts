// RotoWire "picks" aggregator ingest — ONE public endpoint that carries many books'
// player-prop lines, each book's own price alongside it:
//   GET https://www.rotowire.com/picks/api/lines.php   (no auth; Cloudflare-fronted)
//
// The `over`/`under` fields are NOT guaranteed to be American odds — the payload mixes
// sportsbooks (which quote odds) with pick'em products (which quote payout multipliers),
// so every price is validated before it is stored. See americanOrNull.
//
// This is how we reach books we don't scrape directly — a single proxy-free request
// yields RT Sports plus the major sportsbooks (DraftKings/FanDuel/BetMGM/Caesars/Hard
// Rock/BetRivers).
//
// We DELIBERATELY skip PrizePicks, Underdog, Sleeper, and DraftKings Pick6 here — their
// own clients (prizepicks.ts / underdog.ts / sleeper.ts / pick6.ts) scrape them directly
// and, crucially, carry the payout multipliers + alternate-line ladders RotoWire doesn't
// expose. Each remaining book fans out to its own ProvidedLine `source`. Fail-safe
// upstream: if RotoWire is ever unreachable, these sources simply don't appear.
//
// Shape: { entities[], markets[], events[], props[] }.
//   entities[] : { entityID, eventID, sport, name, team, pos }            (the player)
//   markets[]  : { marketID, sport, category, marketName }                (the stat)
//   events[]   : { eventID, eventTime(unix s), homeTeam, awayTeam }       (the game)
//   props[]    : { propID, marketID, entities:[entityID], lines:[ { book, over, under, line } ] }
import type { Sport } from '../lib/sports';
import type { StatKey } from '../lib/stats';
import type { ProvidedLineRow } from './providedTypes';
import { scrapeFetch } from './scrapeFetch';
import { isAmericanOdds } from '../lib/odds/fairPrice';

const URL = 'https://www.rotowire.com/picks/api/lines.php';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.rotowire.com/picks/',
};

/** RotoWire sport string → our Sport (others — WNBA/NHL/PGA/MMA/CS2 — are ignored). */
const RW_SPORT: Record<string, Sport> = { NBA: 'nba', MLB: 'mlb', NFL: 'nfl', WNBA: 'wnba', NHL: 'nhl', CFB: 'cfb', CBB: 'cbb' };

/** RotoWire `book` → our ProvidedLine `source` id. PrizePicks/Underdog/Sleeper/Pick6
 *  omitted on purpose — their own direct scrapers own those (and carry payout
 *  multipliers / alternate ladders RotoWire doesn't expose). Sportsbook books (…-sb)
 *  reuse the existing sportsbook source ids registered in providedSources.ts. */
const BOOK_SOURCE: Record<string, string> = {
  // DFS pick'em
  rtsports: 'rtsports',
  // Sportsbooks
  'draftkings-sb': 'draftkings',
  'fanduel-sb': 'fanduel',
  'betmgm-sb': 'betmgm',
  'caesars-sb': 'caesars',
  'hardrock-sb': 'hardrock',
  'betrivers-sb': 'betrivers',
};

/** RotoWire `marketName` (category "Game" only) → our StatKey, scoped by sport.
 *  MLB is confirmed live; NBA names are taken from RotoWire's WNBA vocabulary and NFL
 *  from its season-market names (both off-season as of mid-2026) — verify in season.
 *  Unmapped markets (Fantasy Score, Singles, Wins, season futures, …) are skipped. */
const RW_MARKET_MAP: Record<Sport, Record<string, StatKey>> = {
  nba: {
    Points: 'pts',
    Rebounds: 'reb',
    Assists: 'ast',
    '3PT Made': 'fg3m',
    'PTS+REB+AST': 'pra',
    'PTS+REB': 'pr',
    'PTS+AST': 'pa',
    'REB+AST': 'ra',
    Steals: 'stl',
    Blocks: 'blk',
    'BLK+STL': 'stocks',
    Turnovers: 'tov',
    'Offensive Rebounds': 'oreb',
    'Defensive Rebounds': 'dreb',
  },
  mlb: {
    Hits: 'hits',
    'Total Bases': 'tb',
    'Home Runs': 'hr',
    RBI: 'rbi',
    Runs: 'runs',
    'Stolen Bases': 'sb',
    Walks: 'bb',
    'Batter Strikeouts': 'so',
    'Hits+Runs+RBI': 'hrr',
    Doubles: 'doubles',
    'Pitcher Strikeouts': 'k',
    'Earned Runs': 'er',
    Outs: 'outs',
    'Hits Allowed': 'ha',
    'Walks Allowed': 'bba',
  },
  nfl: {
    'Passing Yards': 'passYds',
    'Passing Touchdowns': 'passTds',
    Completions: 'passCmp',
    'Pass Attempts': 'passAtt',
    'Interceptions Thrown': 'ints',
    'Rushing Yards': 'rushYds',
    'Rush Attempts': 'carries',
    'Rushing Touchdowns': 'rushTds',
    'Receiving Yards': 'recYds',
    Receptions: 'rec',
    'Receiving Touchdowns': 'recTds',
  },
  // The NBA map above was taken from RotoWire's WNBA vocabulary — same names here.
  wnba: {
    Points: 'pts',
    Rebounds: 'reb',
    Assists: 'ast',
    '3PT Made': 'fg3m',
    'PTS+REB+AST': 'pra',
    'PTS+REB': 'pr',
    'PTS+AST': 'pa',
    'REB+AST': 'ra',
    Steals: 'stl',
    Blocks: 'blk',
    'BLK+STL': 'stocks',
    Turnovers: 'tov',
    'Offensive Rebounds': 'oreb',
    'Defensive Rebounds': 'dreb',
  },
  // Best-guess NHL market names (off-season) — verify in season.
  nhl: {
    'Shots on Goal': 'sog',
    Points: 'pts',
    Goals: 'goals',
    Assists: 'ast',
    Hits: 'nhlHits',
    'Blocked Shots': 'blocked',
    'Faceoffs Won': 'fow',
    Saves: 'saves',
    'Goals Against': 'ga',
  },
  // RotoWire's soccer feed mixes competitions — not ingested for MLS.
  mls: {},
  // College mirrors the pro market names (best-guess — verify in season).
  cfb: {
    'Passing Yards': 'passYds',
    'Passing Touchdowns': 'passTds',
    Completions: 'passCmp',
    'Pass Attempts': 'passAtt',
    'Interceptions Thrown': 'ints',
    'Rushing Yards': 'rushYds',
    'Rush Attempts': 'carries',
    'Rushing Touchdowns': 'rushTds',
    'Receiving Yards': 'recYds',
    Receptions: 'rec',
    'Receiving Touchdowns': 'recTds',
  },
  cbb: {
    Points: 'pts',
    Rebounds: 'reb',
    Assists: 'ast',
    '3PT Made': 'fg3m',
    'PTS+REB+AST': 'pra',
    Steals: 'stl',
    Blocks: 'blk',
    Turnovers: 'tov',
  },
};

interface RwEntity {
  entityID: number;
  eventID?: number;
  sport?: string;
  name?: string;
}
interface RwMarket {
  marketID: number;
  category?: string;
  marketName?: string;
}
interface RwEvent {
  eventID: number;
  eventTime?: number; // unix seconds
}
interface RwLine {
  book?: string;
  over?: number | null;
  under?: number | null;
  line?: number | string;
}
interface RwProp {
  marketID: number;
  entities?: number[];
  lines?: RwLine[];
}
export interface RwResponse {
  entities?: RwEntity[];
  markets?: RwMarket[];
  events?: RwEvent[];
  props?: RwProp[];
}

/**
 * A quoted price, kept only when it really is American odds.
 *
 * This is the ONE ingest that writes a feed's price fields through untouched —
 * sleeper.ts converts its decimal multipliers and underdog.ts parses an explicitly
 * American field, so both are American by construction. RotoWire carries pick'em
 * books (RT Sports) alongside true sportsbooks (…-sb) in one payload, and a pick'em
 * product quotes payout multipliers, not odds. Storing a 1.90 multiplier as American
 * odds anchors every read on that book at a clamped 0.95 breakeven, which drops its
 * whole board below the Heat Check's no-read cutoff while the book still shows up in
 * the selector — an empty board with no visible cause. Keep the line, drop the price:
 * a book with no usable odds scores against the flat 0.5 anchor, same as PrizePicks.
 */
function americanOrNull(v: unknown): number | null {
  return typeof v === 'number' && isAmericanOdds(v) ? v : null;
}

function dateOnlyUtc(unixSeconds?: number): Date {
  const d = unixSeconds ? new Date(unixSeconds * 1000) : new Date();
  const v = Number.isNaN(d.getTime()) ? new Date() : d;
  return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
}

export function parseRwBody(
  body: RwResponse,
  out: ProvidedLineRow[],
  /** Per-book count of prices dropped by americanOrNull — surfaced by the caller so a
   *  book that switches price format is loud in the run log instead of quietly
   *  turning into a board of un-scoreable lines. */
  nonAmerican: Map<string, number> = new Map(),
): void {
  const entById = new Map<number, RwEntity>();
  for (const e of body.entities ?? []) entById.set(e.entityID, e);
  const mktById = new Map<number, RwMarket>();
  for (const m of body.markets ?? []) mktById.set(m.marketID, m);
  const evById = new Map<number, RwEvent>();
  for (const ev of body.events ?? []) evById.set(ev.eventID, ev);

  for (const p of body.props ?? []) {
    const ent = p.entities?.[0] != null ? entById.get(p.entities[0]) : undefined;
    if (!ent?.sport || !ent.name) continue;
    const sport = RW_SPORT[ent.sport];
    if (!sport) continue;
    const mkt = mktById.get(p.marketID);
    if (!mkt || mkt.category !== 'Game' || !mkt.marketName) continue; // skip season futures
    const stat = RW_MARKET_MAP[sport][mkt.marketName];
    if (!stat) continue;
    const name = ent.name.trim();
    if (!name) continue;
    const gameDate = dateOnlyUtc(ent.eventID != null ? evById.get(ent.eventID)?.eventTime : undefined);

    // A book can appear more than once per prop (alternate/historical lines); keep the
    // first (standard) line per book so each (book, prop) upserts deterministically.
    const seen = new Set<string>();
    for (const ln of p.lines ?? []) {
      if (!ln.book) continue;
      const source = BOOK_SOURCE[ln.book];
      if (!source || seen.has(source)) continue; // skip PP/UD + unknown books + dup lines
      const line = typeof ln.line === 'number' ? ln.line : parseFloat(String(ln.line));
      if (!Number.isFinite(line)) continue;
      seen.add(source);
      const overOdds = americanOrNull(ln.over);
      const underOdds = americanOrNull(ln.under);
      if ((ln.over != null && overOdds === null) || (ln.under != null && underOdds === null)) {
        nonAmerican.set(source, (nonAmerican.get(source) ?? 0) + 1);
      }
      out.push({
        sport,
        source,
        externalPlayerId: String(ent.entityID),
        externalPlayerName: name,
        stat,
        line,
        overOdds,
        underOdds,
        gameDate,
      });
    }
  }
}

export async function fetchRotowireLines(): Promise<ProvidedLineRow[]> {
  const out: ProvidedLineRow[] = [];
  const nonAmerican = new Map<string, number>();
  // The aggregator is one request, so a failure here is a total outage for every book
  // it carries — surfaced rather than swallowed, so it can't read downstream as "none
  // of these books posted anything today". See the note in prizepicks.ts.
  const res = await scrapeFetch(URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`RotoWire HTTP ${res.status}`);
  parseRwBody((await res.json()) as RwResponse, out, nonAmerican);
  if (nonAmerican.size) {
    const summary = [...nonAmerican.entries()].map(([s, n]) => `${s}=${n}`).join(', ');
    console.warn(
      `[rotowire] dropped non-American prices (kept the lines): ${summary}. ` +
        'Those books quote a payout format we do not read as odds — their reads ' +
        'score against the flat 0.5 anchor.',
    );
  }
  return out;
}
