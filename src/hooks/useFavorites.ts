'use client';

import { useEffect, useState } from 'react';
import { getFavorites, FAVORITES_EVENT, type FavoritePlayer } from '@/lib/favorites';

/**
 * Subscribe to the localStorage favorites store. Starts empty so SSR and the first
 * client render agree (no hydration mismatch); the real list is read right after
 * mount. `hydrated` lets callers avoid flashing the empty state. Updates live on
 * the same-tab custom event and on cross-tab `storage` events.
 */
export function useFavorites(): { favorites: FavoritePlayer[]; hydrated: boolean } {
  const [favorites, setFavorites] = useState<FavoritePlayer[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Sync from the localStorage store (an external system) into React on mount,
    // then on every change event. The one-time hydrate flag is an intentional
    // setState in the effect.
    const sync = () => setFavorites(getFavorites());
    sync();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
    window.addEventListener(FAVORITES_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return { favorites, hydrated };
}
