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
  type StatKey,
  type GameStatLine,
} from '../lib/stats';
import { median, roundToHalfLine } from '../lib/format';

const BOARD_STATS: Record<'nba' | 'mlb', StatKey[]> = {
  nba: ['pts', 'reb', 'ast', 'pra', 'fg3m'],
  mlb: ['hits', 'tb', 'hr', 'rbi', 'runs'],
};
const MIN_PRIOR = 12; // games needed before a prediction
const MAX_GAMES_PER_PLAYER = 40; // grade only the most recent N transitions
const TOP_PLAYERS = 80;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function opportunity(sport: 'nba' | 'mlb', posBucket: string | null, g: GameStatLine): number | null {
  if (sport === 'nba') return g.minutes ?? null;
  if (posBucket === 'P') return null;
  return (g.atBats ?? 0) + (g.walks ?? 0) + (g.hbp ?? 0);
}

function defaultLine(games: GameStatLine[], stat: StatKey): number {
  if (games.length === 0) return 0.5;
  return roundToHalfLine(median(games.map((g) => statValue(stat, g))));
}

type Wrapped = { g: GameStatLine; date: Date };

async function backtestSport(sport: 'nba' | 'mlb'): Promise<number> {
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
    select: {
      playerId: true,
      gameDate: true,
      minutes: true,
      points: true,
      rebounds: true,
      assists: true,
      fg3m: true,
      atBats: true,
      walks: true,
      hbp: true,
      hits: true,
      totalBases: true,
      homeRuns: true,
      rbi: true,
      runs: true,
    },
  });

  const byPlayer = new Map<number, Wrapped[]>();
  for (const r of rows) {
    const g: GameStatLine = {
      minutes: r.minutes,
      points: r.points,
      rebounds: r.rebounds,
      assists: r.assists,
      fg3m: r.fg3m,
      atBats: r.atBats,
      walks: r.walks,
      hbp: r.hbp,
      hits: r.hits,
      totalBases: r.totalBases,
      homeRuns: r.homeRuns,
      rbi: r.rbi,
      runs: r.runs,
    };
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
    for (const stat of BOARD_STATS[sport]) {
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
  await backtestSport('nba');
  await backtestSport('mlb');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
