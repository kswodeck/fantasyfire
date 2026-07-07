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

// ---- MLB (single calendar year; season runs ~March–October) ----

/** Current MLB season as a year string ("2026"). MLB_SEASON can override it. */
export function currentMlbSeason(now: Date = new Date()): string {
  const override = process.env.MLB_SEASON?.trim();
  if (override && /^\d{4}$/.test(override)) return override;
  // Jan/Feb still belong to the prior (completed) season.
  return String(now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1);
}

/** The MLB season before the given one: "2026" -> "2025". */
export function previousMlbSeason(season: string): string {
  return String(Number.parseInt(season, 10) - 1);
}

// ---- NFL (single calendar year; season runs ~September–February) ----

/**
 * Current NFL season as a year string ("2025"). NFL_SEASON can override it.
 * The season is labelled by its START year, so Jan/Feb playoff games belong to
 * the prior year (cutoff: August). Today (mid-2026) resolves to "2025".
 */
export function currentNflSeason(now: Date = new Date()): string {
  const override = process.env.NFL_SEASON?.trim();
  if (override && /^\d{4}$/.test(override)) return override;
  // Aug–Dec belong to this year's season; Jan–Jul belong to last year's.
  return String(now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1);
}

/** The NFL season before the given one: "2025" -> "2024". */
export function previousNflSeason(season: string): string {
  return String(Number.parseInt(season, 10) - 1);
}

// ---- NHL (two-year "YYYY-YY" like the NBA; season runs ~October–June) ----

/**
 * Current NHL season ("2025-26"). NHL_SEASON can override it. Cutoff: September 15
 * (opening night is early October), so July–mid-September still belong to the season
 * that just finished (its Stanley Cup run ends in June).
 */
export function currentNhlSeason(now: Date = new Date()): string {
  const override = process.env.NHL_SEASON?.trim();
  if (override && /^\d{4}-\d{2}$/.test(override)) return override;
  const month = now.getMonth();
  const afterCutoff = month > 8 || (month === 8 && now.getDate() >= 15); // >= Sep 15
  return formatSeason(afterCutoff ? now.getFullYear() : now.getFullYear() - 1);
}

// ---- WNBA (single calendar year; season runs ~May–October) ----

/** Current WNBA season as a year string ("2026"). WNBA_SEASON can override it. */
export function currentWnbaSeason(now: Date = new Date()): string {
  const override = process.env.WNBA_SEASON?.trim();
  if (override && /^\d{4}$/.test(override)) return override;
  // Jan–Mar still belong to the prior (completed) season.
  return String(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1);
}

// ---- MLS (single calendar year; season runs ~late February–December) ----

/** Current MLS season as a year string ("2026"). MLS_SEASON can override it. */
export function currentMlsSeason(now: Date = new Date()): string {
  const override = process.env.MLS_SEASON?.trim();
  if (override && /^\d{4}$/.test(override)) return override;
  // January belongs to the prior (completed) season.
  return String(now.getMonth() >= 1 ? now.getFullYear() : now.getFullYear() - 1);
}

// ---- College football (single calendar year; season runs ~late August–January) ----

/** Current CFB season as its START year ("2025"). CFB_SEASON can override it.
 *  Like the NFL: Jan bowl games belong to the prior year (cutoff: August). */
export function currentCfbSeason(now: Date = new Date()): string {
  const override = process.env.CFB_SEASON?.trim();
  if (override && /^\d{4}$/.test(override)) return override;
  return String(now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1);
}

// ---- Men's college basketball (two-year "YYYY-YY"; runs ~November–April) ----

/** Current CBB season ("2025-26"). CBB_SEASON can override it. Cutoff: October 1
 *  (tip-off is early November; May–September belong to the finished season). */
export function currentCbbSeason(now: Date = new Date()): string {
  const override = process.env.CBB_SEASON?.trim();
  if (override && /^\d{4}-\d{2}$/.test(override)) return override;
  return formatSeason(now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1);
}

// ---- Sport-generic helpers ----

import type { Sport } from './sports';

export function currentSeason(sport: Sport, now: Date = new Date()): string {
  switch (sport) {
    case 'mlb':
      return currentMlbSeason(now);
    case 'nfl':
      return currentNflSeason(now);
    case 'nhl':
      return currentNhlSeason(now);
    case 'wnba':
      return currentWnbaSeason(now);
    case 'mls':
      return currentMlsSeason(now);
    case 'cfb':
      return currentCfbSeason(now);
    case 'cbb':
      return currentCbbSeason(now);
    default:
      return configuredSeason(now);
  }
}

export function previousSeason(sport: Sport, season: string): string {
  // Two-year sports (NBA/NHL/CBB) use "YYYY-YY"; the rest are plain years.
  if (/^\d{4}-\d{2}$/.test(season)) return previousNbaSeason(season);
  return String(Number.parseInt(season, 10) - 1);
}
