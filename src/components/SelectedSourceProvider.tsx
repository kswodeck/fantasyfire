'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_PROVIDED_SOURCE } from '@/lib/providedSources';

/**
 * App-wide "which book's lines to show" selection, persisted to localStorage so the
 * choice sticks across pages and visits. One source of truth means the home page can
 * drive every sport with a single selector, and every other page defaults to whatever
 * the user last picked. Pages still clamp this to the books they actually have.
 */
const STORAGE_KEY = 'ff:lineSource';

const SelectedSourceContext = createContext<{
  source: string;
  setSource: (next: string) => void;
}>({ source: DEFAULT_PROVIDED_SOURCE, setSource: () => {} });

export function SelectedSourceProvider({ children }: { children: ReactNode }) {
  // Start at the default on both server + first client render (localStorage isn't
  // available during SSR), then adopt the saved choice after mount.
  const [source, setSourceState] = useState(DEFAULT_PROVIDED_SOURCE);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setSourceState(saved);
    } catch {
      /* storage blocked — fall back to the default */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) setSourceState(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setSource = useCallback((next: string) => {
    setSourceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <SelectedSourceContext.Provider value={{ source, setSource }}>
      {children}
    </SelectedSourceContext.Provider>
  );
}

export function useSelectedSource() {
  return useContext(SelectedSourceContext);
}
