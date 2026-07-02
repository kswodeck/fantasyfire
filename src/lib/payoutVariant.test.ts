import { describe, it, expect } from 'vitest';
import {
  payoutKind,
  isOverOnly,
  variantBreakeven,
  variantRank,
  ladderBreakeven,
  pickRepresentative,
} from './payoutVariant';
import { PP_BREAKEVEN_STEPS } from './ppPayouts';
import type { ProvidedVariant } from './types';

function rung(line: number, oddsType: string | null, multiplier: number | null = null): ProvidedVariant {
  return { source: 'prizepicks', line, oddsType, multiplier, overOdds: null, underOdds: null };
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
