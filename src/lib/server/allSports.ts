// Cross-sport ("All Sports") aggregation for the Heat Check + Trends boards. Loads
// each in-season sport's per-book boards (or its median-line board when no book lines
// exist) and merges them into one list per book, re-ranked across leagues by the same
// key the single-sport boards use — FireFactor for Heat Check, the Wilson lower bound
// for Trends. Each row already carries its own sport (row.player.sport), so the UI
// links and the league chip stay correct in a mixed list.
import { SPORT_LIST, type Sport } from '@/lib/sports';
import { orderSources } from '@/lib/providedSources';
import { bestVariantScore } from '@/lib/payoutVariant';
import type { BoardRow, TrendRow } from '@/lib/types';
import {
  getBoard,
  getSourcedBoards,
  getTrendBoard,
  getSourcedTrends,
  hasUpcomingGames,
} from './players';
import { getAvailableSources } from './providedLines';

// Top-N kept after merging the (up to 3) per-sport lists — a deep-enough cross-sport
// board without shipping every sport's full 150 rows three times over.
const MERGE_CAP = 200;

/** The sports with games on the board right now (off-season sports are skipped). */
async function activeSports(): Promise<Sport[]> {
  const flags = await Promise.all(
    SPORT_LIST.map(async (s) =>
      (await hasUpcomingGames(s).catch(() => false)) ? s : null,
    ),
  );
  return flags.filter((s): s is Sport => s !== null);
}

function rankBoard(rows: BoardRow[]): BoardRow[] {
  // Same key as the per-sport boards: the SHOWN line's read first (the board must
  // look strictly FireFactor-sorted), best-rung as the tie-break.
  return [...rows]
    .sort(
      (a, b) =>
        b.fireScore.score - a.fireScore.score ||
        bestVariantScore(b.fireScore.score, b.variants) -
          bestVariantScore(a.fireScore.score, a.variants),
    )
    .slice(0, MERGE_CAP)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

function rankTrends(rows: TrendRow[]): TrendRow[] {
  return [...rows]
    .sort((a, b) => b.recentLower - a.recentLower)
    .slice(0, MERGE_CAP)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export interface AllSportsBoard {
  /** One merged, FireFactor-ranked board per book (across the sports that list it). */
  boardsBySource: Record<string, BoardRow[]>;
  /** Books available in at least one active sport, in display order. */
  sources: string[];
  /** Median-line fallback merged across sports — used only when no book lines exist. */
  medianRows: BoardRow[];
  /** false when every sport is off-season (no games anywhere). */
  anyUpcoming: boolean;
}

export async function getAllSportsBoard(): Promise<AllSportsBoard> {
  const active = await activeSports();
  if (active.length === 0)
    return { boardsBySource: {}, sources: [], medianRows: [], anyUpcoming: false };

  // Per sport: its real-book boards when any book is ingested, else its median board
  // (mirrors the single-sport Heat Check page's source/median split).
  const perSport = await Promise.all(
    active.map(async (sport) => {
      const sources = await getAvailableSources(sport).catch((): string[] => []);
      if (sources.length > 0) {
        const bySource = await getSourcedBoards(sport, sources, {
          limit: 150,
          perStatCap: 30,
        }).catch((): Record<string, BoardRow[]> => ({}));
        return { sources, bySource, median: [] as BoardRow[] };
      }
      const median = await getBoard(sport, { limit: 150, perStatCap: 30 }).catch(
        (): BoardRow[] => [],
      );
      return {
        sources: [] as string[],
        bySource: {} as Record<string, BoardRow[]>,
        median,
      };
    }),
  );

  const sources = orderSources([...new Set(perSport.flatMap((p) => p.sources))]);
  const boardsBySource: Record<string, BoardRow[]> = {};
  for (const src of sources) {
    boardsBySource[src] = rankBoard(perSport.flatMap((p) => p.bySource[src] ?? []));
  }
  const medianRows = rankBoard(perSport.flatMap((p) => p.median));

  return { boardsBySource, sources, medianRows, anyUpcoming: true };
}

export interface AllSportsTrends {
  bySource: Record<string, TrendRow[]>;
  sources: string[];
  /** Median-line fallback merged across sports — used only when no book lines exist. */
  rows: TrendRow[];
  anyUpcoming: boolean;
}

export async function getAllSportsTrends(): Promise<AllSportsTrends> {
  const active = await activeSports();
  if (active.length === 0)
    return { bySource: {}, sources: [], rows: [], anyUpcoming: false };

  const perSport = await Promise.all(
    active.map(async (sport) => {
      const sources = await getAvailableSources(sport).catch((): string[] => []);
      if (sources.length > 0) {
        const bySource = await getSourcedTrends(sport, sources).catch(
          (): Record<string, TrendRow[]> => ({}),
        );
        return { sources, bySource, median: [] as TrendRow[] };
      }
      const median = await getTrendBoard(sport).catch((): TrendRow[] => []);
      return {
        sources: [] as string[],
        bySource: {} as Record<string, TrendRow[]>,
        median,
      };
    }),
  );

  const sources = orderSources([...new Set(perSport.flatMap((p) => p.sources))]);
  const bySource: Record<string, TrendRow[]> = {};
  for (const src of sources) {
    bySource[src] = rankTrends(perSport.flatMap((p) => p.bySource[src] ?? []));
  }
  const rows = rankTrends(perSport.flatMap((p) => p.median));

  return { bySource, sources, rows, anyUpcoming: true };
}
