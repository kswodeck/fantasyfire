// Pure formatting helpers (no React/Next). Shared by components + insight text.

/** Format a 0..1 probability as a whole-percent string; null -> "—". */
export function pct(x: number | null | undefined, digits = 0): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  return `${(x * 100).toFixed(digits)}%`;
}

/** Round to one decimal; null -> "—". */
export function num1(x: number | null | undefined): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  return x.toFixed(1);
}

/** Ordinal: 1 -> "1st", 2 -> "2nd", 11 -> "11th", 23 -> "23rd". */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Signed number, e.g. +3.2 / -1.0. */
export function signed(x: number, digits = 1): string {
  const r = x.toFixed(digits);
  return x >= 0 ? `+${r}` : r;
}

/** American odds with explicit sign. */
export function americanOdds(x: number): string {
  return x > 0 ? `+${x}` : `${x}`;
}

/** Round to the nearest half (e.g. 24.7 -> 24.5). May land on a whole number. */
export function roundToHalf(x: number): number {
  return Math.round(x * 2) / 2;
}

/**
 * Round to the nearest hundredth — for stats computed as a WEIGHTED SUM, where
 * binary floating point leaks artifacts into a value that is exact in decimal.
 * A fantasy score of 1 rebound (×1.2) minus 1 turnover is 0.2, but evaluates to
 * 0.19999999999999996 and rendered as that full string.
 *
 * This is artifact cleanup, NOT a lossy display rounding: every scoring weight we
 * use has at most two decimal places (1.2, 1.5, 0.04, 0.1) applied to whole-number
 * box-score counts, so the true value can never have a third decimal for this to
 * discard. Applied at the SOURCE (the score functions) rather than per-component,
 * so the board, player pages, settled ledger, API, captions and OG cards all agree.
 */
export function roundToHundredth(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Round to the nearest half-POINT line (always x.5), book-style, so a default
 * line never pushes. E.g. 25.3 -> 25.5, 25.7 -> 25.5, 26.0 -> 26.5. Never < 0.5.
 */
export function roundToHalfLine(x: number): number {
  return Math.max(0.5, Math.round(x - 0.5) + 0.5);
}

/**
 * Median of a numeric list (0 for an empty list). Does not mutate the input.
 * Preferred over the mean for a default prop line: counting stats are
 * right-skewed, so the mean sits above the typical game and biases the default
 * toward the Over.
 */
export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Format an ISO `YYYY-MM-DD` date as e.g. "Jun 23, 2026". Parses the string parts
 * directly (no `new Date()`), so it never drifts a day across time zones.
 */
export function formatIsoDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${MONTHS[Number(mo) - 1] ?? mo} ${Number(d)}, ${y}`;
}
