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
import type { BoardRow, ProvidedVariant } from './types';
import { PP_BREAKEVEN_STEPS } from './ppPayouts';
import { marketImpliedBreakeven, type RungQuote } from './odds/marketBreakeven';
import { FIREFACTOR_TIER_CUTOFFS } from './stats/fireScore';

export type PayoutKind = 'normal' | 'demon' | 'goblin' | 'alternate';

/** The strongest special (demon/goblin/alternate) rung whose read clears the Slight
 *  bar AND beats the default line's score — the one a board row's "best payout" hint
 *  points to (returns its score alongside so callers don't re-narrow the optional
 *  read). Null when nothing special qualifies. Shared by BoardRowCard (to render the
 *  hint) and HomeTopLeans (to reserve uniform row space for it across the teaser). */
export function qualifyingSpecialHint(
  row: BoardRow,
): { variant: ProvidedVariant; score: number } | null {
  const best = (row.variants ?? []).reduce<ProvidedVariant | null>((acc, v) => {
    if (payoutKind(v.oddsType) === 'normal' || !v.read) return acc;
    return !acc || v.read.score > (acc.read?.score ?? 0) ? v : acc;
  }, null);
  const score = best?.read?.score;
  if (best && score != null && score >= FIREFACTOR_TIER_CUTOFFS.slight && score > row.fireScore.score) {
    return { variant: best, score };
  }
  return null;
}

/** Whether the row carries a cross-book line-value hint worth showing (edge ≥ 5pts). */
export function hasLineValueHint(row: BoardRow): boolean {
  return !!(row.lineValue?.best && row.lineValue.best.edge >= 0.05);
}

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

/** How far a posted multiplier may sit from 1× before a "standard"-tagged rung is
 *  treated as a payout variant. Wide enough that a genuinely balanced 0.95×/1.05×
 *  line stays standard; DK's More-only specials run 0.6–0.8× and 1.2×+. */
const NORMAL_MULT_TOLERANCE = 0.1;

/**
 * Defense-in-depth against feed drift: a rung TAGGED as a plain line but carrying a
 * posted payout multiplier far from 1× — with no two-sided odds — is a payout variant
 * in disguise. (Early Pick6 ingests stored DK's highlighted More-only rung, e.g. a
 * 0.7× or 2.4× special, as 'standard': FireFactor then ignored the payout — the
 * breakeven stayed 0.5 — and the app could recommend an Under the book doesn't even
 * sell.) Normalizing at READ time also repairs rows already in the DB. Sided books
 * (Sleeper) are untouched: their standard lines carry two-sided odds.
 */
export function effectiveOddsType(v: {
  oddsType?: string | null;
  multiplier?: number | null;
  overOdds?: number | null;
  underOdds?: number | null;
}): string | null | undefined {
  if (
    payoutKind(v.oddsType) === 'normal' &&
    v.multiplier != null &&
    Math.abs(v.multiplier - 1) > NORMAL_MULT_TOLERANCE &&
    v.overOdds == null &&
    v.underOdds == null
  ) {
    return 'alternate';
  }
  return v.oddsType;
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

/**
 * The breakeven a rung is actually SCORED against, best information first:
 *   1. an exact posted multiplier (Underdog) — an exact breakeven;
 *   2. the MARKET-IMPLIED bar — de-vigged sportsbook odds at the rung's exact line
 *      (see marketImpliedBreakeven), kind-bounded because a payout can't beat the
 *      standard leg's: an easier line always pays less (goblin bar ≥ 0.5), a harder
 *      line always pays more (demon bar ≤ 0.5);
 *   3. the configured extremity-stepped approximation (ladderBreakeven).
 */
export function resolvedBreakeven(
  v: ProvidedVariant,
  ladder: ProvidedVariant[],
  quotes?: RungQuote[],
): number {
  const kind = payoutKind(v.oddsType);
  if (kind === 'normal') return 0.5;
  if (v.multiplier != null && v.multiplier > 0) return variantBreakeven(v.oddsType, v.multiplier);
  const market = quotes?.length
    ? marketImpliedBreakeven(quotes, v.line, normalLine(ladder))
    : null;
  if (market != null) {
    if (kind === 'goblin') return Math.max(0.5, market);
    if (kind === 'demon') return Math.min(0.5, market);
    return market;
  }
  return ladderBreakeven(v, ladder);
}

/** The breakeven to ECHO in the UI for a rung: the server-resolved bar its read was
 *  scored against when present, else the client-computable approximation. */
export function shownBreakeven(v: ProvidedVariant, ladder: ProvidedVariant[]): number {
  return v.breakeven ?? ladderBreakeven(v, ladder);
}

/** Decimal payout (total return per 1 unit staked) implied by American odds:
 *  +150 → 2.5, −200 → 1.5. */
export function decimalFromAmerican(odds: number): number {
  return odds > 0 ? odds / 100 + 1 : 100 / -odds + 1;
}

/**
 * Payout-implied breakeven PER SIDE for a rung that prices its two sides separately
 * (Sleeper's sided multipliers, sportsbook lines — stored as two-sided American odds):
 * 1/decimal payout of a side is the win rate a pick at that price needs to profit
 * (vig included — the bar you actually face, not the market's fair probability).
 * This is what makes FireFactor value-focused on these books: a 1.36× favorite must
 * clear a ~74% bar, while a 2.84× dog only needs ~35% — so a likely-but-poorly-paid
 * play no longer outscores a well-paid one by likelihood alone. Null when either
 * side is unpriced (PrizePicks/Underdog standard legs pay a flat table — their
 * relative 0.5 anchor is unchanged).
 */
export function sidedBreakevens(v: {
  overOdds?: number | null;
  underOdds?: number | null;
}): { over: number; under: number } | null {
  if (v.overOdds == null || v.underOdds == null) return null;
  const clamp = (x: number) => Math.max(0.05, Math.min(0.95, x));
  return {
    over: clamp(1 / decimalFromAmerican(v.overOdds)),
    under: clamp(1 / decimalFromAmerican(v.underOdds)),
  };
}

/**
 * The payout multiplier to DISPLAY for a rung given the side the read leans. Books that
 * price the two sides differently on a single line (Sleeper: e.g. over 1.62× / under
 * 1.98×, stored as over/under odds) should show the LEANED side's payout, not always
 * the over. Detected by "posts a multiplier AND carries both odds"; every other rung
 * (Underdog/Pick6 alternates, plain lines) just returns its posted multiplier.
 */
export function sidedMultiplier(
  v: { multiplier: number | null; overOdds?: number | null; underOdds?: number | null },
  side: 'over' | 'under',
): number | null {
  if (v.multiplier != null && v.overOdds != null && v.underOdds != null) {
    const odds = side === 'over' ? v.overOdds : v.underOdds;
    if (odds != null) return decimalFromAmerican(odds);
  }
  return v.multiplier;
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
