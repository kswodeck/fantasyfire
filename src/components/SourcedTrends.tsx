'use client';

import type { Sport } from '@/lib/sports';
import type { TrendRow } from '@/lib/types';
import { FilterableTrends } from './FilterableTrends';
import { SourceSelector } from './SourceSelector';
import { BoardPayoutControls } from './BoardPayoutControls';
import { useBoardPayoutFilter } from './useBoardPayoutFilter';
import { useSourced } from './useSourced';

/**
 * Trends with a book-source dropdown. Each source's trends are pre-computed on the
 * server (vs that book's real lines) and passed in, so switching is instant and the
 * page stays static/ISR. Only books that produced trends are offered (thin books
 * auto-hidden). The payout filter narrows by variant kind — a trend row is kept when
 * its book offers a rung of a selected kind (the trend itself is computed against the
 * representative line). `key={source}` resets the inner filters on switch.
 */
export function SourcedTrends({
  sport,
  bySource,
  sources,
  defaultSource,
}: {
  sport: Sport;
  bySource: Record<string, TrendRow[]>;
  sources: string[];
  defaultSource: string;
}) {
  const { source, setSource, liveSources, rows } = useSourced(bySource, sources, defaultSource);
  const payout = useBoardPayoutFilter(rows);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Form swings vs the book&rsquo;s real line
        </h2>
        <SourceSelector sources={liveSources} value={source} onChange={setSource} />
      </div>
      {(payout.kindOptions.length >= 2 || payout.hasMult) && (
        <div className="mb-3">
          <BoardPayoutControls filter={payout} />
        </div>
      )}
      {payout.rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No trends for this book right now.
        </p>
      ) : (
        <FilterableTrends key={source} sport={sport} rows={payout.rows} source={source} />
      )}
    </div>
  );
}
