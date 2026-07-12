// src/ingest/run-social.ts
//
// Daily social auto-publish (docs/MARKETING.md §3): for each sport with games
// TODAY, post the top FireFactor leans — descriptive framing, never picks — to
// Bluesky / Discord / Telegram with the branded card image, plus a private
// owner-only "content pack" briefing for manual X/Reddit/community posting.
//
// SAFE BY DEFAULT, three independent gates:
//   1. Inert until SOCIAL_PUBLISH_ENABLED=true (repo variable / env).
//   2. Each channel is skipped unless its secrets are set; every post is
//      best-effort (a failed channel never fails the job or the pipeline).
//   3. Once-per-day guard on the IngestRun audit table — a re-run or a second
//      dispatch the same UTC day is a no-op unless --force.
//
//   pnpm social            # post (subject to the gates above)
//   pnpm social --dry-run  # print captions + card URLs, post nothing
//   pnpm social --force    # bypass the once-per-day guard
import 'dotenv/config';
import { db } from '../lib/db';
import { recordIngestRun } from './ingestRun';
import { getDailyLeans, type DailyLean } from '../lib/server/social';
import {
  composeDailyPost,
  composeContentPack,
  type ContentPackEntry,
} from '../lib/social/compose';
import { postToBluesky } from '../lib/social/bluesky';
import { postToDiscordWebhook } from '../lib/social/discord';
import { postToTelegram } from '../lib/social/telegram';
import { SITE, absoluteUrl } from '../lib/site';
import { SPORT_LIST, SPORTS, type Sport } from '../lib/sports';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

const ENABLED = process.env.SOCIAL_PUBLISH_ENABLED === 'true';
/** College props are state-restricted — excluded from auto-posting by default. */
const EXCLUDED = new Set(
  (process.env.SOCIAL_SPORTS_EXCLUDE ?? 'cfb,cbb')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
/** Leans on the card / in the caption. */
const CARD_LEANS = 5;
const CAPTION_LEANS = 3;

function todayUtcStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Public card URL (null on localhost — nothing external can fetch it there). */
function cardUrl(sport: Sport): string | null {
  if (!SITE.url || new URL(SITE.url).host.startsWith('localhost')) return null;
  return absoluteUrl(`/api/og/daily/${sport}`);
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

interface SportPost {
  sport: Sport;
  sportName: string;
  leans: DailyLean[];
}

async function publishSport(post: SportPost): Promise<number> {
  const { sport, sportName } = post;
  const card = cardUrl(sport);
  let posted = 0;

  // Bluesky — image is uploaded as a blob, link is a facet on the display text.
  const bskyId = process.env.BLUESKY_IDENTIFIER ?? '';
  const bskyPw = process.env.BLUESKY_APP_PASSWORD ?? '';
  if (bskyId && bskyPw) {
    try {
      const c = composeDailyPost({
        sport,
        sportName,
        leans: post.leans.slice(0, CAPTION_LEANS),
        siteUrl: SITE.url,
        channel: 'bluesky',
      });
      const png = card ? await fetchCardPng(card) : null;
      await postToBluesky(
        { identifier: bskyId, appPassword: bskyPw },
        {
          text: c.text,
          linkDisplay: c.linkDisplay,
          linkTarget: c.boardUrl,
          ...(png ? { image: { data: png, alt: c.imageAlt, width: 1200, height: 630 } } : {}),
        },
      );
      posted++;
      console.log(`[social] ${sport}: posted to Bluesky`);
    } catch (e) {
      console.warn(`[social] ${sport}: Bluesky failed —`, e instanceof Error ? e.message : e);
    }
  }

  // Discord (public #daily-leans) — embed references the card by URL.
  const discordUrl = process.env.DISCORD_WEBHOOK_URL ?? '';
  if (discordUrl) {
    try {
      const c = composeDailyPost({
        sport,
        sportName,
        leans: post.leans.slice(0, CAPTION_LEANS),
        siteUrl: SITE.url,
        channel: 'discord',
        maxChars: 1500,
      });
      await postToDiscordWebhook(discordUrl, {
        embed: {
          title: `Today's top ${sportName} leans 🔥`,
          description: c.text,
          url: c.boardUrl,
          ...(card ? { imageUrl: card } : {}),
          color: SPORTS[sport].accent,
        },
      });
      posted++;
      console.log(`[social] ${sport}: posted to Discord`);
    } catch (e) {
      console.warn(`[social] ${sport}: Discord failed —`, e instanceof Error ? e.message : e);
    }
  }

  // Telegram channel — sendPhoto fetches the card URL itself.
  const tgToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const tgChat = process.env.TELEGRAM_CHAT_ID ?? '';
  if (tgToken && tgChat) {
    try {
      const c = composeDailyPost({
        sport,
        sportName,
        leans: post.leans.slice(0, CAPTION_LEANS),
        siteUrl: SITE.url,
        channel: 'telegram',
        maxChars: 900,
      });
      // Telegram auto-links bare URLs — swap the display link for the tracked one.
      const text = c.text.replace(c.linkDisplay, c.boardUrl);
      await postToTelegram(
        { botToken: tgToken, chatId: tgChat },
        { text, ...(card ? { photoUrl: card } : {}) },
      );
      posted++;
      console.log(`[social] ${sport}: posted to Telegram`);
    } catch (e) {
      console.warn(`[social] ${sport}: Telegram failed —`, e instanceof Error ? e.message : e);
    }
  }

  return posted;
}

async function main(): Promise<number> {
  if (!ENABLED && !DRY_RUN) {
    console.log('[social] SOCIAL_PUBLISH_ENABLED is not "true" — skipping (see .env.example).');
    return 0;
  }

  // Once-per-day guard: the ingest cron and the pre-slate cron both reach this
  // job; only the first successful posting run of a UTC day publishes.
  if (!DRY_RUN && !FORCE) {
    const already = await db.ingestRun.findFirst({
      where: {
        job: 'social',
        status: 'success',
        rowsWritten: { gt: 0 },
        startedAt: { gte: todayUtcStart() },
      },
      select: { id: true },
    });
    if (already) {
      console.log('[social] already posted today — skipping (use --force to override).');
      return 0;
    }
  }

  const posts: SportPost[] = [];
  for (const sport of SPORT_LIST) {
    if (EXCLUDED.has(sport)) continue;
    const leans = await getDailyLeans(sport, CARD_LEANS);
    if (leans.length === 0) continue;
    posts.push({ sport, sportName: SPORTS[sport].name, leans });
  }
  if (posts.length === 0) {
    console.log('[social] no sport has publishable leans today — nothing to post.');
    return 0;
  }

  let posted = 0;
  for (const post of posts) {
    if (DRY_RUN) {
      const c = composeDailyPost({
        sport: post.sport,
        sportName: post.sportName,
        leans: post.leans.slice(0, CAPTION_LEANS),
        siteUrl: SITE.url,
        channel: 'bluesky',
      });
      console.log(
        `\n[social] DRY RUN — ${post.sport}\n${c.text}\n→ ${c.boardUrl}\ncard: ${cardUrl(post.sport) ?? '(no public site URL)'}`,
      );
      continue;
    }
    posted += await publishSport(post);
  }

  // Private owner briefing for manual posting (X / Reddit / community Discords).
  const packUrl = process.env.DISCORD_CONTENT_PACK_WEBHOOK_URL ?? '';
  const entries: ContentPackEntry[] = posts.map((p) => ({
    sport: p.sport,
    sportName: p.sportName,
    leans: p.leans,
  }));
  const pack = composeContentPack({
    entries,
    siteUrl: SITE.url,
    dateIso: new Date().toISOString().slice(0, 10),
  });
  if (DRY_RUN) {
    console.log(`\n[social] DRY RUN — content pack\n${pack}`);
  } else if (packUrl) {
    // Discord caps messages at 2000 chars — send per-sport blocks separately.
    try {
      for (const block of pack.split('\n\n__')) {
        const content = block.startsWith('**') ? block : `__${block}`;
        await postToDiscordWebhook(packUrl, { content: content.slice(0, 1990) });
      }
      console.log('[social] content pack delivered.');
    } catch (e) {
      console.warn('[social] content pack failed —', e instanceof Error ? e.message : e);
    }
  }

  console.log(`[social] done — ${posted} post(s) across ${posts.length} sport(s).`);
  return posted;
}

recordIngestRun('social', main)
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
