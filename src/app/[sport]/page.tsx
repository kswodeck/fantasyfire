import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FlameMark } from '@/components/FlameMark';
import { SearchForm } from '@/components/SearchForm';
import { BoardTable } from '@/components/BoardTable';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getBoard, getSportSummary } from '@/lib/server/players';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';

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
  const title = `${cfg.name} Player Props & Hit Rates`;
  const description = `${cfg.name} prop research: ${cfg.tagline} Hit rates, matchups, sample-size confidence, and fair-price math from public game logs.`;
  return {
    title,
    description,
    alternates: { canonical: `/${sport}` },
    openGraph: { type: 'website', title, description, url: `/${sport}` },
  };
}

export default async function SportHome({ params }: PageProps) {
  const { sport: raw } = await params;
  if (!isSport(raw)) notFound();
  const sport: Sport = raw;
  const cfg = SPORTS[sport];

  let leans: BoardRow[] = [];
  let summary: { players: number; games: number; season: string } | null = null;
  try {
    [leans, summary] = await Promise.all([
      getBoard(sport, { limit: 9 }),
      getSportSummary(sport),
    ]);
  } catch {
    // DB unavailable — render the hero without the leans.
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <div className="px-0 pt-6">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: cfg.name }]} />
      </div>

      <section className="flex flex-col items-center gap-5 py-12 text-center">
        <FlameMark className="h-12 w-12" style={{ color: cfg.accent }} />
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          {cfg.name} player-prop research
        </h1>
        <p className="max-w-xl text-lg text-muted">{cfg.tagline}</p>
        <div className="w-full max-w-xl">
          <SearchForm sport={sport} />
        </div>
        {summary && (
          <p className="text-sm text-muted">
            {summary.players} players · {summary.games} games · season {summary.season}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/${sport}/today`}
            className="rounded-full px-5 py-2 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
            style={{ backgroundColor: cfg.accent }}
          >
            {cfg.name} Today →
          </Link>
          <Link
            href={`/${sport}/board`}
            className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2"
          >
            Top Leans board
          </Link>
        </div>
      </section>

      {leans.length > 0 && (
        <section className="mx-auto max-w-3xl pb-10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {cfg.name} Top Leans
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium normal-case text-muted">
              experimental
            </span>
          </h2>
          <BoardTable sport={sport} rows={leans} />
          <Link
            href={`/${sport}/board`}
            className="mt-4 inline-block text-sm font-medium text-brand transition-colors hover:text-brand-strong"
          >
            See the full {cfg.name} board →
          </Link>
        </section>
      )}
    </div>
  );
}
