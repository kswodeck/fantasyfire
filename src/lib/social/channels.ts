// The channel registry: every social destination as one object with the same
// shape, so the runner (src/ingest/run-social.ts) is a loop instead of five
// hand-rolled try/catch blocks — and adding a channel is one entry here.
//
// Contract: every method is BEST-EFFORT — it logs its own failures and returns
// how many posts actually went out (never throws). isConfigured() reads the
// channel's env at call time so a missing secret simply skips it.
import { composeDailyPost, composeDailyDigest, type ContentPackEntry, type PollContent } from './compose';
import { postToBluesky, type BlueskyRef } from './bluesky';
import { postToDiscordWebhook } from './discord';
import { postToInstagram, postInstagramCarousel } from './instagram';
import { postToTelegram, postTelegramAlbum, postTelegramPoll } from './telegram';
import { postToThreads, postThreadsCarousel } from './threads';
import { socialDayIso } from './schedule';
import type { DailyLean } from '@/lib/server/social';
import { SITE, absoluteUrl } from '@/lib/site';
import { SPORTS, type Sport } from '@/lib/sports';

/** Leans quoted in a caption (the card can show more). */
export const CAPTION_LEANS = 3;

export interface SportPostInput {
  sport: Sport;
  sportName: string;
  leans: DailyLean[];
}

export interface DigestInput {
  entries: ContentPackEntry[];
  /** Sports with a public card URL, in board order. */
  cards: { sport: Sport; sportName: string; url: string }[];
  poll: PollContent | null;
}

export interface Channel {
  key: string;
  isConfigured(): boolean;
  /** The per-sport daily post. Returns posts made (0 on failure). */
  postSport(post: SportPostInput): Promise<number>;
  /** The multi-sport daily-slot bundle (carousel/album/thread/poll). */
  postDigest(digest: DigestInput): Promise<number>;
  /** A plain text post (weekly recaps etc.); optional per channel. */
  postText?(text: string, link?: { display: string; target: string }): Promise<number>;
}

/**
 * Public card URL (null on localhost — nothing external can fetch it there).
 * Cache-busted with the social day: platforms cache embed images by EXACT URL
 * (Discord's proxy essentially forever), so a bare, never-changing URL kept
 * re-serving the very first render — stale date, stale leans, pre-redesign
 * layout. A new day makes a new URL, forcing a fresh fetch.
 */
export function cardUrl(sport: Sport, variant?: 'jpeg' | 'story'): string | null {
  if (!SITE.url || new URL(SITE.url).host.startsWith('localhost')) return null;
  const path = `/api/og/daily/${sport}${variant ? `/${variant}` : ''}`;
  return absoluteUrl(`${path}?d=${socialDayIso(new Date())}`);
}

async function fetchCardPng(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function warn(key: string, what: string, e: unknown): void {
  console.warn(`[social] ${key}: ${what} failed —`, e instanceof Error ? e.message : e);
}

const bluesky: Channel = {
  key: 'bluesky',
  isConfigured: () => !!(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD),
  async postSport(post) {
    const creds = {
      identifier: process.env.BLUESKY_IDENTIFIER!,
      appPassword: process.env.BLUESKY_APP_PASSWORD!,
    };
    try {
      const c = composeDailyPost({
        sport: post.sport,
        sportName: post.sportName,
        leans: post.leans.slice(0, CAPTION_LEANS),
        siteUrl: SITE.url,
        channel: 'bluesky',
      });
      const card = cardUrl(post.sport);
      const png = card ? await fetchCardPng(card) : null;
      await postToBluesky(creds, {
        text: c.text,
        linkDisplay: c.linkDisplay,
        linkTarget: c.boardUrl,
        ...(png ? { image: { data: png, alt: c.imageAlt, width: 1200, height: 630 } } : {}),
      });
      console.log(`[social] ${post.sport}: posted to Bluesky`);
      return 1;
    } catch (e) {
      warn('bluesky', post.sport, e);
      return 0;
    }
  },
  async postDigest(digest) {
    const creds = {
      identifier: process.env.BLUESKY_IDENTIFIER!,
      appPassword: process.env.BLUESKY_APP_PASSWORD!,
    };
    try {
      const c = composeDailyDigest({
        entries: digest.entries,
        siteUrl: SITE.url,
        channel: 'bluesky',
        maxChars: 290,
      });
      const root = await postToBluesky(creds, {
        text: c.text,
        linkDisplay: c.linkDisplay,
        linkTarget: c.boardUrl,
      });
      let parent: BlueskyRef = root;
      for (const card of digest.cards) {
        const png = await fetchCardPng(card.url);
        if (!png) continue;
        parent = await postToBluesky(creds, {
          text: `${card.sportName} — today's hottest props`,
          image: { data: png, alt: c.imageAlt, width: 1200, height: 630 },
          reply: { root, parent },
        });
      }
      console.log('[social] digest: posted Bluesky thread');
      return 1;
    } catch (e) {
      warn('bluesky', 'digest thread', e);
      return 0;
    }
  },
  async postText(text, link) {
    try {
      await postToBluesky(
        {
          identifier: process.env.BLUESKY_IDENTIFIER!,
          appPassword: process.env.BLUESKY_APP_PASSWORD!,
        },
        { text, ...(link ? { linkDisplay: link.display, linkTarget: link.target } : {}) },
      );
      return 1;
    } catch (e) {
      warn('bluesky', 'text post', e);
      return 0;
    }
  },
};

const discord: Channel = {
  key: 'discord',
  isConfigured: () => !!process.env.DISCORD_WEBHOOK_URL,
  async postSport(post) {
    try {
      const c = composeDailyPost({
        sport: post.sport,
        sportName: post.sportName,
        leans: post.leans.slice(0, CAPTION_LEANS),
        siteUrl: SITE.url,
        channel: 'discord',
        maxChars: 1500,
      });
      const card = cardUrl(post.sport);
      await postToDiscordWebhook(process.env.DISCORD_WEBHOOK_URL!, {
        embed: {
          title: `Today's hottest ${post.sportName} props 🔥`,
          description: c.text,
          url: c.boardUrl,
          ...(card ? { imageUrl: card } : {}),
          color: SPORTS[post.sport].accent,
        },
      });
      console.log(`[social] ${post.sport}: posted to Discord`);
      return 1;
    } catch (e) {
      warn('discord', post.sport, e);
      return 0;
    }
  },
  async postDigest(digest) {
    try {
      const c = composeDailyDigest({
        entries: digest.entries,
        siteUrl: SITE.url,
        channel: 'discord',
        maxChars: 1500,
      });
      await postToDiscordWebhook(process.env.DISCORD_WEBHOOK_URL!, {
        content: c.text,
        embeds: digest.cards.map((card) => ({
          title: `${card.sportName} — today's hottest props`,
          url: `${SITE.url}/${card.sport}/board?utm_source=discord&utm_medium=social&utm_campaign=daily-digest`,
          imageUrl: card.url,
          color: SPORTS[card.sport].accent,
        })),
        ...(digest.poll ? { poll: digest.poll } : {}),
      });
      console.log('[social] digest: posted Discord slate message');
      return 1;
    } catch (e) {
      warn('discord', 'digest', e);
      return 0;
    }
  },
  async postText(text, link) {
    try {
      await postToDiscordWebhook(process.env.DISCORD_WEBHOOK_URL!, {
        content: link ? text.replace(link.display, link.target) : text,
      });
      return 1;
    } catch (e) {
      warn('discord', 'text post', e);
      return 0;
    }
  },
};

const telegram: Channel = {
  key: 'telegram',
  isConfigured: () => !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  async postSport(post) {
    const target = {
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      chatId: process.env.TELEGRAM_CHAT_ID!,
    };
    try {
      const c = composeDailyPost({
        sport: post.sport,
        sportName: post.sportName,
        leans: post.leans.slice(0, CAPTION_LEANS),
        siteUrl: SITE.url,
        channel: 'telegram',
        maxChars: 900,
      });
      // Telegram auto-links bare URLs — swap the display link for the tracked one.
      const text = c.text.replace(c.linkDisplay, c.boardUrl);
      const card = cardUrl(post.sport);
      await postToTelegram(target, { text, ...(card ? { photoUrl: card } : {}) });
      console.log(`[social] ${post.sport}: posted to Telegram`);
      return 1;
    } catch (e) {
      warn('telegram', post.sport, e);
      return 0;
    }
  },
  async postDigest(digest) {
    const target = {
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      chatId: process.env.TELEGRAM_CHAT_ID!,
    };
    let posted = 0;
    if (digest.cards.length >= 2) {
      try {
        const c = composeDailyDigest({
          entries: digest.entries,
          siteUrl: SITE.url,
          channel: 'telegram',
          maxChars: 900,
        });
        await postTelegramAlbum(target, {
          photoUrls: digest.cards.map((card) => card.url),
          caption: c.text.replace(c.linkDisplay, c.boardUrl),
        });
        posted++;
        console.log('[social] digest: posted Telegram album');
      } catch (e) {
        warn('telegram', 'digest album', e);
      }
    }
    if (digest.poll) {
      try {
        await postTelegramPoll(target, digest.poll);
        posted++;
        console.log('[social] digest: posted Telegram poll');
      } catch (e) {
        warn('telegram', 'digest poll', e);
      }
    }
    return posted;
  },
  async postText(text, link) {
    try {
      await postToTelegram(
        { botToken: process.env.TELEGRAM_BOT_TOKEN!, chatId: process.env.TELEGRAM_CHAT_ID! },
        { text: link ? text.replace(link.display, link.target) : text },
      );
      return 1;
    } catch (e) {
      warn('telegram', 'text post', e);
      return 0;
    }
  },
};

const instagram: Channel = {
  key: 'instagram',
  isConfigured: () => !!(process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN),
  async postSport(post) {
    const target = {
      userId: process.env.IG_USER_ID!,
      accessToken: process.env.IG_ACCESS_TOKEN!,
    };
    const card = cardUrl(post.sport);
    if (!card) {
      console.log(`[social] ${post.sport}: Instagram skipped — needs a public card URL.`);
      return 0;
    }
    let posted = 0;
    // Feed post — caption links aren't clickable on IG; traffic goes via bio.
    try {
      const c = composeDailyPost({
        sport: post.sport,
        sportName: post.sportName,
        leans: post.leans.slice(0, CAPTION_LEANS),
        siteUrl: SITE.url,
        channel: 'instagram',
        maxChars: 1000,
      });
      await postToInstagram(target, { imageUrl: cardUrl(post.sport, 'jpeg')!, caption: c.text });
      posted++;
      console.log(`[social] ${post.sport}: posted to Instagram`);
    } catch (e) {
      warn('instagram', post.sport, e);
    }
    // Story alongside — vertical card, no caption (the API ignores them).
    try {
      await postToInstagram(target, { imageUrl: cardUrl(post.sport, 'story')!, kind: 'story' });
      posted++;
      console.log(`[social] ${post.sport}: posted Instagram story`);
    } catch (e) {
      warn('instagram', `${post.sport} story`, e);
    }
    return posted;
  },
  async postDigest(digest) {
    if (digest.cards.length < 2) return 0;
    try {
      const c = composeDailyDigest({
        entries: digest.entries,
        siteUrl: SITE.url,
        channel: 'instagram',
        maxChars: 1000,
      });
      await postInstagramCarousel(
        { userId: process.env.IG_USER_ID!, accessToken: process.env.IG_ACCESS_TOKEN! },
        {
          imageUrls: digest.cards
            .map((card) => cardUrl(card.sport, 'jpeg'))
            .filter((u): u is string => u !== null),
          caption: c.text,
        },
      );
      console.log('[social] digest: posted Instagram carousel');
      return 1;
    } catch (e) {
      warn('instagram', 'digest carousel', e);
      return 0;
    }
  },
};

const threads: Channel = {
  key: 'threads',
  isConfigured: () => !!(process.env.THREADS_USER_ID && process.env.THREADS_ACCESS_TOKEN),
  async postSport(post) {
    try {
      const c = composeDailyPost({
        sport: post.sport,
        sportName: post.sportName,
        leans: post.leans.slice(0, CAPTION_LEANS),
        siteUrl: SITE.url,
        channel: 'threads',
        maxChars: 480,
      });
      // Links in Threads text are clickable — swap in the tracked URL.
      const text = c.text.replace(c.linkDisplay, c.boardUrl);
      const card = cardUrl(post.sport);
      await postToThreads(
        { userId: process.env.THREADS_USER_ID!, accessToken: process.env.THREADS_ACCESS_TOKEN! },
        { text, ...(card ? { imageUrl: card } : {}) },
      );
      console.log(`[social] ${post.sport}: posted to Threads`);
      return 1;
    } catch (e) {
      warn('threads', post.sport, e);
      return 0;
    }
  },
  async postDigest(digest) {
    if (digest.cards.length < 2) return 0;
    try {
      const c = composeDailyDigest({
        entries: digest.entries,
        siteUrl: SITE.url,
        channel: 'threads',
        maxChars: 480,
      });
      await postThreadsCarousel(
        { userId: process.env.THREADS_USER_ID!, accessToken: process.env.THREADS_ACCESS_TOKEN! },
        {
          imageUrls: digest.cards.map((card) => card.url),
          text: c.text.replace(c.linkDisplay, c.boardUrl),
        },
      );
      console.log('[social] digest: posted Threads carousel');
      return 1;
    } catch (e) {
      warn('threads', 'digest carousel', e);
      return 0;
    }
  },
  async postText(text, link) {
    try {
      await postToThreads(
        { userId: process.env.THREADS_USER_ID!, accessToken: process.env.THREADS_ACCESS_TOKEN! },
        { text: link ? text.replace(link.display, link.target) : text },
      );
      return 1;
    } catch (e) {
      warn('threads', 'text post', e);
      return 0;
    }
  },
};

/** Every automated destination, in publish order. */
export const CHANNELS: Channel[] = [bluesky, discord, telegram, instagram, threads];
