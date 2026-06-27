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
import { fetchMlbSchedule, fetchNbaSchedule, fetchNflSchedule, type ScheduleGameRow } from './schedule';
import { fetchEspnGameOdds, type GameOddsRow } from './gameOdds';
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
  sport: 'mlb' | 'nba' | 'nfl',
  fetcher: (date: string) => Promise<ScheduleGameRow[]>,
  resolveTeam: (key: string) => number | undefined,
  dates: string[],
): Promise<void> {
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
  const [mlbTeams, nbaTeams, nflTeams] = await Promise.all([
    db.team.findMany({ where: { sport: 'mlb' }, select: { id: true, externalId: true, abbreviation: true } }),
    db.team.findMany({ where: { sport: 'nba' }, select: { id: true, abbreviation: true } }),
    db.team.findMany({ where: { sport: 'nfl' }, select: { id: true, abbreviation: true } }),
  ]);
  const mlbByExternalId = new Map(mlbTeams.map((t) => [String(t.externalId), t.id]));
  const mlbByAbbr = new Map(mlbTeams.map((t) => [t.abbreviation, t.id]));
  const nbaByAbbr = new Map(nbaTeams.map((t) => [t.abbreviation, t.id]));
  const nflByAbbr = new Map(nflTeams.map((t) => [t.abbreviation, t.id]));

  const daily = slateDates(2);
  await ingestSport('mlb', fetchMlbSchedule, (k) => mlbByExternalId.get(k), daily);
  await ingestSport('nba', fetchNbaSchedule, (k) => nbaByAbbr.get(k), daily);
  // NFL plays weekly (Thu–Mon) — pull the next 8 days so the full week is present.
  await ingestSport('nfl', fetchNflSchedule, (k) => nflByAbbr.get(k), slateDates(8));

  // Vegas odds (idea #4) from the ESPN scoreboard — for every sport, matched back to
  // the schedule rows above by team + date. Best-effort: games without odds stay null.
  await ingestGameOdds('mlb', mlbByAbbr, daily);
  await ingestGameOdds('nba', nbaByAbbr, daily);
  await ingestGameOdds('nfl', nflByAbbr, slateDates(8));

  // Prune games older than 3 days so the table stays small.
  const cutoff = new Date(Date.now() - 3 * 86_400_000);
  const pruned = await db.scheduledGame.deleteMany({ where: { date: { lt: cutoff } } });
  if (pruned.count) console.log(`[schedule] pruned ${pruned.count} stale games`);
}

/** Attach ESPN game odds to the matching ScheduledGame rows (by team + a ±1-day
 *  window, to absorb the UTC/ET date offset). One team plays at most once/day. */
async function ingestGameOdds(
  sport: Sport,
  teamByAbbr: Map<string, number>,
  dates: string[],
): Promise<void> {
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
      const homeTeamId = teamByAbbr.get(r.homeAbbr);
      const awayTeamId = teamByAbbr.get(r.awayAbbr);
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
