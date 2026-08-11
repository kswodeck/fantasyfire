'use client';

import { useSelectedSource } from './SelectedSourceProvider';

/**
 * Shared selection logic for the per-book board/streaks/trends views, backed by the
 * app-wide selected source (persisted across pages — see SelectedSourceProvider).
 *
 * Only sources that produced rows are selectable, so a book with no board-eligible
 * props is auto-hidden. The displayed source is the user's saved pick when this view
 * has it, else the default, else the first live source. Changing it updates the
 * app-wide selection (so every other page follows + it persists).
 *
 * `visible` is how a view says what "produced rows" means to IT. The Heat Check
 * boards hide rows below the no-read cutoff, so a book whose every row is a Pass
 * has an empty board even though `bySource[book]` is full. Without the predicate,
 * "live" and "renders something" disagree: that book stays in the selector, can be
 * auto-selected as `liveSources[0]`, and the reader gets an empty board attributed
 * to a book they never chose. Views that show every row they're given (trends,
 * streaks) omit it and keep the plain non-empty test.
 */
export function useSourced<T>(
  bySource: Record<string, T[]>,
  sources: string[],
  defaultSource: string,
  visible?: (row: T) => boolean,
): { source: string; setSource: (s: string) => void; liveSources: string[]; rows: T[] } {
  const { source: selected, setSource } = useSelectedSource();
  const liveSources = sources.filter((s) => {
    const rows = bySource[s] ?? [];
    return visible ? rows.some(visible) : rows.length > 0;
  });
  const source = liveSources.includes(selected)
    ? selected
    : liveSources.includes(defaultSource)
      ? defaultSource
      : (liveSources[0] ?? defaultSource);
  return { source, setSource, liveSources, rows: bySource[source] ?? [] };
}
