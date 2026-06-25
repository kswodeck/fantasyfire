// src/ingest/run-ingest-mlb.ts
//
// Full-season MLB ingest: statsapi.mlb.com -> Postgres (sport = "mlb").
//   pnpm ingest:mlb
//
// Mirrors the NBA ingest: derive teams, players (active rosters + bios), games,
// and per-game stat lines (hitting for position players, pitching for pitchers).
import 'dotenv/config';
import { db } from '../lib/db';
import { recordIngestRun } from './ingestRun';
import { slugify } from './nba';
import {
  getMlbTeams,
  getMlbRosterPersonIds,
  getMlbPeople,
  getMlbGameLog,
  mlbSeason,
  pMap,
  type MlbGameLogRow,
} from './mlb';

const SPORT = 'mlb';
const CHUNK = 1000;
// Games within this many days are re-UPSERTED so late stat corrections land;
// older rows take the faster insert-only path.
const RECENT_DAYS = 5;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const override = process.env.MLB_SEASON ? Number(process.env.MLB_SEASON) : null;
  let season = override ?? mlbSeason();
  console.log(`[mlb] season ${season}`);

  // ---- 1) Teams ----
  const teams = await getMlbTeams();
  for (const t of teams) {
    await db.team.upsert({
      where: { sport_externalId: { sport: SPORT, externalId: t.externalId } },
      create: { sport: SPORT, externalId: t.externalId, abbreviation: t.abbreviation, name: t.name },
      update: { abbreviation: t.abbreviation, name: t.name },
    });
  }
  const teamRows = await db.team.findMany({
    where: { sport: SPORT },
    select: { id: true, externalId: true },
  });
  const teamIdByExternal = new Map(teamRows.map((t) => [t.externalId, t.id]));
  console.log(`[mlb] upserted ${teamRows.length} teams`);

  // ---- 2) Rosters -> person ids (+ current team) ----
  const personTeam = new Map<number, number>(); // personId -> team externalId
  await pMap(
    teams,
    async (t) => {
      const ids = await getMlbRosterPersonIds(t.externalId, season);
      for (const id of ids) personTeam.set(id, t.externalId);
    },
    8,
  );
  const personIds = [...personTeam.keys()];
  console.log(`[mlb] ${personIds.length} active players across rosters`);

  // ---- 3) Bios ----
  const people = await getMlbPeople(personIds);
  console.log(`[mlb] fetched ${people.size} player bios`);

  // Stable, de-duplicated slugs (per sport). Existing players KEEP their slug
  // (stable URLs across re-ingests); new players get a deduped slug seeded with
  // the slugs already taken so they never collide with an existing row.
  const existing = await db.player.findMany({
    where: { sport: SPORT },
    select: { externalId: true, slug: true },
  });
  const slugByPerson = new Map<number, string>(existing.map((e) => [e.externalId, e.slug]));
  const usedSlugs = new Set<string>(existing.map((e) => e.slug));
  for (const id of [...personIds].sort((a, b) => a - b)) {
    if (slugByPerson.has(id)) continue;
    const p = people.get(id);
    const name = p ? `${p.firstName} ${p.lastName}` : `player ${id}`;
    const baseRaw = slugify(name) || `player-${id}`;
    let slug = baseRaw;
    let i = 2;
    while (usedSlugs.has(slug)) slug = `${baseRaw}-${i++}`;
    usedSlugs.add(slug);
    slugByPerson.set(id, slug);
  }

  // ---- 4) Upsert players (slug set on create only, never updated) ----
  const withBio = personIds.filter((id) => people.has(id));
  for (const part of chunk(withBio, 50)) {
    await Promise.all(
      part.map((id) => {
        const p = people.get(id)!;
        const teamExternal = personTeam.get(id);
        const teamId = teamExternal ? teamIdByExternal.get(teamExternal) : undefined;
        const slug = slugByPerson.get(id)!;
        const data = {
          firstName: p.firstName,
          lastName: p.lastName,
          position: p.position ?? undefined,
          posBucket: p.posBucket,
          jersey: p.jersey ?? undefined,
          height: p.height ?? undefined,
          weight: p.weight ?? undefined,
          country: p.country ?? undefined,
          fromYear: p.fromYear ?? undefined,
          teamId: teamId ?? undefined,
        };
        return db.player.upsert({
          where: { sport_externalId: { sport: SPORT, externalId: id } },
          create: { sport: SPORT, externalId: id, slug, ...data },
          update: data,
        });
      }),
    );
  }
  const playerRows = await db.player.findMany({
    where: { sport: SPORT },
    select: { id: true, externalId: true, posBucket: true },
  });
  const playerIdByExternal = new Map(playerRows.map((p) => [p.externalId, p.id]));
  console.log(`[mlb] upserted ${playerRows.length} players`);

  // ---- 5) Game logs (one call per player, by role) ----
  async function fetchLogs(yr: number): Promise<MlbGameLogRow[]> {
    const perPlayer = await pMap(
      playerRows,
      (p) => getMlbGameLog(p.externalId, p.posBucket === 'P' ? 'pitching' : 'hitting', yr),
      8,
    );
    return perPlayer.flat();
  }
  let logs = await fetchLogs(season);
  if (logs.length === 0) {
    console.warn(`[mlb] no game logs for ${season}; falling back to ${season - 1}`);
    season = season - 1;
    logs = await fetchLogs(season);
  }
  console.log(`[mlb] ${logs.length} player-game stat lines`);
  if (logs.length === 0) {
    console.warn('[mlb] no games — nothing to write.');
    return;
  }

  // ---- 6) Games (distinct by gamePk) ----
  const gameByPk = new Map<
    string,
    { sport: string; externalId: string; date: Date; season: string; homeTeamId: number; awayTeamId: number }
  >();
  for (const r of logs) {
    if (gameByPk.has(r.gamePk)) continue;
    const teamId = teamIdByExternal.get(r.teamId);
    const oppId = teamIdByExternal.get(r.opponentId);
    if (!teamId || !oppId) continue;
    gameByPk.set(r.gamePk, {
      sport: SPORT,
      externalId: r.gamePk,
      date: new Date(r.date),
      season: String(season),
      homeTeamId: r.isHome ? teamId : oppId,
      awayTeamId: r.isHome ? oppId : teamId,
    });
  }
  let gamesInserted = 0;
  for (const part of chunk([...gameByPk.values()], CHUNK)) {
    const res = await db.game.createMany({ data: part, skipDuplicates: true });
    gamesInserted += res.count;
  }
  const gameRows = await db.game.findMany({
    where: { sport: SPORT },
    select: { id: true, externalId: true },
  });
  const gameIdByPk = new Map(gameRows.map((g) => [g.externalId, g.id]));
  console.log(`[mlb] games: ${gameByPk.size} distinct, ${gamesInserted} newly inserted`);

  // ---- 7) Stat lines ----
  const statData = [];
  let skipped = 0;
  for (const r of logs) {
    const playerId = playerIdByExternal.get(r.personId);
    const gameId = gameIdByPk.get(r.gamePk);
    const teamId = teamIdByExternal.get(r.teamId);
    const opponentTeamId = teamIdByExternal.get(r.opponentId);
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
      isHome: r.isHome,
      season: String(season),
      gameDate: new Date(r.date),
      atBats: r.atBats ?? null,
      hits: r.hits ?? null,
      doubles: r.doubles ?? null,
      triples: r.triples ?? null,
      homeRuns: r.homeRuns ?? null,
      runs: r.runs ?? null,
      rbi: r.rbi ?? null,
      walks: r.walks ?? null,
      strikeouts: r.strikeouts ?? null,
      stolenBases: r.stolenBases ?? null,
      totalBases: r.totalBases ?? null,
      hbp: r.hbp ?? null,
      outs: r.outs ?? null,
      hitsAllowed: r.hitsAllowed ?? null,
      runsAllowed: r.runsAllowed ?? null,
      earnedRuns: r.earnedRuns ?? null,
      walksAllowed: r.walksAllowed ?? null,
      strikeoutsPitched: r.strikeoutsPitched ?? null,
      pitcherWin: r.pitcherWin ?? null,
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
    `[mlb] stats: ${statData.length} rows ready, ${statsInserted} historical inserted, ` +
      `${recentStats.length} recent upserted` +
      (skipped ? `, ${skipped} skipped` : ''),
  );

  console.log('\n[mlb] done:');
  console.table({
    teams: teamRows.length,
    players: playerRows.length,
    gamesDistinct: gameByPk.size,
    gamesInserted,
    statsInserted,
    statsRecentUpserted: recentStats.length,
  });
}

recordIngestRun('mlb', main)
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
