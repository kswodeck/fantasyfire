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
  // Keep rows where SOME line (shown or any scored rung) reaches at least a faint
  // read — chance-floored single digits are "almost certainly not" territory and
  // would flood the board with noise. This is also what makes a book "live": pass it
  // to useSourced so a book whose every row is below the bar is never offered or
  // auto-selected (it would render an empty board under its own name).
  const readable = (r: BoardRow) =>
    bestVariantScore(r.fireScore.score, r.variants) >= FIREFACTOR_TIER_CUTOFFS.none;
  const sourced = useSourced(boardsBySource, sources, defaultSource, readable);
  const hasSources = sourced.liveSources.length > 0;
  // No book has a readable row (a scrape gap, or a board of pure Passes) — fall back
  // to the median-line board rather than an empty page, and say so below. Covers "no
  // books at ALL" too: a row never says whose number it is, so without the caption the
  // vanishing selector is the only hint that the board switched to our own lines.
  const rows = (hasSources ? sourced.rows : medianRows).filter(readable);
  const usingMedian = !hasSources && rows.length > 0;

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

      {/* State the substitution rather than passing our own line off as a book's. */}
      {usingMedian && (
        <p className="mb-3 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-muted">
          No book has lines for {sport.toUpperCase()} right now, so these reads are priced
          against <strong className="text-foreground">our own median line</strong> instead
          of a book&rsquo;s number.
        </p>
      )}

      {filteredRows.length === 0 ? (
        <p role="status" className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          {allStarted
            ? 'Every game today has already started. Use Choose games above to include one, or switch off the slate filter for all players.'
            : effectiveMode === 'today'
              ? 'No reads for this selection right now.'
              : 'No reads on the board right now — every line we have is too close to a coin flip to call. New lines land as the books post them.'}
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
