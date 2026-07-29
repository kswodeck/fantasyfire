import { describe, it, expect } from 'vitest';
import { selectHomeCards, type HomeSportData } from './homeCards';
import type { BoardRow } from './types';

const row = () => ({}) as BoardRow;

/** A sport carried by a book. */
const withBook = (source = 'prizepicks'): HomeSportData => ({
  boardsBySource: { [source]: [row()] },
  medianLeans: [],
});
/** A sport no book carries — only our median line (MLS in the reported bug). */
const medianOnly = (): HomeSportData => ({ boardsBySource: {}, medianLeans: [row()] });
/** A sport with a slate but nothing worth teasing. */
const empty = (): HomeSportData => ({ boardsBySource: {}, medianLeans: [] });

const names = (out: readonly (readonly [string, HomeSportData])[]) => out.map(([n]) => n);

describe('selectHomeCards', () => {
  it('drops a median-only sport once ANY book is live (the MLS empty-card bug)', () => {
    // MLB/WNBA carry PrizePicks rows, so HomeTopLeans puts every card in book
    // mode — MLS has no book rows and would render "No PrizePicks lines…".
    const out = selectHomeCards([
      ['mlb', withBook()],
      ['wnba', withBook()],
      ['mls', medianOnly()],
    ]);
    expect(names(out)).toEqual(['mlb', 'wnba']);
  });

  it('keeps median-only sports when NO book is live anywhere', () => {
    // Nothing forces book mode, so the median leans are what actually render.
    const out = selectHomeCards([
      ['mls', medianOnly()],
      ['nhl', medianOnly()],
    ]);
    expect(names(out)).toEqual(['mls', 'nhl']);
  });

  it('always drops a sport with nothing to show', () => {
    expect(names(selectHomeCards([['mlb', withBook()], ['mls', empty()]]))).toEqual(['mlb']);
    expect(names(selectHomeCards([['mls', empty()]]))).toEqual([]);
  });

  it('keeps a sport carried by a DIFFERENT book than the others', () => {
    // Underdog-only sport still has rows to show; which book the reader has
    // selected is a client concern (an honest empty state), not a reason to hide.
    const out = selectHomeCards([
      ['mlb', withBook('prizepicks')],
      ['mls', withBook('underdog')],
    ]);
    expect(names(out)).toEqual(['mlb', 'mls']);
  });

  it('returns nothing for an empty slate day', () => {
    expect(selectHomeCards([])).toEqual([]);
  });

  it('never returns a card that would render empty (the invariant)', () => {
    const entries = [
      ['mlb', withBook()],
      ['mls', medianOnly()],
      ['nhl', empty()],
      ['cbb', withBook('underdog')],
    ] as const;
    const out = selectHomeCards(entries);
    const anyBookLive = out.some(([, d]) =>
      Object.values(d.boardsBySource).some((r) => r.length > 0),
    );
    for (const [name, d] of out) {
      const shown = anyBookLive
        ? Object.values(d.boardsBySource).flat().length
        : d.medianLeans.length;
      expect(shown, `${name} renders rows`).toBeGreaterThan(0);
    }
  });
});
