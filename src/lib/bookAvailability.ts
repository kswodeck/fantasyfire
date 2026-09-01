// Where each book actually offers the over/under player-prop product this site is
// about — so a paid link is never shown to a reader who cannot act on it.
//
// This exists for two reasons that point the same way. A link to a product that is
// not offered in the reader's state is a dead end (bad for them) and an unpaid click
// (bad for us). Suppressing it is the rare change that improves both at once.
//
// Pure and client-safe: no db, no server-only, no Next imports — the client gates on
// it after reading the region from /api/v1/geo.
//
// ─────────────────────────────────────────────────────────────────────────────
// DATA FRESHNESS — READ BEFORE TRUSTING THIS FILE
//
// Compiled 2026-09-01 from public reporting. DFS pick'em availability is one of the
// fastest-moving areas in this space: operators withdraw from states under a
// settlement, convert to a peer-to-peer format, and relaunch under a license,
// sometimes within one season. Treat the table as a periodically-verified snapshot,
// re-check it against each operator's own state page before a season, and prefer
// removing an entry you cannot confirm over keeping a stale one.
//
// Deliberately NOT populated for books whose state-by-state position could not be
// pinned down to a confident list. An unverified book returns 'unknown' and keeps
// its link, which is the honest default — see the return contract below.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * - `ok`          — the book offers this product in the reader's state; link away.
 * - `unavailable` — confirmed not offered there; suppress the link.
 * - `unknown`     — no region, non-US, or no verified table for this book. The
 *                   caller SHOWS the link. Failing open is deliberate: a geo lookup
 *                   that fails, is blocked by a privacy extension, or returns a
 *                   region we don't recognise must never silently strip the page's
 *                   functionality. We would rather show an occasional link someone
 *                   can't use than hide one from someone who can.
 */
export type BookAvailability = 'ok' | 'unavailable' | 'unknown';

/** What /api/v1/geo returns: the edge's coarse view of where the reader is. */
export interface GeoHint {
  /** ISO 3166-1 alpha-2, e.g. "US". */
  country: string | null | undefined;
  /** Subdivision code within that country, e.g. "CA" for California. */
  region: string | null | undefined;
}

// A subdivision code is only meaningful alongside its country: "CA" is California
// in the US and nothing of the sort in Canada, and "ON" (Ontario) is a perfectly
// well-formed two-letter code that is not a US state at all. The table below is
// US-only, so the country gate is what stops a Canadian reader being measured
// against it.
const US_STATE_CODE = /^[A-Z]{2}$/;

/**
 * States where the book does NOT offer standard over/under player pick'em, either
 * because it does not operate there at all or because that specific contest type is
 * disallowed while the app is otherwise available.
 *
 * PrizePicks (the board's default source, and so the large majority of the paid
 * links on the site):
 *   - Does not offer player pick'em in: CT, HI, IA, ID, LA, MD, MI, MS, MT, NV, NJ,
 *     OH, PA, WA. In several of these (CT, IA, MD, MI, OH and others) the app is
 *     present but runs the peer-to-peer "Arena" product instead of versus-the-house
 *     pick'em, which is not the market our lines describe.
 *   - AZ: pick'em and best-ball contests are not offered.
 *   - MO: over/under player-prop contests specifically are not permitted — i.e.
 *     precisely the market this site is built around, even though the app is
 *     otherwise available. Sources conflict on AZ and MO more than on the rest;
 *     both are listed here because suppressing a link we are unsure about costs a
 *     click, while showing one costs the reader a wasted trip.
 */
const NO_OVER_UNDER_PICKEM: Readonly<Record<string, ReadonlySet<string>>> = {
  prizepicks: new Set([
    'AZ',
    'CT',
    'HI',
    'IA',
    'ID',
    'LA',
    'MD',
    'MI',
    'MO',
    'MS',
    'MT',
    'NV',
    'NJ',
    'OH',
    'PA',
    'WA',
  ]),
  // underdog / sleeper / pick6: intentionally absent until each one's state list is
  // confirmed against the operator's own page. Adding a half-remembered list here
  // would suppress links in states where the product is fine, which is a worse
  // failure than showing one too many.
};

/**
 * Whether `bookId` offers the over/under prop product where the reader is.
 *
 * Everything we cannot positively confirm is `unknown`, and the caller shows the
 * link: no geo, a country we hold no table for, a malformed subdivision, or a book
 * whose state list has not been verified.
 */
export function bookAvailability(bookId: string, geo: GeoHint): BookAvailability {
  const country = geo.country?.trim().toUpperCase();
  const region = geo.region?.trim().toUpperCase();
  if (!country || !region) return 'unknown';

  // The only table we have is US state-by-state. Outside the US we say nothing
  // rather than reason from a code that means something different there.
  if (country !== 'US') return 'unknown';
  if (!US_STATE_CODE.test(region)) return 'unknown';

  const restricted = NO_OVER_UNDER_PICKEM[bookId];
  if (!restricted) return 'unknown';

  return restricted.has(region) ? 'unavailable' : 'ok';
}
