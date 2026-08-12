// Pure freshness rules for the ingest audit trail (src/lib/server/status.ts, which
// reads the IngestRun table and powers /status + /api/v1/status). Side-effect free
// and DB-free so it's unit-testable — same split as providedSync.ts.

/** A daily job is "stale" if its last successful run is older than this. */
export const STALE_AFTER_MS = 30 * 60 * 60 * 1000; // 30h = daily cadence + margin

/** Jobs where a successful run that wrote ZERO rows still means "no fresh data".
 *  Provided lines runs every 15 minutes against live books, so a 0 there is a
 *  drought, not a quiet cadence. Sport pulls are deliberately excluded — an empty
 *  slate legitimately writes 0 rows, and the off-season gate already covers those. */
export const ZERO_ROWS_IS_STALE = new Set<string>(['providedlines']);

/**
 * Is a job's latest run stale — i.e. does it fail to represent fresh data?
 *
 * Three ways: it failed, it is older than the cadence, or it "succeeded" while
 * writing nothing. That last one is the case this page kept missing. A provided-lines
 * run that fetched no lines from any book recorded success with rowsWritten 0, every
 * 15 minutes, showing green while the site quietly served its own median lines
 * instead of any book's number. A job whose entire purpose is to write rows on every
 * run has not done its job when it writes none.
 */
export function runIsStale(
  job: string,
  run: { status: string; startedAt: Date; rowsWritten: number | null },
  now: Date,
): boolean {
  if (run.status !== 'success') return true;
  if (ZERO_ROWS_IS_STALE.has(job) && run.rowsWritten === 0) return true;
  return now.getTime() - run.startedAt.getTime() > STALE_AFTER_MS;
}
