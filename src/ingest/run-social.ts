// src/ingest/run-social.ts
//
// GAME-AWARE social auto-publish (docs/MARKETING.md §3): the workflow ticks
// hourly through the posting window (noon–10pm ET) and each sport with games
// TODAY (the 11pm-ET-to-11pm-ET social day) posts its top FireFactor leans at
// the first tick where its first game is within 2 hours — to every configured
// channel in src/lib/social/channels.ts. The multi-sport digest bundle
// (carousels/album/thread/polls), the private owner "content pack" briefing,
// and — on Sundays — the weekly streaks recap all go at the daily slot
// (noon ET), which is also the fallback for sports whose feed has no start times.
//
// SAFE BY DEFAULT, three independent gates:
//   1. Inert until SOCIAL_PUBLISH_ENABLED=true (repo variable / env).
//   2. Channels skip themselves when their secrets are missing; every post is
//      best-effort (a failed channel never fails the job or the pipeline).
//   3. Once-per-social-day markers on the IngestRun audit table
//      (`social:{sport}`, `social:digest`, `social:pack`, `social:weekly`) —
//      later ticks and re-runs are no-ops unless --force.
//
//   pnpm social            # post whatever is due right now
//   pnpm social --dry-run  # print every sport's due status + captions, post nothing
//   pnpm social --force    # post all in-season sports now, ignoring windows/markers
import 'dotenv/config';
import { db } from '../lib/db';
import { recordIngestRun } from './ingestRun';
import {
  getDailyLeans,
  getDailySourceLeans,
  getTodaySlateTiming,
  getWeeklyStreaks,
  isSportDue,
  socialPostedToday,
  type DailyLean,
} from '../lib/server/social';
import {
  composeContentPack,
  composeDailyDigest,
  composeDailyPoll,
  composeDailyPost,
  composeMultiSourcePost,
  composeWeeklyStreaks,
  type ContentPackEntry,
  type SocialChannel,
  type SourceBlock,
} from '../lib/social/compose';
import { CHANNELS, CAPTION_LEANS, cardUrl, type DigestInput } from '../lib/social/channels';
import { postToDiscordWebhook } from '../lib/social/discord';
import { isDailyTick, isWeeklySlot } from '../lib/social/schedule';
import { SITE } from '../lib/site';
import { SPORT_LIST, SPORTS, type Sport } from '../lib/sports';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

const ENABLED = process.env.SOCIAL_PUBLISH_ENABLED === 'true';
/** College props are state-restricted — excluded from auto-posting by default.
 *  `||` not `??`: the workflow passes '' when the repo variable is unset, and
 *  an empty string must mean "use the default", not "exclude nothing". */
const EXCLUDED = new Set(
  (process.env.SOCIAL_SPORTS_EXCLUDE || 'cfb,cbb')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
/** Leans on the card (captions quote CAPTION_LEANS of them). */
const CARD_LEANS = 5;

/** Write the once-per-day marker for a publish (best-effort). */
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

interface SportPost {
  sport: Sport;
  sportName: string;
  leans: DailyLean[];
  /** Per-book blocks (PrizePicks/Underdog/Sleeper/Pick6) — 2+ turns the sport
   *  post into a multi-card carousel/album/thread on every channel. */
  sourceBlocks: SourceBlock[];
  due: boolean;
  firstStart: Date | null;
}

const configured = () => CHANNELS.filter((c) => c.isConfigured());

async function main(): Promise<number> {
  if (!ENABLED && !DRY_RUN) {
    console.log('[social] SOCIAL_PUBLISH_ENABLED is not "true" — skipping (see .env.example).');
    return 0;
  }

  const now = new Date();

  // Every in-season sport with leans, annotated with its game-aware due status
  // (inside the pre-game window of ITS first game today, not yet posted).
  const posts: SportPost[] = [];
  for (const sport of SPORT_LIST) {
    if (EXCLUDED.has(sport)) continue;
    const leans = await getDailyLeans(sport, CARD_LEANS, now);
    if (leans.length === 0) continue;
    const sourceBlocks = await getDailySourceLeans(sport, CARD_LEANS, now).catch(
      () => [] as SourceBlock[],
    );
    const { firstStart } = await getTodaySlateTiming(sport, now);
    const due = FORCE || (await isSportDue(sport, now));
    posts.push({ sport, sportName: SPORTS[sport].name, leans, sourceBlocks, due, firstStart });
  }

  let posted = 0;
  // Configured channels whose post attempt failed (bad token, bot not in the
  // channel, API outage) — surfaced to the private owner channel at the end,
  // because a best-effort warn() in the Actions log is otherwise invisible.
  const channelFailures: string[] = [];

  // Per-sport posts at their game-aware windows.
  for (const post of posts) {
    const startLabel = post.firstStart
      ? `next start ${post.firstStart.toISOString()}`
      : 'no start time (daily-slot fallback)';
    if (DRY_RUN) {
      const multi = post.sourceBlocks.length >= 2;
      const c = multi
        ? composeMultiSourcePost({
            sport: post.sport,
            sportName: post.sportName,
            blocks: post.sourceBlocks.map((b) => ({
              source: b.source,
              leans: b.leans.slice(0, CAPTION_LEANS),
            })),
            siteUrl: SITE.url,
            channel: 'discord',
            maxChars: 1800,
          })
        : composeDailyPost({
            sport: post.sport,
            sportName: post.sportName,
            leans: post.leans.slice(0, CAPTION_LEANS),
            siteUrl: SITE.url,
            channel: 'bluesky',
          });
      const cards = multi
        ? post.sourceBlocks.map((b) => cardUrl(post.sport, null, b.source)).join('\n      ')
        : cardUrl(post.sport);
      console.log(
        `\n[social] DRY RUN — ${post.sport} (${startLabel}; due now: ${post.due}; sources: ${post.sourceBlocks.map((b) => b.source).join(',') || '(single)'})\n${c.text}\n→ ${c.boardUrl}\ncard: ${cards ?? '(no public site URL)'}`,
      );
      continue;
    }
    if (!post.due) {
      console.log(`[social] ${post.sport}: not due yet (${startLabel}) — skipping this tick.`);
      continue;
    }
    let n = 0;
    for (const channel of configured()) {
      const made = await channel.postSport(post);
      if (made === 0) channelFailures.push(`${post.sport} → ${channel.key}`);
      n += made;
    }
    if (n > 0) {
      await writeMarker(`social:${post.sport}`, n);
      posted += n;
    }
  }

  const entries: ContentPackEntry[] = posts.map((p) => ({
    sport: p.sport,
    sportName: p.sportName,
    leans: p.leans,
  }));

  // Multi-sport digest bundle (carousels / album / thread / polls) — once per
  // day at the fixed daily slot, only when 2+ sports have leans (a single-sport
  // day is already covered by that sport's own post).
  const digestDue = FORCE || (isDailyTick(now) && !(await socialPostedToday('social:digest', now)));
  if (posts.length >= 2 && (DRY_RUN || digestDue)) {
    const digest: DigestInput = {
      entries,
      cards: posts
        .map((p) => ({ sport: p.sport, sportName: p.sportName, url: cardUrl(p.sport) }))
        .filter((c): c is DigestInput['cards'][number] => c.url !== null),
      poll: composeDailyPoll(entries),
    };
    if (DRY_RUN) {
      const c = composeDailyDigest({ entries, siteUrl: SITE.url, channel: 'bluesky', maxChars: 290 });
      console.log(
        `\n[social] DRY RUN — digest (due now: ${digestDue})\n${c.text}\n→ ${c.boardUrl}` +
          (digest.poll
            ? `\npoll: ${digest.poll.question}\n${digest.poll.options.map((o) => `  - ${o}`).join('\n')}`
            : ''),
      );
    } else {
      let n = 0;
      for (const channel of configured()) n += await channel.postDigest(digest);
      if (n > 0) {
        await writeMarker('social:digest', n);
        posted += n;
      }
    }
  }

  // Sunday streaks recap — a text post at the weekly slot (noon ET Sunday).
  const weeklyDue = isWeeklySlot(now) && !(await socialPostedToday('social:weekly', now));
  if (DRY_RUN || weeklyDue) {
    const sports = SPORT_LIST.filter((s) => !EXCLUDED.has(s));
    const streaks = await getWeeklyStreaks(sports);
    const recap = composeWeeklyStreaks({ streaks, siteUrl: SITE.url });
    if (recap) {
      if (DRY_RUN) {
        console.log(`\n[social] DRY RUN — weekly streaks (due now: ${weeklyDue})\n${recap.text}`);
      } else {
        let n = 0;
        for (const channel of configured()) {
          if (channel.postText) {
            // Recomposed PER CHANNEL so each gets its own hashtag policy (and the
            // tags count against that channel's character budget).
            const perChannel =
              composeWeeklyStreaks({
                streaks,
                siteUrl: SITE.url,
                channel: channel.key as SocialChannel,
              }) ?? recap;
            n += await channel.postText(perChannel.text, {
              display: perChannel.linkDisplay,
              target: perChannel.boardUrl,
            });
          }
        }
        if (n > 0) {
          await writeMarker('social:weekly', n);
          posted += n;
        }
      }
    } else if (DRY_RUN) {
      console.log('\n[social] DRY RUN — weekly streaks: fewer than 3 qualifying streaks.');
    }
  }

  // Private owner briefing for manual posting (X / Reddit / community Discords):
  // once per day at the fixed daily slot, covering ALL of today's sports at once
  // regardless of their individual posting windows.
  const packDue = FORCE || (isDailyTick(now) && !(await socialPostedToday('social:pack', now)));
  const packUrl = process.env.DISCORD_CONTENT_PACK_WEBHOOK_URL ?? '';
  if (posts.length > 0 && (DRY_RUN || packDue)) {
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

  // Channel-health alert to the private owner channel: a configured channel
  // that fails (expired token, bot missing from the chat) only warns in the
  // Actions log, which nobody reads until posts are visibly missing.
  if (!DRY_RUN && channelFailures.length > 0 && packUrl) {
    try {
      await postToDiscordWebhook(packUrl, {
        content:
          `⚠️ **Channel failures this tick:** ${channelFailures.join(', ')}\n` +
          `The exact API error is in the workflow log (Actions → Game-aware social publish). ` +
          `Common causes: expired/invalid token (Bluesky app password, Meta 60-day tokens), ` +
          `or the Telegram bot not added as a channel admin.`,
      });
    } catch {
      /* the alert itself is best-effort */
    }
  }

  if (posts.length === 0) {
    console.log('[social] no sport has publishable leans today — nothing to post.');
  } else {
    console.log(
      `[social] done — ${posted} post(s); ${posts.filter((p) => p.due).length}/${posts.length} sport(s) due this tick.`,
    );
  }
  return posted;
}

recordIngestRun('social', main)
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
