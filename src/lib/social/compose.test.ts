import { describe, expect, it } from 'vitest';
import type { DailyLean } from '@/lib/server/social';
import {
  BANNED_TOKENS,
  assertDescriptive,
  composeContentPack,
  composeDailyPost,
  trackedBoardUrl,
} from './compose';

const SITE_URL = 'https://fantasyfire.app';

function lean(overrides: Partial<DailyLean> = {}): DailyLean {
  return {
    slug: 'luka-doncic',
    firstName: 'Luka',
    lastName: 'Dončić',
    teamAbbreviation: 'DAL',
    statShort: 'PTS',
    line: 32.5,
    side: 'over',
    tier: 'Strong lean',
    ...overrides,
  };
}

const THREE_LEANS: DailyLean[] = [
  lean(),
  lean({ slug: 'jalen-brunson', firstName: 'Jalen', lastName: 'Brunson', statShort: 'AST', line: 6.5, side: 'under', tier: 'Lean' }),
  lean({ slug: 'nikola-jokic', firstName: 'Nikola', lastName: 'Jokić', statShort: 'REB', line: 12.5 }),
];

describe('composeDailyPost', () => {
  it('includes the leans, tier labels, tracked URL, and responsible-gaming line', () => {
    const c = composeDailyPost({
      sport: 'nba',
      sportName: 'NBA',
      leans: THREE_LEANS,
      siteUrl: SITE_URL,
      channel: 'bluesky',
    });
    expect(c.text).toContain('L. Dončić Over 32.5 PTS');
    expect(c.text).toContain('J. Brunson Under 6.5 AST');
    expect(c.text).toContain('Strong lean');
    expect(c.text).toContain('1-800-GAMBLER');
    expect(c.text).toContain(c.linkDisplay);
    expect(c.boardUrl).toBe(
      'https://fantasyfire.app/nba/board?utm_source=bluesky&utm_medium=social&utm_campaign=daily-leans',
    );
    expect(c.imageAlt).toContain('not betting advice');
  });

  it('never emits banned predictive/tout tokens', () => {
    for (const channel of ['bluesky', 'discord', 'telegram', 'x'] as const) {
      const c = composeDailyPost({
        sport: 'nba',
        sportName: 'NBA',
        leans: THREE_LEANS,
        siteUrl: SITE_URL,
        channel,
      });
      for (const token of BANNED_TOKENS) {
        expect(c.text.toLowerCase()).not.toContain(token);
        expect(c.imageAlt.toLowerCase()).not.toContain(token);
      }
    }
  });

  it('fits the Bluesky budget by dropping trailing leans, never the RG line', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      lean({ slug: `p${i}`, lastName: `Verylonglastname${i}` }),
    );
    const c = composeDailyPost({
      sport: 'nba',
      sportName: 'NBA',
      leans: many,
      siteUrl: SITE_URL,
      channel: 'bluesky',
      maxChars: 290,
    });
    expect([...c.text].length).toBeLessThanOrEqual(290);
    expect(c.text).toContain('1-800-GAMBLER');
    expect(c.text).toContain(c.linkDisplay);
  });

  it('throws on an empty lean list', () => {
    expect(() =>
      composeDailyPost({ sport: 'nba', sportName: 'NBA', leans: [], siteUrl: SITE_URL, channel: 'bluesky' }),
    ).toThrow();
  });
});

describe('composeContentPack', () => {
  it('produces per-sport blocks with community + social snippets and the embed', () => {
    const pack = composeContentPack({
      entries: [
        { sport: 'nba', sportName: 'NBA', leans: THREE_LEANS },
        { sport: 'mlb', sportName: 'MLB', leans: [] },
      ],
      siteUrl: SITE_URL,
      dateIso: '2026-07-12',
    });
    expect(pack).toContain('content pack — 2026-07-12');
    expect(pack).toContain('__NBA__');
    expect(pack).not.toContain('__MLB__'); // empty sports are skipped
    expect(pack).toContain('utm_source=community');
    expect(pack).toContain('/embed/nba/luka-doncic');
    for (const token of BANNED_TOKENS) {
      expect(pack.toLowerCase()).not.toContain(token);
    }
  });
});

describe('assertDescriptive', () => {
  it('rejects tout-speak', () => {
    expect(() => assertDescriptive('This is a guaranteed winner')).toThrow(/banned token/);
    expect(() => assertDescriptive('over 32.5 in 8 of his last 10')).not.toThrow();
  });
});

describe('trackedBoardUrl', () => {
  it('tags the channel as utm_source', () => {
    expect(trackedBoardUrl(SITE_URL, 'mlb', 'telegram')).toContain('utm_source=telegram');
  });
});
