import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SportSelect } from '@/components/SportSelect';
import { AllBoardExplorer } from '@/components/AllBoardExplorer';
import { getAllSportsBoard } from '@/lib/server/allSports';
import { DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';
import type { AllSportsBoard } from '@/lib/server/allSports';

export const revalidate = 900; // 15 min — matches the per-sport Heat Check cadence

export const metadata: Metadata = {
  title: 'Heat Check — Player Props Ranked by FireFactor',
  description:
    'The strongest recent-form player-prop reads across every in-season league, merged into one board and ranked by our sample-size-adjusted FireFactor. Switch books or pick a single sport. Research, not picks.',
  alternates: { canonical: '/board' },
  openGraph: { type: 'website', title: 'Heat Check', url: '/board' },
};

export default async function AllBoardPage() {
  let data: AllSportsBoard = {
    boardsBySource: {},
    sources: [],
    medianRows: [],
    todayTeamsBySport: {},
    anyUpcoming: false,
  };
  try {
    data = await getAllSportsBoard();
  } catch {
    // DB unavailable — render the empty state.
  }
  const { boardsBySource, sources, medianRows, todayTeamsBySport, anyUpcoming } = data;
  const initialSource = sources.includes(DEFAULT_PROVIDED_SOURCE)
    ? DEFAULT_PROVIDED_SOURCE
    : (sources[0] ?? DEFAULT_PROVIDED_SOURCE);
  const hasBoard =
    Object.values(boardsBySource).some((r) => r.length > 0) || medianRows.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-2 py-8 sm:px-4">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: 'Heat Check' }]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Heat Check</h1>
        <SportSelect section="board" value="all" includeAll />
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        The strongest recent-form reads across every in-season league, merged into one
        board and ranked by our sample-size-adjusted{' '}
        <strong className="text-foreground">FireFactor</strong>. Each row is tagged with
        its sport — switch books with the selector, or pick a single sport above.
      </p>

      {!anyUpcoming || !hasBoard ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No games on the board across any sport right now. Browse the season&rsquo;s{' '}
          <Link href="/nba/leaders" className="text-brand hover:text-brand-strong">
            leaders
          </Link>{' '}
          instead, or open a single sport above.
        </p>
      ) : (
        <div className="mt-6">
          <AllBoardExplorer
            boardsBySource={boardsBySource}
            sources={sources}
            defaultSource={initialSource}
            medianRows={medianRows}
            todayTeamsBySport={todayTeamsBySport}
          />
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-muted">
        Descriptive research from public game logs, ranked by a sample-size–adjusted
        FireFactor — not predictions, picks, or betting advice. We don&rsquo;t track
        who&rsquo;s active; confirm lineups, scratches, and injuries yourself.
      </p>
    </div>
  );
}
