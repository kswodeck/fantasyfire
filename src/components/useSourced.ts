'use client';

import { useState } from 'react';

/**
 * Shared selection logic for the per-book board/streaks/trends views. Only sources
 * that actually produced rows are selectable, so a book with no board-eligible props
 * (e.g. a sportsbook RotoWire barely covers for this sport) is auto-hidden from the
 * dropdown instead of rendering a "no props" dead end — and reappears on its own if
 * it ever gets coverage. Falls back to the default source, then the first live one.
 */
export function useSourced<T>(
  bySource: Record<string, T[]>,
  sources: string[],
  defaultSource: string,
): { source: string; setSource: (s: string) => void; liveSources: string[]; rows: T[] } {
  const liveSources = sources.filter((s) => (bySource[s]?.length ?? 0) > 0);
  const initial = liveSources.includes(defaultSource) ? defaultSource : (liveSources[0] ?? defaultSource);
  const [source, setSource] = useState(initial);
  const effective = liveSources.includes(source) ? source : initial;
  return { source: effective, setSource, liveSources, rows: bySource[effective] ?? [] };
}
