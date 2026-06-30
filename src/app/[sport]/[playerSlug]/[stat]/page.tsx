import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getPropStatParams, getPlayerBySlug, getPlayerResearch } from '@/lib/server/players';
import { getAvailableSources } from '@/lib/server/providedLines';
import { DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';
import { absoluteUrl } from '@/lib/site';
import { formatIsoDate, pct } from '@/lib/format';
import { getTeam } from '@/lib/teams';
import { currentSeason } from '@/lib/season';
import { breadcrumbList, datasetNode, graph } from '@/lib/jsonLd';
import { STAT_DEFS, statKeysForSport, defaultStatForSport, type StatKey } from '@/lib/stats';
import { PROP_STATS, isPropStat } from '@/lib/propStats';
import { SPORT_LIST, SPORTS, isSport, type Sport } from '@/lib/sports';
import { PlayerResearchClient } from '@/components/PlayerResearchClient';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { TeamLogo } from '@/components/TeamLogo';
import { PlayerBioBar } from '@/components/PlayerBioBar';
import { FavoriteToggle } from '@/components/FavoriteToggle';
import { ShareButton } from '@/components/ShareButton';
import { EmbedButton } from '@/components/EmbedButton';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks } from '@/components/RelatedLinks';
import { JsonLd } from '@/components/JsonLd';

// Daily, not hourly: the per-stat hit rates derive from game logs that change once
// a day after games finish, so hourly ISR regeneration across the crawled long tail
// just re-emitted identical HTML and burned Vercel ISR Writes. /board stays the live
// intraday surface; see the player page note on lines + on-demand revalidation.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  const lists = await Promise.all(
    SPORT_LIST.map(async (sport) => {
      const params = await getPropStatParams(sport, 60);
      return params.map(({ slug, stat }) => ({ sport, playerSlug: slug, stat }));
    }),
  );
  return lists.flat();
}

type PageProps = { params: Promise<{ sport: string; playerSlug: string; stat: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sport, playerSlug, stat } = await params;
  if (!isSport(sport)) return { title: 'Player not found' };
  const player = await getPlayerBySlug(sport, playerSlug);
  if (!player) return { title: 'Player not found' };
  if (!isPropStat(sport, stat)) {
    return { title: 'Not found' };
  }
  const cfg = SPORTS[sport];
  const label = STAT_DEFS[stat as StatKey].label;
  const teamBit = player.teamAbbreviation ? ` (${player.teamAbbreviation})` : '';
  const title = `${player.fullName} ${label} — Hit Rates & Prop Research`;
  const description =
    `${player.fullName}${teamBit} ${label.toLowerCase()} prop research: over/under hit rates across ` +
    `L5/L10/L20 and the full season, matchup context, and sample-size confidence — from public ` +
    `${cfg.name} game logs.`;
  return {
    title,
    description,
    alternates: { canonical: `/${sport}/${player.slug}/${stat}` },
    openGraph: { type: 'profile', title, description, url: `/${sport}/${player.slug}/${stat}` },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function PlayerStatPage({ params }: PageProps) {
  const { sport: raw, playerSlug, stat: rawStat } = await params;
  if (!isSport(raw)) notFound();
  const sport: Sport = raw;
  const cfg = SPORTS[sport];
  if (!isPropStat(sport, rawStat)) notFound();

  const availableSources = await getAvailableSources(sport);
  const initialSource = availableSources.includes(DEFAULT_PROVIDED_SOURCE)
    ? DEFAULT_PROVIDED_SOURCE
    : (availableSources[0] ?? DEFAULT_PROVIDED_SOURCE);
  const research = await getPlayerResearch(sport, playerSlug, rawStat as StatKey, undefined, initialSource);
  if (!research) notFound();
  // getPlayerResearch silently falls back to the default stat for an invalid one
  // (incl. a stat not offered for this player's position); require the requested
  // stat to be the one returned (else 404, no thin dupes).
  if (research.stat !== rawStat) notFound();

  // The role-specific default stat lives on the base player page — redirect there.
  const defaultStat = defaultStatForSport(sport, research.player.posBucket);
  if (rawStat === defaultStat) redirect(`/${sport}/${playerSlug}`);

  const stat = research.stat;
  const label = STAT_DEFS[stat].label;
  const short = STAT_DEFS[stat].short;
  const { player } = research;
  const team = getTeam(sport, player.teamAbbreviation);
  const basePath = `/${sport}/${player.slug}`;

  const l10 = research.windows.find((w) => w.window === '10')?.hitRate ?? null;
  const seasonStartYear = Number(currentSeason(sport).slice(0, 4));
  const experience = research.bio.fromYear
    ? Math.max(1, seasonStartYear - research.bio.fromYear + 1)
    : null;

  const answer =
    l10 && l10.decided > 0
      ? `${player.fullName} has gone over ${research.line} ${short} in ${l10.overs} of his last ${l10.decided} decided games (${pct(l10.hitRateOver ?? 0)}), measured against our typical-game line.`
      : `${player.fullName} ${label.toLowerCase()} hit rates and matchup research from public game logs.`;

  const siblingStats = statKeysForSport(sport, research.player.posBucket).filter(
    (s) => PROP_STATS[sport].includes(s) && s !== stat && s !== defaultStat,
  );

  const jsonLd = graph([
    {
      '@type': 'Person',
      name: player.fullName,
      ...(player.teamName ? { affiliation: { '@type': 'SportsTeam', name: player.teamName } } : {}),
      url: absoluteUrl(basePath),
    },
    breadcrumbList([
      { name: 'Home', path: '/' },
      { name: cfg.name, path: `/${sport}` },
      { name: 'Players', path: `/${sport}/players` },
      { name: player.fullName, path: basePath },
      { name: label, path: `${basePath}/${stat}` },
    ]),
    datasetNode({
      name: `${player.fullName} ${label} hit rates`,
      description: `${player.fullName} per-game ${label.toLowerCase()} and over/under hit rates, ${cfg.name}, from public game logs.`,
      path: `${basePath}/${stat}`,
      dateModified: research.lastGameDate,
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Home', href: '/' },
          { label: cfg.name, href: `/${sport}` },
          { label: 'Players', href: `/${sport}/players` },
          { label: player.fullName, href: basePath },
          { label },
        ]}
      />

      <header
        className="mb-4 overflow-hidden rounded-2xl border border-line"
        style={{
          background: `linear-gradient(120deg, color-mix(in srgb, ${team.primary} 22%, var(--surface)) 0%, var(--surface) 62%)`,
        }}
      >
        <div className="flex items-center gap-4 p-5">
          <PlayerAvatar
            sport={sport}
            externalId={player.externalId}
            name={player.fullName}
            size={72}
            ring={team.primary}
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
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {player.fullName} {label}
            </h1>
            {research.lastGameDate && (
              <p className="mt-1 text-xs text-muted">
                Stats updated: {formatIsoDate(research.lastGameDate)} — nightly box scores, not live.
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

      {/* One-sentence computed answer — the featured-snippet / AI-Overview target. */}
      <p className="mb-5 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed">
        {answer}
      </p>

      <PlayerBioBar bio={research.bio} experience={experience} sport={sport} />

      <PlayerResearchClient
        slug={player.slug}
        initialResearch={research}
        initialStat={stat}
        statHrefBase={basePath}
        availableSources={availableSources}
        initialSource={initialSource}
      />

      <RelatedLinks
        title={`More ${player.fullName} research`}
        links={[
          { label: `${player.fullName} — full profile`, href: basePath, hint: 'Every stat, splits, chart, and matchup.' },
          ...siblingStats.slice(0, 4).map((s) => ({
            label: `${player.lastName} ${STAT_DEFS[s].label}`,
            href: `${basePath}/${s}`,
            hint: `${STAT_DEFS[s].label} hit rates and trends.`,
          })),
          {
            label: sport === 'mlb' ? 'Pitching Allowed by team' : 'Defense vs Position',
            href: `/${sport}/matchups`,
            hint: 'Which opponents inflate or suppress this prop.',
          },
          { label: `${cfg.name} Heat Check`, href: `/${sport}/board`, hint: 'The strongest reads across the league.' },
        ]}
      />

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Descriptive research from public game logs — hit rates describe past games and are not
        predictions, picks, or betting advice.
      </p>
    </div>
  );
}
