'use client';

import type { FilterOption } from '@/lib/filters';

/** Shared team + position filter controls with a live result count. Controlled. */
export function ListFilters({
  teamOptions,
  positionOptions,
  team,
  position,
  onTeamChange,
  onPositionChange,
  resultCount,
  totalCount,
  noun = 'results',
}: {
  teamOptions: FilterOption[];
  positionOptions: FilterOption[];
  team: string;
  position: string;
  onTeamChange: (value: string) => void;
  onPositionChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
  noun?: string;
}) {
  const hasFilters = team !== '' || position !== '';
  const selectCls =
    'rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-brand';

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <select
        aria-label="Filter by team"
        value={team}
        onChange={(e) => onTeamChange(e.target.value)}
        className={selectCls}
      >
        <option value="">All teams</option>
        {teamOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by position"
        value={position}
        onChange={(e) => onPositionChange(e.target.value)}
        className={selectCls}
      >
        <option value="">All positions</option>
        {positionOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            onTeamChange('');
            onPositionChange('');
          }}
          className="rounded-lg px-2 py-1.5 text-xs font-medium text-brand transition-colors hover:text-brand-strong"
        >
          Clear
        </button>
      )}

      <span className="ml-auto text-xs tabular-nums text-muted">
        {resultCount === totalCount
          ? `${totalCount} ${noun}`
          : `${resultCount} of ${totalCount} ${noun}`}
      </span>
    </div>
  );
}
