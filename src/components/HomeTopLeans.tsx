'use client';

import Link from 'next/link';
import type { Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';
import { BoardTable } from './BoardTable';
import { SourceSelector } from './SourceSelector';
import { useSelectedSource } from './SelectedSourceProvider';
import { useSelectedSlate } from './SelectedSlateProvider';
import { orderSources, DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';

export interface HomeCard {
  sport: Sport;
  name: string;
  accent: string;
  tagline: string;
  /** One board per book (real lines). Empty object when no book lines are ingested. */
  boardsBySource: Record<string, BoardRow[]>;
  /** Fallback leans vs our median line (used when boardsBySource is empty). */
  medianLeans: BoardRow[];
  /** Team abbreviations playing today / this week — drives the "today's slate" filter. */
  todayTeams: string[];
}

/** Leans shown per sport card (a teaser; the full board lives at /[sport]/board). */
const DISPLAY = 6;

/**
 * Home "Top leans" cards driven by ONE page-wide book selector AND one "today's slate"
 * toggle for the whole page (no per-sport controls). Every card shows the same book and
 * the same today/all view; changing either updates all sports at once, and both choices
 * persist across pages (SelectedSourceProvider / SelectedSlateProvider). The home cards
 * deliberately omit the matchups list — that lives on each sport's board.
 */
export function HomeTopLeans({ cards }: { cards: HomeCard[] }) {
  const { source: selected, setSource } = useSelectedSource();

  // Books that have board rows in at least one sport → the single selector's options.
  const liveSet = new Set<string>();
  for (const c of cards) {
    for (const [s, rows] of Object.entries(c.boardsBySource)) if (rows.length > 0) liveSet.add(s);
  }
  const liveSources = orderSources([...liveSet]);
  const shown = liveSources.includes(selected)
    ? selected
    : liveSources.includes(DEFAULT_PROVIDED_SOURCE)
      ? DEFAULT_PROVIDED_SOURCE
      : (liveSources[0] ?? DEFAULT_PROVIDED_SOURCE);

  const anySlate = cards.some((c) => c.todayTeams.length > 0);
  const { mode, setMode } = useSelectedSlate();

  const single = cards.length === 1;
  const gridCols =
    cards.length >= 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : cards.length === 2 ? 'sm:grid-cols-2' : '';

  const toggleBtn = (m: 'today' | 'all', text: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      className={
        'cursor-pointer rounded-md px-3 py-1 transition-colors ' +
        (mode === m ? 'bg-brand text-brand-foreground' : 'text-muted hover:text-foreground')
      }
    >
      {text}
    </button>
  );

  return (
    <section className={single ? 'mx-auto max-w-md pb-10' : 'pb-10'}>
      {(anySlate || liveSources.length > 0) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {anySlate ? (
            <div className="inline-flex items-center rounded-lg border border-line bg-surface p-0.5 text-xs font-semibold">
              {toggleBtn('today', 'Today')}
              {toggleBtn('all', 'All players')}
            </div>
          ) : (
            <span />
          )}
          {liveSources.length > 0 ? (
            <SourceSelector sources={liveSources} value={shown} onChange={setSource} />
          ) : (
            <span />
          )}
        </div>
      )}

      <div className={`grid gap-5 ${gridCols}`}>
        {cards.map((c) => {
          const hasSources = Object.keys(c.boardsBySource).length > 0;
          let rows = hasSources ? (c.boardsBySource[shown] ?? []) : c.medianLeans;
          if (mode === 'today' && c.todayTeams.length > 0) {
            const teams = new Set(c.todayTeams);
            rows = rows.filter((r) => r.player.teamAbbreviation && teams.has(r.player.teamAbbreviation));
          }
          rows = rows.slice(0, DISPLAY);
          return (
            <div
              key={c.sport}
              className="overflow-hidden rounded-2xl border border-line bg-surface"
              style={{ borderTop: `3px solid ${c.accent}` }}
            >
              <div className="flex items-start justify-between gap-3 p-5">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{c.name}</h2>
                  <p className="mt-1 max-w-xs text-sm text-muted">{c.tagline}</p>
                </div>
                <Link
                  href={`/${c.sport}`}
                  className="shrink-0 rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: c.accent }}
                >
                  Open {c.name} →
                </Link>
              </div>

              <div className="space-y-2 border-t border-line p-4">
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  Top leans
                </h3>
                {rows.length === 0 ? (
                  <p className="px-1 py-4 text-sm text-muted">
                    {mode === 'today' && c.todayTeams.length > 0
                      ? 'No leans on the slate for this book right now.'
                      : hasSources
                        ? 'No props on this book right now.'
                        : 'No data available yet.'}
                  </p>
                ) : (
                  <BoardTable sport={c.sport} rows={rows} />
                )}
                <Link
                  href={`/${c.sport}/board`}
                  className="mt-1 block rounded-lg px-1 py-2 text-sm font-medium text-brand transition-colors hover:text-brand-strong"
                >
                  See the full {c.name} board →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
