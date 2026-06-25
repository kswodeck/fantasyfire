// src/ingest/run-backtest.ts
//
// One-time walk-forward backtest that SEEDS the /accuracy calibration with real
// history: for the most active players, re-derive the FireScore "lean" as of each
// recent game using ONLY the games before it, then grade it against that game's
// actual result. Writes graded ProjectionSnapshot rows. The nightly snapshot +
// grade jobs grow the dataset forward from here.
//
//   pnpm backtest
import 'dotenv/config';
import { db } from '../lib/db';
import {
  computeHitRate,
  recentFormEstimate,
  computeConsistency,
  computeFireScore,
  blendedRoleThreshold,
  statValue,
  STAT_WINDOWS,
  defaultLine,
  type GameStatLine,
} from '../lib/stats';
import type { Sport } from '../lib/sports';
import { boardStatsForSnapshot, opportunity, STAT_SELECT, rowToGameStatLine } from './snapshot-lib';

const MIN_PRIOR = 12; // games needed before a prediction
const MAX_GAMES_PER_PLAYER = 40; // grade only the most recent N transitions
const TOP_PLAYERS = 80;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type Wrapped = { g: GameStatLine; date: Date };

async function backtestSport(sport: Sport): Promise<number> {
  const players = await db.player.findMany({
    where: { sport },
    select: { id: true, posBucket: true },
    orderBy: { gameStats: { _count: 'desc' } },
    take: TOP_PLAYERS,
  });
  if (players.length === 0) return 0;

  const rows = await db.playerGameStat.findMany({
    where: { playerId: { in: players.map((p) => p.id) } },
    orderBy: { gameDate: 'asc' }, // chronological
    select: STAT_SELECT,
  });

  const byPlayer = new Map<number, Wrapped[]>();
  for (const r of rows) {
    const g: GameStatLine = rowToGameStatLine(r);
    const w: Wrapped = { g, date: r.gameDate };
    const list = byPlayer.get(r.playerId);
    if (list) list.push(w);
    else byPlayer.set(r.playerId, [w]);
  }

  const snapshots: Array<{
    sport: string;
    playerId: number;
    stat: string;
    line: number;
    snapshotDate: Date;
    predictedSide: string;
    overHitRate: number | null;
    wilsonLower: number | null;
    fireScore: number;
    fireTier: string;
    targetGameDate: Date;
    actualValue: number;
    outcome: string;
    graded: boolean;
  }> = [];

  for (const p of players) {
    const all = byPlayer.get(p.id) ?? [];
    const factor = sport === 'nba' ? 1 : 0.6;
    const cutoff = factor * blendedRoleThreshold(all.map((w) => opportunity(sport, p.posBucket, w.g)));
    const games = all.filter((w) => {
      const o = opportunity(sport, p.posBucket, w.g);
      if (o == null) return true;
      return o > 0 && o >= cutoff;
    });
    if (games.length < MIN_PRIOR + 1) continue;

    const startT = Math.max(MIN_PRIOR, games.length - MAX_GAMES_PER_PLAYER);
    for (const stat of boardStatsForSnapshot(sport, p.posBucket)) {
      for (let t = startT; t < games.length; t++) {
        const prior = games.slice(0, t).map((w) => w.g).reverse(); // most-recent-first
        const line = defaultLine(prior, stat);
        if (line <= 0.5) continue;
        const windows = STAT_WINDOWS.map((w) => {
          const hr = computeHitRate(prior, stat, line, w);
          return { window: String(w), overs: hr.overs, decided: hr.decided };
        });
        const season = computeHitRate(prior, stat, line, 'season');
        const proj = recentFormEstimate(season.values, season.mean);
        const cons = computeConsistency(season.values, season.mean, season.stdev, line);
        const fs = computeFireScore({
          line,
          windows,
          projection: proj.stabilized,
          stdev: season.stdev,
          cv: cons.cv,
          gamesPlayed: prior.length,
        });
        if (fs.tier === 'Pass') continue; // only grade actual leans

        const target = games[t];
        const actual = statValue(stat, target.g);
        snapshots.push({
          sport,
          playerId: p.id,
          stat,
          line,
          snapshotDate: games[t - 1].date,
          predictedSide: fs.side,
          overHitRate: season.hitRateOver,
          wilsonLower: null,
          fireScore: fs.score,
          fireTier: fs.tier,
          targetGameDate: target.date,
          actualValue: actual,
          outcome: actual > line ? 'over' : actual < line ? 'under' : 'push',
          graded: true,
        });
      }
    }
  }

  let written = 0;
  for (const part of chunk(snapshots, 1000)) {
    const res = await db.projectionSnapshot.createMany({ data: part, skipDuplicates: true });
    written += res.count;
  }
  console.log(`[backtest:${sport}] ${players.length} players → ${snapshots.length} leans, ${written} written`);
  return written;
}

async function main() {
  // The seed collides on @@unique([playerId,stat,snapshotDate]) with skipDuplicates,
  // so existing rows are never overwritten. After a line/scoring change, set
  // BACKTEST_RESET=true to purge first and re-seed everything under the new logic.
  if (process.env.BACKTEST_RESET === 'true') {
    const del = await db.projectionSnapshot.deleteMany({});
    console.log(`[backtest] reset: deleted ${del.count} existing snapshot(s)`);
  }
  await backtestSport('nba');
  await backtestSport('mlb');
  await backtestSport('nfl');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
