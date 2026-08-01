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
  it('keeps a median-only sport even when another sport IS book-carried', () => {
    // The bug this replaces: MLB carrying PrizePicks put the whole page in book
    // mode, so WNBA/MLS — which no book lists — were dropped from the home page
    // and then labelled "between slates / off-season" by the strip below, despite
    // having a slate and leans. HomeTopLeans now falls back per card.
    const out = selectHomeCards([
      ['mlb', withBook()],
      ['wnba', medianOnly()],
      ['mls', medianOnly()],
    ]);
    expect(names(out)).toEqual(['mlb', 'wnba', 'mls']);
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
    // Mirrors HomeTopLeans' per-card rule: book rows for the shown source, else
    // that sport's median leans.
    for (const [name, d] of out) {
      const shown = Object.values(d.boardsBySource).flat().length || d.medianLeans.length;
      expect(shown, `${name} renders rows`).toBeGreaterThan(0);
    }
    expect(names(out)).not.toContain('nhl');
  });
});
