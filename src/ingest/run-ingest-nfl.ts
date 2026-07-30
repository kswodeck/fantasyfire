// src/ingest/run-ingest-nfl.ts
//
// Full-season NFL ingest: ESPN hidden API -> Postgres (sport = "nfl").
//   pnpm ingest:nfl
//
// Unlike the per-player MLB/NBA game-log feeds, ESPN is game-centric: we walk the
// scoreboard by week, pull each completed game's box score, and merge a player's
// passing/rushing/receiving lines (client.ts) into one PlayerGameStat per game.
// Teams (ids + names) and positions/bios come from /teams and /teams/{id}/roster.
import 'dotenv/config';
import { db } from '../lib/db';
import { shouldIngest, offSeasonReason } from '../lib/seasonWindow';
import { recordIngestRun } from './ingestRun';
import { slugify } from './nba';
import { pMap } from './mlb';
import {
  getNflTeams,
  getNflRosterBios,
  fetchNflWeekEvents,
  fetchNflEventBoxScores,
  toNflPosBucket,
  inferPosBucket,
  nflSeason,
  type NflBoxRow,
  type NflBio,
} from './nfl/client';

const SPORT = 'nfl';
const CHUNK = 1000;
const RECENT_DAYS = 5;
// Regular season = seasontype 2 (weeks 1–18); postseason = seasontype 3 (1–5).
const SCHEDULE: { seasonType: number; weeks: number[] }[] = [
  { seasonType: 2, weeks: Array.from({ length: 18 }, (_, i) => i + 1) },
  { seasonType: 3, weeks: [1, 2, 3, 4, 5] },
];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  // Off-season short-circuit (see seasonWindow.ts). INGEST_IGNORE_SEASON=true forces it.
  if (!shouldIngest('nfl')) {
    console.log(`[nfl] ${offSeasonReason('nfl')}`);
    return;
  }
  const season = process.env.NFL_SEASON ? Number(process.env.NFL_SEASON) : nflSeason();
  console.log(`[nfl] season ${season}`);

  // ---- 1) Teams ----
  const teams = await getNflTeams();
  for (const t of teams) {
    await db.team.upsert({
      where: { sport_externalId: { sport: SPORT, externalId: t.externalId } },
      create: { sport: SPORT, externalId: t.externalId, abbreviation: t.abbreviation, name: t.name },
      update: { abbreviation: t.abbreviation, name: t.name },
    });
  }
  const teamRows = await db.team.findMany({
    where: { sport: SPORT },
    select: { id: true, externalId: true, abbreviation: true },
  });
  const teamIdByAbbr = new Map(teamRows.map((t) => [t.abbreviation, t.id]));
  console.log(`[nfl] upserted ${teamRows.length} teams`);

  // ---- 2) Rosters -> bios + current team ----
  const bioByAthlete = new Map<number, NflBio>();
  const teamExternalByAthlete = new Map<number, number>();
  await pMap(
    teams,
    async (t) => {
      const bios = await getNflRosterBios(t.externalId);
      for (const [id, bio] of bios) {
        bioByAthlete.set(id, bio);
        teamExternalByAthlete.set(id, t.externalId);
      }
    },
    6,
  );
  console.log(`[nfl] ${bioByAthlete.size} rostered players with bios`);

  // ---- 3) Box scores (walk every week) ----
  const events: { eventId: string; dateIso: string }[] = [];
  for (const { seasonType, weeks } of SCHEDULE) {
    const perWeek = await pMap(weeks, (w) => fetchNflWeekEvents(season, seasonType, w), 4);
    for (const list of perWeek) events.push(...list);
  }
  console.log(`[nfl] ${events.length} completed games`);
  if (events.length === 0) {
    console.warn('[nfl] no completed games — nothing to write.');
    return;
  }
  const perGame = await pMap(events, (e) => fetchNflEventBoxScores(e.eventId, e.dateIso), 5);
  const boxRows = perGame.flat();
  console.log(`[nfl] ${boxRows.length} athlete-game lines (pre-filter)`);

  // ---- 4) Resolve a prop bucket per athlete (roster position, else infer) ----
  const aggByAthlete = new Map<number, NflBoxRow>(); // summed stats for inference
  const latestTeamByAthlete = new Map<number, { date: string; abbr: string }>();
  for (const r of boxRows) {
    const agg = aggByAthlete.get(r.athleteId);
    if (!agg) {
      aggByAthlete.set(r.athleteId, { ...r });
    } else {
      agg.passAttempts += r.passAttempts;
      agg.rushAttempts += r.rushAttempts;
      agg.receptions += r.receptions;
      agg.targets += r.targets;
    }
    const latest = latestTeamByAthlete.get(r.athleteId);
    if (!latest || r.gameDate > latest.date) latestTeamByAthlete.set(r.athleteId, { date: r.gameDate, abbr: r.teamAbbr });
  }
  const bucketByAthlete = new Map<number, 'QB' | 'RB' | 'WR' | 'TE'>();
  for (const [id, agg] of aggByAthlete) {
    const bucket = toNflPosBucket(bioByAthlete.get(id)?.position) ?? inferPosBucket(agg);
    if (bucket) bucketByAthlete.set(id, bucket);
  }
  const skillRows = boxRows.filter((r) => bucketByAthlete.has(r.athleteId));
  console.log(`[nfl] ${bucketByAthlete.size} skill players, ${skillRows.length} stat lines kept`);

  // ---- 5) Players (slug dedup; slug set on create only) ----
  const athleteIds = [...bucketByAthlete.keys()];
  const nameById = new Map<number, { firstName: string; lastName: string; jersey: string | null }>();
  for (const r of skillRows) {
    if (!nameById.has(r.athleteId)) nameById.set(r.athleteId, { firstName: r.firstName, lastName: r.lastName, jersey: r.jersey });
  }

  const existing = await db.player.findMany({ where: { sport: SPORT }, select: { externalId: true, slug: true } });
  const slugByAthlete = new Map<number, string>(existing.map((e) => [e.externalId, e.slug]));
  const usedSlugs = new Set<string>(existing.map((e) => e.slug));
  for (const id of [...athleteIds].sort((a, b) => a - b)) {
    if (slugByAthlete.has(id)) continue;
    const nm = nameById.get(id);
    const name = nm ? `${nm.firstName} ${nm.lastName}` : `player ${id}`;
    const baseRaw = slugify(name) || `player-${id}`;
    let slug = baseRaw;
    let i = 2;
    while (usedSlugs.has(slug)) slug = `${baseRaw}-${i++}`;
    usedSlugs.add(slug);
    slugByAthlete.set(id, slug);
  }

  for (const part of chunk(athleteIds, 50)) {
    await Promise.all(
      part.map((id) => {
        const nm = nameById.get(id)!;
        const bio = bioByAthlete.get(id);
        const latestAbbr = latestTeamByAthlete.get(id)?.abbr;
        const teamExternal = teamExternalByAthlete.get(id);
        const teamRow = teamExternal
          ? teamRows.find((t) => t.externalId === teamExternal)
          : latestAbbr
            ? teamRows.find((t) => t.abbreviation === latestAbbr)
            : undefined;
        const data = {
          firstName: nm.firstName,
          lastName: nm.lastName,
          position: bio?.position ?? bucketByAthlete.get(id)!,
          posBucket: bucketByAthlete.get(id)!,
          jersey: nm.jersey ?? bio?.jersey ?? undefined,
          height: bio?.height ?? undefined,
          weight: bio?.weight ?? undefined,
          college: bio?.college ?? undefined,
          draftYear: bio?.draftYear ?? undefined,
          draftRound: bio?.draftRound ?? undefined,
          draftNumber: bio?.draftNumber ?? undefined,
          fromYear: bio?.fromYear ?? undefined,
          teamId: teamRow?.id ?? undefined,
        };
        return db.player.upsert({
          where: { sport_externalId: { sport: SPORT, externalId: id } },
          create: { sport: SPORT, externalId: id, slug: slugByAthlete.get(id)!, ...data },
          update: data,
        });
      }),
    );
  }
  const playerRows = await db.player.findMany({ where: { sport: SPORT }, select: { id: true, externalId: true } });
  const playerIdByExternal = new Map(playerRows.map((p) => [p.externalId, p.id]));
  console.log(`[nfl] upserted ${playerRows.length} players`);

  // ---- 6) Games (distinct by event id) ----
  const gameByEvent = new Map<
    string,
    { sport: string; externalId: string; date: Date; season: string; homeTeamId: number; awayTeamId: number }
  >();
  for (const r of skillRows) {
    if (gameByEvent.has(r.eventId)) continue;
    const teamId = teamIdByAbbr.get(r.teamAbbr);
    const oppId = teamIdByAbbr.get(r.opponentAbbr);
    if (!teamId || !oppId) continue;
    gameByEvent.set(r.eventId, {
      sport: SPORT,
      externalId: r.eventId,
      date: new Date(`${r.gameDate}T00:00:00Z`),
      season: String(season),
      homeTeamId: r.isHome ? teamId : oppId,
      awayTeamId: r.isHome ? oppId : teamId,
    });
  }
  let gamesInserted = 0;
  for (const part of chunk([...gameByEvent.values()], CHUNK)) {
    const res = await db.game.createMany({ data: part, skipDuplicates: true });
    gamesInserted += res.count;
  }
  const gameRows = await db.game.findMany({ where: { sport: SPORT }, select: { id: true, externalId: true } });
  const gameIdByEvent = new Map(gameRows.map((g) => [g.externalId, g.id]));
  console.log(`[nfl] games: ${gameByEvent.size} distinct, ${gamesInserted} newly inserted`);

  // ---- 7) Stat lines ----
  const statData = [];
  let skipped = 0;
  for (const r of skillRows) {
    const playerId = playerIdByExternal.get(r.athleteId);
    const gameId = gameIdByEvent.get(r.eventId);
    const teamId = teamIdByAbbr.get(r.teamAbbr);
    const opponentTeamId = teamIdByAbbr.get(r.opponentAbbr);
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
      gameDate: new Date(`${r.gameDate}T00:00:00Z`),
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
    });
  }
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
    `[nfl] stats: ${statData.length} rows ready, ${statsInserted} historical inserted, ` +
      `${recentStats.length} recent upserted` +
      (skipped ? `, ${skipped} skipped` : ''),
  );

  console.log('\n[nfl] done:');
  console.table({
    teams: teamRows.length,
    players: playerRows.length,
    gamesDistinct: gameByEvent.size,
    gamesInserted,
    statsInserted,
  });
}

recordIngestRun('nfl', main)
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
