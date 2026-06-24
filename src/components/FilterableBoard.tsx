'use client';

import { useMemo, useState } from 'react';
import type { Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';
import { positionFilterOptions, playerMatchesPosition, teamFilterOptions } from '@/lib/filters';
import { BoardTable } from './BoardTable';
import { ListFilters } from './ListFilters';

/**
 * Client wrapper around the ranked board: team + position filters and a
 * "show more" reveal, all in memory over the already-fetched rows (keeps the
 * page statically rendered — no per-request DB work).
 */
export function FilterableBoard({
  sport,
  rows,
  initialVisible = 25,
  step = 25,
}: {
  sport: Sport;
  rows: BoardRow[];
  initialVisible?: number;
  step?: number;
}) {
  const [team, setTeam] = useState('');
  const [position, setPosition] = useState('');
  const [visible, setVisible] = useState(initialVisible);

  const teamOptions = useMemo(
    () => teamFilterOptions(sport, rows.map((r) => r.player.teamAbbreviation)),
    [sport, rows],
  );
  const positionOptions = useMemo(() => positionFilterOptions(sport), [sport]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (team === '' || r.player.teamAbbreviation === team) &&
          playerMatchesPosition(sport, position, r.player.position, r.player.posBucket),
      ),
    [rows, team, position, sport],
  );

  const shown = filtered.slice(0, visible);

  return (
    <div>
      <ListFilters
        teamOptions={teamOptions}
        positionOptions={positionOptions}
        team={team}
        position={position}
        onTeamChange={(v) => {
          setTeam(v);
          setVisible(initialVisible);
        }}
        onPositionChange={(v) => {
          setPosition(v);
          setVisible(initialVisible);
        }}
        resultCount={filtered.length}
        totalCount={rows.length}
        noun="leans"
      />

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No leans match these filters.
        </p>
      ) : (
        <>
          <BoardTable sport={sport} rows={shown} />
          {visible < filtered.length && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + step)}
              className="mt-3 w-full rounded-xl border border-line bg-surface py-2.5 text-sm font-medium text-brand transition-colors hover:bg-surface-2"
            >
              Show more ({filtered.length - visible} more)
            </button>
          )}
        </>
      )}
    </div>
  );
}
