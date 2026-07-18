import Link from 'next/link';
import type { Sport } from '@/lib/sports';
import type { RecapRow, YesterdayRecap } from '@/lib/types';
import { formatIsoDate } from '@/lib/format';
import { leanTextClass } from '@/lib/tierStyle';
import { SportTag } from './SportTag';

/** One settled-lean row list — shared by the board strip and the accuracy page. */
export function RecapRowList({
  sport,
  rows,
  showSport = false,
}: {
  sport: Sport;
  rows: RecapRow[];
  showSport?: boolean;
}) {
  return (
    <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <li key={`${r.player.slug}:${r.stat}`} className="flex items-center gap-2 text-xs">
          <span
            aria-label={r.result === 'hit' ? 'landed' : r.result === 'push' ? 'push' : 'missed'}
            className={`w-4 shrink-0 text-center font-bold ${
              r.result === 'hit'
                ? 'text-over'
                : r.result === 'push'
                  ? 'text-muted'
                  : 'text-under'
            }`}
          >
            {r.result === 'hit' ? '✓' : r.result === 'push' ? '–' : '✗'}
          </span>
          {showSport && <SportTag sport={sport} />}
          <Link
            prefetch={false}
            href={`/${sport}/${r.player.slug}?stat=${r.stat}&line=${r.line}`}
            className="min-w-0 truncate font-medium hover:text-brand"
          >
            {r.player.fullName}
          </Link>
          <span className="min-w-0 shrink-0 text-muted">
            <span className={leanTextClass(r.side)}>{r.side === 'over' ? 'O' : 'U'}</span>{' '}
            <span className="tabular-nums">{r.line}</span> {r.statShort}
          </span>
          <span className="ml-auto shrink-0 tabular-nums text-muted">got {r.actual}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Yesterday's leans, settled" — the daily honesty loop. Server-rendered,
 * presentational only (data from getYesterdayRecap). Every number is a settled
 * fact from the box score, framed descriptively: this is what the recent-form
 * read said pre-game and what actually happened — never a track-record or
 * win-rate claim. The full multi-day ledger lives at /[sport]/accuracy.
 */
export function YesterdayRecapStrip({
  sport,
  recap,
  showSport = false,
}: {
  sport: Sport;
  recap: YesterdayRecap;
  showSport?: boolean;
}) {
  const settled = recap.hits + recap.misses;
  if (settled === 0) return null;
  return (
    <section
      aria-label="Yesterday's leans, settled"
      className="mt-6 rounded-xl border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">
          Yesterday&rsquo;s leans, settled
          <span className="ml-2 text-xs font-normal text-muted">
            {formatIsoDate(recap.date)}
          </span>
        </h2>
        <span className="text-sm font-semibold tabular-nums">
          {recap.hits} of {settled} landed
          {recap.pushes > 0 && (
            <span className="font-normal text-muted"> · {recap.pushes} push</span>
          )}
        </span>
      </div>
      <div className="mt-3">
        <RecapRowList sport={sport} rows={recap.rows} showSport={showSport} />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Settled facts, not a track record: each row is the strongest pre-game recent-form
        read (recomputed from the game logs before that slate, at our half-point line,
        without matchup/Vegas context) checked against the actual box score. Descriptive
        only — never a prediction or betting advice.{' '}
        <Link href={`/${sport}/accuracy`} className="text-brand hover:text-brand-strong">
          Full settled ledger →
        </Link>
      </p>
    </section>
  );
}
