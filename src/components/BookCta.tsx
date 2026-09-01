'use client';

import { isSponsoredLink } from '@/lib/providedSources';
import { useBookAvailability } from '@/hooks/useBookAvailability';
import { BookLink } from './BookLink';

/**
 * The one action link on a research page: "go do the thing you just decided to do".
 *
 * This is a CTA, not a label, and that difference drives the whole component. A
 * BookLink degrades to plain text when there's no deal or the book isn't offered in
 * the reader's state — right for a book's NAME inside a sentence, wrong here, where
 * the text only makes sense as a link ("Open this line on PrizePicks →" as dead text
 * is just noise). So this renders NOTHING in those cases instead, and delegates to
 * BookLink when it does render, keeping one anchor implementation and one place
 * where rel/sponsored/tracking are decided.
 *
 * The availability lookup shares BookLink's query key, so the extra call here costs
 * no extra request.
 *
 * PLACEMENT CONTRACT (docs/MONETIZATION.md §2 — "monetize the exit"):
 *  - It goes AFTER the read it refers to, never above it.
 *  - One per view. If you find yourself adding a second, delete the weaker one.
 *  - It names a destination, never a recommendation — "Open this line on X", not
 *    "Bet this". The site describes past performance; the CTA is a shortcut, not
 *    a nudge to act.
 */
export function BookCta({
  source,
  /** Where this link lives — travels to analytics and, where configured, as a sub-id. */
  placement,
  children,
}: {
  source: string;
  placement: string;
  children: React.ReactNode;
}) {
  const sponsored = isSponsoredLink(source);
  // Unconditional (rules of hooks); `enabled` keeps it inert when there's no deal.
  const availability = useBookAvailability(source, sponsored);

  // No deal for this book: there is nothing to send the reader to that we'd be part
  // of, and a bare "open this on X" link earns nothing while still costing the page
  // a distraction. Say nothing instead.
  if (!sponsored) return null;
  // The book doesn't run this product in the reader's state — the click would dead-end.
  if (availability === 'unavailable') return null;

  return (
    <div className="mb-5 -mt-2">
      <BookLink
        source={source}
        placement={placement}
        className="text-sm font-semibold text-brand hover:text-brand-strong"
      >
        {children}
      </BookLink>
    </div>
  );
}
