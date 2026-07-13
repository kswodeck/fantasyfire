import { describe, expect, it } from 'vitest';
import { DAILY_TICK_UTC_HOUR, isDailyTick, isDueNow } from './schedule';

const START = new Date('2026-07-13T22:30:00Z'); // 6:30pm ET first pitch

describe('isDueNow', () => {
  it('is not due more than 75 minutes before the first start', () => {
    expect(isDueNow(new Date('2026-07-13T21:00:00Z'), START)).toBe(false); // -90 min
  });

  it('is due inside the pre-game window (hourly tick lands 15-75 min early)', () => {
    expect(isDueNow(new Date('2026-07-13T21:15:00Z'), START)).toBe(true); // -75 min
    expect(isDueNow(new Date('2026-07-13T22:00:00Z'), START)).toBe(true); // -30 min
  });

  it('stays due shortly after the start (cron jitter catch-up), then stops', () => {
    expect(isDueNow(new Date('2026-07-13T23:00:00Z'), START)).toBe(true); // +30 min
    expect(isDueNow(new Date('2026-07-14T00:00:00Z'), START)).toBe(false); // +90 min
  });

  it('falls back to the fixed daily slot when the start time is unknown', () => {
    const atTick = new Date(Date.UTC(2026, 6, 13, DAILY_TICK_UTC_HOUR, 0, 0));
    const offTick = new Date(Date.UTC(2026, 6, 13, DAILY_TICK_UTC_HOUR + 1, 0, 0));
    expect(isDueNow(atTick, null)).toBe(true);
    expect(isDueNow(offTick, null)).toBe(false);
  });
});

describe('isDailyTick', () => {
  it('matches only the configured UTC hour', () => {
    expect(isDailyTick(new Date(Date.UTC(2026, 6, 13, DAILY_TICK_UTC_HOUR, 45)))).toBe(true);
    expect(isDailyTick(new Date(Date.UTC(2026, 6, 13, 9, 0)))).toBe(false);
  });
});
