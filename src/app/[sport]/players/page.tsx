import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SearchForm } from '@/components/SearchForm';
import { PlayerCard } from '@/components/PlayerCard';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { searchPlayers } from '@/lib/server/players';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { PlayerListItem } from '@/lib/types';

export const dynamicParams = false;

export function generateStaticParams() {
  return SPORT_LIST.map((sport) => ({ sport }));
}

type PageProps = {
  params: Promise<{ sport: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sport } = await params;
  if (!isSport(sport)) return { title: 'Not found' };
  const cfg = SPORTS[sport];
  return {
    title: `${cfg.name} Players`,
    description: `Search and browse ${cfg.name} players for prop research — hit rates, matchups, and confidence.`,
    alternates: { canonical: `/${sport}/players` },
  };
}

export default async function PlayersPage({ params, searchParams }: PageProps) {
  const { sport: raw } = await params;
  if (!isSport(raw)) notFound();
  const sport: Sport = raw;
  const cfg = SPORTS[sport];

  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';

  let players: PlayerListItem[] = [];
  try {
    players = await searchPlayers(sport, q || undefined, 60);
  } catch {
    // DB unavailable — render the search box with an empty result set.
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Home', href: '/' },
          { label: cfg.name, href: `/${sport}` },
          { label: 'Players' },
        ]}
      />
      <h1 className="mb-4 text-2xl font-bold tracking-tight">
        {q ? `${cfg.name} players matching “${q}”` : `${cfg.name} players`}
      </h1>

      <div className="mb-6">
        <SearchForm sport={sport} defaultValue={q} />
      </div>

      {players.length === 0 ? (
        <p className="text-sm text-muted">
          {q
            ? `No players found for “${q}”. Try a last name.`
            : 'No players available yet. Run the ingest to populate data.'}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {players.map((p) => (
            <PlayerCard key={p.slug} player={p} />
          ))}
        </div>
      )}
    </div>
  );
}
