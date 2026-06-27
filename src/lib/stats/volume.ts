// Volume / opportunity trend (ideas #7 NBA minutes, #8 NFL snaps/targets) — a
// projection multiplier from a player's RECENT opportunity vs their season baseline.
// Opportunity (minutes, pass attempts, carries+catches, plate appearances) is a far
// more stable, predictive signal of role than the noisy counting stat itself, so a
// player whose minutes/usage just jumped should be projected up even before the
// box score fully catches up (and down when the role shrank). Pure (no React/Next/db).

/** Clamp on the volume multiplier — a role change nudges, it doesn't swing. */
export const VOLUME_MULTIPLIER_BOUNDS = { min: 0.9, max: 1.1 } as const;

/** Recent appearances that define "recent role". */
const RECENT_APPEARANCES = 5;
/** Need at least this many appearances before a trend is worth trusting. */
const MIN_APPEARANCES = 4;

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Volume multiplier from per-game opportunity values (most-recent-first; nulls/zeros
 * for non-appearances are ignored). The ratio of the last-N appearance average to the
 * season average, clamped. Neutral (1) on thin samples or when opportunity isn't
 * tracked for the role (e.g. MLB pitchers, where `opportunityFor` returns null).
 */
export function volumeMultiplier(values: Array<number | null | undefined>): number {
  const used = values.filter((v): v is number => v != null && v > 0);
  if (used.length < MIN_APPEARANCES) return 1;
  const seasonAvg = mean(used);
  if (seasonAvg <= 0) return 1;
  const recentAvg = mean(used.slice(0, RECENT_APPEARANCES));
  const raw = recentAvg / seasonAvg;
  return Math.min(VOLUME_MULTIPLIER_BOUNDS.max, Math.max(VOLUME_MULTIPLIER_BOUNDS.min, raw));
}
