// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookLink } from './BookLink';

// Vitest runs without injected globals, so RTL can't auto-register its cleanup.
afterEach(cleanup);

/**
 * Geo is fetched through TanStack on a shared key, so every test needs its OWN
 * QueryClient — a client reused across tests would serve the first test's cached
 * region to all the others and the gating assertions would silently pass for the
 * wrong reason.
 */
function renderLink(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** Stub /api/v1/geo with a fixed answer. */
function mockGeo(body: { country: string | null; region: string | null }) {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify(body), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('BookLink — a book with a live deal', () => {
  it('renders an outbound link where the product is offered', async () => {
    mockGeo({ country: 'US', region: 'CA' });
    renderLink(<BookLink source="prizepicks" placement="player-line" />);

    const link = await screen.findByRole('link', { name: 'PrizePicks' });
    expect(link).toHaveAttribute('href', expect.stringContaining('https://'));
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('marks a paid link sponsored + nofollow, and opens it safely', async () => {
    mockGeo({ country: 'US', region: 'CA' });
    renderLink(<BookLink source="prizepicks" placement="player-line" />);

    const rel = (await screen.findByRole('link')).getAttribute('rel') ?? '';
    expect(rel).toContain('sponsored');
    expect(rel).toContain('nofollow');
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('degrades to plain text in a state where the product is not offered', async () => {
    // Michigan runs the peer-to-peer Arena product, not over/under pick'em.
    mockGeo({ country: 'US', region: 'MI' });
    renderLink(<BookLink source="prizepicks" placement="player-line" />);

    // The link is shown optimistically while geo is in flight, then withdrawn.
    await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument());
    // The book is still NAMED — only the link goes away.
    expect(screen.getByText('PrizePicks')).toBeInTheDocument();
  });

  it('keeps custom children when it degrades', async () => {
    mockGeo({ country: 'US', region: 'MO' });
    renderLink(
      <BookLink source="prizepicks" placement="player-line">
        the book
      </BookLink>,
    );
    await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument());
    expect(screen.getByText('the book')).toBeInTheDocument();
  });
});

describe('BookLink — fails open', () => {
  it('shows the link when the geo lookup errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    renderLink(<BookLink source="prizepicks" placement="player-line" />);
    expect(await screen.findByRole('link')).toBeInTheDocument();
  });

  it('shows the link when the request rejects outright (blocked by an extension)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('blocked');
      }),
    );
    renderLink(<BookLink source="prizepicks" placement="player-line" />);
    expect(await screen.findByRole('link')).toBeInTheDocument();
  });

  it('shows the link when the host attaches no geo at all', async () => {
    mockGeo({ country: null, region: null });
    renderLink(<BookLink source="prizepicks" placement="player-line" />);
    expect(await screen.findByRole('link')).toBeInTheDocument();
  });

  it('shows the link outside the US', async () => {
    // "ON" is a valid two-letter code that is not a US state.
    mockGeo({ country: 'CA', region: 'ON' });
    renderLink(<BookLink source="prizepicks" placement="player-line" />);
    expect(await screen.findByRole('link')).toBeInTheDocument();
  });

  it('shows the link for a book whose state list is unverified', async () => {
    // Underdog has no table yet — it must not be suppressed on a guess, even in a
    // state where PrizePicks is restricted.
    mockGeo({ country: 'US', region: 'MI' });
    renderLink(<BookLink source="underdog" placement="player-line" />);
    expect(await screen.findByRole('link', { name: 'Underdog' })).toBeInTheDocument();
  });
});

describe('BookLink — a book with no deal', () => {
  it('renders plain text, never an anchor', () => {
    const fetchMock = mockGeo({ country: 'US', region: 'CA' });
    renderLink(<BookLink source="fanduel" placement="player-line" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('FanDuel')).toBeInTheDocument();
    // And it does not cost a geo request: there is nothing to gate.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fetch geo for an unknown book id either', () => {
    const fetchMock = mockGeo({ country: 'US', region: 'CA' });
    renderLink(<BookLink source="nosuchbook" placement="player-line" />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('BookLink — one geo request per page', () => {
  it('shares a single lookup across many links', async () => {
    const fetchMock = mockGeo({ country: 'US', region: 'CA' });
    renderLink(
      <>
        <BookLink source="prizepicks" placement="player-line" />
        <BookLink source="underdog" placement="variant-ladder" />
        <BookLink source="sleeper" placement="market-edge" />
      </>,
    );

    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(3));
    // One shared query key ⇒ one request, however many books are named.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/geo');
  });
});
