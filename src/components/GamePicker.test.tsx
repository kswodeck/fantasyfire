// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

// Vitest runs without injected globals, so RTL can't auto-register its cleanup.
afterEach(cleanup);
import { GamePicker, useGameFilter } from './GamePicker';
import type { TonightGame } from '@/lib/types';

// The report: on Thanksgiving the NFL picker listed the whole week — 15 games — as
// one run of start times under "15 games · Nov 26, 2026", with no way to tell that
// only three of them were that day. A weekly slate now splits under day headings.

/** A game at `startUtc`, dated (as the server dates it) on its Eastern calendar day. */
function game(
  id: string,
  away: string,
  home: string,
  startUtc: string,
  etDate: string,
): TonightGame {
  return {
    externalId: id,
    date: etDate,
    startTime: startUtc,
    status: null,
    away: { abbr: away, name: away, externalId: null },
    home: { abbr: home, name: home, externalId: null },
    homeProbablePitcher: null,
    awayProbablePitcher: null,
  };
}

const sunday = (id: string, away: string, home: string, utc: string) =>
  game(id, away, home, utc, '2026-11-29');

/** Thanksgiving week 2026, exactly as reported (times in UTC). */
const THANKSGIVING_WEEK: TonightGame[] = [
  game('1', 'CHI', 'DET', '2026-11-26T17:30:00Z', '2026-11-26'),
  game('2', 'PHI', 'DAL', '2026-11-26T21:30:00Z', '2026-11-26'),
  // 7:20pm Central on Thursday — already Friday in UTC. Must still read as Thursday.
  game('3', 'KC', 'BUF', '2026-11-27T01:20:00Z', '2026-11-26'),
  game('4', 'DEN', 'PIT', '2026-11-27T20:00:00Z', '2026-11-27'),
  sunday('5', 'NO', 'CIN', '2026-11-29T18:00:00Z'),
  sunday('6', 'BAL', 'HOU', '2026-11-29T18:00:00Z'),
  sunday('7', 'NYG', 'IND', '2026-11-29T18:00:00Z'),
  sunday('8', 'ATL', 'MIN', '2026-11-29T18:00:00Z'),
  sunday('9', 'TEN', 'JAX', '2026-11-29T18:00:00Z'),
  sunday('10', 'NYJ', 'MIA', '2026-11-29T18:00:00Z'),
  sunday('11', 'NE', 'LAC', '2026-11-29T21:05:00Z'),
  sunday('12', 'WSH', 'ARI', '2026-11-29T21:25:00Z'),
  sunday('13', 'SEA', 'SF', '2026-11-29T21:25:00Z'),
  sunday('14', 'LV', 'CLE', '2026-11-30T01:20:00Z'),
  game('15', 'CAR', 'TB', '2026-12-01T01:15:00Z', '2026-11-30'),
];

function Harness({ games }: { games: TonightGame[] }) {
  const filter = useGameFilter(games);
  return (
    <GamePicker sport="nfl" games={games} slateDate={games[0].date} filter={filter} />
  );
}

function openPicker(games: TonightGame[]) {
  render(<Harness games={games} />);
  fireEvent.click(screen.getByRole('button', { name: /choose games/i }));
}

const originalTz = process.env.TZ;
beforeAll(() => {
  // The viewer from the report, in Central time. Pinned because CI runs in UTC, where
  // Thursday's night game genuinely is on Friday.
  process.env.TZ = 'America/Chicago';
  vi.useFakeTimers({ toFake: ['Date'] });
  // 1:19pm Central on Thanksgiving, when the screenshot was taken.
  vi.setSystemTime(new Date('2026-11-26T19:19:00Z'));
});
afterAll(() => {
  vi.useRealTimers();
  process.env.TZ = originalTz;
});

describe('GamePicker on a weekly slate', () => {
  it('says which days the week spans instead of stamping it all with today', () => {
    openPicker(THANKSGIVING_WEEK);
    expect(screen.getByText(/15 games · Nov 26–30, 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/15 games · Nov 26, 2026/)).not.toBeInTheDocument();
  });

  it('puts exactly the three Thanksgiving games under Today', () => {
    openPicker(THANKSGIVING_WEEK);
    const today = screen.getByRole('group', { name: /today · thu, nov 26 · 3 games/i });
    const chips = within(today).getAllByRole('listitem');

    expect(chips).toHaveLength(3);
    expect(today).toHaveTextContent('CHI');
    expect(today).toHaveTextContent('PHI');
    // The night game stays on Thursday for a Central viewer.
    expect(today).toHaveTextContent('KC');
    expect(today).not.toHaveTextContent('DEN');
  });

  it('labels every other day of the week', () => {
    openPicker(THANKSGIVING_WEEK);
    expect(
      screen.getByRole('group', { name: /tomorrow · fri, nov 27 · 1 game$/i }),
    ).toHaveTextContent('DEN');
    expect(
      within(
        screen.getByRole('group', { name: /^sun, nov 29 · 10 games/i }),
      ).getAllByRole('listitem'),
    ).toHaveLength(10);
    expect(
      screen.getByRole('group', { name: /^mon, nov 30 · 1 game$/i }),
    ).toHaveTextContent('CAR');
  });

  it('keeps a one-day slate as a single strip, with no day headings', () => {
    openPicker(THANKSGIVING_WEEK.slice(0, 2));
    expect(screen.getByText(/2 games · Nov 26, 2026/)).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('selecting a whole day', () => {
  const dayGroup = (name: RegExp) => screen.getByRole('group', { name });
  const dayButton = (group: HTMLElement) =>
    within(group).getByRole('button', {
      name: /^select (all|the \d+ upcoming) games on/i,
    });
  /** The game chips currently selected inside a day (the day button itself excluded). */
  const pickedIn = (group: HTMLElement) =>
    within(group)
      .getAllByRole('button', { pressed: true })
      .filter((b) => !/^select /i.test(b.getAttribute('aria-label') ?? ''));
  const picker = () => screen.getByRole('button', { expanded: true });

  it('picks today’s games in one tap, leaving out the one already underway', () => {
    openPicker(THANKSGIVING_WEEK);
    const today = dayGroup(/^today/i);
    const select = dayButton(today);
    // The heading says 3 games; the button says up front that it will take 2.
    expect(select).toHaveTextContent('Select 2 upcoming');

    fireEvent.click(select);

    expect(select).toHaveAttribute('aria-pressed', 'true');
    expect(select).toHaveTextContent('Selected');
    const picked = pickedIn(today);
    expect(picked).toHaveLength(2);
    expect(picked.map((b) => b.textContent).join(' ')).toMatch(/PHI.*DAL.*KC.*BUF/);
    expect(picked.map((b) => b.textContent).join(' ')).not.toMatch(/CHI/);
    expect(picker()).toHaveTextContent('Games (2 of 15)');
  });

  it('clears the day on a second tap', () => {
    openPicker(THANKSGIVING_WEEK);
    const select = dayButton(dayGroup(/^today/i));
    fireEvent.click(select);
    fireEvent.click(select);

    expect(select).toHaveAttribute('aria-pressed', 'false');
    expect(picker()).toHaveTextContent('Choose games');
  });

  it('adds days together, and takes one back out without touching the other', () => {
    openPicker(THANKSGIVING_WEEK);
    const sunday = dayButton(dayGroup(/^sun, nov 29/i));
    expect(sunday).toHaveTextContent('Select day');

    fireEvent.click(sunday);
    expect(picker()).toHaveTextContent('Games (10 of 15)');
    fireEvent.click(dayButton(dayGroup(/^today/i)));
    expect(picker()).toHaveTextContent('Games (12 of 15)');
    fireEvent.click(sunday);
    expect(picker()).toHaveTextContent('Games (2 of 15)');
  });

  it('takes the whole day once every game in it is underway', () => {
    // 11pm Central on Thanksgiving: all three games have kicked off, nothing upcoming.
    vi.setSystemTime(new Date('2026-11-27T05:00:00Z'));
    try {
      openPicker(THANKSGIVING_WEEK);
      const today = dayGroup(/^today/i);
      const select = dayButton(today);
      expect(select).toHaveTextContent('Select day');

      fireEvent.click(select);
      expect(pickedIn(today)).toHaveLength(3);
    } finally {
      vi.setSystemTime(new Date('2026-11-26T19:19:00Z'));
    }
  });
});
