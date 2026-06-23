// src/ingest/nba/client.test.ts
//
// Pure unit tests — no network. Run with: pnpm vitest run src/ingest/nba
import { describe, it, expect } from 'vitest';
import {
  rowsFromResultSet,
  selectResultSet,
  parseMinutes,
  toNum,
  toNumOrNull,
  toStrOrNull,
} from './columnar';
import { parseMatchup } from './matchup';
import { toPosBucket, slugify } from './client';
import type { NbaResultSet } from './types';

describe('rowsFromResultSet', () => {
  it('maps headers to values by name', () => {
    const rs: NbaResultSet = {
      name: 'X',
      headers: ['A', 'B', 'C'],
      rowSet: [
        [1, 'x', null],
        [2, 'y', 3],
      ],
    };
    expect(rowsFromResultSet(rs)).toEqual([
      { A: 1, B: 'x', C: null },
      { A: 2, B: 'y', C: 3 },
    ]);
  });

  it('pads short rows with null', () => {
    const rs: NbaResultSet = { name: 'X', headers: ['A', 'B', 'C'], rowSet: [[1]] };
    expect(rowsFromResultSet(rs)[0]).toEqual({ A: 1, B: null, C: null });
  });

  it('is robust to column reordering (name-based)', () => {
    const rs: NbaResultSet = {
      name: 'X',
      headers: ['PTS', 'PLAYER_ID'],
      rowSet: [[30, 2544]],
    };
    const [row] = rowsFromResultSet(rs);
    expect(row['PLAYER_ID']).toBe(2544);
    expect(row['PTS']).toBe(30);
  });
});

describe('selectResultSet', () => {
  it('selects by name when present', () => {
    const resp = {
      resultSets: [
        { name: 'A', headers: [], rowSet: [] },
        { name: 'B', headers: ['x'], rowSet: [[1]] },
      ],
    };
    expect(selectResultSet(resp, 'B').headers).toEqual(['x']);
  });

  it('falls back to the first set', () => {
    const resp = { resultSets: [{ name: 'A', headers: ['y'], rowSet: [] }] };
    expect(selectResultSet(resp, 'missing').name).toBe('A');
  });

  it('handles the singular resultSet shape', () => {
    const resp = { resultSet: { name: 'Solo', headers: ['z'], rowSet: [] } };
    expect(selectResultSet(resp).name).toBe('Solo');
  });

  it('throws when there are no result sets', () => {
    expect(() => selectResultSet({})).toThrow();
  });
});

describe('parseMatchup', () => {
  it('parses home games (vs.)', () => {
    expect(parseMatchup('BOS vs. LAL')).toEqual({
      teamAbbreviation: 'BOS',
      opponentAbbreviation: 'LAL',
      isHome: true,
    });
  });

  it('parses away games (@)', () => {
    expect(parseMatchup('BOS @ LAL')).toEqual({
      teamAbbreviation: 'BOS',
      opponentAbbreviation: 'LAL',
      isHome: false,
    });
  });

  it('throws on garbage', () => {
    expect(() => parseMatchup('???')).toThrow();
  });
});

describe('toPosBucket', () => {
  it('buckets by primary position', () => {
    expect(toPosBucket('G')).toBe('G');
    expect(toPosBucket('F')).toBe('F');
    expect(toPosBucket('C')).toBe('C');
    expect(toPosBucket('F-C')).toBe('F'); // forward-center -> F
    expect(toPosBucket('C-F')).toBe('C'); // center-forward -> C
    expect(toPosBucket('G-F')).toBe('G');
    expect(toPosBucket(null)).toBeNull();
    expect(toPosBucket('')).toBeNull();
  });
});

describe('parseMinutes', () => {
  it('handles numbers, MM:SS, and empties', () => {
    expect(parseMinutes(35)).toBe(35);
    expect(parseMinutes('35:30')).toBeCloseTo(35.5);
    expect(parseMinutes('')).toBeNull();
    expect(parseMinutes(null)).toBeNull();
  });
});

describe('coercion', () => {
  it('toNum defaults to 0 for null/empty', () => {
    expect(toNum('12')).toBe(12);
    expect(toNum(12)).toBe(12);
    expect(toNum(null)).toBe(0);
    expect(toNum('')).toBe(0);
    expect(toNum('not-a-number')).toBe(0);
  });

  it('toNumOrNull preserves null', () => {
    expect(toNumOrNull(null)).toBeNull();
    expect(toNumOrNull('-7')).toBe(-7);
  });

  it('toStrOrNull preserves null', () => {
    expect(toStrOrNull(null)).toBeNull();
    expect(toStrOrNull('W')).toBe('W');
  });
});

describe('slugify', () => {
  it('slugifies names and strips accents', () => {
    expect(slugify('LeBron James')).toBe('lebron-james');
    expect(slugify('Luka Dončić')).toBe('luka-doncic');
    expect(slugify('  Extra   Spaces  ')).toBe('extra-spaces');
  });
});
