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
import { DEFAULT_PROVIDED_SOURCE, orderSources } from '@/lib/providedSources';

/** Master switch. Anything other than "true" keeps the feature inert. */
export function providedLinesEnabled(): boolean {
  return process.env.PROVIDED_LINES_ENABLED === 'true';
}

/** Only consider lines from roughly the current slate window. */
const RECENT_WINDOW_DAYS = 3;

function recentCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - RECENT_WINDOW_DAYS * 86_400_000);
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
 * Latest line for one player + stat from a SPECIFIC source, or null when the
 * feature is off / that book has no line. Used by the player research page.
 */
export async function getProvidedLine(
  sport: Sport,
  playerId: number,
  stat: StatKey,
  source: string = DEFAULT_PROVIDED_SOURCE,
): Promise<number | null> {
  if (!providedLinesEnabled()) return null;
  try {
    const row = await db.providedLine.findFirst({
      where: { sport, playerId, stat, source },
      orderBy: [{ gameDate: 'desc' }, { fetchedAt: 'desc' }],
      select: { line: true },
    });
    return row?.line ?? null;
  } catch (e) {
    console.warn('[providedLines] getProvidedLine failed; falling back to computed line:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Batched provided lines for a set of players from a SPECIFIC source, keyed
 * `${playerId}:${stat}` → line. One query for the whole board scan; empty map when
 * the feature is off. Newest line per key wins.
 */
export async function getProvidedLineMap(
  sport: Sport,
  playerIds: number[],
  source: string = DEFAULT_PROVIDED_SOURCE,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!providedLinesEnabled() || playerIds.length === 0) return map;

  try {
    const rows = await db.providedLine.findMany({
      where: { sport, source, playerId: { in: playerIds }, gameDate: { gte: recentCutoff() } },
      orderBy: [{ gameDate: 'desc' }, { fetchedAt: 'desc' }],
      select: { playerId: true, stat: true, line: true },
    });
    for (const r of rows) {
      const key = `${r.playerId}:${r.stat}`;
      if (!map.has(key)) map.set(key, r.line); // rows are newest-first
    }
  } catch (e) {
    console.warn('[providedLines] getProvidedLineMap failed; falling back to computed lines:', e instanceof Error ? e.message : e);
  }
  return map;
}
