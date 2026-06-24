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

  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1, lastModified: now },
    { url: absoluteUrl('/players'), changeFrequency: 'daily', priority: 0.8, lastModified: now },
    { url: absoluteUrl('/how-it-works'), changeFrequency: 'monthly', priority: 0.6, lastModified: now },
    { url: absoluteUrl('/faq'), changeFrequency: 'monthly', priority: 0.5, lastModified: now },
    { url: absoluteUrl('/glossary'), changeFrequency: 'monthly', priority: 0.5, lastModified: now },
    { url: absoluteUrl('/about'), changeFrequency: 'monthly', priority: 0.4, lastModified: now },
    { url: absoluteUrl('/contact'), changeFrequency: 'yearly', priority: 0.3, lastModified: now },
    { url: absoluteUrl('/responsible-gaming'), changeFrequency: 'yearly', priority: 0.3, lastModified: now },
    { url: absoluteUrl('/privacy'), changeFrequency: 'yearly', priority: 0.2, lastModified: now },
    { url: absoluteUrl('/terms'), changeFrequency: 'yearly', priority: 0.2, lastModified: now },
  ];

  return [...staticPages, ...players];
}
