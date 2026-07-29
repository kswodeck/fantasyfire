import { describe, it, expect } from 'vitest';
import { eventDateIso } from './espnSports';

describe('eventDateIso', () => {
  it('files a US evening game under the day it was PLAYED, not the UTC date', () => {
    // The bug this fixes: a 9pm ET WNBA tip on Jul 28 is 01:00Z on Jul 29, so
    // slicing the raw timestamp filed the whole evening slate a day early — and
    // the accuracy ledger then showed a settled "Jul 29" before Jul 29 was played.
    expect(eventDateIso('2026-07-29T01:00Z', '2026-07-28')).toBe('2026-07-28');
    expect(eventDateIso('2026-07-29T02:30Z', '2026-07-28')).toBe('2026-07-28'); // 10:30pm ET
    expect(eventDateIso('2026-07-29T03:59Z', '2026-07-28')).toBe('2026-07-28'); // 11:59pm ET
  });

  it('keeps afternoon games on their own day', () => {
    expect(eventDateIso('2026-07-28T17:00Z', '2026-07-28')).toBe('2026-07-28'); // 1pm ET
    expect(eventDateIso('2026-07-28T23:00Z', '2026-07-28')).toBe('2026-07-28'); // 7pm ET
  });

  it('rolls to the next day only once it is midnight IN EASTERN', () => {
    expect(eventDateIso('2026-07-29T04:00Z', '2026-07-28')).toBe('2026-07-29'); // 12am ET
  });

  it('handles standard time too (EST, UTC-5)', () => {
    // A 9pm ET January game is 02:00Z the next day.
    expect(eventDateIso('2027-01-16T02:00Z', '2027-01-15')).toBe('2027-01-15');
    expect(eventDateIso('2027-01-16T05:00Z', '2027-01-15')).toBe('2027-01-16'); // 12am ET
  });

  it('falls back to the queried date when the feed has no usable timestamp', () => {
    expect(eventDateIso(undefined, '2026-07-28')).toBe('2026-07-28');
    expect(eventDateIso('', '2026-07-28')).toBe('2026-07-28');
    expect(eventDateIso('not a date', '2026-07-28')).toBe('2026-07-28');
  });
});
