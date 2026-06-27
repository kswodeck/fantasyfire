// One IngestRun audit row per nightly job — the data behind the /status freshness
// page. Wrap a script's main() so success/failure + duration are recorded without
// touching the job's internals. Recording is best-effort: a failed insert is logged
// but never masks the job's own result, and the original error is rethrown so each
// script's existing exit-code handling still fires.
import { db } from '../lib/db';
import { withDbRetry } from './dbRetry';

type RunStatus = 'success' | 'failure';

async function record(
  job: string,
  startedAt: Date,
  status: RunStatus,
  rowsWritten: number | null,
  error: string | null,
): Promise<void> {
  try {
    const finishedAt = new Date();
    await withDbRetry(
      () =>
        db.ingestRun.create({
          data: {
            job,
            status,
            rowsWritten,
            error: error ? error.slice(0, 500) : null,
            startedAt,
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
          },
        }),
      `ingestRun.create(${job})`,
    );
  } catch (e) {
    console.warn(`[ingestRun] failed to record "${job}" run:`, e instanceof Error ? e.message : e);
  }
}

/**
 * Run a job's main() and write its IngestRun audit row. If main() resolves to a
 * number, it's stored as rowsWritten. Rethrows on failure.
 */
export async function recordIngestRun(
  job: string,
  run: () => Promise<number | void>,
): Promise<void> {
  const startedAt = new Date();
  try {
    const result = await run();
    await record(job, startedAt, 'success', typeof result === 'number' ? result : null, null);
  } catch (e) {
    await record(job, startedAt, 'failure', null, e instanceof Error ? e.message : String(e));
    throw e;
  }
}
