'use client';

import type { Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';
import { BoardTable } from './BoardTable';
import { ListFilters } from './ListFilters';
import { useListFilter } from './useListFilter';

/**
 * Cross-player board with team + position filters and a "show more" reveal — all
 * in memory over the already-fetched rows (keeps the page statically rendered).
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
  const f = useListFilter(sport, rows, initialVisible, step);
  return (
    <div>
      <ListFilters
        teamOptions={f.teamOptions}
        positionOptions={f.positionOptions}
        team={f.team}
        position={f.position}
        onTeamChange={f.setTeam}
        onPositionChange={f.setPosition}
        resultCount={f.filtered.length}
        totalCount={rows.length}
        noun="reads"
        query={f.query}
        onQueryChange={f.setQuery}
      />
      {f.filtered.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No reads match these filters.
        </p>
      ) : (
        <>
          <BoardTable rows={f.shown} />
          {f.visible < f.filtered.length && (
            <button
              type="button"
              onClick={f.showMore}
              className="mt-3 w-full rounded-xl border border-line bg-surface py-2.5 text-sm font-medium text-brand transition-colors hover:bg-surface-2"
            >
              Show more ({f.filtered.length - f.visible} more)
            </button>
          )}
        </>
      )}
    </div>
  );
}
