// src/ingest/run-push.ts
//
// Send a capped, value-first push digest of today's strongest FireScore leans to
// opted-in browsers. Meant to run on its own schedule (NOT wired into the nightly
// ingest — sending notifications is an outward-facing action you opt into).
//
// Inert until VAPID keys are set (NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY).
// Per-subscription frequency cap keeps it to ~3-4/week.
//
//   pnpm push
import 'dotenv/config';
import webpush from 'web-push';
import { db } from '../lib/db';
import { recordIngestRun } from './ingestRun';
import { STAT_DEFS, type StatKey } from '../lib/stats';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:hello@fantasyfire.app';
/** Don't notify a subscription more often than this. */
const MIN_DAYS_BETWEEN = 2;
/** Leans per notification body. */
const PICKS_PER_PUSH = 3;

function statShort(stat: string): string {
  return STAT_DEFS[stat as StatKey]?.short ?? stat.toUpperCase();
}

async function main(): Promise<number> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.log('[push] VAPID keys not set — skipping (see .env.example).');
    return 0;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Today's strongest leans, freshest snapshot, with player names.
  const leans = await db.projectionSnapshot.findMany({
    where: { fireTier: 'Strong lean', snapshotDate: today, graded: false },
    orderBy: { fireScore: 'desc' },
    take: 40,
    select: {
      sport: true,
      stat: true,
      line: true,
      predictedSide: true,
      player: { select: { firstName: true, lastName: true } },
    },
  });
  if (leans.length === 0) {
    console.log('[push] no strong leans today — nothing to send.');
    return 0;
  }

  const cutoff = new Date(Date.now() - MIN_DAYS_BETWEEN * 86_400_000);
  const subs = await db.pushSubscription.findMany({
    where: { OR: [{ lastSentAt: null }, { lastSentAt: { lt: cutoff } }] },
  });
  if (subs.length === 0) {
    console.log('[push] no eligible subscriptions.');
    return 0;
  }

  let sent = 0;
  let pruned = 0;
  for (const sub of subs) {
    const allowed = sub.sports ? new Set(sub.sports.split(',')) : null;
    const picks = leans.filter((l) => !allowed || allowed.has(l.sport)).slice(0, PICKS_PER_PUSH);
    if (picks.length === 0) continue; // no leans in this user's sports today

    const body = picks
      .map(
        (p) =>
          `${p.player.firstName.charAt(0)}. ${p.player.lastName} ${p.predictedSide} ${p.line} ${statShort(p.stat)}`,
      )
      .join('  ·  ');
    const payload = JSON.stringify({
      title: "Today's top leans 🔥",
      body,
      url: `/${picks[0].sport}/board`,
      tag: 'ff-daily',
    });

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      await db.pushSubscription.update({ where: { id: sub.id }, data: { lastSentAt: new Date() } });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // 404/410 = the subscription is gone; prune it so the table stays clean.
      if (code === 404 || code === 410) {
        await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        pruned++;
      } else {
        console.warn(`[push] send failed (HTTP ${code ?? '?'})`);
      }
    }
  }

  console.log(`[push] sent ${sent}, pruned ${pruned} dead, of ${subs.length} eligible.`);
  return sent;
}

recordIngestRun('push', main)
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
