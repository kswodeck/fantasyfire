// NBA season resolution from the calendar date (no env var needed).
//
// The NBA season spans two calendar years and tips off in late October. We flip
// to the new season on **October 15**:
//   - on/after Oct 15  -> season STARTS this year   (start=Y,   end=Y+1)
//   - Jan 1 .. Oct 14  -> season started last year   (start=Y-1, end=Y)
// Season strings use the NBA's "YYYY-YY" form, e.g. 2025-26, 2008-09.
//
// Pure functions (currentNbaSeason/previousNbaSeason/formatSeason) take a Date so
// they're testable; configuredSeason() adds an optional NBA_SEASON override.

/** Format a season from its start year: 2025 -> "2025-26", 2008 -> "2008-09". */
export function formatSeason(startYear: number): string {
  const endYY = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYY}`;
}

/** The NBA season for a given date (defaults to now). Cutoff: October 15. */
export function currentNbaSeason(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based: Jan=0 … Oct=9 … Dec=11
  const day = now.getDate();
  const afterCutoff = month > 9 || (month === 9 && day >= 15); // >= Oct 15
  const startYear = afterCutoff ? year : year - 1;
  return formatSeason(startYear);
}

/** The season before the given one: "2025-26" -> "2024-25". */
export function previousNbaSeason(season: string): string {
  const startYear = Number.parseInt(season.slice(0, 4), 10);
  return formatSeason(startYear - 1);
}

/**
 * The season to use. Computed from today's date, unless NBA_SEASON is set to a
 * valid "YYYY-YY" override (handy for backfilling a specific season).
 */
export function configuredSeason(now: Date = new Date()): string {
  const override = process.env.NBA_SEASON?.trim();
  if (override && /^\d{4}-\d{2}$/.test(override)) return override;
  return currentNbaSeason(now);
}
