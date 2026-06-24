import { describe, it, expect, afterEach } from 'vitest';
import { currentNbaSeason, previousNbaSeason, formatSeason, configuredSeason } from './season';

// Use new Date(year, monthIndex, day) (local time) to avoid timezone drift.
const d = (y: number, m1: number, day: number) => new Date(y, m1 - 1, day);

describe('formatSeason', () => {
  it('formats "YYYY-YY" with zero-padding', () => {
    expect(formatSeason(2025)).toBe('2025-26');
    expect(formatSeason(2008)).toBe('2008-09'); // single-digit end year pads
    expect(formatSeason(1999)).toBe('1999-00');
  });
});

describe('currentNbaSeason — Oct 15 cutoff', () => {
  it('Jan 1 .. Oct 14 uses the prior start year', () => {
    expect(currentNbaSeason(d(2026, 1, 1))).toBe('2025-26');
    expect(currentNbaSeason(d(2026, 6, 23))).toBe('2025-26');
    expect(currentNbaSeason(d(2026, 10, 14))).toBe('2025-26'); // day before cutoff
  });

  it('Oct 15 .. Dec 31 uses the current year as start', () => {
    expect(currentNbaSeason(d(2026, 10, 15))).toBe('2026-27'); // cutoff day
    expect(currentNbaSeason(d(2026, 11, 1))).toBe('2026-27');
    expect(currentNbaSeason(d(2026, 12, 31))).toBe('2026-27');
  });
});

describe('previousNbaSeason', () => {
  it('steps back one season', () => {
    expect(previousNbaSeason('2025-26')).toBe('2024-25');
    expect(previousNbaSeason('2026-27')).toBe('2025-26');
  });
});

describe('configuredSeason', () => {
  const saved = process.env.NBA_SEASON;
  afterEach(() => {
    if (saved === undefined) delete process.env.NBA_SEASON;
    else process.env.NBA_SEASON = saved;
  });

  it('uses a valid NBA_SEASON override when set', () => {
    process.env.NBA_SEASON = '2023-24';
    expect(configuredSeason(d(2026, 6, 23))).toBe('2023-24');
  });

  it('ignores a malformed override and falls back to the computed season', () => {
    process.env.NBA_SEASON = 'nonsense';
    expect(configuredSeason(d(2026, 6, 23))).toBe('2025-26');
  });

  it('computes from the date when no override is set', () => {
    delete process.env.NBA_SEASON;
    expect(configuredSeason(d(2026, 11, 1))).toBe('2026-27');
  });
});
