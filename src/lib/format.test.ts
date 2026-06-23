import { describe, it, expect } from 'vitest';
import {
  pct,
  num1,
  ordinal,
  signed,
  americanOdds,
  roundToHalf,
  roundToHalfLine,
} from './format';

describe('pct', () => {
  it('formats probabilities and handles null', () => {
    expect(pct(0.6)).toBe('60%');
    expect(pct(0.666, 1)).toBe('66.6%');
    expect(pct(null)).toBe('—');
    expect(pct(undefined)).toBe('—');
  });
});

describe('num1', () => {
  it('rounds to one decimal; null -> dash', () => {
    expect(num1(6.78)).toBe('6.8');
    expect(num1(null)).toBe('—');
  });
});

describe('ordinal', () => {
  it('handles common and teen cases', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(23)).toBe('23rd');
    expect(ordinal(30)).toBe('30th');
  });
});

describe('signed / americanOdds / roundToHalf', () => {
  it('signed', () => {
    expect(signed(3.2)).toBe('+3.2');
    expect(signed(-1)).toBe('-1.0');
  });
  it('americanOdds', () => {
    expect(americanOdds(150)).toBe('+150');
    expect(americanOdds(-110)).toBe('-110');
  });
  it('roundToHalf', () => {
    expect(roundToHalf(24.7)).toBe(24.5);
    expect(roundToHalf(24.8)).toBe(25);
    expect(roundToHalf(25)).toBe(25);
    expect(roundToHalf(0.3)).toBe(0.5);
    expect(roundToHalf(0.24)).toBe(0);
  });
  it('roundToHalfLine always lands on x.5 and never below 0.5', () => {
    expect(roundToHalfLine(25.3)).toBe(25.5);
    expect(roundToHalfLine(25.7)).toBe(25.5);
    expect(roundToHalfLine(26.0)).toBe(26.5);
    expect(roundToHalfLine(24.5)).toBe(24.5);
    expect(roundToHalfLine(0.4)).toBe(0.5);
    expect(roundToHalfLine(0)).toBe(0.5);
  });
});
