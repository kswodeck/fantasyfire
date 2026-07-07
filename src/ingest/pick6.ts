// DraftKings Pick6 line ingest — UNOFFICIAL public JSON API on api.draftkings.com,
// no auth (the same gateway the pick6.draftkings.com React app reads).
//
// ⚠️ Not an official/contracted API: no SLA, ToS gray area, geo-gated for ENTRIES
// (reads worked from datacenter IPs in testing) and can change or block. All failures
// are non-fatal upstream; the app falls back to its computed line. Source id: "pick6".
//
// WHY A DIRECT SCRAPER (Pick6 also comes through RotoWire): RotoWire gives only the
// line + American odds. Pick6's own feed carries the full ALTERNATE-LINE LADDER with a
// PER-RUNG PAYOUT MULTIPLIER — its goblin/demon equivalent. Each stat has several
// target lines; the easy ones pay < 1× (goblin), the standard line pays 1×, the hard
// ones pay progressively more (demon), e.g. Strikeouts 5.5→0.6×, 7.5→1×, 11.5→8.9×.
// We map each rung to a ProvidedLineRow with its exact multiplier, so the existing
// variantBreakeven (0.5 / multiplier) prices every rung correctly.
//
// Flow (all GET, no auth):
//   1. /pick6/v1/pickgroups/main            → sportLeagues[] (abbreviation → sportLeagueKey)
//   2. /pick6/v1/pickgroups/{sportLeagueKey} → pickGroups[] (upcoming pickGroupId per slate)
//   3. /pick6/v1/pickgroups/{pickGroupId}/category/pickcards
//        → pickCardByPickableId (ladders), entityInfoByDkId (names), pickSixMarketById
//          (stat names + More/Less), competitionById (start times).
import type { Sport } from '../lib/sports';
import type { StatKey } from '../lib/stats';
import type { ProvidedLineRow } from './providedTypes';
import { scrapeFetch } from './scrapeFetch';

const API = 'https://api.draftkings.com/pick6/v1';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
  Referer: 'https://pick6.draftkings.com/',
};

/** Pick6 league abbreviation → our Sport. Only per-game player-prop leagues; the
 *  season-long "NFL SZN" product is deliberately excluded. */
const P6_SPORT: Record<string, Sport> = { NBA: 'nba', MLB: 'mlb', NFL: 'nfl', WNBA: 'wnba', NHL: 'nhl', CFB: 'cfb', CBB: 'cbb' };

/** Pick6 market NAME → our StatKey, scoped by sport (names come from pickSixMarketById).
 *  MLB confirmed live; NBA/NFL best-guess (off-season) — verify in season. */
const P6_STAT_MAP: Record<Sport, Record<string, StatKey>> = {
  nba: {
    Points: 'pts',
    Rebounds: 'reb',
    Assists: 'ast',
    'Three Pointers Made': 'fg3m',
    '3-Pointers Made': 'fg3m',
    'Pts + Reb + Ast': 'pra',
    'Points + Rebounds + Assists': 'pra',
    'Pts + Reb': 'pr',
    'Pts + Ast': 'pa',
    'Reb + Ast': 'ra',
    Steals: 'stl',
    Blocks: 'blk',
    'Steals + Blocks': 'stocks',
    'Blocks + Steals': 'stocks',
    Turnovers: 'tov',
  },
  mlb: {
    Hits: 'hits',
    'Total Bases (From Hits)': 'tb',
    'Total Bases': 'tb',
    'Home Runs': 'hr',
    RBIs: 'rbi',
    'Runs Batted In': 'rbi',
    'Runs Scored': 'runs',
    Runs: 'runs',
    'Stolen Bases': 'sb',
    Walks: 'bb', // batter walks
    Doubles: 'doubles',
    'Hits + Runs + RBIs': 'hrr',
    'Strikeouts Thrown': 'k', // pitcher
    'Earned Runs': 'er',
    'Earned Runs Allowed': 'er',
    'Outs Recorded': 'outs',
    Outs: 'outs',
    'Hits Allowed': 'ha',
    'Walks Allowed': 'bba',
  },
  nfl: {
    'Passing Yards': 'passYds',
    'Passing Touchdowns': 'passTds',
    Completions: 'passCmp',
    'Pass Attempts': 'passAtt',
    'Passing Attempts': 'passAtt',
    Interceptions: 'ints',
    'Rushing Yards': 'rushYds',
    'Rushing Attempts': 'carries',
    'Carries': 'carries',
    'Rushing Touchdowns': 'rushTds',
    'Receiving Yards': 'recYds',
    Receptions: 'rec',
    'Receiving Touchdowns': 'recTds',
  },
  // WNBA shares the NBA market names (best-guess — verify in season).
  wnba: {
    Points: 'pts',
    Rebounds: 'reb',
    Assists: 'ast',
    'Three Pointers Made': 'fg3m',
    '3-Pointers Made': 'fg3m',
    'Pts + Reb + Ast': 'pra',
    'Points + Rebounds + Assists': 'pra',
    'Pts + Reb': 'pr',
    'Pts + Ast': 'pa',
    'Reb + Ast': 'ra',
    Steals: 'stl',
    Blocks: 'blk',
    'Steals + Blocks': 'stocks',
    'Blocks + Steals': 'stocks',
    Turnovers: 'tov',
  },
  // Best-guess NHL market names (off-season) — verify in season.
  nhl: {
    'Shots on Goal': 'sog',
    'Shots On Goal': 'sog',
    Points: 'pts',
    Goals: 'goals',
    Assists: 'ast',
    Hits: 'nhlHits',
    'Blocked Shots': 'blocked',
    'Faceoffs Won': 'fow',
    Saves: 'saves',
    'Goalie Saves': 'saves',
    'Goals Against': 'ga',
  },
  // Pick6's soccer offering mixes competitions — not ingested for MLS.
  mls: {},
  // College mirrors the pro market names (best-guess — verify in season).
  cfb: {
    'Passing Yards': 'passYds',
    'Passing Touchdowns': 'passTds',
    Completions: 'passCmp',
    'Pass Attempts': 'passAtt',
    Interceptions: 'ints',
    'Rushing Yards': 'rushYds',
    'Rushing Attempts': 'carries',
    'Rushing Touchdowns': 'rushTds',
    'Receiving Yards': 'recYds',
    Receptions: 'rec',
    'Receiving Touchdowns': 'recTds',
  },
  cbb: {
    Points: 'pts',
    Rebounds: 'reb',
    Assists: 'ast',
    'Three Pointers Made': 'fg3m',
    '3-Pointers Made': 'fg3m',
    'Pts + Reb + Ast': 'pra',
    Steals: 'stl',
    Blocks: 'blk',
    Turnovers: 'tov',
  },
};

/** More = the "over" side. */
const PROP_MORE = 1;

/** The "More" payout multiplier of a rung, or null when it has no priced More side. */
function moreMultiplier(m: P6Market): number | null {
  const more = m.activeSelections?.find((s) => s.statLinePropositionId === PROP_MORE);
  const mult = more?.standingsMultiplier;
  return typeof mult === 'number' && mult > 0 ? mult : null;
}

interface P6League {
  leagueAbbreviation?: string;
}
interface P6SportLeague {
  sportLeagueKey?: string;
  league?: P6League;
  hasPicksAvailable?: boolean;
}
interface P6PickGroup {
  pickGroupId?: number;
  pickGroupState?: string; // 'Upcoming' | 'Live' | 'Ended' | …
}
interface P6MainResponse {
  sportLeagues?: P6SportLeague[];
}
interface P6GroupResponse {
  pickGroups?: P6PickGroup[];
}
interface P6Selection {
  statLinePropositionId?: number;
  standingsMultiplier?: number;
}
interface P6Market {
  pickableMarketId?: number;
  pickSixMarketId?: number;
  isPaused?: boolean;
  targetValue?: number;
  activeSelections?: P6Selection[];
}
interface P6Card {
  entities?: { dkId?: number; compIds?: number[] }[];
  /** The line DK highlights as the main/default one — our "standard" anchor. */
  defaultPickableMarketId?: number;
  activePickableMarkets?: P6Market[];
}
interface P6CategoryResponse {
  pickCardByPickableId?: Record<string, P6Card | { pickCard?: P6Card }>;
  entityInfoByDkId?: Record<string, { fullName?: string; name?: string }>;
  pickSixMarketById?: Record<string, { name?: string }>;
  competitionById?: Record<string, { startTime?: string }>;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await scrapeFetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[pick6] ${url} failed: ${(e as Error).message}`);
    return null;
  }
}

function dateOnlyUtc(iso?: string): Date {
  const d = iso ? new Date(iso) : new Date();
  const v = Number.isNaN(d.getTime()) ? new Date() : d;
  return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
}

function unwrap(v: P6Card | { pickCard?: P6Card }): P6Card {
  return (v as { pickCard?: P6Card }).pickCard ?? (v as P6Card);
}

/**
 * The pickableMarketId to treat as the card's STANDARD line — modeled exactly like
 * Underdog's balanced line: the book's own default/main line, or (when that's paused/
 * missing) the live rung whose multiplier is nearest 1×. Every other live rung becomes
 * an ALTERNATE carrying its exact multiplier, so Pick6 renders like Underdog (one base
 * line + a cycling multiplier chip) rather than PrizePicks goblin/demon icons.
 */
function standardMarketId(card: P6Card, liveMarkets: P6Market[]): number | undefined {
  const dflt = card.defaultPickableMarketId;
  if (dflt != null && liveMarkets.some((m) => m.pickableMarketId === dflt)) return dflt;
  let best: P6Market | undefined;
  for (const m of liveMarkets) {
    const mult = moreMultiplier(m);
    if (mult == null) continue;
    if (!best || Math.abs(mult - 1) < Math.abs((moreMultiplier(best) ?? Infinity) - 1)) best = m;
  }
  return best?.pickableMarketId;
}

function parseCategory(sport: Sport, body: P6CategoryResponse, out: ProvidedLineRow[]): void {
  const cards = body.pickCardByPickableId ?? {};
  const entities = body.entityInfoByDkId ?? {};
  const markets = body.pickSixMarketById ?? {};
  const comps = body.competitionById ?? {};
  const statMap = P6_STAT_MAP[sport];

  for (const wrapper of Object.values(cards)) {
    const card = unwrap(wrapper);
    const dkId = card.entities?.[0]?.dkId;
    const info = dkId != null ? entities[String(dkId)] : undefined;
    const name = (info?.fullName ?? info?.name ?? '').trim();
    if (!name) continue;
    const compId = card.entities?.[0]?.compIds?.[0];
    const gameDate = dateOnlyUtc(compId != null ? comps[String(compId)]?.startTime : undefined);

    // Only currently-pickable rungs with a priced More side; one of them is the
    // standard (base) line, the rest are alternates.
    const liveMarkets = (card.activePickableMarkets ?? []).filter(
      (m) => !m.isPaused && moreMultiplier(m) != null,
    );
    const stdId = standardMarketId(card, liveMarkets);

    for (const m of liveMarkets) {
      const marketName = m.pickSixMarketId != null ? markets[String(m.pickSixMarketId)]?.name : undefined;
      const stat = marketName ? statMap[marketName] : undefined;
      if (!stat) continue;
      const line = typeof m.targetValue === 'number' ? m.targetValue : NaN;
      if (!Number.isFinite(line)) continue;
      const mult = moreMultiplier(m)!;
      out.push({
        sport,
        source: 'pick6',
        externalPlayerId: String(dkId),
        externalPlayerName: name,
        stat,
        line,
        // Pick6 prices via fixed multipliers, not two-sided odds.
        overOdds: null,
        underOdds: null,
        // The default/main line is the standard anchor; every other rung is an
        // alternate carrying its multiplier (→ 0.5/multiplier breakeven), same as UD.
        oddsType: m.pickableMarketId === stdId ? 'standard' : 'alternate',
        multiplier: mult,
        gameDate,
      });
    }
  }
}

export async function fetchPick6Lines(): Promise<ProvidedLineRow[]> {
  const out: ProvidedLineRow[] = [];
  const main = await getJson<P6MainResponse>(`${API}/pickgroups/main`);
  if (!main) return out;

  // Which of our sports the site is currently offering, and their league keys.
  const targets: Array<{ sport: Sport; key: string }> = [];
  for (const sl of main.sportLeagues ?? []) {
    const abbr = sl.league?.leagueAbbreviation;
    const sport = abbr ? P6_SPORT[abbr] : undefined;
    if (sport && sl.hasPicksAvailable && sl.sportLeagueKey) {
      targets.push({ sport, key: sl.sportLeagueKey });
    }
  }

  for (let i = 0; i < targets.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1000)); // be polite between sports
    const { sport, key } = targets[i];
    const group = await getJson<P6GroupResponse>(`${API}/pickgroups/${encodeURIComponent(key)}`);
    // Every upcoming/live slate for this league (a sport can have several game days queued).
    const pgIds = (group?.pickGroups ?? [])
      .filter((p) => p.pickGroupState === 'Upcoming' || p.pickGroupState === 'Live')
      .map((p) => p.pickGroupId)
      .filter((id): id is number => typeof id === 'number');
    for (let j = 0; j < pgIds.length; j++) {
      if (j > 0) await new Promise((r) => setTimeout(r, 500));
      const cat = await getJson<P6CategoryResponse>(`${API}/pickgroups/${pgIds[j]}/category/pickcards`);
      if (cat) parseCategory(sport, cat, out);
    }
  }
  return out;
}
