// Game pace (NBA) — derived purely from box-score totals we already store, so it
// needs no new data source. More possessions ⇒ more shots, rebounds, assists, etc.,
// so a counting-stat projection should scale with the projected pace of the specific
// game. Pure (no React/Next/db).
//
// Possessions are estimated with the standard box-score formula:
//   POSS ≈ FGA + 0.44·FTA − OREB + TOV
// (the 0.44 weights free-throw trips; offensive rebounds extend a possession; a
// turnover ends one). Pace = possessions per game. The projected game pace blends the
// player's team and the opponent, relative to the league average, into a gentle
// clamped multiplier.

/** A team's per-game possession-driving totals (summed across its players). */
export interface TeamBoxTotals {
  fga: number;
  fta: number;
  oreb: number;
  tov: number;
}

/** Clamp on the pace multiplier — pace matters, but shouldn't swing a projection far. */
export const PACE_MULTIPLIER_BOUNDS = { min: 0.92, max: 1.08 } as const;

/** Estimated possessions for one team-game from its box-score totals. */
export function possessions(t: TeamBoxTotals): number {
  return Math.max(0, t.fga + 0.44 * t.fta - t.oreb + t.tov);
}

/** Average possessions (pace) over a set of team-games. Null when there are none. */
export function teamPace(games: TeamBoxTotals[]): number | null {
  if (games.length === 0) return null;
  const total = games.reduce((sum, g) => sum + possessions(g), 0);
  return total / games.length;
}

/**
 * Pace multiplier for a game between two teams, relative to the league average.
 * Projected game pace = mean of the two teams' season pace; the multiplier is that
 * over the league average, clamped. Falls back to 1 (neutral) when any input is
 * missing or non-positive.
 */
export function paceMultiplier(
  teamPaceValue: number | null,
  opponentPaceValue: number | null,
  leagueAvgPace: number | null,
): number {
  if (
    teamPaceValue == null ||
    opponentPaceValue == null ||
    leagueAvgPace == null ||
    leagueAvgPace <= 0
  ) {
    return 1;
  }
  const gamePace = (teamPaceValue + opponentPaceValue) / 2;
  const raw = gamePace / leagueAvgPace;
  return Math.min(PACE_MULTIPLIER_BOUNDS.max, Math.max(PACE_MULTIPLIER_BOUNDS.min, raw));
}
