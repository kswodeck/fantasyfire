import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { BoardExplorer } from '@/components/BoardExplorer';
import { SearchForm } from '@/components/SearchForm';
import { SportHubTiles } from '@/components/SportHubTiles';
import { SportSelect } from '@/components/SportSelect';
import {
  getBoard,
  getInjuryReport,
  getSourcedBoardsAndTrends,
  getTonightSlate,
  hasUpcomingGames,
} from '@/lib/server/players';
import { getAvailableSources } from '@/lib/server/providedLines';
import { DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';
import { isOverOnly } from '@/lib/payoutVariant';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { BoardRow, InjuryReportRow, TonightGame, TrendRow } from '@/lib/types';
import { RelatedLinks } from '@/components/RelatedLinks';
import { OffSeasonFallback } from '@/components/OffSeasonFallback';
import { sportMeshLinks } from '@/lib/relatedLinks';

export const revalidate = 900; // 15 min — matches the lines ingest cadence, bounding board↔player-page score skew to one cycle
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
    alternates: { canonical: `/${sport}` },
    openGraph: { type: 'website', title, description, url: `/${sport}` },
  };
}

/**
 * The sport home IS the Heat Check — the full board (filters, matchups, every read)
 * with player search above it and the section tiles (Trends, Injuries, Players, …)
 * below. The old /[sport]/board URL permanently redirects here (next.config.ts), so
 * there is exactly one ranked list per sport instead of a hub that mirrored it.
 */
export default async function SportHome({ params }: PageProps) {
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
  const sources = upcoming
    ? await getAvailableSources(sport).catch((): string[] => [])
    : [];
  const hasSources = sources.length > 0;
  const initialSource = sources.includes(DEFAULT_PROVIDED_SOURCE)
    ? DEFAULT_PROVIDED_SOURCE
    : (sources[0] ?? DEFAULT_PROVIDED_SOURCE);

  // One board per book (ranked vs that book's real line) + the slate, so the client
  // can switch books / toggle today / filter by matchup instantly (static/ISR). The
  // Trends tile's headline row shares the boards' pool load (no extra egress).
  let boardsBySource: Record<string, BoardRow[]> = {};
  let medianRows: BoardRow[] = [];
  let slate: { date: string | null; games: TonightGame[] } = { date: null, games: [] };
  let topTrend: TrendRow | null = null;
  if (upcoming) {
    try {
      if (hasSources) {
        const [s, { boards, trends }] = await Promise.all([
          getTonightSlate(sport),
          getSourcedBoardsAndTrends(sport, sources, { limit: 150, perStatCap: 30 }, { limit: 3 }),
        ]);
        slate = s;
        boardsBySource = boards;
        // The tile headlines a STANDARD-line trend when one exists (matching the
        // site-wide standard-first default); variant-only swings are the fallback.
        const trendList = trends[initialSource] ?? [];
        topTrend = trendList.find((r) => !isOverOnly(r.oddsType ?? null)) ?? trendList[0] ?? null;
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
  let injuries: InjuryReportRow[] = [];
  try {
    injuries = await getInjuryReport(sport);
  } catch {
    // Injuries are a nice-to-have on the tile — degrade to the static hint.
  }

  const hasBoard = hasSources
    ? Object.values(boardsBySource).some((r) => r.length > 0)
    : medianRows.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-2 py-8 sm:px-4">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: cfg.name }]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{cfg.name} Heat Check</h1>
        <SportSelect section="board" value={sport} includeAll />
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        The strongest recent-form reads across the most active {cfg.name} players, ranked
        by our sample-size-adjusted{' '}
        <strong className="text-foreground">FireFactor</strong>.{' '}
        {hasSources ? (
          <>Lines are the real book numbers — switch books with the selector. </>
        ) : (
          <>
            The lines shown are our own typical-game (median) line, not a sportsbook
            line.{' '}
          </>
        )}
        Filter to {slateWord.toLowerCase()}&rsquo;s slate or a single matchup, and open a
        player to enter your own line and odds.
      </p>

      <div className="mt-4 max-w-xl">
        <SearchForm sport={sport} />
      </div>

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

      {/* Section hub — Trends, Injuries, Players, Leaders, Matchups at a glance. */}
      <section aria-labelledby="explore-heading" className="mt-10">
        <h2
          id="explore-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted"
        >
          Explore {cfg.name}
        </h2>
        <SportHubTiles
          sport={sport}
          games={slate.games}
          slateWord={slateWord}
          injuries={injuries}
          topTrend={topTrend}
        />
      </section>

      <RelatedLinks links={sportMeshLinks(sport, 'board')} />

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Descriptive research from public game logs, ranked by a sample-size–adjusted
        FireFactor (recent hit rate vs the line, discounted for thin samples via a 95%
        Wilson interval) — not predictions, picks, or betting advice. We don&rsquo;t track
        who&rsquo;s active; confirm lineups, scratches, and injuries yourself.
      </p>
    </div>
  );
}
