import { describe, it, expect } from 'vitest';
import { noVigOver, marketConsensus, type BookQuote } from './marketConsensus';
import { americanToImplied } from './fairPrice';

describe('noVigOver', () => {
  it('removes the vig from a symmetric two-way market (−110/−110 ⇒ 0.5)', () => {
    expect(noVigOver(-110, -110)).toBeCloseTo(0.5, 9);
  });
  it('null when a side is missing', () => {
    expect(noVigOver(-110, null)).toBeNull();
    expect(noVigOver(null, -110)).toBeNull();
  });
  it('favors the side with the shorter price', () => {
    const p = noVigOver(-200, +160)!; // over is the favorite
    expect(p).toBeGreaterThan(0.5);
  });
});

describe('marketConsensus', () => {
  const quotes: BookQuote[] = [
    { source: 'draftkings', line: 24.5, overOdds: -115, underOdds: -105 },
    { source: 'fanduel', line: 24.5, overOdds: -110, underOdds: -110 },
    { source: 'betmgm', line: 24.5, overOdds: -120, underOdds: +100 },
    { source: 'caesars', line: 25.5, overOdds: +100, underOdds: -120 }, // different line — excluded
  ];

  it('computes consensus at the modal line and counts only same-line two-sided books', () => {
    const c = marketConsensus(quotes, 24.5)!;
    expect(c.line).toBe(24.5);
    expect(c.bookCount).toBe(3); // the 25.5 book is excluded
    expect(c.fairProbOver).toBeGreaterThan(0);
    expect(c.fairProbOver! + c.fairProbUnder!).toBeCloseTo(1, 9);
  });

  it('picks the best (highest-payout) price for each side', () => {
    const c = marketConsensus(quotes, 24.5)!;
    // Best over price among {-115,-110,-120} is -110 (FanDuel); best under among
    // {-105,-110,+100} is +100 (BetMGM).
    expect(c.bestOver?.source).toBe('fanduel');
    expect(c.bestOver?.odds).toBe(-110);
    expect(c.bestUnder?.source).toBe('betmgm');
    expect(c.bestUnder?.odds).toBe(100);
  });

  it('flags +EV when a book pays better than the no-vig consensus', () => {
    // One book offering a generous +120 over vs a market that fairly prices it ~ -110.
    const generous: BookQuote[] = [
      { source: 'a', line: 10.5, overOdds: -110, underOdds: -110 },
      { source: 'b', line: 10.5, overOdds: -110, underOdds: -110 },
      { source: 'c', line: 10.5, overOdds: +120, underOdds: -140 },
    ];
    const c = marketConsensus(generous)!;
    expect(c.bestOver?.source).toBe('c');
    expect(c.bestOver?.evPerDollar).toBeGreaterThan(0); // +120 beats a ~0.5 fair prob
  });

  it('returns a consensus even with one-sided books, but no fair prob', () => {
    const oneSided: BookQuote[] = [
      { source: 'a', line: 5.5, overOdds: -130, underOdds: null },
      { source: 'b', line: 5.5, overOdds: -125, underOdds: null },
    ];
    expect(marketConsensus(oneSided)).toBeNull(); // no two-sided book ⇒ no market line
  });

  it('null when there are no quotes', () => {
    expect(marketConsensus([])).toBeNull();
  });

  it('consensus over prob matches a hand de-vig for a single book', () => {
    const single: BookQuote[] = [{ source: 'a', line: 1.5, overOdds: -150, underOdds: +130 }];
    const c = marketConsensus(single)!;
    const io = americanToImplied(-150);
    const iu = americanToImplied(+130);
    expect(c.fairProbOver).toBeCloseTo(io / (io + iu), 9);
  });
});
