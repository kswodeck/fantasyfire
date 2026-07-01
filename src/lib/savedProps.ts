// Device-local saved props — the prop-level companion to favorites.ts. Where a
// favorite pins a whole player, a saved prop pins a specific research line: a
// (player, stat, line, side) combination the user wants to keep an eye on.
// Same no-auth, no-backend contract: localStorage is the source of truth, it
// clears with site data, and we tell the user. SSR-safe (browser globals are
// typeof-guarded). See [[favorites]] for the player-level store.
import type { StatKey } from './stats/types';
import { STAT_KEYS } from './stats/types';
import type { Sport } from './sports';
import { isSport } from './sports';
import { DEFAULT_PROVIDED_SOURCE } from './providedSources';

/** Which way the prop is being tracked. */
export type PropSide = 'over' | 'under';

export interface SavedProp {
  sport: Sport;
  slug: string;
  /** Player display name + team, denormalized so /playbook needs no fetch to list. */
  name: string;
  team?: string | null;
  stat: StatKey;
  line: number;
  side: PropSide;
  /** The book/source this save is for (e.g. "prizepicks"). Saves are per-source: the
   *  same (player, stat, line, side) at two books are two distinct saves. */
  source: string;
  /** Epoch ms the prop was saved — for "saved 2d ago" + newest-first sorting. */
  savedAt: number;
  /**
   * The single game this pick is for (the player's upcoming game at save time).
   * A prop only lives game-by-game, so once this game is over it auto-expires.
   * Null when saved with no upcoming game (e.g. off-season) — then it never
   * auto-expires and persists until removed by hand.
   */
  gameDate: string | null; // YYYY-MM-DD
  gameStartTime: string | null; // ISO UTC first pitch / kickoff, if known
}

const KEY = 'ff:savedprops:v1';

// How long after first pitch / tip-off / kickoff a game is safely over — used to
// expire a pick "by the time the game ends". Generous (extra innings / OT) so a
// pick never vanishes mid-game.
const GAME_OVER_HOURS: Record<Sport, number> = { mlb: 5, nba: 4, nfl: 4.5 };
const HOUR_MS = 3_600_000;
/** Dispatched on the window when saved props change, so hooks re-read in the same tab. */
export const SAVED_PROPS_EVENT = 'ff:savedprops-changed';
/** Soft cap so a runaway never bloats localStorage. */
export const MAX_SAVED_PROPS = 300;

/** Stable identity for one saved prop (source-scoped). */
export function propKey(p: {
  sport: Sport;
  slug: string;
  stat: StatKey;
  line: number;
  side: PropSide;
  source: string;
}): string {
  return `${p.sport}:${p.slug}:${p.stat}:${p.line}:${p.side}:${p.source}`;
}

function isValid(x: unknown): x is SavedProp {
  if (!x || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  return (
    isSport(p.sport as string) &&
    typeof p.slug === 'string' &&
    typeof p.name === 'string' &&
    typeof p.stat === 'string' &&
    (STAT_KEYS as readonly string[]).includes(p.stat as string) &&
    typeof p.line === 'number' &&
    Number.isFinite(p.line) &&
    (p.side === 'over' || p.side === 'under')
  );
}

/** The viewer's local calendar day (YYYY-MM-DD) for an epoch ms — the end-of-day sweep. */
function localDay(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Whether a pick's game is over (so it should drop off the Playbook).
 *
 * A pick with a known start time clears once its game is safely over (start + a
 * generous sport duration) — this also correctly handles late games that finish
 * after midnight, without clearing them mid-game. A pick with only a calendar date
 * (no start time captured) clears via the end-of-day sweep: once the viewer's local
 * day has rolled past the game's date, with a 36h UTC fallback as a backstop. Picks
 * with no game at all (off-season saves) never expire.
 */
export function isPropExpired(p: SavedProp, now: number = Date.now()): boolean {
  if (p.gameStartTime) {
    const start = Date.parse(p.gameStartTime);
    if (!Number.isNaN(start)) {
      return now > start + (GAME_OVER_HOURS[p.sport] ?? 5) * HOUR_MS;
    }
  }
  if (p.gameDate) {
    if (p.gameDate < localDay(now)) return true;
    const dayStart = Date.parse(`${p.gameDate}T00:00:00Z`);
    if (!Number.isNaN(dayStart)) return now > dayStart + 36 * HOUR_MS;
  }
  return false;
}

/** Back-compat: older entries predate the game + source fields; default them. */
function normalize(p: SavedProp): SavedProp {
  return {
    ...p,
    gameDate: p.gameDate ?? null,
    gameStartTime: p.gameStartTime ?? null,
    source: p.source ?? DEFAULT_PROVIDED_SOURCE,
  };
}

export function getSavedProps(): SavedProp[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .filter(isValid)
      .map(normalize)
      .filter((p) => !isPropExpired(p, now));
  } catch {
    return [];
  }
}

/**
 * Physically drop expired (game-over) picks from storage, firing the change event
 * so open views refresh. No-op when nothing changed. Call on mount / on focus.
 */
export function pruneExpiredProps(): boolean {
  if (typeof window === 'undefined') return false;
  let rawLen = 0;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    rawLen = Array.isArray(raw) ? raw.length : 0;
  } catch {
    return false;
  }
  const live = getSavedProps();
  if (live.length === rawLen) return false;
  persist(live);
  return true;
}

function persist(list: SavedProp[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_SAVED_PROPS)));
    window.dispatchEvent(new Event(SAVED_PROPS_EVENT));
  } catch {
    // Storage full / disabled (private mode) — fail silently; it's a convenience.
  }
}

export function isPropSaved(
  list: SavedProp[],
  p: {
    sport: Sport;
    slug: string;
    stat: StatKey;
    line: number;
    side: PropSide;
    source: string;
  },
): boolean {
  const k = propKey(p);
  return list.some((s) => propKey(s) === k);
}

export function removeSavedProp(p: {
  sport: Sport;
  slug: string;
  stat: StatKey;
  line: number;
  side: PropSide;
  source: string;
}): void {
  const k = propKey(p);
  persist(getSavedProps().filter((s) => propKey(s) !== k));
}

/** Remove every saved prop for a player (used when clearing a player off /playbook). */
export function removePlayerProps(sport: Sport, slug: string): void {
  persist(getSavedProps().filter((s) => !(s.sport === sport && s.slug === slug)));
}

/**
 * Toggle a prop's saved state. Returns the NEW state (true = now saved). `savedAt`
 * is stamped here so callers stay pure.
 *
 * Over/Under are mutually exclusive for a given (player, stat, line, source): saving
 * one side drops the other at that book, so the Playbook tracks a single direction per
 * line per source (the same line at another book is independent). Clicking the
 * already-saved side just removes it.
 */
export function toggleSavedProp(prop: Omit<SavedProp, 'savedAt'>): boolean {
  const list = getSavedProps();
  if (isPropSaved(list, prop)) {
    const k = propKey(prop);
    persist(list.filter((s) => propKey(s) !== k));
    return false;
  }
  // Drop any existing side for this (player, stat, line, source), then add this one.
  const others = list.filter(
    (s) =>
      !(
        s.sport === prop.sport &&
        s.slug === prop.slug &&
        s.stat === prop.stat &&
        s.line === prop.line &&
        s.source === prop.source
      ),
  );
  persist([{ ...prop, team: prop.team ?? null, savedAt: Date.now() }, ...others]);
  return true;
}
