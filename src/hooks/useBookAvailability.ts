'use client';

import { useQuery } from '@tanstack/react-query';
import {
  bookAvailability,
  type BookAvailability,
  type GeoHint,
} from '@/lib/bookAvailability';

type GeoResponse = GeoHint;

/**
 * Whether `bookId` offers the over/under prop product where the reader is.
 *
 * The region comes from /api/v1/geo on a single shared query key, so however many
 * BookLinks a page renders, TanStack issues exactly one request and every instance
 * reads the same answer. It is cached for the session (`staleTime: Infinity`) —
 * a reader's state does not change mid-visit.
 *
 * `enabled` keeps the request off pages with nothing to gate: a BookLink with no
 * referral link configured already renders as plain text, so there is no reason to
 * look up where the reader is. Passing it as an argument (rather than calling the
 * hook conditionally) is what keeps this legal under the rules of hooks — BookLink
 * has an early return below it.
 *
 * FAILS OPEN, DELIBERATELY. While the request is in flight, if it errors, if the
 * host attaches no geo headers (local dev, self-hosting), or if a privacy extension
 * blocks it, this returns 'unknown' and the caller shows the link. A geo lookup
 * must never be the reason the page quietly loses functionality.
 */
export function useBookAvailability(bookId: string, enabled: boolean): BookAvailability {
  const { data } = useQuery<GeoResponse>({
    queryKey: ['geo'],
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    // One attempt: a failed lookup just means we show the link, which is the
    // default anyway — not worth a retry storm on every page view.
    retry: false,
    queryFn: async () => {
      const res = await fetch('/api/v1/geo');
      if (!res.ok) throw new Error(`geo lookup failed: ${res.status}`);
      return (await res.json()) as GeoResponse;
    },
  });

  if (!enabled || !data) return 'unknown';
  return bookAvailability(bookId, data);
}
