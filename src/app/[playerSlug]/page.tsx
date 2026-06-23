import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTopPlayerSlugs, getPlayerBySlug, getPlayerResearch } from '@/lib/server/players';
import { absoluteUrl } from '@/lib/site';
import { PlayerResearchClient } from '@/components/PlayerResearchClient';

// ISR: statically generate all player pages, revalidate hourly.
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  // Pre-render the busiest players; the rest render on-demand via ISR.
  const slugs = await getTopPlayerSlugs(200);
  return slugs.map((playerSlug) => ({ playerSlug }));
}

type PageProps = {
  params: Promise<{ playerSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { playerSlug } = await params;
  const player = await getPlayerBySlug(playerSlug);
  if (!player) return { title: 'Player not found' };

  const teamBit = player.teamAbbreviation ? ` (${player.teamAbbreviation})` : '';
  const title = `${player.fullName} — Hit Rates, Props & Matchup Research`;
  const description =
    `${player.fullName}${teamBit} prop research: points, rebounds, assists, 3PM and PRA ` +
    `hit rates over L5/L10/L20/season, defense-vs-position matchup, and sample-size ` +
    `confidence — from public NBA game logs.`;
  const url = absoluteUrl(`/${player.slug}`);

  return {
    title,
    description,
    alternates: { canonical: `/${player.slug}` },
    openGraph: { type: 'profile', title, description, url },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function PlayerPage({ params }: PageProps) {
  const { playerSlug } = await params;

  // SSR the DEFAULT (points) payload so the page stays static/ISR (SEO + speed).
  // The client reads stat/line from the URL on mount and takes over interactivity
  // against /api/v1 — deep links like ?stat=pra still work after hydration.
  const research = await getPlayerResearch(playerSlug, 'pts');
  if (!research) notFound();

  const { player } = research;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        name: player.fullName,
        jobTitle: 'Basketball Player',
        ...(player.teamName
          ? { affiliation: { '@type': 'SportsTeam', name: player.teamName } }
          : {}),
        url: absoluteUrl(`/${player.slug}`),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Players', item: absoluteUrl('/players') },
          {
            '@type': 'ListItem',
            position: 2,
            name: player.fullName,
            item: absoluteUrl(`/${player.slug}`),
          },
        ],
      },
    ],
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <script
        type="application/ld+json"
        // Escape <, >, & so a player name can never break out of the <script> tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026'),
        }}
      />

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{player.fullName}</h1>
        <p className="mt-1 text-sm text-muted">
          {[
            player.teamAbbreviation,
            player.position,
            player.posBucket ? `${player.posBucket}-bucket` : null,
            `${research.gamesPlayed} games`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      <PlayerResearchClient
        slug={player.slug}
        initialResearch={research}
        initialStat={research.stat}
      />
    </div>
  );
}
