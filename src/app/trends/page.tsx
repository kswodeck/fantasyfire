import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SportSelect } from '@/components/SportSelect';
import { AllTrendsExplorer } from '@/components/AllTrendsExplorer';
import { getAllSportsTrends } from '@/lib/server/allSports';
import { DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';
import type { AllSportsTrends } from '@/lib/server/allSports';

export const revalidate = 21600; // 6h — matches the per-sport Trends cadence (egress-heavy scans)

export const metadata: Metadata = {
  title: 'Player Trends — All Sports Form Swings & Streaks',
  description:
    'Players across every in-season league whose last-10 over/under rate has swung hardest from their season baseline — merged into one board and ranked by a 95% Wilson lower bound, with each streak shown alongside. Research, not picks.',
  alternates: { canonical: '/trends' },
  openGraph: { type: 'website', title: 'Player Trends — All Sports', url: '/trends' },
};

export default async function AllTrendsPage() {
  let data: AllSportsTrends = { bySource: {}, sources: [], rows: [], anyUpcoming: false };
  try {
    data = await getAllSportsTrends();
  } catch {
    // DB unavailable — render the empty state.
  }
  const { bySource, sources, rows, anyUpcoming } = data;
  const initialSource = sources.includes(DEFAULT_PROVIDED_SOURCE)
    ? DEFAULT_PROVIDED_SOURCE
    : (sources[0] ?? DEFAULT_PROVIDED_SOURCE);
  const hasTrends = Object.values(bySource).some((r) => r.length > 0) || rows.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-2 py-8 sm:px-4">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: 'Trends' }]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Player Trends — All Sports</h1>
        <SportSelect section="trends" value="all" includeAll />
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Players across every in-season league whose{' '}
        <span className="text-foreground">last-10 form</span> has swung hardest from their
        season baseline, merged into one board and ranked by the lower bound of a 95%
        Wilson interval. Each row is tagged with its sport.
      </p>

      {!anyUpcoming || !hasTrends ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No trends across any sport right now. Browse the season&rsquo;s{' '}
          <Link href="/nba/leaders" className="text-brand hover:text-brand-strong">
            leaders
          </Link>{' '}
          instead, or open a single sport above.
        </p>
      ) : (
        <div className="mt-6">
          <AllTrendsExplorer
            bySource={bySource}
            sources={sources}
            defaultSource={initialSource}
            medianRows={rows}
          />
        </div>
      )}

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Descriptive research from public game logs — a recent swing describes past games
        and does not predict the next one. Not predictions, picks, or betting advice.
      </p>
    </div>
  );
}
