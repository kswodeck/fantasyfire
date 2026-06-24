import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FlameMark } from '@/components/FlameMark';
import { SearchForm } from '@/components/SearchForm';
import { PlayerCard } from '@/components/PlayerCard';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { searchPlayers, getSportSummary } from '@/lib/server/players';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { PlayerListItem } from '@/lib/types';

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

  let trending: PlayerListItem[] = [];
  let summary: { players: number; games: number; season: string } | null = null;
  try {
    [trending, summary] = await Promise.all([
      searchPlayers(sport, undefined, 12),
      getSportSummary(sport),
    ]);
  } catch {
    // DB unavailable — render the hero without the trending grid.
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
        <Link
          href={`/${sport}/board`}
          className="rounded-full px-5 py-2 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
          style={{ backgroundColor: cfg.accent }}
        >
          {cfg.name} Top Leans →
        </Link>
      </section>

      {trending.length > 0 && (
        <section className="pb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Most active {cfg.name} players
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trending.map((p) => (
              <PlayerCard key={p.slug} player={p} />
            ))}
          </div>
          <Link
            href={`/${sport}/players`}
            className="mt-4 inline-block text-sm font-medium text-brand transition-colors hover:text-brand-strong"
          >
            Browse all {cfg.name} players →
          </Link>
        </section>
      )}
    </div>
  );
}
