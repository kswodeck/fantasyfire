import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FilterableBoard } from '@/components/FilterableBoard';
import { SourcedBoard } from '@/components/SourcedBoard';
import { SlatePaster } from '@/components/SlatePaster';
import { getBoard, getSourcedBoards, hasUpcomingGames } from '@/lib/server/players';
import { getAvailableSources } from '@/lib/server/providedLines';
import { DEFAULT_PROVIDED_SOURCE, sourceLabel } from '@/lib/providedSources';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';
import { RelatedLinks } from '@/components/RelatedLinks';
import { OffSeasonFallback } from '@/components/OffSeasonFallback';
import { sportMeshLinks } from '@/lib/relatedLinks';

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
  const title = `${cfg.name} Top Leans — FantasyFire Board`;
  const description = `The strongest recent-form ${cfg.name} player-prop leans, ranked by a sample-size-adjusted FireScore from public game logs — a research starting point, not picks or betting advice.`;
  return {
    title,
    description,
    alternates: { canonical: `/${sport}/board` },
    openGraph: { type: 'website', title, description, url: `/${sport}/board` },
  };
}

export default async function BoardPage({ params }: PageProps) {
  const { sport: raw } = await params;
  if (!isSport(raw)) notFound();
  const sport: Sport = raw;
  const cfg = SPORTS[sport];

  // Off-season (no scheduled games) → the auto board's "current" leans are stale,
  // so we show a season-leaders fallback instead. Default to in-season on error.
  const upcoming = await hasUpcomingGames(sport).catch(() => true);

  // Real book lines available for this sport (PrizePicks, Underdog, …). Empty when
  // the feature is off / nothing's ingested — then we fall back to our median line.
  const sources = upcoming ? await getAvailableSources(sport).catch(() => []) : [];
  const hasSources = sources.length > 0;
  const initialSource = sources.includes(DEFAULT_PROVIDED_SOURCE)
    ? DEFAULT_PROVIDED_SOURCE
    : (sources[0] ?? DEFAULT_PROVIDED_SOURCE);

  // Pre-compute one board per book (ranked vs that book's real line) so the dropdown
  // switches instantly and the page stays static/ISR. No sources → a single board
  // vs our median line (prior behavior).
  let boardsBySource: Record<string, BoardRow[]> = {};
  let rows: BoardRow[] = [];
  if (upcoming) {
    try {
      if (hasSources) {
        // One player+games load → a pure-slate board per book (no extra egress
        // per book; switching books is a client-side swap of pre-rendered rows).
        boardsBySource = await getSourcedBoards(sport, sources, { limit: 150, perStatCap: 30 });
        rows = boardsBySource[initialSource] ?? [];
      } else {
        rows = await getBoard(sport, { limit: 150, perStatCap: 30 });
      }
    } catch {
      // DB unavailable — fall through to the empty state rather than erroring.
      rows = [];
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Home', href: '/' },
          { label: cfg.name, href: `/${sport}` },
          { label: 'Board' },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight">{cfg.name} Top Leans</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        The strongest recent-form leans across the most active {cfg.name} players, ranked by our
        sample-size-adjusted <strong className="text-foreground">FireScore</strong>.{' '}
        {hasSources ? (
          <>
            Lines are the real numbers from{' '}
            <strong className="text-foreground">{sourceLabel(initialSource)}</strong> — switch books
            with the selector below. Open a player to enter your own line and odds for the full read.
          </>
        ) : (
          <>
            The lines shown are{' '}
            <strong className="text-foreground">our own typical-game (median) line</strong>, not a
            sportsbook line — so this is a research starting point. Open a player to enter the real line
            and odds for the full read.
          </>
        )}
      </p>

      <div className="mt-6">
        <SlatePaster sport={sport} />
      </div>

      {!upcoming ? (
        <OffSeasonFallback sport={sport} what="live top leans" />
      ) : (
        <>
          {rows.length === 0 ? (
            <p className="mt-2 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
              No board data yet — check back after the next nightly update, or{' '}
              <Link href={`/${sport}/players`} className="text-brand hover:text-brand-strong">
                browse all {cfg.name} players
              </Link>
              .
            </p>
          ) : (
            <div className="mt-5">
              {hasSources ? (
                <SourcedBoard
                  sport={sport}
                  boardsBySource={boardsBySource}
                  sources={sources}
                  defaultSource={initialSource}
                />
              ) : (
                <>
                  <h2 className="mb-2 mt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Auto board — strongest leans vs our typical line
                  </h2>
                  <FilterableBoard sport={sport} rows={rows} />
                </>
              )}
            </div>
          )}
        </>
      )}

      <RelatedLinks links={sportMeshLinks(sport, 'board')} />

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Descriptive research from public game logs, ranked by a sample-size–adjusted FireScore (recent
        hit rate vs the line, discounted for thin samples via a 95% Wilson interval) — not predictions,
        picks, or betting advice.
      </p>
    </div>
  );
}
