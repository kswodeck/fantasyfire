'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SPORTS } from '@/lib/sports';
import type { PlayerSearchResult } from '@/lib/types';

/**
 * Site-wide player search for the header.
 *
 * The site's whole SEO surface is per-player pages, so "look up a different
 * player" is the most common intent a reader arrives with — and before this the
 * only route to one was Sports → league → Players → filter. This is a real
 * combobox (WAI-ARIA pattern): the input owns `aria-activedescendant` while the
 * listbox holds the options, so a screen reader announces the highlighted player
 * without focus ever leaving the field.
 *
 * Results are cross-league (/api/v1/search) — the reader never has to know which
 * league a player is in, which is the point.
 */

/** Keystroke debounce. Long enough that typing a name is one request, not eight. */
const DEBOUNCE_MS = 180;
const MIN_CHARS = 2;

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function SiteSearch({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const debounced = useDebounced(query.trim(), DEBOUNCE_MS);
  const enabled = debounced.length >= MIN_CHARS;

  const { data, isFetching } = useQuery<PlayerSearchResult[]>({
    queryKey: ['site-search', debounced],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(debounced)}`, { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return ((await res.json()) as { players: PlayerSearchResult[] }).players;
    },
    enabled,
    // Rosters are a ~daily dataset and readers re-type the same names, so a long
    // client cache keeps repeat lookups instant and off the network entirely.
    staleTime: 10 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const results = enabled ? (data ?? []) : [];
  // A stale `active` index would highlight the wrong row (or none) after results
  // change; clamp it as part of render rather than in an effect.
  const activeIndex = results.length === 0 ? -1 : Math.min(active, results.length - 1);
  const showPanel = open && enabled;

  // Close on an outside click. Escape is handled on the input instead (see
  // onKeyDown) so that inside the mobile nav panel — which closes itself on a
  // document-level Escape — the first press dismisses only this dropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const go = (p: PlayerSearchResult) => {
    setOpen(false);
    setQuery('');
    router.push(`/${p.sport}/${p.slug}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && showPanel) {
      // Only swallow Escape while the dropdown is actually showing — otherwise the
      // mobile nav panel (or any ancestor) should still get it.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      setOpen(true);
      setActive((i) => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
        return (next + results.length) % results.length;
      });
      return;
    }
    if (e.key === 'Enter') {
      // Enter with nothing highlighted takes the top hit — the common case is
      // "type a name, press Enter".
      const pick = results[activeIndex] ?? results[0];
      if (pick) {
        e.preventDefault();
        go(pick);
      }
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        // "all players" (not the boards' bare "Search players…") so the two are
        // distinguishable when a page shows both: this one spans every league and
        // navigates, the board's filters the list in front of you.
        placeholder="Search all players…"
        aria-label="Search players across all leagues"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={showPanel ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          showPanel && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        autoComplete="off"
        className="w-full rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted focus:border-brand"
      />

      {/* w-72 + min-w-full: a comfortable 288px under the narrow desktop header
          field, but never narrower than its container (the full-width mobile
          panel), so results don't render in a thin right-aligned strip. */}
      {showPanel && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-72 min-w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-background shadow-xl shadow-black/20">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted">
              {isFetching ? 'Searching…' : `No players matching “${debounced}”.`}
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Player results" className="max-h-80 overflow-y-auto py-1">
              {results.map((p, i) => {
                const cfg = SPORTS[p.sport];
                return (
                  <li
                    key={`${p.sport}:${p.slug}`}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    // onMouseDown, not onClick: mousedown fires before the input's
                    // blur, so the panel is still mounted when the choice lands.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      go(p);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      i === activeIndex ? 'bg-surface-2' : ''
                    }`}
                  >
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                      style={{ backgroundColor: cfg.accent }}
                    >
                      {cfg.name}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{p.fullName}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {[p.teamAbbreviation, p.position].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
