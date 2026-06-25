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
}: {
  sport: Sport;
  boardsBySource: Record<string, BoardRow[]>;
  sources: string[];
  defaultSource: string;
}) {
  const [source, setSource] = useState(defaultSource);
  const rows = boardsBySource[source] ?? [];
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Ranked vs the {sources.length > 1 ? 'selected book' : 'book'}&rsquo;s real line
        </h2>
        <SourceSelector sources={sources} value={source} onChange={setSource} />
      </div>
      <FilterableBoard key={source} sport={sport} rows={rows} />
    </div>
  );
}
