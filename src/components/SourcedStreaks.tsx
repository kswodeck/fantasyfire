'use client';

import type { Sport } from '@/lib/sports';
import type { StreakRow } from '@/lib/types';
import { FilterableStreaks } from './FilterableStreaks';
import { SourceSelector } from './SourceSelector';
import { useSourced } from './useSourced';

/**
 * Streaks with a book-source dropdown. Each source's streaks are pre-computed on the
 * server (vs that book's real lines) and passed in, so switching is instant and the
 * page stays static/ISR. Only books that produced streaks are offered (thin books
 * auto-hidden). `key={source}` resets the inner filters on switch.
 */
export function SourcedStreaks({
  sport,
  bySource,
  sources,
  defaultSource,
}: {
  sport: Sport;
  bySource: Record<string, StreakRow[]>;
  sources: string[];
  defaultSource: string;
}) {
  const { source, setSource, liveSources, rows } = useSourced(bySource, sources, defaultSource);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Current runs vs the book&rsquo;s real line
        </h2>
        <SourceSelector sources={liveSources} value={source} onChange={setSource} />
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No streaks for this book right now.
        </p>
      ) : (
        <FilterableStreaks key={source} sport={sport} rows={rows} />
      )}
    </div>
  );
}
