// Optional "real lines" lookup — the seam between the ProvidedLine feed (PrizePicks /
// Underdog / …) and the research surfaces that otherwise show our computed line.
//
// OFF BY DEFAULT. When PROVIDED_LINES_ENABLED is not "true", every function here
// returns null / empty WITHOUT touching the database — so surfaces fall back to the
// computed line and nothing changes. Each lookup is SOURCE-EXPLICIT: it returns the
// line from exactly the requested book, or null (→ caller falls back to its own
// line). It never silently substitutes a different book.
import { cache } from 'react';
import { db } from '@/lib/db';
import type { Sport } from '@/lib/sports';
import type { StatKey } from '@/lib/stats';
import type { ProvidedVariant } from '@/lib/types';
import { DEFAULT_PROVIDED_SOURCE, orderSources } from '@/lib/providedSources';
import { pickRepresentative, isNormalKind, effectiveOddsType } from '@/lib/payoutVariant';

/** Master switch. Anything other than "true" keeps the feature inert. */
export function providedLinesEnabled(): boolean {
  return process.env.PROVIDED_LINES_ENABLED === 'true';
}

/** Board/streaks/trends only consider lines from roughly the current slate window. */
const RECENT_WINDOW_DAYS = 3;
/** The player research page tolerates a slightly older line than the live board (a
 *  player may be between games), but it's still bounded so a stale post-game line
 *  never shows as "current" — and so old rows stay safely prunable (run-prune.ts). */
const RESEARCH_WINDOW_DAYS = 14;

function recentCutoff(days: number = RECENT_WINDOW_DAYS, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

/**
 * The books that currently have recent lines for a sport, display-ordered — used to
 * populate the source dropdown. Empty when the feature is off or nothing's ingested.
 *
 * cache(): asked per sport by both the sport pages and the all-sports
 * aggregators within one render — memoize to one query per sport.
 */
export const getAvailableSources = cache(async (sport: Sport): Promise<string[]> => {
  if (!providedLinesEnabled()) return [];
  // Fail safe: a missing table (flag enabled before the migration runs) or a DB
  // hiccup must degrade to "no books" (computed lines), never 500 a page.
  try {
    const rows = await db.providedLine.findMany({
      where: { sport, gameDate: { gte: recentCutoff() } },
      distinct: ['source'],
      select: { source: true },
    });
    return orderSources(rows.map((r) => r.source));
  } catch (e) {
    console.warn('[providedLines] getAvailableSources failed; treating as none:', e instanceof Error ? e.message : e);
    return [];
  }
});

/**
 * One source's variant ladder (every rung — PrizePicks demon/goblin, Underdog
 * alternate — for a player + stat), most-recent slate only. A source may offer
 * several lines now; this returns them all so the player page can render the
 * switcher/ladder. Empty when the feature is off or that book has no recent line.
 * Restricted to the newest gameDate present so stale prior-slate rungs never mix in.
 */
export async function getProvidedVariants(
  sport: Sport,
  playerId: number,
  stat: StatKey,
  source: string = DEFAULT_PROVIDED_SOURCE,
): Promise<ProvidedVariant[]> {
  if (!providedLinesEnabled()) return [];
  try {
    const rows = await db.providedLine.findMany({
      where: { sport, playerId, stat, source, gameDate: { gte: recentCutoff(RESEARCH_WINDOW_DAYS) } },
      orderBy: [{ gameDate: 'desc' }, { fetchedAt: 'desc' }],
      select: { line: true, oddsType: true, multiplier: true, overOdds: true, underOdds: true, gameDate: true },
    });
    const out: ProvidedVariant[] = [];
    let day: number | null = null;
    // One rung per line (the UI selects rungs by line): newest fetch wins, except a
    // NORMAL rung beats a variant that shares its number — the plain line must stay
    // the plain line for consensus math and the switcher's "back to standard" funnel.
    const idxByLine = new Map<number, number>();
    for (const r of rows) {
      const d = r.gameDate.getTime();
      if (day === null) day = d; // newest slate wins
      else if (d !== day) continue; // skip older-slate rungs
      // effectiveOddsType: a "standard"-tagged rung with a far-from-1× multiplier
      // and no odds is really a payout variant (legacy Pick6 rows) — normalize
      // here so every consumer (scoring, side-pinning, filters) agrees.
      const oddsType = effectiveOddsType(r) ?? r.oddsType;
      const variant: ProvidedVariant = {
        source,
        line: r.line,
        oddsType,
        multiplier: r.multiplier,
        overOdds: r.overOdds,
        underOdds: r.underOdds,
      };
      const at = idxByLine.get(r.line);
      if (at === undefined) {
        idxByLine.set(r.line, out.length);
        out.push(variant);
      } else if (isNormalKind(oddsType) && !isNormalKind(out[at].oddsType)) {
        out[at] = variant;
      }
    }
    return out;
  } catch (e) {
    console.warn('[providedLines] getProvidedVariants failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Representative line for one player + stat from a SPECIFIC source, or null when the
 * feature is off / that book has no recent line. Used by the player research page as
 * the default line. When the source offers a ladder (PrizePicks demon/goblin), this
 * picks the representative rung: prefer the plain line, else demon, else goblin.
 * Bounded to RESEARCH_WINDOW_DAYS so a stale post-game line never displays as current.
 */
export async function getProvidedLine(
  sport: Sport,
  playerId: number,
  stat: StatKey,
  source: string = DEFAULT_PROVIDED_SOURCE,
): Promise<number | null> {
  const variants = await getProvidedVariants(sport, playerId, stat, source);
  return pickRepresentative(variants, null)?.line ?? null;
}

/**
 * Every book's latest line for ONE player + stat, display-ordered — the raw input
 * for the cross-book line-value comparison on the player page. Empty when the feature
 * is off or fewer than one book has a recent line. Newest line per source wins.
 */
export async function getProvidedLinesBySource(
  sport: Sport,
  playerId: number,
  stat: StatKey,
): Promise<{ source: string; line: number }[]> {
  if (!providedLinesEnabled()) return [];
  try {
    const rows = await db.providedLine.findMany({
      where: { sport, playerId, stat, gameDate: { gte: recentCutoff(RESEARCH_WINDOW_DAYS) } },
      orderBy: [{ gameDate: 'desc' }, { fetchedAt: 'desc' }],
      select: { source: true, line: true, oddsType: true, multiplier: true, overOdds: true, underOdds: true, gameDate: true },
    });
    // A book's representative line for cross-book comparison is its STANDARD
    // rung, not merely its newest row — "newest wins" could crown a demon /
    // goblin / alternate rung fetched moments after the standard line, polluting
    // the consensus with a number no book treats as its market line. Within each
    // source's newest slate: prefer the newest NORMAL rung (post-normalization),
    // fall back to the newest rung of any kind (a ladder with no standard line —
    // e.g. an alternates-only Pick6 card — is still that book's best answer).
    const pick = latestNormalFirst(rows);
    return orderSources([...pick.keys()]).map((source) => ({ source, line: pick.get(source)!.line }));
  } catch (e) {
    console.warn('[providedLines] getProvidedLinesBySource failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

/** Per source: restrict to that source's newest slate day, then prefer the newest
 *  NORMAL rung (after effectiveOddsType normalization), else the newest rung of
 *  any kind. Rows must arrive newest-first (gameDate desc, fetchedAt desc). */
function latestNormalFirst<
  T extends {
    source: string;
    gameDate: Date;
    oddsType?: string | null;
    multiplier?: number | null;
    overOdds?: number | null;
    underOdds?: number | null;
  },
>(rows: T[]): Map<string, T> {
  const dayBySource = new Map<string, number>();
  const chosen = new Map<string, { row: T; normal: boolean }>();
  for (const r of rows) {
    const day = dayBySource.get(r.source);
    if (day === undefined) dayBySource.set(r.source, r.gameDate.getTime());
    else if (r.gameDate.getTime() !== day) continue; // older slate — ignore
    const normal = isNormalKind(effectiveOddsType(r) ?? r.oddsType);
    const cur = chosen.get(r.source);
    if (!cur) chosen.set(r.source, { row: r, normal });
    else if (normal && !cur.normal) chosen.set(r.source, { row: r, normal });
  }
  return new Map([...chosen.entries()].map(([s, c]) => [s, c.row]));
}

/**
 * Every book's latest QUOTE (line + two-sided American odds) for ONE player + stat —
 * the input for the cross-book market consensus / +EV read (idea #1). Same windowing
 * and newest-per-source rule as getProvidedLinesBySource, but it also carries the odds
 * (null for DFS pick'em books, present for sportsbooks). Empty when the feature is off.
 */
export async function getProvidedQuotesBySource(
  sport: Sport,
  playerId: number,
  stat: StatKey,
): Promise<{ source: string; line: number; overOdds: number | null; underOdds: number | null }[]> {
  if (!providedLinesEnabled()) return [];
  try {
    const rows = await db.providedLine.findMany({
      where: { sport, playerId, stat, gameDate: { gte: recentCutoff(RESEARCH_WINDOW_DAYS) } },
      orderBy: [{ gameDate: 'desc' }, { fetchedAt: 'desc' }],
      select: { source: true, line: true, oddsType: true, multiplier: true, overOdds: true, underOdds: true, gameDate: true },
    });
    // Same standard-rung preference as getProvidedLinesBySource: the market
    // consensus must be built from each book's plain line, never a variant rung
    // that happened to be fetched last.
    const pick = latestNormalFirst(rows);
    return orderSources([...pick.keys()]).map((source) => {
      const r = pick.get(source)!;
      return { source, line: r.line, overOdds: r.overOdds, underOdds: r.underOdds };
    });
  } catch (e) {
    console.warn('[providedLines] getProvidedQuotesBySource failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Batched TWO-SIDED book quotes per `${playerId}:${stat}` — every book's latest
 * (line, over/under American odds) at EACH line it quotes — the raw input for
 * MARKET-IMPLIED variant breakevens (a sportsbook quoting a demon/goblin rung's
 * exact line reveals its fair probability once de-vigged). Latest quote per
 * (book, line), so a book posting alternate lines contributes a quote at every
 * rung it prices — which rung gets a market bar must not depend on fetch order.
 * Books that post no odds (DFS pick'em) never appear. Empty when the feature is
 * off.
 *
 * This is the ONE quote set every FireFactor surface resolves payout breakevens
 * from (resolvedBreakeven) — the board and the player page must read the same
 * bar for the same rung, or the same line shows two different scores.
 */
export async function getBookQuoteMap(
  sport: Sport,
  playerIds: number[],
): Promise<Map<string, { line: number; overOdds: number; underOdds: number }[]>> {
  const map = new Map<string, { line: number; overOdds: number; underOdds: number }[]>();
  if (!providedLinesEnabled() || playerIds.length === 0) return map;
  try {
    const rows = await db.providedLine.findMany({
      where: {
        sport,
        playerId: { in: playerIds },
        gameDate: { gte: recentCutoff() },
        overOdds: { not: null },
        underOdds: { not: null },
      },
      orderBy: [{ gameDate: 'desc' }, { fetchedAt: 'desc' }],
      select: { playerId: true, stat: true, source: true, line: true, overOdds: true, underOdds: true },
    });
    const seen = new Set<string>(); // `${key}|${source}|${line}` — newest per book per line
    for (const r of rows) {
      const key = `${r.playerId}:${r.stat}`;
      const bookKey = `${key}|${r.source}|${r.line}`;
      if (seen.has(bookKey)) continue;
      seen.add(bookKey);
      let arr = map.get(key);
      if (!arr) {
        arr = [];
        map.set(key, arr);
      }
      arr.push({ line: r.line, overOdds: r.overOdds!, underOdds: r.underOdds! });
    }
  } catch (e) {
    console.warn('[providedLines] getBookQuoteMap failed; treating as none:', e instanceof Error ? e.message : e);
  }
  return map;
}

/**
 * Batched variant ladders for a set of players from a SPECIFIC source, keyed
 * `${playerId}:${stat}` → every rung (PrizePicks demon/goblin, Underdog alternate).
 * One query for the whole board scan; empty map when the feature is off. Each key is
 * restricted to its newest slate day, deduped to one rung per line (newest fetch wins).
 */
export async function getProvidedVariantMap(
  sport: Sport,
  playerIds: number[],
  source: string = DEFAULT_PROVIDED_SOURCE,
): Promise<Map<string, ProvidedVariant[]>> {
  const map = new Map<string, ProvidedVariant[]>();
  if (!providedLinesEnabled() || playerIds.length === 0) return map;

  try {
    const rows = await db.providedLine.findMany({
      where: { sport, source, playerId: { in: playerIds }, gameDate: { gte: recentCutoff() } },
      orderBy: [{ gameDate: 'desc' }, { fetchedAt: 'desc' }],
      select: { playerId: true, stat: true, line: true, oddsType: true, multiplier: true, overOdds: true, underOdds: true, gameDate: true },
    });
    const dayByKey = new Map<string, number>(); // key → newest slate day epoch
    for (const r of rows) {
      const key = `${r.playerId}:${r.stat}`;
      const d = r.gameDate.getTime();
      const chosen = dayByKey.get(key);
      if (chosen === undefined) dayByKey.set(key, d); // rows are newest-first → newest slate
      else if (d !== chosen) continue; // skip older-slate rungs
      let arr = map.get(key);
      if (!arr) {
        arr = [];
        map.set(key, arr);
      }
      // Same effectiveOddsType normalization as getProvidedVariants — the board
      // and the player page must classify a rung identically.
      const oddsType = effectiveOddsType(r) ?? r.oddsType;
      const variant: ProvidedVariant = {
        source,
        line: r.line,
        oddsType,
        multiplier: r.multiplier,
        overOdds: r.overOdds,
        underOdds: r.underOdds,
      };
      // One rung per line (the UI selects rungs by line); a NORMAL rung beats a
      // variant sharing its number — see getProvidedVariants.
      const at = arr.findIndex((v) => v.line === r.line);
      if (at === -1) arr.push(variant);
      else if (isNormalKind(oddsType) && !isNormalKind(arr[at].oddsType)) arr[at] = variant;
    }
  } catch (e) {
    console.warn('[providedLines] getProvidedVariantMap failed; treating as none:', e instanceof Error ? e.message : e);
  }
  return map;
}

/**
 * Batched representative lines for a set of players from a SPECIFIC source, keyed
 * `${playerId}:${stat}` → line. One query for the whole board scan; empty map when
 * the feature is off. When a source offers a ladder, the representative rung wins
 * (prefer plain line, else demon, else goblin) — see pickRepresentative.
 */
export async function getProvidedLineMap(
  sport: Sport,
  playerIds: number[],
  source: string = DEFAULT_PROVIDED_SOURCE,
): Promise<Map<string, number>> {
  const variantMap = await getProvidedVariantMap(sport, playerIds, source);
  const map = new Map<string, number>();
  for (const [key, variants] of variantMap) {
    const rep = pickRepresentative(variants, null);
    if (rep) map.set(key, rep.line);
  }
  return map;
}
