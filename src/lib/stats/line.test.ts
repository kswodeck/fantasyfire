import { describe, it, expect } from 'vitest';
import { defaultLine, defaultPropLine } from './line';
import type { GameStatLine } from './types';

const games = (vals: number[]): GameStatLine[] =>
  vals.map((points) => ({ points }) as unknown as GameStatLine);

describe('defaultLine (balanced typical-game line — board/ranking)', () => {
  it('uses the RAW integer median — not the median rounded up to .5', () => {
    // Rounding up to 1.5 sits above the typical game and forced "Under" on every
    // count stat; the ranking line must be the median itself.
    expect(defaultLine(games([0, 1, 1, 1, 2]), 'pts')).toBe(1);
    expect(defaultLine(games([18, 20, 22]), 'pts')).toBe(20);
  });

  it('returns a half-point median unchanged', () => {
    expect(defaultLine(games([12, 13]), 'pts')).toBe(12.5);
  });

  it('floors at 0.5 (empty set, or a typical-zero stat)', () => {
    expect(defaultLine([], 'pts')).toBe(0.5);
    expect(defaultLine(games([0, 0, 0]), 'pts')).toBe(0.5);
  });
});

describe('defaultPropLine (book-style default — player page)', () => {
  it('always lands on a half-point so it can never push', () => {
    expect(defaultPropLine(games([0, 1, 1, 1, 2]), 'pts') % 1).toBe(0.5);
    expect(defaultPropLine(games([18, 20, 22]), 'pts') % 1).toBe(0.5);
  });

  it('picks the straddling half-point with the most balanced over-rate', () => {
    // [0,1,1,1,1] median 1: over 0.5 = 80% (imbalance .3), over 1.5 = 0% (.5) →
    // the lower line is more balanced.
    expect(defaultPropLine(games([0, 1, 1, 1, 1]), 'pts')).toBe(0.5);
    // [0,0,1,2,3] median 1, mean 1.2: over 0.5 = 60% and over 1.5 = 40% tie on
    // balance; nearer the mean (1.2) is 1.5, so the right-skew leans it up.
    expect(defaultPropLine(games([0, 0, 1, 2, 3]), 'pts')).toBe(1.5);
  });

  it('keeps an already-half-point median', () => {
    expect(defaultPropLine(games([12, 13]), 'pts')).toBe(12.5);
  });

  it('floors at 0.5 (empty set, zero median like home runs)', () => {
    expect(defaultPropLine([], 'pts')).toBe(0.5);
    expect(defaultPropLine(games([0, 0, 0, 1]), 'pts')).toBe(0.5);
  });
});
