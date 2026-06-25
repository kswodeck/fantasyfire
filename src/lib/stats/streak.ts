// Current over/under streak for a stat vs a line. Pure (no React/Next/db).
//
// `values` are the player's per-game stat values, MOST-RECENT-FIRST (the order
// the DB returns games). A push (value exactly on the line) is transparent — it
// neither extends nor breaks the run — mirroring how the hit rate excludes
// pushes, so an integer line doesn't artificially snap every streak.

export interface StreakResult {
  /** Side of the current run, or null when there are no decided games. */
  side: 'over' | 'under' | null;
  /** Consecutive most-recent decided games on `side`. */
  length: number;
  /** The streak's values, most-recent-first (for display). */
  values: number[];
}

export function computeStreak(values: number[], line: number): StreakResult {
  let side: 'over' | 'under' | null = null;
  let length = 0;
  const streak: number[] = [];
  for (const v of values) {
    if (v === line) continue; // push — transparent
    const s: 'over' | 'under' = v > line ? 'over' : 'under';
    if (side === null) {
      side = s;
      length = 1;
      streak.push(v);
    } else if (s === side) {
      length += 1;
      streak.push(v);
    } else {
      break;
    }
  }
  return { side, length, values: streak };
}
