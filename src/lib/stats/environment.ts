// Game environment (idea #4) — turn a game's Vegas total + spread into a projection
// multiplier. A high-total game is a richer scoring environment (more points/runs to
// go around), and the spread splits that total between the teams: the favorite's
// implied team total is higher. A player's counting-stat projection should lean up in
// a high implied-total spot and down in a low one. Pure (no React/Next/db).

/** Clamp on the environment multiplier — Vegas context nudges, it doesn't swing. */
export const ENVIRONMENT_MULTIPLIER_BOUNDS = { min: 0.92, max: 1.08 } as const;

/**
 * A team's implied total from the game total and that team's spread (team
 * perspective: negative = favored). implied = total/2 − teamSpread/2, so a favorite
 * (negative spread) is bumped up and a dog down. Null when either input is missing.
 */
export function impliedTeamTotal(
  gameTotal: number | null,
  teamSpread: number | null,
): number | null {
  if (gameTotal == null || teamSpread == null) return null;
  return gameTotal / 2 - teamSpread / 2;
}

/**
 * Environment multiplier: a team's implied total vs the league-average team total
 * (≈ the average game total / 2), clamped. Neutral (1) when any input is missing or
 * non-positive, so the projection degrades to environment-blind.
 */
export function environmentMultiplier(
  impliedTotal: number | null,
  leagueAvgTeamTotal: number | null,
): number {
  if (impliedTotal == null || leagueAvgTeamTotal == null || leagueAvgTeamTotal <= 0) {
    return 1;
  }
  const raw = impliedTotal / leagueAvgTeamTotal;
  return Math.min(
    ENVIRONMENT_MULTIPLIER_BOUNDS.max,
    Math.max(ENVIRONMENT_MULTIPLIER_BOUNDS.min, raw),
  );
}
