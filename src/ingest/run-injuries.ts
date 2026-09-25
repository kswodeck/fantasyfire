// src/ingest/run-injuries.ts
//
// Pulls the public ESPN injuries feed for each sport into PlayerInjury (idea #5),
// matching athletes to our players by normalized name. The sport's statuses are
// replaced wholesale each run, so a player who's been removed from the feed (i.e.
// recovered) has their row cleared. Best-effort: a fetch failure for one sport is
// logged and skipped, never fatal.
//
//   pnpm tsx src/ingest/run-injuries.ts
import 'dotenv/config';
import { db } from '../lib/db';
import { recordIngestRun } from './ingestRun';
import { withDbRetry } from './dbRetry';
import { normalizeName } from '../lib/slate';
import { fetchEspnInjuries, type InjuryRow } from './injuries';
import { shouldIngest, offSeasonReason } from '../lib/seasonWindow';
import { SPORT_LIST, type Sport } from '../lib/sports';

const SPORTS: Sport[] = SPORT_LIST;

async function ingestSport(sport: Sport): Promise<number> {
  // Off-season: don't fetch at all. Still clear this sport's rows (a no-op after
  // the first skipped run) so last season's injuries don't linger all summer.
  if (!shouldIngest(sport)) {
    await withDbRetry(
      () => db.playerInjury.deleteMany({ where: { sport } }),
      `injuries clear ${sport} (off-season)`,
    );
    console.log(`[injuries:${sport}] ${offSeasonReason(sport)}`);
    return 0;
  }

  let rows: InjuryRow[] = [];
  try {
    rows = await fetchEspnInjuries(sport);
  } catch (err) {
    console.warn(`[injuries:${sport}] fetch failed: ${(err as Error).message}`);
    return 0;
  }

  // Empty feed (out-of-season sport, or simply no injuries): nothing can match, so
  // skip the expensive full-roster scan — the dominant egress cost of this job, run
  // every 15 min against every sport including the huge off-season college rosters.
  // Still clear this sport's stored rows so recovered/off-season injuries don't
  // linger; final DB state is identical to the full path (createMany never fires
  // when there are no matches anyway).
  if (rows.length === 0) {
    await withDbRetry(
      () => db.playerInjury.deleteMany({ where: { sport } }),
      `injuries clear ${sport} (empty feed)`,
    );
    console.log(`[injuries:${sport}] empty feed — cleared stored injuries, skipped roster scan`);
    return 0;
  }

  const players = await withDbRetry(
    () =>
      db.player.findMany({
        where: { sport },
        select: { id: true, firstName: true, lastName: true },
      }),
    `injuries roster ${sport}`,
  );
  // Normalized name -> playerId. Duplicate names map to null so we never guess which
  // player a name refers to (better to drop than mis-attribute an injury).
  const byName = new Map<string, number | null>();
  for (const p of players) {
    const key = normalizeName(`${p.firstName} ${p.lastName}`);
    byName.set(key, byName.has(key) ? null : p.id);
  }

  const seen = new Set<number>();
  const records = [] as {
    sport: string;
    playerId: number;
    status: string;
    rawStatus: string;
    fantasyStatus: string | null;
    detail: string | null;
    returnDate: Date | null;
    comment: string | null;
    news: string | null;
    reportedAt: Date | null;
  }[];
  for (const r of rows) {
    const pid = byName.get(normalizeName(r.externalName));
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    const returnDate = r.returnDate ? new Date(r.returnDate) : null;
    records.push({
      sport,
      playerId: pid,
      status: r.status,
      rawStatus: r.rawStatus,
      fantasyStatus: r.fantasyStatus,
      detail: r.detail,
      returnDate: returnDate && !Number.isNaN(returnDate.getTime()) ? returnDate : null,
      comment: r.comment,
      news: r.news,
      reportedAt: r.reportedAt ? new Date(r.reportedAt) : null,
    });
  }

  // Replace this sport's statuses wholesale so recovered players clear.
  await withDbRetry(
    () =>
      db.$transaction([
        db.playerInjury.deleteMany({ where: { sport } }),
        ...(records.length ? [db.playerInjury.createMany({ data: records })] : []),
      ]),
    `injuries write ${sport}`,
  );
  console.log(`[injuries:${sport}] ${rows.length} feed rows, ${records.length} matched + stored`);
  return records.length;
}

async function main(): Promise<number> {
  let total = 0;
  const failed = new Map<Sport, string>();
  for (const s of SPORTS) {
    // The header promises best-effort per sport, but only the FETCH was ever
    // guarded — a DB call threw straight out of the loop and failed the whole run.
    // This job shares a cadence (~35x/day) with the provided-lines scrape and runs
    // immediately after its heavy write phase, so it meets the pooler at its
    // busiest; a single connect blip was taking the entire workflow red even though
    // every sport's feed had been fetched fine. Retried above, and isolated here.
    try {
      total += await ingestSport(s);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failed.set(s, msg);
      console.warn(`[injuries:${s}] failed: ${msg}`);
    }
  }
  // Every sport failing is not a blip — that is an outage (bad credentials, the
  // pooler refusing every connection) and must stay loud, the same way the
  // provided-lines drought check refuses to report a dead pipeline as green.
  if (failed.size === SPORTS.length) {
    throw new Error(
      `Injuries: all ${SPORTS.length} sports failed — ` +
        [...failed].map(([s, m]) => `${s} (${m})`).join('; '),
    );
  }
  if (failed.size) {
    console.warn(
      `[injuries] ${failed.size} of ${SPORTS.length} sports failed this run ` +
        `(${[...failed.keys()].join(', ')}); the rest were stored. Stored statuses for a ` +
        'failed sport keep their previous values rather than being cleared.',
    );
  }
  return total;
}

recordIngestRun('injuries', main)
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
