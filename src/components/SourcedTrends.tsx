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
import { useSelectedSlate } from './SelectedSlateProvider';
import { SlateSwitch } from './SlateSwitch';

/**
 * Trends with a book-source dropdown. Each source's trends are pre-computed on the
 * server (vs that book's real lines) and passed in, so switching is instant and the
 * page stays static/ISR. Only books that produced trends are offered (thin books
 * auto-hidden). The site-synced "Today only" switch narrows the swings to players
 * with a game on the current slate. The payout filter narrows by variant kind — a
 * trend row is kept when its book offers a rung of a selected kind (the trend itself
 * is computed against the representative line). `key={source}` resets the inner
 * filters on switch.
 */
export function SourcedTrends({
  sport,
  bySource,
  sources,
  defaultSource,
  todayTeams = [],
  slateWord = 'Today',
}: {
  sport: Sport;
  bySource: Record<string, TrendRow[]>;
  sources: string[];
  defaultSource: string;
  /** Teams playing on the current slate — [] hides the "Today only" switch. */
  todayTeams?: string[];
  /** "Today" for daily sports, "This week" for NFL. */
  slateWord?: string;
}) {
  const { source, setSource, liveSources, rows } = useSourced(bySource, sources, defaultSource);

  // "Today only" (site-synced, default on) — no slate data → always all players.
  const hasSlate = todayTeams.length > 0;
  const { mode, setMode } = useSelectedSlate();
  const effectiveMode = hasSlate ? mode : 'all';
  const teamSet = useMemo(() => new Set(todayTeams), [todayTeams]);
  const slateRows =
    effectiveMode === 'all'
      ? rows
      : rows.filter(
          (r) => r.player.teamAbbreviation != null && teamSet.has(r.player.teamAbbreviation),
        );

  const payout = useBoardPayoutFilter(slateRows);
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {hasSlate ? (
          <SlateSwitch
            on={mode === 'today'}
            onChange={(on) => setMode(on ? 'today' : 'all')}
            label={`${slateWord} only`}
          />
        ) : (
          <span />
        )}
        <SourceSelector sources={liveSources} value={source} onChange={setSource} />
      </div>
      {(payout.kindOptions.length >= 2 || payout.hasMult) && (
        <div className="mb-3">
          <BoardPayoutControls filter={payout} />
        </div>
      )}
      {ranked.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          {effectiveMode === 'today'
            ? 'No trends on the current slate for this book — switch off the slate filter for every player.'
            : 'No trends for this book right now.'}
        </p>
      ) : (
        <FilterableTrends
          key={`${source}-${effectiveMode}`}
          sport={sport}
          rows={ranked}
          source={source}
          initialLines={payout.initialLines}
        />
      )}
    </div>
  );
}
