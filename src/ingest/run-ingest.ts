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
//   stats   -> createMany skipDuplicates   (final once a game completes)
//
// Note: createMany+skipDuplicates inserts NEW rows and skips existing ones, so it
// will not overwrite a previously-ingested game's box score if the NBA later
// corrects it. That's an accepted v1 tradeoff (corrections are rare). A future
// enhancement could re-upsert the last few days of games.
import 'dotenv/config';
import { db } from '../lib/db';
import { NbaStatsClient, NbaLikelyBlockedError, slugify } from './nba';
import type { PlayerGameLogRow, PlayerIndexRow } from './nba';
import { configuredSeason, previousNbaSeason } from '../lib/season';

const CHUNK = 1000;

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
      where: { nbaId: t.nbaId },
      create: { nbaId: t.nbaId, abbreviation: t.abbreviation, name: t.abbreviation },
      update: { abbreviation: t.abbreviation },
    });
  }
  const teamRows = await db.team.findMany({
    select: { id: true, nbaId: true, abbreviation: true },
  });
  const teamIdByNbaId = new Map(teamRows.map((t) => [t.nbaId, t.id]));
  const teamIdByAbbr = new Map(teamRows.map((t) => [t.abbreviation, t.id]));
  console.log(`[ingest] upserted ${teamRows.length} teams`);

  // Normalize slugs to clean ASCII (NBA slugs can contain accents, e.g.
  // "luka-dončić") and de-duplicate to satisfy the unique constraint. Sorting by
  // personId makes the assignment deterministic across runs (stable URLs).
  const usedSlugs = new Set<string>();
  const slugByNbaId = new Map<number, string>();
  for (const p of [...players].sort((a, b) => a.personId - b.personId)) {
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
          where: { nbaId: p.personId },
          create: {
            nbaId: p.personId,
            firstName: p.firstName,
            lastName: p.lastName,
            slug,
            position: p.position ?? undefined,
            posBucket: p.posBucket ?? undefined,
            jersey: p.jerseyNumber ?? undefined,
            height: p.height ?? undefined,
            weight: p.weight ?? undefined,
            teamId: teamId ?? undefined,
          },
          update: {
            firstName: p.firstName,
            lastName: p.lastName,
            slug,
            position: p.position ?? undefined,
            posBucket: p.posBucket ?? undefined,
            jersey: p.jerseyNumber ?? undefined,
            height: p.height ?? undefined,
            weight: p.weight ?? undefined,
            teamId: teamId ?? undefined,
          },
        });
      }),
    );
  }
  const playerRows = await db.player.findMany({ select: { id: true, nbaId: true } });
  const playerIdByNbaId = new Map(playerRows.map((p) => [p.nbaId, p.id]));
  console.log(`[ingest] upserted ${playerRows.length} players`);

  // ---- 3) Games: one distinct row per GAME_ID with home/away resolved ----
  const gameByNbaId = new Map<
    string,
    { nbaId: string; date: Date; season: string; homeTeamId: number; awayTeamId: number }
  >();
  for (const row of logs) {
    if (gameByNbaId.has(row.gameId)) continue;
    const teamId = teamIdByAbbr.get(row.teamAbbreviation);
    const oppId = teamIdByAbbr.get(row.opponentAbbreviation);
    if (!teamId || !oppId) continue; // unmapped team; skip
    const homeTeamId = row.isHome ? teamId : oppId;
    const awayTeamId = row.isHome ? oppId : teamId;
    gameByNbaId.set(row.gameId, {
      nbaId: row.gameId,
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
  const gameRows = await db.game.findMany({ select: { id: true, nbaId: true } });
  const gameIdByNbaId = new Map(gameRows.map((g) => [g.nbaId, g.id]));
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
      assists: row.ast,
      steals: row.stl,
      blocks: row.blk,
      turnovers: row.tov,
      fgm: row.fgm,
      fga: row.fga,
      fg3m: row.fg3m,
      fg3a: row.fg3a,
      ftm: row.ftm,
      fta: row.fta,
    });
  }
  let statsInserted = 0;
  for (const part of chunk(statData, CHUNK)) {
    const res = await db.playerGameStat.createMany({ data: part, skipDuplicates: true });
    statsInserted += res.count;
  }
  console.log(
    `[ingest] stats: ${statData.length} rows ready, ${statsInserted} newly inserted` +
      (skipped ? `, ${skipped} skipped (unmapped player/game/team)` : ''),
  );

  console.log('\n[ingest] done:');
  console.table({
    teams: teamRows.length,
    players: playerRows.length,
    gamesDistinct: gameByNbaId.size,
    gamesInserted,
    statsInserted,
    statsSkipped: skipped,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
