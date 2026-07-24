import { describe, it, expect } from 'vitest';
import {
  payoutKind,
  isOverOnly,
  variantBreakeven,
  variantRank,
  ladderBreakeven,
  resolvedBreakeven,
  effectiveOddsType,
  shownBreakeven,
  decimalFromAmerican,
  sidedBreakevens,
  sidedMultiplier,
  pickRepresentative,
  qualifyingSpecialHint,
  hasLineValueHint,
} from './payoutVariant';
import { PP_BREAKEVEN_STEPS } from './ppPayouts';
import type { BoardRow, ProvidedVariant } from './types';
import type { FireSide, FireTier } from './stats';

function rung(line: number, oddsType: string | null, multiplier: number | null = null): ProvidedVariant {
  return { source: 'prizepicks', line, oddsType, multiplier, overOdds: null, underOdds: null };
}

/** A variant carrying a read — for the hint helpers. */
function scoredRung(oddsType: string | null, score: number, side: FireSide = 'over'): ProvidedVariant {
  return {
    ...rung(1.5, oddsType),
    read: { side, score, tier: 'Lean' as FireTier },
  };
}

/** Minimal BoardRow with just the fields the hint helpers read. */
function boardRow(opts: {
  score?: number;
  variants?: ProvidedVariant[];
  lineValue?: BoardRow['lineValue'];
}): BoardRow {
  return {
    rank: 1,
    player: {} as BoardRow['player'],
    stat: 'points' as BoardRow['stat'],
    statShort: 'PTS',
    line: 24.5,
    projection: null,
    fireScore: { score: opts.score ?? 50 } as BoardRow['fireScore'],
    lineValue: opts.lineValue ?? null,
    variants: opts.variants,
  };
}

describe('variantBreakeven', () => {
  it('anchors standard lines at the plain 0.5', () => {
    expect(variantBreakeven('standard', null)).toBe(0.5);
    expect(variantBreakeven(null, null)).toBe(0.5);
    expect(variantBreakeven('balanced', 1)).toBe(0.5);
  });

  it('an exact posted multiplier wins over the kind config (Underdog)', () => {
    expect(variantBreakeven('alternate', 1.25)).toBeCloseTo(0.4, 10);
    expect(variantBreakeven('alternate', 0.71)).toBeCloseTo(0.5 / 0.71, 10);
  });

  it('steps PrizePicks kinds by extremity rank, clamped to the table', () => {
    expect(variantBreakeven('goblin', null, 0)).toBe(PP_BREAKEVEN_STEPS.goblin[0]);
    expect(variantBreakeven('goblin', null, 1)).toBe(PP_BREAKEVEN_STEPS.goblin[1]);
    expect(variantBreakeven('goblin', null, 99)).toBe(
      PP_BREAKEVEN_STEPS.goblin[PP_BREAKEVEN_STEPS.goblin.length - 1],
    );
    expect(variantBreakeven('demon', null, 0)).toBe(PP_BREAKEVEN_STEPS.demon[0]);
    // Deeper goblins face a HIGHER bar (they pay less); deeper demons a LOWER one.
    expect(PP_BREAKEVEN_STEPS.goblin[1]).toBeGreaterThan(PP_BREAKEVEN_STEPS.goblin[0]);
    expect(PP_BREAKEVEN_STEPS.demon[1]).toBeLessThan(PP_BREAKEVEN_STEPS.demon[0]);
  });
});

describe('variantRank / ladderBreakeven', () => {
  // Standard 25.5 with two goblins below and two demons above.
  const ladder = [
    rung(19.5, 'goblin'),
    rung(22.5, 'goblin'),
    rung(25.5, 'standard'),
    rung(28.5, 'demon'),
    rung(32.5, 'demon'),
  ];

  it('ranks rungs by distance from the standard line, 0 = mildest', () => {
    expect(variantRank(ladder[1], ladder)).toBe(0); // 22.5 — nearest goblin
    expect(variantRank(ladder[0], ladder)).toBe(1); // 19.5 — deeper goblin
    expect(variantRank(ladder[3], ladder)).toBe(0); // 28.5 — nearest demon
    expect(variantRank(ladder[4], ladder)).toBe(1); // 32.5 — deeper demon
    expect(variantRank(ladder[2], ladder)).toBe(0); // standard
  });

  it('gives the mild goblin an easier bar than the deep goblin', () => {
    const mild = ladderBreakeven(ladder[1], ladder);
    const deep = ladderBreakeven(ladder[0], ladder);
    expect(mild).toBe(PP_BREAKEVEN_STEPS.goblin[0]);
    expect(deep).toBe(PP_BREAKEVEN_STEPS.goblin[1]);
    expect(deep).toBeGreaterThan(mild);
  });

  it('gives the deep demon an easier bar than the mild demon (it pays more)', () => {
    const mild = ladderBreakeven(ladder[3], ladder);
    const deep = ladderBreakeven(ladder[4], ladder);
    expect(deep).toBeLessThan(mild);
  });

  it('still prefers the standard rung as the representative', () => {
    expect(pickRepresentative(ladder, null)?.line).toBe(25.5);
  });

  it('isOverOnly: only the standard line takes an under', () => {
    expect(isOverOnly('standard')).toBe(false);
    expect(isOverOnly('goblin')).toBe(true);
    expect(isOverOnly('demon')).toBe(true);
    expect(isOverOnly('alternate')).toBe(true);
    expect(payoutKind('balanced')).toBe('normal');
  });
});

describe('resolvedBreakeven', () => {
  // Standard 1.5 with a goblin at 0.5 and a demon at 2.5 (the TB-ladder shape).
  const ladder = [rung(0.5, 'goblin'), rung(1.5, 'standard'), rung(2.5, 'demon')];
  // A book quoting over 0.5 at -250/+190 → ~71% de-vigged.
  const quotes = [{ line: 0.5, overOdds: -250, underOdds: 190 }];

  it('standard lines stay at 0.5 regardless of quotes', () => {
    expect(resolvedBreakeven(ladder[1], ladder, quotes)).toBe(0.5);
  });

  it('an exact posted multiplier beats the market read', () => {
    const alt = rung(0.5, 'alternate', 1.25);
    expect(resolvedBreakeven(alt, ladder, quotes)).toBeCloseTo(0.4, 10);
  });

  it('uses the MARKET-IMPLIED bar when a book quotes the rung line', () => {
    const bar = resolvedBreakeven(ladder[0], ladder, quotes);
    expect(bar).not.toBe(ladderBreakeven(ladder[0], ladder)); // not the config step
    expect(bar).toBeGreaterThan(0.65);
    expect(bar).toBeLessThan(0.75); // ≈ the de-vigged -250/+190
  });

  it('falls back to the configured steps without a matching quote', () => {
    expect(resolvedBreakeven(ladder[2], ladder, quotes)).toBe(ladderBreakeven(ladder[2], ladder));
    expect(resolvedBreakeven(ladder[0], ladder, [])).toBe(ladderBreakeven(ladder[0], ladder));
    expect(resolvedBreakeven(ladder[0], ladder)).toBe(ladderBreakeven(ladder[0], ladder));
  });

  it('kind-bounds a market bar at the standard leg (goblin ≥ 0.5, demon ≤ 0.5)', () => {
    // Nonsense market says the goblin line is a 40% shot — a goblin still can't pay
    // BETTER than a standard leg, so its bar floors at 0.5.
    const dogQuotes = [{ line: 0.5, overOdds: 150, underOdds: -190 }];
    expect(resolvedBreakeven(ladder[0], ladder, dogQuotes)).toBe(0.5);
    const demonQuotes = [{ line: 2.5, overOdds: -190, underOdds: 150 }];
    expect(resolvedBreakeven(ladder[2], ladder, demonQuotes)).toBe(0.5);
  });

  it('shownBreakeven echoes a server-resolved bar and falls back to the approximation', () => {
    expect(shownBreakeven({ ...ladder[0], breakeven: 0.71 }, ladder)).toBe(0.71);
    expect(shownBreakeven(ladder[0], ladder)).toBe(ladderBreakeven(ladder[0], ladder));
  });
});

describe('decimalFromAmerican', () => {
  it('converts underdog (+) and favorite (−) American odds to decimal payouts', () => {
    expect(decimalFromAmerican(150)).toBeCloseTo(2.5, 10);
    expect(decimalFromAmerican(100)).toBeCloseTo(2, 10);
    expect(decimalFromAmerican(-200)).toBeCloseTo(1.5, 10);
    expect(decimalFromAmerican(-110)).toBeCloseTo(1.909, 3);
  });
});

describe('sidedMultiplier', () => {
  // A Sleeper standard line: over 1.62× / under 1.98× stored as American odds.
  const twoWay = { multiplier: 1.62, overOdds: -161, underOdds: -102 };

  it('shows the leaned side’s payout for a two-way priced line', () => {
    expect(sidedMultiplier(twoWay, 'over')).toBeCloseTo(1.62, 2);
    expect(sidedMultiplier(twoWay, 'under')).toBeCloseTo(1.98, 2);
  });

  it('returns the posted multiplier when a side is not separately priced', () => {
    // Underdog/Pick6 alternate: multiplier but no two-sided odds.
    expect(sidedMultiplier({ multiplier: 1.31, overOdds: null, underOdds: null }, 'over')).toBe(1.31);
    // Plain line with no multiplier at all.
    expect(sidedMultiplier({ multiplier: null, overOdds: -110, underOdds: -110 }, 'over')).toBeNull();
  });
});

describe('sidedBreakevens', () => {
  it('derives each side’s payout-implied breakeven from two-sided odds (vig included)', () => {
    // Sleeper-style: over 1.36× (−278) / under 2.84× (+184).
    const b = sidedBreakevens({ overOdds: -278, underOdds: 184 })!;
    expect(b.over).toBeCloseTo(1 / decimalFromAmerican(-278), 10); // ≈ 0.735
    expect(b.under).toBeCloseTo(1 / decimalFromAmerican(184), 10); // ≈ 0.352
    // The two bars sum past 1 — that overround IS the vig the player faces.
    expect(b.over + b.under).toBeGreaterThan(1);
  });

  it('returns null when either side is unpriced (flat-payout pick’em legs)', () => {
    expect(sidedBreakevens({ overOdds: null, underOdds: null })).toBeNull();
    expect(sidedBreakevens({ overOdds: -110, underOdds: null })).toBeNull();
    expect(sidedBreakevens({})).toBeNull();
  });

  it('clamps extreme prices into the FireFactor benchmark range', () => {
    const b = sidedBreakevens({ overOdds: -10000, underOdds: 5000 })!;
    expect(b.over).toBeLessThanOrEqual(0.95);
    expect(b.under).toBeGreaterThanOrEqual(0.05);
  });
});

describe('effectiveOddsType', () => {
  it('reclassifies a "standard" rung whose posted multiplier is far from 1× (no odds)', () => {
    // Legacy Pick6 rows: DK's More-only default at 0.7× / 2.4× stored as standard.
    expect(effectiveOddsType({ oddsType: 'standard', multiplier: 0.7 })).toBe('alternate');
    expect(effectiveOddsType({ oddsType: 'standard', multiplier: 2.4 })).toBe('alternate');
  });

  it('keeps genuinely balanced lines standard', () => {
    expect(effectiveOddsType({ oddsType: 'standard', multiplier: null })).toBe('standard');
    expect(effectiveOddsType({ oddsType: 'standard', multiplier: 1 })).toBe('standard');
    expect(effectiveOddsType({ oddsType: 'balanced', multiplier: 1.04 })).toBe('balanced');
    expect(effectiveOddsType({ oddsType: 'standard', multiplier: 0.95 })).toBe('standard');
  });

  it('never touches sided books (two-sided odds present) or explicit variants', () => {
    // Sleeper: standard line with sided odds and a riding multiplier.
    expect(
      effectiveOddsType({ oddsType: 'standard', multiplier: 1.62, overOdds: -161, underOdds: 140 }),
    ).toBe('standard');
    expect(effectiveOddsType({ oddsType: 'demon', multiplier: null })).toBe('demon');
    expect(effectiveOddsType({ oddsType: 'alternate', multiplier: 1.31 })).toBe('alternate');
  });

  it('the reclassified rung scores like the alternate it really is', () => {
    // 0.7× → needs ~71% to break even; 2.4× → ~21% — and both become over-only.
    expect(variantBreakeven('alternate', 0.7)).toBeCloseTo(0.5 / 0.7, 10);
    expect(variantBreakeven('alternate', 2.4)).toBeCloseTo(0.5 / 2.4, 10);
    expect(isOverOnly(effectiveOddsType({ oddsType: 'standard', multiplier: 0.7 }))).toBe(true);
  });
});

describe('qualifyingSpecialHint', () => {
  it('returns the strongest special rung that clears Slight AND beats the default score', () => {
    const row = boardRow({
      score: 50,
      variants: [
        rung(1.5, 'standard'), // no read → ignored
        scoredRung('goblin', 62),
        scoredRung('demon', 71),
      ],
    });
    const hint = qualifyingSpecialHint(row);
    expect(hint?.score).toBe(71); // the higher-scoring special
    expect(hint?.variant.oddsType).toBe('demon');
  });

  it('is null when no variants / no special rung has a read', () => {
    expect(qualifyingSpecialHint(boardRow({}))).toBeNull();
    expect(qualifyingSpecialHint(boardRow({ variants: [rung(1.5, 'goblin')] }))).toBeNull();
  });

  it('is null when the best special does not beat the default line score', () => {
    const row = boardRow({ score: 80, variants: [scoredRung('goblin', 62)] });
    expect(qualifyingSpecialHint(row)).toBeNull();
  });

  it('is null when the best special is below the Slight cutoff (20)', () => {
    const row = boardRow({ score: 10, variants: [scoredRung('goblin', 15)] });
    expect(qualifyingSpecialHint(row)).toBeNull();
  });

  it('ignores normal-kind variants even when they carry a read', () => {
    const row = boardRow({ score: 30, variants: [scoredRung('standard', 90)] });
    expect(qualifyingSpecialHint(row)).toBeNull();
  });
});

describe('hasLineValueHint', () => {
  it('is true only when a best cross-book edge clears 5 points', () => {
    expect(hasLineValueHint(boardRow({ lineValue: { edge: 0.08, best: { source: 'dk', line: 1.5, edge: 0.08 } } }))).toBe(true);
    expect(hasLineValueHint(boardRow({ lineValue: { edge: 0.04, best: { source: 'dk', line: 1.5, edge: 0.04 } } }))).toBe(false);
  });

  it('is false when there is no line-value comparison', () => {
    expect(hasLineValueHint(boardRow({}))).toBe(false);
    expect(hasLineValueHint(boardRow({ lineValue: { edge: 0.1, best: null } }))).toBe(false);
  });
});
