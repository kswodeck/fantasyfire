import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { TonightSlate } from '@/components/TonightSlate';
import { FilterableBoard } from '@/components/FilterableBoard';
import { getTonightSlate, getBoard } from '@/lib/server/players';
import { formatIsoDate } from '@/lib/format';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { TonightGame, BoardRow } from '@/lib/types';

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
  const title = `${cfg.name} Games Today — Players to Research`;
  const description = `Today's ${cfg.name} schedule with the strongest recent-form player-prop leans on the slate, from public game logs. Research, not picks — confirm who's active yourself.`;
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

  let slate: { date: string | null; games: TonightGame[] } = { date: null, games: [] };
  let board: BoardRow[] = [];
  try {
    [slate, board] = await Promise.all([
      getTonightSlate(sport),
      getBoard(sport, { limit: 150, perStatCap: 30 }),
    ]);
  } catch {
    // DB unavailable — render the empty state.
  }

  const tonightTeams = new Set(
    slate.games.flatMap((g) => [g.home.abbr, g.away.abbr]).filter((a): a is string => !!a),
  );
  const leans = board.filter(
    (r) => r.player.teamAbbreviation && tonightTeams.has(r.player.teamAbbreviation),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Home', href: '/' },
          { label: cfg.name, href: `/${sport}` },
          { label: 'Today' },
        ]}
      />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{cfg.name} Today</h1>
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
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3 text-xs leading-relaxed text-amber-200/90">
            We don&rsquo;t track who&rsquo;s active — <strong>confirm starting lineups, scratches,
            and injuries yourself</strong> before betting. The schedule updates nightly, not live.
          </div>

          <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted">
            Matchups
          </h2>
          <TonightSlate sport={sport} games={slate.games} />

          {leans.length > 0 && (
            <>
              <div className="mb-2 mt-8 flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Top leans on today&rsquo;s slate
                </h2>
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                  experimental
                </span>
              </div>
              <p className="mb-3 text-xs text-muted">
                Strongest recent-form leans for players on today&rsquo;s teams, vs our typical line
                (not a sportsbook line). Open a player to enter the real number.
              </p>
              <FilterableBoard sport={sport} rows={leans} initialVisible={20} />
            </>
          )}
        </>
      )}

      <p className="mt-6 text-xs leading-relaxed text-muted">
        Descriptive research from public game logs — not predictions, picks, or betting advice. 21+.
        Problem gambling? Call 1-800-GAMBLER.
      </p>
    </div>
  );
}
