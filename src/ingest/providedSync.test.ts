import { describe, it, expect } from 'vitest';
import {
  staleRows,
  normalizeClubName,
  AUTHORITATIVE_MIN_ROWS,
  dedupeUpsertRows,
  buildUpsertChunk,
  UPSERT_COLS,
  UPSERT_CHUNK,
  type RowKey,
  type UpsertRow,
} from './providedSync';

type Row = RowKey & { id: number };

const row = (id: number, playerId: number, stat: string, line: number, oddsType = 'standard'): Row => ({
  id,
  playerId,
  stat,
  line,
  oddsType,
});

const key = ({ playerId, stat, line, oddsType }: Row): RowKey => ({ playerId, stat, line, oddsType });

/** A written board big enough to trip the authoritative path. */
function fullBoard(): Row[] {
  return Array.from({ length: AUTHORITATIVE_MIN_ROWS }, (_, i) => row(100 + i, 100 + i, 'hits', 0.5));
}

describe('staleRows', () => {
  it('authoritative: a stored line the book dropped is stale once the board is full-sized', () => {
    const dropped = row(1, 7, 'so', 0.5, 'demon');
    const written = fullBoard();
    expect(staleRows([...written, dropped], written.map(key))).toEqual([dropped]);
  });

  it('authoritative: re-written rows survive, including exact variant matches', () => {
    const written = [...fullBoard(), row(1, 7, 'so', 0.5, 'demon')];
    expect(staleRows(written, written.map(key))).toEqual([]);
  });

  it('authoritative: a re-classified rung (same line, new tag) is stale', () => {
    const oldTag = row(1, 7, 'so', 1.5, 'goblin');
    const written = [...fullBoard(), row(2, 7, 'so', 1.5, 'alternate')];
    expect(staleRows([...written, oldTag], written.map(key))).toEqual([oldTag]);
  });

  it('thin board: only re-classifications are stale, dropped lines survive', () => {
    // Below the floor the scrape is treated as suspect: the dropped-line delete is
    // skipped, but a rung re-written at the same number under a new tag still prunes.
    const dropped = row(1, 7, 'so', 0.5, 'demon');
    const reTagged = row(2, 8, 'tb', 1.5, 'goblin');
    const written: RowKey[] = [{ playerId: 8, stat: 'tb', line: 1.5, oddsType: 'alternate' }];
    expect(written.length).toBeLessThan(AUTHORITATIVE_MIN_ROWS);
    expect(staleRows([dropped, reTagged], written)).toEqual([reTagged]);
  });

  it('nothing written → nothing stale (failed / empty scrape never deletes)', () => {
    expect(staleRows([row(1, 7, 'so', 0.5)], [])).toEqual([]);
  });
});

describe('normalizeClubName', () => {
  it('canonicalizes case, diacritics, punctuation, and generic club tokens', () => {
    expect(normalizeClubName('Atlanta United FC')).toBe('atlanta united');
    expect(normalizeClubName('CF Montréal')).toBe('montreal');
    expect(normalizeClubName('CF Montreal')).toBe('montreal');
    expect(normalizeClubName('St. Louis City SC')).toBe('st louis city');
    expect(normalizeClubName('Inter Miami CF')).toBe('inter miami');
    expect(normalizeClubName('D.C. United')).toBe('d c united');
    expect(normalizeClubName('LAFC')).toBe('lafc');
  });

  it('book spellings match our ESPN names on the canonical form', () => {
    // PP posts full club names in `market` — these are the pairs that must agree.
    expect(normalizeClubName('Inter Miami')).toBe(normalizeClubName('Inter Miami CF'));
    expect(normalizeClubName('Atlanta United')).toBe(normalizeClubName('Atlanta United FC'));
    expect(normalizeClubName('Houston Dynamo')).toBe(normalizeClubName('Houston Dynamo FC'));
  });

  it('never cross-matches other competitions (exact equality, no containment)', () => {
    // NWSL / EPL clubs from the same combined PP SOCCER feed must not hit MLS clubs.
    const mls = ['Chicago Fire FC', 'LA Galaxy', 'Seattle Sounders FC'].map(normalizeClubName);
    for (const other of ['Chicago Stars FC', 'Manchester United', 'Seattle Reign FC']) {
      expect(mls).not.toContain(normalizeClubName(other));
    }
  });
});

// --- bulk upsert assembly -------------------------------------------------

const uRow = (o: Partial<UpsertRow> = {}): UpsertRow => ({
  sport: 'nba',
  playerId: 1,
  stat: 'pts',
  source: 'prizepicks',
  gameDate: new Date('2026-08-24T00:00:00.000Z'),
  line: 25.5,
  oddsType: 'standard',
  overOdds: -110,
  underOdds: -110,
  multiplier: null,
  ...o,
});

describe('dedupeUpsertRows', () => {
  it('keeps the LAST row for a repeated unique key', () => {
    // Postgres rejects an INSERT that hits the same conflict key twice, and the old
    // per-row loop resolved it as last-write-wins; this must match that.
    const out = dedupeUpsertRows([uRow({ overOdds: -200 }), uRow({ overOdds: -300 })]);
    expect(out).toHaveLength(1);
    expect(out[0].overOdds).toBe(-300);
  });

  it('treats every component of the unique key as distinguishing', () => {
    const rows = [
      uRow(),
      uRow({ sport: 'mlb' }),
      uRow({ playerId: 2 }),
      uRow({ stat: 'reb' }),
      uRow({ source: 'underdog' }),
      uRow({ gameDate: new Date('2026-08-25T00:00:00.000Z') }),
      uRow({ line: 26.5 }),
      uRow({ oddsType: 'demon' }),
    ];
    expect(dedupeUpsertRows(rows)).toHaveLength(rows.length);
  });

  it('does NOT collapse rows differing only in non-key columns', () => {
    // odds/multiplier are updated, never part of the conflict target.
    const out = dedupeUpsertRows([uRow({ line: 1.5 }), uRow({ line: 2.5 })]);
    expect(out).toHaveLength(2);
  });

  it('is a no-op on already-unique input', () => {
    const rows = [uRow(), uRow({ playerId: 2 }), uRow({ playerId: 3 })];
    expect(dedupeUpsertRows(rows)).toHaveLength(3);
  });
});

describe('buildUpsertChunk', () => {
  it('binds $1 to fetchedAt and 10 params per row, in column order', () => {
    const at = new Date('2026-08-24T12:00:00.000Z');
    const r = uRow({ playerId: 7, line: 30.5, multiplier: 1.25 });
    const { values } = buildUpsertChunk([r], at);
    expect(values[0]).toBe(at);
    expect(values.slice(1)).toEqual([
      r.sport, r.playerId, r.stat, r.source, r.gameDate,
      r.line, r.oddsType, r.overOdds, r.underOdds, r.multiplier,
    ]);
  });

  it('numbers placeholders contiguously across many rows', () => {
    const rows = [uRow(), uRow({ playerId: 2 }), uRow({ playerId: 3 })];
    const { sql, values } = buildUpsertChunk(rows, new Date());
    // 1 shared + 10 per row.
    expect(values).toHaveLength(1 + rows.length * UPSERT_COLS);
    expect(sql).toContain('($2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$1)');
    expect(sql).toContain('($12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$1)');
    expect(sql).toContain('($22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$1)');
    // Every placeholder the params list can satisfy, and no gaps.
    const used = [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...used)).toBe(values.length);
    expect(new Set(used).size).toBe(values.length);
  });

  it('targets exactly the @@unique key and updates only the mutable columns', () => {
    const { sql } = buildUpsertChunk([uRow()], new Date());
    expect(sql).toContain(
      'ON CONFLICT ("sport","playerId","stat","source","gameDate","line","oddsType")',
    );
    for (const c of ['overOdds', 'underOdds', 'multiplier', 'fetchedAt']) {
      expect(sql).toContain(`"${c}" = EXCLUDED."${c}"`);
    }
    // The key columns must never be rewritten by the update branch.
    for (const c of ['sport', 'playerId', 'stat', 'source', 'gameDate', 'line', 'oddsType']) {
      expect(sql).not.toContain(`"${c}" = EXCLUDED."${c}"`);
    }
  });

  it('keeps a full chunk inside Postgres 65535-parameter ceiling', () => {
    const rows = Array.from({ length: UPSERT_CHUNK }, (_, i) => uRow({ stat: 's' + i }));
    const { values } = buildUpsertChunk(rows, new Date());
    expect(values.length).toBe(1 + UPSERT_CHUNK * UPSERT_COLS);
    expect(values.length).toBeLessThan(65535);
  });

  it('carries nulls through rather than dropping the column', () => {
    const { values } = buildUpsertChunk(
      [uRow({ overOdds: null, underOdds: null, multiplier: null })],
      new Date(),
    );
    expect(values.slice(1)).toContain(null);
    expect(values).toHaveLength(1 + UPSERT_COLS);
  });
});

describe('dedupe guards the authoritative-prune threshold', () => {
  it('duplicate rungs must not inflate a thin board past AUTHORITATIVE_MIN_ROWS', () => {
    // A half-broken scraper returns a thin board. If the same few rungs repeat, the
    // RAW count can reach the threshold and flip staleRows() into the authoritative
    // path, which deletes every stored row the run failed to re-fetch. Deduping first
    // (as the ingest now does before pruning) keeps the honest distinct-row count.
    const distinct = 4;
    const thin: UpsertRow[] = [];
    for (let i = 0; i < AUTHORITATIVE_MIN_ROWS + 2; i++) {
      thin.push(uRow({ playerId: (i % distinct) + 1, stat: 'pts', line: 10.5 }));
    }
    expect(thin.length).toBeGreaterThanOrEqual(AUTHORITATIVE_MIN_ROWS);

    const deduped = dedupeUpsertRows(thin);
    expect(deduped).toHaveLength(distinct);
    expect(deduped.length).toBeLessThan(AUTHORITATIVE_MIN_ROWS);

    const asKeys = (rs: UpsertRow[]): RowKey[] =>
      rs.map((r) => ({ playerId: r.playerId, stat: r.stat, line: r.line, oddsType: r.oddsType }));
    // A stored row this run did NOT write, on a line it never touched.
    const stored = [{ id: 1, playerId: 99, stat: 'reb', line: 7.5, oddsType: 'standard' }];

    // Raw (inflated) count → authoritative path wipes the untouched row.
    expect(staleRows(stored, asKeys(thin))).toHaveLength(1);
    // Deduped count → thin-board path leaves it alone.
    expect(staleRows(stored, asKeys(deduped))).toHaveLength(0);
  });
});
