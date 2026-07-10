'use client';

import Link from 'next/link';
import type { Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';
import { BoardTable } from './BoardTable';
import { SourceSelector } from './SourceSelector';
import { useSelectedSource } from './SelectedSourceProvider';
import { orderSources, sourceLabel, DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';

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

  return (
    <section className={single ? 'mx-auto max-w-md pb-10' : 'pb-10'}>
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
          // The one selector governs EVERY card: when any book is live on this page,
          // a sport with no rows on the chosen book gets an honest empty state — never
          // a silent substitution of median-line leans (those aren't that book's
          // lines). Median leans only render when no book is live anywhere.
          const rows = (liveSources.length > 0 ? (c.boardsBySource[shown] ?? []) : c.medianLeans)
            .slice(0, DISPLAY);
          return (
            <div
              key={c.sport}
              className={`overflow-hidden rounded-2xl border border-line bg-surface ${
                single ? '' : 'min-w-0 max-w-full shrink grow-0 basis-[400px]'
              }`}
              style={{ borderTop: `3px solid ${c.accent}` }}
            >
              <div className="p-5">
                <h2 className="text-2xl font-bold tracking-tight">{c.name}</h2>
                <p className="mt-1 max-w-xs text-sm text-muted">{c.tagline}</p>
              </div>

              <div className="space-y-2 border-t border-line p-4">
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  Top reads right now
                </h3>
                {rows.length === 0 ? (
                  <p className="px-1 py-4 text-sm text-muted">
                    {liveSources.length > 0
                      ? `No ${sourceLabel(shown)} lines for ${c.name} on the current slate.`
                      : 'No data available yet.'}
                  </p>
                ) : (
                  <BoardTable rows={rows} />
                )}
                <Link
                  href={`/${c.sport}`}
                  className="mt-2 block rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: c.accent }}
                >
                  Open the full {c.name} Heat Check →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
