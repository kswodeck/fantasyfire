import { describe, it, expect } from 'vitest';
import {
  pct,
  num1,
  ordinal,
  signed,
  americanOdds,
  roundToHalf,
  roundToHalfLine,
  median,
  formatIsoDate,
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

describe('median', () => {
  it('odd-length: the middle value', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([7])).toBe(7);
  });
  it('even-length: the mean of the two middle values', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([10, 0])).toBe(5);
  });
  it('empty -> 0 and does not mutate the input', () => {
    expect(median([])).toBe(0);
    const xs = [3, 1, 2];
    median(xs);
    expect(xs).toEqual([3, 1, 2]);
  });
  it('is lower than the mean on a right-skewed sample (the whole point)', () => {
    const xs = [0, 0, 1, 1, 2, 30]; // mean = 5.67, median = 1
    expect(median(xs)).toBe(1);
  });
});

describe('formatIsoDate', () => {
  it('formats an ISO date without time-zone drift', () => {
    expect(formatIsoDate('2026-06-23')).toBe('Jun 23, 2026');
    expect(formatIsoDate('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatIsoDate('2026-12-09T00:00:00.000Z')).toBe('Dec 9, 2026');
  });
  it('passes through an unparseable string', () => {
    expect(formatIsoDate('not-a-date')).toBe('not-a-date');
  });
});
