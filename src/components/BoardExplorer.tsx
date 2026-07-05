'use client';

import type { Sport } from '@/lib/sports';
import type { BoardRow, TonightGame } from '@/lib/types';
import { FilterableBoard } from './FilterableBoard';
import { SourceSelector } from './SourceSelector';
import { BoardPayoutControls } from './BoardPayoutControls';
import { useBoardPayoutFilter } from './useBoardPayoutFilter';
import { GamePicker, useGameFilter } from './GamePicker';
import { useSourced } from './useSourced';
import { bestVariantScore } from '@/lib/payoutVariant';
import { FIREFACTOR_TIER_CUTOFFS } from '@/lib/stats';
import { useSelectedSlate } from './SelectedSlateProvider';
import { SlateSwitch } from './SlateSwitch';

/**
 * The unified Heat Check board. A "today's slate" toggle (default on when there are
 * games) shows a condensed, clickable matchups strip and filters the board to the
 * teams playing — click one or more games to narrow to those matchups (none = the
 * whole slate); toggle off for every active player. Book selection comes from the
 * shared selector (persisted across pages). Works with or without real book lines.
 */
export function BoardExplorer({
  sport,
  boardsBySource,
  sources,
  defaultSource,
  medianRows,
  games,
  slateWord,
  slateDate,
}: {
  sport: Sport;
  boardsBySource: Record<string, BoardRow[]>;
  sources: string[];
  defaultSource: string;
  /** Fallback board vs our median line when no book lines are ingested. */
  medianRows: BoardRow[];
  games: TonightGame[];
  /** "Today" for daily sports, "This week" for NFL. */
  slateWord: string;
  slateDate: string | null;
}) {
  const hasSources = sources.length > 0;
  const sourced = useSourced(boardsBySource, sources, defaultSource);
  // Keep rows where SOME line (shown or any scored rung) reaches at least a faint
  // read — chance-floored single digits are "almost certainly not" territory and
  // would flood the board with noise.
  const rows = (hasSources ? sourced.rows : medianRows).filter(
    (r) => bestVariantScore(r.fireScore.score, r.variants) >= FIREFACTOR_TIER_CUTOFFS.none,
  );

  const hasSlate = games.length > 0;
  const { mode, setMode } = useSelectedSlate();
  // No slate on this page → always show all players, whatever the saved choice was.
  const effectiveMode = hasSlate ? mode : 'all';
  const gameFilter = useGameFilter(games);
  const { selectedGames, upcomingGames, activeTeams } = gameFilter;
  const slateRows =
    effectiveMode === 'all'
      ? rows
      : rows.filter(
          (r) => r.player.teamAbbreviation && activeTeams.has(r.player.teamAbbreviation),
        );
  // Distinguish "everything today has already started" from a genuinely empty book.
  const allStarted =
    effectiveMode === 'today' && selectedGames.size === 0 && upcomingGames.length === 0;
  // Payout filter (PrizePicks types / Underdog multiplier range) over the slate rows.
  const payout = useBoardPayoutFilter(slateRows);
  const filteredRows = payout.rows;

  return (
    <div>
      {/* Controls are grouped by intent, one band each, top to bottom:
            1. SCOPE — the slate switch with the book selector on the same row,
               then the game picker directly beneath on the far left (it refines
               the slate the switch turned on);
            2. LINE SHAPE — the payout kind menu + multiplier range;
            3. LIST FILTERS — search / teams / props / leans (in FilterableBoard).
          One visual band per question keeps the stack readable on phones. */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {hasSlate && (
            <SlateSwitch
              on={mode === 'today'}
              onChange={(on) => setMode(on ? 'today' : 'all')}
              label={`${slateWord} only`}
            />
          )}
          {hasSources && (
            <span className="ml-auto">
              <SourceSelector
                sources={sourced.liveSources}
                value={sourced.source}
                onChange={sourced.setSource}
              />
            </span>
          )}
        </div>

        {/* The picker's button row and expanding panel sit above the line band. */}
        {effectiveMode === 'today' && (
          <GamePicker sport={sport} games={games} slateDate={slateDate} filter={gameFilter} />
        )}

        {hasSources && (payout.kindOptions.length >= 2 || payout.hasMult) && (
          <BoardPayoutControls filter={payout} />
        )}
      </div>

      {filteredRows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          {allStarted
            ? 'Every game today has already started. Use Choose games above to include one, or switch off the slate filter for all players.'
            : effectiveMode === 'today'
              ? 'No reads for this selection right now.'
              : 'No props for this book right now.'}
        </p>
      ) : (
        <FilterableBoard
          key={`${sourced.source}-${effectiveMode}`}
          sport={sport}
          rows={filteredRows}
          source={hasSources ? sourced.source : undefined}
          initialLines={payout.initialLines}
          initialVisible={20}
        />
      )}
    </div>
  );
}
