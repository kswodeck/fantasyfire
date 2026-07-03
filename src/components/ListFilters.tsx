'use client';

import type { FilterOption } from '@/lib/filters';
import type { LeanFilter } from './useListFilter';

/**
 * Shared team + position filter controls with a live result count. Controlled.
 * Pass `onQueryChange` to also render a small player-name search on the same row,
 * and `onLeanChange` to render a lean-direction (Over / Under) select — both
 * opt-in, so boards that don't want them stay unchanged.
 */
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
  query,
  onQueryChange,
  lean,
  onLeanChange,
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
  /** Current name-search text. Only used when `onQueryChange` is provided. */
  query?: string;
  /** When provided, a small name-search input renders first on the filter row. */
  onQueryChange?: (value: string) => void;
  /** Current lean-direction filter ('' = both sides). */
  lean?: LeanFilter;
  /** When provided, an Over/Under lean select renders on the filter row. */
  onLeanChange?: (value: LeanFilter) => void;
}) {
  const hasSearch = onQueryChange != null;
  const hasLean = onLeanChange != null;
  const hasFilters = team !== '' || position !== '' || (query ?? '') !== '' || (lean ?? '') !== '';
  const selectCls =
    'rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand';

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {hasSearch && (
        <input
          type="search"
          aria-label="Search players by name"
          value={query ?? ''}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search players…"
          className={`${selectCls} w-40 sm:w-44`}
        />
      )}
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

      {hasLean && (
        <select
          aria-label="Filter by lean direction"
          value={lean ?? ''}
          onChange={(e) => onLeanChange(e.target.value as LeanFilter)}
          className={selectCls}
        >
          <option value="">All leans</option>
          <option value="over">Over</option>
          <option value="under">Under</option>
        </select>
      )}

      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            onTeamChange('');
            onPositionChange('');
            onQueryChange?.('');
            onLeanChange?.('');
          }}
          className="rounded-lg px-3 py-2 text-sm font-medium text-brand transition-colors hover:text-brand-strong"
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
