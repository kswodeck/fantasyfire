// Per-platform discovery tags for the auto-publish pipeline.
//
// WHY THIS IS PER-CHANNEL, NOT ONE SHARED STRING: the networks we post to do
// discovery in genuinely different ways, and the same tag block would be wasted
// (or actively bad) on most of them.
//
//   bluesky   — hashtags work AND drive custom feeds, but ONLY when the post
//               declares `app.bsky.richtext.facet#tag` facets; plain "#nba" text
//               is dead characters. bluesky.ts builds those facets (see
//               buildTagFacets), so tags here are real reach. 300-char budget →
//               keep it to 3.
//   threads   — a post carries ONE topic tag. Extra "#" words don't become tags,
//               they just eat the 500-char budget, so this is capped at 1.
//   instagram — the classic hashtag surface and our only discovery lever there
//               (caption links aren't clickable). Meta's own guidance is a
//               handful of RELEVANT tags, not a 30-tag wall — capped at 6.
//   telegram  — tags are clickable and searchable inside the channel; they work
//               as lightweight archive/browse labels rather than open discovery,
//               so a small, consistent set (3) is the useful amount.
//   x         — 1–2 tags is the well-worn ceiling before engagement drops. Used
//               by the owner content pack's manual snippet.
//   discord   — NO hashtag discovery exists. Cross-server search doesn't index
//               them; the nearest native equivalent (forum post tags) applies to
//               forum channels, which a plain webhook message isn't. Tags here
//               would be pure noise, so the policy is 0 (see TAG_POLICY).
//   community — the manual Reddit/forum voice. Reddit has no hashtags; its
//               equivalents are the SUBREDDIT and post FLAIR, and hashtags read
//               as spam there. 0 tags; the content pack prints subreddit/flair
//               guidance instead (see compose.ts).
//
// Tag text is deliberately conservative: every tag also passes through
// assertDescriptive, so tout-flavored tags (e.g. the popular "#BestBets", which
// contains the banned token "best bet") can never ship.
import type { Sport } from '@/lib/sports';
import type { SocialChannel } from './compose';

/** How many tags each channel should carry, and why — see the module header. */
const TAG_POLICY: Record<SocialChannel, number> = {
  bluesky: 3,
  threads: 1, // Threads supports a single topic tag per post
  instagram: 6,
  telegram: 3,
  x: 2,
  discord: 0, // no hashtag discovery on Discord
  community: 0, // Reddit uses subreddits + flair, never hashtags
};

/**
 * League tags per sport: the broad-reach one first, then the props-specific
 * long-tail one. The broad tag is what a single-tag channel (Threads) gets.
 */
const SPORT_TAGS: Record<Sport, [broad: string, niche: string]> = {
  nba: ['NBA', 'NBAProps'],
  mlb: ['MLB', 'MLBProps'],
  nfl: ['NFL', 'NFLProps'],
  nhl: ['NHL', 'NHLProps'],
  wnba: ['WNBA', 'WNBAProps'],
  mls: ['MLS', 'SoccerProps'],
  cfb: ['CFB', 'CollegeFootball'],
  cbb: ['CBB', 'CollegeBasketball'],
};

/** Book/app tags, keyed by our provided-source ids (see providedSources.ts). */
const SOURCE_TAGS: Record<string, string> = {
  // DFS pick'em — the audiences that actually search these
  prizepicks: 'PrizePicks',
  underdog: 'UnderdogFantasy',
  sleeper: 'SleeperPicks',
  pick6: 'DKPick6',
  rtsports: 'RTSports',
  dabble: 'Dabble',
  betr: 'Betr',
  parlayplay: 'ParlayPlay',
  // Sportsbooks
  draftkings: 'DraftKings',
  fanduel: 'FanDuel',
  betmgm: 'BetMGM',
  caesars: 'Caesars',
  hardrock: 'HardRockBet',
  betrivers: 'BetRivers',
  espnbet: 'ESPNBet',
  pointsbet: 'PointsBet',
  unibet: 'Unibet',
  williamhill: 'WilliamHill',
  bovada: 'Bovada',
};

/** Lookup that tolerates the raw URL sport string composers pass around. The
 *  map itself stays keyed by Sport, so a new league can't be forgotten here. */
function sportTags(sport: string): [broad: string, niche: string] | undefined {
  return (SPORT_TAGS as Record<string, [string, string]>)[sport];
}

/** Vertical tags — the audience, independent of league or book. */
const VERTICAL_TAGS = ['PlayerProps', 'PropBets', 'DFS'] as const;

/** Max league tags on a multi-sport digest, so books/vertical still fit. */
const DIGEST_SPORT_CAP = 3;
/** Max book tags in one post — a 4-book slate shouldn't crowd out everything else. */
const SOURCE_CAP = 2;

export interface TagContext {
  /** Sports featured in the post (URL sport keys). One for a sport post, several
   *  for the digest. Unrecognized keys simply contribute no league tag. */
  sports: string[];
  /** Provided-source ids featured (book tags). Unknown/absent ids are skipped. */
  sources?: (string | null | undefined)[];
}

/**
 * The candidate tags for a post, MOST valuable first, so every channel cap slices
 * a sensible set off the front:
 *   1 (Threads)   → #NBA
 *   2 (X)         → #NBA #PrizePicks
 *   3 (BS/TG)     → #NBA #PrizePicks #NBAProps
 *   6 (Instagram) → …#PlayerProps #UnderdogFantasy #PropBets
 * League first (broadest reach), then the book (high-intent searchers), then the
 * long-tail league/vertical tags.
 */
export function candidateTags(ctx: TagContext): string[] {
  const known = ctx.sports.filter((s) => !!sportTags(s));
  const sports = known.slice(0, known.length > 1 ? DIGEST_SPORT_CAP : 1);
  const books = [
    ...new Set(
      (ctx.sources ?? [])
        .map((s) => (s ? SOURCE_TAGS[s] : undefined))
        .filter((t): t is string => !!t),
    ),
  ].slice(0, SOURCE_CAP);

  const broad = sports.map((s) => sportTags(s)![0]);
  // The niche league tag only makes sense for a single-sport post; a digest
  // spends its budget on breadth (one tag per league) instead.
  const niche = sports.length === 1 ? [sportTags(sports[0])![1]] : [];

  return [
    ...broad,
    ...books.slice(0, 1),
    ...niche,
    VERTICAL_TAGS[0], // PlayerProps
    ...books.slice(1),
    ...VERTICAL_TAGS.slice(1), // PropBets, DFS
  ].filter((t, i, all) => all.indexOf(t) === i);
}

/** The tags a given channel should carry (already capped by its policy). */
export function hashtagsFor(channel: SocialChannel, ctx: TagContext): string[] {
  const max = TAG_POLICY[channel] ?? 0;
  return max === 0 ? [] : candidateTags(ctx).slice(0, max);
}

/**
 * The trailing tag line for a post — "#NBA #PrizePicks #NBAProps", or '' when the
 * channel doesn't do hashtag discovery. Callers append this as the LAST line, and
 * must include it in their character budget (compose.ts does).
 */
export function tagLine(channel: SocialChannel, ctx: TagContext): string {
  const tags = hashtagsFor(channel, ctx);
  return tags.length === 0 ? '' : tags.map((t) => `#${t}`).join(' ');
}

/**
 * Reddit's stand-in for hashtags: where a manual post belongs and how to label it.
 * Subreddit routing + flair is the discovery mechanism there — hashtags in a
 * Reddit post read as spam. Surfaced in the owner content pack, never auto-posted.
 */
export const SUBREDDIT_TARGETS: Record<Sport, string[]> = {
  nba: ['r/sportsbook', 'r/dfsports', 'r/nba'],
  mlb: ['r/sportsbook', 'r/dfsports', 'r/baseball'],
  nfl: ['r/sportsbook', 'r/dfsports', 'r/fantasyfootball'],
  nhl: ['r/sportsbook', 'r/dfsports', 'r/hockey'],
  wnba: ['r/sportsbook', 'r/wnba'],
  mls: ['r/sportsbook', 'r/MLS'],
  cfb: ['r/sportsbook', 'r/CFB'],
  cbb: ['r/sportsbook', 'r/CollegeBasketball'],
};
