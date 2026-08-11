// Pure stale-row math for the provided-lines authoritative sync (run-ingest-
// providedlines.ts). Side-effect free so it's unit-testable without a DB.
//
// A successful scrape returns a source's ENTIRE current board for a slate
// (source, sport, gameDate), so any stored row for that slate the run did NOT
// just write is a line the book no longer offers — dropped (scratch, news, the
// board tightening) or re-classified under a different oddsType. Deleting those
// keeps the site from showing lines the book has pulled.
//
// Safety: sources that fail to scrape contribute no rows, so their slates are
// never touched. Within a fetched slate, a suspiciously THIN result (below
// AUTHORITATIVE_MIN_ROWS) falls back to the narrow re-classification-only prune —
// a half-broken scraper (truncated page, partial board) must not erase a valid
// board it merely failed to return.

/** Minimum rows a run must have written for a slate before its unwritten stored
 *  rows are treated as authoritatively gone. Real boards run to hundreds of rows;
 *  below this the scrape is more likely broken than the book's board this small. */
export const AUTHORITATIVE_MIN_ROWS = 10;

/**
 * Tag vocabularies a source's scraper has RETIRED — DK Pick6 and Sleeper once
 * tagged their harder/easier rungs demon/goblin, and both now model every
 * off-standard rung as an `alternate` with its exact multiplier (like Underdog).
 * Any stored row still carrying a retired tag is definitionally stale, but the
 * slate-scoped authoritative prune can't see it when its slate is never
 * re-fetched (past game days linger in the 14-day research window) — so the
 * ingest sweeps these every run. Keep in sync with each scraper's oddsType
 * output; PrizePicks legitimately still emits demon/goblin.
 */
export const RETIRED_SOURCE_TAGS: Readonly<Record<string, readonly string[]>> = {
  pick6: ['demon', 'goblin'],
  sleeper: ['demon', 'goblin'],
};

/**
 * Canonical form for club/team display names so a book's spelling matches ours:
 * lowercase, diacritics stripped (CF Montréal ↔ CF Montreal), punctuation dropped,
 * and the generic club tokens fc/cf/sc removed ("Atlanta United FC" ↔ "Atlanta
 * United", "Inter Miami CF" ↔ "Inter Miami"). Equality on this form is the gate
 * for combined-feed sports (see ProvidedLineRow.externalTeamName) — deliberately
 * exact-match only, so "Chicago Stars" (NWSL) never matches "Chicago Fire" (MLS).
 */
export function normalizeClubName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics (post-NFD combining marks)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && t !== 'fc' && t !== 'cf' && t !== 'sc')
    .join(' ');
}

export interface RowKey {
  playerId: number;
  stat: string;
  line: number;
  oddsType: string;
}

const fullKey = (r: RowKey) => `${r.playerId}|${r.stat}|${r.line}|${r.oddsType}`;
const lineKey = (r: RowKey) => `${r.playerId}|${r.stat}|${r.line}`;

/**
 * The stored rows of ONE slate that should be deleted, given what this run wrote
 * for that same slate.
 *
 *  - Full board (written ≥ AUTHORITATIVE_MIN_ROWS): every stored row whose exact
 *    (playerId, stat, line, oddsType) was not re-written is stale.
 *  - Thin board: only re-classifications are stale — a row whose exact line was
 *    re-written under a different oddsType (the pre-existing narrow rule).
 */
export function staleRows<T extends RowKey>(existing: T[], written: RowKey[]): T[] {
  if (written.length >= AUTHORITATIVE_MIN_ROWS) {
    const kept = new Set(written.map(fullKey));
    return existing.filter((e) => !kept.has(fullKey(e)));
  }
  const typesByLine = new Map<string, Set<string>>();
  for (const w of written) {
    let types = typesByLine.get(lineKey(w));
    if (!types) typesByLine.set(lineKey(w), (types = new Set()));
    types.add(w.oddsType);
  }
  return existing.filter((e) => {
    const types = typesByLine.get(lineKey(e));
    return types !== undefined && !types.has(e.oddsType); // touched this line, other tag
  });
}

/**
 * Why a run that fetched NOTHING from any source should fail — or null when the
 * drought is legitimate.
 *
 * This is the check that was missing. A total drought used to `return 0` as a
 * SUCCESS: every scraper swallowed its own request errors, the runner swallowed what
 * was left, and "no book has a single line" was recorded as a healthy run that simply
 * had nothing to write. The board silently fell back to our own median lines and
 * stayed there for days behind a green ingest.
 *
 * Zero lines is only credible when every sport is off-season. While anything is
 * playing the books post props, so an empty result is an outage and the job must exit
 * non-zero — which is what actually notifies (the workflow has no continue-on-error,
 * and its injuries step runs `if: always()`, so it is unaffected).
 */
export function droughtFailure(
  inSeasonSports: readonly string[],
  failed: ReadonlyMap<string, string>,
): string | null {
  if (inSeasonSports.length === 0) return null;
  const why = failed.size
    ? `failed: ${[...failed].map(([id, msg]) => `${id} (${msg})`).join('; ')}`
    : 'no source even reported a failure — every book returned an empty board, which is not credible mid-season';
  return (
    `No lines from ANY source while ${inSeasonSports.join('/')} ` +
    `${inSeasonSports.length === 1 ? 'is' : 'are'} in season. ${why}`
  );
}
