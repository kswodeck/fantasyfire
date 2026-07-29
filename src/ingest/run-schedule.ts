// src/ingest/run-schedule.ts
//
// Pulls today's + tomorrow's free schedule into ScheduledGame (for the "tonight"
// slate). MLB via statsapi.mlb.com (team ids), NBA via ESPN scoreboard
// (abbreviations). Best-effort per sport — a fetch failure for one sport/date is
// logged and skipped, never fatal.
//
//   pnpm schedule
import 'dotenv/config';
import { db } from '../lib/db';
import { recordIngestRun } from './ingestRun';
import { fetchMlbSchedule, fetchNbaSchedule, fetchNflSchedule, fetchEspnSchedule, type ScheduleGameRow } from './schedule';
import { ESPN_SPORT_PATH } from './espnSports';
import { fetchEspnGameOdds, type GameOddsRow } from './gameOdds';
import { shouldIngest, offSeasonReason } from '../lib/seasonWindow';
import type { Sport } from '../lib/sports';

/** The next `days` calendar days as YYYY-MM-DD in US Eastern (the betting day). */
function slateDates(days = 2): string[] {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => fmt.format(new Date(now + i * 86_400_000)));
}

async function ingestSport(
  sport: Sport,
  fetcher: (date: string) => Promise<ScheduleGameRow[]>,
  resolveTeam: (key: string) => number | undefined,
  dates: string[],
): Promise<void> {
  if (!shouldIngest(sport)) {
    console.log(`[schedule:${sport}] ${offSeasonReason(sport)}`);
    return;
  }
  const rows: ScheduleGameRow[] = [];
  for (const date of dates) {
    try {
      rows.push(...(await fetcher(date)));
    } catch (err) {
      console.warn(`[schedule:${sport}] ${date} fetch failed: ${(err as Error).message}`);
    }
  }

  let upserted = 0;
  let skipped = 0;
  for (const r of rows) {
    const homeTeamId = resolveTeam(r.homeKey);
    const awayTeamId = resolveTeam(r.awayKey);
    if (!homeTeamId || !awayTeamId) {
      skipped++;
      continue;
    }
    const date = new Date(`${r.dateIso}T00:00:00Z`);
    const startTime = r.startTimeIso ? new Date(r.startTimeIso) : null;
    const common = {
      date,
      startTime: startTime && !Number.isNaN(startTime.getTime()) ? startTime : null,
      season: r.dateIso.slice(0, 4),
      homeTeamId,
      awayTeamId,
      status: r.status,
      homeProbablePitcher: r.homeProbablePitcher ?? null,
      awayProbablePitcher: r.awayProbablePitcher ?? null,
    };
    await db.scheduledGame.upsert({
      where: { sport_externalId: { sport, externalId: r.externalId } },
      create: { sport, externalId: r.externalId, ...common },
      update: common,
    });
    upserted++;
  }
  console.log(
    `[schedule:${sport}] ${rows.length} games fetched, ${upserted} upserted` +
      (skipped ? `, ${skipped} skipped (unmapped team)` : ''),
  );
}

async function main() {
  const selectTeams = (sport: Sport) =>
    db.team.findMany({ where: { sport }, select: { id: true, externalId: true, abbreviation: true } });
  const [mlbTeams, nbaTeams, nflTeams, nhlTeams, wnbaTeams, mlsTeams, cfbTeams, cbbTeams] = await Promise.all([
    selectTeams('mlb'),
    selectTeams('nba'),
    selectTeams('nfl'),
    selectTeams('nhl'),
    selectTeams('wnba'),
    selectTeams('mls'),
    selectTeams('cfb'),
    selectTeams('cbb'),
  ]);
  type TeamRow = { id: number; externalId: number; abbreviation: string };
  const byAbbr = (rows: TeamRow[]) => new Map(rows.map((t) => [t.abbreviation, t.id]));
  const byExternalId = (rows: TeamRow[]) => new Map(rows.map((t) => [String(t.externalId), t.id]));
  const mlbByExternalId = byExternalId(mlbTeams);
  const mlbByAbbr = byAbbr(mlbTeams);
  const nbaByAbbr = byAbbr(nbaTeams);
  const nflByAbbr = byAbbr(nflTeams);
  // The ESPN-native sports resolve by ESPN team id (=== our Team.externalId) with
  // an abbreviation fallback — scoreboard abbreviations can differ from /teams'
  // (e.g. NHL Utah: UTAH in /teams, UTA on the scoreboard).
  const espnResolver = (rows: TeamRow[]) => {
    const ids = byExternalId(rows);
    const abbrs = byAbbr(rows);
    return (k: string) => ids.get(k) ?? abbrs.get(k);
  };
  const nhlResolve = espnResolver(nhlTeams);
  const wnbaResolve = espnResolver(wnbaTeams);
  const mlsResolve = espnResolver(mlsTeams);
  const cfbResolve = espnResolver(cfbTeams);
  const cbbResolve = espnResolver(cbbTeams);

  const daily = slateDates(2);
  // Weekly-cadence sports (NFL Thu–Mon, soccer matchweeks) pull the next 8 days
  // so the whole week is present.
  const weekly = slateDates(8);
  await ingestSport('mlb', fetchMlbSchedule, (k) => mlbByExternalId.get(k), daily);
  await ingestSport('nba', fetchNbaSchedule, (k) => nbaByAbbr.get(k), daily);
  await ingestSport('nfl', fetchNflSchedule, (k) => nflByAbbr.get(k), weekly);
  await ingestSport('nhl', (d) => fetchEspnSchedule(ESPN_SPORT_PATH.nhl!, d), nhlResolve, daily);
  await ingestSport('wnba', (d) => fetchEspnSchedule(ESPN_SPORT_PATH.wnba!, d), wnbaResolve, daily);
  await ingestSport('mls', (d) => fetchEspnSchedule(ESPN_SPORT_PATH.mls!, d), mlsResolve, weekly);
  // College scoreboards default to a featured subset — pass the groups filter.
  await ingestSport('cfb', (d) => fetchEspnSchedule(ESPN_SPORT_PATH.cfb!, d, undefined, '&groups=80&limit=300'), cfbResolve, weekly);
  await ingestSport('cbb', (d) => fetchEspnSchedule(ESPN_SPORT_PATH.cbb!, d, undefined, '&groups=50&limit=400'), cbbResolve, daily);

  // Vegas odds (idea #4) from the ESPN scoreboard — for every sport, matched back to
  // the schedule rows above by team + date. Best-effort: games without odds stay null.
  await ingestGameOdds('mlb', (k) => mlbByAbbr.get(k), daily);
  await ingestGameOdds('nba', (k) => nbaByAbbr.get(k), daily);
  await ingestGameOdds('nfl', (k) => nflByAbbr.get(k), weekly);
  await ingestGameOdds('nhl', nhlResolve, daily);
  await ingestGameOdds('wnba', wnbaResolve, daily);
  await ingestGameOdds('mls', mlsResolve, weekly);
  await ingestGameOdds('cfb', cfbResolve, weekly);
  await ingestGameOdds('cbb', cbbResolve, daily);

  // Prune games older than 3 days so the table stays small.
  const cutoff = new Date(Date.now() - 3 * 86_400_000);
  const pruned = await db.scheduledGame.deleteMany({ where: { date: { lt: cutoff } } });
  if (pruned.count) console.log(`[schedule] pruned ${pruned.count} stale games`);
}

/** Attach ESPN game odds to the matching ScheduledGame rows (by team + a ±1-day
 *  window, to absorb the UTC/ET date offset). One team plays at most once/day.
 *  `resolveTeam` gets the ESPN team id first (when the row carries one), then
 *  the abbreviation — same id-first strategy as the schedule above. */
async function ingestGameOdds(
  sport: Sport,
  resolveTeam: (key: string) => number | undefined,
  dates: string[],
): Promise<void> {
  if (!shouldIngest(sport)) return; // the schedule pull already logged the skip
  let fetched = 0;
  let updated = 0;
  for (const date of dates) {
    let rows: GameOddsRow[] = [];
    try {
      rows = await fetchEspnGameOdds(sport, date);
    } catch (err) {
      console.warn(`[odds:${sport}] ${date} fetch failed: ${(err as Error).message}`);
      continue;
    }
    fetched += rows.length;
    for (const r of rows) {
      const homeTeamId = (r.homeId ? resolveTeam(r.homeId) : undefined) ?? resolveTeam(r.homeAbbr);
      const awayTeamId = (r.awayId ? resolveTeam(r.awayId) : undefined) ?? resolveTeam(r.awayAbbr);
      if (!homeTeamId || !awayTeamId) continue;
      // Exact slate-day match (same key the schedule stored), so series games on
      // consecutive days each get their OWN odds.
      const res = await db.scheduledGame.updateMany({
        where: {
          sport,
          homeTeamId,
          awayTeamId,
          date: new Date(`${r.dateIso}T00:00:00Z`),
        },
        data: {
          oddsProvider: r.oddsProvider,
          gameTotal: r.gameTotal,
          homeSpread: r.homeSpread,
          homeFavorite: r.homeFavorite,
        },
      });
      updated += res.count;
    }
  }
  console.log(`[odds:${sport}] ${fetched} odds fetched, ${updated} games updated`);
}

recordIngestRun('schedule', main)
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
