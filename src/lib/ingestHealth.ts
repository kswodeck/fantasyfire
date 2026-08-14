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

/** Best-effort jobs that nonetheless flip the top-line health indicator once they
 *  have actually run. The book lines ARE the product on every board — the site
 *  silently degrades to its own median line without them — so an outage there is
 *  not the "inert until configured" case the optional bucket was built for. */
export const HEALTH_CRITICAL_OPTIONAL = new Set<string>(['providedlines']);

/**
 * Does this job's staleness flip the top-line health indicator?
 *
 * Sport pulls count while their own sport is in season — a paused off-season
 * workflow is the calendar, not a fault.
 *
 * Optional jobs were all excluded, on the reasoning that each is inert until its
 * env and secrets are configured. That holds for social/push/metrics/prune, but it
 * let the provided-lines pipeline sit dead for 8 days behind a green banner: a run
 * stuck on the environment gate blocked ~135 later runs, no book lines were
 * written, and every board quietly fell back to our own median numbers. A job only
 * reaches this function once it has run at least once, which is exactly the
 * evidence that it IS configured — so from that point on, its silence is a fault
 * worth showing. Gated on some sport being in season, for the same reason the
 * sport pulls are: books post nothing when nothing is playing.
 */
export function affectsHealthBanner(
  job: string,
  ctx: { isSportPull: boolean; sportInSeason: boolean; anySportInSeason: boolean },
): boolean {
  if (ctx.isSportPull) return ctx.sportInSeason;
  if (HEALTH_CRITICAL_OPTIONAL.has(job)) return ctx.anySportInSeason;
  return false;
}
