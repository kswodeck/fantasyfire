import { describe, it, expect } from 'vitest';
import { marketFairProbAt, marketImpliedBreakeven, type RungQuote } from './marketBreakeven';
import { americanToImplied, deVigTwoWay } from './fairPrice';

function quote(line: number, overOdds: number | null, underOdds: number | null): RungQuote {
  return { line, overOdds, underOdds };
}

/** The exact de-vigged P(over) for one two-sided quote — the oracle the tests check. */
function fairOver(overOdds: number, underOdds: number): number {
  return deVigTwoWay(americanToImplied(overOdds), americanToImplied(underOdds)).fairOver;
}

describe('marketFairProbAt', () => {
  it('de-vigs a single book at the exact line', () => {
    const p = marketFairProbAt([quote(0.5, -250, +190)], 0.5);
    expect(p).toBeCloseTo(fairOver(-250, +190), 10);
    // A -250/+190 favorite is roughly a 71/29 market before the vig comes out.
    expect(p!).toBeGreaterThan(0.65);
    expect(p!).toBeLessThan(0.75);
  });

  it('takes the median across books at the same line', () => {
    const quotes = [quote(1.5, -120, -110), quote(1.5, -110, -120), quote(1.5, -115, -115)];
    expect(marketFairProbAt(quotes, 1.5)).toBeCloseTo(0.5, 10); // the -115/-115 midpoint
  });

  it('ignores quotes at OTHER lines and one-sided quotes', () => {
    const quotes = [
      quote(1.5, -300, +240), // different line — not commensurable
      quote(0.5, -200, null), // one-sided — can't de-vig
    ];
    expect(marketFairProbAt(quotes, 0.5)).toBeNull();
  });
});

describe('marketImpliedBreakeven', () => {
  it("a goblin rung's bar is the market's fair P(over) at that exact line", () => {
    // Books quote over 0.5 at -250/+190 → ~71% fair. That IS the goblin bar.
    const quotes = [quote(0.5, -250, +190)];
    const bar = marketImpliedBreakeven(quotes, 0.5, 1.5)!;
    expect(bar).toBeCloseTo(fairOver(-250, +190), 10);
  });

  it('rescales by the standard line when books quote that too', () => {
    // Standard line quoted at 55% fair (not exactly the book's 0.5 anchor): the
    // rung bar scales by 0.5/0.55 so the standard line still defines the 0.5 anchor.
    const quotes = [quote(0.5, -250, +190), quote(1.5, -122.22, +100)];
    const pRung = fairOver(-250, +190);
    const pStd = fairOver(-122.22, +100);
    const bar = marketImpliedBreakeven(quotes, 0.5, 1.5)!;
    expect(bar).toBeCloseTo(pRung * (0.5 / pStd), 6);
    expect(bar).toBeLessThan(pRung); // pStd > 0.5 → the bar relaxes
  });

  it('returns null when no book quotes the rung line', () => {
    expect(marketImpliedBreakeven([quote(1.5, -110, -110)], 0.5, 1.5)).toBeNull();
    expect(marketImpliedBreakeven([], 0.5, 1.5)).toBeNull();
  });

  it('clamps to a sane probability band', () => {
    const heavy = marketImpliedBreakeven([quote(0.5, -10000, +2500)], 0.5, null)!;
    expect(heavy).toBeLessThanOrEqual(0.95);
    expect(heavy).toBeGreaterThanOrEqual(0.05);
  });
});
