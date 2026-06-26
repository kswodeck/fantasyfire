'use client';

import { useState } from 'react';
import type { Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';
import { FilterableBoard } from './FilterableBoard';
import { SourceSelector } from './SourceSelector';

/**
 * Board with a book-source dropdown. Each source's board is pre-computed on the
 * server (ranked against that book's real lines) and passed in, so switching is
 * instant and the page stays static/ISR. `key={source}` resets the inner filters
 * when the book changes.
 */
export function SourcedBoard({
  sport,
  boardsBySource,
  sources,
  defaultSource,
  heading = 'Every prop on the board, ranked vs its real line',
  initialVisible,
}: {
  sport: Sport;
  boardsBySource: Record<string, BoardRow[]>;
  sources: string[];
  defaultSource: string;
  /** Section heading next to the selector; pass null to omit (caller has its own). */
  heading?: string | null;
  initialVisible?: number;
}) {
  const [source, setSource] = useState(defaultSource);
  const rows = boardsBySource[source] ?? [];
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        {heading === null ? (
          <span />
        ) : (
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{heading}</h2>
        )}
        <SourceSelector sources={sources} value={source} onChange={setSource} />
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No props for this book right now.
        </p>
      ) : (
        <FilterableBoard key={source} sport={sport} rows={rows} initialVisible={initialVisible} />
      )}
    </div>
  );
}
