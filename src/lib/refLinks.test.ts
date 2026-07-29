import { describe, it, expect, afterEach } from 'vitest';
import { refLinkFor, refLinkRel, isSponsoredLink, hasAnyRefLink } from './providedSources';

const ENV = 'NEXT_PUBLIC_REF_LINKS';
function setLinks(value: string | undefined) {
  if (value === undefined) delete process.env[ENV];
  else process.env[ENV] = value;
}
afterEach(() => setLinks(undefined));

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
