import { describe, it, expect } from 'vitest';
import { isInSeasonWindow, SEASON_WINDOWS, GRACE_DAYS, offSeasonReason } from './seasonWindow';
import { SPORT_LIST } from './sports';

const on = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('in-season detection', () => {
  it('runs mid-season', () => {
    expect(isInSeasonWindow('nba', on('2026-01-15'))).toBe(true); // wrapping season
    expect(isInSeasonWindow('mlb', on('2026-07-04'))).toBe(true);
    expect(isInSeasonWindow('wnba', on('2026-07-04'))).toBe(true);
    expect(isInSeasonWindow('nfl', on('2026-11-20'))).toBe(true);
    expect(isInSeasonWindow('cbb', on('2026-02-10'))).toBe(true); // wraps into spring
  });

  it('skips the deep off-season', () => {
    // The summer months the user is actually paying Actions minutes for.
    expect(isInSeasonWindow('nba', on('2026-08-15'))).toBe(false);
    expect(isInSeasonWindow('nhl', on('2026-08-15'))).toBe(false);
    expect(isInSeasonWindow('cbb', on('2026-07-15'))).toBe(false);
    expect(isInSeasonWindow('cfb', on('2026-05-15'))).toBe(false);
    expect(isInSeasonWindow('mlb', on('2026-01-15'))).toBe(false);
    expect(isInSeasonWindow('wnba', on('2026-02-01'))).toBe(false);
  });
});

describe('the ±30-day grace', () => {
  it('starts pulling BEFORE opening day and keeps going after the postseason', () => {
    // MLB opens ~Mar 15: 20 days early is inside, 40 days early is not.
    expect(isInSeasonWindow('mlb', on('2026-02-23'))).toBe(true);
    expect(isInSeasonWindow('mlb', on('2026-02-03'))).toBe(false);
    // MLB ends ~Nov 10: 20 days later inside, 40 days later out.
    expect(isInSeasonWindow('mlb', on('2026-11-30'))).toBe(true);
    expect(isInSeasonWindow('mlb', on('2026-12-20'))).toBe(false);
  });

  it('honours a custom grace', () => {
    // Exactly at the edge with no grace at all.
    expect(isInSeasonWindow('mlb', on('2026-02-23'), 0)).toBe(false);
    expect(isInSeasonWindow('mlb', on('2026-03-16'), 0)).toBe(true);
  });
});

describe('wrapping seasons (the easy thing to get wrong)', () => {
  it('NFL covers both sides of New Year', () => {
    expect(isInSeasonWindow('nfl', on('2026-09-10'))).toBe(true); // autumn
    expect(isInSeasonWindow('nfl', on('2027-01-20'))).toBe(true); // playoffs
    expect(isInSeasonWindow('nfl', on('2027-02-10'))).toBe(true); // Super Bowl
    expect(isInSeasonWindow('nfl', on('2026-05-10'))).toBe(false); // dead months
  });

  it('CBB covers November through the April title game', () => {
    expect(isInSeasonWindow('cbb', on('2026-11-10'))).toBe(true);
    expect(isInSeasonWindow('cbb', on('2027-03-25'))).toBe(true); // March Madness
    expect(isInSeasonWindow('cbb', on('2027-04-06'))).toBe(true); // title game
    expect(isInSeasonWindow('cbb', on('2027-07-01'))).toBe(false);
  });

  it('NBA/NHL cover October through the June finals', () => {
    for (const s of ['nba', 'nhl'] as const) {
      expect(isInSeasonWindow(s, on('2026-10-20')), s).toBe(true);
      expect(isInSeasonWindow(s, on('2027-06-15')), s).toBe(true); // finals
      expect(isInSeasonWindow(s, on('2027-08-15')), s).toBe(false);
    }
  });
});

describe('coverage + sanity', () => {
  it('every sport has a window', () => {
    for (const s of SPORT_LIST) expect(SEASON_WINDOWS[s], s).toBeDefined();
  });

  it('every sport is in season on at least one day of the year, and off on another', () => {
    // Guards a typo'd window that would either never run or never stop.
    for (const s of SPORT_LIST) {
      const days = Array.from({ length: 365 }, (_, i) =>
        isInSeasonWindow(s, new Date(Date.UTC(2026, 0, 1 + i, 12))),
      );
      expect(days.some(Boolean), `${s} runs sometime`).toBe(true);
      expect(days.some((d) => !d), `${s} rests sometime`).toBe(true);
    }
  });

  it('the postseason months are inside each window', () => {
    // The user's requirement: playoffs/postseason must be covered.
    expect(isInSeasonWindow('nba', on('2027-06-10'))).toBe(true); // NBA Finals
    expect(isInSeasonWindow('mlb', on('2026-10-28'))).toBe(true); // World Series
    expect(isInSeasonWindow('nfl', on('2027-02-07'))).toBe(true); // Super Bowl
    expect(isInSeasonWindow('nhl', on('2027-06-20'))).toBe(true); // Stanley Cup
    expect(isInSeasonWindow('wnba', on('2026-10-15'))).toBe(true); // WNBA Finals
    expect(isInSeasonWindow('mls', on('2026-12-06'))).toBe(true); // MLS Cup
    expect(isInSeasonWindow('cfb', on('2027-01-20'))).toBe(true); // CFP title
    expect(isInSeasonWindow('cbb', on('2027-04-05'))).toBe(true); // NCAA title
  });

  it('GRACE_DAYS is the documented 30', () => {
    expect(GRACE_DAYS).toBe(30);
  });

  it('explains itself when it skips', () => {
    expect(offSeasonReason('nba', on('2026-08-15'))).toContain('NBA is out of season');
    expect(offSeasonReason('nba', on('2026-08-15'))).toContain('30d grace');
  });
});
