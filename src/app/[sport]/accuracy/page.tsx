import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SportSelect } from '@/components/SportSelect';
import { AccuracyExplorer } from '@/components/AccuracyExplorer';
import { OffSeasonFallback } from '@/components/OffSeasonFallback';
import { getAccuracyLedger, LEDGER_DAYS } from '@/lib/server/recap';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';

// 6h — matches the ledger's unstable_cache window (the underlying data changes
// once nightly), so regenerating faster would only re-serve the same cache entry.
export const revalidate = 21600;
export const dynamicParams = false;

export function generateStaticParams() {
  return SPORT_LIST.map((sport) => ({ sport }));
}

type PageProps = { params: Promise<{ sport: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sport } = await params;
  if (!isSport(sport)) notFound();
  const cfg = SPORTS[sport];
  const title = `${cfg.name} FireFactor Accuracy — Settled Leans Ledger`;
  const description =
    `How ${cfg.name} FireFactor leans actually settled, day by day: each slate's ` +
    `strongest pre-game recent-form reads checked against the real box scores. ` +
    `Recomputed from public game logs — descriptive facts, not a track record or picks.`;
  return {
    title,
    description,
    alternates: { canonical: `/${sport}/accuracy` },
    openGraph: { type: 'website', title, description, url: `/${sport}/accuracy` },
  };
}

export default async function AccuracyPage({ params }: PageProps) {
  const { sport: raw } = await params;
  if (!isSport(raw)) notFound();
  const sport: Sport = raw;
  const cfg = SPORTS[sport];

  const ledger = await getAccuracyLedger(sport);

  return (
    <div className="mx-auto w-full max-w-3xl px-2 py-8 sm:px-4">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Home', href: '/' },
          { label: cfg.name, href: `/${sport}` },
          { label: 'Accuracy' },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{cfg.name} FireFactor Accuracy</h1>
        <SportSelect section="accuracy" value={sport} includeAll />
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        The settled ledger: for each of the last {LEDGER_DAYS} completed slate days, the
        strongest pre-game <strong className="text-foreground">FireFactor</strong> leans —
        recomputed from only the game logs available <em>before</em>{' '}that slate — checked
        against what actually happened. Every row links to the player&rsquo;s full read.
      </p>

      {!ledger || ledger.days.length === 0 ? (
        <div className="mt-6">
          <OffSeasonFallback sport={sport} what="settled leans" />
        </div>
      ) : (
        <AccuracyExplorer days={ledger.days} breakdown={ledger.breakdown} />
      )}

      <p className="mt-6 text-xs leading-relaxed text-muted">
        How to read this honestly: rows are recomputed after the fact from the same public
        game logs the live board uses, settled at the line a book actually posted for that
        slate where we still have it (hover a line to see which) and at our own book-style
        half-point line otherwise. They omit the matchup / Vegas / pace context the live
        board folds in, because that context can&rsquo;t be faithfully reconstructed later
        — so these are conservative reads. A small sample of settled days proves nothing
        either way; the point is transparency, not a win-rate claim. Descriptive research
        — never predictions, picks, or betting advice. See{' '}
        <Link href="/methodology" className="text-brand hover:text-brand-strong">
          the methodology
        </Link>{' '}
        for the exact math.
      </p>
    </div>
  );
}
