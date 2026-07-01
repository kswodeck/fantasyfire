// Optional "real lines" lookup — the seam between the ProvidedLine feed (PrizePicks /
// Underdog / …) and the research surfaces that otherwise show our computed line.
//
// OFF BY DEFAULT. When PROVIDED_LINES_ENABLED is not "true", every function here
// returns null / empty WITHOUT touching the database — so surfaces fall back to the
// computed line and nothing changes. Each lookup is SOURCE-EXPLICIT: it returns the
// line from exactly the requested book, or null (→ caller falls back to its own
// line). It never silently substitutes a different book.
import { db } from '@/lib/db';
import type { Sport } from '@/lib/sports';
import type { StatKey } from '@/lib/stats';
import type { ProvidedVariant } from '@/lib/types';
import { DEFAULT_PROVIDED_SOURCE, orderSources } from '@/lib/providedSources';
import { pickRepresentative, isNormalKind } from '@/lib/payoutVariant';

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
 */
export async function getAvailableSources(sport: Sport): Promise<string[]> {
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
}

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
      const variant: ProvidedVariant = {
        source,
        line: r.line,
        oddsType: r.oddsType,
        multiplier: r.multiplier,
        overOdds: r.overOdds,
        underOdds: r.underOdds,
      };
      const at = idxByLine.get(r.line);
      if (at === undefined) {
        idxByLine.set(r.line, out.length);
        out.push(variant);
      } else if (isNormalKind(r.oddsType) && !isNormalKind(out[at].oddsType)) {
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
      select: { source: true, line: true },
    });
    const latest = new Map<string, number>();
    for (const r of rows) if (!latest.has(r.source)) latest.set(r.source, r.line); // newest-first
    return orderSources([...latest.keys()]).map((source) => ({ source, line: latest.get(source) as number }));
  } catch (e) {
    console.warn('[providedLines] getProvidedLinesBySource failed:', e instanceof Error ? e.message : e);
    return [];
  }
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
      select: { source: true, line: true, overOdds: true, underOdds: true },
    });
    const latest = new Map<string, { line: number; overOdds: number | null; underOdds: number | null }>();
    for (const r of rows) {
      if (!latest.has(r.source)) {
        latest.set(r.source, { line: r.line, overOdds: r.overOdds, underOdds: r.underOdds });
      }
    }
    return orderSources([...latest.keys()]).map((source) => ({ source, ...latest.get(source)! }));
  } catch (e) {
    console.warn('[providedLines] getProvidedQuotesBySource failed:', e instanceof Error ? e.message : e);
    return [];
  }
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
      const variant: ProvidedVariant = {
        source,
        line: r.line,
        oddsType: r.oddsType,
        multiplier: r.multiplier,
        overOdds: r.overOdds,
        underOdds: r.underOdds,
      };
      // One rung per line (the UI selects rungs by line); a NORMAL rung beats a
      // variant sharing its number — see getProvidedVariants.
      const at = arr.findIndex((v) => v.line === r.line);
      if (at === -1) arr.push(variant);
      else if (isNormalKind(r.oddsType) && !isNormalKind(arr[at].oddsType)) arr[at] = variant;
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
