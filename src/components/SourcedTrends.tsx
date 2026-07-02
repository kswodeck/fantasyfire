'use client';

import { useMemo } from 'react';
import type { Sport } from '@/lib/sports';
import type { TrendRow } from '@/lib/types';
import { FilterableTrends } from './FilterableTrends';
import { displayedTrend } from './TrendBoardTable';
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
  // Rank by the rung each row will actually DISPLAY (a goblins-only cut re-ranks by
  // the goblin swings) and renumber, so the list always reads strictly sorted.
  const ranked = useMemo(() => {
    const d = (r: TrendRow) => displayedTrend(r, payout.initialLines);
    return [...payout.rows]
      .sort((a, b) => d(b).recentLower - d(a).recentLower || d(b).delta - d(a).delta)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [payout.rows, payout.initialLines]);
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
      {ranked.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No trends for this book right now.
        </p>
      ) : (
        <FilterableTrends
          key={source}
          sport={sport}
          rows={ranked}
          source={source}
          initialLines={payout.initialLines}
        />
      )}
    </div>
  );
}
