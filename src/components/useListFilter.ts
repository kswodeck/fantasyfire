'use client';

import { useMemo, useState } from 'react';
import type { Sport } from '@/lib/sports';
import type { PlayerListItem } from '@/lib/types';
import { positionFilterOptions, playerMatchesPosition, teamFilterOptions } from '@/lib/filters';
import { normalizeName } from '@/lib/slate';

/** Lean-direction filter value: '' = both sides (the default). */
export type LeanFilter = '' | 'over' | 'under';

/**
 * Shared name-search + team + position filtering and a "show more" reveal for the
 * player-list boards (board / leaders / trends). All in memory over the
 * already-fetched rows, so the pages stay statically rendered. Changing a filter
 * resets the reveal to `initialVisible`. The name match is accent/punctuation
 * insensitive (same normalizeName as the Players browser). Pass `sideOf` to also
 * enable the lean-direction (Over / Under) filter — rows without a side always pass.
 */
export function useListFilter<T extends { player: PlayerListItem }>(
  sport: Sport,
  rows: T[],
  initialVisible: number,
  step: number,
  sideOf?: (row: T) => 'over' | 'under',
) {
  const [team, setTeamState] = useState('');
  const [position, setPositionState] = useState('');
  const [query, setQueryState] = useState('');
  const [lean, setLeanState] = useState<LeanFilter>('');
  const [visible, setVisible] = useState(initialVisible);

  const teamOptions = useMemo(
    () => teamFilterOptions(sport, rows.map((r) => r.player.teamAbbreviation)),
    [sport, rows],
  );
  const positionOptions = useMemo(() => positionFilterOptions(sport), [sport]);

  const nq = normalizeName(query);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (team === '' || r.player.teamAbbreviation === team) &&
          playerMatchesPosition(sport, position, r.player.position, r.player.posBucket) &&
          (nq === '' || normalizeName(r.player.fullName).includes(nq)) &&
          (lean === '' || sideOf === undefined || sideOf(r) === lean),
      ),
    [rows, team, position, nq, lean, sideOf, sport],
  );

  return {
    team,
    position,
    query,
    lean,
    visible,
    teamOptions,
    positionOptions,
    filtered,
    shown: filtered.slice(0, visible),
    setTeam: (v: string) => {
      setTeamState(v);
      setVisible(initialVisible);
    },
    setPosition: (v: string) => {
      setPositionState(v);
      setVisible(initialVisible);
    },
    setQuery: (v: string) => {
      setQueryState(v);
      setVisible(initialVisible);
    },
    setLean: (v: LeanFilter) => {
      setLeanState(v);
      setVisible(initialVisible);
    },
    showMore: () => setVisible((v) => v + step),
  };
}
