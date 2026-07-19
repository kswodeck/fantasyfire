import { notFound } from 'next/navigation';
import { getPlayerBySlug } from '@/lib/server/players';
import { isSport } from '@/lib/sports';

/**
 * Existence gate for the player segment. Layouts render ABOVE the segment's
 * loading.tsx boundary, so a notFound() thrown here happens BEFORE the streamed
 * 200 shell is committed — an unknown slug returns a real HTTP 404 (previously a
 * soft-404: 200 + noindex). Real players cost nothing extra: getPlayerBySlug is
 * React-cache()'d, so this shares the same query the page/metadata already run.
 */
export default async function PlayerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ sport: string; playerSlug: string }>;
}) {
  const { sport, playerSlug } = await params;
  if (!isSport(sport)) notFound();
  const player = await getPlayerBySlug(sport, playerSlug);
  if (!player) notFound();
  return children;
}
