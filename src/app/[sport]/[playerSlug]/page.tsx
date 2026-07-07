import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTopPlayerSlugs, getPlayerBySlug, getPlayerResearch } from '@/lib/server/players';
import { getAvailableSources } from '@/lib/server/providedLines';
import { DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';
import { absoluteUrl } from '@/lib/site';
import { formatIsoDate } from '@/lib/format';
import { getTeam } from '@/lib/teams';
import { currentSeason } from '@/lib/season';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import { PlayerResearchClient } from '@/components/PlayerResearchClient';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { TeamLogo } from '@/components/TeamLogo';
import { PlayerBioBar } from '@/components/PlayerBioBar';
import { FavoriteToggle } from '@/components/FavoriteToggle';
import { ShareButton } from '@/components/ShareButton';
import { EmbedButton } from '@/components/EmbedButton';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, MoreLinksRow } from '@/components/RelatedLinks';
import { sportMeshLinks } from '@/lib/relatedLinks';
import { PROP_STATS } from '@/lib/propStats';
import { STAT_DEFS, statKeysForSport } from '@/lib/stats';

// ISR: statically generate the busiest players, revalidate daily; the rest
// render on-demand. The page content (hit rates from game logs, season research)
// only changes once a day after games finish, so hourly regeneration just burned
// Vercel ISR Writes re-emitting identical HTML across the whole crawled long tail.
// The live intraday surface is /board (30 min); provided book lines are off by
// default. If they're enabled and you need fresher per-player lines, prefer
// on-demand revalidation from the providedlines ingest over shrinking this window.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  // DB-resilient: with no reachable database (e.g. a Vercel preview, whose env
  // has no DATABASE_URL) prerender nothing — dynamicParams=true renders every
  // player on demand instead, so the BUILD always succeeds. A production build
  // with a healthy DB still prerenders the busiest players as before.
  try {
    const lists = await Promise.all(
      SPORT_LIST.map(async (sport) => {
        const slugs = await getTopPlayerSlugs(sport, 100);
        return slugs.map((playerSlug) => ({ sport, playerSlug }));
      }),
    );
    return lists.flat();
  } catch (e) {
    console.warn('[build] player prerender list unavailable (DB unreachable?):', e instanceof Error ? e.message : e);
    return [];
  }
}

type PageProps = {
  params: Promise<{ sport: string; playerSlug: string }>;
};

// The marquee markets named in the meta description, per sport.
const STATS_BIT: Record<Sport, string> = {
  nba: 'points, rebounds, assists, 3PM and PRA',
  wnba: 'points, rebounds, assists, 3PM and PRA',
  mlb: 'hits, home runs, RBIs, total bases and strikeout',
  nfl: 'passing yards, rushing yards, receptions, receiving yards and touchdown',
  nhl: 'shots on goal, points, goals, assists and saves',
  mls: 'shots, shots on target, goals, assists and saves',
  cfb: 'passing yards, rushing yards, receptions, receiving yards and touchdown',
  cbb: 'points, rebounds, assists, 3PM and PRA',
};

const JOB_TITLE: Record<Sport, string> = {
  nba: 'Basketball Player',
  wnba: 'Basketball Player',
  mlb: 'Baseball Player',
  nfl: 'Football Player',
  nhl: 'Hockey Player',
  mls: 'Soccer Player',
  cfb: 'Football Player',
  cbb: 'Basketball Player',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sport, playerSlug } = await params;
  if (!isSport(sport)) return { title: 'Player not found' };
  const player = await getPlayerBySlug(sport, playerSlug);
  if (!player) return { title: 'Player not found' };

  const cfg = SPORTS[sport];
  const teamBit = player.teamAbbreviation ? ` (${player.teamAbbreviation})` : '';
  const statsBit = STATS_BIT[sport];
  const title = `${player.fullName} — Hit Rates, Props & Matchup Research`;
  const description =
    `${player.fullName}${teamBit} prop research: ${statsBit} hit rates over recent ` +
    `windows and the full season, matchup context, and sample-size confidence — ` +
    `from public ${cfg.name} game logs.`;

  return {
    title,
    description,
    alternates: { canonical: `/${sport}/${player.slug}` },
    openGraph: { type: 'profile', title, description, url: `/${sport}/${player.slug}` },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function PlayerPage({ params }: PageProps) {
  const { sport: raw, playerSlug } = await params;
  if (!isSport(raw)) notFound();
  const sport: Sport = raw;
  const cfg = SPORTS[sport];

  // SSR the default-stat payload so the page stays static/ISR (SEO + speed). The
  // client reads stat/line from the URL on mount and takes over interactivity.
  // Default to the user's preferred book (PrizePicks) when available.
  const availableSources = await getAvailableSources(sport);
  const initialSource = availableSources.includes(DEFAULT_PROVIDED_SOURCE)
    ? DEFAULT_PROVIDED_SOURCE
    : (availableSources[0] ?? DEFAULT_PROVIDED_SOURCE);
  const research = await getPlayerResearch(sport, playerSlug, undefined, undefined, initialSource);
  if (!research) notFound();

  const { player } = research;
  const team = getTeam(sport, player.teamAbbreviation);
  const seasonStartYear = Number(currentSeason(sport).slice(0, 4));
  const experience = research.bio.fromYear
    ? Math.max(1, seasonStartYear - research.bio.fromYear + 1)
    : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        name: player.fullName,
        jobTitle: JOB_TITLE[sport],
        ...(player.teamName
          ? { affiliation: { '@type': 'SportsTeam', name: player.teamName } }
          : {}),
        url: absoluteUrl(`/${sport}/${player.slug}`),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: cfg.name, item: absoluteUrl(`/${sport}`) },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Players',
            item: absoluteUrl(`/${sport}/players`),
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: player.fullName,
            item: absoluteUrl(`/${sport}/${player.slug}`),
          },
        ],
      },
      {
        '@type': 'Dataset',
        name: `${player.fullName} game-by-game stats & hit rates`,
        description:
          `Per-game ${cfg.name} box-score stats and over/under hit rates for ` +
          `${player.fullName}, computed from public game logs.`,
        url: absoluteUrl(`/${sport}/${player.slug}`),
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: 'FantasyFire' },
        ...(research.lastGameDate ? { dateModified: research.lastGameDate } : {}),
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

      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Home', href: '/' },
          { label: cfg.name, href: `/${sport}` },
          { label: 'Players', href: `/${sport}/players` },
          { label: player.fullName },
        ]}
      />

      <header
        className="mb-6 overflow-hidden rounded-2xl border border-line"
        style={{
          background: `linear-gradient(120deg, color-mix(in srgb, ${team.primary} 22%, var(--surface)) 0%, var(--surface) 62%)`,
        }}
      >
        <div className="flex items-center gap-4 p-5">
          <PlayerAvatar
            sport={sport}
            externalId={player.externalId}
            name={player.fullName}
            size={84}
            ring={team.primary}
            priority
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm text-muted">
              <TeamLogo
                sport={sport}
                externalId={player.teamExternalId}
                abbr={player.teamAbbreviation}
                size={18}
              />
              <span className="truncate">{player.teamName ?? player.teamAbbreviation}</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{player.fullName}</h1>
            <p className="mt-1 text-sm text-muted">
              {[
                player.jersey ? `#${player.jersey}` : null,
                player.position,
                player.height,
                player.weight ? `${player.weight} lb` : null,
                `${research.gamesPlayed} games`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {research.lastGameDate && (
              <p className="mt-1 text-xs text-muted">
                Stats updated: {formatIsoDate(research.lastGameDate)} — nightly box
                scores, not live.
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2 self-start">
            <FavoriteToggle
              sport={sport}
              slug={player.slug}
              name={player.fullName}
              team={player.teamAbbreviation}
            />
            <ShareButton />
            {/* <EmbedButton sport={sport} slug={player.slug} /> */}
          </div>
        </div>
      </header>

      <PlayerBioBar bio={research.bio} experience={experience} sport={sport} />

      <PlayerResearchClient
        slug={player.slug}
        initialResearch={research}
        initialStat={research.stat}
        availableSources={availableSources}
        initialSource={initialSource}
      />

      {/* The player's other prop pages — a compact link row (not big tiles) so it
          doesn't duplicate the stat selector above, while keeping the crawlable
          internal-link mesh into the per-stat SEO pages. */}
      <MoreLinksRow
        label={`More ${player.lastName} props`}
        links={statKeysForSport(sport, player.posBucket)
          .filter((s) => PROP_STATS[sport].includes(s) && s !== research.stat)
          .map((s) => ({
            label: STAT_DEFS[s].label,
            href: `/${sport}/${player.slug}/${s}`,
          }))}
      />

      {/* Keep exploring — only links to genuinely different pages. */}
      <RelatedLinks links={sportMeshLinks(sport).slice(0, 5)} />
    </div>
  );
}
