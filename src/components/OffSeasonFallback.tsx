import Link from 'next/link';
import { getLeaders } from '@/lib/server/players';
import { FilterableLeaders } from './FilterableLeaders';
import { STAT_DEFS, type StatKey } from '@/lib/stats';
import { SPORTS, type Sport } from '@/lib/sports';
import type { LeaderRow } from '@/lib/types';

// The marquee stat to lead the off-season leaderboard with, per sport.
const MARQUEE: Record<Sport, StatKey> = {
  nba: 'pts',
  mlb: 'hits',
  nfl: 'passYds',
  nhl: 'pts',
  wnba: 'pts',
  mls: 'goals',
  cfb: 'passYds',
  cbb: 'pts',
};

/**
 * Off-season fallback for the prop/matchup pages (Heat Check, Trends).
 * Their lists describe upcoming or in-progress games, so with an empty schedule
 * they'd be stale. Instead we tell the user there are no games scheduled and show
 * the season's per-game leaders — which stay meaningful year-round — with a link
 * to the full leaders page. Async server component; only fetches when rendered.
 */
export async function OffSeasonFallback({ sport, what }: { sport: Sport; what: string }) {
  const cfg = SPORTS[sport];
  const stat = MARQUEE[sport];
  const label = STAT_DEFS[stat].label;
  const short = STAT_DEFS[stat].short;

  let rows: LeaderRow[] = [];
  try {
    rows = await getLeaders(sport, stat, 50);
  } catch {
    // DB unavailable — the message still renders on its own.
  }

  return (
    <div className="mt-6">
      <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
        No {cfg.name} games are scheduled right now (likely the off-season), so {what}{' '}
        aren&rsquo;t available. Here are the season&rsquo;s {cfg.name} leaders instead, or
        browse{' '}
        <Link href={`/${sport}/players`} className="text-brand hover:text-brand-strong">
          all {cfg.name} players
        </Link>
        .
      </p>

      {rows.length > 0 && (
        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {cfg.name} {label} leaders — this season
            </h2>
            <Link
              href={`/${sport}/leaders/${stat}`}
              className="shrink-0 text-xs font-medium text-brand hover:text-brand-strong"
            >
              All leaders →
            </Link>
          </div>
          <FilterableLeaders sport={sport} rows={rows} unit={short} />
        </div>
      )}
    </div>
  );
}
