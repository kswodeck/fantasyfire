// Server-only data access: Prisma -> the pure compute core. Sport-aware.
//
// Imported only by Server Components (pages), route handlers, and scripts —
// never by presentational components (those receive plain data via props).
import { cache } from 'react';
import { db } from '@/lib/db';
import {
  type StatKey,
  type DvpCell,
  type PosBucket,
  STAT_WINDOWS,
  computeHitRate,
  computeStreak,
  hitRateConfidence,
  rankDvp,
  buildWhyText,
  statValue,
  statKeysForSport,
  FANTASY_SCORE_KEYS,
  FANTASY_SCORE_KEY_BY_SPORT,
  defaultStatForSport,
  blendedRoleThreshold,
  RECENT_GAMES_WINDOW,
  recentFormEstimate,
  computeConsistency,
  matchupGrade,
  type MatchupGrade,
  opponentMultiplierFromCell,
  paceMultiplier,
  impliedTeamTotal,
  environmentMultiplier,
  volumeMultiplier,
  calibratedLineProbOver,
  computeFireFactor,
  gateAvailability,
  type AvailabilityStatus,
  computeSplits,
  wilsonInterval,
  STAT_DEFS,
  FIREFACTOR_MIN_GAMES,
  defaultLine,
  defaultPropLine,
} from '@/lib/stats';
import { fairPriceReadout, marketConsensus, type MarketConsensus } from '@/lib/odds';
import { parseSlate, normalizeName } from '@/lib/slate';
import { posBucketLabel } from '@/lib/filters';
import { currentSeason, previousSeason } from '@/lib/season';
import { getTeam } from '@/lib/teams';
import type { Sport } from '@/lib/sports';
import type {
  PlayerSummary,
  PlayerBio,
  PlayerGame,
  PlayerListItem,
  CardAvailability,
  ChartPoint,
  WindowResult,
  PlayerResearch,
  PlayerAvailability,
  TeammateSplit,
  InjuryReportRow,
  BoardRow,
  LineValueComparison,
  ProvidedVariant,
  TrendRow,
  TrendRung,
  DvpTableRow,
  LeaderRow,
  SlateResult,
  TonightGame,
} from '@/lib/types';
import { PROP_STATS } from '@/lib/propStats';
import {
  getProvidedLineMap,
  getProvidedVariantMap,
  getProvidedVariants,
  getProvidedLinesBySource,
  getProvidedQuotesBySource,
  getBookQuoteMap,
} from '@/lib/server/providedLines';
import { DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';
import {
  pickRepresentative,
  normalLine,
  isNormalKind,
  isOverOnly,
  resolvedBreakeven,
  sidedMultiplier,
  bestVariantScore,
} from '@/lib/payoutVariant';
import type { RungQuote } from '@/lib/odds/marketBreakeven';

/**
 * The season the app reads for a sport. Computed from today's date, falling back
 * to the previous season if the current one has no data yet. Cached per request.
 */
const getActiveSeason = cache(async (sport: Sport): Promise<string> => {
  const current = currentSeason(sport);
  if ((await db.playerGameStat.count({ where: { sport, season: current } })) > 0) {
    return current;
  }
  const prev = previousSeason(sport, current);
  if ((await db.playerGameStat.count({ where: { sport, season: prev } })) > 0) {
    return prev;
  }
  return current; // nothing ingested — queries return empty, handled gracefully
});

// Per-game "opportunity" used to drop games where a player was barely involved
// (injury exits / garbage time / pinch-hit cameos), which would otherwise drag
// rates around. The bar is per-player (blendedRoleThreshold) so part-timers
// aren't zeroed out by a fixed floor.
//   NBA            -> minutes played
//   MLB hitters    -> plate appearances ≈ AB + BB + HBP
//   MLB pitchers   -> null (NOT filtered): a workload proxy (outs/IP) is
//                     negatively correlated with earned runs — a starter who is
//                     shelled gets pulled early — so filtering by it would bias
//                     ER/hits-allowed rates downward. The correct pitcher filter
//                     is starts-only, which needs an ingested gamesStarted flag.
//   NFL            -> role involvement: QB pass attempts, RB carries+receptions
//                     (touches), WR/TE targets — drops cameo/benched games from
//                     an already-short (~17 game) season.
//   NHL / WNBA     -> minutes (time on ice / minutes played), like the NBA.
//   Soccer         -> null (NOT filtered): the feed has no per-player minutes, and
//                     every involvement proxy we do have (shots, fouls) correlates
//                     with performance, so filtering on it would bias hit rates.
function opportunityFor(
  sport: Sport,
  posBucket: string | null | undefined,
  g: PlayerGame,
): number | null {
  if (sport === 'nba' || sport === 'wnba' || sport === 'nhl') return g.minutes ?? null;
  if (sport === 'mls') return null;
  if (sport === 'nfl') {
    if (posBucket === 'QB') return g.passAttempts ?? 0;
    if (posBucket === 'RB') return (g.rushAttempts ?? 0) + (g.receptions ?? 0);
    return g.targets ?? 0; // WR / TE
  }
  if (posBucket === 'P') return null;
  return (g.atBats ?? 0) + (g.walks ?? 0) + (g.hbp ?? 0);
}

// Cutoff multiplier on the blended role threshold. Minutes-based sports use the
// full blended average; count-based opportunities (MLB PAs, NFL touches) use 60%
// so the modal full game isn't clipped (see the comment in getPlayerResearch).
// NHL goalies also get 60%: a starter's TOI clusters at ~60 minutes, so a bar at
// the blended average would clip roughly half of their FULL starts — 60% keeps
// every start while still dropping mid-game relief appearances.
function qualifyFactorFor(sport: Sport, posBucket: string | null | undefined): number {
  if (sport === 'nhl') return posBucket === 'G' ? 0.6 : 1;
  return sport === 'nba' || sport === 'wnba' ? 1 : 0.6;
}

// Position-bucket display labels are sport-scoped (NBA G = guards, NHL/soccer
// G = goalies) — single-sourced in lib/filters.ts next to the filter options.
const posLabel = posBucketLabel;

// SQL expression per NBA stat for DvP aggregation. Whitelisted (NOT user input).
const NBA_STAT_SQL: Partial<Record<StatKey, string>> = {
  pts: 's.points',
  reb: 's.rebounds',
  oreb: 's.oreb',
  dreb: 's.dreb',
  ast: 's.assists',
  fg3m: 's.fg3m',
  stl: 's.steals',
  blk: 's.blocks',
  tov: 's.turnovers',
  fouls: 's.fouls',
  pra: '(s.points + s.rebounds + s.assists)',
  pr: '(s.points + s.rebounds)',
  pa: '(s.points + s.assists)',
  ra: '(s.rebounds + s.assists)',
  stocks: '(s.steals + s.blocks)',
  // PrizePicks NBA Fantasy Score (see fantasyScore block in stats/types.ts).
  fs: '(s.points + 1.2*s.rebounds + 1.5*s.assists + 3*s.steals + 3*s.blocks - s.turnovers)',
};

// SQL expression per MLB hitting stat (for the opposing-pitching matchup).
const MLB_HIT_SQL: Partial<Record<StatKey, string>> = {
  hits: 's.hits',
  tb: 's."totalBases"',
  hr: 's."homeRuns"',
  rbi: 's.rbi',
  runs: 's.runs',
  sb: 's."stolenBases"',
  bb: 's.walks',
  so: 's.strikeouts',
  doubles: 's.doubles',
  hrr: '(s.hits + s.runs + s.rbi)',
  // PrizePicks MLB Hitter Fantasy Score — singles derived, GREATEST guards the
  // same inconsistent-data clamp as the TS value function; triples/hbp COALESCEd
  // (nullable on rows ingested before those columns existed).
  hitterFs:
    '(3*GREATEST(0, s.hits - s.doubles - COALESCE(s.triples,0) - s."homeRuns") + 5*s.doubles + 8*COALESCE(s.triples,0) + 10*s."homeRuns" + 2*s.runs + 2*s.rbi + 2*s.walks + 2*COALESCE(s.hbp,0) + 5*s."stolenBases")',
};

// SQL expression per NFL stat (for defense-vs-position). Whitelisted, not input.
const NFL_STAT_SQL: Partial<Record<StatKey, string>> = {
  passYds: 's."passYards"',
  passTds: 's."passTds"',
  passCmp: 's."passCompletions"',
  passAtt: 's."passAttempts"',
  ints: 's."passInts"',
  rushYds: 's."rushYards"',
  carries: 's."rushAttempts"',
  rushTds: 's."rushTds"',
  rec: 's.receptions',
  targets: 's.targets',
  recYds: 's."recYards"',
  recTds: 's."recTds"',
  fumbles: 's."fumblesLost"',
  // PrizePicks NFL Fantasy Score — every column COALESCEd (NFL rows are sparse
  // by position: a QB row has no receptions, a WR row no pass yards).
  fantasyScore:
    '(0.04*COALESCE(s."passYards",0) + 4*COALESCE(s."passTds",0) - COALESCE(s."passInts",0) + 0.1*COALESCE(s."rushYards",0) + 6*COALESCE(s."rushTds",0) + COALESCE(s.receptions,0) + 0.1*COALESCE(s."recYards",0) + 6*COALESCE(s."recTds",0) - 2*COALESCE(s."fumblesLost",0))',
};

// Per-position involvement gate for DvP: only count games where a player of this
// bucket actually featured (a real start), so a 3rd-stringer's 0-target cameo
// doesn't dilute the average a defense allows to the position.
const NFL_INVOLVEMENT: Record<string, { expr: string; floor: number }> = {
  QB: { expr: 's."passAttempts"', floor: 10 },
  RB: { expr: '(COALESCE(s."rushAttempts",0) + COALESCE(s.receptions,0))', floor: 4 },
  WR: { expr: 's.targets', floor: 2 },
  TE: { expr: 's.targets', floor: 1 },
};

// SQL expression per NHL stat (DvP by F/D/G bucket). Whitelisted, not input.
// NHL rows store points = goals + assists in the shared points column.
const NHL_STAT_SQL: Partial<Record<StatKey, string>> = {
  pts: 's.points',
  goals: 's.goals',
  ast: 's.assists',
  sog: 's."shotsOnGoal"',
  nhlHits: 's."hitsDelivered"',
  blocked: 's."blockedShots"',
  fow: 's."faceoffsWon"',
  saves: 's.saves',
  ga: 's."goalsAgainst"',
  sa: 's."shotsAgainst"',
};

// SQL expression per soccer stat (MLS DvP by F/M/D/G bucket). Whitelisted.
// Fouls committed reuse the shared `fouls` column.
const SOCCER_STAT_SQL: Partial<Record<StatKey, string>> = {
  goals: 's.goals',
  ast: 's.assists',
  shots: 's.shots',
  sot: 's."shotsOnTarget"',
  foulsCommitted: 's.fouls',
  saves: 's.saves',
  ga: 's."goalsAgainst"',
  sa: 's."shotsAgainst"',
};

type PlayerRecord = {
  id: number;
  sport: Sport;
  externalId: number;
  slug: string;
  firstName: string;
  lastName: string;
  position: string | null;
  posBucket: string | null;
  jersey: string | null;
  height: string | null;
  weight: number | null;
  college: string | null;
  country: string | null;
  draftYear: number | null;
  draftRound: number | null;
  draftNumber: number | null;
  fromYear: number | null;
  team: { id: number; abbreviation: string; name: string; externalId: number } | null;
};

// Wrapped in React cache() so generateMetadata + the page (same render) share
// one query instead of two.
const getPlayerRecord = cache(
  async (sport: Sport, slug: string): Promise<PlayerRecord | null> => {
    const p = await db.player.findUnique({
      where: { sport_slug: { sport, slug } },
      select: {
        id: true,
        externalId: true,
        slug: true,
        firstName: true,
        lastName: true,
        position: true,
        posBucket: true,
        jersey: true,
        height: true,
        weight: true,
        college: true,
        country: true,
        draftYear: true,
        draftRound: true,
        draftNumber: true,
        fromYear: true,
        team: { select: { id: true, abbreviation: true, name: true, externalId: true } },
      },
    });
    return p ? { ...p, sport } : null;
  },
);

function toBio(p: PlayerRecord): PlayerBio {
  return {
    college: p.college ?? null,
    country: p.country ?? null,
    draftYear: p.draftYear ?? null,
    draftRound: p.draftRound ?? null,
    draftNumber: p.draftNumber ?? null,
    fromYear: p.fromYear ?? null,
  };
}

/** Prefer the curated full team name; fall back to the stored name. */
function teamDisplayName(
  sport: Sport,
  abbr: string | null | undefined,
  dbName: string | null,
): string | null {
  if (!abbr) return dbName ?? null;
  const t = getTeam(sport, abbr);
  return t.fullName || dbName || abbr;
}

function toSummary(p: PlayerRecord): PlayerSummary {
  return {
    sport: p.sport,
    externalId: p.externalId,
    slug: p.slug,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: `${p.firstName} ${p.lastName}`.trim(),
    position: p.position ?? null,
    posBucket: (p.posBucket as PosBucket | null) ?? null,
    jersey: p.jersey ?? null,
    height: p.height ?? null,
    weight: p.weight ?? null,
    teamAbbreviation: p.team?.abbreviation ?? null,
    teamName: teamDisplayName(p.sport, p.team?.abbreviation, p.team?.name ?? null),
    teamExternalId: p.team?.externalId ?? null,
  };
}

export async function getPlayerBySlug(
  sport: Sport,
  slug: string,
): Promise<PlayerSummary | null> {
  const p = await getPlayerRecord(sport, slug);
  return p ? toSummary(p) : null;
}

/** Prisma stat row shape used by the game mapper (model fields + opponent abbr).
 * Stat columns are OPTIONAL so a per-sport narrowed `select` (boardStatSelect) — which
 * omits other sports' columns to cut egress — is still assignable; the full-row query
 * (player page) provides them all. Missing columns map to undefined → statValue → 0. */
type StatGameRow = {
  points?: number | null;
  rebounds?: number | null;
  oreb?: number | null;
  dreb?: number | null;
  assists?: number | null;
  steals?: number | null;
  blocks?: number | null;
  turnovers?: number | null;
  fouls?: number | null;
  fgm?: number | null;
  fga?: number | null;
  fg3m?: number | null;
  fg3a?: number | null;
  ftm?: number | null;
  fta?: number | null;
  minutes?: number | null;
  atBats?: number | null;
  hits?: number | null;
  doubles?: number | null;
  triples?: number | null;
  homeRuns?: number | null;
  runs?: number | null;
  rbi?: number | null;
  walks?: number | null;
  strikeouts?: number | null;
  stolenBases?: number | null;
  totalBases?: number | null;
  hbp?: number | null;
  outs?: number | null;
  hitsAllowed?: number | null;
  runsAllowed?: number | null;
  earnedRuns?: number | null;
  walksAllowed?: number | null;
  strikeoutsPitched?: number | null;
  passYards?: number | null;
  passTds?: number | null;
  passCompletions?: number | null;
  passAttempts?: number | null;
  passInts?: number | null;
  rushYards?: number | null;
  rushAttempts?: number | null;
  rushTds?: number | null;
  receptions?: number | null;
  targets?: number | null;
  recYards?: number | null;
  recTds?: number | null;
  fumblesLost?: number | null;
  goals?: number | null;
  shotsOnGoal?: number | null;
  hitsDelivered?: number | null;
  blockedShots?: number | null;
  faceoffsWon?: number | null;
  saves?: number | null;
  goalsAgainst?: number | null;
  shotsAgainst?: number | null;
  shots?: number | null;
  shotsOnTarget?: number | null;
  gameDate: Date;
  opponentTeamId: number;
  opponentTeam: { abbreviation: string; externalId: number };
  isHome: boolean;
  wl: string | null;
  plusMinus: number | null;
};

/** Map a Prisma stat row (with opponent) to the view-layer PlayerGame. */
function toPlayerGame(r: StatGameRow): PlayerGame {
  return {
    // NBA
    points: r.points,
    rebounds: r.rebounds,
    oreb: r.oreb,
    dreb: r.dreb,
    assists: r.assists,
    steals: r.steals,
    blocks: r.blocks,
    turnovers: r.turnovers,
    fouls: r.fouls,
    fgm: r.fgm,
    fga: r.fga,
    fg3m: r.fg3m,
    fg3a: r.fg3a,
    ftm: r.ftm,
    fta: r.fta,
    minutes: r.minutes,
    // MLB hitting
    atBats: r.atBats,
    hits: r.hits,
    doubles: r.doubles,
    triples: r.triples,
    homeRuns: r.homeRuns,
    runs: r.runs,
    rbi: r.rbi,
    walks: r.walks,
    strikeouts: r.strikeouts,
    stolenBases: r.stolenBases,
    totalBases: r.totalBases,
    hbp: r.hbp,
    // MLB pitching
    outs: r.outs,
    hitsAllowed: r.hitsAllowed,
    runsAllowed: r.runsAllowed,
    earnedRuns: r.earnedRuns,
    walksAllowed: r.walksAllowed,
    strikeoutsPitched: r.strikeoutsPitched,
    // NFL
    passYards: r.passYards,
    passTds: r.passTds,
    passCompletions: r.passCompletions,
    passAttempts: r.passAttempts,
    passInts: r.passInts,
    rushYards: r.rushYards,
    rushAttempts: r.rushAttempts,
    rushTds: r.rushTds,
    receptions: r.receptions,
    targets: r.targets,
    recYards: r.recYards,
    recTds: r.recTds,
    fumblesLost: r.fumblesLost,
    // NHL + soccer (shared columns)
    goals: r.goals,
    shotsOnGoal: r.shotsOnGoal,
    hitsDelivered: r.hitsDelivered,
    blockedShots: r.blockedShots,
    faceoffsWon: r.faceoffsWon,
    saves: r.saves,
    goalsAgainst: r.goalsAgainst,
    shotsAgainst: r.shotsAgainst,
    shots: r.shots,
    shotsOnTarget: r.shotsOnTarget,
    // context
    gameDate: r.gameDate.toISOString().slice(0, 10),
    opponentTeamId: r.opponentTeamId,
    opponentAbbreviation: r.opponentTeam.abbreviation,
    opponentExternalId: r.opponentTeam.externalId,
    isHome: r.isHome,
    wl: r.wl,
    plusMinus: r.plusMinus,
  };
}

export async function getPlayerGames(playerId: number): Promise<PlayerGame[]> {
  const rows = await db.playerGameStat.findMany({
    where: { playerId },
    orderBy: { gameDate: 'desc' },
    include: { opponentTeam: { select: { abbreviation: true, externalId: true } } },
  });
  return rows.map(toPlayerGame);
}

/** One opponent the matchup card / DvP is computed against. */
export type MatchupOpponent = {
  /** Opponent's internal Team.id (the key DvP tables are grouped by). */
  teamId: number;
  abbreviation: string;
  /** Whether the player's team is home in this game. */
  isHome: boolean;
  /** Opponent's league team id (for the logo). */
  externalId: number;
  /** ISO date (YYYY-MM-DD) of the game. */
  date: string;
  /** Full ISO start datetime (UTC), for client-side local-time display; null if unknown. */
  startTime: string | null;
  /** The scheduled game's external id (for the /[sport]/game/[id] link); null for the
   *  off-season last-completed-game fallback, which has no upcoming game page. */
  gameExternalId: string | null;
};

/**
 * The player's team's NEXT scheduled opponent — the soonest game on/after today
 * (UTC), from the schedule feed. A game that already started today still counts
 * (its date is today's UTC date), so an in-progress game is treated as "next".
 * Returns null off-season / when the team has no upcoming game, letting callers
 * fall back to the last completed opponent.
 */
async function getNextOpponent(
  sport: Sport,
  teamId: number,
): Promise<MatchupOpponent | null> {
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const game = await db.scheduledGame.findFirst({
    where: {
      sport,
      date: { gte: todayUtc },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: { date: 'asc' },
    include: {
      homeTeam: { select: { id: true, abbreviation: true, externalId: true } },
      awayTeam: { select: { id: true, abbreviation: true, externalId: true } },
    },
  });
  if (!game) return null;
  const isHome = game.homeTeamId === teamId;
  const opp = isHome ? game.awayTeam : game.homeTeam;
  return {
    teamId: opp.id,
    abbreviation: opp.abbreviation,
    isHome,
    externalId: opp.externalId,
    date: game.date.toISOString().slice(0, 10),
    startTime: game.startTime ? game.startTime.toISOString() : null,
    gameExternalId: game.externalId,
  };
}

/** Every injured player in a sport, severity-sorted — the injury-report page. */
const INJURY_SEVERITY: Record<string, number> = {
  out: 0,
  doubtful: 1,
  questionable: 2,
  'day-to-day': 3,
};
export async function getInjuryReport(sport: Sport): Promise<InjuryReportRow[]> {
  const rows = await db.playerInjury
    .findMany({
      where: { sport },
      select: {
        status: true,
        fantasyStatus: true,
        detail: true,
        returnDate: true,
        comment: true,
        player: {
          select: {
            slug: true,
            firstName: true,
            lastName: true,
            position: true,
            team: { select: { abbreviation: true } },
          },
        },
      },
    })
    .catch(() => []);
  return rows
    .map((r) => ({
      slug: r.player.slug,
      name: `${r.player.firstName} ${r.player.lastName}`,
      team: r.player.team?.abbreviation ?? null,
      position: r.player.position,
      status: r.status as PlayerAvailability['status'],
      fantasyStatus: r.fantasyStatus,
      detail: r.detail,
      returnDate: r.returnDate ? r.returnDate.toISOString().slice(0, 10) : null,
      comment: r.comment,
    }))
    .sort(
      (a, b) =>
        (INJURY_SEVERITY[a.status] ?? 9) - (INJURY_SEVERITY[b.status] ?? 9) ||
        (a.team ?? '').localeCompare(b.team ?? '') ||
        a.name.localeCompare(b.name),
    );
}

/** All slugs for a sport (sitemap — every player stays crawlable). */
export async function getAllPlayerSlugs(sport: Sport): Promise<string[]> {
  const rows = await db.player.findMany({
    where: { sport },
    select: { slug: true },
    orderBy: { slug: 'asc' },
  });
  return rows.map((r) => r.slug);
}

/**
 * Slug + last game date for every player in a sport, for accurate per-URL
 * sitemap `lastModified` (a real recrawl signal instead of a blanket "now").
 * Two cheap queries (players + a grouped max(gameDate)) joined in memory.
 */
export async function getPlayerSlugsWithFreshness(
  sport: Sport,
): Promise<{ slug: string; lastGameDate: Date | null }[]> {
  const [players, freshness] = await Promise.all([
    db.player.findMany({
      where: { sport },
      select: { id: true, slug: true },
      orderBy: { slug: 'asc' },
    }),
    db.playerGameStat.groupBy({
      by: ['playerId'],
      where: { sport },
      _max: { gameDate: true },
    }),
  ]);
  const lastByPlayer = new Map(
    freshness.map((f) => [f.playerId, f._max.gameDate ?? null]),
  );
  return players.map((p) => ({
    slug: p.slug,
    lastGameDate: lastByPlayer.get(p.id) ?? null,
  }));
}

/**
 * Slugs for the busiest players in a sport, used by generateStaticParams. The
 * rest render on-demand (ISR) on first visit — keeps build time bounded while
 * every player stays in the sitemap and indexable.
 */
export async function getTopPlayerSlugs(sport: Sport, limit = 150): Promise<string[]> {
  const rows = await db.player.findMany({
    where: { sport },
    select: { slug: true },
    orderBy: { gameStats: { _count: 'desc' } },
    take: limit,
  });
  return rows.map((r) => r.slug);
}

/** Search/list players in a sport for index pages and the API. */
export async function searchPlayers(
  sport: Sport,
  q?: string,
  limit = 20,
): Promise<PlayerListItem[]> {
  const where = q
    ? {
        sport,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' as const } },
          { lastName: { contains: q, mode: 'insensitive' as const } },
          { slug: { contains: q.toLowerCase().replace(/\s+/g, '-') } },
        ],
      }
    : { sport };
  const rows = await db.player.findMany({
    where,
    include: {
      team: { select: { abbreviation: true, name: true, externalId: true } },
      _count: { select: { gameStats: true } },
      injury: {
        select: { status: true, fantasyStatus: true, detail: true, returnDate: true },
      },
    },
    orderBy: [{ gameStats: { _count: 'desc' } }, { lastName: 'asc' }],
    take: limit,
  });
  return rows.map((p) => ({
    sport,
    externalId: p.externalId,
    slug: p.slug,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: `${p.firstName} ${p.lastName}`.trim(),
    position: p.position ?? null,
    posBucket: (p.posBucket as PosBucket | null) ?? null,
    jersey: p.jersey ?? null,
    height: p.height ?? null,
    weight: p.weight ?? null,
    teamAbbreviation: p.team?.abbreviation ?? null,
    teamName: teamDisplayName(sport, p.team?.abbreviation, p.team?.name ?? null),
    teamExternalId: p.team?.externalId ?? null,
    gamesPlayed: p._count.gameStats,
    availability: toCardAvailability(p.injury),
  }));
}

/** Lightweight per-sport counts for the cross-sport dashboard. */
export async function getSportSummary(
  sport: Sport,
): Promise<{ players: number; games: number; season: string }> {
  const season = await getActiveSeason(sport);
  const [players, games] = await Promise.all([
    db.player.count({ where: { sport } }),
    db.game.count({ where: { sport, season } }),
  ]);
  return { players, games, season };
}

/** Most-recent game date in the dataset for a sport (ISO YYYY-MM-DD), for the freshness stamp. */
export async function getDataFreshness(sport: Sport): Promise<string | null> {
  const r = await db.playerGameStat.aggregate({
    where: { sport },
    _max: { gameDate: true },
  });
  return r._max.gameDate ? r._max.gameDate.toISOString().slice(0, 10) : null;
}

/**
 * Valid (slug, stat) combos for the programmatic per-player prop pages — the top
 * `limit` most-active players × PROP_STATS, skipping MLB pitchers (who have no
 * hitting prop pages). Single source for generateStaticParams + the sitemap.
 */
export async function getPropStatParams(
  sport: Sport,
  limit = 120,
): Promise<{ slug: string; stat: string }[]> {
  const players = await db.player.findMany({
    where: { sport },
    orderBy: { gameStats: { _count: 'desc' } },
    take: limit,
    select: { slug: true, posBucket: true },
  });
  const out: { slug: string; stat: string }[] = [];
  for (const p of players) {
    if (sport === 'mlb' && p.posBucket === 'P') continue;
    // The default stat's content lives on the base player page — skip it here so
    // /[slug]/[defaultStat] is never built or sitemapped (no near-duplicate).
    const def = defaultStatForSport(sport, p.posBucket);
    // Only the stats valid for this player's role — so an NFL WR never gets a
    // passing-yards page (a no-op intersection for NBA / MLB hitters).
    const valid = new Set<StatKey>(statKeysForSport(sport, p.posBucket));
    for (const stat of PROP_STATS[sport]) {
      if (stat === def || !valid.has(stat)) continue;
      out.push({ slug: p.slug, stat });
    }
  }
  return out;
}

/** The sports whose DvP uses the minutes-gated query (they store per-game minutes:
 *  NBA/WNBA minutes played, NHL time on ice). */
type MinutesDvpSport = 'nba' | 'wnba' | 'nhl';

/** Minutes-gated DvP cell table: stat allowed to a position bucket, ranked across
 *  teams. NBA/WNBA share the NBA stat SQL; the NHL has its own. */
async function getMinutesDvpTable(
  sport: MinutesDvpSport,
  posBucket: PosBucket,
  stat: StatKey,
  season: string,
): Promise<DvpCell[]> {
  const expr = (sport === 'nhl' ? NHL_STAT_SQL : NBA_STAT_SQL)[stat];
  if (!expr) return [];
  // Apply the SAME per-player minute threshold as the player page: for each
  // player, blend their season and last-N appearance minutes, then keep only
  // games at/above that bar (scaled by the same qualify factor the page uses —
  // see qualifyFactorFor for the NHL-goalie 0.6). Done in SQL (window function)
  // so the league-wide DvP averages stay consistent with each player's own role.
  const factor = qualifyFactorFor(sport, posBucket);
  const rows = await db.$queryRawUnsafe<
    { opponentTeamId: number; avg: number; n: number }[]
  >(
    `WITH games AS (
       SELECT s."opponentTeamId" AS opp, s.minutes AS minutes, (${expr}) AS val,
              ROW_NUMBER() OVER (PARTITION BY s."playerId" ORDER BY s."gameDate" DESC) AS rn,
              s."playerId" AS pid
       FROM "PlayerGameStat" s
       JOIN "Player" p ON p.id = s."playerId"
       WHERE p.sport = $4 AND p."posBucket" = $1 AND s.season = $2
         AND s.minutes IS NOT NULL AND s.minutes > 0
     ),
     thresh AS (
       SELECT pid, (AVG(minutes) + AVG(minutes) FILTER (WHERE rn <= $3)) / 2.0 AS thr
       FROM games GROUP BY pid
     )
     SELECT g.opp AS "opponentTeamId", AVG(g.val)::float8 AS avg, COUNT(*)::int AS n
     FROM games g
     JOIN thresh t ON t.pid = g.pid
     WHERE g.minutes >= t.thr * $5
     GROUP BY g.opp`,
    posBucket,
    season,
    RECENT_GAMES_WINDOW,
    sport,
    factor,
  );
  if (rows.length === 0) return [];
  return rankDvp(
    rows.map((r) => ({
      opponentTeamId: Number(r.opponentTeamId),
      avgAllowed: Number(r.avg),
      sampleSize: Number(r.n),
    })),
    posBucket,
    stat,
  );
}

async function getMinutesDvp(
  sport: MinutesDvpSport,
  posBucket: PosBucket,
  stat: StatKey,
  opponentTeamId: number,
  season: string,
): Promise<DvpCell | null> {
  const cells = await getMinutesDvpTable(sport, posBucket, stat, season);
  return cells.find((c) => c.opponentTeamId === opponentTeamId) ?? null;
}

/** Soccer DvP: a stat allowed to a position bucket per appearance, ranked. The feed
 *  has no per-player minutes, so there's no involvement gate — sub cameos dilute
 *  every team's average equally, keeping the RANKING comparable. */
async function getSoccerDvpTable(
  sport: 'mls',
  posBucket: PosBucket,
  stat: StatKey,
  season: string,
): Promise<DvpCell[]> {
  const expr = SOCCER_STAT_SQL[stat];
  if (!expr) return [];
  const rows = await db.$queryRawUnsafe<
    { opponentTeamId: number; avg: number; n: number }[]
  >(
    `SELECT s."opponentTeamId" AS "opponentTeamId", AVG(COALESCE(${expr},0))::float8 AS avg, COUNT(*)::int AS n
     FROM "PlayerGameStat" s
     JOIN "Player" p ON p.id = s."playerId"
     WHERE p.sport = $1 AND p."posBucket" = $2 AND s.season = $3
     GROUP BY s."opponentTeamId"`,
    sport,
    posBucket,
    season,
  );
  if (rows.length === 0) return [];
  return rankDvp(
    rows.map((r) => ({
      opponentTeamId: Number(r.opponentTeamId),
      avgAllowed: Number(r.avg),
      sampleSize: Number(r.n),
    })),
    posBucket,
    stat,
  );
}

async function getSoccerDvp(
  sport: 'mls',
  posBucket: PosBucket,
  stat: StatKey,
  opponentTeamId: number,
  season: string,
): Promise<DvpCell | null> {
  const cells = await getSoccerDvpTable(sport, posBucket, stat, season);
  return cells.find((c) => c.opponentTeamId === opponentTeamId) ?? null;
}

/** MLB matchup: a hitting stat the opponent's pitching staff allows per game. */
async function getMlbHitterMatchupTable(
  stat: StatKey,
  season: string,
): Promise<DvpCell[]> {
  const expr = MLB_HIT_SQL[stat];
  if (!expr) return [];
  // Per-game team total allowed, then average across that opponent's games.
  const rows = await db.$queryRawUnsafe<
    { opponentTeamId: number; avg: number; n: number }[]
  >(
    `SELECT opp AS "opponentTeamId", AVG(pg)::float8 AS avg, COUNT(*)::int AS n FROM (
       SELECT s."opponentTeamId" AS opp, s."gameId" AS g, SUM(${expr})::float8 AS pg
       FROM "PlayerGameStat" s
       JOIN "Player" p ON p.id = s."playerId"
       WHERE p.sport = 'mlb' AND p."posBucket" = 'H' AND s.season = $1
       GROUP BY s."opponentTeamId", s."gameId"
     ) t
     GROUP BY opp`,
    season,
  );
  if (rows.length === 0) return [];
  return rankDvp(
    rows.map((r) => ({
      opponentTeamId: Number(r.opponentTeamId),
      avgAllowed: Number(r.avg),
      sampleSize: Number(r.n),
    })),
    'H',
    stat,
  );
}

async function getMlbHitterMatchup(
  stat: StatKey,
  opponentTeamId: number,
  season: string,
): Promise<DvpCell | null> {
  const cells = await getMlbHitterMatchupTable(stat, season);
  return cells.find((c) => c.opponentTeamId === opponentTeamId) ?? null;
}

/** NFL defense-vs-position: a stat each team allows to a position, ranked. */
async function getNflDvpTable(
  posBucket: PosBucket,
  stat: StatKey,
  season: string,
): Promise<DvpCell[]> {
  const expr = NFL_STAT_SQL[stat];
  const invol = NFL_INVOLVEMENT[posBucket];
  if (!expr || !invol) return [];
  // Average the stat allowed to featured players of this bucket, per opponent.
  // No per-player blended threshold (NBA-style) — with ~17 games a fixed
  // involvement floor is simpler and keeps cells from going empty.
  const rows = await db.$queryRawUnsafe<
    { opponentTeamId: number; avg: number; n: number }[]
  >(
    `SELECT s."opponentTeamId" AS "opponentTeamId", AVG(${expr})::float8 AS avg, COUNT(*)::int AS n
     FROM "PlayerGameStat" s
     JOIN "Player" p ON p.id = s."playerId"
     WHERE p.sport = 'nfl' AND p."posBucket" = $1 AND s.season = $2
       AND ${invol.expr} >= ${invol.floor}
     GROUP BY s."opponentTeamId"`,
    posBucket,
    season,
  );
  if (rows.length === 0) return [];
  return rankDvp(
    rows.map((r) => ({
      opponentTeamId: Number(r.opponentTeamId),
      avgAllowed: Number(r.avg),
      sampleSize: Number(r.n),
    })),
    posBucket,
    stat,
  );
}

async function getNflDvp(
  posBucket: PosBucket,
  stat: StatKey,
  opponentTeamId: number,
  season: string,
): Promise<DvpCell | null> {
  const cells = await getNflDvpTable(posBucket, stat, season);
  return cells.find((c) => c.opponentTeamId === opponentTeamId) ?? null;
}

/**
 * Basketball game pace (idea #3) — each team's season pace + the league average.
 * Possessions per team-game ≈ FGA + 0.44·FTA − OREB + TOV (the box-score estimate
 * single-sourced in lib/stats/pace.ts), aggregated to a per-game average per team.
 * NBA and WNBA both store the full basketball box, so both get a pace read.
 * Memoized per request; null off-basketball / on error so the projection just
 * stays pace-neutral.
 */
const getBasketballPaceTable = cache(
  async (
    sport: 'nba' | 'wnba',
    season: string,
  ): Promise<{ byTeam: Map<number, number>; leagueAvg: number } | null> => {
    try {
      const rows = await db.$queryRawUnsafe<{ teamId: number; pace: number }[]>(
        `SELECT "teamId", AVG(poss)::float8 AS pace FROM (
           SELECT s."teamId" AS "teamId", s."gameId" AS gid,
                  SUM(COALESCE(s.fga,0)) + 0.44 * SUM(COALESCE(s.fta,0))
                    - SUM(COALESCE(s.oreb,0)) + SUM(COALESCE(s.turnovers,0)) AS poss
           FROM "PlayerGameStat" s
           JOIN "Player" p ON p.id = s."playerId"
           WHERE p.sport = $2 AND s.season = $1
           GROUP BY s."teamId", s."gameId"
         ) t
         GROUP BY "teamId"`,
        season,
        sport,
      );
      if (rows.length === 0) return null;
      const byTeam = new Map<number, number>();
      let sum = 0;
      for (const r of rows) {
        const pace = Number(r.pace);
        byTeam.set(Number(r.teamId), pace);
        sum += pace;
      }
      return { byTeam, leagueAvg: sum / rows.length };
    } catch (e) {
      console.warn('[pace] getBasketballPaceTable failed:', e instanceof Error ? e.message : e);
      return null;
    }
  },
);

/** Context for the player's NEXT scheduled game: the Vegas-implied team total
 *  (idea #4) and the OPPOSING probable starter (idea #6, MLB). One query. */
async function getNextGameContext(
  sport: Sport,
  teamId: number,
): Promise<{ impliedTotal: number | null; opposingPitcher: string | null }> {
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const game = await db.scheduledGame.findFirst({
    where: {
      sport,
      date: { gte: todayUtc },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: { date: 'asc' },
    select: {
      homeTeamId: true,
      gameTotal: true,
      homeSpread: true,
      homeProbablePitcher: true,
      awayProbablePitcher: true,
    },
  });
  if (!game) return { impliedTotal: null, opposingPitcher: null };
  const isHome = game.homeTeamId === teamId;
  const teamSpread =
    game.homeSpread == null ? 0 : isHome ? game.homeSpread : -game.homeSpread;
  return {
    impliedTotal:
      game.gameTotal == null ? null : impliedTeamTotal(game.gameTotal, teamSpread),
    opposingPitcher: isHome ? game.awayProbablePitcher : game.homeProbablePitcher,
  };
}

/** MLB pitchers by normalized name → player id (null = ambiguous duplicate). Memoized. */
const getMlbPitcherIdByName = cache(async (): Promise<Map<string, number | null>> => {
  const pitchers = await db.player.findMany({
    where: { sport: 'mlb', posBucket: 'P' },
    select: { id: true, firstName: true, lastName: true },
  });
  const m = new Map<string, number | null>();
  for (const p of pitchers) {
    const key = normalizeName(`${p.firstName} ${p.lastName}`);
    m.set(key, m.has(key) ? null : p.id);
  }
  return m;
});

/** League-average pitcher rates per batter faced (K rate, hits-allowed rate) — the
 *  baseline a specific starter is measured against (idea #6). Memoized per request.
 *  Hitters' null pitching columns sum to 0, so this is effectively pitchers-only. */
const getMlbLeaguePitcherRates = cache(
  async (season: string): Promise<{ kRate: number; hitsRate: number } | null> => {
    const agg = await db.playerGameStat.aggregate({
      where: { sport: 'mlb', season },
      _sum: {
        outs: true,
        hitsAllowed: true,
        walksAllowed: true,
        strikeoutsPitched: true,
      },
    });
    const bf =
      (agg._sum.outs ?? 0) + (agg._sum.hitsAllowed ?? 0) + (agg._sum.walksAllowed ?? 0);
    if (bf < 1000) return null;
    return {
      kRate: (agg._sum.strikeoutsPitched ?? 0) / bf,
      hitsRate: (agg._sum.hitsAllowed ?? 0) / bf,
    };
  },
);

/**
 * Opponent multiplier for an MLB HITTER from the specific probable starter (idea #6):
 * a high-strikeout starter boosts a batter-strikeout projection and suppresses hitting
 * props; a hittable starter does the reverse. Stat-aware, clamped ±10%. Null when the
 * pitcher can't be resolved or has too few innings — caller falls back to staff DvP.
 */
async function getMlbPitcherMatchupMultiplier(
  stat: StatKey,
  pitcherName: string,
  season: string,
): Promise<number | null> {
  const pid = (await getMlbPitcherIdByName()).get(normalizeName(pitcherName));
  if (!pid) return null;
  const [agg, league] = await Promise.all([
    db.playerGameStat.aggregate({
      where: { playerId: pid, season },
      _sum: {
        outs: true,
        hitsAllowed: true,
        walksAllowed: true,
        strikeoutsPitched: true,
      },
    }),
    getMlbLeaguePitcherRates(season),
  ]);
  if (!league) return null;
  const bf =
    (agg._sum.outs ?? 0) + (agg._sum.hitsAllowed ?? 0) + (agg._sum.walksAllowed ?? 0);
  if (bf < 100) return null; // too few batters faced to trust the rate
  // Batter-strikeout prop keys off the pitcher's K rate; hitting props off hits allowed.
  const rate =
    stat === 'so'
      ? (agg._sum.strikeoutsPitched ?? 0) / bf
      : (agg._sum.hitsAllowed ?? 0) / bf;
  const leagueRate = stat === 'so' ? league.kRate : league.hitsRate;
  if (leagueRate <= 0) return null;
  return Math.min(1.1, Math.max(0.9, rate / leagueRate));
}

/** League-average implied team total (≈ avg upcoming game total / 2) — the baseline
 *  the environment multiplier is measured against. Memoized per request. */
const getLeagueAvgTeamTotal = cache(async (sport: Sport): Promise<number | null> => {
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const rows = await db.scheduledGame.findMany({
    where: { sport, date: { gte: todayUtc }, gameTotal: { not: null } },
    select: { gameTotal: true },
  });
  if (rows.length === 0) return null;
  const avgGameTotal =
    rows.reduce((s, r) => s + (r.gameTotal as number), 0) / rows.length;
  return avgGameTotal / 2;
});

/**
 * Injury cascade — how a player's line shifts when an impactful teammate is OUT. Ties
 * the live injury feed to our box scores: split the player's games by whether each out
 * teammate actually played (matched by date), and compare. Page-only and purely
 * INFORMATIONAL — it never touches FireFactor, so board/page consistency is unaffected.
 */
async function getTeammateOutSplits(
  sport: Sport,
  playerId: number,
  teamId: number | null,
  playerGames: PlayerGame[],
  stat: StatKey,
  line: number,
  season: string,
): Promise<TeammateSplit[]> {
  if (teamId == null || playerGames.length < 6) return [];
  // Out teammates on the same team.
  const teammates = await db.player
    .findMany({
      where: { sport, teamId, id: { not: playerId }, injury: { is: { status: 'out' } } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        posBucket: true,
        injury: { select: { fantasyStatus: true, detail: true } },
      },
    })
    .catch(() => []);
  if (teammates.length === 0) return [];

  // Their season logs → per-teammate appearance dates + avg opportunity (for impact).
  const logs = await db.playerGameStat.findMany({
    where: { sport, playerId: { in: teammates.map((t) => t.id) }, season },
    select: {
      playerId: true,
      gameDate: true,
      minutes: true,
      atBats: true,
      walks: true,
      hbp: true,
      passAttempts: true,
      rushAttempts: true,
      receptions: true,
      targets: true,
    },
  });
  type Agg = { dates: Set<string>; oppSum: number; oppN: number; bucket: string | null };
  const byId = new Map<number, Agg>();
  for (const t of teammates)
    byId.set(t.id, { dates: new Set(), oppSum: 0, oppN: 0, bucket: t.posBucket });
  for (const g of logs) {
    const a = byId.get(g.playerId);
    if (!a) continue;
    const opp = opportunityFor(sport, a.bucket, g as unknown as PlayerGame);
    if (opp == null) continue; // role not opportunity-tracked (MLB pitcher) — skip
    a.oppN += 1;
    a.oppSum += opp;
    if (opp > 0) a.dates.add(g.gameDate.toISOString().slice(0, 10));
  }

  // Keep impactful out teammates (a real rotation role), strongest first.
  const ranked = teammates
    .map((t) => ({ t, a: byId.get(t.id)! }))
    .filter(({ a }) => a.oppN >= 8 && a.dates.size >= 5)
    .sort((x, y) => y.a.oppSum / y.a.oppN - x.a.oppSum / x.a.oppN)
    .slice(0, 2);

  const splitOf = (subset: PlayerGame[]) => {
    if (subset.length === 0) return { games: 0, mean: null, hitRateOver: null };
    const hr = computeHitRate(subset, stat, line, 'season');
    return { games: subset.length, mean: hr.mean, hitRateOver: hr.hitRateOver };
  };

  const out: TeammateSplit[] = [];
  for (const { t, a } of ranked) {
    const without = playerGames.filter((g) => !a.dates.has(g.gameDate.slice(0, 10)));
    const withT = playerGames.filter((g) => a.dates.has(g.gameDate.slice(0, 10)));
    // Need a usable sample on BOTH sides for a real contrast (drops mid-season-trade
    // cases where the player never shared the floor with the teammate).
    if (without.length < 3 || withT.length < 3) continue;
    out.push({
      name: `${t.firstName} ${t.lastName}`,
      fantasyStatus: t.injury?.fantasyStatus ?? null,
      detail: t.injury?.detail ?? null,
      without: splitOf(without),
      withTeammate: splitOf(withT),
    });
  }
  return out;
}

/**
 * The full research payload for a player page / API response, computed for a
 * stat + line. `stat` defaults to the sport/role default; `line` to the season
 * median rounded to 0.5. An out-of-sport stat falls back to the default.
 */
/** Compare every book's number for a player + stat against the consensus (median),
 *  scoring each by the leaning side's season hit rate. Returns null with < 2 books. */
function lineValueComparison(
  games: PlayerGame[],
  stat: StatKey,
  side: 'over' | 'under',
  linesBySource: { source: string; line: number }[],
): LineValueComparison | null {
  if (linesBySource.length < 2) return null;
  const sorted = linesBySource.map((x) => x.line).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const consensusLine =
    sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const sideRate = (ln: number) => {
    const o = computeHitRate(games, stat, ln, 'season').hitRateOver ?? 0.5;
    return side === 'over' ? o : 1 - o;
  };
  const consRate = sideRate(consensusLine);
  const books = linesBySource.map((x) => {
    const r = sideRate(x.line);
    return { source: x.source, line: x.line, sideHitRate: r, edge: r - consRate };
  });
  books.sort((a, b) => b.edge - a.edge || b.sideHitRate - a.sideHitRate);
  const top = books[0];
  const best =
    top && top.edge > 0.005
      ? { source: top.source, line: top.line, edge: top.edge }
      : null;
  return { side, consensusLine, books, best };
}

export async function getPlayerResearch(
  sport: Sport,
  slug: string,
  statParam?: StatKey,
  lineParam?: number,
  source?: string,
): Promise<PlayerResearch | null> {
  const record = await getPlayerRecord(sport, slug);
  if (!record) return null;
  const player = toSummary(record);
  const season = await getActiveSeason(sport);

  const validKeys = statKeysForSport(sport, record.posBucket);
  const stat: StatKey =
    statParam && validKeys.includes(statParam)
      ? statParam
      : defaultStatForSport(sport, record.posBucket);

  const allGames = await getPlayerGames(record.id);
  // Keep only games where the player got a normal opportunity for their role.
  // NBA minutes are continuous, so the bar is the player's own blended average.
  // MLB plate appearances are small integers clustered at ~4 for regulars, so a
  // bar equal to the average would clip the modal full game (a 4-PA game vs a 4.3
  // average); there we use 60% of normal, dropping cameos (0–2 PA) while keeping
  // full games. Pitchers and soccer players aren't opportunity-filtered (opp == null).
  const qualifyFactor = qualifyFactorFor(sport, record.posBucket);
  const cutoff =
    qualifyFactor *
    blendedRoleThreshold(allGames.map((g) => opportunityFor(sport, record.posBucket, g)));
  const games = allGames.filter((g) => {
    const opp = opportunityFor(sport, record.posBucket, g);
    if (opp == null) return true; // role not opportunity-filtered (MLB pitchers)
    return opp > 0 && opp >= cutoff;
  });
  // Line precedence: an explicit caller line wins; else the chosen book's real
  // line (only when PROVIDED_LINES_ENABLED + that book has one); else the
  // book-style half-point default. lineSource records where `line` came from.
  const src = source ?? DEFAULT_PROVIDED_SOURCE;
  // The chosen source's variant ladder (all rungs) — powers the on-page switcher and
  // supplies the default line. The representative rung (prefer plain line, else demon,
  // else goblin) is the default when the caller didn't pin a line.
  const variants = await getProvidedVariants(sport, record.id, stat, src);
  const providedLine = lineParam == null ? (pickRepresentative(variants, null)?.line ?? null) : null;
  const line = lineParam ?? providedLine ?? defaultPropLine(games, stat);
  // Attribute the line to its book when it matches a known rung (auto-picked, or one
  // the user selected via the switcher); a hand-typed custom number stays sourceless.
  const selectedVariant = variants.find((v) => v.line === line) ?? null;
  const lineSource = selectedVariant ? src : null;

  const windows: WindowResult[] = STAT_WINDOWS.map((w) => {
    const hitRate = computeHitRate(games, stat, line, w);
    return {
      window: String(w),
      hitRate,
      confidence: hitRateConfidence(hitRate.overs, hitRate.decided),
    };
  });

  const seasonResult = windows.find((w) => w.window === 'season')!.hitRate;

  // The matchup card + DvP describe the player's NEXT game (or today's, if it's
  // already started), not a past one. Prefer the next scheduled opponent; fall
  // back to the last completed opponent off-season, flagged so the UI can say so.
  const recentGame = games[0];
  const recentOpponent: MatchupOpponent | null = recentGame
    ? {
        teamId: recentGame.opponentTeamId,
        abbreviation: recentGame.opponentAbbreviation,
        isHome: recentGame.isHome,
        externalId: recentGame.opponentExternalId,
        date: recentGame.gameDate,
        startTime: null,
        gameExternalId: null,
      }
    : null;
  const upcoming = record.team ? await getNextOpponent(sport, record.team.id) : null;
  const matchupOpponent = upcoming
    ? { ...upcoming, isUpcoming: true }
    : recentOpponent
      ? { ...recentOpponent, isUpcoming: false }
      : null;

  let dvp: DvpCell | null = null;
  let unitLabel: string | undefined;
  if (matchupOpponent) {
    if ((sport === 'nba' || sport === 'wnba' || sport === 'nhl') && player.posBucket) {
      dvp = await getMinutesDvp(sport, player.posBucket, stat, matchupOpponent.teamId, season);
      unitLabel = posLabel(sport, player.posBucket);
    } else if (sport === 'mlb' && player.posBucket === 'H') {
      dvp = await getMlbHitterMatchup(stat, matchupOpponent.teamId, season);
      unitLabel = 'hitters';
    } else if (sport === 'nfl' && player.posBucket) {
      dvp = await getNflDvp(player.posBucket, stat, matchupOpponent.teamId, season);
      unitLabel = posLabel(sport, player.posBucket);
    } else if (sport === 'mls' && player.posBucket) {
      dvp = await getSoccerDvp(sport, player.posBucket, stat, matchupOpponent.teamId, season);
      unitLabel = posLabel(sport, player.posBucket);
    }
  }

  const chart: ChartPoint[] = games.slice(0, 20).map((g) => {
    const value = statValue(stat, g);
    return {
      gameDate: g.gameDate,
      opponentAbbreviation: g.opponentAbbreviation,
      isHome: g.isHome,
      value,
      result: value > line ? 'over' : value < line ? 'under' : 'push',
      wl: g.wl,
      plusMinus: g.plusMinus,
    };
  });

  const l10 = windows.find((w) => w.window === '10')!.hitRate;
  const why = buildWhyText({
    playerName: player.fullName,
    stat,
    line,
    recent: l10,
    season: seasonResult,
    dvp: dvp
      ? { cell: dvp, opponentAbbreviation: matchupOpponent!.abbreviation, unitLabel }
      : null,
  });

  // Verdict: the FireFactor "good prop" read + its sub-signals, computed on the
  // qualified games already loaded (no extra query). LEAN mode — VALUE/EV is an
  // opt-in, per-price client read in the fair-price section.
  const grade = dvp ? matchupGrade(dvp) : null;

  // Matchup-adjust the projection in place (idea #3): a soft/tough opponent and the
  // projected game pace (NBA, from box-score totals) nudge the recent-form base. Each
  // factor defaults to neutral, so the projection degrades to pure recent form.
  // Matchup adjustments + grade feed FireFactor ONLY for a real upcoming game — exactly
  // as the board does — so the board and player page produce an IDENTICAL read for the
  // same line/stat/matchup. Off-slate, the projection carries no matchup adjustment.
  const team = record.team;
  const applyMatchup = team != null && matchupOpponent?.isUpcoming === true;
  let opponentMult = 1;
  let paceMult = 1;
  let environmentMult = 1;
  if (applyMatchup && team) {
    opponentMult = dvp ? opponentMultiplierFromCell(dvp) : 1;
    if (sport === 'nba' || sport === 'wnba') {
      const paceTable = await getBasketballPaceTable(sport, season);
      if (paceTable) {
        paceMult = paceMultiplier(
          paceTable.byTeam.get(team.id) ?? null,
          paceTable.byTeam.get(matchupOpponent!.teamId) ?? null,
          paceTable.leagueAvg,
        );
      }
    }
    const [ctx, leagueAvg] = await Promise.all([
      getNextGameContext(sport, team.id),
      getLeagueAvgTeamTotal(sport),
    ]);
    environmentMult = environmentMultiplier(ctx.impliedTotal, leagueAvg);
    // MLB: prefer the specific probable starter's quality over the staff-wide DvP.
    if (sport === 'mlb' && record.posBucket === 'H' && ctx.opposingPitcher) {
      const pitcherMult = await getMlbPitcherMatchupMultiplier(
        stat,
        ctx.opposingPitcher,
        season,
      );
      if (pitcherMult != null) opponentMult = pitcherMult;
    }
  }
  // Volume / usage trend (ideas #7/#8): recent opportunity (minutes, targets, …) vs
  // the season baseline — catches role changes the shrunk stat estimate lags.
  const volumeMult = volumeMultiplier(
    games.map((g) => opportunityFor(sport, record.posBucket, g)),
  );
  const projection = recentFormEstimate(seasonResult.values, seasonResult.mean, {
    opponent: opponentMult,
    pace: paceMult,
    environment: environmentMult,
    volume: volumeMult,
  });
  const consistency = computeConsistency(
    seasonResult.values,
    seasonResult.mean,
    seasonResult.stdev,
    line,
  );

  // Model P(over) — the projection's distribution ANCHORED to the player's own
  // empirical rate at this exact line (the parametric model supplies the matchup
  // shift + a thin-sample prior, never a level the sample contradicts).
  const modelProbOver = calibratedLineProbOver(
    stat,
    projection.projection,
    projection.adjustment,
    seasonResult.stdev,
    line,
    seasonResult.hitRateOver,
    seasonResult.decided,
  );

  // Cross-book market consensus + best price / +EV (idea #1) from the scraped book
  // odds — shown in the market-edge panel. NOT folded into FireFactor: the score must
  // be identical to the board's for the same line, and the board can't price per row.
  const quotes = await getProvidedQuotesBySource(sport, record.id, stat);
  const consensus = quotes.length > 0 ? marketConsensus(quotes, line) : null;
  // Variant breakevens resolve from getBookQuoteMap — the SAME quote set (window,
  // odds filter, per-line dedup) the board scan uses — so a demon/goblin rung's bar
  // (market-implied vs configured approximation) is identical on both surfaces and
  // the same line never shows two different FireFactors. `quotes` above stays on
  // consensus duty: its one-row-per-book shape (any line, 14-day window) is right
  // for the market-edge panel but wrong for exact-line breakeven matching.
  const rungQuotes = (await getBookQuoteMap(sport, [record.id])).get(`${record.id}:${stat}`);

  const ffInput = {
    line,
    windows: windows.map((w) => ({
      window: w.window,
      overs: w.hitRate.overs,
      decided: w.hitRate.decided,
    })),
    projection: projection.projection,
    stdev: seasonResult.stdev,
    modelProbOver,
    cv: consistency.cv,
    matchup: applyMatchup ? (grade ?? undefined) : undefined,
    gamesPlayed: games.length,
    // Demon/goblin/alternate rungs only pay the over — pin the read to that side —
    // and are scored against their payout's breakeven, not a coin flip. The bar is
    // best-info-first: exact multiplier → market-implied (de-vigged book odds at
    // this exact line) → configured approximation.
    overOnly: selectedVariant ? isOverOnly(selectedVariant.oddsType) : false,
    benchmark: selectedVariant ? resolvedBreakeven(selectedVariant, variants, rungQuotes) : undefined,
  };
  // FireFactor is the pure directional signal (hit · projection · consistency · matchup)
  // so it's IDENTICAL on the board and the player page. Price/line-value info (best book,
  // +EV, cross-book discount) is shown in its own panels, never folded into the score.
  const fireScore = computeFireFactor(ffInput);
  const linesBySource = await getProvidedLinesBySource(sport, record.id, stat);
  const lineValue = lineValueComparison(games, stat, fireScore.side, linesBySource);
  const splits = computeSplits(games, stat, line);
  // Injury cascade — this player's line when an impactful teammate is out (informational).
  const teammateSplits = await getTeammateOutSplits(
    sport,
    record.id,
    record.team?.id ?? null,
    games,
    stat,
    line,
    season,
  );

  // Current injury / availability (idea #5) — surfaced as a banner + read gate.
  const injuryRow = await db.playerInjury
    .findUnique({
      where: { playerId: record.id },
      select: {
        status: true,
        rawStatus: true,
        fantasyStatus: true,
        detail: true,
        returnDate: true,
        comment: true,
        news: true,
      },
    })
    .catch(() => null);
  const availability: PlayerAvailability | null = injuryRow
    ? {
        status: injuryRow.status as PlayerAvailability['status'],
        rawStatus: injuryRow.rawStatus,
        fantasyStatus: injuryRow.fantasyStatus,
        detail: injuryRow.detail,
        returnDate: injuryRow.returnDate
          ? injuryRow.returnDate.toISOString().slice(0, 10)
          : null,
        comment: injuryRow.comment,
        news: injuryRow.news,
      }
    : null;
  // Gate the read on availability — Out → no read, game-time tiers discount. Applied
  // identically on the board, so the verdict stays consistent for the same player/line.
  const gatedFireScore = gateAvailability(fireScore, availability?.status);

  // Score every rung of the ladder (each vs ITS OWN payout breakeven) so the ladder
  // compares rungs at a glance and rung switches paint instantly. Reuses the loaded
  // games + line-independent projection; the shown line's read IS the page verdict.
  const scoredVariants = variants.map((v): ProvidedVariant => {
    const rungBreakeven = resolvedBreakeven(v, variants, rungQuotes);
    if (v.line === line)
      return { ...v, breakeven: rungBreakeven, multiplier: sidedMultiplier(v, gatedFireScore.side), read: { side: gatedFireScore.side, score: gatedFireScore.score, tier: gatedFireScore.tier } };
    const rungWindows = STAT_WINDOWS.map((w) => {
      const hr = computeHitRate(games, stat, v.line, w);
      return { window: String(w), overs: hr.overs, decided: hr.decided };
    });
    const rungSeason = computeHitRate(games, stat, v.line, 'season');
    const rungProbOver = calibratedLineProbOver(
      stat, projection.projection, projection.adjustment, seasonResult.stdev, v.line,
      rungSeason.hitRateOver, rungSeason.decided,
    );
    const rungCons = computeConsistency(seasonResult.values, seasonResult.mean, seasonResult.stdev, v.line);
    const fs = gateAvailability(
      computeFireFactor({
        line: v.line,
        windows: rungWindows,
        projection: projection.projection,
        stdev: seasonResult.stdev,
        modelProbOver: rungProbOver,
        cv: rungCons.cv,
        matchup: applyMatchup ? (grade ?? undefined) : undefined,
        gamesPlayed: games.length,
        overOnly: isOverOnly(v.oddsType),
        benchmark: rungBreakeven,
      }),
      availability?.status,
    );
    return { ...v, breakeven: rungBreakeven, multiplier: sidedMultiplier(v, fs.side), read: { side: fs.side, score: fs.score, tier: fs.tier } };
  });

  return {
    player,
    bio: toBio(record),
    stat,
    line,
    lineSource,
    oddsType: selectedVariant?.oddsType ?? null,
    multiplier: selectedVariant ? sidedMultiplier(selectedVariant, gatedFireScore.side) : null,
    variants: scoredVariants,
    lineValue,
    seasonAverage: seasonResult.mean,
    gamesPlayed: games.length,
    // Freshness: the most recent game in the DB for this player (unfiltered by
    // the qualify cutoff), so the "updated through" stamp reflects real data age.
    lastGameDate: allGames[0]?.gameDate ?? null,
    verdict: {
      projection,
      consistency,
      matchupGrade: grade,
      fireScore: gatedFireScore,
      modelProbOver,
      marketConsensus: consensus,
    },
    splits,
    chart,
    windows,
    matchupOpponent,
    dvp,
    availability,
    teammateSplits,
    why,
  };
}

// The popular, well-lined stats we scan for the board (keeps it focused + fast).
// Fantasy Score is a headline PrizePicks market — sourced boards only surface it
// when a book actually posts a line (requireProvided), so scanning it is free
// noise-wise and gives FS lines the same board presence as any other prop.
const BOARD_NBA_STATS: StatKey[] = ['pts', 'reb', 'ast', 'pra', 'fg3m', 'fs'];
const BOARD_MLB_HITTER_STATS: StatKey[] = ['hits', 'tb', 'hr', 'rbi', 'runs', 'hitterFs'];
// NFL board stats by position — 1–2 well-bet markets each, given small samples.
const BOARD_NFL_STATS: Record<string, StatKey[]> = {
  QB: ['passYds', 'passTds', 'fantasyScore'],
  RB: ['rushYds', 'rec', 'fantasyScore'],
  WR: ['recYds', 'rec', 'fantasyScore'],
  TE: ['recYds', 'rec', 'fantasyScore'],
};
// NHL board stats by role: skaters (F/D) get the volume markets; goalies get saves.
const BOARD_NHL_STATS: Record<string, StatKey[]> = {
  F: ['sog', 'pts', 'goals'],
  D: ['sog', 'pts', 'blocked'],
  G: ['saves', 'ga'],
};
// Soccer (MLS) by role — shots markets carry the board; keepers get saves.
const BOARD_SOCCER_STATS: Record<string, StatKey[]> = {
  F: ['shots', 'sot', 'goals'],
  M: ['shots', 'sot'],
  D: ['shots', 'sot'],
  G: ['saves'],
};

function boardStatsFor(sport: Sport, posBucket: string | null): StatKey[] {
  // MLB pitchers are excluded for now (no matchup, and starts aren't filtered).
  if (sport === 'mlb') return posBucket === 'P' ? [] : BOARD_MLB_HITTER_STATS;
  if (sport === 'nfl') return BOARD_NFL_STATS[posBucket ?? ''] ?? [];
  if (sport === 'nhl') return BOARD_NHL_STATS[posBucket ?? ''] ?? [];
  if (sport === 'mls') return BOARD_SOCCER_STATS[posBucket ?? ''] ?? [];
  return BOARD_NBA_STATS; // NBA + WNBA
}

/**
 * Cross-player board: the strongest recent-form leans, ranked by the
 * confidence-adjusted FireFactor vs OUR default (season-median) line — NOT a
 * sportsbook line, so it's a research starting point, not a +EV claim. Free data
 * only (no odds feed). Bounded to the most active players + a small per-player
 * cap for performance and variety. Never throws for an empty result — the route
 * renders an empty state.
 */
export interface BoardOptions {
  /** Max rows returned, after sort + caps (default 40). */
  limit?: number;
  /** How many most-active players to scan (default 120). */
  scan?: number;
  /** Max rows per player (default 2). */
  perPlayerCap?: number;
  /** Max rows per stat (default 10). */
  perStatCap?: number;
  /** Which book's real line to rank against (when PROVIDED_LINES_ENABLED). */
  source?: string;
  /** Pure-slate mode: include ONLY props the chosen book actually offers (its
   * real line), across every market it lists — no computed-median fallback. */
  requireProvidedLine?: boolean;
  /** Reuse an already-loaded pool (the heavy query) instead of loading a fresh one —
   *  lets one page compute board + trends from a single load. */
  pool?: BoardPool;
  /** Teaser surfaces (home/sport-home): build rows from STANDARD rungs only, skipping
   *  stats where the book posts nothing but variants — a demon/goblin/alternate line
   *  never headlines a default view. Ladders still attach for the chips. */
  standardOnly?: boolean;
}

/** Map a PlayerInjury row (the badge-relevant columns) to the slim card shape. */
function toCardAvailability(
  injury:
    | {
        status: string;
        fantasyStatus: string | null;
        detail: string | null;
        returnDate: Date | null;
      }
    | null
    | undefined,
): CardAvailability | null {
  if (!injury) return null;
  return {
    status: injury.status as AvailabilityStatus,
    fantasyStatus: injury.fantasyStatus,
    detail: injury.detail,
    returnDate: injury.returnDate ? injury.returnDate.toISOString().slice(0, 10) : null,
  };
}

/** Current availability per player id for the board (batched) — the status gates the
 *  read; the rest feeds the row's injury badge. */
async function getBoardAvailability(
  sport: Sport,
  playerIds: number[],
): Promise<Map<number, CardAvailability>> {
  const m = new Map<number, CardAvailability>();
  if (playerIds.length === 0) return m;
  const rows = await db.playerInjury
    .findMany({
      where: { sport, playerId: { in: playerIds } },
      select: {
        playerId: true,
        status: true,
        fantasyStatus: true,
        detail: true,
        returnDate: true,
      },
    })
    .catch(() => []);
  for (const r of rows) {
    const a = toCardAvailability(r);
    if (a) m.set(r.playerId, a);
  }
  return m;
}

export async function getBoard(
  sport: Sport,
  opts: BoardOptions = {},
): Promise<BoardRow[]> {
  const { limit = 40, scan = 120, perPlayerCap = 2, perStatCap = 10 } = opts;
  const { players, gamesByPlayer } = opts.pool ?? (await loadBoardPool(sport, scan));
  if (players.length === 0) return [];
  const ids = players.map((p) => p.id);
  // Real lines from the chosen book; empty map (no query) when the feature is off,
  // so the board falls back to the computed default line and behaves as before.
  // The full ladder + book quotes ride along so a variant rung headlining a row is
  // scored against its OWN payout breakeven — the same read every other surface
  // (sourced boards, player page) produces for that line.
  const variantMap = await getProvidedVariantMap(sport, ids, opts.source);
  const providedLines = new Map<string, number>();
  for (const [key, vs] of variantMap) {
    const rep = pickRepresentative(vs, null);
    if (rep) providedLines.set(key, rep.line);
  }
  const bookQuotes = await getBookQuoteMap(sport, ids);
  const season = await getActiveSeason(sport);
  const ctx = await boardMatchupContext(sport, players, season);
  const availability = await getBoardAvailability(sport, ids);
  return computeBoardRows(sport, players, gamesByPlayer, providedLines, {
    limit,
    perPlayerCap,
    perStatCap,
    requireProvided: opts.requireProvidedLine === true,
    variantMap,
    bookQuotes,
    matchupGrades: ctx.grades,
    opponentMults: ctx.opponentMults,
    paceMultByPlayer: ctx.paceMultByPlayer,
    envMultByPlayer: ctx.envMultByPlayer,
    availability,
  });
}

/**
 * One board per book from a SINGLE player+games load (the heavy, egress-costly
 * query). Switching books on the board therefore adds no extra egress — just a
 * small per-source provided-line lookup. Each board is pure-slate (only props that
 * book lists). Returns { [source]: BoardRow[] }.
 */
export async function getSourcedBoards(
  sport: Sport,
  sources: string[],
  opts: BoardOptions = {},
): Promise<Record<string, BoardRow[]>> {
  const { limit = 150, scan = 120, perPlayerCap = 2, perStatCap = 30 } = opts;
  const result: Record<string, BoardRow[]> = {};
  const { players, gamesByPlayer } = opts.pool ?? (await loadBoardPool(sport, scan));
  if (players.length === 0) {
    for (const s of sources) result[s] = [];
    return result;
  }
  const ids = players.map((p) => p.id);
  // Load every book's full variant ladder once. From it derive two per-book line maps:
  //  • normalMaps — the plain/market line only (feeds consensus + "best price" so a
  //    demon/goblin rung never skews line value), and
  //  • repMaps — the representative rung to actually show/score (prefer plain, else
  //    demon, else goblin), picked nearest the cross-book consensus.
  const variantMaps: Record<string, Map<string, ProvidedVariant[]>> = {};
  for (const s of sources) variantMaps[s] = await getProvidedVariantMap(sport, ids, s);
  const normalMaps: Record<string, Map<string, number>> = {};
  for (const s of sources) {
    const nm = new Map<string, number>();
    for (const [key, variants] of variantMaps[s]) {
      const nl = normalLine(variants);
      if (nl != null) nm.set(key, nl);
    }
    normalMaps[s] = nm;
  }
  const consensus = consensusLineMap(normalMaps);
  // Every sportsbook's two-sided quotes, once for the whole board — variant rungs
  // whose exact line a book quotes get a MARKET-IMPLIED breakeven (de-vigged) instead
  // of the configured approximation.
  const bookQuotes = await getBookQuoteMap(sport, ids);
  const repMaps: Record<string, Map<string, number>> = {};
  for (const s of sources) {
    const rm = new Map<string, number>();
    for (const [key, variants] of variantMaps[s]) {
      // standardOnly (the teaser surfaces): rows come from STANDARD rungs only —
      // stats where the book posts nothing but demons/goblins are skipped entirely,
      // so a variant line can never headline a default view. The full ladder still
      // ships on each row, so the chips can funnel through variants on demand.
      const eligible = opts.standardOnly ? variants.filter((v) => isNormalKind(v.oddsType)) : variants;
      const rep = pickRepresentative(eligible, consensus.get(key) ?? null);
      if (rep) rm.set(key, rep.line);
    }
    repMaps[s] = rm;
  }
  const season = await getActiveSeason(sport);
  const ctx = await boardMatchupContext(sport, players, season);
  const availability = await getBoardAvailability(sport, ids);
  for (const s of sources) {
    result[s] = computeBoardRows(sport, players, gamesByPlayer, repMaps[s], {
      limit,
      perPlayerCap,
      perStatCap,
      requireProvided: true,
      lineValue: { allMaps: normalMaps, consensus },
      variantMap: variantMaps[s],
      bookQuotes,
      matchupGrades: ctx.grades,
      opponentMults: ctx.opponentMults,
      paceMultByPlayer: ctx.paceMultByPlayer,
      envMultByPlayer: ctx.envMultByPlayer,
      availability,
    });
  }
  return result;
}

/** Median line per `${playerId}:${stat}` key across every book's line map — the market
 *  consensus the line-value boost + "best price" badge are scored against. */
function consensusLineMap(
  allMaps: Record<string, Map<string, number>>,
): Map<string, number> {
  const byKey = new Map<string, number[]>();
  for (const m of Object.values(allMaps)) {
    for (const [k, v] of m) {
      const arr = byKey.get(k);
      if (arr) arr.push(v);
      else byKey.set(k, [v]);
    }
  }
  const out = new Map<string, number>();
  for (const [k, arr] of byKey) {
    arr.sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    out.set(k, arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2);
  }
  return out;
}

/** Batched matchup CONTEXT for the board: per `${playerId}:${stat}` the next opponent's
 *  DvP grade + opponent multiplier, plus the NBA game-pace multiplier per player — so a
 *  board FireFactor (and its adjusted projection) matches the player page for the same
 *  line/stat/matchup. DvP tables + the pace table load once and are indexed by opponent. */
async function boardMatchupContext(
  sport: Sport,
  players: BoardPlayer[],
  season: string,
): Promise<{
  grades: Map<string, MatchupGrade>;
  opponentMults: Map<string, number>;
  paceMultByPlayer: Map<number, number>;
  envMultByPlayer: Map<number, number>;
}> {
  const grades = new Map<string, MatchupGrade>();
  const opponentMults = new Map<string, number>();
  const paceMultByPlayer = new Map<number, number>();
  const envMultByPlayer = new Map<number, number>();
  const empty = { grades, opponentMults, paceMultByPlayer, envMultByPlayer };
  const teamIds = [
    ...new Set(players.map((p) => p.teamId).filter((x): x is number => x != null)),
  ];
  if (teamIds.length === 0) return empty;

  // Next opponent + game odds per board team — one query over upcoming games, earliest
  // per team (same "next game" the player page resolves via getNextOpponent).
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const games = await db.scheduledGame.findMany({
    where: {
      sport,
      date: { gte: todayUtc },
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
    },
    orderBy: { date: 'asc' },
    select: {
      homeTeamId: true,
      awayTeamId: true,
      gameTotal: true,
      homeSpread: true,
      homeProbablePitcher: true,
      awayProbablePitcher: true,
    },
  });
  const oppByTeam = new Map<number, number>();
  const impliedByTeam = new Map<number, number>();
  // The probable starter a team's HITTERS face (the opposing team's pitcher).
  const oppPitcherByTeam = new Map<number, string>();
  for (const g of games) {
    if (!oppByTeam.has(g.homeTeamId)) oppByTeam.set(g.homeTeamId, g.awayTeamId);
    if (!oppByTeam.has(g.awayTeamId)) oppByTeam.set(g.awayTeamId, g.homeTeamId);
    if (g.awayProbablePitcher && !oppPitcherByTeam.has(g.homeTeamId)) {
      oppPitcherByTeam.set(g.homeTeamId, g.awayProbablePitcher);
    }
    if (g.homeProbablePitcher && !oppPitcherByTeam.has(g.awayTeamId)) {
      oppPitcherByTeam.set(g.awayTeamId, g.homeProbablePitcher);
    }
    if (g.gameTotal != null) {
      const hs = g.homeSpread ?? 0;
      if (!impliedByTeam.has(g.homeTeamId)) {
        impliedByTeam.set(g.homeTeamId, impliedTeamTotal(g.gameTotal, hs)!);
      }
      if (!impliedByTeam.has(g.awayTeamId)) {
        impliedByTeam.set(g.awayTeamId, impliedTeamTotal(g.gameTotal, -hs)!);
      }
    }
  }
  if (oppByTeam.size === 0) return empty;
  // Same league baseline the player page uses (all upcoming games), so env matches exactly.
  const leagueAvgTeamTotal = await getLeagueAvgTeamTotal(sport);

  // DvP cell tables, memoized per (posBucket, stat): opponentTeamId -> cell (the cell
  // feeds both the grade and the opponent multiplier, so they stay in lock-step).
  const tableCache = new Map<string, Map<number, DvpCell>>();
  const cellTable = async (
    bucket: PosBucket,
    stat: StatKey,
  ): Promise<Map<number, DvpCell>> => {
    const key = `${bucket}:${stat}`;
    const cached = tableCache.get(key);
    if (cached) return cached;
    let cells: DvpCell[] = [];
    if (sport === 'nba' || sport === 'wnba' || sport === 'nhl')
      cells = await getMinutesDvpTable(sport, bucket, stat, season);
    else if (sport === 'mlb' && bucket === 'H')
      cells = await getMlbHitterMatchupTable(stat, season);
    else if (sport === 'nfl') cells = await getNflDvpTable(bucket, stat, season);
    else if (sport === 'mls')
      cells = await getSoccerDvpTable(sport, bucket, stat, season);
    const m = new Map<number, DvpCell>();
    for (const c of cells) m.set(c.opponentTeamId, c);
    tableCache.set(key, m);
    return m;
  };

  // Basketball game pace (one league-wide table) — the same projected-game pace
  // applies to all of a player's stats, so it's keyed by player.
  const paceTable =
    sport === 'nba' || sport === 'wnba' ? await getBasketballPaceTable(sport, season) : null;

  // MLB probable-starter quality (idea #6), memoized per (pitcher, hits-vs-K rate) so it's
  // computed once and EXACTLY matches getMlbPitcherMatchupMultiplier(stat, …) on the page.
  const pitcherMultCache = new Map<string, number | null>();
  const pitcherMultFor = async (name: string, stat: StatKey): Promise<number | null> => {
    const key = `${name}:${stat === 'so' ? 'k' : 'h'}`;
    const cached = pitcherMultCache.get(key);
    if (cached !== undefined) return cached;
    const m = await getMlbPitcherMatchupMultiplier(stat, name, season);
    pitcherMultCache.set(key, m);
    return m;
  };

  for (const p of players) {
    if (p.teamId == null || !p.posBucket) continue;
    const opp = oppByTeam.get(p.teamId);
    if (opp == null) continue;
    const bucket = p.posBucket as PosBucket;
    if (paceTable) {
      paceMultByPlayer.set(
        p.id,
        paceMultiplier(
          paceTable.byTeam.get(p.teamId) ?? null,
          paceTable.byTeam.get(opp) ?? null,
          paceTable.leagueAvg,
        ),
      );
    }
    envMultByPlayer.set(
      p.id,
      environmentMultiplier(impliedByTeam.get(p.teamId) ?? null, leagueAvgTeamTotal),
    );
    const pitcherName =
      sport === 'mlb' && bucket === 'H' ? oppPitcherByTeam.get(p.teamId) : undefined;
    for (const stat of statKeysForSport(sport, bucket)) {
      const cell = (await cellTable(bucket, stat)).get(opp);
      if (cell) grades.set(`${p.id}:${stat}`, matchupGrade(cell));
      // Opponent factor: the probable starter's quality (MLB hitter) overrides the staff
      // DvP cell — same precedence as the player page.
      const pitcherMult = pitcherName ? await pitcherMultFor(pitcherName, stat) : null;
      const oppMult =
        pitcherMult != null
          ? pitcherMult
          : cell
            ? opponentMultiplierFromCell(cell)
            : null;
      if (oppMult != null) opponentMults.set(`${p.id}:${stat}`, oppMult);
    }
  }
  return { grades, opponentMults, paceMultByPlayer, envMultByPlayer };
}

/** Rank a loaded player pool into board rows against a given line map (pure compute). */
function computeBoardRows(
  sport: Sport,
  players: BoardPlayer[],
  gamesByPlayer: Map<number, PlayerGame[]>,
  providedLines: Map<string, number>,
  opts: {
    limit: number;
    perPlayerCap: number;
    perStatCap: number;
    requireProvided: boolean;
    /** Present only for the multi-book sourced boards: every book's line map + the
     *  consensus (median per key), so each row can score its book vs the market. */
    lineValue?: { allMaps: Record<string, Map<string, number>>; consensus: Map<string, number> };
    /** This source's variant ladders per `${playerId}:${stat}` — attaches the shown
     *  rung's payout tag/multiplier and the full ladder for the row's icon switcher. */
    variantMap?: Map<string, ProvidedVariant[]>;
    /** Two-sided sportsbook quotes per `${playerId}:${stat}` (every book) — lets a
     *  variant rung's breakeven be MARKET-IMPLIED from de-vigged odds at its exact
     *  line instead of the configured approximation. */
    bookQuotes?: Map<string, RungQuote[]>;
    /** Next-opponent DvP grade per `${playerId}:${stat}`, so the board's FireFactor
     *  includes the same matchup component as the player page. */
    matchupGrades?: Map<string, MatchupGrade>;
    /** Opponent projection multiplier per `${playerId}:${stat}` (matches the page). */
    opponentMults?: Map<string, number>;
    /** NBA game-pace multiplier per player (matches the page). */
    paceMultByPlayer?: Map<number, number>;
    /** Vegas game-environment multiplier per player (matches the page). */
    envMultByPlayer?: Map<number, number>;
    /** Current availability per player — Out players are dropped; game-time tiers
     *  discount the read (same gate the player page applies) and badge the row. */
    availability?: Map<number, CardAvailability>;
  },
): BoardRow[] {
  const { limit, perPlayerCap, perStatCap, requireProvided } = opts;
  const out: Omit<BoardRow, 'rank'>[] = [];
  for (const p of players) {
    // Never surface a benched player as a board lean.
    const avail = opts.availability?.get(p.id);
    if (avail?.status === 'out') continue;
    const allGames = gamesByPlayer.get(p.id);
    if (!allGames || allGames.length < FIREFACTOR_MIN_GAMES) continue;
    const games = qualifyGames(sport, p.posBucket, allGames);
    if (games.length < FIREFACTOR_MIN_GAMES) continue;
    const listItem = boardListItem(sport, p, games.length, avail);
    // Volume/usage trend is per-player (same for all of their stats).
    const volumeMult = volumeMultiplier(
      games.map((g) => opportunityFor(sport, p.posBucket, g)),
    );

    for (const { stat, line, provided } of statLinesFor(
      sport,
      p.posBucket,
      games,
      providedLines,
      p.id,
      requireProvided,
    )) {
      // Skip degenerate low-volume props ONLY for our computed median line — a 0.5
      // median means the player typically records 0, so any "lean" is a trivial
      // under. A real book line of 0.5 (e.g. "over 0.5 HR") is a legitimate prop.
      if (!provided && line <= 0.5) continue;
      const windows = STAT_WINDOWS.map((w) => {
        const hr = computeHitRate(games, stat, line, w);
        return { window: String(w), overs: hr.overs, decided: hr.decided };
      });
      const seasonHr = computeHitRate(games, stat, line, 'season');
      // Matchup-adjust the projection (opponent + pace) from the batched context maps,
      // then derive the model P(over) — the SAME path as the player page.
      const projection = recentFormEstimate(seasonHr.values, seasonHr.mean, {
        opponent: opts.opponentMults?.get(`${p.id}:${stat}`) ?? 1,
        pace: opts.paceMultByPlayer?.get(p.id) ?? 1,
        environment: opts.envMultByPlayer?.get(p.id) ?? 1,
        volume: volumeMult,
      });
      const modelProbOver = calibratedLineProbOver(
        stat,
        projection.projection,
        projection.adjustment,
        seasonHr.stdev,
        line,
        seasonHr.hitRateOver,
        seasonHr.decided,
      );
      const consistency = computeConsistency(
        seasonHr.values,
        seasonHr.mean,
        seasonHr.stdev,
        line,
      );
      // The shown rung (for its payout tag/multiplier + the over-only side pin) — the
      // full ladder also ships on the row for the icon switcher (sourced boards only).
      const variants = opts.variantMap?.get(`${p.id}:${stat}`);
      const shownRung = variants?.find((v) => v.line === line) ?? null;
      const rungQuotes = opts.bookQuotes?.get(`${p.id}:${stat}`);
      // Matchup grade (next opponent's DvP) comes from the batched `matchupGrades` map
      // so the board's FireFactor matches the player page; absent → degrades gracefully.
      const ffInput = {
        line,
        windows,
        projection: projection.projection,
        stdev: seasonHr.stdev,
        modelProbOver,
        cv: consistency.cv,
        matchup: opts.matchupGrades?.get(`${p.id}:${stat}`),
        gamesPlayed: games.length,
        // Demon/goblin/alternate rungs only pay the over — pin the read to that side —
        // and are scored against their payout's breakeven, not a coin flip.
        overOnly: shownRung ? isOverOnly(shownRung.oddsType) : false,
        benchmark: shownRung && variants ? resolvedBreakeven(shownRung, variants, rungQuotes) : undefined,
      };
      // FireFactor is the pure directional signal — IDENTICAL to the player page for the
      // same line/stat/matchup. Line-value (best price, cross-book discount) is a separate
      // badge, never folded into the score. The availability gate (game-time discount; Out
      // already dropped above) is the SAME one the page applies, so the read stays consistent.
      const fireScore = gateAvailability(computeFireFactor(ffInput), avail?.status);
      // A 0.5 book line's only meaningful lean is the OVER ("will it happen"). The
      // under ("it won't") is trivial/obvious — never feature it as a top lean.
      if (line <= 0.5 && fireScore.side === 'under') continue;

      // Cross-book line value badge (best price across books) — display only.
      let rowLineValue: BoardRow['lineValue'] = null;
      if (opts.lineValue) {
        const key = `${p.id}:${stat}`;
        const consensusLine = opts.lineValue.consensus.get(key);
        const allLines: { source: string; line: number }[] = [];
        for (const [src, m] of Object.entries(opts.lineValue.allMaps)) {
          const ln = m.get(key);
          if (ln != null) allLines.push({ source: src, line: ln });
        }
        if (consensusLine != null && allLines.length >= 2) {
          const rate = (ln: number) => {
            const o =
              ln === line
                ? (seasonHr.hitRateOver ?? 0.5)
                : (computeHitRate(games, stat, ln, 'season').hitRateOver ?? 0.5);
            return fireScore.side === 'over' ? o : 1 - o;
          };
          const consRate = rate(consensusLine);
          const edge = rate(line) - consRate;
          let best: { source: string; line: number; edge: number } | null = null;
          for (const b of allLines) {
            const e = rate(b.line) - consRate;
            if (!best || e > best.edge)
              best = { source: b.source, line: b.line, edge: e };
          }
          if (best && best.edge <= 0.005) best = null;
          rowLineValue = { edge, best };
        }
      }

      // Score the OTHER rungs too, each vs its own breakeven — chips switch with a
      // read already in hand, kind-filtered views rank by the rung they'll show, and
      // a hot demon keeps an otherwise-passing row on the board.
      const scoredVariants = variants?.map((v): ProvidedVariant => {
        const rungBreakeven = resolvedBreakeven(v, variants, rungQuotes);
        if (v.line === line)
          return { ...v, breakeven: rungBreakeven, multiplier: sidedMultiplier(v, fireScore.side), read: { side: fireScore.side, score: fireScore.score, tier: fireScore.tier } };
        const rungWindows = STAT_WINDOWS.map((w) => {
          const hr = computeHitRate(games, stat, v.line, w);
          return { window: String(w), overs: hr.overs, decided: hr.decided };
        });
        const rungSeason = computeHitRate(games, stat, v.line, 'season');
        const rungProbOver = calibratedLineProbOver(
          stat, projection.projection, projection.adjustment, seasonHr.stdev, v.line,
          rungSeason.hitRateOver, rungSeason.decided,
        );
        const rungCons = computeConsistency(seasonHr.values, seasonHr.mean, seasonHr.stdev, v.line);
        const fs = gateAvailability(
          computeFireFactor({
            line: v.line,
            windows: rungWindows,
            projection: projection.projection,
            stdev: seasonHr.stdev,
            modelProbOver: rungProbOver,
            cv: rungCons.cv,
            matchup: opts.matchupGrades?.get(`${p.id}:${stat}`),
            gamesPlayed: games.length,
            overOnly: isOverOnly(v.oddsType),
            benchmark: rungBreakeven,
          }),
          avail?.status,
        );
        return { ...v, breakeven: rungBreakeven, multiplier: sidedMultiplier(v, fs.side), read: { side: fs.side, score: fs.score, tier: fs.tier } };
      });

      out.push({
        player: listItem,
        stat,
        statShort: STAT_DEFS[stat].short,
        line,
        projection: projection.projection,
        fireScore,
        lineValue: rowLineValue,
        oddsType: shownRung?.oddsType ?? null,
        multiplier: shownRung ? sidedMultiplier(shownRung, fireScore.side) : null,
        variants: scoredVariants,
      });
    }
  }

  // Rank by the SHOWN line's read — what the row actually displays — so the board
  // reads as strictly FireFactor-sorted. Ties break toward the row whose best rung
  // is stronger, which also keeps a hot-demon row inside the caps a beat longer;
  // kind-filtered views re-rank client-side by the rung they switch to.
  out.sort(
    (a, b) =>
      b.fireScore.score - a.fireScore.score ||
      bestVariantScore(b.fireScore.score, b.variants) -
        bestVariantScore(a.fireScore.score, a.variants),
  );
  return capBoardRows(out, limit, perPlayerCap, perStatCap);
}

// ---- Shared board-scan helpers (streaks / trends reuse getBoard's load) ----

type BoardPlayer = {
  id: number;
  externalId: number;
  slug: string;
  firstName: string;
  lastName: string;
  position: string | null;
  posBucket: string | null;
  jersey: string | null;
  height: string | null;
  weight: number | null;
  /** Team FK (DB id) — used to resolve each player's next opponent for the board matchup. */
  teamId: number | null;
  team: { abbreviation: string; name: string; externalId: number } | null;
};

// Columns the board needs, per sport. PlayerGameStat carries all 3 sports' ~50
// columns; selecting only the current sport's (plus the shared meta) roughly halves
// each row's wire size — the single biggest lever on Supabase egress, since the
// board reads every game for 120+ players on each render.
const BOARD_META_SELECT = {
  playerId: true,
  gameDate: true,
  opponentTeamId: true,
  isHome: true,
  wl: true,
  plusMinus: true,
  minutes: true,
  opponentTeam: { select: { abbreviation: true, externalId: true } },
};
const BOARD_STAT_COLS: Record<Sport, Record<string, true>> = {
  nba: {
    points: true,
    rebounds: true,
    oreb: true,
    dreb: true,
    assists: true,
    steals: true,
    blocks: true,
    turnovers: true,
    fouls: true,
    fgm: true,
    fga: true,
    fg3m: true,
    fg3a: true,
    ftm: true,
    fta: true,
  },
  mlb: {
    atBats: true,
    hits: true,
    doubles: true,
    triples: true,
    homeRuns: true,
    runs: true,
    rbi: true,
    walks: true,
    strikeouts: true,
    stolenBases: true,
    totalBases: true,
    hbp: true,
    outs: true,
    hitsAllowed: true,
    runsAllowed: true,
    earnedRuns: true,
    walksAllowed: true,
    strikeoutsPitched: true,
  },
  nfl: {
    passYards: true,
    passTds: true,
    passCompletions: true,
    passAttempts: true,
    passInts: true,
    rushYards: true,
    rushAttempts: true,
    rushTds: true,
    receptions: true,
    targets: true,
    recYards: true,
    recTds: true,
    fumblesLost: true,
  },
  // WNBA rows populate the shared basketball columns.
  wnba: {
    points: true,
    rebounds: true,
    oreb: true,
    dreb: true,
    assists: true,
    steals: true,
    blocks: true,
    turnovers: true,
    fouls: true,
    fgm: true,
    fga: true,
    fg3m: true,
    fg3a: true,
    ftm: true,
    fta: true,
  },
  // NHL: skater columns + the shared points/assists, plus the goalie columns.
  nhl: {
    points: true,
    assists: true,
    goals: true,
    shotsOnGoal: true,
    hitsDelivered: true,
    blockedShots: true,
    faceoffsWon: true,
    saves: true,
    goalsAgainst: true,
    shotsAgainst: true,
  },
  mls: {
    goals: true,
    assists: true,
    shots: true,
    shotsOnTarget: true,
    fouls: true,
    saves: true,
    goalsAgainst: true,
    shotsAgainst: true,
  },
};
function boardStatSelect(sport: Sport) {
  return { ...BOARD_META_SELECT, ...BOARD_STAT_COLS[sport] };
}

/** The heavy board-scan load (players + every game), shareable across the board and
 *  trends computations on one page so it's paid once. */
export type BoardPool = { players: BoardPlayer[]; gamesByPlayer: Map<number, PlayerGame[]> };

/** Top-`scan` most-active players + all their games (one batched query each). */
async function loadBoardPool(sport: Sport, scan: number): Promise<BoardPool> {
  const players = await db.player.findMany({
    where: { sport },
    include: { team: { select: { abbreviation: true, name: true, externalId: true } } },
    orderBy: { gameStats: { _count: 'desc' } },
    take: scan,
  });
  if (players.length === 0) return { players: [], gamesByPlayer: new Map() };
  // Per-sport column select (egress saver). The dynamic select loses Prisma's precise
  // payload type, so map through StatGameRow (stat fields optional; missing → 0).
  const rows = (await db.playerGameStat.findMany({
    where: { playerId: { in: players.map((p) => p.id) } },
    orderBy: { gameDate: 'desc' },
    select: boardStatSelect(sport),
  })) as unknown as Array<StatGameRow & { playerId: number }>;
  const gamesByPlayer = new Map<number, PlayerGame[]>();
  for (const r of rows) {
    const list = gamesByPlayer.get(r.playerId);
    if (list) list.push(toPlayerGame(r));
    else gamesByPlayer.set(r.playerId, [toPlayerGame(r)]);
  }
  return { players, gamesByPlayer };
}

/** Keep only games where the player got their normal role-relative opportunity. */
function qualifyGames(
  sport: Sport,
  posBucket: string | null,
  allGames: PlayerGame[],
): PlayerGame[] {
  const qualifyFactor = qualifyFactorFor(sport, posBucket);
  const cutoff =
    qualifyFactor *
    blendedRoleThreshold(allGames.map((g) => opportunityFor(sport, posBucket, g)));
  return allGames.filter((g) => {
    const opp = opportunityFor(sport, posBucket, g);
    if (opp == null) return true;
    return opp > 0 && opp >= cutoff;
  });
}

function boardListItem(
  sport: Sport,
  p: BoardPlayer,
  gamesPlayed: number,
  availability?: CardAvailability,
): PlayerListItem {
  return {
    sport,
    externalId: p.externalId,
    slug: p.slug,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: `${p.firstName} ${p.lastName}`.trim(),
    position: p.position ?? null,
    posBucket: (p.posBucket as PosBucket | null) ?? null,
    jersey: p.jersey ?? null,
    height: p.height ?? null,
    weight: p.weight ?? null,
    teamAbbreviation: p.team?.abbreviation ?? null,
    teamName: teamDisplayName(sport, p.team?.abbreviation, p.team?.name ?? null),
    teamExternalId: p.team?.externalId ?? null,
    gamesPlayed,
    availability: availability ?? null,
  };
}

/** Sort-then-cap: per-player + per-stat caps, assign a 1-based rank. */
function capBoardRows<T extends { player: PlayerListItem; stat: StatKey }>(
  rows: T[],
  limit: number,
  perPlayerCap: number,
  perStatCap: number,
): (T & { rank: number })[] {
  const perPlayer = new Map<string, number>();
  const perStat = new Map<string, number>();
  const capped: (T & { rank: number })[] = [];
  for (const r of rows) {
    const np = perPlayer.get(r.player.slug) ?? 0;
    const ns = perStat.get(r.stat) ?? 0;
    if (np >= perPlayerCap || ns >= perStatCap) continue;
    perPlayer.set(r.player.slug, np + 1);
    perStat.set(r.stat, ns + 1);
    capped.push({ ...r, rank: capped.length + 1 });
    if (capped.length >= limit) break;
  }
  return capped;
}

interface BoardScanOptions {
  limit?: number;
  scan?: number;
  perPlayerCap?: number;
  perStatCap?: number;
  /** Which book's real line to use (when PROVIDED_LINES_ENABLED). */
  source?: string;
  /** Pure-slate: only props the chosen book lists (its real line), no median fallback. */
  requireProvidedLine?: boolean;
  /** Reuse an already-loaded pool (the heavy query) instead of loading a fresh one —
   *  lets one page compute board + trends from a single load. */
  pool?: BoardPool;
}

/** The (stat, line) pairs to evaluate for a player — book props (pure-slate) or the
 *  curated board stats vs the book line / our median. Shared by board/streaks/trends. */
function statLinesFor(
  sport: Sport,
  posBucket: string | null,
  games: PlayerGame[],
  providedLines: Map<string, number>,
  playerId: number,
  requireProvided: boolean,
): Array<{ stat: StatKey; line: number; provided: boolean }> {
  if (requireProvided) {
    return statKeysForSport(sport, posBucket).flatMap((stat) => {
      const provided = providedLines.get(`${playerId}:${stat}`);
      return provided != null ? [{ stat, line: provided, provided: true }] : [];
    });
  }
  return boardStatsFor(sport, posBucket).map((stat) => {
    const book = providedLines.get(`${playerId}:${stat}`);
    return book != null
      ? { stat, line: book, provided: true }
      : { stat, line: defaultLine(games, stat), provided: false };
  });
}

/** Minimum consecutive games to count as a streak worth surfacing. */
const STREAK_MIN_LENGTH = 3;
/** Minimum recent-vs-season swing (on the leaning side) to surface a trend. */
const TREND_MIN_SWING = 0.18;

type ScanComputeOpts = {
  limit: number;
  perPlayerCap: number;
  perStatCap: number;
  /** Current availability per player — badges the trend row (trends don't gate). */
  availability?: Map<number, CardAvailability>;
  /** This source's variant ladders per `${playerId}:${stat}` — tags each trend row
   *  with its rung's payout kind and ships the ladder for the kind filter. */
  variantMap?: Map<string, ProvidedVariant[]>;
};

/** Trends from a loaded pool vs a line map (pure compute). Players whose RECENT
 *  (L10) form has swung hardest from their season baseline, ranked by Wilson lower. */
function computeTrendRows(
  sport: Sport,
  players: BoardPlayer[],
  gamesByPlayer: Map<number, PlayerGame[]>,
  providedLines: Map<string, number>,
  requireProvided: boolean,
  opts: ScanComputeOpts,
): TrendRow[] {
  const out: Omit<TrendRow, 'rank'>[] = [];
  for (const p of players) {
    const allGames = gamesByPlayer.get(p.id);
    if (!allGames || allGames.length < FIREFACTOR_MIN_GAMES) continue;
    const games = qualifyGames(sport, p.posBucket, allGames);
    if (games.length < FIREFACTOR_MIN_GAMES) continue;
    const listItem = boardListItem(sport, p, games.length, opts.availability?.get(p.id));
    for (const { stat, line, provided } of statLinesFor(
      sport,
      p.posBucket,
      games,
      providedLines,
      p.id,
      requireProvided,
    )) {
      if (!provided && line <= 0.5) continue;
      // Evaluate the swing at ONE line; null when it doesn't qualify as a trend
      // (thin sample, sub-threshold swing, trivial 0.5-under, or an under swing on
      // an over-only rung — not playable at the book).
      const evalRung = (
        rungLine: number,
        oddsType: string | null,
        multiplier: number | null,
        odds?: { overOdds: number | null; underOdds: number | null },
      ): TrendRung | null => {
        const recent = computeHitRate(games, stat, rungLine, 10);
        const season = computeHitRate(games, stat, rungLine, 'season');
        if (recent.decided < 4 || season.decided < FIREFACTOR_MIN_GAMES) return null;
        const recentOver = recent.hitRateOver ?? 0.5;
        const side: 'over' | 'under' = recentOver >= 0.5 ? 'over' : 'under';
        if (rungLine <= 0.5 && side === 'under') return null; // trivial under on a 0.5 line
        if (side === 'under' && isOverOnly(oddsType)) return null;
        // Show the leaned side's payout for two-way priced lines (Sleeper).
        const shownMult = sidedMultiplier({ multiplier, ...odds }, side);
        const recentRate = side === 'over' ? recentOver : 1 - recentOver;
        const seasonOver = season.hitRateOver ?? 0.5;
        const seasonRate = side === 'over' ? seasonOver : 1 - seasonOver;
        const delta = recentRate - seasonRate;
        if (delta < TREND_MIN_SWING) return null;
        const successes = side === 'over' ? recent.overs : recent.unders;
        // The player's current consecutive run for this stat+line — the merged
        // "Streaks" metric, shown alongside the L10 swing.
        const run = computeStreak(
          games.map((g) => statValue(stat, g)),
          rungLine,
        );
        return {
          line: rungLine,
          oddsType,
          multiplier: shownMult,
          side,
          recentRate,
          recentLower: wilsonInterval(successes, recent.decided).lower,
          recentGames: recent.decided,
          seasonRate,
          delta,
          streak:
            run.side !== null && run.length >= STREAK_MIN_LENGTH
              ? { side: run.side, length: run.length }
              : null,
        };
      };

      // Score EVERY rung of the ladder (the filter can show "goblins only" — those
      // rows must display the goblin line's own trend); the median/computed path has
      // no ladder and evaluates just the one line.
      const ladder = opts.variantMap?.get(`${p.id}:${stat}`);
      const rungTrends: TrendRung[] = [];
      const qualifying: ProvidedVariant[] = [];
      if (ladder && ladder.length > 0) {
        for (const v of ladder) {
          const rt = evalRung(v.line, v.oddsType, v.multiplier, { overOdds: v.overOdds, underOdds: v.underOdds });
          if (rt) {
            rungTrends.push(rt);
            qualifying.push(v);
          }
        }
      } else {
        const rt = evalRung(line, null, null);
        if (rt) rungTrends.push(rt);
      }
      if (rungTrends.length === 0) continue;

      // The row's headline snapshot: the standard rung when it qualifies (matching
      // the standard-only default view), else the strongest qualifying swing.
      const top =
        rungTrends.find((rt) => !isOverOnly(rt.oddsType)) ??
        [...rungTrends].sort((a, b) => b.recentLower - a.recentLower)[0];

      out.push({
        player: listItem,
        stat,
        statShort: STAT_DEFS[stat].short,
        line: top.line,
        side: top.side,
        recentRate: top.recentRate,
        recentLower: top.recentLower,
        recentGames: top.recentGames,
        seasonRate: top.seasonRate,
        delta: top.delta,
        streak: top.streak,
        oddsType: top.oddsType,
        multiplier: top.multiplier,
        variants: qualifying.length > 0 ? qualifying : undefined,
        rungTrends: ladder ? rungTrends : undefined,
      });
    }
  }
  out.sort((a, b) => b.recentLower - a.recentLower || b.delta - a.delta);
  return capBoardRows(out, opts.limit, opts.perPlayerCap, opts.perStatCap);
}

export async function getTrendBoard(
  sport: Sport,
  opts: BoardScanOptions = {},
): Promise<TrendRow[]> {
  const { limit = 80, scan = 140, perPlayerCap = 1, perStatCap = 25 } = opts;
  const { players, gamesByPlayer } = opts.pool ?? (await loadBoardPool(sport, scan));
  const providedLines = await getProvidedLineMap(
    sport,
    players.map((p) => p.id),
    opts.source,
  );
  const availability = await getBoardAvailability(
    sport,
    players.map((p) => p.id),
  );
  return computeTrendRows(
    sport,
    players,
    gamesByPlayer,
    providedLines,
    opts.requireProvidedLine === true,
    {
      limit,
      perPlayerCap,
      perStatCap,
      availability,
    },
  );
}

/** One trends board per book from a single pool load (vs the book's real lines).
 *  Each row carries its rung's payout tag + the ladder, so the trends pages get the
 *  same variant badges/filter the Heat Check has. */
export async function getSourcedTrends(
  sport: Sport,
  sources: string[],
  opts: BoardScanOptions = {},
): Promise<Record<string, TrendRow[]>> {
  const { limit = 80, scan = 140, perPlayerCap = 1, perStatCap = 25 } = opts;
  const result: Record<string, TrendRow[]> = {};
  const { players, gamesByPlayer } = opts.pool ?? (await loadBoardPool(sport, scan));
  const ids = players.map((p) => p.id);
  const availability = await getBoardAvailability(sport, ids);
  for (const s of sources) {
    // Full ladders (not just the representative line) so rows can be tagged/filtered
    // by kind; the trend itself is computed vs the representative rung.
    const variantMap = await getProvidedVariantMap(sport, ids, s);
    const providedLines = new Map<string, number>();
    for (const [key, variants] of variantMap) {
      const rep = pickRepresentative(variants, null);
      if (rep) providedLines.set(key, rep.line);
    }
    result[s] = computeTrendRows(sport, players, gamesByPlayer, providedLines, true, {
      limit,
      perPlayerCap,
      perStatCap,
      availability,
      variantMap,
    });
  }
  return result;
}

/**
 * Board + trends for one sport from a SINGLE pool load — the heavy players+games
 * query is the dominant cost of both scans, so a page that wants both (the sport
 * home hub) pays it once. Options mirror getSourcedBoards / getSourcedTrends.
 */
export async function getSourcedBoardsAndTrends(
  sport: Sport,
  sources: string[],
  boardOpts: BoardOptions = {},
  trendOpts: BoardScanOptions = {},
): Promise<{ boards: Record<string, BoardRow[]>; trends: Record<string, TrendRow[]> }> {
  // The pool is "top-N most-active players"; load the larger N so both scans are
  // at least as deep as they'd be standalone.
  const scan = Math.max(boardOpts.scan ?? 120, trendOpts.scan ?? 140);
  const pool = await loadBoardPool(sport, scan);
  const boards = await getSourcedBoards(sport, sources, { ...boardOpts, pool });
  const trends = await getSourcedTrends(sport, sources, { ...trendOpts, pool });
  return { boards, trends };
}

/**
 * Full defense-vs-position (NBA) / pitching-allowed (MLB) table for a stat:
 * every team ranked by how much of the stat they allow, with an A–F grade.
 */
export async function getDvpTable(
  sport: Sport,
  stat: StatKey,
  posBucket: PosBucket,
): Promise<DvpTableRow[]> {
  const season = await getActiveSeason(sport);
  const cells =
    sport === 'nba' || sport === 'wnba' || sport === 'nhl'
      ? await getMinutesDvpTable(sport, posBucket, stat, season)
      : sport === 'nfl'
        ? await getNflDvpTable(posBucket, stat, season)
        : sport === 'mls'
          ? await getSoccerDvpTable(sport, posBucket, stat, season)
          : await getMlbHitterMatchupTable(stat, season);
  if (cells.length === 0) return [];
  const teams = await db.team.findMany({
    where: { sport },
    select: { id: true, abbreviation: true, name: true, externalId: true },
  });
  const byId = new Map(teams.map((t) => [t.id, t]));
  return cells
    .map((c) => {
      const t = byId.get(c.opponentTeamId);
      return {
        rank: c.rank,
        totalRanked: c.totalRanked,
        teamAbbreviation: t?.abbreviation ?? '',
        teamName:
          teamDisplayName(sport, t?.abbreviation, t?.name ?? null) ??
          t?.abbreviation ??
          '',
        teamExternalId: t?.externalId ?? 0,
        avgAllowed: c.avgAllowed,
        sampleSize: c.sampleSize,
        lowSample: c.lowSample,
        grade: matchupGrade(c),
      };
    })
    .sort((a, b) => a.rank - b.rank);
}

/** Season per-game leaders for a stat, qualified by a minimum games-played. */
// Whitelisted per-sport stat SQL for the leaderboard / DvP raw queries.
const LEADER_STAT_SQL: Record<Sport, Partial<Record<StatKey, string>>> = {
  nba: NBA_STAT_SQL,
  wnba: NBA_STAT_SQL,
  mlb: MLB_HIT_SQL,
  nfl: NFL_STAT_SQL,
  nhl: NHL_STAT_SQL,
  mls: SOCCER_STAT_SQL,
};

// Minimum games played to qualify for a per-game leaderboard — scaled to each
// season's length (82 NBA/NHL, ~40 WNBA, 162 MLB, 17 NFL, 34-38 soccer).
const LEADER_MIN_GAMES: Record<Sport, number> = {
  nba: 12,
  wnba: 8,
  mlb: 20,
  nfl: 6,
  nhl: 12,
  mls: 6,
};

export async function getLeaders(
  sport: Sport,
  stat: StatKey,
  limit = 50,
): Promise<LeaderRow[]> {
  const expr = LEADER_STAT_SQL[sport][stat];
  if (!expr) return [];
  const season = await getActiveSeason(sport);
  const minGames = LEADER_MIN_GAMES[sport];
  // `expr` is from the internal whitelist (never user input); params are bound.
  // NFL rows exist only for games a player featured in, so no appearance filter;
  // soccer has no per-player minutes to filter on.
  const appearanceFilter =
    sport === 'nba' || sport === 'wnba' || sport === 'nhl'
      ? `AND s.minutes IS NOT NULL AND s.minutes > 0`
      : sport === 'mlb'
        ? `AND p."posBucket" = 'H'`
        : ``;
  // NFL passing stats belong to QBs — a WR's trick-play pass shouldn't crowd the
  // leaderboard. Rushing/receiving stay open (a mobile QB belongs on the rushing
  // board) — handled by avg>0 + the on-page position filter. Same idea for the
  // NHL/soccer goalie markets: saves/goals-against boards are goalies-only.
  const positionFilter =
    sport === 'nfl' &&
    (['passYds', 'passTds', 'passCmp', 'passAtt', 'ints'] as StatKey[]).includes(stat)
      ? `AND p."posBucket" = 'QB'`
      : (sport === 'nhl' || sport === 'mls') &&
          (['saves', 'ga', 'sa'] as StatKey[]).includes(stat)
        ? `AND p."posBucket" = 'G'`
        : '';
  const rows = await db.$queryRawUnsafe<{ playerId: number; avg: number; n: number }[]>(
    `SELECT s."playerId" AS "playerId", AVG(${expr})::float8 AS avg, COUNT(*)::int AS n
     FROM "PlayerGameStat" s
     JOIN "Player" p ON p.id = s."playerId"
     WHERE p.sport = $1 AND s.season = $2 ${appearanceFilter} ${positionFilter}
     GROUP BY s."playerId"
     HAVING COUNT(*) >= $3 AND AVG(${expr}) > 0
     ORDER BY avg DESC
     LIMIT $4`,
    sport,
    season,
    minGames,
    limit,
  );
  if (rows.length === 0) return [];
  const players = await db.player.findMany({
    where: { id: { in: rows.map((r) => Number(r.playerId)) } },
    include: {
      team: { select: { abbreviation: true, name: true, externalId: true } },
      injury: {
        select: { status: true, fantasyStatus: true, detail: true, returnDate: true },
      },
    },
  });
  const byId = new Map(players.map((p) => [p.id, p]));
  const out: LeaderRow[] = [];
  for (const r of rows) {
    const p = byId.get(Number(r.playerId));
    if (!p) continue;
    out.push({
      rank: out.length + 1,
      player: boardListItem(
        sport,
        p,
        Number(r.n),
        toCardAvailability(p.injury) ?? undefined,
      ),
      perGame: Number(r.avg),
      gamesPlayed: Number(r.n),
    });
  }
  return out;
}

/**
 * Analyze a pasted slate of REAL book lines: parse each line, resolve the player
 * (exact name, else a unique last-name match — never a guess), and compute the
 * FireFactor against the user's actual number (not our median), plus edge + EV
 * when odds are supplied. Capped at 30 entries. Unmatched lines come back with a
 * reason instead of being dropped.
 */
export async function analyzeSlate(sport: Sport, text: string): Promise<SlateResult[]> {
  const entries = parseSlate(text).slice(0, 30);
  if (entries.length === 0) return [];

  const roster = await db.player.findMany({
    where: { sport },
    select: { slug: true, firstName: true, lastName: true, posBucket: true },
  });
  type RosterPlayer = (typeof roster)[number];
  const byFullName = new Map<string, RosterPlayer>();
  const byLastName = new Map<string, RosterPlayer[]>();
  for (const p of roster) {
    byFullName.set(normalizeName(`${p.firstName} ${p.lastName}`), p);
    const last = normalizeName(p.lastName);
    const list = byLastName.get(last);
    if (list) list.push(p);
    else byLastName.set(last, [p]);
  }

  const results: SlateResult[] = [];
  for (const e of entries) {
    if (e.line == null) {
      results.push({ raw: e.raw, matched: false, reason: 'No line found' });
      continue;
    }
    const norm = normalizeName(e.name);
    let match = byFullName.get(norm) ?? null;
    if (!match) {
      const tokens = norm.split(' ');
      const cands = byLastName.get(tokens[tokens.length - 1] ?? '');
      if (cands && cands.length === 1) match = cands[0]; // unique last name only
    }
    if (!match) {
      results.push({ raw: e.raw, matched: false, reason: 'Player not found' });
      continue;
    }
    if (!e.stat) {
      results.push({ raw: e.raw, matched: false, reason: 'Stat not recognized' });
      continue;
    }
    // "Fantasy score" in pasted text doesn't identify the sport — the parser lands
    // it on one FS key; swap in THIS sport's FS key (a pitcher then correctly fails
    // the offered-stats check below, since only hitters have an FS market). Sports
    // with no FS market (NHL, soccer) have no mapping and fail the same check.
    if (FANTASY_SCORE_KEYS.has(e.stat)) {
      e.stat = FANTASY_SCORE_KEY_BY_SPORT[sport] ?? e.stat;
    }
    // Same idea for shared words: bare "hits" parses to the MLB key and bare
    // "fouls" to the NBA key — remap to this sport's equivalent market.
    if (sport === 'nhl' && e.stat === 'hits') e.stat = 'nhlHits';
    if (sport === 'mls' && e.stat === 'fouls') e.stat = 'foulsCommitted';
    if (!statKeysForSport(sport, match.posBucket).includes(e.stat)) {
      results.push({
        raw: e.raw,
        matched: false,
        reason: 'Stat not offered for this player',
      });
      continue;
    }

    const research = await getPlayerResearch(sport, match.slug, e.stat, e.line);
    if (!research) {
      results.push({ raw: e.raw, matched: false, reason: 'No data' });
      continue;
    }
    const overHitRate =
      research.windows.find((w) => w.window === 'season')?.hitRate.hitRateOver ?? null;
    let edge: number | null = null;
    let evPerDollar: number | null = null;
    if (e.odds != null) {
      const ro = fairPriceReadout({
        overOdds: e.odds,
        historicalHitRateOver: overHitRate,
      });
      edge = ro.edge;
      evPerDollar = ro.evPerDollarOver;
    }
    results.push({
      raw: e.raw,
      matched: true,
      player: research.player,
      stat: e.stat,
      statShort: STAT_DEFS[e.stat].short,
      line: e.line,
      odds: e.odds ?? null,
      fireScore: research.verdict.fireScore,
      overHitRate,
      edge,
      evPerDollar,
    });
  }

  // Matched first, strongest FireFactor first.
  results.sort((a, b) => {
    if (a.matched !== b.matched) return a.matched ? -1 : 1;
    return (b.fireScore?.score ?? -1) - (a.fireScore?.score ?? -1);
  });
  return results;
}

/** How many days of upcoming games count as "the slate". Daily sports show one
 *  day; weekly-cadence sports (NFL Thu–Mon, soccer matchweeks) show the week. */
function slateWindowDays(sport: Sport): number {
  return sport === 'nfl' || sport === 'mls' ? 7 : 1;
}

/**
 * Whether a sport currently has games scheduled today or later — i.e. it's in
 * season with an actionable slate. Drives the home page, which hides off-season
 * sports (whose board "leans" are past games, not upcoming props). Read from the
 * nightly schedule feed; cheap COUNT, no joins.
 *
 * cache(): re-asked per sport by the sport pages AND the all-sports aggregators
 * within one render — memoize so each render pays one query per sport.
 */
export const hasUpcomingGames = cache(async (sport: Sport): Promise<boolean> => {
  const now = new Date();
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  // Anchor on the soonest scheduled slate day (>= today), then ask whether that slate
  // still has a game that HASN'T STARTED. A game counts as unstarted when its startTime
  // is in the future, or (time unknown) it's on the slate at all. Once every game on the
  // soonest slate has begun, callers roll to their no-games fallback instead of showing
  // lines for games already underway/finished — rather than lingering until midnight.
  const next = await db.scheduledGame.findFirst({
    where: { sport, date: { gte: todayUtc } },
    orderBy: { date: 'asc' },
    select: { date: true },
  });
  if (!next) return false;
  const windowDays = slateWindowDays(sport);
  const dayEnd = new Date(next.date.getTime() + windowDays * 86_400_000);
  const unstarted = await db.scheduledGame.count({
    where: {
      sport,
      date: { gte: next.date, lt: dayEnd },
      OR: [{ startTime: { gt: now } }, { startTime: null }],
    },
  });
  return unstarted > 0;
});

/**
 * The next slate of scheduled games for a sport (the soonest date on/after today
 * that has games). Read-only from ScheduledGame, populated by the nightly
 * schedule feed. Returns an empty slate in the off-season.
 *
 * cache(): the sport page and the all-sports aggregators both ask for the same
 * slate within one render.
 */
export const getTonightSlate = cache(async (
  sport: Sport,
): Promise<{ date: string | null; games: TonightGame[] }> => {
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  const next = await db.scheduledGame.findFirst({
    where: { sport, date: { gte: todayUtc } },
    orderBy: { date: 'asc' },
    select: { date: true },
  });
  if (!next) return { date: null, games: [] };

  const dayStart = next.date;
  const windowDays = slateWindowDays(sport);
  const dayEnd = new Date(dayStart.getTime() + windowDays * 86_400_000);
  const rows = await db.scheduledGame.findMany({
    where: { sport, date: { gte: dayStart, lt: dayEnd } },
    include: {
      homeTeam: { select: { abbreviation: true, name: true, externalId: true } },
      awayTeam: { select: { abbreviation: true, name: true, externalId: true } },
    },
    orderBy: { externalId: 'asc' },
  });

  const games: TonightGame[] = rows.map((r) => ({
    externalId: r.externalId,
    date: r.date.toISOString().slice(0, 10),
    startTime: r.startTime ? r.startTime.toISOString() : null,
    status: r.status,
    home: {
      abbr: r.homeTeam.abbreviation,
      name: teamDisplayName(sport, r.homeTeam.abbreviation, r.homeTeam.name),
      externalId: r.homeTeam.externalId,
    },
    away: {
      abbr: r.awayTeam.abbreviation,
      name: teamDisplayName(sport, r.awayTeam.abbreviation, r.awayTeam.name),
      externalId: r.awayTeam.externalId,
    },
    homeProbablePitcher: r.homeProbablePitcher,
    awayProbablePitcher: r.awayProbablePitcher,
  }));

  return { date: dayStart.toISOString().slice(0, 10), games };
});

/** One scheduled game by its external id — for the per-game page reached from a player's
 *  "next matchup" card. Upcoming only (date >= today); past/unknown ids return null so
 *  the game page shows its "not on the slate" fallback. */
export async function getScheduledGame(
  sport: Sport,
  externalId: string,
): Promise<TonightGame | null> {
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const r = await db.scheduledGame.findFirst({
    where: { sport, externalId, date: { gte: todayUtc } },
    include: {
      homeTeam: { select: { abbreviation: true, name: true, externalId: true } },
      awayTeam: { select: { abbreviation: true, name: true, externalId: true } },
    },
  });
  if (!r) return null;
  return {
    externalId: r.externalId,
    date: r.date.toISOString().slice(0, 10),
    startTime: r.startTime ? r.startTime.toISOString() : null,
    status: r.status,
    home: {
      abbr: r.homeTeam.abbreviation,
      name: teamDisplayName(sport, r.homeTeam.abbreviation, r.homeTeam.name),
      externalId: r.homeTeam.externalId,
    },
    away: {
      abbr: r.awayTeam.abbreviation,
      name: teamDisplayName(sport, r.awayTeam.abbreviation, r.awayTeam.name),
      externalId: r.awayTeam.externalId,
    },
    homeProbablePitcher: r.homeProbablePitcher,
    awayProbablePitcher: r.awayProbablePitcher,
  };
}
