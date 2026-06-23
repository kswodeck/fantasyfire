// src/ingest/nba/columnar.ts
//
// Converts the columnar stats.nba.com format (parallel `headers[]` + `rowSet[][]`)
// into row objects keyed by header name, plus safe value coercion helpers.

import type { NbaResultSet, NbaStatsResponse, NbaRow } from './types';

/** Pick a result set by name; fall back to the first one. */
export function selectResultSet(resp: NbaStatsResponse, name?: string): NbaResultSet {
  const sets = resp.resultSets ?? (resp.resultSet ? [resp.resultSet] : []);
  if (sets.length === 0) {
    throw new Error('NBA response contained no resultSets');
  }
  if (name) {
    const match = sets.find((s) => s.name === name);
    if (match) return match;
  }
  return sets[0];
}

/**
 * Flatten a columnar result set into row objects keyed by header NAME.
 * Name-based mapping means column reordering by the NBA does not break callers.
 */
export function rowsFromResultSet(rs: NbaResultSet): NbaRow[] {
  const { headers, rowSet } = rs;
  return rowSet.map((row) => {
    const obj: NbaRow = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = i < row.length ? row[i] : null;
    }
    return obj;
  });
}

/** Warn (don't throw) if expected columns are missing — surfaces NBA renames. */
export function assertColumns(rs: NbaResultSet, expected: string[], context: string): void {
  const present = new Set(rs.headers);
  const missing = expected.filter((c) => !present.has(c));
  if (missing.length > 0) {
    console.warn(
      `[nba] ${context}: missing expected columns: ${missing.join(', ')}.\n` +
        `      Available: ${rs.headers.join(', ')}.\n` +
        `      Update the field map in client.ts to match the new column names.`
    );
  }
}

// ---------- value coercion ----------

/** Coerce to number; null/empty/non-numeric -> 0 (for counting stats). */
export function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Coerce to number or null (for genuinely optional values like PLUS_MINUS). */
export function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

export function toStrOrNull(v: unknown): string | null {
  return v === null || v === undefined || v === '' ? null : String(v);
}

/**
 * Parse a minutes value. /leaguegamelog usually returns a number, but some box
 * score endpoints return "MM:SS" — handle both, return decimal minutes or null.
 */
export function parseMinutes(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v);
  if (s.includes(':')) {
    const [m, sec] = s.split(':').map(Number);
    if (!Number.isFinite(m)) return null;
    return m + (Number.isFinite(sec) ? sec / 60 : 0);
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
