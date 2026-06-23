import { describe, it, expect } from 'vitest';
import {
  americanToImplied,
  impliedToAmerican,
  deVigTwoWay,
  edge,
  fairPriceReadout,
} from './fairPrice';

describe('americanToImplied', () => {
  it('underdog (+) odds', () => {
    expect(americanToImplied(150)).toBeCloseTo(0.4, 10); // 100/250
    expect(americanToImplied(100)).toBeCloseTo(0.5, 10);
  });
  it('favorite (−) odds', () => {
    expect(americanToImplied(-150)).toBeCloseTo(0.6, 10); // 150/250
    expect(americanToImplied(-110)).toBeCloseTo(110 / 210, 10);
    expect(americanToImplied(-200)).toBeCloseTo(200 / 300, 10);
  });
  it('throws on 0 / non-finite', () => {
    expect(() => americanToImplied(0)).toThrow();
    expect(() => americanToImplied(NaN)).toThrow();
  });
});

describe('impliedToAmerican', () => {
  it('inverts americanToImplied', () => {
    expect(impliedToAmerican(0.6)).toBe(-150);
    expect(impliedToAmerican(0.4)).toBe(150);
    expect(impliedToAmerican(0.5)).toBe(100); // even money
    expect(impliedToAmerican(americanToImplied(-110))).toBe(-110);
  });
  it('throws on probabilities outside (0,1)', () => {
    expect(() => impliedToAmerican(0)).toThrow();
    expect(() => impliedToAmerican(1)).toThrow();
    expect(() => impliedToAmerican(1.2)).toThrow();
  });
});

describe('deVigTwoWay', () => {
  it('two -110 sides => fair 50/50', () => {
    const i = americanToImplied(-110);
    const dv = deVigTwoWay(i, i);
    expect(dv.fairOver).toBeCloseTo(0.5, 10);
    expect(dv.fairUnder).toBeCloseTo(0.5, 10);
    expect(dv.overround).toBeCloseTo(2 * (110 / 210), 10); // ~1.0476
  });

  it('removes vig proportionally for mixed-sign odds', () => {
    const over = americanToImplied(-200); // 0.6667
    const under = americanToImplied(170); // 0.3704
    const dv = deVigTwoWay(over, under);
    expect(dv.fairOver + dv.fairUnder).toBeCloseTo(1, 10);
    expect(dv.fairOver).toBeCloseTo(over / (over + under), 10);
  });
});

describe('edge', () => {
  it('history minus reference probability', () => {
    expect(edge(0.6, 0.5)).toBeCloseTo(0.1, 10);
    expect(edge(0.45, 0.5)).toBeCloseTo(-0.05, 10);
  });
});

describe('fairPriceReadout', () => {
  it('both sides entered => de-vig, fair american, edge vs fair', () => {
    const r = fairPriceReadout({
      overOdds: -110,
      underOdds: -110,
      historicalHitRateOver: 0.6,
    });
    expect(r.impliedOver).toBeCloseTo(110 / 210, 10);
    expect(r.fairOver).toBeCloseTo(0.5, 10);
    expect(r.fairUnder).toBeCloseTo(0.5, 10);
    expect(r.referenceProbOver).toBeCloseTo(0.5, 10);
    expect(r.fairAmericanOver).toBe(100);
    expect(r.edge).toBeCloseTo(0.1, 10);
  });

  it('only over odds => edge vs single-side implied prob', () => {
    const r = fairPriceReadout({ overOdds: 150, historicalHitRateOver: 0.5 });
    expect(r.impliedOver).toBeCloseTo(0.4, 10);
    expect(r.impliedUnder).toBeNull();
    expect(r.fairOver).toBeNull();
    expect(r.referenceProbOver).toBeCloseTo(0.4, 10);
    expect(r.fairAmericanOver).toBe(150);
    expect(r.edge).toBeCloseTo(0.1, 10);
  });

  it('no odds => no implied/fair/edge', () => {
    const r = fairPriceReadout({ historicalHitRateOver: 0.6 });
    expect(r.impliedOver).toBeNull();
    expect(r.referenceProbOver).toBeNull();
    expect(r.edge).toBeNull();
  });

  it('odds but no history => fair price without an edge', () => {
    const r = fairPriceReadout({ overOdds: -110, underOdds: -110 });
    expect(r.fairOver).toBeCloseTo(0.5, 10);
    expect(r.edge).toBeNull();
  });
});
