import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getIngestStatus, type IngestStatus, type JobName } from '@/lib/server/status';
import { SPORTS } from '@/lib/sports';
import { formatIsoDate } from '@/lib/format';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Status',
  description:
    'Live data-freshness and nightly-ingest health for FantasyFire — tracks availability and how current the game logs are, not betting outcomes.',
  alternates: { canonical: '/status' },
  // Operational page that changes constantly — keep it out of the index.
  robots: { index: false, follow: true },
};

const JOB_LABELS: Record<JobName, string> = {
  nba: 'NBA ingest',
  mlb: 'MLB ingest',
  nfl: 'NFL ingest',
  schedule: 'Schedule pull',
  indexnow: 'IndexNow ping',
};

function relTime(fromIso: string | null, nowIso: string): string {
  if (!fromIso) return 'never';
  const ms = new Date(nowIso).getTime() - new Date(fromIso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function duration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s - m * 60)}s`;
}

const DOT: Record<'ok' | 'warn' | 'bad', string> = {
  ok: 'bg-over',
  warn: 'bg-conf-med',
  bad: 'bg-under',
};

export default async function StatusPage() {
  let status: IngestStatus | null = null;
  try {
    status = await getIngestStatus();
  } catch {
    status = null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs className="mb-4" items={[{ label: 'Home', href: '/' }, { label: 'Status' }]} />
      <h1 className="text-3xl font-bold tracking-tight">Status</h1>

      {status === null ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          Status is temporarily unavailable.
        </p>
      ) : (
        <>
          <div
            className={
              'mt-4 flex items-center gap-3 rounded-xl border p-4 ' +
              (status.healthy
                ? 'border-line bg-over-soft'
                : 'border-line bg-surface-warn')
            }
          >
            <span
              className={`h-3 w-3 shrink-0 rounded-full ${status.healthy ? DOT.ok : DOT.warn}`}
              aria-hidden="true"
            />
            <p className="text-sm font-medium">
              {status.healthy
                ? 'All nightly data pulls ran successfully and the game logs are current.'
                : 'One or more data pulls are stale or failed — the numbers below may be behind.'}
            </p>
          </div>

          <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted">
            Data freshness by sport
          </h2>
          <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-semibold">Sport</th>
                  <th className="px-3 py-2 font-semibold">Latest game</th>
                  <th className="px-3 py-2 text-right font-semibold">Stat rows</th>
                  <th className="px-3 py-2 text-right font-semibold">Upcoming</th>
                </tr>
              </thead>
              <tbody>
                {status.sports.map((s) => (
                  <tr key={s.sport} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 font-medium">{SPORTS[s.sport].name}</td>
                    <td className="px-3 py-2 text-muted">
                      {s.lastGameDate ? formatIsoDate(s.lastGameDate) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">
                      {s.statRows.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">
                      {s.upcomingGames}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted">
            Nightly jobs
          </h2>
          <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-semibold">Job</th>
                  <th className="px-3 py-2 font-semibold">Last run</th>
                  <th className="px-3 py-2 text-right font-semibold">Duration</th>
                  <th className="px-3 py-2 text-right font-semibold">Rows</th>
                </tr>
              </thead>
              <tbody>
                {status.jobs.map((j) => {
                  const tone: 'ok' | 'warn' | 'bad' =
                    j.lastStatus === null
                      ? 'warn'
                      : j.lastStatus === 'failure'
                        ? 'bad'
                        : j.stale
                          ? 'warn'
                          : 'ok';
                  return (
                    <tr key={j.job} className="border-b border-line last:border-0 align-top">
                      <td className="px-3 py-2 font-medium">
                        <span className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`}
                            aria-hidden="true"
                          />
                          {JOB_LABELS[j.job]}
                        </span>
                        {j.error && (
                          <span className="mt-1 block max-w-md truncate text-xs text-under" title={j.error}>
                            {j.error}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {relTime(j.lastRunAt, status!.generatedAt)}
                        {j.lastStatus === 'failure' && (
                          <span className="ml-1 font-medium text-under">(failed)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">
                        {duration(j.durationMs)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">
                        {j.rowsWritten == null ? '—' : j.rowsWritten.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted">
            Jobs run once daily (~10:00 UTC) after the prior night&rsquo;s games settle; a job is
            flagged if its last successful run is more than 30 hours old. In a sport&rsquo;s
            off-season its pull is a harmless no-op. This page tracks{' '}
            <strong>data availability and freshness</strong>, not betting outcomes. Machine-readable
            version at <Link href="/api/v1/status" className="text-brand hover:text-brand-strong">/api/v1/status</Link>.
          </p>
        </>
      )}
    </div>
  );
}
