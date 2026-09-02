// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookCta } from './BookCta';

afterEach(cleanup);

/**
 * BookCta is the component that decides whether a paid link appears at all, so
 * these tests are really about one question: does it ever render a call to action
 * the reader cannot act on?
 *
 * Each test gets its own QueryClient — a shared one would serve the first test's
 * cached region to the rest.
 */
function renderCta(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function mockGeo(body: { country: string | null; region: string | null }) {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify(body), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const CTA = 'Open this line on PrizePicks';

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('BookCta — renders', () => {
  it('shows the CTA as a link where the product is offered', async () => {
    mockGeo({ country: 'US', region: 'TX' });
    renderCta(
      <BookCta source="prizepicks" placement="player-cta">
        {CTA}
      </BookCta>,
    );

    const link = await screen.findByRole('link', { name: CTA });
    expect(link).toHaveAttribute('href', expect.stringContaining('https://'));
    expect(link.getAttribute('rel')).toContain('sponsored');
  });

  it('shows it while geo is still unknown (fails open, like every other path)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('blocked');
      }),
    );
    renderCta(
      <BookCta source="prizepicks" placement="player-cta">
        {CTA}
      </BookCta>,
    );
    expect(await screen.findByRole('link', { name: CTA })).toBeInTheDocument();
  });
});

describe('BookCta — renders NOTHING rather than dead text', () => {
  // This is the distinction that justifies the component existing. BookLink
  // degrades a book's NAME to plain text, which reads fine mid-sentence. A CTA
  // degraded the same way would leave the sentence "Open this line on PrizePicks"
  // sitting on the page as inert prose, which is just noise.
  it('renders nothing where the product is not offered', async () => {
    mockGeo({ country: 'US', region: 'MI' });
    const { container } = renderCta(
      <BookCta source="prizepicks" placement="player-cta">
        {CTA}
      </BookCta>,
    );

    await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument());
    // Not merely unlinked — gone. The CTA text must not survive as plain prose.
    expect(screen.queryByText(CTA)).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a book with no deal, and costs no geo request', () => {
    const fetchMock = mockGeo({ country: 'US', region: 'TX' });
    const { container } = renderCta(
      <BookCta source="fanduel" placement="player-cta">
        Open this line on FanDuel
      </BookCta>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Open this line/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders nothing for an unknown book id', () => {
    mockGeo({ country: 'US', region: 'TX' });
    const { container } = renderCta(
      <BookCta source="nosuchbook" placement="player-cta">
        Open this line
      </BookCta>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('BookCta — placement', () => {
  it('passes its placement through to the link', async () => {
    mockGeo({ country: 'US', region: 'TX' });
    renderCta(
      <BookCta source="prizepicks" placement="player-cta">
        {CTA}
      </BookCta>,
    );
    // data-book is BookLink's marker — proves the CTA delegates rather than
    // hand-rolling its own anchor, which is what keeps rel/tracking in one place.
    const link = await screen.findByRole('link', { name: CTA });
    expect(link).toHaveAttribute('data-book', 'prizepicks');
  });
});
