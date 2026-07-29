'use client';

import { refLinkFor, refLinkRel, sourceLabel, isSponsoredLink } from '@/lib/providedSources';
import { track } from '@/lib/analytics';

/**
 * A book/source name. Renders as PLAIN TEXT until a referral link exists for that
 * book, and as an outbound referral link once one does (see refLinkFor).
 *
 * That's the switch: drop a book into NEXT_PUBLIC_REF_LINKS and every place its
 * name appears — player page, ladder, best-price panel, /books — starts linking,
 * with no code change. It's per-book, so a single deal doesn't turn the other
 * eighteen into links.
 *
 * Compliance is handled here ONCE rather than at ~15 call sites:
 *  - `rel` carries "sponsored" only on genuinely paid links, plus nofollow +
 *    noopener/noreferrer on all of them (refLinkRel).
 *  - `target="_blank"` — the user never loses their research mid-read.
 *  - Outbound clicks fire an analytics event tagged with the placement, so it's
 *    possible to see which surfaces actually convert and prune the ones that
 *    don't (that's the whole point of placing few links deliberately).
 *
 * Degrades to plain text when we have no URL for the source, so an unknown book id
 * can never render an empty or broken anchor.
 *
 * NOT usable everywhere a book name appears: it must not go inside the board rows
 * (their whole row is already a stretched <a>, and nesting anchors is invalid HTML
 * that breaks the row link) or inside <option> elements (HTML forbids anchors
 * there). Those sites keep plain sourceLabel text on purpose.
 */
export function BookLink({
  source,
  /** Where this link lives — sent with the click event (e.g. "player-line"). */
  placement,
  children,
  className,
}: {
  source: string;
  placement: string;
  /** Defaults to the book's display name. */
  children?: React.ReactNode;
  className?: string;
}) {
  const href = refLinkFor(source);
  const label = sourceLabel(source);
  if (!href) return <>{children ?? label}</>;

  return (
    <a
      href={href}
      target="_blank"
      rel={refLinkRel(source)}
      className={className ?? 'text-brand hover:text-brand-strong'}
      data-book={source}
      onClick={() =>
        track('book_link_click', {
          book: source,
          placement,
          sponsored: isSponsoredLink(source),
        })
      }
    >
      {children ?? label}
    </a>
  );
}
