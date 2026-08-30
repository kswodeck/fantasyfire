// Pure caption/briefing composers for the social auto-publish pipeline
// (docs/MARKETING.md §3). No React/Next/DB imports — unit-testable, and the
// banned-token test below locks in the descriptive-never-predictive brand the
// same way buildWhyText's does.
import { sourceLabel } from '@/lib/providedSources';
import { SUBREDDIT_TARGETS, tagLine } from './hashtags';
import type { Sport } from '@/lib/sports';
import type { DailyLean } from '@/lib/server/social';

/**
 * Predictive/tout language that must NEVER appear in anything we publish.
 * Checked case-insensitively as substrings by the unit test AND at runtime
 * (a composer bug should fail the job loudly, not post tout-speak).
 */
export const BANNED_TOKENS: readonly string[] = [
  'guaranteed',
  'lock of',
  'locks of',
  'sure thing',
  'sure bet',
  'best bet',
  'we predict',
  "can't lose",
  'cant lose',
  'free money',
  'easy money',
  'smash',
  'hammer',
];

/** Throws when text contains tout-speak — used by every composer before returning. */
export function assertDescriptive(text: string): void {
  const lower = text.toLowerCase();
  for (const token of BANNED_TOKENS) {
    if (lower.includes(token)) {
      throw new Error(`social composer produced banned token "${token}"`);
    }
  }
}

export type SocialChannel =
  | 'bluesky'
  | 'discord'
  | 'telegram'
  | 'instagram'
  | 'threads'
  | 'community'
  | 'x';

export interface DailyPostContent {
  /** Post text. Contains `linkDisplay` (a bare host/path) rather than the full URL. */
  text: string;
  /** The display-link substring inside `text` (Bluesky facets anchor to it). */
  linkDisplay: string;
  /** Full tracked URL the display link resolves to. */
  boardUrl: string;
  /** Alt text for the attached card image. */
  imageAlt: string;
}

function capSide(side: 'over' | 'under'): string {
  return side === 'over' ? 'Over' : 'Under';
}

/** Fewest leans worth keeping before giving up the hit-rate evidence entirely. */
const EVIDENCE_FLOOR = 3;

/** Platform-safe poll option length (X caps at 25 for polls; this is the caption-side cap). */
const POLL_OPTION_MAX = 55;

/**
 * The record behind a lean, as a compact caption fragment: "8/10 L10 · 61% season".
 *
 * This is the difference between a post that asserts and a post that shows its work.
 * The site's whole claim is descriptive — historical hit rates with sample-size
 * confidence — and a caption that names a side without the record is the one place
 * the brand quietly stopped honouring that. Counts (not just a percentage) so a thin
 * sample is visible as 3/4 rather than hidden behind "75%".
 *
 * Returns '' when there is nothing decided to report, so the line degrades to exactly
 * what it used to be rather than printing an empty stat.
 *
 * EXPORTED so the card images render the identical string. The cards already promise
 * they "can never disagree with the caption" by reading the same selection; formatting
 * the record twice would have quietly broken that.
 */
export function formatEvidence(l: DailyLean): string {
  const h = l.hitRate;
  if (!h || h.recentDecided === 0) return '';
  const recent = `${h.recentHits}/${h.recentDecided} L${h.recentWindow}`;
  if (h.seasonDecided === 0) return recent;
  const seasonPct = Math.round((h.seasonHits / h.seasonDecided) * 100);
  return `${recent} · ${seasonPct}% season`;
}

function leanLine(l: DailyLean, opts: { evidence?: boolean } = {}): string {
  // The rung's payout multiplier rides along whenever the book posts a
  // meaningful one (Sleeper standard/alt, Underdog alternates) — a plain 1×
  // adds nothing. Trailing zeros trimmed: 1.5 → "1.5×", 2 → "2×".
  const mult =
    l.multiplier != null && l.multiplier !== 1 ? ` (${parseFloat(l.multiplier.toFixed(2))}×)` : '';
  // Full first name, not an initial. "L. James" saved eight characters and cost the
  // reader the player — and on the surfaces with room (everything but Bluesky's 300)
  // that trade was never worth making. The fitting loop below still drops whole leans
  // when a budget is tight, which reads better than abbreviating every one of them.
  const head = `${l.firstName} ${l.lastName} ${capSide(l.side)} ${l.line} ${l.statShort}${mult}`;
  if (!opts.evidence) return head;
  const ev = formatEvidence(l);
  return ev ? `${head} — ${ev}` : head;
}

/**
 * FireFactor tier in the site's heat-read iconography (src/lib/tierStyle.ts):
 * overs run warm (🔥🔥 = Blazing, 🔥 = Hot), unders run cool (❄️❄️ = Frozen,
 * ❄️ = Cold). The card badges carry the matching heat words.
 */
function tierFlames(l: DailyLean): string {
  const glyph = l.side === 'over' ? '🔥' : '❄️';
  return l.tier === 'Strong lean' ? glyph + glyph : glyph;
}

/**
 * Where the lines came from, for the caption footer: the book's display name
 * ("PrizePicks") or "FantasyFire" for our computed median lines. Null when the
 * leans disagree (digest across sports with mixed sources) — omit rather than
 * mislabel.
 */
function linesAttribution(leans: DailyLean[]): string | null {
  const labels = new Set(
    leans.map((l) => (l.linesSource ? sourceLabel(l.linesSource) : 'FantasyFire')),
  );
  return labels.size === 1 ? [...labels][0] : null;
}

/** Tracked board URL for a channel (Umami splits sessions by utm_source). */
export function trackedBoardUrl(siteUrl: string, sport: string, channel: SocialChannel): string {
  return `${siteUrl}/${sport}/board?utm_source=${channel}&utm_medium=social&utm_campaign=daily-leans`;
}

/**
 * The daily top-leans caption for one sport + channel. Descriptive framing only;
 * drops trailing leans until the text fits `maxChars` (Bluesky caps posts at 300
 * graphemes — we count code points, close enough for this ASCII-plus-emoji text).
 */
export function composeDailyPost(opts: {
  sport: string;
  sportName: string;
  leans: DailyLean[];
  siteUrl: string;
  channel: SocialChannel;
  maxChars?: number;
}): DailyPostContent {
  const { sport, sportName, siteUrl, channel, maxChars = 290 } = opts;
  if (opts.leans.length === 0) throw new Error('composeDailyPost needs at least one lean');

  const boardUrl = trackedBoardUrl(siteUrl, sport, channel);
  const linkDisplay = `${siteUrl.replace(/^https?:\/\//, '')}/${sport}/board`;
  // Audience-native, still descriptive: "hottest" = the FireFactor heat the
  // numbers show, never a promise. The RG line and the site carry the fuller
  // framing — captions don't need a defensive disclaimer.
  const header = `Today's hottest ${sportName} props 🔥`;
  const attribution = linesAttribution(opts.leans);
  const footer = `Full board → ${linkDisplay}${attribution ? ` · ${attribution} lines` : ''}`;
  // Discovery tags LAST, after the link — and inside the fitting loop below, so a
  // tight budget (Bluesky's 300) drops a lean rather than truncating the tags.
  const tags = tagLine(channel, {
    sports: [sport],
    sources: opts.leans.map((l) => l.linesSource),
  });

  const render = (ls: DailyLean[], withEvidence: boolean): string =>
    [
      header,
      ...ls.map((l) => `• ${leanLine(l, { evidence: withEvidence })} ${tierFlames(l)}`),
      footer,
      tags,
    ]
      .filter(Boolean)
      .join('\n');
  const fits = (t: string): boolean => [...t].length <= maxChars;

  // Prefer showing the record, and pay for it with leans rather than with evidence:
  // three props that show their work are worth more to a reader than five that only
  // assert. Only when even EVIDENCE_FLOOR leans won't fit (Bluesky's 300-grapheme
  // budget, mainly) does it fall back to the old compact line.
  const floor = Math.min(EVIDENCE_FLOOR, opts.leans.length);
  let leans = [...opts.leans];
  let text = render(leans, true);
  while (!fits(text) && leans.length > floor) {
    leans = leans.slice(0, -1);
    text = render(leans, true);
  }
  if (!fits(text)) {
    leans = [...opts.leans];
    text = render(leans, false);
    while (!fits(text) && leans.length > 1) {
      leans = leans.slice(0, -1);
      text = render(leans, false);
    }
  }

  // Alt text always carries the record: a screen-reader user should get the same
  // evidence a sighted reader gets from the card, and alt has no character budget
  // pressure worth trading it away for.
  const imageAlt =
    `Today's hottest ${sportName} props on FantasyFire: ` +
    `${leans.map((l) => leanLine(l, { evidence: true })).join('; ')}. ` +
    'Historical hit rates with sample-size confidence intervals — past performance, not betting advice.';

  assertDescriptive(text);
  assertDescriptive(imageAlt);
  return { text, linkDisplay, boardUrl, imageAlt };
}

/** One book's leans inside the multi-source post. */
export interface SourceBlock {
  source: string;
  leans: DailyLean[];
}

/**
 * The multi-source daily caption: the usual header, then one block per book —
 * "PrizePicks:" + its lean lines — separated by blank lines, then the board
 * footer. Fitting under `maxChars` drops trailing LEANS first (evenly, keeping
 * every book at ≥1 lean), then trailing BOOKS as a last resort. Books whose
 * payout vocabulary differs keep it per-block (demons/goblins vs multipliers)
 * because leanLine reads each lean's own source data.
 */
export function composeMultiSourcePost(opts: {
  sport: string;
  sportName: string;
  blocks: SourceBlock[];
  siteUrl: string;
  channel: SocialChannel;
  maxChars?: number;
}): DailyPostContent {
  const { sport, sportName, siteUrl, channel, maxChars = 1500 } = opts;
  if (opts.blocks.length === 0) throw new Error('composeMultiSourcePost needs at least one block');

  const boardUrl = trackedBoardUrl(siteUrl, sport, channel);
  const linkDisplay = `${siteUrl.replace(/^https?:\/\//, '')}/${sport}/board`;
  const header = `Today's hottest ${sportName} props 🔥`;
  const footer = `Full board → ${linkDisplay}`;

  const render = (blocks: SourceBlock[]): string =>
    [
      header,
      ...blocks.map(
        (b) =>
          `${sourceLabel(b.source)}:\n` +
          // These channels budget 1500+, so the record always fits — no fallback path.
          b.leans.map((l) => `• ${leanLine(l, { evidence: true })} ${tierFlames(l)}`).join('\n'),
      ),
      footer,
      // Tags last; the books actually in the post drive the book tags, so a
      // trimmed-down block list tags only what the reader can see.
      tagLine(channel, { sports: [sport], sources: blocks.map((b) => b.source) }),
    ]
      .filter(Boolean)
      .join('\n\n');

  let blocks = opts.blocks.map((b) => ({ source: b.source, leans: [...b.leans] }));
  let text = render(blocks);
  // Trim leans round-robin from the longest block down to 1 each…
  while ([...text].length > maxChars && blocks.some((b) => b.leans.length > 1)) {
    const longest = blocks.reduce((a, b) => (b.leans.length > a.leans.length ? b : a));
    longest.leans = longest.leans.slice(0, -1);
    text = render(blocks);
  }
  // …then drop trailing books entirely if it still doesn't fit.
  while ([...text].length > maxChars && blocks.length > 1) {
    blocks = blocks.slice(0, -1);
    text = render(blocks);
  }

  const imageAlt =
    `Today's hottest ${sportName} props on FantasyFire across ` +
    `${blocks.map((b) => sourceLabel(b.source)).join(', ')}. ` +
    'Historical hit rates with sample-size confidence intervals — past performance, not betting advice.';

  assertDescriptive(text);
  assertDescriptive(imageAlt);
  return { text, linkDisplay, boardUrl, imageAlt };
}

export interface ContentPackEntry {
  sport: string;
  sportName: string;
  leans: DailyLean[];
}

export interface DailyDigestContent {
  /** Digest text with a bare display link (no protocol). */
  text: string;
  /** The display-link substring inside `text`. */
  linkDisplay: string;
  /** Full tracked all-sports board URL. */
  boardUrl: string;
  /** Alt text for attached card images. */
  imageAlt: string;
}

/**
 * The multi-sport "today's slate" digest caption — one line per sport (its top
 * lean), linking the all-sports board. Used by the daily-slot bundle formats
 * (carousels, albums, threads). Needs ≥2 sports; trims trailing sports to fit
 * `maxChars` but never below 2.
 */
export function composeDailyDigest(opts: {
  entries: ContentPackEntry[];
  siteUrl: string;
  channel: SocialChannel;
  maxChars?: number;
}): DailyDigestContent {
  const { siteUrl, channel, maxChars = 800 } = opts;
  const withLeans = opts.entries.filter((e) => e.leans.length > 0);
  if (withLeans.length < 2) {
    throw new Error('composeDailyDigest needs at least two sports with leans');
  }

  const boardUrl = `${siteUrl}/board?utm_source=${channel}&utm_medium=social&utm_campaign=daily-digest`;
  const linkDisplay = `${siteUrl.replace(/^https?:\/\//, '')}/board`;
  const attribution = linesAttribution(withLeans.map((e) => e.leans[0]));
  const footer = `All boards → ${linkDisplay}${attribution ? ` · ${attribution} lines` : ''}`;

  const render = (es: ContentPackEntry[], withEvidence: boolean): string => {
    const header = `Today's slate — the hottest props across ${es.length} leagues 🔥`;
    // Multi-sport: the tags lead with one league tag per sport shown (breadth),
    // so a dropped sport also drops its tag.
    const tags = tagLine(channel, {
      sports: es.map((e) => e.sport),
      sources: es.flatMap((e) => e.leans.map((l) => l.linesSource)),
    });
    return [
      header,
      ...es.map(
        (e) =>
          `• ${e.sportName}: ${leanLine(e.leans[0], { evidence: withEvidence })} ${tierFlames(e.leans[0])}`,
      ),
      footer,
      tags,
    ]
      .filter(Boolean)
      .join('\n');
  };
  const fits = (t: string): boolean => [...t].length <= maxChars;

  // Same trade as composeDailyPost: keep the record, pay in leagues. Two is this
  // composer's floor (below that it is not a digest), so evidence is only abandoned
  // when even two leagues with it overflow the budget.
  let entries = [...withLeans];
  let text = render(entries, true);
  while (!fits(text) && entries.length > 2) {
    entries = entries.slice(0, -1);
    text = render(entries, true);
  }
  if (!fits(text)) {
    entries = [...withLeans];
    text = render(entries, false);
    while (!fits(text) && entries.length > 2) {
      entries = entries.slice(0, -1);
      text = render(entries, false);
    }
  }

  const imageAlt =
    `Today's hottest props across ${entries.length} leagues on FantasyFire: ` +
    `${entries.map((e) => `${e.sportName} — ${leanLine(e.leans[0], { evidence: true })}`).join('; ')}. ` +
    'Historical hit rates with sample-size confidence intervals — past performance, not betting advice.';

  assertDescriptive(text);
  assertDescriptive(imageAlt);
  return { text, linkDisplay, boardUrl, imageAlt };
}

/** One row of the Sunday streaks recap. */
export interface StreakEntry {
  /** URL sport key — drives the league hashtags on the recap. */
  sport?: string;
  sportName: string;
  firstName: string;
  lastName: string;
  statShort: string;
  line: number;
  side: 'over' | 'under';
  length: number;
}

/**
 * The Sunday "longest active streaks" recap — descriptive by construction
 * (streaks are historical facts). Null when fewer than 3 streaks qualify (a
 * two-line recap reads thin). Links the all-sports trends board.
 */
export function composeWeeklyStreaks(opts: {
  streaks: StreakEntry[];
  siteUrl: string;
  /** Channel the recap is going to — picks its hashtag policy. Defaults to the
   *  no-tag 'community' voice so a caller that doesn't specify posts clean text. */
  channel?: SocialChannel;
  maxChars?: number;
}): { text: string; linkDisplay: string; boardUrl: string } | null {
  const { siteUrl, channel = 'community', maxChars = 290 } = opts;
  if (opts.streaks.length < 3) return null;

  const boardUrl = `${siteUrl}/trends?utm_source=social&utm_medium=social&utm_campaign=weekly-streaks`;
  const linkDisplay = `${siteUrl.replace(/^https?:\/\//, '')}/trends`;
  const header = 'Longest active streaks on the board ⚡';
  const footer = `All trends → ${linkDisplay}`;

  let streaks = [...opts.streaks];
  let text = '';
  for (;;) {
    const tags = tagLine(channel, {
      sports: streaks.map((s) => s.sport).filter((s): s is string => !!s),
    });
    text = [
      header,
      ...streaks.map(
        (s) =>
          `• ${s.sportName}: ${s.firstName.charAt(0)}. ${s.lastName} — ${s.length} straight ${s.side}s (${s.line} ${s.statShort})`,
      ),
      footer,
      tags,
    ]
      .filter(Boolean)
      .join('\n');
    if ([...text].length <= maxChars || streaks.length <= 3) break;
    streaks = streaks.slice(0, -1);
  }

  assertDescriptive(text);
  return { text, linkDisplay, boardUrl };
}

export interface PollContent {
  question: string;
  /** 2-4 options, each ≤55 chars (Discord's poll-answer limit, the tightest). */
  options: string[];
}

/**
 * The daily engagement poll — one option per sport (its top lean). Null when
 * fewer than two sports have leans (a one-option poll isn't a poll). Framed as
 * a question to the audience, never a prediction from us.
 */
export function composeDailyPoll(entries: ContentPackEntry[], maxOptions = 4): PollContent | null {
  const withLeans = entries.filter((e) => e.leans.length > 0);
  if (withLeans.length < 2) return null;
  const options = withLeans.slice(0, maxOptions).map((e) => {
    const l = e.leans[0];
    const side = l.side === 'over' ? 'Over' : 'Under';
    const tail = `${side} ${l.line} ${l.statShort}`;
    // Full name when it fits; abbreviate the FIRST name before resorting to a hard
    // slice. The old code always abbreviated and then sliced anyway, so a long name
    // could still land mid-word ("NBA · S. Gilgeous-Alexa") — which is the one thing
    // a poll option must not do.
    const full = `${e.sportName} · ${l.firstName} ${l.lastName} ${tail}`;
    if (full.length <= POLL_OPTION_MAX) return full;
    const short = `${e.sportName} · ${l.firstName.charAt(0)}. ${l.lastName} ${tail}`;
    return short.length <= POLL_OPTION_MAX ? short : short.slice(0, POLL_OPTION_MAX);
  });
  const poll: PollContent = {
    question: 'Which prop hits tonight? 🔥',
    options,
  };
  assertDescriptive(poll.question);
  for (const o of poll.options) assertDescriptive(o);
  return poll;
}

/**
 * The private owner briefing (docs/MARKETING.md §5.1): ready-to-paste snippets in
 * a community voice and a social voice, per in-season sport, posted to an
 * owner-only Discord channel. For MANUAL use on X / Reddit / community Discords —
 * never auto-posted anywhere public.
 */
export function composeContentPack(opts: {
  entries: ContentPackEntry[];
  siteUrl: string;
  dateIso: string;
}): string {
  const { entries, siteUrl, dateIso } = opts;
  const blocks: string[] = [
    `**FantasyFire content pack — ${dateIso}**`,
    '_For manual posting (X, Reddit answers, community Discords). Paste, adapt, let the numbers do the talking._',
  ];

  for (const e of entries) {
    if (e.leans.length === 0) continue;
    const top = e.leans[0];
    const playerUrl = `${siteUrl}/${e.sport}/${top.slug}?utm_source=community`;
    const boardUrl = trackedBoardUrl(siteUrl, e.sport, 'community');
    const social = composeDailyPost({
      sport: e.sport,
      sportName: e.sportName,
      leans: e.leans.slice(0, 3),
      siteUrl,
      channel: 'x',
    });
    // Reddit has no hashtags — subreddit routing + post flair is its discovery
    // surface, and tags there read as spam. Print those instead of a tag block.
    const subs = SUBREDDIT_TARGETS[e.sport as Sport] ?? [];
    blocks.push(
      [
        `__${e.sportName}__ — board: <${boardUrl}>`,
        `Social voice (X — hashtags already appended):\n\`\`\`\n${social.text}\n\`\`\``,
        `Community voice (answer a real "is this number good?" — link, don't pitch):\n` +
          `\`\`\`\n${top.firstName} ${top.lastName} ${capSide(top.side).toLowerCase()} ${top.line} ` +
          `${top.statShort} is one of the hottest props on our board today — full game-by-game ` +
          `log with confidence intervals (free, no login): ${playerUrl}\n\`\`\``,
        ...(subs.length > 0
          ? [
              `Reddit — NO hashtags there; use the subreddit + flair instead: ` +
                `${subs.join(', ')} · flair it as a data/analysis post and follow each sub's ` +
                `self-promo rule.`,
            ]
          : []),
        `Embed (offer it to bloggers/roundups):\n` +
          `\`\`\`\n<iframe src="${siteUrl}/embed/${e.sport}/${top.slug}" width="420" height="280" frameborder="0"></iframe>\n\`\`\``,
      ].join('\n'),
    );
  }

  const pack = blocks.join('\n\n');
  assertDescriptive(pack);
  return pack;
}
