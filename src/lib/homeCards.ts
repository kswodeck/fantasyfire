import type { BoardRow } from '@/lib/types';

/** The per-sport teaser data the home page loads (see app/page.tsx loadSport). */
export interface HomeSportData {
  /** Top reads per book, when any book carries this sport. */
  boardsBySource: Record<string, BoardRow[]>;
  /** Our median-line leans — the fallback used only when NO book is live anywhere. */
  medianLeans: BoardRow[];
}

/**
 * Which sports get a card on the home page.
 *
 * This mirrors HomeTopLeans' display rule EXACTLY, and that is the whole point of
 * the function existing: the component decides book-vs-median GLOBALLY (one live
 * book anywhere on the page puts every card into book mode), so a per-sport gate
 * silently disagrees with it. That mismatch is what rendered an empty
 * "No PrizePicks lines for MLS on the current slate" card — MLS is carried by no
 * book, so it passed a per-sport median check and then rendered in book mode with
 * an empty board.
 *
 * Deciding it once, here, guarantees the invariant the home page actually needs:
 * a card is shown only if it has rows to show.
 */
export function selectHomeCards<T>(
  entries: readonly (readonly [T, HomeSportData])[],
): (readonly [T, HomeSportData])[] {
  const hasBookRows = (d: HomeSportData) =>
    Object.values(d.boardsBySource).some((rows) => rows.length > 0);
  // One book live anywhere puts every card in book mode (HomeTopLeans' liveSources).
  const anyBookLive = entries.some(([, d]) => hasBookRows(d));
  return entries.filter(([, d]) => (anyBookLive ? hasBookRows(d) : d.medianLeans.length > 0));
}
