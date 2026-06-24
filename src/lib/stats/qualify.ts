// Role-relative "did the player get a normal opportunity?" threshold, shared by
// both sports. A fixed floor zeroes out part-time players, so the bar is each
// player's OWN workload: the average of their season per-game opportunity and
// their last-N-games per-game opportunity.
//
// The opportunity metric is sport-specific (see opportunityFor in the server
// layer): NBA = minutes; MLB hitters = plate appearances. (MLB pitchers are not
// opportunity-filtered — see the note there.) Pure (no React/Next/db) so it's
// unit-testable and the NBA matchup query mirrors the same formula in SQL.

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** How many recent appearances feed the "recent role" half of the blend. */
export const RECENT_GAMES_WINDOW = 10;

/**
 * Role-relative qualification threshold for one player.
 * `values` is the player's per-game opportunity in most-recent-first order (as
 * the DB returns games); nulls/zeros (non-appearances) are ignored. Returns the
 * average of the season mean and the last-N-appearances mean, or 0 when there
 * are no appearances (so nothing gets filtered out for a player with no data).
 */
export function blendedRoleThreshold(values: Array<number | null | undefined>): number {
  const used = values.filter((v): v is number => v != null && v > 0);
  if (used.length === 0) return 0;
  const seasonAvg = mean(used);
  const recentAvg = mean(used.slice(0, RECENT_GAMES_WINDOW));
  return (seasonAvg + recentAvg) / 2;
}
