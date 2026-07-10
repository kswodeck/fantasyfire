// src/ingest/run-ingest-espn.ts
//
// Config-driven ingest for the ESPN-native sports: ESPN hidden API -> Postgres.
//   pnpm ingest:nhl   (tsx src/ingest/run-ingest-espn.ts nhl)
//   pnpm ingest:wnba  (tsx src/ingest/run-ingest-espn.ts wnba)
//   pnpm ingest:mls   (tsx src/ingest/run-ingest-espn.ts mls)
//   pnpm ingest:cfb   (tsx src/ingest/run-ingest-espn.ts cfb)
//   pnpm ingest:cbb   (tsx src/ingest/run-ingest-espn.ts cbb)
//
// Like the NFL runner, ESPN is game-centric: walk the scoreboard by DATE, pull
// each completed game's box score, and upsert players/games/stats. The walk is
// INCREMENTAL: it starts a few days before the newest stat row already in the DB
// (first run: the season start), so a nightly run fetches only the last slates
// while the first run backfills the whole season. Set INGEST_START_DATE
// (YYYY-MM-DD) to force the walk's start — handy for tests and partial backfills.
import 'dotenv/config';
import { db } from '../lib/db';
import { recordIngestRun } from './ingestRun';
import { slugify } from './nba';
import { pMap } from './mlb';
import { currentSeason } from '../lib/season';
import { isSport, type Sport } from '../lib/sports';
import {
  ESPN_SPORT_PATH,
  getEspnTeams,
  getEspnRosterBios,
  fetchEspnCompletedEvents,
  fetchNhlEventBoxScores,
  fetchWnbaEventBoxScores,
  fetchSoccerEventBoxScores,
  fetchFootballEventBoxScores,
  toNhlPosBucket,
  toWnbaPosBucket,
  toSoccerPosBucket,
  toCbbPosBucket,
  toFootballPosBucket,
  type EspnGenBoxRow,
  type EspnBoxScoreResult,
  type EspnBio,
  type EspnEventRef,
} from './espnSports';

const CHUNK = 1000;
const RECENT_DAYS = 5;
/** Hard cap on the date walk — one full season plus slack, never more. */
const MAX_WALK_DAYS = 400;

interface EspnIngestConfig {
  sport: Sport;
  path: string;
  fetchBoxScores: (path: string, eventId: string, dateIso: string) => Promise<EspnBoxScoreResult>;
  toPosBucket: (position: string | null | undefined) => string | null;
  /** Fallback bucket from a summed stat line when neither roster nor summary
   *  carries a usable position. Null rows are dropped (same as the NFL runner). */
  inferPosBucket: (agg: EspnGenBoxRow) => string | null;
  /** ESPN season types to ingest (undefined = all; soccer has no pre/post split). */
  seasonTypes?: Set<number>;
  /** First day of a season, for the initial backfill walk. `season` is this
   *  sport's season string ("2025-26" or "2026"). */
  seasonStartIso: (season: string) => string;
  /** Last plausible day of a season — a safe margin PAST the final/championship,
   *  before any date the next season could start. Used to tell an in-season date
   *  (games possible; a scoreboard failure must not be swallowed) from an
   *  off-season one (no games; ESPN routinely 500s on these). `season` matches
   *  seasonStartIso's. */
  seasonEndIso: (season: string) => string;
  /** Extra scoreboard query — college scoreboards default to a featured subset
   *  (Top 25) unless a groups filter + a high limit are passed. */
  scoreboardQuery?: string;
  /** Skip the /teams phase and build the team table from box scores only. The
   *  college /teams endpoint returns EVERY school (755+ for football, far beyond
   *  the FBS slate we walk) with non-unique abbreviations. */
  skipLeagueTeams?: boolean;
  /** Fetch rosters only for the teams that actually appear in the ingested box
   *  scores (college: hundreds of schools, but only the walked slate matters). */
  rosterFromBoxTeams?: boolean;
}

const nhlInfer = (agg: EspnGenBoxRow): string | null => {
  if ((agg.stats.saves ?? 0) > 0 || (agg.stats.shotsAgainst ?? 0) > 0) return 'G';
  return 'F'; // shots/goals/hits don't separate F from D — F is the safe default
};
const soccerInfer = (agg: EspnGenBoxRow): string | null => {
  if ((agg.stats.saves ?? 0) > 0 || (agg.stats.shotsAgainst ?? 0) > 0) return 'G';
  return 'M'; // outfield fallback: midfielder gets the generic outfield markets
};
// Same inference the NFL runner uses (see nfl/client.ts inferPosBucket): summed
// stat shape separates QBs and RBs; pass-catchers default to WR.
const footballInfer = (agg: EspnGenBoxRow): string | null => {
  const s = agg.stats;
  if ((s.passAttempts ?? 0) > 0) return 'QB';
  if ((s.targets ?? 0) > 0 || (s.receptions ?? 0) > 0) {
    if ((s.rushAttempts ?? 0) > (s.receptions ?? 0)) return 'RB';
    return 'WR';
  }
  if ((s.rushAttempts ?? 0) > 0) return 'RB';
  return null;
};

const CONFIGS: Partial<Record<Sport, EspnIngestConfig>> = {
  nhl: {
    sport: 'nhl',
    path: ESPN_SPORT_PATH.nhl!,
    fetchBoxScores: fetchNhlEventBoxScores,
    toPosBucket: toNhlPosBucket,
    inferPosBucket: nhlInfer,
    seasonTypes: new Set([2, 3]), // regular + playoffs, no preseason
    // "2025-26" -> Oct 1 2025 (opening night is early October).
    seasonStartIso: (season) => `${season.slice(0, 4)}-10-01`,
    // Stanley Cup wraps in late June; next season opens in October.
    seasonEndIso: (season) => `${Number(season.slice(0, 4)) + 1}-07-01`,
  },
  wnba: {
    sport: 'wnba',
    path: ESPN_SPORT_PATH.wnba!,
    fetchBoxScores: fetchWnbaEventBoxScores,
    toPosBucket: toWnbaPosBucket,
    inferPosBucket: () => 'F', // basketball stats don't separate G/F/C — F is neutral
    seasonTypes: new Set([2, 3]),
    // "2026" -> May 1 2026 (tip-off is mid-May).
    seasonStartIso: (season) => `${season}-05-01`,
    // Finals wrap in mid-October; next season tips off the following May.
    seasonEndIso: (season) => `${season}-11-15`,
  },
  mls: {
    sport: 'mls',
    path: ESPN_SPORT_PATH.mls!,
    fetchBoxScores: fetchSoccerEventBoxScores,
    toPosBucket: toSoccerPosBucket,
    inferPosBucket: soccerInfer,
    // "2026" -> Feb 15 2026 (the regular season kicks off late February).
    seasonStartIso: (season) => `${season}-02-15`,
    // MLS Cup is early December; the next season kicks off late February.
    seasonEndIso: (season) => `${season}-12-20`,
  },
  cfb: {
    sport: 'cfb',
    path: ESPN_SPORT_PATH.cfb!,
    fetchBoxScores: fetchFootballEventBoxScores,
    toPosBucket: toFootballPosBucket,
    inferPosBucket: footballInfer,
    seasonTypes: new Set([2, 3]), // regular + bowls/playoff
    // "2025" -> Aug 20 2025 (Week 0 kicks off late August).
    seasonStartIso: (season) => `${season}-08-20`,
    // The CFP title game is mid-January; the next season is Week 0 in late August.
    seasonEndIso: (season) => `${Number(season) + 1}-02-01`,
    scoreboardQuery: '&groups=80&limit=300', // FBS, whole slate
    skipLeagueTeams: true,
    rosterFromBoxTeams: true,
  },
  cbb: {
    sport: 'cbb',
    path: ESPN_SPORT_PATH.cbb!,
    fetchBoxScores: fetchWnbaEventBoxScores, // basketball summaries share one shape
    toPosBucket: toCbbPosBucket,
    inferPosBucket: () => 'F', // basketball stats don't separate G/F/C — F is neutral
    seasonTypes: new Set([2, 3]),
    // "2025-26" -> Nov 1 2025 (tip-off is the first week of November).
    seasonStartIso: (season) => `${season.slice(0, 4)}-11-01`,
    // The title game is early April; the next season tips off in November.
    seasonEndIso: (season) => `${Number(season.slice(0, 4)) + 1}-05-01`,
    scoreboardQuery: '&groups=50&limit=400', // Division I, whole slate
    skipLeagueTeams: true,
    rosterFromBoxTeams: true,
  },
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Every YYYY-MM-DD from `startIso` through `endIso` inclusive (UTC). */
function dateRange(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const end = new Date(`${endIso}T00:00:00Z`).getTime();
  let t = new Date(`${startIso}T00:00:00Z`).getTime();
  for (let i = 0; t <= end && i < MAX_WALK_DAYS; i++, t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Team upsert that survives abbreviation collisions. College data has 750+
 *  schools and abbreviations are NOT unique across them — when a second team
 *  claims a taken (sport, abbreviation), store it with an id-suffixed
 *  abbreviation instead. Id-first resolution still matches all its rows. */
async function safeTeamUpsert(
  sport: Sport,
  t: { externalId: number; abbreviation: string; name: string },
): Promise<void> {
  const attempt = (abbreviation: string) =>
    db.team.upsert({
      where: { sport_externalId: { sport, externalId: t.externalId } },
      create: { sport, externalId: t.externalId, abbreviation, name: t.name },
      update: { abbreviation, name: t.name },
    });
  try {
    await attempt(t.abbreviation);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code !== 'P2002') throw e; // not a unique-constraint conflict
    const suffixed = `${t.abbreviation}-${t.externalId}`.slice(0, 20);
    console.warn(`[${sport}] abbreviation "${t.abbreviation}" taken — storing ${t.name} as ${suffixed}`);
    await attempt(suffixed);
  }
}

async function main() {
  const arg = process.argv[2];
  if (!isSport(arg) || !CONFIGS[arg]) {
    throw new Error(
      `Usage: tsx src/ingest/run-ingest-espn.ts <${Object.keys(CONFIGS).join('|')}> (got "${arg ?? ''}")`,
    );
  }
  const cfg = CONFIGS[arg]!;
  const SPORT = cfg.sport;
  const season = currentSeason(SPORT);
  console.log(`[${SPORT}] season ${season}`);

  // ---- 1) Teams ----
  // College skips the league /teams call: it returns EVERY school (with
  // non-unique abbreviations); the box scores define the real team set instead.
  const teams = cfg.skipLeagueTeams ? [] : await getEspnTeams(cfg.path);
  for (const t of teams) {
    await safeTeamUpsert(SPORT, t);
  }
  const teamRows = await db.team.findMany({
    where: { sport: SPORT },
    select: { id: true, externalId: true, abbreviation: true },
  });
  const teamIdByAbbr = new Map(teamRows.map((t) => [t.abbreviation, t.id]));
  const teamIdByExternal = new Map(teamRows.map((t) => [t.externalId, t.id]));
  console.log(`[${SPORT}] upserted ${teamRows.length} teams`);

  // ---- 2) Rosters -> bios + current team ----
  // (For rosterFromBoxTeams sports this runs AFTER the box scores, scoped to the
  // teams that actually played — see below.)
  const bioByAthlete = new Map<number, EspnBio>();
  const teamExternalByAthlete = new Map<number, number>();
  const loadRosters = async (externalIds: number[]) => {
    await pMap(
      externalIds,
      async (externalId) => {
        const bios = await getEspnRosterBios(cfg.path, externalId);
        for (const [id, bio] of bios) {
          bioByAthlete.set(id, bio);
          teamExternalByAthlete.set(id, externalId);
        }
      },
      6,
    );
  };
  if (!cfg.rosterFromBoxTeams) {
    await loadRosters(teams.map((t) => t.externalId));
    console.log(`[${SPORT}] ${bioByAthlete.size} rostered players with bios`);
  }

  // ---- 3) Box scores: incremental date walk ----
  const newest = await db.playerGameStat.aggregate({
    where: { sport: SPORT },
    _max: { gameDate: true },
  });
  let startIso: string;
  const forcedStart = process.env.INGEST_START_DATE?.trim();
  if (forcedStart && /^\d{4}-\d{2}-\d{2}$/.test(forcedStart)) {
    startIso = forcedStart; // explicit override (tests / partial backfills)
  } else if (newest._max.gameDate) {
    const from = new Date(newest._max.gameDate.getTime() - RECENT_DAYS * 86_400_000);
    startIso = from.toISOString().slice(0, 10);
  } else {
    startIso = cfg.seasonStartIso(season);
  }
  const todayIso = new Date().toISOString().slice(0, 10);
  const dates = dateRange(startIso, todayIso);
  console.log(`[${SPORT}] walking ${dates.length} dates (${startIso} .. ${todayIso})`);

  // Every date must resolve — a silently-skipped date is a PERMANENT hole in the
  // history (the incremental walk never revisits it). Failed dates get a second,
  // slower pass; a date that still fails aborts the run so the next one retries.
  const seen = new Set<string>();
  const events: EspnEventRef[] = [];
  const failedDates: string[] = [];
  const perDate = await pMap(
    dates,
    (d) =>
      fetchEspnCompletedEvents(cfg.path, d, cfg.scoreboardQuery ?? '').catch((e) => {
        console.warn(`[${SPORT}] scoreboard ${d} failed: ${(e as Error).message}`);
        failedDates.push(d);
        return [] as EspnEventRef[];
      }),
    4,
  );
  const collect = (list: EspnEventRef[]) => {
    for (const e of list) {
      if (seen.has(e.eventId)) continue; // adjacent dates can return the same event
      seen.add(e.eventId);
      if (cfg.seasonTypes && e.seasonType != null && !cfg.seasonTypes.has(e.seasonType)) continue;
      events.push(e);
    }
  };
  for (const list of perDate) collect(list);
  if (failedDates.length > 0) {
    // A date that failed the burst pass gets a slow, isolated retry. If it STILL
    // fails, how we react depends on whether the date is in-season: an in-season
    // date can carry games, and silently skipping it would leave a PERMANENT hole
    // (the incremental walk never revisits it), so we throw and let the next run
    // retry. An off-season date has no games — ESPN routinely 500s on those — so
    // skipping it is safe and keeps one flaky off-season day from wedging the
    // whole sport's ingest indefinitely (the walk always runs to today, months
    // past the final for a just-finished season).
    const inSeason = (d: string): boolean => {
      const s = currentSeason(SPORT, new Date(`${d}T12:00:00Z`));
      return d >= cfg.seasonStartIso(s) && d <= cfg.seasonEndIso(s);
    };
    console.warn(`[${SPORT}] retrying ${failedDates.length} failed dates (sequential)`);
    for (const d of failedDates) {
      try {
        collect(await fetchEspnCompletedEvents(cfg.path, d, cfg.scoreboardQuery ?? ''));
      } catch (e) {
        if (inSeason(d)) throw e; // in-season date must resolve -> fail the run, next run retries
        console.warn(`[${SPORT}] off-season scoreboard ${d} still failing — skipped: ${(e as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  console.log(`[${SPORT}] ${events.length} completed games`);
  if (events.length === 0) {
    console.warn(`[${SPORT}] no completed games — nothing to write.`);
    return;
  }
  // Summaries get the same two-pass treatment as the scoreboard: a burst pass,
  // then a slow sequential retry. A game that STILL fails is logged and skipped
  // (never wedging the pipeline on one bad event) — rare enough to accept.
  const failedEvents: EspnEventRef[] = [];
  const perGame = await pMap(
    events,
    (e) =>
      cfg.fetchBoxScores(cfg.path, e.eventId, e.dateIso).catch((err) => {
        console.warn(`[${SPORT}] summary ${e.eventId} failed: ${(err as Error).message}`);
        failedEvents.push(e);
        return { rows: [], teams: [] } as EspnBoxScoreResult;
      }),
    5,
  );
  if (failedEvents.length > 0) {
    console.warn(`[${SPORT}] retrying ${failedEvents.length} failed summaries (sequential)`);
    for (const e of failedEvents) {
      try {
        perGame.push(await cfg.fetchBoxScores(cfg.path, e.eventId, e.dateIso));
      } catch (err) {
        console.warn(`[${SPORT}] summary ${e.eventId} PERMANENTLY skipped: ${(err as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  const boxRows = perGame.flatMap((g) => g.rows);
  console.log(`[${SPORT}] ${boxRows.length} athlete-game lines (pre-filter)`);

  // Upsert teams that appear in the box scores but not in /teams — that endpoint
  // lists only CURRENT league members, and historical games can involve clubs
  // that have since left the league or relocated. For skipLeagueTeams sports
  // (college) the box scores are the ONLY team source, so every seen team is
  // upserted each run to keep names/abbreviations fresh.
  const knownExternal = new Set(teamRows.map((t) => t.externalId));
  const missingTeams = new Map<number, { externalId: number; abbreviation: string; name: string }>();
  for (const g of perGame) {
    for (const t of g.teams) {
      if ((cfg.skipLeagueTeams || !knownExternal.has(t.externalId)) && !missingTeams.has(t.externalId)) {
        missingTeams.set(t.externalId, t);
      }
    }
  }
  if (missingTeams.size > 0) {
    for (const t of missingTeams.values()) {
      await safeTeamUpsert(SPORT, t);
    }
    const refreshed = await db.team.findMany({
      where: { sport: SPORT },
      select: { id: true, externalId: true, abbreviation: true },
    });
    teamIdByAbbr.clear();
    for (const t of refreshed) teamIdByAbbr.set(t.abbreviation, t.id);
    teamIdByExternal.clear();
    for (const t of refreshed) teamIdByExternal.set(t.externalId, t.id);
    console.log(`[${SPORT}] upserted ${missingTeams.size} former/missing teams from box scores`);
  }

  // Team resolution: ESPN team id first (reliable — abbreviations can DIFFER
  // between ESPN endpoints, e.g. NHL Utah is UTAH in /teams but UTA in
  // summaries), with the summary abbreviation as the fallback.
  const resolveTeamId = (externalId: number | null, abbr: string): number | undefined =>
    (externalId != null ? teamIdByExternal.get(externalId) : undefined) ?? teamIdByAbbr.get(abbr);

  // College: rosters for exactly the teams that appeared in the walked slate.
  if (cfg.rosterFromBoxTeams) {
    const seenTeamIds = new Set<number>();
    for (const g of perGame) for (const t of g.teams) seenTeamIds.add(t.externalId);
    await loadRosters([...seenTeamIds]);
    console.log(`[${SPORT}] ${bioByAthlete.size} rostered players with bios (${seenTeamIds.size} teams seen)`);
  }

  // ---- 4) Resolve a position bucket per athlete ----
  // Priority: roster position -> a position seen in any summary -> stat inference.
  const aggByAthlete = new Map<number, EspnGenBoxRow>();
  const latestTeamByAthlete = new Map<number, { date: string; abbr: string; externalId: number | null }>();
  for (const r of boxRows) {
    const agg = aggByAthlete.get(r.athleteId);
    if (!agg) {
      aggByAthlete.set(r.athleteId, { ...r, stats: { ...r.stats } });
    } else {
      for (const [k, v] of Object.entries(r.stats)) agg.stats[k] = (agg.stats[k] ?? 0) + v;
      if (!agg.posAbbr && r.posAbbr) agg.posAbbr = r.posAbbr;
    }
    const latest = latestTeamByAthlete.get(r.athleteId);
    if (!latest || r.gameDate > latest.date) {
      latestTeamByAthlete.set(r.athleteId, { date: r.gameDate, abbr: r.teamAbbr, externalId: r.teamExternalId });
    }
  }
  const bucketByAthlete = new Map<number, string>();
  for (const [id, agg] of aggByAthlete) {
    const bucket =
      cfg.toPosBucket(bioByAthlete.get(id)?.position) ??
      cfg.toPosBucket(agg.posAbbr) ??
      cfg.inferPosBucket(agg);
    if (bucket) bucketByAthlete.set(id, bucket);
  }
  const keptRows = boxRows.filter((r) => bucketByAthlete.has(r.athleteId));
  console.log(`[${SPORT}] ${bucketByAthlete.size} bucketed players, ${keptRows.length} stat lines kept`);

  // ---- 5) Players (slug dedup; slug set on create only) ----
  const athleteIds = [...bucketByAthlete.keys()];
  const nameById = new Map<number, { firstName: string; lastName: string; jersey: string | null; posAbbr: string | null }>();
  for (const r of keptRows) {
    if (!nameById.has(r.athleteId)) {
      nameById.set(r.athleteId, { firstName: r.firstName, lastName: r.lastName, jersey: r.jersey, posAbbr: r.posAbbr });
    }
  }

  const existing = await db.player.findMany({ where: { sport: SPORT }, select: { externalId: true, slug: true } });
  const slugByAthlete = new Map<number, string>(existing.map((e) => [e.externalId, e.slug]));
  const usedSlugs = new Set<string>(existing.map((e) => e.slug));
  for (const id of [...athleteIds].sort((a, b) => a - b)) {
    if (slugByAthlete.has(id)) continue;
    const nm = nameById.get(id);
    const name = nm ? `${nm.firstName} ${nm.lastName}`.trim() : `player ${id}`;
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
        const bucket = bucketByAthlete.get(id)!;
        // The granular position: roster first, then the summary's (skip soccer's
        // formation-slot "SUB"), else the bucket letter.
        const summaryPos = nm.posAbbr && nm.posAbbr !== 'SUB' ? nm.posAbbr : null;
        // Current team: the roster the athlete appears on, else their most
        // recent box-score team (id-first, like all team resolution here).
        const rosterTeamExternal = teamExternalByAthlete.get(id);
        const latest = latestTeamByAthlete.get(id);
        const teamDbId =
          (rosterTeamExternal != null ? teamIdByExternal.get(rosterTeamExternal) : undefined) ??
          (latest ? resolveTeamId(latest.externalId, latest.abbr) : undefined);
        const data = {
          firstName: nm.firstName,
          lastName: nm.lastName,
          position: bio?.position ?? summaryPos ?? bucket,
          posBucket: bucket,
          jersey: nm.jersey ?? bio?.jersey ?? undefined,
          height: bio?.height ?? undefined,
          weight: bio?.weight ?? undefined,
          college: bio?.college ?? undefined,
          draftYear: bio?.draftYear ?? undefined,
          draftRound: bio?.draftRound ?? undefined,
          draftNumber: bio?.draftNumber ?? undefined,
          fromYear: bio?.fromYear ?? undefined,
          teamId: teamDbId ?? undefined,
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
  console.log(`[${SPORT}] upserted ${playerRows.length} players`);

  // ---- 6) Games (distinct by event id; season from the game's own date) ----
  const seasonOf = (dateIso: string): string => currentSeason(SPORT, new Date(`${dateIso}T12:00:00Z`));
  const gameByEvent = new Map<
    string,
    { sport: string; externalId: string; date: Date; season: string; homeTeamId: number; awayTeamId: number }
  >();
  for (const r of keptRows) {
    if (gameByEvent.has(r.eventId)) continue;
    const teamId = resolveTeamId(r.teamExternalId, r.teamAbbr);
    const oppId = resolveTeamId(r.opponentExternalId, r.opponentAbbr);
    if (!teamId || !oppId) continue;
    gameByEvent.set(r.eventId, {
      sport: SPORT,
      externalId: r.eventId,
      date: new Date(`${r.gameDate}T00:00:00Z`),
      season: seasonOf(r.gameDate),
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
  console.log(`[${SPORT}] games: ${gameByEvent.size} distinct, ${gamesInserted} newly inserted`);

  // ---- 7) Stat lines ----
  const statData = [];
  let skipped = 0;
  for (const r of keptRows) {
    const playerId = playerIdByExternal.get(r.athleteId);
    const gameId = gameIdByEvent.get(r.eventId);
    const teamId = resolveTeamId(r.teamExternalId, r.teamAbbr);
    const opponentTeamId = resolveTeamId(r.opponentExternalId, r.opponentAbbr);
    if (!playerId || !gameId || !teamId || !opponentTeamId) {
      skipped++;
      continue;
    }
    // r.stats maps our PlayerGameStat column names directly; counting columns are
    // integers in the schema, so round defensively.
    const cols = Object.fromEntries(
      Object.entries(r.stats).map(([k, v]) => [k, Math.round(v)]),
    );
    statData.push({
      sport: SPORT,
      playerId,
      gameId,
      teamId,
      opponentTeamId,
      isHome: r.isHome,
      season: seasonOf(r.gameDate),
      gameDate: new Date(`${r.gameDate}T00:00:00Z`),
      minutes: r.minutes,
      plusMinus: r.plusMinus,
      ...(r.started != null ? { started: r.started } : {}),
      ...cols,
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
    `[${SPORT}] stats: ${statData.length} rows ready, ${statsInserted} historical inserted, ` +
      `${recentStats.length} recent upserted` +
      (skipped ? `, ${skipped} skipped` : ''),
  );

  console.log(`\n[${SPORT}] done:`);
  console.table({
    teams: teamRows.length,
    players: playerRows.length,
    gamesDistinct: gameByEvent.size,
    gamesInserted,
    statsInserted,
  });
}

const jobName = isSport(process.argv[2]) ? process.argv[2] : 'espn-ingest';
recordIngestRun(jobName, main)
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
