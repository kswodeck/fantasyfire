import { describe, it, expect, afterEach } from 'vitest';
import { refLinkFor, refLinkRel, isSponsoredLink, hasAnyRefLink } from './providedSources';

const ENV = 'NEXT_PUBLIC_REF_LINKS';
function setLinks(value: string | undefined) {
  if (value === undefined) delete process.env[ENV];
  else process.env[ENV] = value;
}
afterEach(() => setLinks(undefined));

describe('refLinkFor', () => {
  it('prefers a configured referral link over the plain homepage', () => {
    setLinks(JSON.stringify({ prizepicks: 'https://prizepicks.com/?ref=fantasyfire' }));
    expect(refLinkFor('prizepicks')).toBe('https://prizepicks.com/?ref=fantasyfire');
  });

  it('is null with no deal — the name stays PLAIN TEXT rather than linking out', () => {
    expect(refLinkFor('underdog')).toBeNull();
  });

  it('is null for an unknown book', () => {
    expect(refLinkFor('nosuchbook')).toBeNull();
  });

  it('switches on PER BOOK — one deal does not start linking the others', () => {
    setLinks(JSON.stringify({ prizepicks: 'https://prizepicks.com/?ref=x' }));
    expect(refLinkFor('prizepicks')).toBe('https://prizepicks.com/?ref=x');
    expect(refLinkFor('underdog')).toBeNull();
    expect(refLinkFor('sleeper')).toBeNull();
  });
});

describe('rel — the compliance-critical bit', () => {
  it('marks a PAID link as sponsored', () => {
    setLinks(JSON.stringify({ prizepicks: 'https://prizepicks.com/?ref=x' }));
    expect(refLinkRel('prizepicks')).toBe('sponsored nofollow noopener noreferrer');
  });

  it('does NOT claim sponsorship on a link that earns nothing', () => {
    // Misapplying rel="sponsored" is its own problem — only real deals get it.
    expect(refLinkRel('underdog')).toBe('nofollow noopener noreferrer');
    expect(isSponsoredLink('underdog')).toBe(false);
  });

  it('always carries nofollow + noopener + noreferrer', () => {
    for (const id of ['prizepicks', 'underdog', 'fanduel']) {
      const rel = refLinkRel(id);
      expect(rel).toContain('nofollow');
      expect(rel).toContain('noopener');
      expect(rel).toContain('noreferrer');
    }
  });
});

describe('hasAnyRefLink (gates the FTC disclosure)', () => {
  it('is false with no deals — we never claim a paid relationship we lack', () => {
    expect(hasAnyRefLink()).toBe(false);
  });

  it('is true as soon as one real deal is configured', () => {
    setLinks(JSON.stringify({ sleeper: 'https://sleeper.com/?ref=x' }));
    expect(hasAnyRefLink()).toBe(true);
  });
});

describe('malformed config degrades safely', () => {
  it('ignores non-https and relative URLs rather than rendering a broken link', () => {
    setLinks(
      JSON.stringify({
        prizepicks: 'http://insecure.example',
        underdog: '//protocol-relative.example',
        sleeper: '/relative',
      }),
    );
    expect(isSponsoredLink('prizepicks')).toBe(false);
    expect(refLinkFor('prizepicks')).toBeNull(); // stays plain text
    expect(hasAnyRefLink()).toBe(false);
  });

  it('survives invalid JSON / wrong shapes without throwing', () => {
    for (const bad of ['not json', '[]', 'null', '{"a":1}']) {
      setLinks(bad);
      expect(() => hasAnyRefLink()).not.toThrow();
      expect(hasAnyRefLink()).toBe(false);
      expect(refLinkFor('prizepicks')).toBeNull();
    }
  });
});
