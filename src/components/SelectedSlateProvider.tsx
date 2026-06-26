'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * App-wide "today's slate vs all players" view choice, persisted to localStorage so it
 * sticks across pages and visits — mirrors SelectedSourceProvider. Pages with no slate
 * ignore it (they always show all players); pages with a slate honor the saved choice.
 */
const STORAGE_KEY = 'ff:slateMode';
export type SlateMode = 'today' | 'all';

const SelectedSlateContext = createContext<{
  mode: SlateMode;
  setMode: (next: SlateMode) => void;
}>({ mode: 'today', setMode: () => {} });

export function SelectedSlateProvider({ children }: { children: ReactNode }) {
  // Default to "today" on SSR + first client render (localStorage isn't available
  // during SSR), then adopt the saved choice after mount.
  const [mode, setModeState] = useState<SlateMode>('today');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === 'today' || saved === 'all') setModeState(saved);
    } catch {
      /* storage blocked — fall back to the default */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'today' || e.newValue === 'all')) {
        setModeState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setMode = useCallback((next: SlateMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <SelectedSlateContext.Provider value={{ mode, setMode }}>{children}</SelectedSlateContext.Provider>
  );
}

export function useSelectedSlate() {
  return useContext(SelectedSlateContext);
}
