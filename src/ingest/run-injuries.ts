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
import { normalizeName } from '../lib/slate';
import { fetchEspnInjuries, type InjuryRow } from './injuries';
import type { Sport } from '../lib/sports';

const SPORTS: Sport[] = ['nba', 'mlb', 'nfl'];

async function ingestSport(sport: Sport): Promise<number> {
  let rows: InjuryRow[] = [];
  try {
    rows = await fetchEspnInjuries(sport);
  } catch (err) {
    console.warn(`[injuries:${sport}] fetch failed: ${(err as Error).message}`);
    return 0;
  }

  const players = await db.player.findMany({
    where: { sport },
    select: { id: true, firstName: true, lastName: true },
  });
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
    detail: string | null;
    comment: string | null;
    reportedAt: Date | null;
  }[];
  for (const r of rows) {
    const pid = byName.get(normalizeName(r.externalName));
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    records.push({
      sport,
      playerId: pid,
      status: r.status,
      rawStatus: r.rawStatus,
      detail: r.detail,
      comment: r.comment,
      reportedAt: r.reportedAt ? new Date(r.reportedAt) : null,
    });
  }

  // Replace this sport's statuses wholesale so recovered players clear.
  await db.$transaction([
    db.playerInjury.deleteMany({ where: { sport } }),
    ...(records.length ? [db.playerInjury.createMany({ data: records })] : []),
  ]);
  console.log(`[injuries:${sport}] ${rows.length} feed rows, ${records.length} matched + stored`);
  return records.length;
}

async function main(): Promise<number> {
  let total = 0;
  for (const s of SPORTS) total += await ingestSport(s);
  return total;
}

recordIngestRun('injuries', main)
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
