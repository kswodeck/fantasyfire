// Correlation grouping for a multi-leg DFS entry.
//
// The entry calculator prices a Power/Flex sweep by multiplying each leg's win
// probability, which assumes the legs are INDEPENDENT. Two legs on the same player,
// or two legs in the same game, plainly are not: one blowout, one ejection, one
// rain delay moves both at once. The disclaimer already says so in prose; this
// turns it into something the user can see on the specific entry in front of them.
//
// We only detect and label the correlation — we never try to re-price it. Modelling
// a joint distribution from public game logs would be a guess dressed as precision,
// and the honest move is to say "this sweep is less certain than the number shows".
//
// Pure (no React/Next/db).

/** The minimal shape a leg needs to be grouped. */
export interface CorrelatableLeg {
  /** Player slug — same slug means same athlete. */
  slug: string;
  sport: string;
  /**
   * The scheduled game this leg is for (PlayerResearch.matchupOpponent.gameExternalId).
   * Null when unknown — an unknown game NEVER groups with another, because guessing
   * that two legs share a game is worse than staying quiet.
   */
  gameId?: string | null;
}

export interface CorrelationWarning {
  /** Legs on the same athlete, grouped by slug (each group has ≥2 legs). */
  samePlayer: { key: string; legs: CorrelatableLeg[] }[];
  /** Legs in the same game (≥2 legs), excluding groups that are purely same-player. */
  sameGame: { key: string; legs: CorrelatableLeg[] }[];
}

function groupBy<T>(items: T[], key: (t: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (k === null) continue;
    const list = out.get(k);
    if (list) list.push(it);
    else out.set(k, [it]);
  }
  return out;
}

/**
 * Which of the chosen legs are correlated with each other.
 *
 * `sameGame` deliberately excludes a group whose legs are all the same player —
 * that is already reported as `samePlayer`, and saying it twice reads like two
 * separate problems.
 */
export function correlationWarning(legs: CorrelatableLeg[]): CorrelationWarning {
  const samePlayer = [...groupBy(legs, (l) => `${l.sport}:${l.slug}`)]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, legs: group }));

  const sameGame = [...groupBy(legs, (l) => (l.gameId ? `${l.sport}:${l.gameId}` : null))]
    .filter(([, group]) => group.length > 1)
    .filter(([, group]) => new Set(group.map((l) => l.slug)).size > 1)
    .map(([key, group]) => ({ key, legs: group }));

  return { samePlayer, sameGame };
}

/** True when the entry has any correlation worth flagging. */
export function hasCorrelation(w: CorrelationWarning): boolean {
  return w.samePlayer.length > 0 || w.sameGame.length > 0;
}

/**
 * The set of leg keys involved in ANY correlated group, so each affected row can
 * be marked inline rather than only summarised at the bottom.
 */
export function correlatedLegKeys(
  w: CorrelationWarning,
  legKey: (l: CorrelatableLeg) => string,
): Set<string> {
  const out = new Set<string>();
  for (const g of [...w.samePlayer, ...w.sameGame]) for (const l of g.legs) out.add(legKey(l));
  return out;
}
