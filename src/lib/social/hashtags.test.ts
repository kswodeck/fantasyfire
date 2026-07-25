import { describe, expect, it } from 'vitest';
import { candidateTags, hashtagsFor, tagLine, SUBREDDIT_TARGETS } from './hashtags';
import { assertDescriptive } from './compose';
import { SPORT_LIST } from '@/lib/sports';
import { PROVIDED_SOURCE_LABELS } from '@/lib/providedSources';

const NBA_PP = { sports: ['nba'], sources: ['prizepicks'] };

describe('per-channel tag policy', () => {
  it('gives each network the count that network actually rewards', () => {
    expect(hashtagsFor('threads', NBA_PP)).toHaveLength(1); // one topic tag per post
    expect(hashtagsFor('x', NBA_PP)).toHaveLength(2);
    expect(hashtagsFor('bluesky', NBA_PP)).toHaveLength(3);
    expect(hashtagsFor('telegram', NBA_PP)).toHaveLength(3);
    expect(hashtagsFor('instagram', NBA_PP)).toHaveLength(6);
  });

  it('emits NOTHING where hashtags do not aid discovery', () => {
    // Discord has no cross-server hashtag search; Reddit uses subreddits + flair.
    expect(hashtagsFor('discord', NBA_PP)).toEqual([]);
    expect(hashtagsFor('community', NBA_PP)).toEqual([]);
    expect(tagLine('discord', NBA_PP)).toBe('');
    expect(tagLine('community', NBA_PP)).toBe('');
  });

  it("spends a single-tag budget on the league, the broadest-reach tag", () => {
    expect(hashtagsFor('threads', NBA_PP)).toEqual(['NBA']);
    expect(hashtagsFor('threads', { sports: ['wnba'] })).toEqual(['WNBA']);
  });

  it('leads with league then book, so small budgets keep both signals', () => {
    expect(hashtagsFor('x', NBA_PP)).toEqual(['NBA', 'PrizePicks']);
  });
});

describe('sport + book targeting', () => {
  it('tags the league of the post, not a generic sports tag', () => {
    expect(tagLine('threads', { sports: ['mlb'] })).toBe('#MLB');
    expect(tagLine('threads', { sports: ['cfb'] })).toBe('#CFB');
    expect(tagLine('threads', { sports: ['mls'] })).toBe('#MLS');
  });

  it('maps each book id to the tag its audience actually searches', () => {
    expect(candidateTags({ sports: ['nba'], sources: ['underdog'] })).toContain('UnderdogFantasy');
    expect(candidateTags({ sports: ['nba'], sources: ['pick6'] })).toContain('DKPick6');
    expect(candidateTags({ sports: ['nba'], sources: ['sleeper'] })).toContain('SleeperPicks');
    expect(candidateTags({ sports: ['nba'], sources: ['draftkings'] })).toContain('DraftKings');
  });

  it('carries at most two books so one slate cannot crowd out the rest', () => {
    const tags = candidateTags({
      sports: ['nba'],
      sources: ['prizepicks', 'underdog', 'sleeper', 'pick6'],
    });
    const books = tags.filter((t) =>
      ['PrizePicks', 'UnderdogFantasy', 'SleeperPicks', 'DKPick6'].includes(t),
    );
    expect(books).toHaveLength(2);
  });

  it('skips unknown/absent sources instead of inventing a tag', () => {
    expect(candidateTags({ sports: ['nba'], sources: [null, undefined, 'nosuchbook'] })).toEqual([
      'NBA',
      'NBAProps',
      'PlayerProps',
      'PropBets',
      'DFS',
    ]);
  });

  it('an unknown sport contributes no league tag but keeps the vertical ones', () => {
    expect(candidateTags({ sports: ['quidditch'] })).toEqual(['PlayerProps', 'PropBets', 'DFS']);
  });

  it('every sport and every book id in the app has a tag mapping', () => {
    for (const sport of SPORT_LIST) {
      expect(tagLine('threads', { sports: [sport] })).toMatch(/^#[A-Za-z0-9]+$/);
      expect(SUBREDDIT_TARGETS[sport].length).toBeGreaterThan(0);
    }
    for (const id of Object.keys(PROVIDED_SOURCE_LABELS)) {
      expect(candidateTags({ sports: ['nba'], sources: [id] }).length).toBeGreaterThan(3);
    }
  });
});

describe('multi-sport digest', () => {
  it('spends its budget on league breadth (one tag per sport)', () => {
    const tags = hashtagsFor('instagram', {
      sports: ['nba', 'mlb', 'nhl'],
      sources: ['prizepicks'],
    });
    expect(tags.slice(0, 3)).toEqual(['NBA', 'MLB', 'NHL']);
  });

  it('caps league tags at three so books/vertical still fit', () => {
    const tags = candidateTags({ sports: ['nba', 'mlb', 'nhl', 'nfl', 'wnba'] });
    expect(tags.filter((t) => ['NBA', 'MLB', 'NHL', 'NFL', 'WNBA'].includes(t))).toHaveLength(3);
    expect(tags).toContain('PlayerProps');
  });

  it('drops the league-specific props tag when several leagues share the post', () => {
    expect(candidateTags({ sports: ['nba', 'mlb'] })).not.toContain('NBAProps');
  });
});

describe('brand safety', () => {
  it('no tag trips the descriptive/anti-tout guard', () => {
    // Guards against reaching for popular-but-banned tags like "#BestBets"
    // (contains "best bet") — assertDescriptive throws if one ever lands here.
    for (const sport of SPORT_LIST) {
      for (const id of Object.keys(PROVIDED_SOURCE_LABELS)) {
        const line = tagLine('instagram', { sports: [sport], sources: [id] });
        expect(() => assertDescriptive(line)).not.toThrow();
      }
    }
  });

  it('renders as a plain space-joined #tag line', () => {
    expect(tagLine('bluesky', NBA_PP)).toBe('#NBA #PrizePicks #NBAProps');
  });
});
