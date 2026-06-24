'use client';

import { useMemo, useState } from 'react';
import { SPORTS, type Sport } from '@/lib/sports';
import type { PlayerListItem } from '@/lib/types';
import { positionFilterOptions, playerMatchesPosition, teamFilterOptions } from '@/lib/filters';
import { normalizeName } from '@/lib/slate';
import { PlayerCard } from './PlayerCard';
import { ListFilters } from './ListFilters';

const STEP = 48;

/**
 * Client browser for the full roster: instant name search + team + position
 * filters + "show more", all in memory. The page ships the whole roster
 * (~600 NBA / ~1250 MLB) so filtering needs no server round-trips. `initialQuery`
 * comes from the page's ?q= so the no-JS SearchForm submit still lands on a
 * pre-filtered list (the initial render — and its SSR HTML — honors it).
 */
export function PlayerBrowser({
  sport,
  players,
  initialQuery = '',
  initialVisible = STEP,
}: {
  sport: Sport;
  players: PlayerListItem[];
  initialQuery?: string;
  initialVisible?: number;
}) {
  const [q, setQ] = useState(initialQuery);
  const [team, setTeam] = useState('');
  const [position, setPosition] = useState('');
  const [visible, setVisible] = useState(initialVisible);

  const teamOptions = useMemo(
    () => teamFilterOptions(sport, players.map((p) => p.teamAbbreviation)),
    [sport, players],
  );
  const positionOptions = useMemo(() => positionFilterOptions(sport), [sport]);

  const nq = normalizeName(q);
  const filtered = useMemo(
    () =>
      players.filter(
        (p) =>
          (team === '' || p.teamAbbreviation === team) &&
          playerMatchesPosition(sport, position, p.position, p.posBucket) &&
          (nq === '' || normalizeName(p.fullName).includes(nq)),
      ),
    [players, team, position, nq, sport],
  );

  const shown = filtered.slice(0, visible);
  const reset = () => setVisible(initialVisible);
  const noun = SPORTS[sport].name;

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          reset();
        }}
        placeholder={`Search ${noun} players…`}
        aria-label={`Search ${noun} players`}
        className="mb-3 w-full rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
      />

      <ListFilters
        teamOptions={teamOptions}
        positionOptions={positionOptions}
        team={team}
        position={position}
        onTeamChange={(v) => {
          setTeam(v);
          reset();
        }}
        onPositionChange={(v) => {
          setPosition(v);
          reset();
        }}
        resultCount={filtered.length}
        totalCount={players.length}
        noun="players"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">No players match these filters.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((p) => (
              <PlayerCard key={p.slug} player={p} />
            ))}
          </div>
          {visible < filtered.length && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + STEP)}
              className="mt-4 w-full rounded-xl border border-line bg-surface py-2.5 text-sm font-medium text-brand transition-colors hover:bg-surface-2"
            >
              Show more ({filtered.length - visible} more)
            </button>
          )}
        </>
      )}
    </div>
  );
}
