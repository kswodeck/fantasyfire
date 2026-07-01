'use client';

import { type ReactNode } from 'react';
import type { BoardRow } from '@/lib/types';
import { BoardTable } from './BoardTable';
import { SourceSelector } from './SourceSelector';
import { useSourced } from './useSourced';

/**
 * Compact teaser board (the home + sport-home "Heat Check" lists) with a book-source
 * dropdown. Each source's rows are pre-computed on the server against that book's real
 * lines and passed in, so switching books is an instant client swap and the page stays
 * static/ISR. Only books that produced rows are offered (thin books auto-hidden).
 * Mirrors SourcedBoard, but renders the small read-only BoardTable.
 */
export function SourcedBoardTable({
  boardsBySource,
  sources,
  defaultSource,
  heading,
  emptyText = 'No props for this book right now.',
}: {
  boardsBySource: Record<string, BoardRow[]>;
  sources: string[];
  defaultSource: string;
  /** Left-side label rendered on the selector row (e.g. the "Heat Check" heading). */
  heading?: ReactNode;
  emptyText?: string;
}) {
  const { source, setSource, liveSources, rows } = useSourced(
    boardsBySource,
    sources,
    defaultSource,
  );
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">{heading}</div>
        <SourceSelector sources={liveSources} value={source} onChange={setSource} />
      </div>
      {rows.length === 0 ? (
        <p className="px-1 py-4 text-sm text-muted">{emptyText}</p>
      ) : (
        <BoardTable rows={rows} source={source} />
      )}
    </div>
  );
}
