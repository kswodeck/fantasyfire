import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SportSelect } from '@/components/SportSelect';
import { AllSportsNav } from '@/components/AllSportsNav';
import { AccuracyExplorer } from '@/components/AccuracyExplorer';
import { getAllSportsAccuracy } from '@/lib/server/recap';
import type { AccuracyLedger } from '@/lib/types';

// 6h — matches the per-sport ledgers' cache window (this merges them in memory,
// adding no scans), so regenerating faster would only re-serve the same data.
export const revalidate = 21600;

export const metadata: Metadata = {
  title: 'FireFactor Accuracy — Settled Leans, Every Sport',
  description:
    "How FantasyFire's FireFactor leans actually settled across every in-season league, day by day: each slate's strongest pre-game recent-form reads checked against the real box scores. Recomputed from public game logs — descriptive facts, not a track record or picks.",
  alternates: { canonical: '/accuracy' },
  openGraph: { type: 'website', title: 'FireFactor Accuracy', url: '/accuracy' },
};

export default async function AllAccuracyPage() {
  let ledger: AccuracyLedger | null = null;
  try {
    ledger = await getAllSportsAccuracy();
  } catch {
    // DB unavailable — render the empty state.
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-2 py-8 sm:px-4">
      <AllSportsNav />
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: 'Accuracy' }]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">FireFactor Accuracy</h1>
        <SportSelect section="accuracy" value="all" includeAll />
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        The settled ledger across every in-season league: each recent slate&rsquo;s strongest
        pre-game <strong className="text-foreground">FireFactor</strong> leans — recomputed
        from only the game logs available <em>before</em> that slate — checked against what
        actually happened. Each row is tagged with its sport; pick a single league above.
      </p>

      {!ledger || ledger.days.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No settled leans across any sport right now. Check back after tonight&rsquo;s games
          settle, or open a single sport&rsquo;s{' '}
          <Link href="/mlb/accuracy" className="text-brand hover:text-brand-strong">
            accuracy ledger
          </Link>
          .
        </p>
      ) : (
        <AccuracyExplorer
          days={ledger.days}
          breakdown={ledger.breakdown}
          showSport
          daysAreSample
        />
      )}

      <p className="mt-6 text-xs leading-relaxed text-muted">
        How to read this honestly: rows are recomputed after the fact from the same public
        game logs the live board uses, settled at the line a book actually posted for that
        slate where we still have it (hover a line to see which) and at our own book-style
        half-point line otherwise. They omit the matchup / Vegas / pace context the live board
        folds in, because that context can&rsquo;t be faithfully reconstructed later — so
        these are conservative reads. A small sample of settled days proves nothing either
        way; the point is transparency, not a win-rate claim. Descriptive research — never
        predictions, picks, or betting advice. See{' '}
        <Link href="/methodology" className="text-brand hover:text-brand-strong">
          the methodology
        </Link>{' '}
        for the exact math.
      </p>
    </div>
  );
}
