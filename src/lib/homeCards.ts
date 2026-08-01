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
 * the function existing: a card must never render with nothing in it.
 *
 * The rule is deliberately PER-SPORT, not global. An earlier version decided
 * book-vs-median once for the whole page (one live book anywhere put every card in
 * book mode), which dropped any sport no book carries — in summer that deleted WNBA
 * and MLS from the home page while MLB had PrizePicks lines, and the "between slates
 * / off-season" strip below then labelled two in-season leagues as dormant. A sport
 * with a slate and leans of its own always deserves a card; HomeTopLeans falls back
 * to that sport's median-line leans and captions them as ours, so the fallback is
 * visible rather than silent.
 */
export function selectHomeCards<T>(
  entries: readonly (readonly [T, HomeSportData])[],
): (readonly [T, HomeSportData])[] {
  const hasBookRows = (d: HomeSportData) =>
    Object.values(d.boardsBySource).some((rows) => rows.length > 0);
  return entries.filter(([, d]) => hasBookRows(d) || d.medianLeans.length > 0);
}
