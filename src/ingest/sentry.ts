// Sentry for the ingest jobs, which run on GitHub Actions — outside Vercel, so
// the Next.js SDK never sees them. recordIngestRun() calls reportJobFailure()
// for every job that throws, so all runners report without per-script wiring.
//
// Inert unless SENTRY_DSN is set (a repo secret passed in by the workflows), so
// local runs and tests never send anything.
import * as Sentry from '@sentry/node';
import { SENTRY_DATA_COLLECTION } from '../lib/sentryDataCollection';

let initialized: boolean | undefined;

function ensureInit(): boolean {
  if (initialized === undefined) {
    const dsn = process.env.SENTRY_DSN?.trim();
    initialized = Boolean(dsn);
    if (dsn) {
      Sentry.init({
        dsn,
        environment: process.env.SENTRY_ENVIRONMENT || 'ingest',
        tracesSampleRate: 0,
        dataCollection: SENTRY_DATA_COLLECTION,
      });
    }
  }
  return initialized;
}

/** Report a failed job and wait for delivery — the process exits right after. */
export async function reportJobFailure(job: string, error: unknown): Promise<void> {
  try {
    if (!ensureInit()) return;
    Sentry.withScope((scope) => {
      scope.setTag('job', job);
      if (process.env.GITHUB_RUN_ID) {
        scope.setContext('github', {
          workflow: process.env.GITHUB_WORKFLOW,
          runUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
        });
      }
      Sentry.captureException(error);
    });
    await Sentry.flush(5000);
  } catch (e) {
    // Never let error reporting mask the job's own failure.
    console.warn(
      '[sentry] failed to report job failure:',
      e instanceof Error ? e.message : e,
    );
  }
}
