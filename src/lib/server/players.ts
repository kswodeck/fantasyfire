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
  lineProbabilities,
  computeFireFactor,
  computeSplits,
  wilsonInterval,
  STAT_DEFS,
  FIREFACTOR_MIN_GAMES,
  defaultLine,
  defaultPropLine,
} from '@/lib/stats';
import { fairPriceReadout, marketConsensus, type MarketConsensus } from '@/lib/odds';
import { parseSlate, normalizeName } from '@/lib/slate';
import { currentSeason, previousSeason } from '@/lib/season';
import { getTeam } from '@/lib/teams';
import type { Sport } from '@/lib/sports';
import type {
  PlayerSummary,
  PlayerBio,
  PlayerGame,
  PlayerListItem,
  ChartPoint,
  WindowResult,
  PlayerResearch,
  PlayerAvailability,
  BoardRow,
  LineValueComparison,
  TrendRow,
  DvpTableRow,
  LeaderRow,
  SlateResult,
  TonightGame,
} from '@/lib/types';
import { PROP_STATS } from '@/lib/propStats';
import {
  getProvidedLine,
  getProvidedLineMap,
  getProvidedLinesBySource,
  getProvidedQuotesBySource,
} from '@/lib/server/providedLines';
import { DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';

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
function opportunityFor(
  sport: Sport,
  posBucket: string | null | undefined,
  g: PlayerGame,
): number | null {
  if (sport === 'nba') return g.minutes ?? null;
  if (sport === 'nfl') {
    if (posBucket === 'QB') return g.passAttempts ?? 0;
    if (posBucket === 'RB') return (g.rushAttempts ?? 0) + (g.receptions ?? 0);
    return g.targets ?? 0; // WR / TE
  }
  if (posBucket === 'P') return null;
  return (g.atBats ?? 0) + (g.walks ?? 0) + (g.hbp ?? 0);
}

const POS_LABEL: Record<string, string> = {
  G: 'guards',
  F: 'forwards',
  C: 'centers',
  QB: 'quarterbacks',
  RB: 'running backs',
  WR: 'wide receivers',
  TE: 'tight ends',
};

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
const getPlayerRecord = cache(async (sport: Sport, slug: string): Promise<PlayerRecord | null> => {
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
});

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

export async function getPlayerBySlug(sport: Sport, slug: string): Promise<PlayerSummary | null> {
  const p = await getPlayerRecord(sport, slug);
  return p ? toSummary(p) : null;
}

/** Prisma stat row shape used by the game mapper (model fields + opponent abbr).
 * Stat columns are OPTIONAL so a per-sport narrowed `select` (boardStatSelect) — which
 * omits other sports' columns to cut egress — is still assignable; the full-row query
 * (player page) provides them all. Missing columns map to undefined → statValue → 0. */
type StatGameRow = {
  points?: number | null; rebounds?: number | null; oreb?: number | null; dreb?: number | null;
  assists?: number | null; steals?: number | null; blocks?: number | null; turnovers?: number | null;
  fouls?: number | null; fgm?: number | null; fga?: number | null; fg3m?: number | null;
  fg3a?: number | null; ftm?: number | null; fta?: number | null; minutes?: number | null;
  atBats?: number | null; hits?: number | null; doubles?: number | null; triples?: number | null;
  homeRuns?: number | null; runs?: number | null; rbi?: number | null; walks?: number | null;
  strikeouts?: number | null; stolenBases?: number | null; totalBases?: number | null; hbp?: number | null;
  outs?: number | null; hitsAllowed?: number | null; runsAllowed?: number | null; earnedRuns?: number | null;
  walksAllowed?: number | null; strikeoutsPitched?: number | null;
  passYards?: number | null; passTds?: number | null; passCompletions?: number | null;
  passAttempts?: number | null; passInts?: number | null; rushYards?: number | null;
  rushAttempts?: number | null; rushTds?: number | null; receptions?: number | null;
  targets?: number | null; recYards?: number | null; recTds?: number | null; fumblesLost?: number | null;
  gameDate: Date; opponentTeamId: number; opponentTeam: { abbreviation: string; externalId: number };
  isHome: boolean; wl: string | null; plusMinus: number | null;
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
async function getNextOpponent(sport: Sport, teamId: number): Promise<MatchupOpponent | null> {
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
  const lastByPlayer = new Map(freshness.map((f) => [f.playerId, f._max.gameDate ?? null]));
  return players.map((p) => ({ slug: p.slug, lastGameDate: lastByPlayer.get(p.id) ?? null }));
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
export async function searchPlayers(sport: Sport, q?: string, limit = 20): Promise<PlayerListItem[]> {
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
  const r = await db.playerGameStat.aggregate({ where: { sport }, _max: { gameDate: true } });
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

/** NBA DvP cell: stat allowed to a position bucket, ranked across teams. */
async function getNbaDvpTable(
  posBucket: PosBucket,
  stat: StatKey,
  season: string,
): Promise<DvpCell[]> {
  const expr = NBA_STAT_SQL[stat];
  if (!expr) return [];
  // Apply the SAME per-player minute threshold as the player page: for each
  // player, blend their season and last-N appearance minutes, then keep only
  // games at/above that bar. Done in SQL (window function) so the league-wide
  // DvP averages stay consistent with each player's own role.
  const rows = await db.$queryRawUnsafe<{ opponentTeamId: number; avg: number; n: number }[]>(
    `WITH games AS (
       SELECT s."opponentTeamId" AS opp, s.minutes AS minutes, (${expr}) AS val,
              ROW_NUMBER() OVER (PARTITION BY s."playerId" ORDER BY s."gameDate" DESC) AS rn,
              s."playerId" AS pid
       FROM "PlayerGameStat" s
       JOIN "Player" p ON p.id = s."playerId"
       WHERE p.sport = 'nba' AND p."posBucket" = $1 AND s.season = $2
         AND s.minutes IS NOT NULL AND s.minutes > 0
     ),
     thresh AS (
       SELECT pid, (AVG(minutes) + AVG(minutes) FILTER (WHERE rn <= $3)) / 2.0 AS thr
       FROM games GROUP BY pid
     )
     SELECT g.opp AS "opponentTeamId", AVG(g.val)::float8 AS avg, COUNT(*)::int AS n
     FROM games g
     JOIN thresh t ON t.pid = g.pid
     WHERE g.minutes >= t.thr
     GROUP BY g.opp`,
    posBucket,
    season,
    RECENT_GAMES_WINDOW,
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

async function getNbaDvp(
  posBucket: PosBucket,
  stat: StatKey,
  opponentTeamId: number,
  season: string,
): Promise<DvpCell | null> {
  const cells = await getNbaDvpTable(posBucket, stat, season);
  return cells.find((c) => c.opponentTeamId === opponentTeamId) ?? null;
}

/** MLB matchup: a hitting stat the opponent's pitching staff allows per game. */
async function getMlbHitterMatchupTable(stat: StatKey, season: string): Promise<DvpCell[]> {
  const expr = MLB_HIT_SQL[stat];
  if (!expr) return [];
  // Per-game team total allowed, then average across that opponent's games.
  const rows = await db.$queryRawUnsafe<{ opponentTeamId: number; avg: number; n: number }[]>(
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
  const rows = await db.$queryRawUnsafe<{ opponentTeamId: number; avg: number; n: number }[]>(
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
 * NBA game pace (idea #3) — each team's season pace + the league average. Possessions
 * per team-game ≈ FGA + 0.44·FTA − OREB + TOV (the box-score estimate single-sourced
 * in lib/stats/pace.ts), aggregated to a per-game average per team. Memoized per
 * request; null off-NBA / on error so the projection just stays pace-neutral.
 */
const getNbaPaceTable = cache(
  async (season: string): Promise<{ byTeam: Map<number, number>; leagueAvg: number } | null> => {
    try {
      const rows = await db.$queryRawUnsafe<{ teamId: number; pace: number }[]>(
        `SELECT "teamId", AVG(poss)::float8 AS pace FROM (
           SELECT s."teamId" AS "teamId", s."gameId" AS gid,
                  SUM(COALESCE(s.fga,0)) + 0.44 * SUM(COALESCE(s.fta,0))
                    - SUM(COALESCE(s.oreb,0)) + SUM(COALESCE(s.turnovers,0)) AS poss
           FROM "PlayerGameStat" s
           JOIN "Player" p ON p.id = s."playerId"
           WHERE p.sport = 'nba' AND s.season = $1
           GROUP BY s."teamId", s."gameId"
         ) t
         GROUP BY "teamId"`,
        season,
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
      console.warn('[pace] getNbaPaceTable failed:', e instanceof Error ? e.message : e);
      return null;
    }
  },
);

/** The player's implied team total for their NEXT scheduled game (idea #4), from the
 *  game's Vegas total + spread. Null off-season / when the game has no posted odds. */
async function getNextGameImpliedTotal(sport: Sport, teamId: number): Promise<number | null> {
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const game = await db.scheduledGame.findFirst({
    where: { sport, date: { gte: todayUtc }, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    orderBy: { date: 'asc' },
    select: { homeTeamId: true, gameTotal: true, homeSpread: true },
  });
  if (!game || game.gameTotal == null) return null;
  const isHome = game.homeTeamId === teamId;
  const teamSpread = game.homeSpread == null ? 0 : isHome ? game.homeSpread : -game.homeSpread;
  return impliedTeamTotal(game.gameTotal, teamSpread);
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
  const avgGameTotal = rows.reduce((s, r) => s + (r.gameTotal as number), 0) / rows.length;
  return avgGameTotal / 2;
});

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
  const consensusLine = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
  const best = top && top.edge > 0.005 ? { source: top.source, line: top.line, edge: top.edge } : null;
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
  // full games. Pitchers aren't opportunity-filtered (opp == null).
  const qualifyFactor = sport === 'nba' ? 1 : 0.6;
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
  const providedLine = lineParam == null ? await getProvidedLine(sport, record.id, stat, src) : null;
  const line = lineParam ?? providedLine ?? defaultPropLine(games, stat);
  const lineSource = lineParam == null && providedLine != null ? src : null;

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
    if (sport === 'nba' && player.posBucket) {
      dvp = await getNbaDvp(player.posBucket, stat, matchupOpponent.teamId, season);
      unitLabel = POS_LABEL[player.posBucket] ?? 'this position';
    } else if (sport === 'mlb' && player.posBucket === 'H') {
      dvp = await getMlbHitterMatchup(stat, matchupOpponent.teamId, season);
      unitLabel = 'hitters';
    } else if (sport === 'nfl' && player.posBucket) {
      dvp = await getNflDvp(player.posBucket, stat, matchupOpponent.teamId, season);
      unitLabel = POS_LABEL[player.posBucket] ?? 'this position';
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
    dvp: dvp ? { cell: dvp, opponentAbbreviation: matchupOpponent!.abbreviation, unitLabel } : null,
  });

  // Verdict: the FireFactor "good prop" read + its sub-signals, computed on the
  // qualified games already loaded (no extra query). LEAN mode — VALUE/EV is an
  // opt-in, per-price client read in the fair-price section.
  const grade = dvp ? matchupGrade(dvp) : null;

  // Matchup-adjust the projection in place (idea #3): a soft/tough opponent and the
  // projected game pace (NBA, from box-score totals) nudge the recent-form base. Each
  // factor defaults to neutral, so the projection degrades to pure recent form.
  const opponentMult = dvp ? opponentMultiplierFromCell(dvp) : 1;
  let paceMult = 1;
  if (sport === 'nba' && record.team && matchupOpponent) {
    const paceTable = await getNbaPaceTable(season);
    if (paceTable) {
      paceMult = paceMultiplier(
        paceTable.byTeam.get(record.team.id) ?? null,
        paceTable.byTeam.get(matchupOpponent.teamId) ?? null,
        paceTable.leagueAvg,
      );
    }
  }
  // Game environment (idea #4): the player's implied team total vs the league average,
  // from the next game's Vegas total + spread. Only for a real upcoming game.
  let environmentMult = 1;
  if (record.team && matchupOpponent?.isUpcoming) {
    const [implied, leagueAvg] = await Promise.all([
      getNextGameImpliedTotal(sport, record.team.id),
      getLeagueAvgTeamTotal(sport),
    ]);
    environmentMult = environmentMultiplier(implied, leagueAvg);
  }
  const projection = recentFormEstimate(seasonResult.values, seasonResult.mean, {
    opponent: opponentMult,
    pace: paceMult,
    environment: environmentMult,
  });
  const consistency = computeConsistency(
    seasonResult.values,
    seasonResult.mean,
    seasonResult.stdev,
    line,
  );

  // Model P(over) from the adjusted projection's distribution (idea #2) — the
  // principled "projection vs line" probability FireFactor leans on.
  const modelProb = lineProbabilities(stat, projection.projection, seasonResult.stdev, line);

  // Cross-book market consensus + best price / +EV (idea #1) from the scraped book
  // odds. The auto +EV only folds into FireFactor when the market line matches the
  // line we're showing — otherwise the EV is about a different number.
  const quotes = await getProvidedQuotesBySource(sport, record.id, stat);
  const consensus = quotes.length > 0 ? marketConsensus(quotes, line) : null;
  const consensusAtLine = consensus && Math.abs(consensus.line - line) < 1e-9 ? consensus : null;

  const ffInput = {
    line,
    windows: windows.map((w) => ({
      window: w.window,
      overs: w.hitRate.overs,
      decided: w.hitRate.decided,
    })),
    projection: projection.projection,
    stdev: seasonResult.stdev,
    modelProbOver: modelProb?.over ?? null,
    cv: consistency.cv,
    matchup: grade ?? undefined,
    evPerDollar: consensusAtLine
      ? {
          over: consensusAtLine.bestOver?.evPerDollar ?? null,
          under: consensusAtLine.bestUnder?.evPerDollar ?? null,
        }
      : undefined,
    gamesPlayed: games.length,
  };
  const prelim = computeFireFactor(ffInput);
  // Cross-book line value: every book's number for this stat, scored vs the consensus
  // median. When the displayed line is a real book line, fold its discount into the read.
  const linesBySource = await getProvidedLinesBySource(sport, record.id, stat);
  const lineValue = lineValueComparison(games, stat, prelim.side, linesBySource);
  // Apply the line-value boost whenever the shown line matches a book's number — so an
  // explicit ?line= that equals a book line reads the same as selecting that book, and
  // matches the board (whose lines are book lines). The edge depends only on the line
  // vs the consensus, not on which book posted it.
  const heldBook = lineValue?.books.find((b) => Math.abs(b.line - line) < 1e-9);
  const fireScore = heldBook
    ? computeFireFactor({ ...ffInput, lineValueEdge: heldBook.edge })
    : prelim;
  const splits = computeSplits(games, stat, line);

  // Current injury / availability (idea #5) — surfaced as a banner + read gate.
  const injuryRow = await db.playerInjury
    .findUnique({
      where: { playerId: record.id },
      select: { status: true, rawStatus: true, detail: true, comment: true },
    })
    .catch(() => null);
  const availability: PlayerAvailability | null = injuryRow
    ? {
        status: injuryRow.status as PlayerAvailability['status'],
        rawStatus: injuryRow.rawStatus,
        detail: injuryRow.detail,
        comment: injuryRow.comment,
      }
    : null;

  return {
    player,
    bio: toBio(record),
    stat,
    line,
    lineSource,
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
      fireScore,
      modelProbOver: modelProb?.over ?? null,
      marketConsensus: consensus,
    },
    splits,
    chart,
    windows,
    matchupOpponent,
    dvp,
    availability,
    why,
  };
}

// The popular, well-lined stats we scan for the board (keeps it focused + fast).
const BOARD_NBA_STATS: StatKey[] = ['pts', 'reb', 'ast', 'pra', 'fg3m'];
const BOARD_MLB_HITTER_STATS: StatKey[] = ['hits', 'tb', 'hr', 'rbi', 'runs'];
// NFL board stats by position — 1–2 well-bet markets each, given small samples.
const BOARD_NFL_STATS: Record<string, StatKey[]> = {
  QB: ['passYds', 'passTds'],
  RB: ['rushYds', 'rec'],
  WR: ['recYds', 'rec'],
  TE: ['recYds', 'rec'],
};

function boardStatsFor(sport: Sport, posBucket: string | null): StatKey[] {
  // MLB pitchers are excluded for now (no matchup, and starts aren't filtered).
  if (sport === 'mlb') return posBucket === 'P' ? [] : BOARD_MLB_HITTER_STATS;
  if (sport === 'nfl') return BOARD_NFL_STATS[posBucket ?? ''] ?? [];
  return BOARD_NBA_STATS;
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
}

export async function getBoard(sport: Sport, opts: BoardOptions = {}): Promise<BoardRow[]> {
  const { limit = 40, scan = 120, perPlayerCap = 2, perStatCap = 10 } = opts;
  const { players, gamesByPlayer } = await loadBoardPool(sport, scan);
  if (players.length === 0) return [];
  // Real lines from the chosen book; empty map (no query) when the feature is off,
  // so the board falls back to the computed default line and behaves as before.
  const providedLines = await getProvidedLineMap(sport, players.map((p) => p.id), opts.source);
  const season = await getActiveSeason(sport);
  const ctx = await boardMatchupContext(sport, players, season);
  return computeBoardRows(sport, players, gamesByPlayer, providedLines, {
    limit,
    perPlayerCap,
    perStatCap,
    requireProvided: opts.requireProvidedLine === true,
    matchupGrades: ctx.grades,
    opponentMults: ctx.opponentMults,
    paceMultByPlayer: ctx.paceMultByPlayer,
    envMultByPlayer: ctx.envMultByPlayer,
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
  const { players, gamesByPlayer } = await loadBoardPool(sport, scan);
  if (players.length === 0) {
    for (const s of sources) result[s] = [];
    return result;
  }
  const ids = players.map((p) => p.id);
  // Load every book's lines once, then a consensus (median per key) so each row can be
  // scored against the market for the line-value boost + "best price" badge.
  const allMaps: Record<string, Map<string, number>> = {};
  for (const s of sources) allMaps[s] = await getProvidedLineMap(sport, ids, s);
  const consensus = consensusLineMap(allMaps);
  const season = await getActiveSeason(sport);
  const ctx = await boardMatchupContext(sport, players, season);
  for (const s of sources) {
    result[s] = computeBoardRows(sport, players, gamesByPlayer, allMaps[s], {
      limit,
      perPlayerCap,
      perStatCap,
      requireProvided: true,
      lineValue: { allMaps, consensus },
      matchupGrades: ctx.grades,
      opponentMults: ctx.opponentMults,
      paceMultByPlayer: ctx.paceMultByPlayer,
      envMultByPlayer: ctx.envMultByPlayer,
    });
  }
  return result;
}

/** Median line per `${playerId}:${stat}` key across every book's line map — the market
 *  consensus the line-value boost + "best price" badge are scored against. */
function consensusLineMap(allMaps: Record<string, Map<string, number>>): Map<string, number> {
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
  const teamIds = [...new Set(players.map((p) => p.teamId).filter((x): x is number => x != null))];
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
    select: { homeTeamId: true, awayTeamId: true, gameTotal: true, homeSpread: true },
  });
  const oppByTeam = new Map<number, number>();
  const impliedByTeam = new Map<number, number>();
  const totals: number[] = [];
  for (const g of games) {
    if (!oppByTeam.has(g.homeTeamId)) oppByTeam.set(g.homeTeamId, g.awayTeamId);
    if (!oppByTeam.has(g.awayTeamId)) oppByTeam.set(g.awayTeamId, g.homeTeamId);
    if (g.gameTotal != null) {
      totals.push(g.gameTotal);
      const hs = g.homeSpread ?? 0;
      if (!impliedByTeam.has(g.homeTeamId)) {
        impliedByTeam.set(g.homeTeamId, impliedTeamTotal(g.gameTotal, hs)!);
      }
      if (!impliedByTeam.has(g.awayTeamId)) {
        impliedByTeam.set(g.awayTeamId, impliedTeamTotal(g.gameTotal, -hs)!);
      }
    }
  }
  const leagueAvgTeamTotal = totals.length
    ? totals.reduce((a, b) => a + b, 0) / totals.length / 2
    : null;
  if (oppByTeam.size === 0) return empty;

  // DvP cell tables, memoized per (posBucket, stat): opponentTeamId -> cell (the cell
  // feeds both the grade and the opponent multiplier, so they stay in lock-step).
  const tableCache = new Map<string, Map<number, DvpCell>>();
  const cellTable = async (bucket: PosBucket, stat: StatKey): Promise<Map<number, DvpCell>> => {
    const key = `${bucket}:${stat}`;
    const cached = tableCache.get(key);
    if (cached) return cached;
    let cells: DvpCell[] = [];
    if (sport === 'nba') cells = await getNbaDvpTable(bucket, stat, season);
    else if (sport === 'mlb' && bucket === 'H') cells = await getMlbHitterMatchupTable(stat, season);
    else if (sport === 'nfl') cells = await getNflDvpTable(bucket, stat, season);
    const m = new Map<number, DvpCell>();
    for (const c of cells) m.set(c.opponentTeamId, c);
    tableCache.set(key, m);
    return m;
  };

  // NBA game pace (one league-wide table) — the same projected-game pace applies to all
  // of a player's stats, so it's keyed by player.
  const paceTable = sport === 'nba' ? await getNbaPaceTable(season) : null;

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
    for (const stat of statKeysForSport(sport, bucket)) {
      const cell = (await cellTable(bucket, stat)).get(opp);
      if (cell) {
        grades.set(`${p.id}:${stat}`, matchupGrade(cell));
        opponentMults.set(`${p.id}:${stat}`, opponentMultiplierFromCell(cell));
      }
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
    /** Next-opponent DvP grade per `${playerId}:${stat}`, so the board's FireFactor
     *  includes the same matchup component as the player page. */
    matchupGrades?: Map<string, MatchupGrade>;
    /** Opponent projection multiplier per `${playerId}:${stat}` (matches the page). */
    opponentMults?: Map<string, number>;
    /** NBA game-pace multiplier per player (matches the page). */
    paceMultByPlayer?: Map<number, number>;
    /** Vegas game-environment multiplier per player (matches the page). */
    envMultByPlayer?: Map<number, number>;
  },
): BoardRow[] {
  const { limit, perPlayerCap, perStatCap, requireProvided } = opts;
  const out: Omit<BoardRow, 'rank'>[] = [];
  for (const p of players) {
    const allGames = gamesByPlayer.get(p.id);
    if (!allGames || allGames.length < FIREFACTOR_MIN_GAMES) continue;
    const games = qualifyGames(sport, p.posBucket, allGames);
    if (games.length < FIREFACTOR_MIN_GAMES) continue;
    const listItem = boardListItem(sport, p, games.length);

    for (const { stat, line, provided } of statLinesFor(sport, p.posBucket, games, providedLines, p.id, requireProvided)) {
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
      });
      const modelProb = lineProbabilities(stat, projection.projection, seasonHr.stdev, line);
      const consistency = computeConsistency(seasonHr.values, seasonHr.mean, seasonHr.stdev, line);
      // Matchup grade (next opponent's DvP) comes from the batched `matchupGrades` map
      // so the board's FireFactor matches the player page; absent → degrades gracefully.
      const ffInput = {
        line,
        windows,
        projection: projection.projection,
        stdev: seasonHr.stdev,
        modelProbOver: modelProb?.over ?? null,
        cv: consistency.cv,
        matchup: opts.matchupGrades?.get(`${p.id}:${stat}`),
        gamesPlayed: games.length,
      };
      const prelim = computeFireFactor(ffInput);
      // A 0.5 book line's only meaningful lean is the OVER ("will it happen"). The
      // under ("it won't") is trivial/obvious — never feature it as a top lean.
      if (line <= 0.5 && prelim.side === 'under') continue;

      // Cross-book line value: boost the read for a softer-than-market number and flag
      // the best price across books (sourced boards only).
      let fireScore = prelim;
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
            return prelim.side === 'over' ? o : 1 - o;
          };
          const consRate = rate(consensusLine);
          const edge = rate(line) - consRate;
          let best: { source: string; line: number; edge: number } | null = null;
          for (const b of allLines) {
            const e = rate(b.line) - consRate;
            if (!best || e > best.edge) best = { source: b.source, line: b.line, edge: e };
          }
          if (best && best.edge <= 0.005) best = null;
          if (edge !== 0) fireScore = computeFireFactor({ ...ffInput, lineValueEdge: edge });
          rowLineValue = { edge, best };
        }
      }

      out.push({
        player: listItem,
        stat,
        statShort: STAT_DEFS[stat].short,
        line,
        projection: projection.projection,
        fireScore,
        lineValue: rowLineValue,
      });
    }
  }

  out.sort((a, b) => b.fireScore.score - a.fireScore.score);
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
  nba: { points: true, rebounds: true, oreb: true, dreb: true, assists: true, steals: true, blocks: true, turnovers: true, fouls: true, fgm: true, fga: true, fg3m: true, fg3a: true, ftm: true, fta: true },
  mlb: { atBats: true, hits: true, doubles: true, triples: true, homeRuns: true, runs: true, rbi: true, walks: true, strikeouts: true, stolenBases: true, totalBases: true, hbp: true, outs: true, hitsAllowed: true, runsAllowed: true, earnedRuns: true, walksAllowed: true, strikeoutsPitched: true },
  nfl: { passYards: true, passTds: true, passCompletions: true, passAttempts: true, passInts: true, rushYards: true, rushAttempts: true, rushTds: true, receptions: true, targets: true, recYards: true, recTds: true, fumblesLost: true },
};
function boardStatSelect(sport: Sport) {
  return { ...BOARD_META_SELECT, ...BOARD_STAT_COLS[sport] };
}

/** Top-`scan` most-active players + all their games (one batched query each). */
async function loadBoardPool(
  sport: Sport,
  scan: number,
): Promise<{ players: BoardPlayer[]; gamesByPlayer: Map<number, PlayerGame[]> }> {
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
function qualifyGames(sport: Sport, posBucket: string | null, allGames: PlayerGame[]): PlayerGame[] {
  const qualifyFactor = sport === 'nba' ? 1 : 0.6;
  const cutoff =
    qualifyFactor * blendedRoleThreshold(allGames.map((g) => opportunityFor(sport, posBucket, g)));
  return allGames.filter((g) => {
    const opp = opportunityFor(sport, posBucket, g);
    if (opp == null) return true;
    return opp > 0 && opp >= cutoff;
  });
}

function boardListItem(sport: Sport, p: BoardPlayer, gamesPlayed: number): PlayerListItem {
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

type ScanComputeOpts = { limit: number; perPlayerCap: number; perStatCap: number };

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
    const listItem = boardListItem(sport, p, games.length);
    for (const { stat, line, provided } of statLinesFor(sport, p.posBucket, games, providedLines, p.id, requireProvided)) {
      if (!provided && line <= 0.5) continue;
      const recent = computeHitRate(games, stat, line, 10);
      const season = computeHitRate(games, stat, line, 'season');
      if (recent.decided < 4 || season.decided < FIREFACTOR_MIN_GAMES) continue;
      const recentOver = recent.hitRateOver ?? 0.5;
      const side: 'over' | 'under' = recentOver >= 0.5 ? 'over' : 'under';
      if (line <= 0.5 && side === 'under') continue; // trivial under on a 0.5 line
      const recentRate = side === 'over' ? recentOver : 1 - recentOver;
      const seasonOver = season.hitRateOver ?? 0.5;
      const seasonRate = side === 'over' ? seasonOver : 1 - seasonOver;
      const delta = recentRate - seasonRate;
      if (delta < TREND_MIN_SWING) continue;
      const successes = side === 'over' ? recent.overs : recent.unders;
      // The player's current consecutive run for this stat+line — the merged "Streaks"
      // metric, shown alongside the L10 swing (its side may differ from the lean).
      const run = computeStreak(games.map((g) => statValue(stat, g)), line);
      out.push({
        player: listItem,
        stat,
        statShort: STAT_DEFS[stat].short,
        line,
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
  const { players, gamesByPlayer } = await loadBoardPool(sport, scan);
  const providedLines = await getProvidedLineMap(sport, players.map((p) => p.id), opts.source);
  return computeTrendRows(sport, players, gamesByPlayer, providedLines, opts.requireProvidedLine === true, {
    limit,
    perPlayerCap,
    perStatCap,
  });
}

/** One trends board per book from a single pool load (vs the book's real lines). */
export async function getSourcedTrends(
  sport: Sport,
  sources: string[],
  opts: BoardScanOptions = {},
): Promise<Record<string, TrendRow[]>> {
  const { limit = 80, scan = 140, perPlayerCap = 1, perStatCap = 25 } = opts;
  const result: Record<string, TrendRow[]> = {};
  const { players, gamesByPlayer } = await loadBoardPool(sport, scan);
  const ids = players.map((p) => p.id);
  for (const s of sources) {
    const providedLines = await getProvidedLineMap(sport, ids, s);
    result[s] = computeTrendRows(sport, players, gamesByPlayer, providedLines, true, { limit, perPlayerCap, perStatCap });
  }
  return result;
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
    sport === 'nba'
      ? await getNbaDvpTable(posBucket, stat, season)
      : sport === 'nfl'
        ? await getNflDvpTable(posBucket, stat, season)
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
        teamName: teamDisplayName(sport, t?.abbreviation, t?.name ?? null) ?? t?.abbreviation ?? '',
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
export async function getLeaders(sport: Sport, stat: StatKey, limit = 50): Promise<LeaderRow[]> {
  const expr =
    sport === 'nba' ? NBA_STAT_SQL[stat] : sport === 'nfl' ? NFL_STAT_SQL[stat] : MLB_HIT_SQL[stat];
  if (!expr) return [];
  const season = await getActiveSeason(sport);
  const minGames = sport === 'nba' ? 12 : sport === 'nfl' ? 6 : 20;
  // `expr` is from the internal whitelist (never user input); params are bound.
  // NFL rows exist only for games a player featured in, so no appearance filter.
  const appearanceFilter =
    sport === 'nba'
      ? `AND s.minutes IS NOT NULL AND s.minutes > 0`
      : sport === 'nfl'
        ? ``
        : `AND p."posBucket" = 'H'`;
  // NFL passing stats belong to QBs — a WR's trick-play pass shouldn't crowd the
  // leaderboard. Rushing/receiving stay open (a mobile QB belongs on the rushing
  // board) — handled by avg>0 + the on-page position filter.
  const positionFilter =
    sport === 'nfl' && (['passYds', 'passTds', 'passCmp', 'passAtt', 'ints'] as StatKey[]).includes(stat)
      ? `AND p."posBucket" = 'QB'`
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
    include: { team: { select: { abbreviation: true, name: true, externalId: true } } },
  });
  const byId = new Map(players.map((p) => [p.id, p]));
  const out: LeaderRow[] = [];
  for (const r of rows) {
    const p = byId.get(Number(r.playerId));
    if (!p) continue;
    out.push({
      rank: out.length + 1,
      player: boardListItem(sport, p, Number(r.n)),
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
    if (!statKeysForSport(sport, match.posBucket).includes(e.stat)) {
      results.push({ raw: e.raw, matched: false, reason: 'Stat not offered for this player' });
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
      const ro = fairPriceReadout({ overOdds: e.odds, historicalHitRateOver: overHitRate });
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

/**
 * Whether a sport currently has games scheduled today or later — i.e. it's in
 * season with an actionable slate. Drives the home page, which hides off-season
 * sports (whose board "leans" are past games, not upcoming props). Read from the
 * nightly schedule feed; cheap COUNT, no joins.
 */
export async function hasUpcomingGames(sport: Sport): Promise<boolean> {
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const count = await db.scheduledGame.count({ where: { sport, date: { gte: todayUtc } } });
  return count > 0;
}

/**
 * The next slate of scheduled games for a sport (the soonest date on/after today
 * that has games). Read-only from ScheduledGame, populated by the nightly
 * schedule feed. Returns an empty slate in the off-season.
 */
export async function getTonightSlate(
  sport: Sport,
): Promise<{ date: string | null; games: TonightGame[] }> {
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  const next = await db.scheduledGame.findFirst({
    where: { sport, date: { gte: todayUtc } },
    orderBy: { date: 'asc' },
    select: { date: true },
  });
  if (!next) return { date: null, games: [] };

  const dayStart = next.date;
  // NFL clusters games Thu–Mon, so surface the whole upcoming week, not one day.
  const windowDays = sport === 'nfl' ? 7 : 1;
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
}

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
