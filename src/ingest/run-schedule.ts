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
import { fetchMlbSchedule, fetchNbaSchedule, fetchNflSchedule, type ScheduleGameRow } from './schedule';

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
    const common = {
      date,
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
    db.team.findMany({ where: { sport: 'mlb' }, select: { id: true, externalId: true } }),
    db.team.findMany({ where: { sport: 'nba' }, select: { id: true, abbreviation: true } }),
    db.team.findMany({ where: { sport: 'nfl' }, select: { id: true, abbreviation: true } }),
  ]);
  const mlbByExternalId = new Map(mlbTeams.map((t) => [String(t.externalId), t.id]));
  const nbaByAbbr = new Map(nbaTeams.map((t) => [t.abbreviation, t.id]));
  const nflByAbbr = new Map(nflTeams.map((t) => [t.abbreviation, t.id]));

  const daily = slateDates(2);
  await ingestSport('mlb', fetchMlbSchedule, (k) => mlbByExternalId.get(k), daily);
  await ingestSport('nba', fetchNbaSchedule, (k) => nbaByAbbr.get(k), daily);
  // NFL plays weekly (Thu–Mon) — pull the next 8 days so the full week is present.
  await ingestSport('nfl', fetchNflSchedule, (k) => nflByAbbr.get(k), slateDates(8));

  // Prune games older than 3 days so the table stays small.
  const cutoff = new Date(Date.now() - 3 * 86_400_000);
  const pruned = await db.scheduledGame.deleteMany({ where: { date: { lt: cutoff } } });
  if (pruned.count) console.log(`[schedule] pruned ${pruned.count} stale games`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
