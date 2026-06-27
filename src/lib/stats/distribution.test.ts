import { describe, it, expect } from 'vitest';
import {
  normalCdf,
  normalLineProbabilities,
  countLineProbabilities,
  lineProbabilities,
  statFamily,
} from './distribution';

describe('normalCdf', () => {
  it('matches known standard-normal values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
});

describe('normalLineProbabilities', () => {
  it('is a coin flip when the line sits on the mean', () => {
    const p = normalLineProbabilities(25, 5, 25);
    expect(p.over).toBeCloseTo(0.5, 6);
    expect(p.under).toBeCloseTo(0.5, 6);
    expect(p.push).toBe(0);
  });

  it('decreases the over probability as the line rises', () => {
    const lo = normalLineProbabilities(250, 40, 230).over;
    const hi = normalLineProbabilities(250, 40, 280).over;
    expect(lo).toBeGreaterThan(hi);
    expect(lo + normalLineProbabilities(250, 40, 230).under).toBeCloseTo(1, 9);
  });
});

describe('countLineProbabilities', () => {
  it('matches Poisson when variance equals mean (half-point line)', () => {
    // Poisson(2): P(X >= 1) = 1 - e^-2 ≈ 0.8647.
    const p = countLineProbabilities(2, 2, 0.5);
    expect(p.over).toBeCloseTo(1 - Math.exp(-2), 4);
    expect(p.push).toBe(0);
  });

  it('exposes the push mass on an integer line (Poisson)', () => {
    // Poisson(2): P(X = 2) = e^-2 · 2 ≈ 0.2707.
    const p = countLineProbabilities(2, 2, 2);
    expect(p.push).toBeCloseTo(Math.exp(-2) * 2, 4);
    expect(p.over + p.under + p.push).toBeCloseTo(1, 9);
  });

  it('gives a wider (overdispersed) tail than Poisson for the same mean', () => {
    const line = 6.5;
    const poisson = countLineProbabilities(3, 3, line).over;
    const negBinom = countLineProbabilities(3, 6, line).over; // variance > mean
    expect(negBinom).toBeGreaterThan(poisson); // streaky players clear high lines more often
  });

  it('always returns a normalized distribution', () => {
    for (const [m, v, line] of [
      [1, 1, 0.5],
      [10, 25, 9.5],
      [0.4, 0.6, 0.5],
      [30, 40, 27],
    ]) {
      const p = countLineProbabilities(m, v, line);
      expect(p.over + p.under + p.push).toBeCloseTo(1, 6);
      expect(p.over).toBeGreaterThanOrEqual(0);
      expect(p.under).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles a zero mean without NaN', () => {
    const p = countLineProbabilities(0, 0, 0.5);
    expect(p.over).toBe(0);
    expect(p.under).toBe(1);
  });
});

describe('lineProbabilities dispatch', () => {
  it('routes yardage stats to the continuous model', () => {
    expect(statFamily('passYds')).toBe('continuous');
    expect(statFamily('pts')).toBe('count');
    const p = lineProbabilities('recYds', 60, 20, 60);
    expect(p?.over).toBeCloseTo(0.5, 6);
  });

  it('returns null with no projection', () => {
    expect(lineProbabilities('pts', null, 5, 20)).toBeNull();
  });
});
