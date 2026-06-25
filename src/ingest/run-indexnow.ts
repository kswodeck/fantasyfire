// src/ingest/run-indexnow.ts
//
// Ping IndexNow (Bing/Yandex/DuckDuckGo) with the URLs that actually changed in
// tonight's ingest, so they get recrawled within minutes instead of on the search
// engines' own schedule. Google ignores IndexNow — the sitemap covers it.
//
// "Changed" = (a) every player who played in the last ~2 days (their page + per-stat
// pages move) and (b) the daily boards for any in-season sport (they recompute every
// night). Best-effort: a failed ping never fails the pipeline.
//
//   pnpm indexnow
import 'dotenv/config';
import { db } from '../lib/db';
import { recordIngestRun } from './ingestRun';
import { SITE, absoluteUrl } from '../lib/site';
import { SPORT_LIST, type Sport } from '../lib/sports';
import { SPORT_SECTIONS } from '../lib/sportNav';
import { submitIndexNow } from '../lib/indexnow';

/** Sports with a game in this window count as "in season" for the boards. */
const ACTIVE_LOOKBACK_DAYS = 10;
/** Player pages changed if the player featured in a game this recent. */
const CHANGED_LOOKBACK_DAYS = 2;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function main() {
  if (!SITE.url || new URL(SITE.url).host.startsWith('localhost')) {
    console.log('[indexnow] NEXT_PUBLIC_SITE_URL is local/unset — skipping (needs a public host).');
    return;
  }

  // Players who played recently → their pages changed.
  const changed = await db.playerGameStat.findMany({
    where: { gameDate: { gte: daysAgo(CHANGED_LOOKBACK_DAYS) } },
    select: { sport: true, player: { select: { slug: true } } },
    distinct: ['playerId'],
  });

  // Which sports are in season → submit their daily boards.
  const activeRows = await db.playerGameStat.findMany({
    where: { gameDate: { gte: daysAgo(ACTIVE_LOOKBACK_DAYS) } },
    select: { sport: true },
    distinct: ['sport'],
  });
  const activeSports = activeRows
    .map((r) => r.sport)
    .filter((s): s is Sport => SPORT_LIST.includes(s as Sport));

  const urls = new Set<string>();
  urls.add(absoluteUrl('/'));

  for (const sport of activeSports) {
    urls.add(absoluteUrl(`/${sport}`));
    for (const section of SPORT_SECTIONS) urls.add(absoluteUrl(`/${sport}/${section.seg}`));
  }

  for (const row of changed) {
    if (row.player?.slug) urls.add(absoluteUrl(`/${row.sport}/${row.player.slug}`));
  }

  const list = [...urls];
  console.log(
    `[indexnow] ${list.length} URLs (${changed.length} changed players, ` +
      `${activeSports.length} active sports: ${activeSports.join(', ') || 'none'})`,
  );

  const result = await submitIndexNow(list, SITE.url);
  if (result.skippedReason) {
    console.log(`[indexnow] skipped: ${result.skippedReason}`);
  } else if (result.ok) {
    console.log(`[indexnow] submitted ${result.submitted} URLs (HTTP ${result.status}).`);
  } else {
    // Non-fatal: log loudly but exit 0 so the nightly pipeline still succeeds.
    console.warn(`[indexnow] submission not accepted (HTTP ${result.status}).`);
  }
}

recordIngestRun('indexnow', main)
  .catch((e) => {
    // Best-effort: never fail the pipeline on a recrawl ping.
    console.warn('[indexnow] error (non-fatal):', e instanceof Error ? e.message : e);
  })
  .finally(() => db.$disconnect());
