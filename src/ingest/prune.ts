// Pure retention-window math for the nightly prune (run-prune.ts). Side-effect free
// so it's unit-testable without a DB. See the retention audit for why these windows
// are safe against every read-path.

/**
 * Keep ProvidedLine rows from the last N days (by gameDate). MUST stay well above the
 * read windows in src/lib/server/providedLines.ts (3d board/streaks/trends map, 14d
 * player research), so pruning never drops a row a surface still reads.
 */
export const PROVIDED_LINE_KEEP_DAYS = 30;

/**
 * Keep IngestRun audit rows from the last N days (by startedAt). /status reads only
 * the 200 most-recent rows (~4 days at the every-30-min cadence), so 90d is a wide
 * margin while keeping the log-only table bounded.
 */
export const INGEST_RUN_KEEP_DAYS = 90;

/** UTC-midnight cutoff `days` before `now`; rows strictly older than this are deletable. */
export function cutoff(now: Date, days: number): Date {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export interface PrunePlan {
  /** Delete ProvidedLine rows with gameDate before this. */
  providedLineBefore: Date;
  /** Delete IngestRun rows with startedAt before this. */
  ingestRunBefore: Date;
}

/** Resolve the concrete delete cutoffs for a given run time. */
export function prunePlan(now: Date): PrunePlan {
  return {
    providedLineBefore: cutoff(now, PROVIDED_LINE_KEEP_DAYS),
    ingestRunBefore: cutoff(now, INGEST_RUN_KEEP_DAYS),
  };
}
