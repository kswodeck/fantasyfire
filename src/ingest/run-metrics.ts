// src/ingest/run-metrics.ts
//
// Weekly analytics digest → the owner-only Discord content-pack channel: last
// 7 days of Umami stats (pageviews/visitors vs the prior week) plus top pages
// and referrers, so "is each channel earning its keep?" comes to the owner
// instead of requiring a dashboard visit. Inert until UMAMI_API_KEY +
// UMAMI_WEBSITE_ID + DISCORD_CONTENT_PACK_WEBHOOK_URL are set.
//
//   pnpm metrics
import 'dotenv/config';
import { db } from '../lib/db';
import { recordIngestRun } from './ingestRun';
import { postToDiscordWebhook } from '../lib/social/discord';

const API = 'https://api.umami.is/v1';

async function umami<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'x-umami-api-key': apiKey } });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`umami ${path} failed (HTTP ${res.status}): ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

interface StatValue {
  value: number;
  prev?: number;
}

function delta(v: StatValue): string {
  if (v.prev === undefined || v.prev === null) return `${v.value}`;
  const diff = v.value - v.prev;
  const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
  return `${v.value} (${arrow}${Math.abs(diff)} vs prior week)`;
}

async function main(): Promise<number> {
  const apiKey = process.env.UMAMI_API_KEY ?? '';
  const websiteId = process.env.UMAMI_WEBSITE_ID ?? '';
  const webhook = process.env.DISCORD_CONTENT_PACK_WEBHOOK_URL ?? '';
  if (!apiKey || !websiteId || !webhook) {
    console.log(
      '[metrics] UMAMI_API_KEY / UMAMI_WEBSITE_ID / DISCORD_CONTENT_PACK_WEBHOOK_URL not all set — skipping.',
    );
    return 0;
  }

  const endAt = Date.now();
  const startAt = endAt - 7 * 86_400_000;
  const range = `startAt=${startAt}&endAt=${endAt}`;

  const stats = await umami<{ pageviews: StatValue; visitors: StatValue; visits: StatValue }>(
    `/websites/${websiteId}/stats?${range}`,
    apiKey,
  );
  const topPages = await umami<{ x: string; y: number }[]>(
    `/websites/${websiteId}/metrics?${range}&type=url&limit=8`,
    apiKey,
  ).catch(() => []);
  const referrers = await umami<{ x: string; y: number }[]>(
    `/websites/${websiteId}/metrics?${range}&type=referrer&limit=8`,
    apiKey,
  ).catch(() => []);

  const lines = [
    `**FantasyFire — last 7 days** (${new Date(startAt).toISOString().slice(0, 10)} → ${new Date(endAt).toISOString().slice(0, 10)})`,
    `Pageviews: **${delta(stats.pageviews)}** · Visitors: **${delta(stats.visitors)}** · Visits: **${delta(stats.visits)}**`,
  ];
  if (topPages.length > 0) {
    lines.push('', '__Top pages__');
    for (const p of topPages) lines.push(`• \`${p.x}\` — ${p.y}`);
  }
  if (referrers.length > 0) {
    lines.push('', '__Top referrers__ (utm channels show under their platform domains)');
    for (const r of referrers) lines.push(`• ${r.x || '(direct)'} — ${r.y}`);
  }

  await postToDiscordWebhook(webhook, { content: lines.join('\n').slice(0, 1990) });
  console.log('[metrics] weekly digest delivered.');
  return 1;
}

recordIngestRun('metrics', main)
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
