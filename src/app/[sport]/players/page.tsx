import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { PlayerBrowser } from '@/components/PlayerBrowser';
import { SportSelect } from '@/components/SportSelect';
import { searchPlayers } from '@/lib/server/players';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import type { PlayerListItem } from '@/lib/types';
import { RelatedLinks } from '@/components/RelatedLinks';
import { sportMeshLinks } from '@/lib/relatedLinks';

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
    description: `Browse and filter every ${cfg.name} player by team, position, or name for prop research — hit rates, matchups, and confidence.`,
    alternates: { canonical: `/${sport}/players` },
  };
}

// Whole roster — ~600 NBA / ~1250 MLB — shipped to the client for instant,
// complete team/position/name filtering (a high cap, not a real page size).
const ROSTER_LIMIT = 5000;

export default async function PlayersPage({ params, searchParams }: PageProps) {
  const { sport: raw } = await params;
  if (!isSport(raw)) notFound();
  const sport: Sport = raw;
  const cfg = SPORTS[sport];

  // ?q= from the no-JS SearchForm — pre-filters the initial (SSR'd) render.
  const sp = await searchParams;
  const initialQuery = typeof sp.q === 'string' ? sp.q.trim() : '';

  let players: PlayerListItem[] = [];
  try {
    players = await searchPlayers(sport, undefined, ROSTER_LIMIT);
  } catch {
    // DB unavailable — render the empty state rather than erroring.
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-2 py-8 sm:px-4">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Home', href: '/' },
          { label: cfg.name, href: `/${sport}` },
          { label: 'Players' },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">{cfg.name} players</h1>
        <SportSelect section="players" value={sport} />
      </div>
      <p className="mb-5 text-sm text-muted">
        {players.length > 0
          ? `Search and filter all ${players.length} ${cfg.name} players by team, position, or name.`
          : `Browse ${cfg.name} players by team, position, or name.`}
      </p>

      {players.length === 0 ? (
        <p className="text-sm text-muted">
          No players available yet. Run the ingest to populate data.
        </p>
      ) : (
        <PlayerBrowser sport={sport} players={players} initialQuery={initialQuery} />
      )}

      <RelatedLinks links={sportMeshLinks(sport, 'players')} />
    </div>
  );
}
