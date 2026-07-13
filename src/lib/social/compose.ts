// Pure caption/briefing composers for the social auto-publish pipeline
// (docs/MARKETING.md §3). No React/Next/DB imports — unit-testable, and the
// banned-token test below locks in the descriptive-never-predictive brand the
// same way buildWhyText's does.
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

const RG_LINE = '21+ · Gambling problem? 1-800-GAMBLER';

function capSide(side: 'over' | 'under'): string {
  return side === 'over' ? 'Over' : 'Under';
}

function leanLine(l: DailyLean): string {
  return `${l.firstName.charAt(0)}. ${l.lastName} ${capSide(l.side)} ${l.line} ${l.statShort}`;
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
  const header = `🔥 Today's top ${sportName} leans — hit-rate reads from game logs, not picks:`;
  const footer = `Full board → ${linkDisplay}\n${RG_LINE}`;

  let leans = [...opts.leans];
  let text = '';
  for (;;) {
    text = [header, ...leans.map((l) => `• ${leanLine(l)} (${l.tier})`), footer].join('\n');
    if ([...text].length <= maxChars || leans.length <= 1) break;
    leans = leans.slice(0, -1);
  }

  const imageAlt =
    `Today's top ${sportName} leans on FantasyFire: ` +
    `${leans.map(leanLine).join('; ')}. ` +
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
    '_For manual posting (X, Reddit answers, community Discords). Paste, adapt, keep it descriptive — stats, never picks._',
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
    blocks.push(
      [
        `__${e.sportName}__ — board: <${boardUrl}>`,
        `Social voice:\n\`\`\`\n${social.text}\n\`\`\``,
        `Community voice (answer a real "is this number good?" — link, don't pitch):\n` +
          `\`\`\`\n${top.firstName} ${top.lastName} ${capSide(top.side).toLowerCase()} ${top.line} ` +
          `${top.statShort} grades "${top.tier}" today — full game-by-game log with ` +
          `confidence intervals (free, no login): ${playerUrl}\n\`\`\``,
        `Embed (offer it to bloggers/roundups):\n` +
          `\`\`\`\n<iframe src="${siteUrl}/embed/${e.sport}/${top.slug}" width="420" height="280" frameborder="0"></iframe>\n\`\`\``,
      ].join('\n'),
    );
  }

  const pack = blocks.join('\n\n');
  assertDescriptive(pack);
  return pack;
}
