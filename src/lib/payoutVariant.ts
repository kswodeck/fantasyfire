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
import { PP_BREAKEVEN_STEPS } from './ppPayouts';

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

/**
 * The breakeven probability a rung's payout implies — the anchor FireFactor scores
 * it against (0 = fairly priced). An exact posted multiplier wins (Underdog:
 * 0.5/multiplier, the same "relative to a standard leg's 0.5" convention); PrizePicks
 * demons/goblins fall back to the configured EXTREMITY-STEPPED approximations —
 * `rank` is the rung's position among its kind (0 = nearest the standard line), since
 * a deeper goblin pays less (higher bar) and a deeper demon pays more (lower bar).
 * A standard line — or an alternate with no posted multiplier — anchors at 0.5.
 */
export function variantBreakeven(
  oddsType: string | null | undefined,
  multiplier?: number | null,
  rank: number = 0,
): number {
  const kind = payoutKind(oddsType);
  if (kind === 'normal') return 0.5;
  if (multiplier != null && multiplier > 0) return Math.max(0.05, Math.min(0.95, 0.5 / multiplier));
  if (kind === 'demon' || kind === 'goblin') {
    const steps = PP_BREAKEVEN_STEPS[kind];
    return steps[Math.max(0, Math.min(rank, steps.length - 1))];
  }
  return 0.5;
}

/**
 * A rung's extremity rank among its kind within a ladder: 0 = nearest the standard
 * line (the mildest goblin/demon), counting outward. Anchored on the ladder's plain
 * line; a ladder with no standard rung anchors on the rung set's own median-ish pick.
 */
export function variantRank(v: ProvidedVariant, ladder: ProvidedVariant[]): number {
  const kind = payoutKind(v.oddsType);
  if (kind === 'normal') return 0;
  const anchor = normalLine(ladder) ?? v.line;
  const peers = ladder
    .filter((x) => payoutKind(x.oddsType) === kind)
    .sort((a, b) => Math.abs(a.line - anchor) - Math.abs(b.line - anchor));
  const at = peers.findIndex((x) => x.line === v.line);
  return at >= 0 ? at : 0;
}

/** `variantBreakeven` with the extremity rank derived from the rung's own ladder —
 *  use this wherever the full ladder is in hand. */
export function ladderBreakeven(v: ProvidedVariant, ladder: ProvidedVariant[]): number {
  return variantBreakeven(v.oddsType, v.multiplier, variantRank(v, ladder));
}

/** The strongest score on a row across its shown line and every scored rung — what
 *  "worth showing at all" means once variants carry their own reads. */
export function bestVariantScore(baseScore: number, variants?: ProvidedVariant[]): number {
  let best = baseScore;
  for (const v of variants ?? []) if (v.read && v.read.score > best) best = v.read.score;
  return best;
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
