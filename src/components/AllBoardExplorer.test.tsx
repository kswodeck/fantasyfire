// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Vitest runs without injected globals, so RTL can't auto-register its cleanup.
afterEach(cleanup);
import { AllBoardExplorer } from './AllBoardExplorer';
import { SelectedSlateProvider } from './SelectedSlateProvider';
import { SelectedSourceProvider } from './SelectedSourceProvider';
import { FIREFACTOR_TIER_CUTOFFS } from '@/lib/stats';
import type { BoardRow } from '@/lib/types';

// The regression: a book whose whole board scores below the no-read cutoff used to
// count as "live" (useSourced only checked that rows EXISTED), so it stayed in the
// selector, could be auto-selected as the only live book, and then rendered nothing —
// leaving the reader on an empty board under a book they never picked, with the
// median-line board we DO have sitting unused.

function makeRow(rank: number, fullName: string, score: number): BoardRow {
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
      teamAbbreviation: 'NYM',
      teamName: 'NYM',
      teamExternalId: null,
      gamesPlayed: 50,
    },
    stat: 'hits',
    statShort: 'H',
    line: 1.5,
    projection: 1.8,
    fireScore: {
      side: 'over',
      score,
      tier: score >= FIREFACTOR_TIER_CUTOFFS.none ? 'Lean' : 'Pass',
      trustFactor: 1,
      components: [],
      valueMode: false,
      note: '',
    },
  };
}

/** Every row is a chance-floored Pass — what a book anchored at an impossible
 *  breakeven produces for its whole board. */
const allPasses = [makeRow(1, 'Floor One', 8), makeRow(2, 'Floor Two', 4)];
const realReads = [makeRow(1, 'Real Read', 62)];

function renderBoard(props: Partial<Parameters<typeof AllBoardExplorer>[0]> = {}) {
  // Board rows re-score their rung on demand (BoardRowCard/useQuery); retries off so
  // a test never waits on a fetch it doesn't care about.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SelectedSourceProvider>
        <SelectedSlateProvider>
          <AllBoardExplorer
            boardsBySource={{}}
            sources={[]}
            defaultSource="prizepicks"
            medianRows={[]}
            {...props}
          />
        </SelectedSlateProvider>
      </SelectedSourceProvider>
    </QueryClientProvider>,
  );
}

describe('AllBoardExplorer book selection', () => {
  it('does not offer a book whose every row is below the no-read cutoff', () => {
    renderBoard({
      boardsBySource: { rtsports: allPasses, prizepicks: realReads },
      sources: ['prizepicks', 'rtsports'],
    });
    const select = screen.getByRole('combobox', { name: /lines from/i });
    const offered = [...select.querySelectorAll('option')].map((o) => o.textContent);
    expect(offered).toEqual(['PrizePicks']);
    // …and the board shows the book that actually has reads.
    expect(screen.getByText('Real Read')).toBeInTheDocument();
  });

  it('falls back to the median board when no book has a readable row', () => {
    renderBoard({
      boardsBySource: { rtsports: allPasses },
      sources: ['rtsports'],
      medianRows: realReads,
    });
    // No book is offered at all…
    expect(screen.queryByRole('combobox', { name: /lines from/i })).not.toBeInTheDocument();
    // …the median-line reads render instead of an empty board…
    expect(screen.getByText('Real Read')).toBeInTheDocument();
    // …and the substitution is stated rather than passed off as a book's number.
    expect(screen.getByText(/our own median line/i)).toBeInTheDocument();
  });

  it('explains an empty board instead of a bare "no reads match"', () => {
    renderBoard({ boardsBySource: { rtsports: allPasses }, sources: ['rtsports'] });
    const empty = screen.getByRole('status');
    expect(empty).toHaveTextContent(/too close to a coin flip/i);
    // The old copy blamed the reader's filters for a data-side gap.
    expect(empty).not.toHaveTextContent(/match these filters/i);
  });

  it('still blames the filters when the filters really are the cause', () => {
    renderBoard({ boardsBySource: { prizepicks: realReads }, sources: ['prizepicks'] });
    expect(screen.getByText('Real Read')).toBeInTheDocument();
    // Search for a name nothing matches — now the filters really are the reason.
    fireEvent.change(screen.getByRole('searchbox', { name: /search players/i }), {
      target: { value: 'zzz' },
    });
    expect(screen.getByRole('status')).toHaveTextContent(/match these filters/i);
  });
});
