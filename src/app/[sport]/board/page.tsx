import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FilterableBoard } from '@/components/FilterableBoard';
import { SlatePaster } from '@/components/SlatePaster';
import { getBoard } from '@/lib/server/players';
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

  let rows: BoardRow[] = [];
  try {
    rows = await getBoard(sport, { limit: 150, perStatCap: 30 });
  } catch {
    // DB unavailable — fall through to the empty state rather than erroring.
    rows = [];
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
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{cfg.name} Top Leans</h1>
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
          experimental
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        The strongest recent-form leans across the most active {cfg.name} players, ranked by our
        sample-size-adjusted <strong className="text-foreground">FireScore</strong>. The lines shown are{' '}
        <strong className="text-foreground">our own typical-game (median) line</strong>, not a sportsbook
        line — so this is a research starting point. Open a player to enter the real line and odds for the full
        read. See how these leans have actually held up on the{' '}
        <Link href={`/${sport}/accuracy`} className="text-brand hover:text-brand-strong">
          accuracy page
        </Link>
        .
      </p>

      <div className="mt-6">
        <SlatePaster sport={sport} />
      </div>

      <h2 className="mb-2 mt-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Auto board — strongest leans vs our typical line
      </h2>

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
          <FilterableBoard sport={sport} rows={rows} />
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Descriptive research from public game logs, ranked by a sample-size–adjusted FireScore (recent
        hit rate vs the line, discounted for thin samples via a 95% Wilson interval) — not predictions,
        picks, or betting advice. 21+. Problem gambling? Call 1-800-GAMBLER.
      </p>
    </div>
  );
}
