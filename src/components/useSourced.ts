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
 */
export function useSourced<T>(
  bySource: Record<string, T[]>,
  sources: string[],
  defaultSource: string,
): { source: string; setSource: (s: string) => void; liveSources: string[]; rows: T[] } {
  const { source: selected, setSource } = useSelectedSource();
  const liveSources = sources.filter((s) => (bySource[s]?.length ?? 0) > 0);
  const source = liveSources.includes(selected)
    ? selected
    : liveSources.includes(defaultSource)
      ? defaultSource
      : (liveSources[0] ?? defaultSource);
  return { source, setSource, liveSources, rows: bySource[source] ?? [] };
}
