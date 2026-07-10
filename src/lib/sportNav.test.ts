import { describe, it, expect } from 'vitest';
import { NAV_SPORT_ORDER, sportSections, sectionHref } from './sportNav';
import { SPORT_LIST } from './sports';

describe('NAV_SPORT_ORDER', () => {
  it('contains every registered sport exactly once (a new sport must be placed)', () => {
    expect([...NAV_SPORT_ORDER].sort()).toEqual([...SPORT_LIST].sort());
    expect(new Set(NAV_SPORT_ORDER).size).toBe(NAV_SPORT_ORDER.length);
  });
});

describe('sportSections / sectionHref', () => {
  it('every section resolves to a real per-sport href', () => {
    for (const sport of SPORT_LIST) {
      for (const s of sportSections(sport)) {
        const href = sectionHref(sport, s.seg);
        expect(href.startsWith(`/${sport}`)).toBe(true);
      }
    }
  });
});
