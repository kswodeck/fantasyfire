import { describe, it, expect } from 'vitest';
import { affectsHealthBanner, runIsStale, STALE_AFTER_MS } from './ingestHealth';

const NOW = new Date('2026-08-10T18:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

describe('runIsStale', () => {
  it('is fresh for a recent successful run that wrote rows', () => {
    expect(
      runIsStale('providedlines', { status: 'success', startedAt: minutesAgo(10), rowsWritten: 4200 }, NOW),
    ).toBe(false);
  });

  it('is stale for a failed run', () => {
    expect(
      runIsStale('mlb', { status: 'failure', startedAt: minutesAgo(5), rowsWritten: null }, NOW),
    ).toBe(true);
  });

  it('is stale past the cadence', () => {
    const old = new Date(NOW.getTime() - STALE_AFTER_MS - 1000);
    expect(runIsStale('mlb', { status: 'success', startedAt: old, rowsWritten: 100 }, NOW)).toBe(true);
  });

  it('is stale for a provided-lines run that "succeeded" writing nothing', () => {
    // The regression. This ran every 15 minutes showing green while no book had a
    // single line and the whole site fell back to our own median numbers.
    expect(
      runIsStale('providedlines', { status: 'success', startedAt: minutesAgo(5), rowsWritten: 0 }, NOW),
    ).toBe(true);
  });

  it('does NOT punish a sport pull for an empty slate', () => {
    // A quiet night legitimately writes no rows; the off-season gate covers the rest.
    expect(
      runIsStale('nba', { status: 'success', startedAt: minutesAgo(5), rowsWritten: 0 }, NOW),
    ).toBe(false);
  });

  it('treats an unrecorded row count as "not a zero"', () => {
    // rowsWritten is null when a job's main() returns void — absence of a count is
    // not evidence of a drought, so it must not read as one.
    expect(
      runIsStale('providedlines', { status: 'success', startedAt: minutesAgo(5), rowsWritten: null }, NOW),
    ).toBe(false);
  });
});

describe('affectsHealthBanner', () => {
  const inSeasonPull = { isSportPull: true, sportInSeason: true, anySportInSeason: true };
  const offSeasonPull = { isSportPull: true, sportInSeason: false, anySportInSeason: true };

  it('counts a sport pull while its own sport is in season', () => {
    expect(affectsHealthBanner('mlb', inSeasonPull)).toBe(true);
  });

  it('ignores a sport pull that is off-season', () => {
    // An amber dot on the NBA ingest in July is the calendar, not a fault.
    expect(affectsHealthBanner('nba', offSeasonPull)).toBe(false);
  });

  it('counts provided lines — the boards depend on it', () => {
    // The regression: this sat dead for 8 days behind a green banner because every
    // optional job was excluded from the health calculation.
    expect(
      affectsHealthBanner('providedlines', {
        isSportPull: false,
        sportInSeason: false,
        anySportInSeason: true,
      }),
    ).toBe(true);
  });

  it('spares provided lines when nothing at all is playing', () => {
    // Books post nothing when nothing is on — same gate the sport pulls get.
    expect(
      affectsHealthBanner('providedlines', {
        isSportPull: false,
        sportInSeason: false,
        anySportInSeason: false,
      }),
    ).toBe(false);
  });

  it('leaves the genuinely best-effort jobs out of the banner', () => {
    for (const job of ['social', 'push', 'metrics', 'prune', 'schedule', 'injuries', 'indexnow']) {
      expect(
        affectsHealthBanner(job, {
          isSportPull: false,
          sportInSeason: false,
          anySportInSeason: true,
        }),
        job,
      ).toBe(false);
    }
  });
});
