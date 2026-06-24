import type { Metadata } from 'next';
import { SearchForm } from '@/components/SearchForm';
import { PlayerCard } from '@/components/PlayerCard';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { searchPlayers } from '@/lib/server/players';
import type { PlayerListItem } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Players',
  description:
    'Search and browse NBA players for prop research — hit rates, matchups, and confidence.',
  alternates: { canonical: '/players' },
};

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function PlayersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';

  let players: PlayerListItem[] = [];
  try {
    players = await searchPlayers(q || undefined, 60);
  } catch {
    // DB unavailable — render the search box with an empty result set.
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: 'Players' }]}
      />
      <h1 className="mb-4 text-2xl font-bold tracking-tight">
        {q ? `Players matching “${q}”` : 'Players'}
      </h1>

      <div className="mb-6">
        <SearchForm defaultValue={q} />
      </div>

      {players.length === 0 ? (
        <p className="text-sm text-muted">
          {q
            ? `No players found for “${q}”. Try a last name like “Jokic” or “Edwards”.`
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
