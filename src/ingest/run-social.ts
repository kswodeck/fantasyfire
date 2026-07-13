// src/ingest/run-social.ts
//
// GAME-AWARE social auto-publish (docs/MARKETING.md §3): the workflow ticks
// hourly through the game-day window, and each sport with games TODAY posts
// its top FireFactor leans at the first tick inside its pre-game window —
// ~an hour before ITS first game (which moves day to day) — to Bluesky /
// Discord / Telegram with the branded card image. The private owner-only
// "content pack" briefing goes once per day at the fixed daily slot
// (DAILY_TICK_UTC_HOUR), which is also the fallback for sports whose feed has
// no start times.
//
// SAFE BY DEFAULT, three independent gates:
//   1. Inert until SOCIAL_PUBLISH_ENABLED=true (repo variable / env).
//   2. Each channel is skipped unless its secrets are set; every post is
//      best-effort (a failed channel never fails the job or the pipeline).
//   3. Once-per-day-PER-SPORT markers on the IngestRun audit table
//      (`social:{sport}`, `social:pack`) — later ticks and re-runs are no-ops
//      unless --force.
//
//   pnpm social            # post whatever is due right now
//   pnpm social --dry-run  # print every sport's due status + captions, post nothing
//   pnpm social --force    # post all in-season sports now, ignoring windows/markers
import 'dotenv/config';
import { db } from '../lib/db';
import { recordIngestRun } from './ingestRun';
import {
  getDailyLeans,
  getTodaySlateTiming,
  isSportDue,
  socialPostedToday,
  type DailyLean,
} from '../lib/server/social';
import {
  composeDailyPost,
  composeContentPack,
  type ContentPackEntry,
} from '../lib/social/compose';
import { postToBluesky } from '../lib/social/bluesky';
import { postToDiscordWebhook } from '../lib/social/discord';
import { postToInstagram } from '../lib/social/instagram';
import { postToTelegram } from '../lib/social/telegram';
import { postToThreads } from '../lib/social/threads';
import { isDailyTick } from '../lib/social/schedule';
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

/** Write the once-per-day marker for a sport/pack publish (best-effort). */
async function writeMarker(job: string, rowsWritten: number): Promise<void> {
  try {
    const at = new Date();
    await db.ingestRun.create({
      data: { job, status: 'success', rowsWritten, startedAt: at, finishedAt: at, durationMs: 0 },
    });
  } catch (e) {
    console.warn(`[social] failed to write marker "${job}":`, e instanceof Error ? e.message : e);
  }
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

  // Instagram — image required (JPEG variant of the card), caption links are
  // not clickable so the caption points at the bio link instead of a URL swap.
  const igUser = process.env.IG_USER_ID ?? '';
  const igToken = process.env.IG_ACCESS_TOKEN ?? '';
  if (igUser && igToken) {
    if (!card) {
      console.log(`[social] ${sport}: Instagram skipped — needs a public card URL.`);
    } else {
      try {
        const c = composeDailyPost({
          sport,
          sportName,
          leans: post.leans.slice(0, CAPTION_LEANS),
          siteUrl: SITE.url,
          channel: 'instagram',
          maxChars: 1000,
        });
        await postToInstagram(
          { userId: igUser, accessToken: igToken },
          { imageUrl: `${card}/jpeg`, caption: c.text },
        );
        posted++;
        console.log(`[social] ${sport}: posted to Instagram`);
      } catch (e) {
        console.warn(`[social] ${sport}: Instagram failed —`, e instanceof Error ? e.message : e);
      }
    }
  }

  // Threads — image when available, text-only otherwise; links in Threads
  // text are clickable, so swap in the tracked URL like Telegram.
  const thUser = process.env.THREADS_USER_ID ?? '';
  const thToken = process.env.THREADS_ACCESS_TOKEN ?? '';
  if (thUser && thToken) {
    try {
      const c = composeDailyPost({
        sport,
        sportName,
        leans: post.leans.slice(0, CAPTION_LEANS),
        siteUrl: SITE.url,
        channel: 'threads',
        maxChars: 480,
      });
      const text = c.text.replace(c.linkDisplay, c.boardUrl);
      await postToThreads(
        { userId: thUser, accessToken: thToken },
        { text, ...(card ? { imageUrl: card } : {}) },
      );
      posted++;
      console.log(`[social] ${sport}: posted to Threads`);
    } catch (e) {
      console.warn(`[social] ${sport}: Threads failed —`, e instanceof Error ? e.message : e);
    }
  }

  return posted;
}

async function main(): Promise<number> {
  if (!ENABLED && !DRY_RUN) {
    console.log('[social] SOCIAL_PUBLISH_ENABLED is not "true" — skipping (see .env.example).');
    return 0;
  }

  const now = new Date();

  // Every in-season sport with leans, annotated with its game-aware due status
  // (inside the pre-game window of ITS first game today, not yet posted).
  const posts: (SportPost & { due: boolean; firstStart: Date | null })[] = [];
  for (const sport of SPORT_LIST) {
    if (EXCLUDED.has(sport)) continue;
    const leans = await getDailyLeans(sport, CARD_LEANS);
    if (leans.length === 0) continue;
    const { firstStart } = await getTodaySlateTiming(sport);
    const due = FORCE || (await isSportDue(sport, now));
    posts.push({ sport, sportName: SPORTS[sport].name, leans, due, firstStart });
  }
  if (posts.length === 0) {
    console.log('[social] no sport has publishable leans today — nothing to post.');
    return 0;
  }

  let posted = 0;
  for (const post of posts) {
    const startLabel = post.firstStart
      ? `first game ${post.firstStart.toISOString()}`
      : 'no start time (daily-slot fallback)';
    if (DRY_RUN) {
      const c = composeDailyPost({
        sport: post.sport,
        sportName: post.sportName,
        leans: post.leans.slice(0, CAPTION_LEANS),
        siteUrl: SITE.url,
        channel: 'bluesky',
      });
      console.log(
        `\n[social] DRY RUN — ${post.sport} (${startLabel}; due now: ${post.due})\n${c.text}\n→ ${c.boardUrl}\ncard: ${cardUrl(post.sport) ?? '(no public site URL)'}`,
      );
      continue;
    }
    if (!post.due) {
      console.log(`[social] ${post.sport}: not due yet (${startLabel}) — skipping this tick.`);
      continue;
    }
    const n = await publishSport(post);
    if (n > 0) {
      await writeMarker(`social:${post.sport}`, n);
      posted += n;
    }
  }

  // Private owner briefing for manual posting (X / Reddit / community Discords):
  // once per day at the fixed daily slot, covering ALL of today's sports at once
  // regardless of their individual posting windows.
  const packDue =
    FORCE || (isDailyTick(now) && !(await socialPostedToday('social:pack')));
  const packUrl = process.env.DISCORD_CONTENT_PACK_WEBHOOK_URL ?? '';
  if (DRY_RUN || packDue) {
    const entries: ContentPackEntry[] = posts.map((p) => ({
      sport: p.sport,
      sportName: p.sportName,
      leans: p.leans,
    }));
    const pack = composeContentPack({
      entries,
      siteUrl: SITE.url,
      dateIso: now.toISOString().slice(0, 10),
    });
    if (DRY_RUN) {
      console.log(`\n[social] DRY RUN — content pack (due now: ${packDue})\n${pack}`);
    } else if (packUrl) {
      // Discord caps messages at 2000 chars — send per-sport blocks separately.
      try {
        for (const block of pack.split('\n\n__')) {
          const content = block.startsWith('**') ? block : `__${block}`;
          await postToDiscordWebhook(packUrl, { content: content.slice(0, 1990) });
        }
        await writeMarker('social:pack', posts.length);
        console.log('[social] content pack delivered.');
      } catch (e) {
        console.warn('[social] content pack failed —', e instanceof Error ? e.message : e);
      }
    }
  }

  console.log(
    `[social] done — ${posted} post(s); ${posts.filter((p) => p.due).length}/${posts.length} sport(s) due this tick.`,
  );
  return posted;
}

recordIngestRun('social', main)
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
