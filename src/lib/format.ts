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
 * Round to the nearest half-POINT line (always x.5), book-style, so a default
 * line never pushes. E.g. 25.3 -> 25.5, 25.7 -> 25.5, 26.0 -> 26.5. Never < 0.5.
 */
export function roundToHalfLine(x: number): number {
  return Math.max(0.5, Math.round(x - 0.5) + 0.5);
}
