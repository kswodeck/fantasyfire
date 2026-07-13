import { describe, expect, it } from 'vitest';
import {
  etHour,
  isDailyTick,
  isDueNow,
  isWithinPostingWindow,
  pickRelevantStart,
} from './schedule';

// July dates = EDT (UTC-4): noon ET = 16:00 UTC, 10pm ET = 02:00 UTC next day.
const START = new Date('2026-07-13T22:30:00Z'); // 6:30pm ET first pitch

describe('etHour / isWithinPostingWindow', () => {
  it('converts UTC to Eastern (DST-aware)', () => {
    expect(etHour(new Date('2026-07-13T16:00:00Z'))).toBe(12); // EDT
    expect(etHour(new Date('2026-01-13T17:00:00Z'))).toBe(12); // EST
  });

  it('opens at noon ET and closes after the 10pm ET tick', () => {
    expect(isWithinPostingWindow(new Date('2026-07-13T15:59:00Z'))).toBe(false); // 11:59am ET
    expect(isWithinPostingWindow(new Date('2026-07-13T16:00:00Z'))).toBe(true); // noon ET
    expect(isWithinPostingWindow(new Date('2026-07-14T02:00:00Z'))).toBe(true); // 10pm ET
    expect(isWithinPostingWindow(new Date('2026-07-14T03:00:00Z'))).toBe(false); // 11pm ET
    expect(isWithinPostingWindow(new Date('2026-07-13T13:00:00Z'))).toBe(false); // 9am ET
  });
});

describe('isDueNow', () => {
  it('is not due more than 2 hours before the first start', () => {
    expect(isDueNow(new Date('2026-07-13T20:00:00Z'), START)).toBe(false); // -150 min
  });

  it('is due once the first game is within 2 hours', () => {
    expect(isDueNow(new Date('2026-07-13T20:30:00Z'), START)).toBe(true); // -120 min
    expect(isDueNow(new Date('2026-07-13T22:00:00Z'), START)).toBe(true); // -30 min
  });

  it('never posts outside the ET window even when the game is close', () => {
    const morningStart = new Date('2026-07-13T14:30:00Z'); // 10:30am ET
    expect(isDueNow(new Date('2026-07-13T13:00:00Z'), morningStart)).toBe(false); // 9am ET, -90 min
  });

  it('catches up at the first in-window tick when the slate started early', () => {
    const morningStart = new Date('2026-07-13T13:30:00Z'); // 9:30am ET first pitch
    expect(isDueNow(new Date('2026-07-13T16:00:00Z'), morningStart)).toBe(true); // noon ET, +150 min
    expect(isDueNow(new Date('2026-07-13T18:00:00Z'), morningStart)).toBe(false); // 2pm ET, +270 min — too stale
  });

  it('falls back to the daily slot when the start time is unknown', () => {
    expect(isDueNow(new Date('2026-07-13T16:30:00Z'), null)).toBe(true); // noon ET hour
    expect(isDueNow(new Date('2026-07-13T17:00:00Z'), null)).toBe(false); // 1pm ET
  });
});

describe('pickRelevantStart', () => {
  // The 2026-07-13 WNBA bug: the UTC-day bucket held LAST NIGHT's 6pm PT game
  // (01:00Z "today") plus tonight's 4pm PT game (23:00Z). Anchoring on the raw
  // minimum made the slate look 21h stale and the sport never posted.
  const lastNight = new Date('2026-07-13T01:00:00Z');
  const tonight = new Date('2026-07-13T23:00:00Z');

  it("skips last night's UTC-midnight-crossers and anchors on tonight's game", () => {
    const now = new Date('2026-07-13T21:00:00Z'); // 2pm PT — 2h before tip
    expect(pickRelevantStart([lastNight, tonight], now)).toEqual(tonight);
  });

  it('keeps a recently started game (in-grace catch-up)', () => {
    const now = new Date('2026-07-13T23:30:00Z'); // 30 min after tip
    expect(pickRelevantStart([lastNight, tonight], now)).toEqual(tonight);
  });

  it('returns null when every start is long past (slate over)', () => {
    const now = new Date('2026-07-14T05:00:00Z');
    expect(pickRelevantStart([lastNight, tonight], now)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(pickRelevantStart([], new Date('2026-07-13T21:00:00Z'))).toBeNull();
  });
});

describe('isDailyTick', () => {
  it('is the noon-ET window-open hour only', () => {
    expect(isDailyTick(new Date('2026-07-13T16:45:00Z'))).toBe(true); // 12:45pm ET
    expect(isDailyTick(new Date('2026-07-13T17:00:00Z'))).toBe(false); // 1pm ET
    expect(isDailyTick(new Date('2026-01-13T17:30:00Z'))).toBe(true); // 12:30pm EST (winter)
  });
});
