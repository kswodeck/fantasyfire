import { describe, it, expect } from 'vitest';
import { bookAvailability } from './bookAvailability';

describe('bookAvailability — fails open', () => {
  // The single most important property here: nothing about a geo lookup may cause
  // the page to quietly lose a working link. Every "we don't know" path shows it.
  it('is unknown with no geo at all', () => {
    for (const r of [null, undefined, '']) {
      expect(bookAvailability('prizepicks', { country: 'US', region: r })).toBe(
        'unknown',
      );
      expect(bookAvailability('prizepicks', { country: r, region: 'MI' })).toBe(
        'unknown',
      );
    }
  });

  it('is unknown outside the US, even for a well-formed code', () => {
    // "ON" (Ontario) and "CA" (a Canadian province code) are both valid two-letter
    // codes that must never be read against the US state table.
    expect(bookAvailability('prizepicks', { country: 'CA', region: 'ON' })).toBe(
      'unknown',
    );
    expect(bookAvailability('prizepicks', { country: 'GB', region: 'ENG' })).toBe(
      'unknown',
    );
  });

  it('is unknown for a malformed US subdivision', () => {
    for (const r of ['12', 'california', 'M']) {
      expect(bookAvailability('prizepicks', { country: 'US', region: r }), r).toBe(
        'unknown',
      );
    }
  });

  it('is unknown for a book with no verified table', () => {
    // underdog/sleeper/pick6 are deliberately unlisted until confirmed — they must
    // keep their links rather than be suppressed on a guess.
    for (const id of ['underdog', 'sleeper', 'pick6', 'nosuchbook']) {
      expect(bookAvailability(id, { country: 'US', region: 'CA' }), id).toBe('unknown');
    }
  });
});

describe('bookAvailability — PrizePicks state table', () => {
  it('suppresses where the pick’em product is not offered', () => {
    for (const state of ['CT', 'MI', 'NJ', 'OH', 'PA', 'WA', 'NV', 'ID']) {
      expect(
        bookAvailability('prizepicks', { country: 'US', region: state }),
        state,
      ).toBe('unavailable');
    }
  });

  it('suppresses the two states that allow the app but not this market', () => {
    // AZ: no pick'em contests. MO: no over/under player props — i.e. exactly the
    // market every line on this site describes.
    expect(bookAvailability('prizepicks', { country: 'US', region: 'AZ' })).toBe(
      'unavailable',
    );
    expect(bookAvailability('prizepicks', { country: 'US', region: 'MO' })).toBe(
      'unavailable',
    );
  });

  it('allows the link in states where the product runs', () => {
    for (const state of ['CA', 'TX', 'GA', 'IL', 'NY', 'CO', 'NC']) {
      expect(
        bookAvailability('prizepicks', { country: 'US', region: state }),
        state,
      ).toBe('ok');
    }
  });

  it('is case- and whitespace-insensitive', () => {
    expect(bookAvailability('prizepicks', { country: 'us', region: 'mi' })).toBe(
      'unavailable',
    );
    expect(bookAvailability('prizepicks', { country: 'US', region: ' MI ' })).toBe(
      'unavailable',
    );
    expect(bookAvailability('prizepicks', { country: 'us', region: 'ca' })).toBe('ok');
  });
});
