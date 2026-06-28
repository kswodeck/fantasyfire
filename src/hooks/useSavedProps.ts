'use client';

import { useEffect, useState } from 'react';
import {
  getSavedProps,
  pruneExpiredProps,
  SAVED_PROPS_EVENT,
  type SavedProp,
} from '@/lib/savedProps';

/**
 * Subscribe to the localStorage saved-props store. Starts empty so SSR and the
 * first client render agree (no hydration mismatch); the real list is read right
 * after mount. `hydrated` lets callers avoid flashing the empty state. Updates
 * live on the same-tab custom event and on cross-tab `storage` events. Mirrors
 * useFavorites.
 */
export function useSavedProps(): { props: SavedProp[]; hydrated: boolean } {
  const [props, setProps] = useState<SavedProp[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => setProps(getSavedProps());
    // Picks live game-by-game: drop any whose game is now over (here + whenever
    // the tab regains focus, e.g. the user comes back after a game finished).
    const refresh = () => {
      pruneExpiredProps();
      sync();
    };
    refresh();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
    window.addEventListener(SAVED_PROPS_EVENT, sync);
    window.addEventListener('storage', sync);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    // Periodic sweep so a long-open tab clears finished games (and crosses midnight
    // for the end-of-day rule) without needing a focus/visibility event. pruneExpired
    // only fires the change event when it actually removes something, so an unchanged
    // tick costs nothing and triggers no re-render.
    const sweep = setInterval(pruneExpiredProps, 5 * 60_000);
    return () => {
      window.removeEventListener(SAVED_PROPS_EVENT, sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      clearInterval(sweep);
    };
  }, []);

  return { props, hydrated };
}
