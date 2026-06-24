// Server-only data access: Prisma -> the pure compute core. Sport-aware.
//
// Imported only by Server Components (pages), route handlers, and scripts —
// never by presentational components (those receive plain data via props).
import { cache } from 'react';
import { db } from '@/lib/db';
import {
  type GameStatLine,
  type StatKey,
  type DvpCell,
  type PosBucket,
  STAT_WINDOWS,
  computeHitRate,
  hitRateConfidence,
  rankDvp,
  buildWhyText,
  statValue,
  statKeysForSport,
  defaultStatForSport,
  blendedRoleThreshold,
  RECENT_GAMES_WINDOW,
} from '@/lib/stats';
import { roundToHalfLine } from '@/lib/format';
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
} from '@/lib/types';

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
function opportunityFor(
  sport: Sport,
  posBucket: string | null | undefined,
  g: PlayerGame,
): number | null {
  if (sport === 'nba') return g.minutes ?? null;
  if (posBucket === 'P') return null;
  return (g.atBats ?? 0) + (g.walks ?? 0) + (g.hbp ?? 0);
}

const POS_LABEL: Record<string, string> = { G: 'guards', F: 'forwards', C: 'centers' };

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
  team: { abbreviation: string; name: string; externalId: number } | null;
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
      team: { select: { abbreviation: true, name: true, externalId: true } },
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

export async function getPlayerGames(playerId: number): Promise<PlayerGame[]> {
  const rows = await db.playerGameStat.findMany({
    where: { playerId },
    orderBy: { gameDate: 'desc' },
    include: { opponentTeam: { select: { abbreviation: true } } },
  });
  return rows.map((r) => ({
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
    // context
    gameDate: r.gameDate.toISOString().slice(0, 10),
    opponentTeamId: r.opponentTeamId,
    opponentAbbreviation: r.opponentTeam.abbreviation,
    isHome: r.isHome,
    wl: r.wl,
    plusMinus: r.plusMinus,
  }));
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

/** NBA DvP cell: stat allowed to a position bucket, ranked across teams. */
async function getNbaDvp(
  posBucket: PosBucket,
  stat: StatKey,
  opponentTeamId: number,
  season: string,
): Promise<DvpCell | null> {
  const expr = NBA_STAT_SQL[stat];
  if (!expr) return null;
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
  if (rows.length === 0) return null;
  const cells = rankDvp(
    rows.map((r) => ({
      opponentTeamId: Number(r.opponentTeamId),
      avgAllowed: Number(r.avg),
      sampleSize: Number(r.n),
    })),
    posBucket,
    stat,
  );
  return cells.find((c) => c.opponentTeamId === opponentTeamId) ?? null;
}

/** MLB matchup: a hitting stat the opponent's pitching staff allows per game. */
async function getMlbHitterMatchup(
  stat: StatKey,
  opponentTeamId: number,
  season: string,
): Promise<DvpCell | null> {
  const expr = MLB_HIT_SQL[stat];
  if (!expr) return null;
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
  if (rows.length === 0) return null;
  const cells = rankDvp(
    rows.map((r) => ({
      opponentTeamId: Number(r.opponentTeamId),
      avgAllowed: Number(r.avg),
      sampleSize: Number(r.n),
    })),
    'H',
    stat,
  );
  return cells.find((c) => c.opponentTeamId === opponentTeamId) ?? null;
}

/** Default line: season average for the stat, rounded to the nearest 0.5. */
function defaultLine(games: GameStatLine[], stat: StatKey): number {
  if (games.length === 0) return 0.5;
  const mean = games.reduce((a, g) => a + statValue(stat, g), 0) / games.length;
  return roundToHalfLine(mean);
}

/**
 * The full research payload for a player page / API response, computed for a
 * stat + line. `stat` defaults to the sport/role default; `line` to the season
 * average rounded to 0.5. An out-of-sport stat falls back to the default.
 */
export async function getPlayerResearch(
  sport: Sport,
  slug: string,
  statParam?: StatKey,
  lineParam?: number,
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
  const line = lineParam ?? defaultLine(games, stat);

  const windows: WindowResult[] = STAT_WINDOWS.map((w) => {
    const hitRate = computeHitRate(games, stat, line, w);
    return {
      window: String(w),
      hitRate,
      confidence: hitRateConfidence(hitRate.overs, hitRate.decided),
    };
  });

  const seasonResult = windows.find((w) => w.window === 'season')!.hitRate;
  const recentGame = games[0];
  const recentOpponent = recentGame
    ? {
        teamId: recentGame.opponentTeamId,
        abbreviation: recentGame.opponentAbbreviation,
        isHome: recentGame.isHome,
      }
    : null;

  let dvp: DvpCell | null = null;
  let unitLabel: string | undefined;
  if (recentOpponent) {
    if (sport === 'nba' && player.posBucket) {
      dvp = await getNbaDvp(player.posBucket, stat, recentOpponent.teamId, season);
      unitLabel = POS_LABEL[player.posBucket] ?? 'this position';
    } else if (sport === 'mlb' && player.posBucket === 'H') {
      dvp = await getMlbHitterMatchup(stat, recentOpponent.teamId, season);
      unitLabel = 'hitters';
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
    dvp: dvp ? { cell: dvp, opponentAbbreviation: recentOpponent!.abbreviation, unitLabel } : null,
  });

  return {
    player,
    bio: toBio(record),
    stat,
    line,
    seasonAverage: seasonResult.mean,
    gamesPlayed: games.length,
    chart,
    windows,
    recentOpponent,
    dvp,
    why,
  };
}
