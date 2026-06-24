// src/ingest/run-ingest.ts
//
// Orchestrates a full-season ingest: stats.nba.com -> Postgres.
//
//   pnpm ingest
//
// Run OUTSIDE Vercel (GitHub Actions / VPS / local) — stats.nba.com blocks many
// cloud IPs. If every request times out you'll get NbaLikelyBlockedError; that's
// the IP block, not a bug. Do NOT fabricate data to get around it.
//
// Strategy (idempotent + batched for a full season of tens of thousands of rows):
//   teams   -> upsert      (small; abbreviation/name can change)
//   players -> upsert      (~500; team/position change over a season)
//   games   -> createMany skipDuplicates   (immutable once final)
//   stats   -> recent games (last RECENT_DAYS) upsert; older games createMany
//
// Why split the stat write: createMany+skipDuplicates inserts NEW rows and skips
// existing ones, so on its own it never overwrites a box score the NBA later
// CORRECTS (stat fixes land for a day or two after a game). So we UPSERT the last
// few days of games (where corrections happen) and keep the fast batched
// createMany for the settled historical rows.
import 'dotenv/config';
import { db } from '../lib/db';
import { NbaStatsClient, NbaLikelyBlockedError, slugify } from './nba';
import type { PlayerGameLogRow, PlayerIndexRow } from './nba';
import { configuredSeason, previousNbaSeason } from '../lib/season';

const SPORT = 'nba';
const CHUNK = 1000;
// Games within this many days are re-UPSERTED so late stat corrections land;
// older rows take the faster insert-only path.
const RECENT_DAYS = 5;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchSeason(
  season: string,
): Promise<{ players: PlayerIndexRow[]; logs: PlayerGameLogRow[] }> {
  const nba = new NbaStatsClient({ season });
  console.log(`[ingest] fetching player index for ${season}…`);
  const players = await nba.getPlayerIndex();
  console.log(`[ingest]   ${players.length} players`);
  console.log('[ingest] fetching league game log (full season, one response)…');
  const logs = await nba.getLeagueGameLog();
  console.log(`[ingest]   ${logs.length} player-game rows`);
  return { players, logs };
}

async function main() {
  // Season is computed from today's date (NBA_SEASON can still override it).
  let season = configuredSeason();
  console.log(`[ingest] season ${season}`);

  let players: PlayerIndexRow[];
  let logs: PlayerGameLogRow[];
  try {
    ({ players, logs } = await fetchSeason(season));
    // Fail gracefully: if the computed season has no games yet (offseason, or just
    // after the Oct 15 flip), fall back to the previous season.
    if (logs.length === 0) {
      const prev = previousNbaSeason(season);
      console.warn(`[ingest] no games for ${season}; falling back to ${prev}`);
      season = prev;
      ({ players, logs } = await fetchSeason(season));
    }
  } catch (err) {
    if (err instanceof NbaLikelyBlockedError) {
      console.error(`\n[ingest] ABORTED — stats.nba.com is blocking this host.\n`);
      console.error(err.message);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  if (logs.length === 0) {
    console.warn(
      `[ingest] no games for ${season} or the prior season — normal deep in the ` +
        `offseason. Nothing to write.`,
    );
    return;
  }

  // ---- 1) Teams: derive from the game log (authoritative id<->abbr), plus any
  //         team referenced by the player index. ----
  const teamByNbaId = new Map<number, { nbaId: number; abbreviation: string }>();
  for (const row of logs) {
    if (!teamByNbaId.has(row.teamId)) {
      teamByNbaId.set(row.teamId, { nbaId: row.teamId, abbreviation: row.teamAbbreviation });
    }
  }
  for (const p of players) {
    if (p.teamId && p.teamAbbreviation && !teamByNbaId.has(p.teamId)) {
      teamByNbaId.set(p.teamId, { nbaId: p.teamId, abbreviation: p.teamAbbreviation });
    }
  }

  for (const t of teamByNbaId.values()) {
    await db.team.upsert({
      where: { sport_externalId: { sport: SPORT, externalId: t.nbaId } },
      create: { sport: SPORT, externalId: t.nbaId, abbreviation: t.abbreviation, name: t.abbreviation },
      update: { abbreviation: t.abbreviation },
    });
  }
  const teamRows = await db.team.findMany({
    where: { sport: SPORT },
    select: { id: true, externalId: true, abbreviation: true },
  });
  const teamIdByNbaId = new Map(teamRows.map((t) => [t.externalId, t.id]));
  const teamIdByAbbr = new Map(teamRows.map((t) => [t.abbreviation, t.id]));
  console.log(`[ingest] upserted ${teamRows.length} teams`);

  // Normalize slugs to clean ASCII (NBA slugs can contain accents, e.g.
  // "luka-dončić") and de-duplicate. Existing players KEEP their slug (stable
  // URLs across re-ingests); new players get a deduped slug seeded with slugs
  // already taken so they never collide with an existing row.
  const existingPlayers = await db.player.findMany({
    where: { sport: SPORT },
    select: { externalId: true, slug: true },
  });
  const slugByNbaId = new Map<number, string>(existingPlayers.map((e) => [e.externalId, e.slug]));
  const usedSlugs = new Set<string>(existingPlayers.map((e) => e.slug));
  for (const p of [...players].sort((a, b) => a.personId - b.personId)) {
    if (slugByNbaId.has(p.personId)) continue;
    const base = slugify(p.slug || `${p.firstName} ${p.lastName}`) || `player-${p.personId}`;
    let slug = base;
    let i = 2;
    while (usedSlugs.has(slug)) slug = `${base}-${i++}`;
    usedSlugs.add(slug);
    slugByNbaId.set(p.personId, slug);
  }

  // ---- 2) Players (upsert in concurrent chunks for throughput) ----
  // NOT wrapped in $transaction: over a remote DB (Supabase) a 100-row interactive
  // transaction blows past the 5s timeout. Upserts are independent + idempotent, so
  // plain concurrent batches are fine; the pg pool caps real concurrency.
  for (const part of chunk(players, 50)) {
    await Promise.all(
      part.map((p) => {
        const teamId = p.teamId ? teamIdByNbaId.get(p.teamId) : undefined;
        const slug = slugByNbaId.get(p.personId)!;
        return db.player.upsert({
          where: { sport_externalId: { sport: SPORT, externalId: p.personId } },
          create: {
            sport: SPORT,
            externalId: p.personId,
            firstName: p.firstName,
            lastName: p.lastName,
            slug,
            position: p.position ?? undefined,
            posBucket: p.posBucket ?? undefined,
            jersey: p.jerseyNumber ?? undefined,
            height: p.height ?? undefined,
            weight: p.weight ?? undefined,
            college: p.college ?? undefined,
            country: p.country ?? undefined,
            draftYear: p.draftYear ?? undefined,
            draftRound: p.draftRound ?? undefined,
            draftNumber: p.draftNumber ?? undefined,
            fromYear: p.fromYear ?? undefined,
            teamId: teamId ?? undefined,
          },
          update: {
            firstName: p.firstName,
            lastName: p.lastName,
            position: p.position ?? undefined,
            posBucket: p.posBucket ?? undefined,
            jersey: p.jerseyNumber ?? undefined,
            height: p.height ?? undefined,
            weight: p.weight ?? undefined,
            college: p.college ?? undefined,
            country: p.country ?? undefined,
            draftYear: p.draftYear ?? undefined,
            draftRound: p.draftRound ?? undefined,
            draftNumber: p.draftNumber ?? undefined,
            fromYear: p.fromYear ?? undefined,
            teamId: teamId ?? undefined,
          },
        });
      }),
    );
  }
  const playerRows = await db.player.findMany({
    where: { sport: SPORT },
    select: { id: true, externalId: true },
  });
  const playerIdByNbaId = new Map(playerRows.map((p) => [p.externalId, p.id]));
  console.log(`[ingest] upserted ${playerRows.length} players`);

  // ---- 3) Games: one distinct row per GAME_ID with home/away resolved ----
  const gameByNbaId = new Map<
    string,
    { sport: string; externalId: string; date: Date; season: string; homeTeamId: number; awayTeamId: number }
  >();
  for (const row of logs) {
    if (gameByNbaId.has(row.gameId)) continue;
    const teamId = teamIdByAbbr.get(row.teamAbbreviation);
    const oppId = teamIdByAbbr.get(row.opponentAbbreviation);
    if (!teamId || !oppId) continue; // unmapped team; skip
    const homeTeamId = row.isHome ? teamId : oppId;
    const awayTeamId = row.isHome ? oppId : teamId;
    gameByNbaId.set(row.gameId, {
      sport: SPORT,
      externalId: row.gameId,
      date: new Date(row.gameDate),
      season,
      homeTeamId,
      awayTeamId,
    });
  }
  let gamesInserted = 0;
  for (const part of chunk([...gameByNbaId.values()], CHUNK)) {
    const res = await db.game.createMany({ data: part, skipDuplicates: true });
    gamesInserted += res.count;
  }
  const gameRows = await db.game.findMany({
    where: { sport: SPORT },
    select: { id: true, externalId: true },
  });
  const gameIdByNbaId = new Map(gameRows.map((g) => [g.externalId, g.id]));
  console.log(
    `[ingest] games: ${gameByNbaId.size} distinct, ${gamesInserted} newly inserted`,
  );

  // ---- 4) Player game stats ----
  const statData = [];
  let skipped = 0;
  for (const row of logs) {
    const playerId = playerIdByNbaId.get(row.playerId);
    const gameId = gameIdByNbaId.get(row.gameId);
    const teamId = teamIdByAbbr.get(row.teamAbbreviation);
    const opponentTeamId = teamIdByAbbr.get(row.opponentAbbreviation);
    if (!playerId || !gameId || !teamId || !opponentTeamId) {
      skipped++;
      continue;
    }
    statData.push({
      sport: SPORT,
      playerId,
      gameId,
      teamId,
      opponentTeamId,
      isHome: row.isHome,
      season,
      gameDate: new Date(row.gameDate),
      minutes: row.minutes ?? null,
      points: row.pts,
      rebounds: row.reb,
      oreb: row.oreb,
      dreb: row.dreb,
      assists: row.ast,
      steals: row.stl,
      blocks: row.blk,
      turnovers: row.tov,
      fouls: row.pf,
      fgm: row.fgm,
      fga: row.fga,
      fg3m: row.fg3m,
      fg3a: row.fg3a,
      ftm: row.ftm,
      fta: row.fta,
      wl: row.wl ?? null,
      plusMinus: row.plusMinus ?? null,
    });
  }
  // Split: recent games (last RECENT_DAYS) get an UPSERT so corrected box scores
  // overwrite; settled older games take the fast insert-only path.
  const recentCutoff = new Date();
  recentCutoff.setUTCDate(recentCutoff.getUTCDate() - RECENT_DAYS);
  recentCutoff.setUTCHours(0, 0, 0, 0);
  const recentStats = statData.filter((s) => s.gameDate >= recentCutoff);
  const historicalStats = statData.filter((s) => s.gameDate < recentCutoff);

  let statsInserted = 0;
  for (const part of chunk(historicalStats, CHUNK)) {
    const res = await db.playerGameStat.createMany({ data: part, skipDuplicates: true });
    statsInserted += res.count;
  }
  for (const part of chunk(recentStats, 50)) {
    await Promise.all(
      part.map(({ playerId, gameId, ...rest }) =>
        db.playerGameStat.upsert({
          where: { playerId_gameId: { playerId, gameId } },
          create: { playerId, gameId, ...rest },
          update: rest,
        }),
      ),
    );
  }
  console.log(
    `[ingest] stats: ${statData.length} rows ready, ${statsInserted} historical inserted, ` +
      `${recentStats.length} recent upserted` +
      (skipped ? `, ${skipped} skipped (unmapped player/game/team)` : ''),
  );

  console.log('\n[ingest] done:');
  console.table({
    teams: teamRows.length,
    players: playerRows.length,
    gamesDistinct: gameByNbaId.size,
    gamesInserted,
    statsInserted,
    statsRecentUpserted: recentStats.length,
    statsSkipped: skipped,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
