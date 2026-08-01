'use client';

import Link from 'next/link';
import type { Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';
import { BoardTable } from './BoardTable';
import { SourceSelector } from './SourceSelector';
import { useSelectedSource } from './SelectedSourceProvider';
import { orderSources, sourceLabel, DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';
import { hasLineValueHint, qualifyingSpecialHint } from '@/lib/payoutVariant';

export interface HomeCard {
  sport: Sport;
  name: string;
  accent: string;
  tagline: string;
  /** One top-reads teaser per book (real lines). Empty when no book lines are ingested. */
  boardsBySource: Record<string, BoardRow[]>;
  /** Fallback leans vs our median line (used when boardsBySource is empty). */
  medianLeans: BoardRow[];
}

/** Leans shown per sport card — a taste, not a board; the full Heat Check (filters,
 *  slate toggle, every read) is one tap away at /[sport]. Rows arrive already
 *  filtered to today's slate (the server applies the default; see loadSport). */
const DISPLAY = 4;

/**
 * Home "Heat Check" teaser cards driven by ONE page-wide book selector — the same
 * site-wide choice every other page follows (SelectedSourceProvider), so the book
 * picked here carries into the boards and player pages. Everything else stays on the
 * sport's Heat Check: no slate toggle, no filters — just each sport's top reads and
 * one button to the full board.
 */
export function HomeTopLeans({ cards }: { cards: HomeCard[] }) {
  const { source: selected, setSource } = useSelectedSource();

  // Books that have board rows in at least one sport → the single selector's options.
  const liveSet = new Set<string>();
  for (const c of cards) {
    for (const [s, rows] of Object.entries(c.boardsBySource))
      if (rows.length > 0) liveSet.add(s);
  }
  const liveSources = orderSources([...liveSet]);
  const shown = liveSources.includes(selected)
    ? selected
    : liveSources.includes(DEFAULT_PROVIDED_SOURCE)
      ? DEFAULT_PROVIDED_SOURCE
      : (liveSources[0] ?? DEFAULT_PROVIDED_SOURCE);

  const single = cards.length === 1;

  // The rows each card actually shows (top DISPLAY), decided PER CARD.
  //
  // Book rows win when the selected book carries this sport. When it doesn't, the
  // card falls back to that sport's own median-line leans rather than going blank —
  // no book covers every league (MLS/CFB/CBB are routinely uncarried), and dropping
  // those sports made the home page claim they were off-season. `usingMedian` drives
  // a caption so the substitution is stated on the card, never silent: these are our
  // lines, not the book's.
  const rowsFor = (
    c: HomeCard,
  ): { rows: BoardRow[]; usingMedian: boolean } => {
    const bookRows = liveSources.length > 0 ? (c.boardsBySource[shown] ?? []) : [];
    if (bookRows.length > 0) return { rows: bookRows.slice(0, DISPLAY), usingMedian: false };
    return {
      rows: c.medianLeans.slice(0, DISPLAY),
      usingMedian: liveSources.length > 0 && c.medianLeans.length > 0,
    };
  };
  // Reserve a hint line across ALL cards' rows when ANY shown row uses it — so every
  // teaser row shares one height (cards with equal player counts stay flush) without
  // dropping a hint or padding rows on a slate that has none.
  const allShownRows = cards.flatMap((c) => rowsFor(c).rows);
  const reserveLineValue = allShownRows.some(hasLineValueHint);
  const reserveSpecial = allShownRows.some((r) => qualifyingSpecialHint(r) !== null);

  return (
    <section className={single ? 'mx-auto max-w-md pb-10' : 'pb-10'}>
      {/* Width = the card row's natural width (N cards at their 400px basis + the
          20px gaps), capped at the container — so the selector's right edge tracks
          the RIGHTMOST CARD instead of floating at the much wider page container.
          Computed explicitly (numbers mirror basis-[400px] / gap-5 below) because
          fit-content on a nested wrap-flex resolves inconsistently in Chrome. */}
      <div
        className="mx-auto"
        style={{ width: `min(100%, ${cards.length * 400 + (cards.length - 1) * 20}px)` }}
      >
        {liveSources.length > 0 && (
          <div className="mb-3 flex justify-end">
            <SourceSelector sources={liveSources} value={shown} onChange={setSource} />
          </div>
        )}

        {/* Each card holds a 400px width and wraps to the next line when the row can't
            fit another — and rows are centered, so a card that wraps onto its own row
            sits in the middle rather than hugging the left. Cards don't grow past their
            basis (a lone wrapped card stays card-sized, not stretched); they shrink to
            the container's width on phones. A single card keeps the section's max-w-md. */}
        <div className={single ? '' : 'flex flex-wrap justify-center gap-5'}>
        {cards.map((c) => {
          const { rows, usingMedian } = rowsFor(c);
          return (
            <div
              key={c.sport}
              className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-surface ${
                single ? '' : 'min-w-0 max-w-full shrink grow-0 basis-[400px]'
              }`}
              style={{ borderTop: `3px solid ${c.accent}` }}
            >
              <div className="p-5">
                <h2 className="text-2xl font-bold tracking-tight">{c.name}</h2>
                <p className="mt-1 max-w-xs text-sm text-muted">{c.tagline}</p>
              </div>

              {/* flex-1 so this section fills the card's stretched height and the
                  button pins to the bottom (mt-auto). The button is a DIRECT flex
                  child — kept out of the space-y wrapper — so its mt-auto isn't
                  overridden by space-y's higher-specificity margin. With the uniform
                  reserved-hint rows, cards holding the same player count end up flush
                  and their buttons align. */}
              <div className="flex flex-1 flex-col border-t border-line p-4">
                <div className="space-y-2 pb-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 px-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Top reads right now
                    </h3>
                    {/* States the substitution on the card: the selected book doesn't
                        list this league tonight, so these are OUR lines. */}
                    {usingMedian && (
                      <span
                        className="text-[11px] text-muted"
                        title={`${sourceLabel(shown)} doesn't list ${c.name} on the current slate, so these leans are priced against our own median line.`}
                      >
                        no {sourceLabel(shown)} lines — our line
                      </span>
                    )}
                  </div>
                  {rows.length === 0 ? (
                    <p className="px-1 py-4 text-sm text-muted">
                      {liveSources.length > 0
                        ? `No ${sourceLabel(shown)} lines for ${c.name} on the current slate.`
                        : 'No data available yet.'}
                    </p>
                  ) : (
                    <BoardTable
                      rows={rows}
                      reserveLineValue={reserveLineValue}
                      reserveSpecial={reserveSpecial}
                    />
                  )}
                </div>
                <Link
                  href={`/${c.sport}`}
                  className="mt-auto block rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: c.accent }}
                >
                  Open the full {c.name} Heat Check →
                </Link>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </section>
  );
}
