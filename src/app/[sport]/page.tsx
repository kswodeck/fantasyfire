import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FlameMark } from '@/components/FlameMark';
import { SearchForm } from '@/components/SearchForm';
import { BoardTable } from '@/components/BoardTable';
import { SourcedBoardTable } from '@/components/SourcedBoardTable';
import { HomeLeadersFallback } from '@/components/HomeLeadersFallback';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getBoard, getSourcedBoards, hasUpcomingGames } from '@/lib/server/players';
import { getAvailableSources } from '@/lib/server/providedLines';
import { DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';

export const revalidate = 1800; // 30 min — keep the leans close to the ~15-min lines ingest (prod is on Pro; board reads are optimized)
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

  // The heat-check describes upcoming/current games, so gate it on the schedule: with
  // nothing on the board the provided lines are for games that already happened. When
  // there are no upcoming games we show a season-leaders fallback instead of stale picks.
  const upcoming = await hasUpcomingGames(sport).catch(() => true);

  // Prefer real book lines (PrizePicks / Underdog / …) with a per-book dropdown; fall
  // back to our computed median line only when no book lines are ingested.
  let sources: string[] = [];
  let boardsBySource: Record<string, BoardRow[]> = {};
  let leans: BoardRow[] = [];
  let initialSource = DEFAULT_PROVIDED_SOURCE;
  if (upcoming) {
    try {
      sources = await getAvailableSources(sport);
      if (sources.length > 0) {
        initialSource = sources.includes(DEFAULT_PROVIDED_SOURCE) ? DEFAULT_PROVIDED_SOURCE : sources[0];
        boardsBySource = await getSourcedBoards(sport, sources, { limit: 9 });
        leans = boardsBySource[initialSource] ?? [];
      } else {
        leans = await getBoard(sport, { limit: 9 });
      }
    } catch {
      // DB unavailable — render the hero without the leans.
    }
  }
  const hasSources = sources.length > 0;
  const hasHeatCheck = upcoming && (hasSources || leans.length > 0);

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
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/${sport}/board`}
            className="rounded-full px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: cfg.accent }}
          >
            {cfg.name} Heat Check →
          </Link>
          <Link
            href={`/${sport}/players`}
            className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2"
          >
            Browse all players
          </Link>
        </div>
      </section>

      {hasHeatCheck ? (
        <section className="mx-auto max-w-3xl pb-10">
          {hasSources ? (
            <SourcedBoardTable
              sport={sport}
              boardsBySource={boardsBySource}
              sources={sources}
              defaultSource={initialSource}
              heading={
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                  {cfg.name} Heat Check
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium normal-case text-muted">
                    experimental
                  </span>
                </h2>
              }
            />
          ) : (
            <>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                {cfg.name} Heat Check
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium normal-case text-muted">
                  experimental
                </span>
              </h2>
              <BoardTable sport={sport} rows={leans} />
            </>
          )}
          <Link
            href={`/${sport}/board`}
            className="mt-4 inline-block text-sm font-medium text-brand transition-colors hover:text-brand-strong"
          >
            See the full {cfg.name} board →
          </Link>
        </section>
      ) : !upcoming ? (
        <section className="mx-auto max-w-3xl pb-10">
          <HomeLeadersFallback sport={sport} />
        </section>
      ) : null}
    </div>
  );
}
