// Per-player minutes threshold for the NBA "did they play a normal role?" filter.
//
// A fixed minute floor (e.g. 10) zeroes out bench players who never clear it, so
// instead we use a role-relative threshold: the average of a player's season
// minutes-per-game and their last-10-games minutes-per-game. Computed over games
// the player actually appeared in (minutes > 0), so DNPs don't drag it down.
//
// Pure (no React/Next/db) so it's unit-testable and shared by the per-player
// rate filter and the DvP aggregation (which derives the same value in SQL).

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** How many recent appearances feed the "recent role" half of the blend. */
export const RECENT_GAMES_WINDOW = 10;

/**
 * Role-relative minute threshold for one player.
 * `minutes` is the player's per-game minutes in most-recent-first order (as the
 * DB returns them); nulls/zeros (DNPs) are ignored. Returns the average of the
 * season mean and the last-10-appearances mean, or 0 when there are no
 * appearances (so nothing gets filtered out for a player we have no data on).
 */
export function nbaMinutesThreshold(minutes: Array<number | null | undefined>): number {
  const played = minutes.filter((m): m is number => m != null && m > 0);
  if (played.length === 0) return 0;
  const seasonAvg = mean(played);
  const recentAvg = mean(played.slice(0, RECENT_GAMES_WINDOW));
  return (seasonAvg + recentAvg) / 2;
}
