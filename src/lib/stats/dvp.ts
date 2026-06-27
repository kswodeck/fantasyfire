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

/** A–F matchup grade (plus NR = not rated, for low-sample cells). */
export type MatchupGrade = 'A' | 'B' | 'C' | 'D' | 'F' | 'NR';

/**
 * Grade a DvP cell A–F by how SOFT the matchup is. rank 1 = allows the most
 * (softest), so a high "softness percentile" earns an A. NR when the cell is
 * low-sample — we don't grade noise.
 */
export function matchupGrade(cell: DvpCell): MatchupGrade {
  if (cell.lowSample || cell.totalRanked <= 1) return 'NR';
  const softness = (cell.totalRanked - cell.rank + 1) / cell.totalRanked; // 1 = softest
  if (softness >= 0.8) return 'A';
  if (softness >= 0.6) return 'B';
  if (softness >= 0.4) return 'C';
  if (softness >= 0.2) return 'D';
  return 'F';
}

/** Clamp bounds for the opponent (DvP) adjustment — matchup effects are small. */
export const DVP_MULTIPLIER_BOUNDS = { min: 0.9, max: 1.1 } as const;

/**
 * Opponent projection multiplier derived from a cell's RANK (softness), centered at
 * 1.0: the softest matchup (rank 1, allows the most) earns the max boost, the toughest
 * the max cut, the middle 1.0. Uses only the cell — no league-average lookup — and
 * returns 1 (neutral) for low-sample/unranked cells. Bounded by DVP_MULTIPLIER_BOUNDS.
 */
export function opponentMultiplierFromCell(cell: DvpCell): number {
  if (cell.lowSample || cell.totalRanked <= 1) return 1;
  // Map rank → [0,1] so rank 1 (softest) = 1, the toughest = 0, the median = 0.5.
  const softness = (cell.totalRanked - cell.rank) / (cell.totalRanked - 1);
  const span = DVP_MULTIPLIER_BOUNDS.max - 1;
  return 1 + (softness - 0.5) * 2 * span;
}

/**
 * A gentle, clamped multiplier (±10%) from how much this opponent allows vs the
 * league average for the bucket+stat. Forced to 1.0 (no effect) on low-sample
 * cells. Descriptive nudge only — never let matchup swing an estimate far.
 */
export function opponentMultiplier(cell: DvpCell, leagueAvgAllowed: number): number {
  if (cell.lowSample || leagueAvgAllowed <= 0) return 1;
  const raw = cell.avgAllowed / leagueAvgAllowed;
  return Math.min(DVP_MULTIPLIER_BOUNDS.max, Math.max(DVP_MULTIPLIER_BOUNDS.min, raw));
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
