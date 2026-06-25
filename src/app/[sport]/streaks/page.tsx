import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { StreakBoardTable } from '@/components/StreakBoardTable';
import { FreshnessNote } from '@/components/FreshnessNote';
import { RelatedLinks } from '@/components/RelatedLinks';
import { getStreakBoard, getDataFreshness } from '@/lib/server/players';
import { sportMeshLinks } from '@/lib/relatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbList, datasetNode, graph } from '@/lib/jsonLd';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { StreakRow } from '@/lib/types';

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
  const title = `${cfg.name} Prop Streaks — Hot & Cold Player Runs`;
  const description = `Current ${cfg.name} over/under streaks: which players have gone over or under their typical line in the most consecutive games, from public box scores. Updated nightly — research, not picks.`;
  return {
    title,
    description,
    alternates: { canonical: `/${sport}/streaks` },
    openGraph: { type: 'website', title, description, url: `/${sport}/streaks` },
  };
}

export default async function StreaksPage({ params }: PageProps) {
  const { sport: raw } = await params;
  if (!isSport(raw)) notFound();
  const sport: Sport = raw;
  const cfg = SPORTS[sport];

  let rows: StreakRow[] = [];
  let freshness: string | null = null;
  try {
    [rows, freshness] = await Promise.all([getStreakBoard(sport), getDataFreshness(sport)]);
  } catch {
    // DB unavailable — render the empty state.
  }

  const jsonLd = graph([
    breadcrumbList([
      { name: 'Home', path: '/' },
      { name: cfg.name, path: `/${sport}` },
      { name: 'Streaks', path: `/${sport}/streaks` },
    ]),
    datasetNode({
      name: `${cfg.name} player prop streaks`,
      description: `Current ${cfg.name} over/under streaks vs each player's typical line, from public game logs.`,
      path: `/${sport}/streaks`,
      dateModified: freshness,
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: cfg.name, href: `/${sport}` }, { label: 'Streaks' }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">{cfg.name} Prop Streaks</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Players on the longest current run over (or under) their{' '}
        <span className="text-foreground">typical-game (median) line</span> — a quick read on who&rsquo;s
        hot or cold right now. Pushes (games exactly on the line) are skipped, not counted as a miss.
      </p>
      <FreshnessNote date={freshness} className="mt-2" />

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No streaks to show right now (likely the off-season). Check back after the next nightly update.
        </p>
      ) : (
        <div className="mt-5">
          <StreakBoardTable sport={sport} rows={rows} />
        </div>
      )}

      <RelatedLinks links={sportMeshLinks(sport, 'streaks')} />

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Descriptive research from public game logs — a streak describes past games and does not predict
        the next one. Not predictions, picks, or betting advice. 21+. Problem gambling? Call
        1-800-GAMBLER.
      </p>
    </div>
  );
}
