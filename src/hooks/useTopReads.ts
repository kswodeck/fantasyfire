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
  hasLiveLines = true,
}: {
  sport: Sport;
  slug: string;
  /** Which book's lines to rank (computed lines when the book has none). */
  source?: string;
  initialData?: BoardRow[];
  hasLiveLines?: boolean;
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
    refetchOnMount: hasLiveLines ? 'always' : true,
  });
}
