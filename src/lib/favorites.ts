// Device-local favorites — zero auth, zero backend (honors the no-login design).
// Stored in localStorage as the source of truth (a cache that clears with site
// data; we tell the user). Framework-agnostic except for the browser globals,
// which are all typeof-guarded so this is safe to import in SSR'd modules.
import type { Sport } from './sports';
import { isSport } from './sports';

export interface FavoritePlayer {
  sport: Sport;
  slug: string;
  name: string;
  /** Team abbreviation, for display on /playbook. */
  team?: string | null;
}

const KEY = 'ff:favorites:v1';
/** Dispatched on the window when favorites change, so hooks re-read in the same tab. */
export const FAVORITES_EVENT = 'ff:favorites-changed';
/** Soft cap so a runaway never bloats localStorage. */
export const MAX_FAVORITES = 200;

function isValid(x: unknown): x is FavoritePlayer {
  if (!x || typeof x !== 'object') return false;
  const f = x as Record<string, unknown>;
  return isSport(f.sport as string) && typeof f.slug === 'string' && typeof f.name === 'string';
}

export function getFavorites(): FavoritePlayer[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isValid) : [];
  } catch {
    return [];
  }
}

function persist(list: FavoritePlayer[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_FAVORITES)));
    window.dispatchEvent(new Event(FAVORITES_EVENT));
  } catch {
    // Storage full / disabled (private mode) — fail silently; it's a convenience.
  }
}

export function isFavorited(list: FavoritePlayer[], sport: Sport, slug: string): boolean {
  return list.some((f) => f.sport === sport && f.slug === slug);
}

export function removeFavorite(sport: Sport, slug: string): void {
  persist(getFavorites().filter((f) => !(f.sport === sport && f.slug === slug)));
}

/** Toggle a player's favorited state. Returns the NEW state (true = now favorited). */
export function toggleFavorite(fav: FavoritePlayer): boolean {
  const list = getFavorites();
  if (isFavorited(list, fav.sport, fav.slug)) {
    persist(list.filter((f) => !(f.sport === fav.sport && f.slug === fav.slug)));
    return false;
  }
  // Newest first.
  persist([{ sport: fav.sport, slug: fav.slug, name: fav.name, team: fav.team ?? null }, ...list]);
  return true;
}
