'use client';

import { useState } from 'react';
import type { Sport } from '@/lib/sports';
import type { BoardRow, TonightGame } from '@/lib/types';
import { FilterableBoard } from './FilterableBoard';
import { SourceSelector } from './SourceSelector';
import { MatchupStrip } from './MatchupStrip';
import { useSourced } from './useSourced';
import { useSelectedSlate } from './SelectedSlateProvider';
import { formatIsoDate } from '@/lib/format';

/**
 * The unified Top Leans board. A "today's slate" toggle (default on when there are
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
  const rows = hasSources ? sourced.rows : medianRows;

  const hasSlate = games.length > 0;
  const { mode, setMode } = useSelectedSlate();
  // No slate on this page → always show all players, whatever the saved choice was.
  const effectiveMode = hasSlate ? mode : 'all';
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());

  const gameTeams = (g: TonightGame) =>
    [g.home.abbr, g.away.abbr].filter((a): a is string => !!a);
  // Teams in scope: the selected matchups, or the whole slate when none are picked.
  const activeTeams = new Set(
    (selectedGames.size ? games.filter((g) => selectedGames.has(g.externalId)) : games).flatMap(
      gameTeams,
    ),
  );
  const filteredRows =
    effectiveMode === 'all'
      ? rows
      : rows.filter(
          (r) => r.player.teamAbbreviation && activeTeams.has(r.player.teamAbbreviation),
        );

  const toggleGame = (id: string) =>
    setSelectedGames((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleBtn = (m: 'today' | 'all', text: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      className={
        'cursor-pointer rounded-md px-3 py-1.5 transition-colors sm:py-1 ' +
        (mode === m ? 'bg-brand text-brand-foreground' : 'text-muted hover:text-foreground')
      }
    >
      {text}
    </button>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {hasSlate ? (
          <div className="inline-flex items-center rounded-lg border border-line bg-surface p-0.5 text-xs font-semibold">
            {toggleBtn('today', slateWord)}
            {toggleBtn('all', 'All players')}
          </div>
        ) : (
          <span />
        )}
        {hasSources && (
          <SourceSelector
            sources={sourced.liveSources}
            value={sourced.source}
            onChange={sourced.setSource}
          />
        )}
      </div>

      {effectiveMode === 'today' && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Matchups
              {slateDate && (
                <span className="ml-2 font-normal normal-case text-muted">
                  {formatIsoDate(slateDate)}
                </span>
              )}
            </h2>
            {selectedGames.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedGames(new Set())}
                className="cursor-pointer text-xs font-medium text-brand hover:text-brand-strong"
              >
                Clear ({selectedGames.size})
              </button>
            )}
          </div>
          <MatchupStrip sport={sport} games={games} selected={selectedGames} onToggle={toggleGame} />
          <p className="mt-1.5 text-[11px] text-muted">
            Tap a game to filter the leans to that matchup.
          </p>
        </div>
      )}

      {filteredRows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          {effectiveMode === 'today'
            ? 'No leans for this selection right now.'
            : 'No props for this book right now.'}
        </p>
      ) : (
        <FilterableBoard
          key={`${sourced.source}-${effectiveMode}`}
          sport={sport}
          rows={filteredRows}
          initialVisible={20}
        />
      )}
    </div>
  );
}
