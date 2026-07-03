'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Sport } from '@/lib/sports';
import type { BoardRow, TonightGame } from '@/lib/types';
import { FilterableBoard } from './FilterableBoard';
import { SourceSelector } from './SourceSelector';
import { BoardPayoutControls } from './BoardPayoutControls';
import { useBoardPayoutFilter } from './useBoardPayoutFilter';
import { MatchupStrip } from './MatchupStrip';
import { useSourced } from './useSourced';
import { bestVariantScore } from '@/lib/payoutVariant';
import { FIREFACTOR_TIER_CUTOFFS } from '@/lib/stats';
import { useSelectedSlate } from './SelectedSlateProvider';
import { SlateSwitch } from './SlateSwitch';
import { formatIsoDate } from '@/lib/format';

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
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  // The matchups picker starts collapsed — the full slate is a long list on phones.
  const [chooseOpen, setChooseOpen] = useState(false);

  // Local clock, set after mount (null on the server + first render so SSR and
  // hydration agree — nothing counts as "started" until the client takes over).
  // Ticks each minute so a game drops out of the default scope as it begins.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // A game has started once its first pitch / tip-off / kickoff is in the past.
  const startedIds = useMemo(
    () =>
      new Set(
        now == null
          ? []
          : games
              .filter((g) => g.startTime && Date.parse(g.startTime) <= now)
              .map((g) => g.externalId),
      ),
    [games, now],
  );
  const upcomingGames = games.filter((g) => !startedIds.has(g.externalId));

  const gameTeams = (g: TonightGame) =>
    [g.home.abbr, g.away.abbr].filter((a): a is string => !!a);
  // Teams in scope: the explicitly selected matchups, or — by default — only the games
  // that haven't started yet. Started games are excluded until the user taps them in.
  const scopeGames = selectedGames.size
    ? games.filter((g) => selectedGames.has(g.externalId))
    : upcomingGames;
  const activeTeams = new Set(scopeGames.flatMap(gameTeams));
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

  const toggleGame = (id: string) =>
    setSelectedGames((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

        {effectiveMode === 'today' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setChooseOpen((o) => !o)}
              aria-expanded={chooseOpen}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
            >
              {selectedGames.size > 0 ? `Games (${selectedGames.size} of ${games.length})` : 'Choose games'}
              <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className={`transition-transform ${chooseOpen ? 'rotate-180' : ''}`}>
                <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
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
        )}

        {/* The game picker expands directly under its row, above the line band. */}
        {effectiveMode === 'today' && chooseOpen && (
          <div>
            {slateDate && (
              <p className="mb-1.5 text-xs text-muted">
                {games.length} {games.length === 1 ? 'game' : 'games'} · {formatIsoDate(slateDate)}
              </p>
            )}
            <MatchupStrip
              sport={sport}
              games={games}
              selected={selectedGames}
              startedIds={startedIds}
              onToggle={toggleGame}
            />
            <p className="mt-1.5 text-[11px] text-muted">
              {startedIds.size > 0
                ? 'Games already underway are dimmed and hidden by default — tap one to include its players.'
                : 'Tap a game to filter the reads to that matchup.'}
            </p>
          </div>
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
