'use client';

import { useQuery } from '@tanstack/react-query';
import type { PlayerResearch } from '@/lib/types';
import type { StatKey } from '@/lib/stats';
import type { Sport } from '@/lib/sports';

/**
 * Fetch a player's research payload for a stat/line from the versioned API.
 * Seeded with `initialData` (from SSR) so the first render paints instantly; then
 * `refetchOnMount: 'always'` pulls live data from the force-dynamic API a beat
 * later, so the line shown reflects the latest providedlines ingest (every ~15 min
 * at peak) rather than the page's ISR cache window. Later stat/line changes refetch
 * while keeping the previous data on screen.
 */
export function useHitRate({
  sport,
  slug,
  stat,
  line,
  source,
  oddsType,
  multiplier,
  initialData,
}: {
  sport: Sport;
  slug: string;
  stat: StatKey;
  line?: number;
  /** Which book's line to prefer (when the user hasn't typed a custom line). */
  source?: string;
  /** The selected rung's payout context — keeps the read anchored to that payout
   *  even if the book re-prices/pulls the rung mid-session (see RungHint). */
  oddsType?: string | null;
  multiplier?: number | null;
  initialData?: PlayerResearch;
}) {
  return useQuery<PlayerResearch>({
    queryKey: ['hitrate', sport, slug, stat, line ?? null, source ?? null, oddsType ?? null, multiplier ?? null],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ playerSlug: slug, stat });
      if (line !== undefined) params.set('line', String(line));
      if (source) params.set('source', source);
      if (line !== undefined && oddsType) params.set('oddsType', oddsType);
      if (line !== undefined && multiplier != null) params.set('multiplier', String(multiplier));
      const res = await fetch(`/api/v1/${sport}/hitrate?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as PlayerResearch;
    },
    initialData,
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
    // Trust the SSR seed on the INITIAL key: the ingest revalidates each player/stat
    // page in the same run it writes a moved line (and material odds moves), so the
    // seed is already current — a mount refetch to the force-dynamic API was a
    // redundant edge request + DB read on the site's highest-traffic surface. When
    // the user changes stat/line/source the key diverges (no seed) and React Query
    // fetches on mount anyway, so live exploration is unaffected.
    refetchOnMount: initialData ? false : 'always',
  });
}
