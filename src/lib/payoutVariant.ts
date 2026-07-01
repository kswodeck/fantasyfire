// Payout-variant helpers — the pure logic behind PrizePicks demon/goblin ladders and
// Underdog balanced/alternate lines. A single (player, stat, source) can now offer
// several lines (a "ladder"); these helpers normalize the raw `oddsType` into a
// display kind and pick the one representative rung a compact row should show.
//
// Kinds (source-agnostic):
//   normal    — PrizePicks "standard", Underdog "balanced", any book's plain line
//   demon     — PrizePicks harder line / boosted payout (red)
//   goblin    — PrizePicks easier line / reduced payout (green)
//   alternate — Underdog alternate line, carries a numeric `multiplier` (e.g. 1.31×)
import type { ProvidedVariant } from './types';

export type PayoutKind = 'normal' | 'demon' | 'goblin' | 'alternate';

/** Normalize a source's raw `oddsType` into a display/logic kind. */
export function payoutKind(oddsType: string | null | undefined): PayoutKind {
  switch (oddsType) {
    case 'demon':
      return 'demon';
    case 'goblin':
      return 'goblin';
    case 'alternate':
      return 'alternate';
    default:
      return 'normal'; // "standard" | "balanced" | null | anything unknown
  }
}

/** True for the plain/market line — the one that feeds cross-book consensus. */
export function isNormalKind(oddsType: string | null | undefined): boolean {
  return payoutKind(oddsType) === 'normal';
}

/**
 * True when a line only pays the over ("more"). PrizePicks demons/goblins and
 * Underdog alternates are one-directional by the books' own rules — only the
 * plain/standard line takes an under.
 */
export function isOverOnly(oddsType: string | null | undefined): boolean {
  return payoutKind(oddsType) !== 'normal';
}

// Row display priority when a source offers several kinds for one player+stat:
// prefer the plain line, then demon, then goblin, then alternate. Within a single
// source only one "special" kind ever coexists with normal, so the tail order is
// only a tie-breaker that never actually fires in practice.
const KIND_PRIORITY: PayoutKind[] = ['normal', 'demon', 'goblin', 'alternate'];

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The plain/market line for a ladder (median of any normal rungs), or null. */
export function normalLine(variants: ProvidedVariant[]): number | null {
  const normals = variants.filter((v) => isNormalKind(v.oddsType));
  return normals.length ? median(normals.map((v) => v.line)) : null;
}

/**
 * Choose the single representative rung a compact row should display from a source's
 * variant ladder. Honors the kind priority (normal → demon → goblin → alternate),
 * then within the chosen kind picks the rung nearest `anchor` (the cross-book
 * consensus of normal lines). With no anchor, the median rung of that kind. Returns
 * null for an empty ladder.
 */
export function pickRepresentative(
  variants: ProvidedVariant[],
  anchor: number | null,
): ProvidedVariant | null {
  if (variants.length === 0) return null;
  for (const kind of KIND_PRIORITY) {
    const rungs = variants.filter((v) => payoutKind(v.oddsType) === kind);
    if (rungs.length === 0) continue;
    const target = anchor ?? median(rungs.map((r) => r.line));
    return rungs.reduce((best, r) =>
      Math.abs(r.line - target) < Math.abs(best.line - target) ? r : best,
    );
  }
  return variants[0];
}
