// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// Vitest runs without injected globals, so RTL can't auto-register its cleanup.
afterEach(cleanup);
import { SourcedTrends } from './SourcedTrends';
import { SelectedSlateProvider } from './SelectedSlateProvider';
import type { TonightGame, TrendRow } from '@/lib/types';

/** Minimal but type-complete trend row for a player on `team`. */
function makeRow(rank: number, fullName: string, team: string): TrendRow {
  const [firstName, lastName] = fullName.split(' ');
  return {
    rank,
    player: {
      sport: 'mlb',
      externalId: rank,
      slug: fullName.toLowerCase().replace(/ /g, '-'),
      firstName,
      lastName,
      fullName,
      position: null,
      posBucket: null,
      jersey: null,
      height: null,
      weight: null,
      teamAbbreviation: team,
      teamName: team,
      teamExternalId: null,
      gamesPlayed: 50,
    },
    stat: 'hits',
    statShort: 'H',
    line: 0.5,
    side: 'over',
    recentRate: 0.9,
    recentLower: 0.6,
    recentGames: 10,
    seasonRate: 0.5,
    delta: 0.4,
    streak: null,
  };
}

function makeGame(id: string, away: string, home: string, startTime: string): TonightGame {
  return {
    externalId: id,
    date: '2026-07-04',
    startTime,
    status: null,
    home: { abbr: home, name: home, externalId: null },
    away: { abbr: away, name: away, externalId: null },
    homeProbablePitcher: null,
    awayProbablePitcher: null,
  };
}

const FUTURE = new Date(Date.now() + 3 * 3600_000).toISOString();
const PAST = new Date(Date.now() - 3 * 3600_000).toISOString();

const rows = [makeRow(1, 'Up Coming', 'NYM'), makeRow(2, 'Already Started', 'CWS')];
const games = [
  makeGame('g1', 'NYM', 'ATL', FUTURE), // upcoming
  makeGame('g2', 'CWS', 'DET', PAST), // underway
];

function renderTrends() {
  return render(
    <SelectedSlateProvider>
      <SourcedTrends
        sport="mlb"
        bySource={{ prizepicks: rows }}
        sources={['prizepicks']}
        defaultSource="prizepicks"
        games={games}
        slateDate="2026-07-04"
      />
    </SelectedSlateProvider>,
  );
}

describe('SourcedTrends game picker', () => {
  it('shows the Choose games picker and hides started games by default', () => {
    renderTrends();
    // Picker button present (slate mode defaults to "today").
    expect(screen.getByRole('button', { name: /choose games/i })).toBeInTheDocument();
    // Player from the upcoming game is listed; the started game's player is not.
    expect(screen.getByText('Up Coming')).toBeInTheDocument();
    expect(screen.queryByText('Already Started')).not.toBeInTheDocument();
  });

  it('lets the user tap a started game back into scope', () => {
    renderTrends();
    fireEvent.click(screen.getByRole('button', { name: /choose games/i }));
    // The started matchup chip is selectable and re-includes its players.
    fireEvent.click(screen.getByRole('button', { name: /CWS.*DET/i }));
    expect(screen.getByText('Already Started')).toBeInTheDocument();
    expect(screen.queryByText('Up Coming')).not.toBeInTheDocument();
  });

  it('hides the picker and shows everyone when the slate switch is off', () => {
    renderTrends();
    fireEvent.click(screen.getByRole('switch', { name: /today only/i }));
    expect(screen.queryByRole('button', { name: /choose games/i })).not.toBeInTheDocument();
    expect(screen.getByText('Up Coming')).toBeInTheDocument();
    expect(screen.getByText('Already Started')).toBeInTheDocument();
  });
});
