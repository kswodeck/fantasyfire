'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import type { Sport } from '@/lib/sports';
import type { TonightGame } from '@/lib/types';
import { MatchupStrip } from './MatchupStrip';
import {
  dayTargetIds,
  formatDayLabel,
  formatDayRange,
  groupGamesByDay,
  localDayIso,
  toggleIds,
} from '@/lib/gameDays';

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
  // A day heading selects (or clears) that day's games in one tap — see toggleIds.
  const toggleGames = (ids: readonly string[]) =>
    setSelectedGames((prev) => toggleIds(prev, ids));
  const clearGames = () => setSelectedGames(new Set());

  return {
    selectedGames,
    toggleGame,
    toggleGames,
    clearGames,
    chooseOpen,
    setChooseOpen,
    startedIds,
    upcomingGames,
    activeTeams,
    /** The client clock (null until hydrated) — shared so day labels tick with it. */
    now,
  };
}

/**
 * The slate grouped by day. Until the browser has hydrated (`now` null) each game
 * sits on the date the server gave it — the Eastern calendar date for a timed game —
 * so the server and first client render agree. After that it moves to the viewer's
 * own date, matching the local start time printed on its chip; for anyone in the US
 * the two are the same day. `todayIso` likewise waits for the client clock.
 */
function useGameDays(games: TonightGame[], now: number | null) {
  return useMemo(() => {
    const dayOf = (g: TonightGame) =>
      (now != null && g.startTime ? localDayIso(g.startTime) : null) ?? g.date;
    return {
      groups: groupGamesByDay(games, dayOf),
      todayIso: now != null ? localDayIso(new Date(now).toISOString()) : null,
    };
  }, [games, now]);
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
  const {
    selectedGames,
    toggleGame,
    toggleGames,
    clearGames,
    chooseOpen,
    setChooseOpen,
    startedIds,
    now,
  } = filter;
  const { groups, todayIso } = useGameDays(games, now);
  // Prefix for the day headings' ids, so two pickers on one page can never collide.
  const idBase = useId();
  // A weekly slate (NFL, MLS, college football) spans several days, and a chip only
  // carries a start time — so split it under day headings. A one-day slate keeps the
  // single flat strip; a heading there would just repeat the date above it.
  const multiDay = groups.length > 1;
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
          {slateDate && groups.length > 0 && (
            <p className="mb-1.5 text-xs text-muted">
              {games.length} {games.length === 1 ? 'game' : 'games'} ·{' '}
              {formatDayRange(groups[0].day, groups[groups.length - 1].day)}
            </p>
          )}
          {multiDay ? (
            <div className="space-y-2.5">
              {groups.map(({ day, games: dayGames }) => {
                const dayLabel = formatDayLabel(day, todayIso);
                const targets = dayTargetIds(dayGames, startedIds);
                const pressed = targets.every((id) => selectedGames.has(id));
                // Say so when the tap will skip games already underway, so "3 games"
                // in the heading and 2 selected never reads as a miscount.
                const skipsStarted = targets.length < dayGames.length;
                return (
                  <div key={day} role="group" aria-labelledby={`${idBase}-${day}`}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p
                        id={`${idBase}-${day}`}
                        className="text-[11px] font-semibold uppercase tracking-wide text-muted"
                      >
                        {dayLabel} · {dayGames.length}{' '}
                        {dayGames.length === 1 ? 'game' : 'games'}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleGames(targets)}
                        aria-pressed={pressed}
                        // Stable name; aria-pressed carries the on/off state.
                        aria-label={`Select ${skipsStarted ? `the ${targets.length} upcoming` : 'all'} games on ${dayLabel}`}
                        className={
                          'inline-flex min-h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition-colors ' +
                          (pressed
                            ? 'border-brand bg-brand/10 text-brand'
                            : 'border-line bg-surface text-muted hover:border-brand/60 hover:text-foreground')
                        }
                      >
                        {pressed ? (
                          <>
                            <svg
                              viewBox="0 0 12 12"
                              width="10"
                              height="10"
                              aria-hidden="true"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M2.5 6.5 5 9l4.5-6" />
                            </svg>
                            Selected
                          </>
                        ) : skipsStarted ? (
                          `Select ${targets.length} upcoming`
                        ) : (
                          'Select day'
                        )}
                      </button>
                    </div>
                    <MatchupStrip
                      sport={sport}
                      games={dayGames}
                      selected={selectedGames}
                      startedIds={startedIds}
                      onToggle={toggleGame}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <MatchupStrip
              sport={sport}
              games={games}
              selected={selectedGames}
              startedIds={startedIds}
              onToggle={toggleGame}
            />
          )}
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
