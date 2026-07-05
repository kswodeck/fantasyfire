'use client';

import { useMemo } from 'react';
import type { Sport } from '@/lib/sports';
import type { TonightGame, TrendRow } from '@/lib/types';
import { FilterableTrends } from './FilterableTrends';
import { displayedTrend } from './TrendBoardTable';
import { SourceSelector } from './SourceSelector';
import { BoardPayoutControls } from './BoardPayoutControls';
import { useBoardPayoutFilter } from './useBoardPayoutFilter';
import { GamePicker, useGameFilter } from './GamePicker';
import { useSourced } from './useSourced';
import { useSelectedSlate } from './SelectedSlateProvider';
import { SlateSwitch } from './SlateSwitch';

/**
 * Trends with a book-source dropdown. Each source's trends are pre-computed on the
 * server (vs that book's real lines) and passed in, so switching is instant and the
 * page stays static/ISR. Only books that produced trends are offered (thin books
 * auto-hidden). The site-synced "Today only" switch narrows the swings to players
 * with a game on the current slate, and the same "Choose games" picker as the Heat
 * Check narrows further to specific matchups (started games drop out by default).
 * The payout filter narrows by variant kind — a trend row is kept when its book
 * offers a rung of a selected kind (the trend itself is computed against the
 * representative line). `key={source}` resets the inner filters on switch.
 */
export function SourcedTrends({
  sport,
  bySource,
  sources,
  defaultSource,
  games = [],
  slateDate = null,
  slateWord = 'Today',
}: {
  sport: Sport;
  bySource: Record<string, TrendRow[]>;
  sources: string[];
  defaultSource: string;
  /** Games on the current slate — [] hides the "Today only" switch and picker. */
  games?: TonightGame[];
  slateDate?: string | null;
  /** "Today" for daily sports, "This week" for NFL. */
  slateWord?: string;
}) {
  const { source, setSource, liveSources, rows } = useSourced(bySource, sources, defaultSource);

  // "Today only" (site-synced, default on) — no slate data → always all players.
  const hasSlate = games.length > 0;
  const { mode, setMode } = useSelectedSlate();
  const effectiveMode = hasSlate ? mode : 'all';
  const gameFilter = useGameFilter(games);
  const { selectedGames, upcomingGames, activeTeams } = gameFilter;
  const slateRows =
    effectiveMode === 'all'
      ? rows
      : rows.filter(
          (r) => r.player.teamAbbreviation != null && activeTeams.has(r.player.teamAbbreviation),
        );
  // Distinguish "everything today has already started" from a genuinely empty book.
  const allStarted =
    effectiveMode === 'today' && selectedGames.size === 0 && upcomingGames.length === 0;

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
      <div className="mb-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
        {effectiveMode === 'today' && (
          <GamePicker sport={sport} games={games} slateDate={slateDate} filter={gameFilter} />
        )}
        {(payout.kindOptions.length >= 2 || payout.hasMult) && (
          <BoardPayoutControls filter={payout} />
        )}
      </div>
      {ranked.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          {allStarted
            ? 'Every game today has already started. Use Choose games above to include one, or switch off the slate filter for all players.'
            : effectiveMode === 'today'
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
