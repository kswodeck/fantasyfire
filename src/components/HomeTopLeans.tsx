import Link from 'next/link';
import type { Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';
import { BoardTable } from './BoardTable';

export interface HomeCard {
  sport: Sport;
  name: string;
  accent: string;
  tagline: string;
  /** Top reads for the default book (or our median line when no book is ingested). */
  leans: BoardRow[];
}

/** Leans shown per sport card — a taste, not a board; the full Heat Check (controls,
 *  filters, every read) is one tap away at /[sport]. */
const DISPLAY = 3;

/**
 * Home "Heat Check" teaser cards — deliberately controls-free (no book selector, no
 * today toggle, no filters). Home is the orientation page; the sport home IS the full
 * Heat Check, so anything interactive lives there instead of being duplicated here.
 */
export function HomeTopLeans({ cards }: { cards: HomeCard[] }) {
  const single = cards.length === 1;
  const gridCols =
    cards.length >= 3
      ? 'sm:grid-cols-2 lg:grid-cols-3'
      : cards.length === 2
        ? 'sm:grid-cols-2'
        : '';

  return (
    <section className={single ? 'mx-auto max-w-md pb-10' : 'pb-10'}>
      <div className={`grid gap-5 ${gridCols}`}>
        {cards.map((c) => (
          <div
            key={c.sport}
            className="overflow-hidden rounded-2xl border border-line bg-surface"
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
              {c.leans.length === 0 ? (
                <p className="px-1 py-4 text-sm text-muted">No data available yet.</p>
              ) : (
                <BoardTable rows={c.leans.slice(0, DISPLAY)} />
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
        ))}
      </div>
    </section>
  );
}
