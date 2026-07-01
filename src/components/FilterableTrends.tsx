'use client';

import type { Sport } from '@/lib/sports';
import type { TrendRow } from '@/lib/types';
import { TrendBoardTable } from './TrendBoardTable';
import { ListFilters } from './ListFilters';
import { useListFilter } from './useListFilter';

/** Trends board with team + position filters and a "show more" reveal. */
export function FilterableTrends({
  sport,
  rows,
  initialVisible = 50,
  step = 50,
}: {
  sport: Sport;
  rows: TrendRow[];
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
        noun="trends"
        query={f.query}
        onQueryChange={f.setQuery}
      />
      {f.filtered.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No trends match these filters.
        </p>
      ) : (
        <>
          <TrendBoardTable rows={f.shown} />
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
