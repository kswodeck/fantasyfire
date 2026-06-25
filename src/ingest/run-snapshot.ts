// src/ingest/run-snapshot.ts
//
// Nightly: freeze today's FireScore "lean" for the most active players, keyed to
// today's date. run-grade.ts later grades each against the player's next game.
// Together with the one-time run-backtest.ts seed, this grows the /accuracy
// calibration forward.
//
//   pnpm snapshot
import 'dotenv/config';
import { db } from '../lib/db';
import {
  computeHitRate,
  recentFormEstimate,
  computeConsistency,
  computeFireScore,
  blendedRoleThreshold,
  STAT_WINDOWS,
  defaultLine,
  type GameStatLine,
} from '../lib/stats';
import { BOARD_STATS, MIN_PRIOR, STAT_SELECT, rowToGameStatLine, opportunity, chunk } from './snapshot-lib';

async function snapshotSport(sport: 'nba' | 'mlb'): Promise<number> {
  const players = await db.player.findMany({
    where: { sport },
    select: { id: true, posBucket: true },
    orderBy: { gameStats: { _count: 'desc' } },
    take: 150,
  });
  if (players.length === 0) return 0;

  const rows = await db.playerGameStat.findMany({
    where: { playerId: { in: players.map((p) => p.id) } },
    orderBy: { gameDate: 'desc' }, // most-recent-first
    select: STAT_SELECT,
  });
  const byPlayer = new Map<number, GameStatLine[]>();
  for (const r of rows) {
    const g = rowToGameStatLine(r);
    const list = byPlayer.get(r.playerId);
    if (list) list.push(g);
    else byPlayer.set(r.playerId, [g]);
  }

  const snapshotDate = new Date();
  snapshotDate.setUTCHours(0, 0, 0, 0);

  const snapshots = [];
  for (const p of players) {
    const all = byPlayer.get(p.id) ?? [];
    const factor = sport === 'nba' ? 1 : 0.6;
    const cutoff = factor * blendedRoleThreshold(all.map((g) => opportunity(sport, p.posBucket, g)));
    const games = all.filter((g) => {
      const o = opportunity(sport, p.posBucket, g);
      if (o == null) return true;
      return o > 0 && o >= cutoff;
    });
    if (games.length < MIN_PRIOR) continue;

    for (const stat of BOARD_STATS[sport]) {
      const line = defaultLine(games, stat);
      if (line <= 0.5) continue;
      const windows = STAT_WINDOWS.map((w) => {
        const hr = computeHitRate(games, stat, line, w);
        return { window: String(w), overs: hr.overs, decided: hr.decided };
      });
      const season = computeHitRate(games, stat, line, 'season');
      const proj = recentFormEstimate(season.values, season.mean);
      const cons = computeConsistency(season.values, season.mean, season.stdev, line);
      const fs = computeFireScore({
        line,
        windows,
        projection: proj.stabilized,
        stdev: season.stdev,
        cv: cons.cv,
        gamesPlayed: games.length,
      });
      if (fs.tier === 'Pass') continue;
      snapshots.push({
        sport,
        playerId: p.id,
        stat,
        line,
        snapshotDate,
        predictedSide: fs.side,
        overHitRate: season.hitRateOver,
        wilsonLower: null,
        fireScore: fs.score,
        fireTier: fs.tier,
        graded: false,
      });
    }
  }

  let written = 0;
  for (const part of chunk(snapshots, 1000)) {
    const res = await db.projectionSnapshot.createMany({ data: part, skipDuplicates: true });
    written += res.count;
  }
  console.log(`[snapshot:${sport}] ${snapshots.length} leans, ${written} new`);
  return written;
}

async function main() {
  await snapshotSport('nba');
  await snapshotSport('mlb');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
