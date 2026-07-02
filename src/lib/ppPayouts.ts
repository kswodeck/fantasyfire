// PrizePicks payout reference — STATIC, editorial data for the explainer UI.
// PrizePicks doesn't ship per-line multipliers through the API (unlike Underdog),
// so this is a hand-maintained summary of their published payout structure.
// VERIFY against the PrizePicks app when updating — these change over time and can
// vary by state/promo; the UI frames them as "typical" for exactly that reason.

/** Power Play (every pick must hit): entry size → payout multiple. */
export const PP_POWER_PLAY: ReadonlyArray<{ picks: number; pays: number }> = [
  { picks: 2, pays: 3 },
  { picks: 3, pays: 5 },
  { picks: 4, pays: 10 },
];

/** Flex Play (partial misses still pay): entry size → payout multiples. */
export const PP_FLEX_PLAY: ReadonlyArray<{ picks: number; allHit: number; oneMiss: number; twoMiss?: number }> = [
  { picks: 3, allHit: 2.25, oneMiss: 1.25 },
  { picks: 4, allHit: 5, oneMiss: 1.5 },
  { picks: 5, allHit: 10, oneMiss: 2, twoMiss: 0.4 },
  { picks: 6, allHit: 25, oneMiss: 2, twoMiss: 0.4 },
];

/**
 * Approximate per-leg BREAKEVEN probabilities for PrizePicks variants — the anchor
 * FireFactor scores a variant against (0 = fairly priced for its payout) — STEPPED BY
 * EXTREMITY, because PrizePicks prices each rung individually: the further a goblin
 * sits below the standard line (the easier it is), the less it pays, so the higher
 * the bar it must clear; demons mirror the other way (harder line → bigger payout →
 * lower bar). Index 0 = the rung nearest the standard line; ladders deeper than the
 * table reuse the last entry.
 *
 * Convention: the standard line is anchored at 0.5 (FireFactor's long-standing
 * neutral point), and a variant's anchor scales by the payout it buys relative to a
 * standard leg: breakeven ≈ 0.5 × (standard payout / variant payout). PrizePicks
 * ships NO per-line payout numbers through its API, so these are hand-derived from
 * the published payout-table adjustments — TUNE THEM alongside the tables above when
 * PrizePicks changes payouts; the UI presents them as approximate. Underdog needs no
 * entry here: its exact per-line multipliers give exact breakevens (0.5/multiplier).
 */
export const PP_BREAKEVEN_STEPS: Readonly<Record<'demon' | 'goblin', readonly number[]>> = {
  // Nearest goblin ≈ a mild discount; the deepest (easiest) goblins pay the least.
  goblin: [0.7, 0.78, 0.85],
  // Nearest demon ≈ a mild boost; the deepest (hardest) demons pay the most.
  demon: [0.38, 0.32, 0.27],
};

/** How demons/goblins bend those tables — qualitative, since the app computes the
 *  exact adjusted payout per entry. */
export const PP_DEMON_RULE =
  'Adding a demon raises the whole entry’s payout multiple (a harder line buys a bigger multiplier). Demons can only be taken as More.';
export const PP_GOBLIN_RULE =
  'Adding a goblin lowers the whole entry’s payout multiple (an easier line costs payout). Goblins can only be taken as More and aren’t combinable with everything — the app shows the exact adjusted payout.';
