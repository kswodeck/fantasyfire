import { describe, expect, it } from 'vitest';
import { buildLinkFacet, buildTagFacets } from './bluesky';

describe('buildLinkFacet', () => {
  it('computes UTF-8 byte offsets, not character offsets', () => {
    // "🔥 " is 1 emoji (4 UTF-8 bytes) + a space — byte offsets shift past the
    // character index, which is exactly the bug this guards against.
    const text = '🔥 Board: fantasyfire.app/nba/board today';
    const facet = buildLinkFacet(text, 'fantasyfire.app/nba/board', 'https://fantasyfire.app/nba/board');
    expect(facet).not.toBeNull();
    const enc = new TextEncoder();
    const bytes = enc.encode(text);
    const slice = bytes.slice(facet!.index.byteStart, facet!.index.byteEnd);
    expect(new TextDecoder().decode(slice)).toBe('fantasyfire.app/nba/board');
    expect(facet!.features[0].uri).toBe('https://fantasyfire.app/nba/board');
  });

  it('returns null when the display text is absent', () => {
    expect(buildLinkFacet('no link here', 'fantasyfire.app', 'https://fantasyfire.app')).toBeNull();
  });

  it('anchors ASCII-only text at the plain character offsets', () => {
    const facet = buildLinkFacet('go to example.com now', 'example.com', 'https://example.com');
    expect(facet!.index).toEqual({ byteStart: 6, byteEnd: 17 });
  });
});

describe('buildTagFacets', () => {
  /** Decode a facet's byte range back out of the text — proves the offsets land. */
  function sliceOf(text: string, f: { index: { byteStart: number; byteEnd: number } }): string {
    const bytes = new TextEncoder().encode(text);
    return new TextDecoder().decode(bytes.slice(f.index.byteStart, f.index.byteEnd));
  }

  it('tags every hashtag with correct UTF-8 offsets past emoji', () => {
    // The real caption shape: flame emoji (4 bytes each) before the trailing tags.
    const text = "Today's hottest NBA props 🔥\n• L. Dončić Over 32.5 PTS 🔥🔥\n#NBA #PrizePicks";
    const facets = buildTagFacets(text);
    expect(facets.map((f) => f.features[0].tag)).toEqual(['NBA', 'PrizePicks']);
    // Each range must decode back to the exact "#tag" substring.
    expect(sliceOf(text, facets[0])).toBe('#NBA');
    expect(sliceOf(text, facets[1])).toBe('#PrizePicks');
  });

  it('stores the tag without the leading # and keeps it clickable at line start', () => {
    const facets = buildTagFacets('#NBAProps leads the line');
    expect(facets).toHaveLength(1);
    expect(facets[0].features[0].tag).toBe('NBAProps');
    expect(facets[0].features[0].$type).toBe('app.bsky.richtext.facet#tag');
  });

  it('ignores a mid-word # (URL fragments, "C#") — a tag must start a word', () => {
    expect(buildTagFacets('see fantasyfire.app/nba#board for C#')).toHaveLength(0);
  });

  it('does not swallow trailing punctuation into the tag', () => {
    const facets = buildTagFacets('props #NBA, #MLB.');
    expect(facets.map((f) => f.features[0].tag)).toEqual(['NBA', 'MLB']);
  });

  it('caps at the 8 tags Bluesky will index', () => {
    const text = Array.from({ length: 12 }, (_, i) => `#tag${i}`).join(' ');
    expect(buildTagFacets(text)).toHaveLength(8);
  });

  it('returns nothing for a tagless post (Discord-style text)', () => {
    expect(buildTagFacets('Today\'s hottest NBA props 🔥\nFull board → fantasyfire.app')).toEqual([]);
  });
});
