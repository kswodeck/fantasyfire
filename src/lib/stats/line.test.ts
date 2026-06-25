import { describe, it, expect } from 'vitest';
import { defaultLine } from './line';
import type { GameStatLine } from './types';

const games = (vals: number[]): GameStatLine[] =>
  vals.map((points) => ({ points }) as unknown as GameStatLine);

describe('defaultLine', () => {
  it('uses the RAW integer median — not the median rounded up to .5', () => {
    // The bug: roundToHalfLine(1) => 1.5, which sits above the typical game and
    // forced "Under" on every count stat. The line must be the median itself.
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
