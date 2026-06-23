import { describe, it, expect } from 'vitest';
import { wilsonInterval, confidenceBadge, hitRateConfidence } from './confidence';

describe('wilsonInterval', () => {
  it('matches hand-computed values for 8/10 (z=1.96)', () => {
    const w = wilsonInterval(8, 10);
    expect(w.pHat).toBeCloseTo(0.8, 10);
    expect(w.center).toBeCloseTo(0.7167, 3);
    expect(w.lower).toBeCloseTo(0.4902, 3);
    expect(w.upper).toBeCloseTo(0.9433, 3);
    expect(w.width).toBeCloseTo(0.4532, 3);
  });

  it('n=0 => maximally uncertain [0,1]', () => {
    const w = wilsonInterval(0, 0);
    expect(w.lower).toBe(0);
    expect(w.upper).toBe(1);
    expect(w.width).toBe(1);
    expect(w.pHat).toBe(0.5);
  });

  it('clamps within [0,1] for extreme proportions', () => {
    const w = wilsonInterval(5, 5); // pHat = 1
    expect(w.upper).toBeLessThanOrEqual(1);
    expect(w.lower).toBeGreaterThanOrEqual(0);
    expect(w.lower).toBeGreaterThan(0.5); // 5/5 should still be confidently > 0.5
  });

  it('narrower interval for larger n at the same proportion', () => {
    const small = wilsonInterval(4, 5); // 0.8
    const large = wilsonInterval(80, 100); // 0.8
    expect(large.width).toBeLessThan(small.width);
  });
});

describe('confidenceBadge thresholds', () => {
  it('width < 0.25 => High', () => {
    expect(confidenceBadge(0.0)).toBe('High');
    expect(confidenceBadge(0.24)).toBe('High');
  });
  it('0.25 <= width < 0.45 => Medium', () => {
    expect(confidenceBadge(0.25)).toBe('Medium');
    expect(confidenceBadge(0.44)).toBe('Medium');
  });
  it('width >= 0.45 => Low', () => {
    expect(confidenceBadge(0.45)).toBe('Low');
    expect(confidenceBadge(1)).toBe('Low');
  });
});

describe('hitRateConfidence', () => {
  it('90/100 is a High-confidence cell', () => {
    const c = hitRateConfidence(90, 100);
    expect(c.interval.width).toBeCloseTo(0.1191, 3);
    expect(c.badge).toBe('High');
  });

  it('15/20 is a Medium-confidence cell', () => {
    const c = hitRateConfidence(15, 20);
    expect(c.interval.width).toBeCloseTo(0.3568, 3);
    expect(c.badge).toBe('Medium');
  });

  it('a 4/5 streak is honestly Low confidence', () => {
    const c = hitRateConfidence(4, 5);
    expect(c.badge).toBe('Low');
  });
});
