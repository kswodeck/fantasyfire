'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Sport } from '@/lib/sports';
import type { TonightGame } from '@/lib/types';
import { MatchupStrip } from './MatchupStrip';
import { formatIsoDate } from '@/lib/format';

/**
 * Shared "Choose games" slate filter — the collapsed picker button plus the
 * expandable matchups strip used by the Heat Check board and the Trends page.
 *
 * The hook owns the selection and the live "has this game started?" clock;
 * the component renders the controls. Scope rule: explicitly selected games
 * win; otherwise every game that hasn't started yet is in scope.
 */
export function useGameFilter(games: TonightGame[]) {
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

  const toggleGame = (id: string) =>
    setSelectedGames((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearGames = () => setSelectedGames(new Set());

  return {
    selectedGames,
    toggleGame,
    clearGames,
    chooseOpen,
    setChooseOpen,
    startedIds,
    upcomingGames,
    activeTeams,
  };
}

export type GameFilter = ReturnType<typeof useGameFilter>;

export function GamePicker({
  sport,
  games,
  slateDate,
  filter,
}: {
  sport: Sport;
  games: TonightGame[];
  slateDate: string | null;
  filter: GameFilter;
}) {
  const { selectedGames, toggleGame, clearGames, chooseOpen, setChooseOpen, startedIds } =
    filter;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setChooseOpen((o) => !o)}
          aria-expanded={chooseOpen}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
        >
          {selectedGames.size > 0
            ? `Games (${selectedGames.size} of ${games.length})`
            : 'Choose games'}
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            aria-hidden="true"
            className={`transition-transform ${chooseOpen ? 'rotate-180' : ''}`}
          >
            <path
              d="M3 4.5 6 7.5 9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {selectedGames.size > 0 && (
          <button
            type="button"
            onClick={clearGames}
            className="cursor-pointer text-xs font-medium text-brand hover:text-brand-strong"
          >
            Clear ({selectedGames.size})
          </button>
        )}
      </div>

      {/* The game picker expands directly under its row. */}
      {chooseOpen && (
        <div>
          {slateDate && (
            <p className="mb-1.5 text-xs text-muted">
              {games.length} {games.length === 1 ? 'game' : 'games'} ·{' '}
              {formatIsoDate(slateDate)}
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
    </>
  );
}
