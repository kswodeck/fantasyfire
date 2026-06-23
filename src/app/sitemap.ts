import type { MetadataRoute } from 'next';
import { getAllPlayerSlugs } from '@/lib/server/players';
import { absoluteUrl } from '@/lib/site';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let slugs: string[] = [];
  try {
    slugs = await getAllPlayerSlugs();
  } catch {
    // DB unavailable during a revalidation — still return the static routes.
  }

  const players: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: absoluteUrl(`/${slug}`),
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  return [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1, lastModified: new Date() },
    { url: absoluteUrl('/players'), changeFrequency: 'daily', priority: 0.8, lastModified: new Date() },
    ...players,
  ];
}
