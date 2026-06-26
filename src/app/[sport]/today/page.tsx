import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { TonightSlate } from '@/components/TonightSlate';
import { FilterableBoard } from '@/components/FilterableBoard';
import { SourcedBoard } from '@/components/SourcedBoard';
import { getTonightSlate, getBoard, getSourcedBoards } from '@/lib/server/players';
import { getAvailableSources } from '@/lib/server/providedLines';
import { DEFAULT_PROVIDED_SOURCE, sourceLabel } from '@/lib/providedSources';
import { formatIsoDate } from '@/lib/format';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { TonightGame, BoardRow } from '@/lib/types';
import { RelatedLinks } from '@/components/RelatedLinks';
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
  const isNfl = sport === 'nfl';
  const title = `${cfg.name} Games ${isNfl ? 'This Week' : 'Today'} — Players to Research`;
  const description = `${isNfl ? "This week's" : "Today's"} ${cfg.name} schedule with the strongest recent-form player-prop leans on the slate, from public game logs. Research, not picks — confirm who's active yourself.`;
  return {
    title,
    description,
    alternates: { canonical: `/${sport}/today` },
    openGraph: { type: 'website', title, description, url: `/${sport}/today` },
  };
}

export default async function TodayPage({ params }: PageProps) {
  const { sport: raw } = await params;
  if (!isSport(raw)) notFound();
  const sport: Sport = raw;
  const cfg = SPORTS[sport];
  // NFL plays weekly (Thu–Mon), so the "today" slate is framed as the week.
  const slateWord = sport === 'nfl' ? 'This Week' : 'Today';

  const sources = await getAvailableSources(sport).catch((): string[] => []);
  const hasSources = sources.length > 0;
  const initialSource = sources.includes(DEFAULT_PROVIDED_SOURCE)
    ? DEFAULT_PROVIDED_SOURCE
    : (sources[0] ?? DEFAULT_PROVIDED_SOURCE);

  let slate: { date: string | null; games: TonightGame[] } = { date: null, games: [] };
  let board: BoardRow[] = [];
  let boardsBySource: Record<string, BoardRow[]> = {};
  try {
    if (hasSources) {
      [slate, boardsBySource] = await Promise.all([
        getTonightSlate(sport),
        getSourcedBoards(sport, sources, { limit: 150, perStatCap: 30 }),
      ]);
    } else {
      [slate, board] = await Promise.all([
        getTonightSlate(sport),
        getBoard(sport, { limit: 150, perStatCap: 30 }),
      ]);
    }
  } catch {
    // DB unavailable — render the empty state.
  }

  const tonightTeams = new Set(
    slate.games.flatMap((g) => [g.home.abbr, g.away.abbr]).filter((a): a is string => !!a),
  );
  const onSlate = (r: BoardRow): boolean =>
    !!r.player.teamAbbreviation && tonightTeams.has(r.player.teamAbbreviation);
  // Leans on the slate, filtered per book (or the single fallback board).
  const leansBySource: Record<string, BoardRow[]> = {};
  for (const s of sources) leansBySource[s] = (boardsBySource[s] ?? []).filter(onSlate);
  const leans = board.filter(onSlate);
  const hasLeans = hasSources ? Object.values(leansBySource).some((r) => r.length > 0) : leans.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Home', href: '/' },
          { label: cfg.name, href: `/${sport}` },
          { label: slateWord },
        ]}
      />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          {cfg.name} {slateWord}
        </h1>
        {slate.date && <span className="text-sm text-muted">{formatIsoDate(slate.date)}</span>}
      </div>

      {slate.games.length === 0 ? (
        <p className="mt-8 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No {cfg.name} games scheduled right now (likely the off-season). Meanwhile, browse the{' '}
          <Link href={`/${sport}/board`} className="text-brand hover:text-brand-strong">
            Top Leans board
          </Link>{' '}
          or{' '}
          <Link href={`/${sport}/players`} className="text-brand hover:text-brand-strong">
            all {cfg.name} players
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3 text-xs leading-relaxed text-sig-amber">
            We don&rsquo;t track who&rsquo;s active — <strong>confirm starting lineups, scratches,
            and injuries yourself</strong> before betting. The schedule updates nightly, not live.
          </div>

          <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted">
            Matchups
          </h2>
          <TonightSlate sport={sport} games={slate.games} />

          {hasLeans && (
            <>
              <div className="mb-2 mt-8 flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Top leans {sport === 'nfl' ? 'this week' : <>on today&rsquo;s slate</>}
                </h2>
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                  experimental
                </span>
              </div>
              <p className="mb-3 text-xs text-muted">
                Strongest recent-form leans for players on{' '}
                {sport === 'nfl' ? <>this week&rsquo;s</> : <>today&rsquo;s</>} teams, vs{' '}
                {hasSources ? (
                  <>the real {sourceLabel(initialSource)} line (switch books below)</>
                ) : (
                  <>our typical line (not a sportsbook line)</>
                )}
                . Open a player to enter the real number.
              </p>
              {hasSources ? (
                <SourcedBoard
                  sport={sport}
                  boardsBySource={leansBySource}
                  sources={sources}
                  defaultSource={initialSource}
                  heading={null}
                  initialVisible={20}
                />
              ) : (
                <FilterableBoard sport={sport} rows={leans} initialVisible={20} />
              )}
            </>
          )}
        </>
      )}

      <RelatedLinks links={sportMeshLinks(sport, 'today')} />

      <p className="mt-6 text-xs leading-relaxed text-muted">
        Descriptive research from public game logs — not predictions, picks, or betting advice.
      </p>
    </div>
  );
}
