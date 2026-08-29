import type { MetadataRoute } from 'next';
import { getPlayerSlugsWithFreshness, getPropStatParams } from '@/lib/server/players';
import { absoluteUrl } from '@/lib/site';
import { SPORT_LIST, type Sport } from '@/lib/sports';

export const revalidate = 21600; // 6h — regenerating queries every player; hourly is wasteful egress

const newer = (a: Date | null, b: Date | null): Date | null =>
  a && b ? (a > b ? a : b) : (a ?? b);

// Stats with a leaders page.
const LEADER_STATS: Record<Sport, string[]> = {
  nba: ['pts', 'reb', 'ast', 'fg3m', 'stl', 'blk', 'pra'],
  mlb: ['hits', 'tb', 'hr', 'rbi', 'runs', 'sb', 'bb', 'so'],
  nfl: ['passYds', 'passTds', 'rushYds', 'rushTds', 'rec', 'recYds', 'recTds'],
  nhl: ['pts', 'goals', 'ast', 'sog', 'nhlHits', 'blocked', 'saves'],
  wnba: ['pts', 'reb', 'ast', 'fg3m', 'stl', 'blk', 'pra'],
  mls: ['goals', 'ast', 'shots', 'sot', 'saves'],
  cfb: ['passYds', 'passTds', 'rushYds', 'rushTds', 'rec', 'recYds', 'recTds'],
  cbb: ['pts', 'reb', 'ast', 'fg3m', 'stl', 'blk', 'pra'],
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const playerEntries: MetadataRoute.Sitemap = [];
  const sportEntries: MetadataRoute.Sitemap = [];
  let freshestOverall: Date | null = null;

  // Every sport's two queries, all fetched together. This walked SPORT_LIST serially
  // and awaited the two calls one after the other inside each sport — 16 serial round
  // trips to build one document. They are mutually independent, so the only thing that
  // changes is how much of the waiting overlaps.
  //
  // Each call keeps its OWN catch, matching the old behaviour where the player entries
  // were already pushed before the prop query ran: a failure in one half must not
  // discard the other, and a sport whose queries fail still contributes its static
  // sport entries below. (DB unavailable during a revalidation — still return routes.)
  const perSport = await Promise.all(
    SPORT_LIST.map(async (sport) => {
      // Promise.all, not two awaits in sequence — these do not depend on each other.
      const [players, propParams] = await Promise.all([
        getPlayerSlugsWithFreshness(sport).catch(() => []),
        // Per-stat prop pages for the most-active players (capped, valid combos only
        // — so the sitemap never lists a 404 or balloons into 20k+ URLs).
        getPropStatParams(sport, 120).catch(() => []),
      ]);
      return { sport, players, propParams };
    }),
  );

  for (const { sport, players, propParams } of perSport) {
    let freshestForSport: Date | null = null;
    for (const { slug, lastGameDate } of players) {
      playerEntries.push({
        url: absoluteUrl(`/${sport}/${slug}`),
        changeFrequency: 'daily',
        priority: 0.7,
        ...(lastGameDate ? { lastModified: lastGameDate } : {}),
      });
      freshestForSport = newer(freshestForSport, lastGameDate);
    }
    for (const { slug, stat } of propParams) {
      playerEntries.push({
        url: absoluteUrl(`/${sport}/${slug}/${stat}`),
        changeFrequency: 'daily',
        priority: 0.6,
        lastModified: freshestForSport ?? now,
      });
    }
    freshestOverall = newer(freshestOverall, freshestForSport);
    const sportMod = freshestForSport ?? now;
    sportEntries.push(
      {
        url: absoluteUrl(`/${sport}`),
        changeFrequency: 'daily',
        priority: 0.9,
        lastModified: sportMod,
      },
      {
        url: absoluteUrl(`/${sport}/players`),
        changeFrequency: 'daily',
        priority: 0.8,
        lastModified: sportMod,
      },
      {
        url: absoluteUrl(`/${sport}/trends`),
        changeFrequency: 'daily',
        priority: 0.7,
        lastModified: sportMod,
      },
      {
        url: absoluteUrl(`/${sport}/matchups`),
        changeFrequency: 'daily',
        priority: 0.7,
        lastModified: sportMod,
      },
      {
        url: absoluteUrl(`/${sport}/accuracy`),
        changeFrequency: 'daily',
        priority: 0.6,
        lastModified: sportMod,
      },
      ...LEADER_STATS[sport].map((stat) => ({
        url: absoluteUrl(`/${sport}/leaders/${stat}`),
        changeFrequency: 'daily' as const,
        priority: 0.6,
        lastModified: sportMod,
      })),
    );
  }

  const homeMod = freshestOverall ?? now;

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/'),
      changeFrequency: 'daily',
      priority: 1,
      lastModified: homeMod,
    },
    {
      url: absoluteUrl('/board'),
      changeFrequency: 'daily',
      priority: 0.9,
      lastModified: homeMod,
    },
    {
      url: absoluteUrl('/trends'),
      changeFrequency: 'daily',
      priority: 0.7,
      lastModified: homeMod,
    },
    {
      url: absoluteUrl('/accuracy'),
      changeFrequency: 'daily',
      priority: 0.7,
      lastModified: homeMod,
    },
    {
      url: absoluteUrl('/how-it-works'),
      changeFrequency: 'monthly',
      priority: 0.6,
      lastModified: now,
    },
    {
      url: absoluteUrl('/faq'),
      changeFrequency: 'monthly',
      priority: 0.5,
      lastModified: now,
    },
    {
      url: absoluteUrl('/about'),
      changeFrequency: 'monthly',
      priority: 0.4,
      lastModified: now,
    },
    {
      url: absoluteUrl('/books'),
      changeFrequency: 'monthly',
      priority: 0.4,
      lastModified: now,
    },
    {
      url: absoluteUrl('/responsible-gaming'),
      changeFrequency: 'yearly',
      priority: 0.3,
      lastModified: now,
    },
    {
      url: absoluteUrl('/privacy'),
      changeFrequency: 'yearly',
      priority: 0.2,
      lastModified: now,
    },
    {
      url: absoluteUrl('/terms'),
      changeFrequency: 'yearly',
      priority: 0.2,
      lastModified: now,
    },
  ];

  return [...staticPages, ...sportEntries, ...playerEntries];
}
