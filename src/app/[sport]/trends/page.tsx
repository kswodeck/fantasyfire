import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FilterableTrends } from '@/components/FilterableTrends';
import { SportSelect } from '@/components/SportSelect';
import { SourcedTrends } from '@/components/SourcedTrends';
import { FreshnessNote } from '@/components/FreshnessNote';
import { RelatedLinks } from '@/components/RelatedLinks';
import { OffSeasonFallback } from '@/components/OffSeasonFallback';
import {
  getTrendBoard,
  getSourcedTrends,
  getDataFreshness,
  getTonightSlate,
  hasUpcomingGames,
} from '@/lib/server/players';
import { getAvailableSources } from '@/lib/server/providedLines';
import { DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';
import { sportMeshLinks } from '@/lib/relatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbList, datasetNode, graph } from '@/lib/jsonLd';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { TonightGame, TrendRow } from '@/lib/types';

export const revalidate = 21600; // 6h — board scans are egress-heavy; matches the lines refresh cadence
export const dynamicParams = false;

export function generateStaticParams() {
  return SPORT_LIST.map((sport) => ({ sport }));
}

type PageProps = { params: Promise<{ sport: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sport } = await params;
  if (!isSport(sport)) return { title: 'Not found' };
  const cfg = SPORTS[sport];
  const title = `${cfg.name} Player Trends — Form Swings & Streaks`;
  const description = `${cfg.name} players whose recent (last 10) over/under rate has swung hardest from their season baseline — ranked by a 95% Wilson lower bound, with each player's current streak shown alongside. Research, not picks.`;
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
  const sources = upcoming ? await getAvailableSources(sport).catch(() => []) : [];
  const hasSources = sources.length > 0;
  const initialSource = sources.includes(DEFAULT_PROVIDED_SOURCE)
    ? DEFAULT_PROVIDED_SOURCE
    : (sources[0] ?? DEFAULT_PROVIDED_SOURCE);

  let rows: TrendRow[] = [];
  let bySource: Record<string, TrendRow[]> = {};
  let freshness: string | null = null;
  let slate: { date: string | null; games: TonightGame[] } = { date: null, games: [] };
  try {
    if (!upcoming) {
      freshness = await getDataFreshness(sport);
    } else if (hasSources) {
      // One pool load → a trends board per book (vs that book's real lines).
      [bySource, freshness, slate] = await Promise.all([
        getSourcedTrends(sport, sources),
        getDataFreshness(sport),
        getTonightSlate(sport).catch(() => ({ date: null, games: [] })),
      ]);
      rows = bySource[initialSource] ?? [];
    } else {
      [rows, freshness] = await Promise.all([
        getTrendBoard(sport),
        getDataFreshness(sport),
      ]);
    }
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
    <div className="mx-auto w-full max-w-3xl px-2 py-8 sm:px-4">
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Home', href: '/' },
          { label: cfg.name, href: `/${sport}` },
          { label: 'Trends' },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{cfg.name} Player Trends</h1>
        <SportSelect section="trends" value={sport} includeAll />
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Players whose <span className="text-foreground">last-10 form</span> has swung
        hardest from their season baseline — heating up or cooling off vs their{' '}
        {hasSources ? `real line` : 'typical line'} — with each player&rsquo;s{' '}
        <span className="text-foreground">current streak</span> shown alongside. Ranked by
        the lower bound of a 95% Wilson interval, so a tiny hot sample sits below a
        steadier swing.
        {hasSources ? ' Switch books with the selector below.' : ''}
      </p>
      <FreshnessNote date={freshness} className="mt-2" />

      {!upcoming ? (
        <OffSeasonFallback sport={sport} what="form trends" />
      ) : hasSources ? (
        <div className="mt-5">
          <SourcedTrends
            sport={sport}
            bySource={bySource}
            sources={sources}
            defaultSource={initialSource}
            games={slate.games}
            slateDate={slate.date}
            slateWord={sport === 'nfl' || sport === 'mls' || sport === 'cfb' ? 'This week' : 'Today'}
          />
        </div>
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
        Descriptive research from public game logs — a recent swing describes past games
        and does not predict the next one. Not predictions, picks, or betting advice.
      </p>
    </div>
  );
}
