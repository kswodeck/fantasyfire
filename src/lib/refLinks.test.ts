import { describe, it, expect, afterEach } from 'vitest';
import { refLinkFor, refLinkRel, isSponsoredLink, hasAnyRefLink } from './providedSources';

const ENV = 'NEXT_PUBLIC_REF_LINKS';
const SUBID_ENV = 'NEXT_PUBLIC_REF_SUBID_PARAMS';
function setLinks(value: string | undefined) {
  if (value === undefined) delete process.env[ENV];
  else process.env[ENV] = value;
}
function setSubIdParams(value: string | undefined) {
  if (value === undefined) delete process.env[SUBID_ENV];
  else process.env[SUBID_ENV] = value;
}
afterEach(() => {
  setLinks(undefined);
  setSubIdParams(undefined);
});

/** Books with a live deal baked into DEFAULT_REF_LINKS. */
const WITH_DEAL = ['prizepicks', 'pick6', 'underdog', 'sleeper'];
/** Books we track but have no deal with — these must stay plain text. */
const NO_DEAL = ['fanduel', 'betmgm', 'draftkings', 'caesars'];

describe('live referral deals', () => {
  it('links every book we have a deal with', () => {
    for (const id of WITH_DEAL) {
      expect(refLinkFor(id), id).toMatch(/^https:\/\//);
      expect(isSponsoredLink(id), id).toBe(true);
    }
  });

  it('leaves books without a deal as plain text', () => {
    for (const id of NO_DEAL) {
      expect(refLinkFor(id), id).toBeNull();
      expect(isSponsoredLink(id), id).toBe(false);
    }
  });

  it('is null for an unknown book', () => {
    expect(refLinkFor('nosuchbook')).toBeNull();
  });

  it('points each book at its own destination (no copy-paste mixups)', () => {
    expect(refLinkFor('prizepicks')).toContain('prizepicks');
    expect(refLinkFor('pick6')).toContain('pick6.draftkings.com');
    expect(refLinkFor('underdog')).toContain('underdog');
    expect(refLinkFor('sleeper')).toContain('sleeper');
    // Every destination is distinct — a duplicated URL would silently send one
    // book's traffic to another's affiliate account.
    const urls = WITH_DEAL.map((id) => refLinkFor(id));
    expect(new Set(urls).size).toBe(WITH_DEAL.length);
  });
});

describe('rel — the compliance-critical bit', () => {
  it('marks a PAID link as sponsored', () => {
    expect(refLinkRel('prizepicks')).toBe('sponsored nofollow noopener noreferrer');
  });

  it('does NOT claim sponsorship on a book we earn nothing from', () => {
    expect(refLinkRel('fanduel')).toBe('nofollow noopener noreferrer');
  });

  it('always carries nofollow + noopener + noreferrer', () => {
    for (const id of [...WITH_DEAL, ...NO_DEAL]) {
      const rel = refLinkRel(id);
      expect(rel, id).toContain('nofollow');
      expect(rel, id).toContain('noopener');
      expect(rel, id).toContain('noreferrer');
    }
  });
});

describe('hasAnyRefLink (gates the FTC disclosure)', () => {
  it('is true now that real deals are live', () => {
    expect(hasAnyRefLink()).toBe(true);
  });
});

describe('env override', () => {
  it('replaces a single book’s link without dropping the others', () => {
    setLinks(JSON.stringify({ prizepicks: 'https://prizepicks.example/new' }));
    expect(refLinkFor('prizepicks')).toBe('https://prizepicks.example/new');
    // The other live deals survive a one-book override.
    expect(refLinkFor('underdog')).toContain('underdog');
    expect(refLinkFor('sleeper')).toContain('sleeper');
  });

  it('can add a book that has no baked-in deal', () => {
    setLinks(JSON.stringify({ fanduel: 'https://fanduel.example/ref' }));
    expect(refLinkFor('fanduel')).toBe('https://fanduel.example/ref');
    expect(isSponsoredLink('fanduel')).toBe(true);
  });
});

describe('malformed config degrades safely', () => {
  it('ignores non-https entries and keeps the baked-in link', () => {
    setLinks(JSON.stringify({ prizepicks: 'http://insecure.example' }));
    expect(refLinkFor('prizepicks')).toContain('https://');
    expect(refLinkFor('prizepicks')).not.toContain('insecure');
  });

  it('survives invalid JSON / wrong shapes without throwing', () => {
    for (const bad of ['not json', '[]', 'null']) {
      setLinks(bad);
      expect(() => hasAnyRefLink()).not.toThrow();
      // Falls back to the baked-in deals rather than breaking every book mention.
      expect(refLinkFor('prizepicks')).toMatch(/^https:\/\//);
      expect(refLinkFor('fanduel')).toBeNull();
    }
  });
});

describe('per-placement sub-ids (attribution)', () => {
  it('changes nothing until a sub-id param is configured', () => {
    // The whole point: an unconfigured book's link is byte-identical with or
    // without a placement, so shipping this can never alter a live deal.
    for (const id of WITH_DEAL) {
      expect(refLinkFor(id, 'player-cta'), id).toBe(refLinkFor(id));
    }
  });

  it('tags the link once the program’s param is known', () => {
    setSubIdParams(JSON.stringify({ prizepicks: 'af_sub1' }));
    const url = new URL(refLinkFor('prizepicks', 'player-cta') as string);
    expect(url.searchParams.get('af_sub1')).toBe('player-cta');
  });

  it('only tags the books it is configured for', () => {
    setSubIdParams(JSON.stringify({ prizepicks: 'af_sub1' }));
    expect(refLinkFor('underdog', 'player-cta')).toBe(refLinkFor('underdog'));
  });

  it('preserves a query string the deal already carries', () => {
    // Sleeper's live link ships ?promo=… — appending must not clobber it.
    setLinks(JSON.stringify({ sleeper: 'https://sleeper.example/r?promo=ABC' }));
    setSubIdParams(JSON.stringify({ sleeper: 'sub_id' }));
    const url = new URL(refLinkFor('sleeper', 'books-page') as string);
    expect(url.searchParams.get('promo')).toBe('ABC');
    expect(url.searchParams.get('sub_id')).toBe('books-page');
  });

  it('never emits an untagged duplicate param', () => {
    setLinks(JSON.stringify({ prizepicks: 'https://pp.example/r?af_sub1=old' }));
    setSubIdParams(JSON.stringify({ prizepicks: 'af_sub1' }));
    const url = new URL(refLinkFor('prizepicks', 'player-line') as string);
    expect(url.searchParams.getAll('af_sub1')).toEqual(['player-line']);
  });

  it('sanitises a placement rather than splicing junk into a URL', () => {
    setSubIdParams(JSON.stringify({ prizepicks: 'af_sub1' }));
    const url = new URL(refLinkFor('prizepicks', 'a b&c=d#e') as string);
    expect(url.searchParams.get('af_sub1')).toBe('abcde');
  });

  it('ignores a malformed param name instead of breaking the link', () => {
    setSubIdParams(JSON.stringify({ prizepicks: 'not a valid param!' }));
    expect(refLinkFor('prizepicks', 'player-cta')).toBe(refLinkFor('prizepicks'));
  });

  it('survives invalid JSON without throwing or dropping the link', () => {
    for (const bad of ['not json', '[]', 'null']) {
      setSubIdParams(bad);
      expect(() => refLinkFor('prizepicks', 'player-cta')).not.toThrow();
      expect(refLinkFor('prizepicks', 'player-cta')).toMatch(/^https:\/\//);
    }
  });

  it('still returns null for a book with no deal', () => {
    setSubIdParams(JSON.stringify({ fanduel: 'sub_id' }));
    expect(refLinkFor('fanduel', 'player-cta')).toBeNull();
  });
});
