import { describe, it, expect } from 'vitest';
import { staleRows, normalizeClubName, AUTHORITATIVE_MIN_ROWS, type RowKey } from './providedSync';

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
