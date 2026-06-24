import { describe, it, expect } from 'vitest';
import { profitPerDollar, evPerDollar, fairPriceReadout } from './fairPrice';

describe('profitPerDollar', () => {
  it('plus odds', () => {
    expect(profitPerDollar(150)).toBeCloseTo(1.5, 10);
  });
  it('minus odds', () => {
    expect(profitPerDollar(-110)).toBeCloseTo(100 / 110, 10);
  });
});

describe('evPerDollar', () => {
  it('is positive when the win prob beats the break-even', () => {
    expect(evPerDollar(0.6, -110)).toBeGreaterThan(0); // break-even ~0.524
  });
  it('is ~0 at the break-even probability', () => {
    expect(evPerDollar(110 / 210, -110)).toBeCloseTo(0, 6);
  });
});

describe('fairPriceReadout — break-even + EV', () => {
  it('emits break-even and EV when over odds + hit rate are present', () => {
    const r = fairPriceReadout({ overOdds: -110, historicalHitRateOver: 0.6 });
    expect(r.breakEvenOver!).toBeCloseTo(110 / 210, 6);
    expect(r.evPerDollarOver!).toBeGreaterThan(0);
  });
  it('null EV without a hit rate (break-even still set from the price)', () => {
    const r = fairPriceReadout({ overOdds: -110 });
    expect(r.evPerDollarOver).toBeNull();
    expect(r.breakEvenOver!).toBeCloseTo(110 / 210, 6);
  });
});
