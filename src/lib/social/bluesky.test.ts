import { describe, expect, it } from 'vitest';
import { buildLinkFacet } from './bluesky';

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
