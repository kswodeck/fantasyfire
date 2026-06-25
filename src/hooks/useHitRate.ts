'use client';

import { useQuery } from '@tanstack/react-query';
import type { PlayerResearch } from '@/lib/types';
import type { StatKey } from '@/lib/stats';
import type { Sport } from '@/lib/sports';

/**
 * Fetch a player's research payload for a stat/line from the versioned API.
 * Seeded with `initialData` (from SSR) so the first render needs no fetch; later
 * stat/line changes refetch while keeping the previous data on screen.
 */
export function useHitRate({
  sport,
  slug,
  stat,
  line,
  source,
  initialData,
}: {
  sport: Sport;
  slug: string;
  stat: StatKey;
  line?: number;
  /** Which book's line to prefer (when the user hasn't typed a custom line). */
  source?: string;
  initialData?: PlayerResearch;
}) {
  return useQuery<PlayerResearch>({
    queryKey: ['hitrate', sport, slug, stat, line ?? null, source ?? null],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ playerSlug: slug, stat });
      if (line !== undefined) params.set('line', String(line));
      if (source) params.set('source', source);
      const res = await fetch(`/api/v1/${sport}/hitrate?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as PlayerResearch;
    },
    initialData,
    placeholderData: (prev) => prev,
  });
}
