// src/ingest/run-prune.ts
//
// Nightly retention prune — delete rows no read-path needs so the DB stays lean.
// Wired as the final step of ingest.yml (daily) and recorded as an IngestRun
// (job='prune') for audit. Windows + safety come from the retention audit:
//
//   • ProvidedLine — gameDate older than PROVIDED_LINE_KEEP_DAYS (30d). The cron
//     writes ~1,400 rows per slate-day keyed by gameDate and never revisits old
//     days, so they pile up (~250k/season). Reads use a 3d (board/streaks/trends)
//     or 14d (player page) window, so a 30d floor never drops a row in use.
//   • IngestRun — startedAt older than INGEST_RUN_KEEP_DAYS (90d). /status reads
//     only the 200 newest rows; 90d is a wide audit margin.
//
// NOT pruned (see audit): PlayerGameStat/Game (core history; unfiltered + season-wide
// reads, and an off-season serves the PREVIOUS season; plus FK stats→game), and
// ScheduledGame (already pruned at 3d in run-schedule.ts), and PushSubscription
// (re-read after long content lulls; dead endpoints removed at send time).
//
//   pnpm prune          # uses .env (DATABASE_URL)
//   pnpm prune:prod     # uses .env.prod.local
import 'dotenv/config';
import { db } from '../lib/db';
import { recordIngestRun } from './ingestRun';
import { prunePlan } from './prune';

async function main(): Promise<number> {
  const { providedLineBefore, ingestRunBefore } = prunePlan(new Date());

  const provided = await db.providedLine.deleteMany({ where: { gameDate: { lt: providedLineBefore } } });
  console.log(
    `[prune] ProvidedLine: deleted ${provided.count} (gameDate < ${providedLineBefore.toISOString().slice(0, 10)})`,
  );

  const runs = await db.ingestRun.deleteMany({ where: { startedAt: { lt: ingestRunBefore } } });
  console.log(
    `[prune] IngestRun: deleted ${runs.count} (startedAt < ${ingestRunBefore.toISOString().slice(0, 10)})`,
  );

  return provided.count + runs.count;
}

recordIngestRun('prune', main)
  .catch((e) => {
    console.error('[prune] error:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
