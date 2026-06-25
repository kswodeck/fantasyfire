import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FilterableTrends } from '@/components/FilterableTrends';
import { FreshnessNote } from '@/components/FreshnessNote';
import { RelatedLinks } from '@/components/RelatedLinks';
import { OffSeasonFallback } from '@/components/OffSeasonFallback';
import { getTrendBoard, getDataFreshness, hasUpcomingGames } from '@/lib/server/players';
import { sportMeshLinks } from '@/lib/relatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbList, datasetNode, graph } from '@/lib/jsonLd';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { TrendRow } from '@/lib/types';

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return SPORT_LIST.map((sport) => ({ sport }));
}

type PageProps = { params: Promise<{ sport: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sport } = await params;
  if (!isSport(sport)) return { title: 'Not found' };
  const cfg = SPORTS[sport];
  const title = `${cfg.name} Player Trends — Heating Up & Cooling Off`;
  const description = `${cfg.name} players whose recent (last 10) over/under rate has swung hardest from their season baseline, ranked by a 95% Wilson lower bound so thin hot samples are discounted. Research, not picks.`;
  return {
    title,
    description,
    alternates: { canonical: `/${sport}/trends` },
    openGraph: { type: 'website', title, description, url: `/${sport}/trends` },
  };
}

export default async function TrendsPage({ params }: PageProps) {
  const { sport: raw } = await params;
  if (!isSport(raw)) notFound();
  const sport: Sport = raw;
  const cfg = SPORTS[sport];

  // Off-season (no scheduled games) → last-10 "form" describes a finished season,
  // so we show a season-leaders fallback. Default to in-season on error.
  const upcoming = await hasUpcomingGames(sport).catch(() => true);

  let rows: TrendRow[] = [];
  let freshness: string | null = null;
  try {
    [rows, freshness] = await Promise.all([
      upcoming ? getTrendBoard(sport) : Promise.resolve([]),
      getDataFreshness(sport),
    ]);
  } catch {
    // DB unavailable — render the empty state.
  }

  const jsonLd = graph([
    breadcrumbList([
      { name: 'Home', path: '/' },
      { name: cfg.name, path: `/${sport}` },
      { name: 'Trends', path: `/${sport}/trends` },
    ]),
    datasetNode({
      name: `${cfg.name} player form trends`,
      description: `${cfg.name} players whose last-10 over/under rate has swung most from their season baseline, from public game logs.`,
      path: `/${sport}/trends`,
      dateModified: freshness,
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: cfg.name, href: `/${sport}` }, { label: 'Trends' }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">{cfg.name} Player Trends</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Players whose <span className="text-foreground">last-10 form</span> has swung hardest from their
        season baseline — heating up or cooling off vs their typical line. Ranked by the lower bound of a
        95% Wilson interval, so a tiny hot sample sits below a steadier swing.
      </p>
      <FreshnessNote date={freshness} className="mt-2" />

      {!upcoming ? (
        <OffSeasonFallback sport={sport} what="form trends" />
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No trends to show right now. Check back after the next nightly update.
        </p>
      ) : (
        <div className="mt-5">
          <FilterableTrends sport={sport} rows={rows} />
        </div>
      )}

      <RelatedLinks links={sportMeshLinks(sport, 'trends')} />

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Descriptive research from public game logs — a recent swing describes past games and does not
        predict the next one. Not predictions, picks, or betting advice.
      </p>
    </div>
  );
}
