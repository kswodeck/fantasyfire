'use client';

import { useQuery } from '@tanstack/react-query';
import type { BoardRow } from '@/lib/types';
import type { Sport } from '@/lib/sports';

/**
 * Fetch one player's strongest prop+line combos (the "top reads" mini dashboard)
 * for the chosen book. Same seed-then-revalidate shape as useHitRate: the SSR
 * payload paints instantly and — when live book lines exist — a mount refetch
 * tracks the intraday lines ingest instead of the page's ISR cache.
 */
export function useTopReads({
  sport,
  slug,
  source,
  initialData,
}: {
  sport: Sport;
  slug: string;
  /** Which book's lines to rank (computed lines when the book has none). */
  source?: string;
  initialData?: BoardRow[];
}) {
  return useQuery<BoardRow[]>({
    queryKey: ['topreads', sport, slug, source ?? null],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ playerSlug: slug });
      if (source) params.set('source', source);
      const res = await fetch(`/api/v1/${sport}/topreads?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return ((await res.json()) as { rows: BoardRow[] }).rows;
    },
    initialData,
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
    // Trust the SSR seed on the initial source (revalidated by the ingest in the same
    // run it moves lines); refetch only when the user switches book/source (diverged
    // key, no seed). Saves a mount refetch per player view on the busiest surface.
    refetchOnMount: initialData ? false : 'always',
  });
}
