'use client';

import type { FilterOption } from '@/lib/filters';
import { STAT_DEFS, type StatKey } from '@/lib/stats';
import type { LeanFilter } from './useListFilter';
import { MultiSelectMenu } from './MultiSelectMenu';

/** The props menu's button caption: "All props", else first short + "+N". */
function propsCaption(options: StatKey[], selected: ReadonlySet<StatKey>): string {
  const picked = options.filter((k) => selected.has(k));
  if (picked.length === 0) return 'All props';
  const first = STAT_DEFS[picked[0]].short;
  return picked.length === 1 ? first : `${first} +${picked.length - 1}`;
}

/**
 * Shared team (+ position) filter controls with a live result count. Controlled.
 * Opt-ins, so boards that don't want them stay unchanged:
 *  - `onQueryChange` renders a small player-name search first on the row;
 *  - `onLeanChange` renders a lean-direction (Over / Under) select;
 *  - `onToggleStat` renders a props multiselect (the prop types on this board)
 *    and REPLACES the position select — on the prop boards "props" is the more
 *    useful cut, and two taxonomy dropdowns would crowd the row.
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
  statOptions = [],
  selectedStats,
  onToggleStat,
  onClearStats,
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
  /** Prop keys present on this board (registry order) — the multiselect options. */
  statOptions?: StatKey[];
  /** Currently-selected prop keys (empty = all props, the default). */
  selectedStats?: ReadonlySet<StatKey>;
  /** When provided, the props multiselect renders instead of the position select. */
  onToggleStat?: (value: StatKey) => void;
  onClearStats?: () => void;
}) {
  const hasSearch = onQueryChange != null;
  const hasLean = onLeanChange != null;
  const hasProps = onToggleStat != null && statOptions.length >= 2;
  const stats = selectedStats ?? new Set<StatKey>();
  const hasFilters =
    team !== '' || position !== '' || (query ?? '') !== '' || (lean ?? '') !== '' || stats.size > 0;
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

      {hasProps ? (
        <MultiSelectMenu
          label=""
          caption={propsCaption(statOptions, stats)}
          options={statOptions.map((k) => ({
            value: k,
            label: `${STAT_DEFS[k].label} (${STAT_DEFS[k].short})`,
          }))}
          isSelected={(v) => stats.has(v as StatKey)}
          onToggle={(v) => onToggleStat(v as StatKey)}
        />
      ) : (
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
      )}

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
            onClearStats?.();
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
