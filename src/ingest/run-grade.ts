// src/ingest/run-grade.ts
//
// Nightly: grade any ungraded ProjectionSnapshot whose target game has now been
// played (the player's first game AFTER the snapshot date). Sets the actual value
// and outcome (over/under/push vs the snapshot line). Snapshots whose player
// hasn't played yet are left for a future run.
//
//   pnpm grade
import 'dotenv/config';
import { db } from '../lib/db';
import { statValue, type StatKey } from '../lib/stats';
import { STAT_SELECT, rowToGameStatLine, chunk } from './snapshot-lib';

async function main() {
  const ungraded = await db.projectionSnapshot.findMany({
    where: { graded: false },
    select: { id: true, playerId: true, stat: true, line: true, snapshotDate: true },
  });
  if (ungraded.length === 0) {
    console.log('[grade] nothing to grade');
    return;
  }

  const playerIds = [...new Set(ungraded.map((s) => s.playerId))];
  const rows = await db.playerGameStat.findMany({
    where: { playerId: { in: playerIds } },
    orderBy: { gameDate: 'asc' },
    select: STAT_SELECT,
  });
  const byPlayer = new Map<number, { date: Date; line: ReturnType<typeof rowToGameStatLine> }[]>();
  for (const r of rows) {
    const entry = { date: r.gameDate, line: rowToGameStatLine(r) };
    const list = byPlayer.get(r.playerId);
    if (list) list.push(entry);
    else byPlayer.set(r.playerId, [entry]);
  }

  const updates: { id: number; actual: number; outcome: string; targetGameDate: Date }[] = [];
  for (const s of ungraded) {
    const games = byPlayer.get(s.playerId) ?? [];
    const next = games.find((x) => x.date > s.snapshotDate);
    if (!next) continue;
    const actual = statValue(s.stat as StatKey, next.line);
    updates.push({
      id: s.id,
      actual,
      outcome: actual > s.line ? 'over' : actual < s.line ? 'under' : 'push',
      targetGameDate: next.date,
    });
  }

  let graded = 0;
  for (const part of chunk(updates, 50)) {
    await Promise.all(
      part.map((u) =>
        db.projectionSnapshot.update({
          where: { id: u.id },
          data: {
            graded: true,
            actualValue: u.actual,
            outcome: u.outcome,
            targetGameDate: u.targetGameDate,
          },
        }),
      ),
    );
    graded += part.length;
  }
  console.log(`[grade] ${ungraded.length} pending, ${graded} graded`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
