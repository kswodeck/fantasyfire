import { describe, expect, it } from 'vitest';
import type { DailyLean } from '@/lib/server/social';
import {
  BANNED_TOKENS,
  assertDescriptive,
  composeContentPack,
  composeDailyDigest,
  composeDailyPoll,
  composeDailyPost,
  composeMultiSourcePost,
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

  it('carries the payout multiplier when the book posts a meaningful one', () => {
    const c = composeDailyPost({
      sport: 'wnba',
      sportName: 'WNBA',
      leans: [
        lean({ multiplier: 1.82, linesSource: 'sleeper' }), // Sleeper standard rung
        lean({ slug: 'b', lastName: 'Balanced', multiplier: 1, linesSource: 'underdog' }), // plain 1× stays silent
      ],
      siteUrl: SITE_URL,
      channel: 'bluesky',
    });
    expect(c.text).toContain('Over 32.5 PTS (1.82×)');
    expect(c.text).not.toContain('(1×)');
  });

  it('multi-source: one labeled block per book, blank lines between, fits maxChars', () => {
    const blocks = [
      { source: 'prizepicks', leans: [lean({ oddsType: 'demon', linesSource: 'prizepicks' })] },
      { source: 'underdog', leans: [lean({ multiplier: 1.31, linesSource: 'underdog' })] },
      { source: 'sleeper', leans: [lean({ multiplier: 1.82, linesSource: 'sleeper' })] },
      { source: 'pick6', leans: [lean({ linesSource: 'pick6' })] },
    ];
    const c = composeMultiSourcePost({
      sport: 'wnba',
      sportName: 'WNBA',
      blocks,
      siteUrl: SITE_URL,
      channel: 'discord',
      maxChars: 1800,
    });
    expect(c.text).toContain('PrizePicks:');
    expect(c.text).toContain('Underdog:');
    expect(c.text).toContain('Sleeper:');
    expect(c.text).toContain('DK Pick6:');
    expect(c.text).toContain('(1.82×)');
    expect(c.text.split('\n\n').length).toBeGreaterThanOrEqual(5); // header + 4 blocks + footer

    const tight = composeMultiSourcePost({
      sport: 'wnba',
      sportName: 'WNBA',
      blocks: blocks.map((b) => ({ ...b, leans: [b.leans[0], lean({ slug: 'x2' }), lean({ slug: 'x3' })] })),
      siteUrl: SITE_URL,
      channel: 'bluesky',
      maxChars: 290,
    });
    expect([...tight.text].length).toBeLessThanOrEqual(290);
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

describe('discovery tags in composed posts', () => {
  const withSource = (s: string) => THREE_LEANS.map((l) => ({ ...l, linesSource: s }));

  it('puts the tag line LAST — after the board link', () => {
    const c = composeDailyPost({
      sport: 'nba',
      sportName: 'NBA',
      leans: withSource('prizepicks'),
      siteUrl: SITE_URL,
      channel: 'bluesky',
    });
    const lines = c.text.split('\n');
    expect(lines[lines.length - 1]).toBe('#NBA #PrizePicks #NBAProps');
    // The link is above the tags, never after them.
    expect(c.text.indexOf(c.linkDisplay)).toBeLessThan(c.text.lastIndexOf('#NBA'));
  });

  it('tags the post’s own league and book', () => {
    const c = composeDailyPost({
      sport: 'mlb',
      sportName: 'MLB',
      leans: withSource('underdog'),
      siteUrl: SITE_URL,
      channel: 'telegram',
    });
    expect(c.text).toContain('#MLB');
    expect(c.text).toContain('#UnderdogFantasy');
    expect(c.text).not.toContain('#NBA');
  });

  it('adds no tags on Discord (no hashtag discovery there)', () => {
    const c = composeDailyPost({
      sport: 'nba',
      sportName: 'NBA',
      leans: withSource('prizepicks'),
      siteUrl: SITE_URL,
      channel: 'discord',
    });
    expect(c.text).not.toContain('#');
  });

  it('counts tags INSIDE the budget — a Bluesky post still fits 300', () => {
    const c = composeDailyPost({
      sport: 'nba',
      sportName: 'NBA',
      leans: withSource('prizepicks'),
      siteUrl: SITE_URL,
      channel: 'bluesky',
      maxChars: 290,
    });
    expect([...c.text].length).toBeLessThanOrEqual(290);
    expect(c.text).toContain('#NBA'); // tags survived the fit, a lean was dropped instead
  });

  it('keeps the tag line last on the multi-source post too', () => {
    const c = composeMultiSourcePost({
      sport: 'nba',
      sportName: 'NBA',
      blocks: [
        { source: 'prizepicks', leans: THREE_LEANS.slice(0, 1) },
        { source: 'underdog', leans: THREE_LEANS.slice(1, 2) },
      ],
      siteUrl: SITE_URL,
      channel: 'instagram',
    });
    expect(c.text.trimEnd().endsWith('#PropBets')).toBe(true);
    expect(c.text).toContain('#PrizePicks');
    expect(c.text).toContain('#UnderdogFantasy');
  });

  it('digest leads with one league tag per sport shown', () => {
    const c = composeDailyDigest({
      entries: [
        { sport: 'nba', sportName: 'NBA', leans: withSource('prizepicks') },
        { sport: 'mlb', sportName: 'MLB', leans: withSource('prizepicks') },
      ],
      siteUrl: SITE_URL,
      channel: 'instagram',
    });
    const last = c.text.split('\n').at(-1)!;
    expect(last.startsWith('#NBA #MLB')).toBe(true);
  });

  it('tag lines never contain tout-speak (assertDescriptive runs on the text)', () => {
    // composeDailyPost already asserts; this documents that the tags are covered.
    const c = composeDailyPost({
      sport: 'nba',
      sportName: 'NBA',
      leans: withSource('prizepicks'),
      siteUrl: SITE_URL,
      channel: 'instagram',
    });
    expect(() => assertDescriptive(c.text)).not.toThrow();
  });
});
