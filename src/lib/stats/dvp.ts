// Defense vs. Position (DvP) — PLAN §5b.
//
// For each (opponentTeam, posBucket, stat): the average stat value allowed to
// players of that bucket. Teams are ranked within a bucket: rank 1 = allows the
// MOST (softest matchup / best for the over). Positions are coarse on purpose
// (3 buckets) for denser samples — surface sampleSize and don't over-claim.
import { type GameStatLine, type PosBucket, type StatKey, statValue } from './types';

/** Below this many player-games, treat a DvP cell as low-confidence. */
export const DVP_LOW_SAMPLE = 10;

export interface DvpInputRow {
  opponentTeamId: number;
  posBucket: PosBucket | null;
  game: GameStatLine;
}

export interface DvpCell {
  opponentTeamId: number;
  posBucket: PosBucket;
  stat: StatKey;
  avgAllowed: number;
  sampleSize: number;
  /** 1 = allows the most (softest). Competition ranking (ties share a rank). */
  rank: number;
  /** Number of teams ranked within this bucket. */
  totalRanked: number;
  lowSample: boolean;
}

export function isLowSample(n: number): boolean {
  return n < DVP_LOW_SAMPLE;
}

/** Pre-aggregated allowed-average for one team within a bucket. */
export interface DvpAggregate {
  opponentTeamId: number;
  avgAllowed: number;
  sampleSize: number;
}

/**
 * Rank pre-aggregated team averages within a single bucket+stat.
 * rank 1 = allows the most. Competition ranking (equal averages share a rank).
 * Use this when the averages are computed elsewhere (e.g. a SQL GROUP BY).
 */
export function rankDvp(
  aggregates: DvpAggregate[],
  posBucket: PosBucket,
  stat: StatKey,
): DvpCell[] {
  const ranked = [...aggregates].sort(
    (a, b) => b.avgAllowed - a.avgAllowed || a.opponentTeamId - b.opponentTeamId,
  );
  const totalRanked = ranked.length;
  const cells: DvpCell[] = [];
  let prevAvg: number | null = null;
  let prevRank = 0;
  ranked.forEach((r, i) => {
    const rank = prevAvg !== null && r.avgAllowed === prevAvg ? prevRank : i + 1;
    prevAvg = r.avgAllowed;
    prevRank = rank;
    cells.push({
      opponentTeamId: r.opponentTeamId,
      posBucket,
      stat,
      avgAllowed: r.avgAllowed,
      sampleSize: r.sampleSize,
      rank,
      totalRanked,
      lowSample: isLowSample(r.sampleSize),
    });
  });
  return cells;
}

/**
 * Compute DvP cells for one stat across all teams/buckets present in the rows.
 * Rows with a null posBucket are ignored (can't be bucketed).
 */
export function computeDvp(rows: DvpInputRow[], stat: StatKey): DvpCell[] {
  // Accumulate sum + count per (bucket, team).
  type Acc = { sum: number; count: number };
  const byBucket = new Map<PosBucket, Map<number, Acc>>();

  for (const row of rows) {
    if (!row.posBucket) continue;
    let teams = byBucket.get(row.posBucket);
    if (!teams) {
      teams = new Map();
      byBucket.set(row.posBucket, teams);
    }
    const acc = teams.get(row.opponentTeamId) ?? { sum: 0, count: 0 };
    acc.sum += statValue(stat, row.game);
    acc.count += 1;
    teams.set(row.opponentTeamId, acc);
  }

  const cells: DvpCell[] = [];
  for (const [bucket, teams] of byBucket) {
    const aggregates: DvpAggregate[] = [...teams.entries()].map(([opponentTeamId, acc]) => ({
      opponentTeamId,
      avgAllowed: acc.sum / acc.count,
      sampleSize: acc.count,
    }));
    cells.push(...rankDvp(aggregates, bucket, stat));
  }

  return cells;
}

/** Look up a single team's DvP cell for a bucket+stat. */
export function dvpLookup(
  cells: DvpCell[],
  opponentTeamId: number,
  posBucket: PosBucket,
  stat: StatKey,
): DvpCell | undefined {
  return cells.find(
    (c) =>
      c.opponentTeamId === opponentTeamId &&
      c.posBucket === posBucket &&
      c.stat === stat,
  );
}
