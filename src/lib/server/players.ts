// Server-only data access: Prisma -> the pure compute core.
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
} from '@/lib/stats';
import { roundToHalfLine } from '@/lib/format';
import type {
  PlayerSummary,
  PlayerGame,
  PlayerListItem,
  ChartPoint,
  WindowResult,
  PlayerResearch,
} from '@/lib/types';

const SEASON = process.env.NBA_SEASON ?? '2025-26';

// Games below this many minutes (and DNPs) are excluded from hit rates, the
// chart, season averages, and DvP — a 2-minute injury exit or garbage-time stint
// isn't representative of a player's prop output. Configurable via NBA_MIN_MINUTES.
const MINUTES_FLOOR = (() => {
  const n = Number(process.env.NBA_MIN_MINUTES ?? 10);
  return Number.isFinite(n) && n >= 0 ? n : 10;
})();

/** A game counts toward research only if the player logged enough minutes. */
function isQualified(minutes: number | null): boolean {
  return minutes !== null && minutes >= MINUTES_FLOOR;
}

// SQL expression per stat for DvP aggregation. Whitelisted (NOT user input) so
// it is safe to inline; the bucket/season are passed as bound parameters.
const STAT_SQL_EXPR: Record<StatKey, string> = {
  pts: 's.points',
  reb: 's.rebounds',
  ast: 's.assists',
  fg3m: 's.fg3m',
  stl: 's.steals',
  blk: 's.blocks',
  tov: 's.turnovers',
  pra: '(s.points + s.rebounds + s.assists)',
  pr: '(s.points + s.rebounds)',
  pa: '(s.points + s.assists)',
  ra: '(s.rebounds + s.assists)',
  stocks: '(s.steals + s.blocks)',
};

type PlayerRecord = {
  id: number;
  slug: string;
  firstName: string;
  lastName: string;
  position: string | null;
  posBucket: string | null;
  team: { abbreviation: string; name: string } | null;
};

// Wrapped in React cache() so generateMetadata + the page (same render) share
// one query instead of two.
const getPlayerRecord = cache((slug: string): Promise<PlayerRecord | null> => {
  return db.player.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      firstName: true,
      lastName: true,
      position: true,
      posBucket: true,
      team: { select: { abbreviation: true, name: true } },
    },
  });
});

function toSummary(p: PlayerRecord): PlayerSummary {
  return {
    slug: p.slug,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: `${p.firstName} ${p.lastName}`.trim(),
    position: p.position ?? null,
    posBucket: (p.posBucket as PosBucket | null) ?? null,
    teamAbbreviation: p.team?.abbreviation ?? null,
    teamName: p.team?.name ?? null,
  };
}

export async function getPlayerBySlug(slug: string): Promise<PlayerSummary | null> {
  const p = await getPlayerRecord(slug);
  return p ? toSummary(p) : null;
}

export async function getPlayerGames(playerId: number): Promise<PlayerGame[]> {
  const rows = await db.playerGameStat.findMany({
    where: { playerId },
    orderBy: { gameDate: 'desc' },
    include: { opponentTeam: { select: { abbreviation: true } } },
  });
  return rows.map((r) => ({
    points: r.points,
    rebounds: r.rebounds,
    assists: r.assists,
    steals: r.steals,
    blocks: r.blocks,
    turnovers: r.turnovers,
    fgm: r.fgm,
    fga: r.fga,
    fg3m: r.fg3m,
    fg3a: r.fg3a,
    ftm: r.ftm,
    fta: r.fta,
    minutes: r.minutes,
    gameDate: r.gameDate.toISOString().slice(0, 10),
    opponentTeamId: r.opponentTeamId,
    opponentAbbreviation: r.opponentTeam.abbreviation,
    isHome: r.isHome,
  }));
}

/** All slugs (for the sitemap — every player stays crawlable/indexable). */
export async function getAllPlayerSlugs(): Promise<string[]> {
  const rows = await db.player.findMany({
    select: { slug: true },
    orderBy: { slug: 'asc' },
  });
  return rows.map((r) => r.slug);
}

/**
 * Slugs for the busiest players, used by generateStaticParams. The rest are
 * rendered on-demand (ISR) on first visit — keeps build (and per-page OG image)
 * time bounded while every player remains in the sitemap and fully indexable.
 */
export async function getTopPlayerSlugs(limit = 200): Promise<string[]> {
  const rows = await db.player.findMany({
    select: { slug: true },
    orderBy: { gameStats: { _count: 'desc' } },
    take: limit,
  });
  return rows.map((r) => r.slug);
}

/** Search/list players for the home + players index pages and the API. */
export async function searchPlayers(q?: string, limit = 20): Promise<PlayerListItem[]> {
  const where = q
    ? {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' as const } },
          { lastName: { contains: q, mode: 'insensitive' as const } },
          { slug: { contains: q.toLowerCase().replace(/\s+/g, '-') } },
        ],
      }
    : {};
  const rows = await db.player.findMany({
    where,
    include: {
      team: { select: { abbreviation: true, name: true } },
      _count: { select: { gameStats: true } },
    },
    // Most active players first so search/browse surfaces relevant names.
    orderBy: [{ gameStats: { _count: 'desc' } }, { lastName: 'asc' }],
    take: limit,
  });
  return rows.map((p) => ({
    slug: p.slug,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: `${p.firstName} ${p.lastName}`.trim(),
    position: p.position ?? null,
    posBucket: (p.posBucket as PosBucket | null) ?? null,
    teamAbbreviation: p.team?.abbreviation ?? null,
    teamName: p.team?.name ?? null,
    gamesPlayed: p._count.gameStats,
  }));
}

/** DvP cell for one opponent within a bucket+stat, ranked across all teams. */
export async function getDvpForOpponent(
  posBucket: PosBucket,
  stat: StatKey,
  opponentTeamId: number,
): Promise<DvpCell | null> {
  const expr = STAT_SQL_EXPR[stat];
  const rows = await db.$queryRawUnsafe<
    { opponentTeamId: number; avg: number; n: number }[]
  >(
    `SELECT s."opponentTeamId" AS "opponentTeamId", AVG(${expr})::float8 AS avg, COUNT(*)::int AS n
     FROM "PlayerGameStat" s
     JOIN "Player" p ON p.id = s."playerId"
     WHERE p."posBucket" = $1 AND s.season = $2
       AND s.minutes IS NOT NULL AND s.minutes >= $3
     GROUP BY s."opponentTeamId"`,
    posBucket,
    SEASON,
    MINUTES_FLOOR,
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

/** Default line: season average for the stat, rounded to the nearest 0.5. */
function defaultLine(games: GameStatLine[], stat: StatKey): number {
  if (games.length === 0) return 0.5;
  const mean = games.reduce((a, g) => a + statValue(stat, g), 0) / games.length;
  return roundToHalfLine(mean);
}

/**
 * The full research payload for a player page / API response, computed for a
 * stat + line. `line` defaults to the season average rounded to 0.5.
 */
export async function getPlayerResearch(
  slug: string,
  stat: StatKey = 'pts',
  lineParam?: number,
): Promise<PlayerResearch | null> {
  const record = await getPlayerRecord(slug);
  if (!record) return null;
  const player = toSummary(record);

  // Exclude low-minute games / DNPs so they don't drag the rates around.
  const allGames = await getPlayerGames(record.id);
  const games = allGames.filter((g) => isQualified(g.minutes));
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
  if (recentOpponent && player.posBucket) {
    dvp = await getDvpForOpponent(player.posBucket, stat, recentOpponent.teamId);
  }

  const chart: ChartPoint[] = games.slice(0, 20).map((g) => {
    const value = statValue(stat, g);
    return {
      gameDate: g.gameDate,
      opponentAbbreviation: g.opponentAbbreviation,
      isHome: g.isHome,
      value,
      result: value > line ? 'over' : value < line ? 'under' : 'push',
    };
  });

  const l10 = windows.find((w) => w.window === '10')!.hitRate;
  const why = buildWhyText({
    playerName: player.fullName,
    stat,
    line,
    recent: l10,
    season: seasonResult,
    dvp: dvp ? { cell: dvp, opponentAbbreviation: recentOpponent!.abbreviation } : null,
  });

  return {
    player,
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
