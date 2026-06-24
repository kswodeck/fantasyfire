// Pure filter helpers for the list pages (board / today / players): team +
// position option lists and matchers. Sport-branched because position semantics
// differ — NBA stores coarse buckets G/F/C; MLB stores only H/P plus a granular
// `position` abbreviation (P, C, 1B, SS, CF, DH…). No React/db imports.
import { getTeam } from './teams';
import type { Sport } from './sports';

export interface FilterOption {
  value: string;
  label: string;
}

const NBA_POSITIONS: FilterOption[] = [
  { value: 'G', label: 'Guards' },
  { value: 'F', label: 'Forwards' },
  { value: 'C', label: 'Centers' },
];

// MLB fielding buckets derived from the primary-position abbreviation. `posBucket`
// in the DB is only H/P, so a useful position filter must map the abbreviation.
const MLB_POSITION_GROUPS: { value: string; label: string; abbrs: string[] }[] = [
  { value: 'P', label: 'Pitchers', abbrs: ['P', 'SP', 'RP', 'TWP'] },
  { value: 'C', label: 'Catchers', abbrs: ['C'] },
  { value: 'IF', label: 'Infield', abbrs: ['1B', '2B', '3B', 'SS', 'IF'] },
  { value: 'OF', label: 'Outfield', abbrs: ['LF', 'CF', 'RF', 'OF'] },
  { value: 'DH', label: 'DH', abbrs: ['DH'] },
];

/** Position filter options for a sport (the "All positions" default is added by the UI). */
export function positionFilterOptions(sport: Sport): FilterOption[] {
  return sport === 'nba'
    ? NBA_POSITIONS
    : MLB_POSITION_GROUPS.map(({ value, label }) => ({ value, label }));
}

/**
 * Does a player match a position category? Empty category === "all". NBA matches
 * inclusively on the position string ("G-F" is both a Guard and a Forward); MLB
 * matches by exact abbreviation membership (so "CF" is Outfield, never Catcher).
 */
export function playerMatchesPosition(
  sport: Sport,
  category: string,
  position: string | null,
  posBucket: string | null,
): boolean {
  if (!category) return true;
  if (sport === 'nba') {
    const p = (position ?? posBucket ?? '').toUpperCase();
    return p.includes(category); // category ∈ G | F | C
  }
  const group = MLB_POSITION_GROUPS.find((g) => g.value === category);
  if (!group) return false;
  const pos = (position ?? '').toUpperCase();
  if (group.value === 'P') {
    // posBucket is authoritative for pitchers (set from primaryPosition.type).
    return posBucket === 'P' || group.abbrs.includes(pos);
  }
  return group.abbrs.includes(pos);
}

/** Distinct teams present in a dataset, as sorted {value,label} options for a dropdown. */
export function teamFilterOptions(
  sport: Sport,
  abbreviations: (string | null | undefined)[],
): FilterOption[] {
  const present = new Set<string>();
  for (const a of abbreviations) if (a) present.add(a);
  return [...present]
    .map((abbr) => ({ value: abbr, label: getTeam(sport, abbr).fullName || abbr }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
