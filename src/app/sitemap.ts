import type { MetadataRoute } from 'next';
import { getPlayerSlugsWithFreshness, getPropStatParams } from '@/lib/server/players';
import { absoluteUrl } from '@/lib/site';
import { SPORT_LIST, type Sport } from '@/lib/sports';

export const revalidate = 3600;

const newer = (a: Date | null, b: Date | null): Date | null =>
  a && b ? (a > b ? a : b) : (a ?? b);

// Stats with a leaders page.
const LEADER_STATS: Record<Sport, string[]> = {
  nba: ['pts', 'reb', 'ast', 'fg3m', 'stl', 'blk', 'pra'],
  mlb: ['hits', 'tb', 'hr', 'rbi', 'runs', 'sb', 'bb', 'so'],
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const playerEntries: MetadataRoute.Sitemap = [];
  const sportEntries: MetadataRoute.Sitemap = [];
  let freshestOverall: Date | null = null;

  for (const sport of SPORT_LIST) {
    let freshestForSport: Date | null = null;
    try {
      const players = await getPlayerSlugsWithFreshness(sport);
      for (const { slug, lastGameDate } of players) {
        playerEntries.push({
          url: absoluteUrl(`/${sport}/${slug}`),
          changeFrequency: 'daily',
          priority: 0.7,
          ...(lastGameDate ? { lastModified: lastGameDate } : {}),
        });
        freshestForSport = newer(freshestForSport, lastGameDate);
      }
      // Per-stat prop pages for the most-active players (capped, valid combos
      // only — so the sitemap never lists a 404 or balloons into 20k+ URLs).
      const propParams = await getPropStatParams(sport, 120);
      for (const { slug, stat } of propParams) {
        playerEntries.push({
          url: absoluteUrl(`/${sport}/${slug}/${stat}`),
          changeFrequency: 'daily',
          priority: 0.6,
          lastModified: freshestForSport ?? now,
        });
      }
    } catch {
      // DB unavailable during a revalidation — still return the static routes.
    }
    freshestOverall = newer(freshestOverall, freshestForSport);
    const sportMod = freshestForSport ?? now;
    sportEntries.push(
      { url: absoluteUrl(`/${sport}`), changeFrequency: 'daily', priority: 0.9, lastModified: sportMod },
      { url: absoluteUrl(`/${sport}/players`), changeFrequency: 'daily', priority: 0.8, lastModified: sportMod },
      { url: absoluteUrl(`/${sport}/board`), changeFrequency: 'daily', priority: 0.8, lastModified: sportMod },
      { url: absoluteUrl(`/${sport}/today`), changeFrequency: 'daily', priority: 0.8, lastModified: sportMod },
      { url: absoluteUrl(`/${sport}/streaks`), changeFrequency: 'daily', priority: 0.7, lastModified: sportMod },
      { url: absoluteUrl(`/${sport}/trends`), changeFrequency: 'daily', priority: 0.7, lastModified: sportMod },
      { url: absoluteUrl(`/${sport}/matchups`), changeFrequency: 'daily', priority: 0.7, lastModified: sportMod },
      { url: absoluteUrl(`/${sport}/accuracy`), changeFrequency: 'daily', priority: 0.6, lastModified: sportMod },
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
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1, lastModified: homeMod },
    { url: absoluteUrl('/how-it-works'), changeFrequency: 'monthly', priority: 0.6, lastModified: now },
    { url: absoluteUrl('/methodology'), changeFrequency: 'monthly', priority: 0.6, lastModified: now },
    { url: absoluteUrl('/faq'), changeFrequency: 'monthly', priority: 0.5, lastModified: now },
    { url: absoluteUrl('/glossary'), changeFrequency: 'monthly', priority: 0.5, lastModified: now },
    { url: absoluteUrl('/about'), changeFrequency: 'monthly', priority: 0.4, lastModified: now },
    { url: absoluteUrl('/contact'), changeFrequency: 'yearly', priority: 0.3, lastModified: now },
    { url: absoluteUrl('/responsible-gaming'), changeFrequency: 'yearly', priority: 0.3, lastModified: now },
    { url: absoluteUrl('/privacy'), changeFrequency: 'yearly', priority: 0.2, lastModified: now },
    { url: absoluteUrl('/terms'), changeFrequency: 'yearly', priority: 0.2, lastModified: now },
  ];

  return [...staticPages, ...sportEntries, ...playerEntries];
}
