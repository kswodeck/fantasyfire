import { describe, expect, it } from 'vitest';
import {
  etDateIso,
  etHour,
  isDailyTick,
  isDueNow,
  isWithinPostingWindow,
  pickRelevantStart,
  socialDayIso,
  socialDayStart,
  socialDayWindow,
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

  // The 2026-07-14 WNBA bug: an 11am ET matinee (15:00Z) put the sport
  // "in grace" at the 1pm ET tick, publishing the day's post at 10am PT —
  // six hours before the evening game the post was actually about.
  it('anchors on the evening game, not a started matinee', () => {
    const matinee = new Date('2026-07-14T15:00:00Z'); // 11am ET tip
    const evening = new Date('2026-07-14T23:00:00Z'); // 7pm ET / 4pm PT
    const early = new Date('2026-07-14T17:00:00Z'); // 1pm ET — matinee in progress
    expect(pickRelevantStart([matinee, evening], early)).toEqual(evening);
    expect(isDueNow(early, evening)).toBe(false); // not due until 5pm ET
    expect(isDueNow(new Date('2026-07-14T21:00:00Z'), evening)).toBe(true); // 5pm ET / 2pm PT
  });

  it('still catches up when the started game is the whole slate', () => {
    const matinee = new Date('2026-07-14T15:00:00Z'); // 11am ET tip, nothing later
    const now = new Date('2026-07-14T17:00:00Z'); // 1pm ET, +120 min
    expect(pickRelevantStart([matinee], now)).toEqual(matinee);
    expect(isDueNow(now, matinee)).toBe(true);
  });

  it('returns null when every start is long past (slate over)', () => {
    const now = new Date('2026-07-14T05:00:00Z');
    expect(pickRelevantStart([lastNight, tonight], now)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(pickRelevantStart([], new Date('2026-07-13T21:00:00Z'))).toBeNull();
  });
});

describe('socialDayStart / socialDayWindow', () => {
  // The social day rolls at 11pm ET: "today" = 11pm ET yesterday → 11pm ET today.
  it('anchors to the most recent 11pm ET (EDT)', () => {
    // 8pm ET Jul 13 (00:00Z Jul 14 — exactly where the old UTC day rolled)
    const evening = new Date('2026-07-14T00:00:00Z');
    expect(socialDayStart(evening).toISOString()).toBe('2026-07-13T03:00:00.000Z'); // 11pm ET Jul 12
    // 11:30pm ET Jul 13 → the NEW day that began at 11pm ET Jul 13
    const late = new Date('2026-07-14T03:30:00Z');
    expect(socialDayStart(late).toISOString()).toBe('2026-07-14T03:00:00.000Z');
  });

  it('anchors correctly in winter (EST)', () => {
    const eveningEst = new Date('2026-01-14T01:00:00Z'); // 8pm ET Jan 13
    expect(socialDayStart(eveningEst).toISOString()).toBe('2026-01-13T04:00:00.000Z'); // 11pm ET Jan 12
  });

  it('keeps a 10:30pm ET West Coast tip inside the same day as the noon tick', () => {
    const noonTick = new Date('2026-07-13T16:00:00Z'); // noon ET Jul 13
    const lateTip = new Date('2026-07-14T02:30:00Z'); // 10:30pm ET Jul 13
    const { start, end } = socialDayWindow(noonTick);
    expect(lateTip.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(lateTip.getTime()).toBeLessThan(end.getTime());
  });

  it("excludes last night's evening game from today's window", () => {
    const noonTick = new Date('2026-07-13T16:00:00Z'); // noon ET Jul 13
    const lastNight = new Date('2026-07-13T01:00:00Z'); // 9pm ET Jul 12 (the WNBA bug game)
    const { start } = socialDayWindow(noonTick);
    expect(lastNight.getTime()).toBeLessThan(start.getTime());
  });
});

describe('etDateIso / socialDayIso', () => {
  it('labels by the ET calendar, not UTC', () => {
    // 9pm ET Jul 13 = 01:00Z Jul 14 — UTC says the 14th, ET says the 13th.
    expect(etDateIso(new Date('2026-07-14T01:00:00Z'))).toBe('2026-07-13');
  });

  it('rolls the social-day label at 11pm ET', () => {
    expect(socialDayIso(new Date('2026-07-14T01:00:00Z'))).toBe('2026-07-13'); // 9pm ET Jul 13
    expect(socialDayIso(new Date('2026-07-14T03:30:00Z'))).toBe('2026-07-14'); // 11:30pm ET Jul 13 → next day
    expect(socialDayIso(new Date('2026-07-14T16:00:00Z'))).toBe('2026-07-14'); // noon ET Jul 14
  });
});

describe('isDailyTick', () => {
  it('is the noon-ET window-open hour only', () => {
    expect(isDailyTick(new Date('2026-07-13T16:45:00Z'))).toBe(true); // 12:45pm ET
    expect(isDailyTick(new Date('2026-07-13T17:00:00Z'))).toBe(false); // 1pm ET
    expect(isDailyTick(new Date('2026-01-13T17:30:00Z'))).toBe(true); // 12:30pm EST (winter)
  });
});
