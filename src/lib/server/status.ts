// Ingest health + data-freshness, read from the IngestRun audit table and the data
// tables. Powers /status and /api/v1/status. Server-only (touches the DB).
import 'server-only';
import { db } from '@/lib/db';
import { SPORT_LIST, type Sport } from '@/lib/sports';

/** Jobs we expect to run nightly, in pipeline order. */
export const KNOWN_JOBS = ['nba', 'mlb', 'nfl', 'nhl', 'wnba', 'mls', 'schedule', 'indexnow'] as const;
export type JobName = (typeof KNOWN_JOBS)[number];

/** A daily job is "stale" if its last successful run is older than this. */
export const STALE_AFTER_MS = 30 * 60 * 60 * 1000; // 30h = daily cadence + margin

export interface JobStatus {
  job: JobName;
  lastStatus: 'success' | 'failure' | null;
  /** ISO timestamp of the last run's start, or null if it has never run. */
  lastRunAt: string | null;
  durationMs: number | null;
  rowsWritten: number | null;
  error: string | null;
  /** Last successful run missing or older than the cadence. */
  stale: boolean;
}

export interface SportFreshness {
  sport: Sport;
  /** ISO date (YYYY-MM-DD) of the most recent completed game in the DB. */
  lastGameDate: string | null;
  /** Total player-game stat rows for the sport. */
  statRows: number;
  /** Scheduled games today or later (the upcoming slate). */
  upcomingGames: number;
}

export interface IngestStatus {
  generatedAt: string;
  jobs: JobStatus[];
  sports: SportFreshness[];
  /** True when every data-pull job ran successfully within the cadence. */
  healthy: boolean;
}

function startOfTodayUtc(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function getIngestStatus(now: Date = new Date()): Promise<IngestStatus> {
  // Latest run per job from a single recent slice (cheap; indexed by job+startedAt).
  const recent = await db.ingestRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 200,
    select: {
      job: true,
      status: true,
      startedAt: true,
      durationMs: true,
      rowsWritten: true,
      error: true,
    },
  });
  const latestByJob = new Map<string, (typeof recent)[number]>();
  for (const r of recent) if (!latestByJob.has(r.job)) latestByJob.set(r.job, r);

  const jobs: JobStatus[] = KNOWN_JOBS.map((job) => {
    const r = latestByJob.get(job);
    if (!r) {
      return {
        job,
        lastStatus: null,
        lastRunAt: null,
        durationMs: null,
        rowsWritten: null,
        error: null,
        stale: true,
      };
    }
    const stale =
      r.status !== 'success' || now.getTime() - r.startedAt.getTime() > STALE_AFTER_MS;
    return {
      job,
      lastStatus: r.status === 'success' ? 'success' : 'failure',
      lastRunAt: r.startedAt.toISOString(),
      durationMs: r.durationMs,
      rowsWritten: r.rowsWritten,
      error: r.error,
      stale,
    };
  });

  const todayUtc = startOfTodayUtc(now);
  const sports: SportFreshness[] = await Promise.all(
    SPORT_LIST.map(async (sport) => {
      const [agg, upcoming] = await Promise.all([
        db.playerGameStat.aggregate({ where: { sport }, _max: { gameDate: true }, _count: true }),
        db.scheduledGame.count({ where: { sport, date: { gte: todayUtc } } }),
      ]);
      return {
        sport,
        lastGameDate: agg._max.gameDate ? agg._max.gameDate.toISOString().slice(0, 10) : null,
        statRows: agg._count,
        upcomingGames: upcoming,
      };
    }),
  );

  // "Healthy" tracks the data-pull jobs — schedule/indexnow are best-effort and
  // shouldn't flip the top-line indicator red.
  const pulls: JobName[] = ['nba', 'mlb', 'nfl', 'nhl', 'wnba', 'mls'];
  const healthy = jobs.filter((j) => pulls.includes(j.job)).every((j) => !j.stale);

  return { generatedAt: now.toISOString(), jobs, sports, healthy };
}
