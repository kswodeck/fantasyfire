import { describe, it, expect } from 'vitest';
import {
  addDaysIso,
  formatDayLabel,
  formatDayRange,
  groupGamesByDay,
  localDayIso,
} from './gameDays';

describe('localDayIso', () => {
  // KC @ BUF on Thanksgiving night: 7:20pm Central, which is already Friday in UTC.
  const kcBuf = '2026-11-27T01:20:00Z';

  it('dates a game by the viewer’s clock, not by UTC', () => {
    expect(localDayIso(kcBuf, 'America/Chicago')).toBe('2026-11-26');
    expect(localDayIso(kcBuf, 'America/New_York')).toBe('2026-11-26');
    expect(localDayIso(kcBuf, 'America/Los_Angeles')).toBe('2026-11-26');
  });

  it('puts it on Friday for a viewer for whom it really is Friday', () => {
    expect(localDayIso(kcBuf, 'UTC')).toBe('2026-11-27');
    expect(localDayIso(kcBuf, 'Europe/Berlin')).toBe('2026-11-27');
  });

  it('returns null for a timestamp it cannot read', () => {
    expect(localDayIso('not a date', 'UTC')).toBeNull();
  });
});

describe('addDaysIso', () => {
  it('carries across month and year ends', () => {
    expect(addDaysIso('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2026-11-26', 4)).toBe('2026-11-30');
  });
});

describe('groupGamesByDay', () => {
  it('splits Thanksgiving week into the days it is actually played on', () => {
    // The 15-game slate from the report, as (label, day).
    const week = [
      ['CHI@DET', '2026-11-26'],
      ['PHI@DAL', '2026-11-26'],
      ['KC@BUF', '2026-11-26'],
      ['DEN@PIT', '2026-11-27'],
      ...['NO@CIN', 'BAL@HOU', 'NYG@IND', 'ATL@MIN', 'TEN@JAX', 'NYJ@MIA'].map((g) => [
        g,
        '2026-11-29',
      ]),
      ...['NE@LAC', 'WSH@ARI', 'SEA@SF', 'LV@CLE'].map((g) => [g, '2026-11-29']),
      ['CAR@TB', '2026-11-30'],
    ] as const;
    const groups = groupGamesByDay(week, ([, day]) => day);

    expect(groups.map((g) => [g.day, g.games.length])).toEqual([
      ['2026-11-26', 3],
      ['2026-11-27', 1],
      ['2026-11-29', 10],
      ['2026-11-30', 1],
    ]);
    expect(groups[0].games.map(([label]) => label)).toEqual([
      'CHI@DET',
      'PHI@DAL',
      'KC@BUF',
    ]);
  });

  it('orders days by date, whatever order the games arrived in', () => {
    const groups = groupGamesByDay(
      ['b', 'a', 'c'],
      (x) => ({ a: '2026-11-26', b: '2026-11-29', c: '2026-11-27' })[x]!,
    );
    expect(groups.map((g) => g.day)).toEqual(['2026-11-26', '2026-11-27', '2026-11-29']);
  });

  it('returns nothing for an empty slate', () => {
    expect(groupGamesByDay([], () => 'x')).toEqual([]);
  });
});

describe('formatDayLabel', () => {
  it('names today and tomorrow once the viewer’s date is known', () => {
    expect(formatDayLabel('2026-11-26', '2026-11-26')).toBe('Today · Thu, Nov 26');
    expect(formatDayLabel('2026-11-27', '2026-11-26')).toBe('Tomorrow · Fri, Nov 27');
    expect(formatDayLabel('2026-11-29', '2026-11-26')).toBe('Sun, Nov 29');
  });

  it('falls back to the plain date before the browser has hydrated', () => {
    expect(formatDayLabel('2026-11-26', null)).toBe('Thu, Nov 26');
  });

  it('knows tomorrow across a month end', () => {
    expect(formatDayLabel('2026-12-01', '2026-11-30')).toBe('Tomorrow · Tue, Dec 1');
  });
});

describe('formatDayRange', () => {
  it('prints a single day as before', () => {
    expect(formatDayRange('2026-11-26', '2026-11-26')).toBe('Nov 26, 2026');
  });

  it('spans days within a month', () => {
    expect(formatDayRange('2026-11-26', '2026-11-30')).toBe('Nov 26–30, 2026');
  });

  it('spans a month end', () => {
    expect(formatDayRange('2026-11-29', '2026-12-02')).toBe('Nov 29 – Dec 2, 2026');
  });

  it('spans a year end', () => {
    expect(formatDayRange('2026-12-31', '2027-01-04')).toBe('Dec 31, 2026 – Jan 4, 2027');
  });
});
