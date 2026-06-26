// RotoWire "picks" aggregator ingest — ONE public endpoint that carries many books'
// player-prop lines with American odds already normalized:
//   GET https://www.rotowire.com/picks/api/lines.php   (no auth; Cloudflare-fronted)
//
// This is how we reach books that block direct scraping (Sleeper needs an account
// token; DraftKings Pick6 sits behind Akamai) — RotoWire already aggregates them, so
// a single proxy-free request yields Sleeper, DraftKings Pick6, RT Sports, plus the
// major sportsbooks (DraftKings/FanDuel/BetMGM/Caesars/Hard Rock/BetRivers).
//
// We DELIBERATELY skip PrizePicks + Underdog here — their own clients (prizepicks.ts /
// underdog.ts) scrape them directly (authoritative + not RotoWire-dependent). Each
// remaining book fans out to its own ProvidedLine `source`. Fail-safe upstream: if
// RotoWire is ever unreachable, these sources simply don't appear.
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

const URL = 'https://www.rotowire.com/picks/api/lines.php';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.rotowire.com/picks/',
};

/** RotoWire sport string → our Sport (others — WNBA/NHL/PGA/MMA/CS2 — are ignored). */
const RW_SPORT: Record<string, Sport> = { NBA: 'nba', MLB: 'mlb', NFL: 'nfl' };

/** RotoWire `book` → our ProvidedLine `source` id. PrizePicks/Underdog omitted on
 *  purpose (direct scrapers own those). Sportsbook books (…-sb) reuse the existing
 *  sportsbook source ids registered in providedSources.ts. */
const BOOK_SOURCE: Record<string, string> = {
  // DFS pick'em
  sleeper: 'sleeper',
  pick6: 'pick6', // DraftKings Pick6
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
interface RwResponse {
  entities?: RwEntity[];
  markets?: RwMarket[];
  events?: RwEvent[];
  props?: RwProp[];
}

function dateOnlyUtc(unixSeconds?: number): Date {
  const d = unixSeconds ? new Date(unixSeconds * 1000) : new Date();
  const v = Number.isNaN(d.getTime()) ? new Date() : d;
  return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
}

function parseRwBody(body: RwResponse, out: ProvidedLineRow[]): void {
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
      out.push({
        sport,
        source,
        externalPlayerId: String(ent.entityID),
        externalPlayerName: name,
        stat,
        line,
        overOdds: typeof ln.over === 'number' ? ln.over : null,
        underOdds: typeof ln.under === 'number' ? ln.under : null,
        gameDate,
      });
    }
  }
}

export async function fetchRotowireLines(): Promise<ProvidedLineRow[]> {
  const out: ProvidedLineRow[] = [];
  try {
    const res = await scrapeFetch(URL, { headers: HEADERS });
    if (!res.ok) throw new Error(`RotoWire HTTP ${res.status}`);
    parseRwBody((await res.json()) as RwResponse, out);
  } catch (e) {
    console.warn(`[rotowire] fetch failed: ${(e as Error).message}`);
  }
  return out;
}
