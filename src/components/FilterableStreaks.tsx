'use client';

import type { Sport } from '@/lib/sports';
import type { StreakRow } from '@/lib/types';
import { StreakBoardTable } from './StreakBoardTable';
import { ListFilters } from './ListFilters';
import { useListFilter } from './useListFilter';

/** Streaks board with team + position filters and a "show more" reveal. */
export function FilterableStreaks({
  sport,
  rows,
  initialVisible = 50,
  step = 50,
}: {
  sport: Sport;
  rows: StreakRow[];
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
        noun="streaks"
      />
      {f.filtered.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No streaks match these filters.
        </p>
      ) : (
        <>
          <StreakBoardTable sport={sport} rows={f.shown} />
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
