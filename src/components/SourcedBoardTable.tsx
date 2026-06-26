'use client';

import { useState, type ReactNode } from 'react';
import type { Sport } from '@/lib/sports';
import type { BoardRow } from '@/lib/types';
import { BoardTable } from './BoardTable';
import { SourceSelector } from './SourceSelector';

/**
 * Compact teaser board (the home + sport-home "Top leans" lists) with a book-source
 * dropdown. Each source's rows are pre-computed on the server against that book's real
 * lines and passed in, so switching books is an instant client swap and the page stays
 * static/ISR. Mirrors SourcedBoard, but renders the small read-only BoardTable instead
 * of the full FilterableBoard.
 */
export function SourcedBoardTable({
  sport,
  boardsBySource,
  sources,
  defaultSource,
  heading,
  emptyText = 'No props for this book right now.',
}: {
  sport: Sport;
  boardsBySource: Record<string, BoardRow[]>;
  sources: string[];
  defaultSource: string;
  /** Left-side label rendered on the selector row (e.g. the "Top leans" heading). */
  heading?: ReactNode;
  emptyText?: string;
}) {
  const [source, setSource] = useState(defaultSource);
  const rows = boardsBySource[source] ?? [];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">{heading}</div>
        <SourceSelector sources={sources} value={source} onChange={setSource} />
      </div>
      {rows.length === 0 ? (
        <p className="px-1 py-4 text-sm text-muted">{emptyText}</p>
      ) : (
        <BoardTable sport={sport} rows={rows} />
      )}
    </div>
  );
}
