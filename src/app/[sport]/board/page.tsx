import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { BoardExplorer } from '@/components/BoardExplorer';
import { getBoard, getSourcedBoards, getTonightSlate, hasUpcomingGames } from '@/lib/server/players';
import { getAvailableSources } from '@/lib/server/providedLines';
import { DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { BoardRow, TonightGame } from '@/lib/types';
import { RelatedLinks } from '@/components/RelatedLinks';
import { OffSeasonFallback } from '@/components/OffSeasonFallback';
import { sportMeshLinks } from '@/lib/relatedLinks';

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
  const title = `${cfg.name} Heat Check — Today's Slate & Player Props`;
  const description = `The strongest recent-form ${cfg.name} player-prop reads, ranked by a sample-size-adjusted FireFactor from public game logs. Filter to today's slate or a single matchup, switch books, and open any player for the full read. Research, not picks.`;
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
  // NFL plays weekly, so "today's slate" is framed as the week.
  const slateWord = sport === 'nfl' ? 'This week' : 'Today';

  // Off-season (no scheduled games) → the auto board's "current" reads are stale,
  // so we show a season-leaders fallback instead. Default to in-season on error.
  const upcoming = await hasUpcomingGames(sport).catch(() => true);

  // Real book lines available for this sport (PrizePicks, Underdog, …). Empty when
  // the feature is off / nothing's ingested — then we fall back to our median line.
  const sources = upcoming ? await getAvailableSources(sport).catch((): string[] => []) : [];
  const hasSources = sources.length > 0;
  const initialSource = sources.includes(DEFAULT_PROVIDED_SOURCE)
    ? DEFAULT_PROVIDED_SOURCE
    : (sources[0] ?? DEFAULT_PROVIDED_SOURCE);

  // One board per book (ranked vs that book's real line) + the slate, so the client
  // can switch books / toggle today / filter by matchup instantly (static/ISR).
  let boardsBySource: Record<string, BoardRow[]> = {};
  let medianRows: BoardRow[] = [];
  let slate: { date: string | null; games: TonightGame[] } = { date: null, games: [] };
  if (upcoming) {
    try {
      if (hasSources) {
        [slate, boardsBySource] = await Promise.all([
          getTonightSlate(sport),
          getSourcedBoards(sport, sources, { limit: 150, perStatCap: 30 }),
        ]);
      } else {
        [slate, medianRows] = await Promise.all([
          getTonightSlate(sport),
          getBoard(sport, { limit: 150, perStatCap: 30 }),
        ]);
      }
    } catch {
      // DB unavailable — render the empty state.
    }
  }

  const hasBoard = hasSources
    ? Object.values(boardsBySource).some((r) => r.length > 0)
    : medianRows.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Home', href: '/' },
          { label: cfg.name, href: `/${sport}` },
          { label: 'Heat Check' },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight">{cfg.name} Heat Check</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        The strongest recent-form reads across the most active {cfg.name} players, ranked by our
        sample-size-adjusted <strong className="text-foreground">FireFactor</strong>.{' '}
        {hasSources ? (
          <>Lines are the real book numbers — switch books with the selector. </>
        ) : (
          <>The lines shown are our own typical-game (median) line, not a sportsbook line. </>
        )}
        Filter to {slateWord.toLowerCase()}&rsquo;s slate or a single matchup, and open a player to
        enter your own line and odds.
      </p>

      {!upcoming ? (
        <div className="mt-6">
          <OffSeasonFallback sport={sport} what="live reads" />
        </div>
      ) : hasBoard || slate.games.length > 0 ? (
        <div className="mt-6">
          <BoardExplorer
            sport={sport}
            boardsBySource={boardsBySource}
            sources={sources}
            defaultSource={initialSource}
            medianRows={medianRows}
            games={slate.games}
            slateWord={slateWord}
            slateDate={slate.date}
          />
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No board data yet — check back after the next nightly update, or{' '}
          <Link href={`/${sport}/players`} className="text-brand hover:text-brand-strong">
            browse all {cfg.name} players
          </Link>
          .
        </p>
      )}

      <RelatedLinks links={sportMeshLinks(sport, 'board')} />

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Descriptive research from public game logs, ranked by a sample-size–adjusted FireFactor (recent
        hit rate vs the line, discounted for thin samples via a 95% Wilson interval) — not
        predictions, picks, or betting advice. We don&rsquo;t track who&rsquo;s active; confirm
        lineups, scratches, and injuries yourself.
      </p>
    </div>
  );
}
