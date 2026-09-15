// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Vitest runs without injected globals, so RTL can't auto-register its cleanup.
afterEach(cleanup);
import { BoardExplorer } from './BoardExplorer';
import { SelectedSlateProvider } from './SelectedSlateProvider';
import { SelectedSourceProvider } from './SelectedSourceProvider';
import type { BoardRow } from '@/lib/types';

// A board whose rows lean on last season (the opening weeks of a new season, when the
// current one is too young to fill the recent-form window) must SAY so — otherwise it
// reads as this year's form. See loadBoardPool's carryPriorSeason.

function makeRow(rank: number, fullName: string, carriedOverGames = 0): BoardRow {
  const [firstName, lastName] = fullName.split(' ');
  return {
    rank,
    player: {
      sport: 'nfl',
      externalId: rank,
      slug: fullName.toLowerCase().replace(/ /g, '-'),
      firstName,
      lastName,
      fullName,
      position: 'WR',
      posBucket: 'WR',
      jersey: null,
      height: null,
      weight: null,
      teamAbbreviation: 'KC',
      teamName: 'KC',
      teamExternalId: null,
      gamesPlayed: 18,
      ...(carriedOverGames ? { carriedOverGames } : {}),
    },
    stat: 'recYds',
    statShort: 'REC YDS',
    line: 64.5,
    projection: 71,
    fireScore: {
      side: 'over',
      score: 62,
      tier: 'Lean',
      trustFactor: 1,
      components: [],
      valueMode: false,
      note: '',
    },
  };
}

function renderBoard(rows: BoardRow[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SelectedSourceProvider>
        <SelectedSlateProvider>
          <BoardExplorer
            sport="nfl"
            boardsBySource={{}}
            sources={[]}
            defaultSource="prizepicks"
            medianRows={rows}
            games={[]}
            slateWord="This week"
            slateDate={null}
          />
        </SelectedSlateProvider>
      </SelectedSourceProvider>
    </QueryClientProvider>,
  );
}

describe('BoardExplorer early-season disclosure', () => {
  it('says so when reads are topped up with last season, and counts PLAYERS not rows', () => {
    // Two rows for one carried player + one row for another: three rows, two players.
    const rows = [
      makeRow(1, 'Carried One', 17),
      { ...makeRow(2, 'Carried One', 17), stat: 'rec' as const },
      makeRow(3, 'Carried Two', 15),
      makeRow(4, 'Full Season'),
    ];
    renderBoard(rows);
    expect(screen.getByText(/topped up with last season/i)).toBeInTheDocument();
    expect(screen.getByText('2 players')).toBeInTheDocument();
  });

  it('reads naturally for a single carried player', () => {
    renderBoard([makeRow(1, 'Carried One', 17), makeRow(2, 'Full Season')]);
    expect(screen.getByText('1 player')).toBeInTheDocument();
    expect(screen.getByText(/that read is/i)).toBeInTheDocument();
  });

  it('stays silent once every read stands on the current season', () => {
    renderBoard([makeRow(1, 'Full Season'), makeRow(2, 'Also Full')]);
    expect(screen.queryByText(/topped up with last season/i)).not.toBeInTheDocument();
  });
});
