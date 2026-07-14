import { describe, expect, it } from 'vitest';
import type { DailyLean } from '@/lib/server/social';
import {
  BANNED_TOKENS,
  assertDescriptive,
  composeContentPack,
  composeDailyDigest,
  composeDailyPoll,
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
  it('includes the leans, flame tiers, and tracked URL — and no RG boilerplate', () => {
    const c = composeDailyPost({
      sport: 'nba',
      sportName: 'NBA',
      leans: THREE_LEANS,
      siteUrl: SITE_URL,
      channel: 'bluesky',
    });
    expect(c.text).toContain('hottest NBA props');
    expect(c.text).toContain('L. Dončić Over 32.5 PTS 🔥🔥'); // over + Strong lean = Blazing
    expect(c.text).toContain('J. Brunson Under 6.5 AST ❄️'); // under + Lean = Cold (cool side)
    expect(c.text).not.toContain('1-800-GAMBLER'); // RG disclosure lives on the site/bios, not posts
    expect(c.text).toContain(c.linkDisplay);
    expect(c.boardUrl).toBe(
      'https://fantasyfire.app/nba/board?utm_source=bluesky&utm_medium=social&utm_campaign=daily-leans',
    );
    expect(c.imageAlt).toContain('not betting advice');
  });

  it('never emits banned predictive/tout tokens', () => {
    for (const channel of ['bluesky', 'discord', 'telegram', 'instagram', 'threads', 'x'] as const) {
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

  it('fits the Bluesky budget by dropping trailing leans, never the footer', () => {
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
    expect(c.text).toContain(c.linkDisplay);
  });

  it('attributes the line source in the footer', () => {
    const withBook = composeDailyPost({
      sport: 'nba',
      sportName: 'NBA',
      leans: THREE_LEANS.map((l) => ({ ...l, linesSource: 'prizepicks' })),
      siteUrl: SITE_URL,
      channel: 'bluesky',
    });
    expect(withBook.text).toContain('board · PrizePicks lines');

    const computed = composeDailyPost({
      sport: 'nba',
      sportName: 'NBA',
      leans: THREE_LEANS,
      siteUrl: SITE_URL,
      channel: 'bluesky',
    });
    expect(computed.text).toContain('board · FantasyFire lines');
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

describe('composeDailyDigest', () => {
  const ENTRIES = [
    { sport: 'nba', sportName: 'NBA', leans: THREE_LEANS },
    { sport: 'mlb', sportName: 'MLB', leans: [lean({ slug: 'aaron-judge', firstName: 'Aaron', lastName: 'Judge', statShort: 'HR', line: 0.5 })] },
    { sport: 'wnba', sportName: 'WNBA', leans: [] },
  ];

  it('lists one top lean per sport with leans and links the all-sports board', () => {
    const c = composeDailyDigest({ entries: ENTRIES, siteUrl: SITE_URL, channel: 'discord' });
    expect(c.text).toContain('2 leagues');
    expect(c.text).toContain('NBA: L. Dončić Over 32.5 PTS');
    expect(c.text).toContain('MLB: A. Judge Over 0.5 HR');
    expect(c.text).not.toContain('WNBA'); // no leans → dropped
    expect(c.text).not.toContain('1-800-GAMBLER');
    expect(c.boardUrl).toContain('/board?utm_source=discord');
    for (const token of BANNED_TOKENS) expect(c.text.toLowerCase()).not.toContain(token);
  });

  it('fits the channel budget but never drops below two sports', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      sport: `s${i}`,
      sportName: `LEAGUE${i}`,
      leans: [lean({ slug: `p${i}`, lastName: `Verylonglastname${i}` })],
    }));
    const c = composeDailyDigest({ entries: many, siteUrl: SITE_URL, channel: 'bluesky', maxChars: 290 });
    expect([...c.text].length).toBeLessThanOrEqual(290);
    expect(c.text).toContain('LEAGUE0');
    expect(c.text).toContain('LEAGUE1');
  });

  it('throws with fewer than two sports with leans', () => {
    expect(() =>
      composeDailyDigest({
        entries: [{ sport: 'nba', sportName: 'NBA', leans: THREE_LEANS }],
        siteUrl: SITE_URL,
        channel: 'discord',
      }),
    ).toThrow();
  });
});

describe('composeDailyPoll', () => {
  it('builds one option per sport, capped at 55 chars, framed as a question', () => {
    const poll = composeDailyPoll([
      { sport: 'nba', sportName: 'NBA', leans: THREE_LEANS },
      { sport: 'mlb', sportName: 'MLB', leans: [lean({ firstName: 'Aaron', lastName: 'Judge', statShort: 'HR', line: 0.5 })] },
    ]);
    expect(poll).not.toBeNull();
    expect(poll!.options).toHaveLength(2);
    expect(poll!.options[0]).toBe('NBA · L. Dončić Over 32.5 PTS');
    for (const o of poll!.options) expect(o.length).toBeLessThanOrEqual(55);
    expect(poll!.question).toContain('?');
    for (const token of BANNED_TOKENS) {
      expect(poll!.question.toLowerCase()).not.toContain(token);
    }
  });

  it('returns null when fewer than two sports have leans', () => {
    expect(composeDailyPoll([{ sport: 'nba', sportName: 'NBA', leans: THREE_LEANS }])).toBeNull();
    expect(composeDailyPoll([])).toBeNull();
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
