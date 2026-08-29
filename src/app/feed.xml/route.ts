// GET /feed.xml — the site-wide daily-leans RSS feed: one item per in-season
// sport per social day (today's hottest props, linking that sport's board).
// Free syndication surface for readers/aggregators (docs/MARKETING.md §4).
import { getDailyLeans } from '@/lib/server/social';
import { rssFeed, type RssItem } from '@/lib/rss';
import { socialDayStart } from '@/lib/social/schedule';
import { SITE, absoluteUrl } from '@/lib/site';
import { SPORT_LIST, SPORTS } from '@/lib/sports';

export const revalidate = 1800;

export async function GET(): Promise<Response> {
  const now = new Date();
  const dayIso = socialDayStart(now).toISOString().slice(0, 10);
  // One independent lean query per sport, fetched together rather than one after
  // another — this walked all of SPORT_LIST serially. Mapping preserves SPORT_LIST
  // order, so the feed's item order is unchanged.
  const perSport = await Promise.all(
    SPORT_LIST.map(async (sport) => ({
      sport,
      leans: await getDailyLeans(sport, 5, now).catch(() => []),
    })),
  );
  const items: RssItem[] = [];
  for (const { sport, leans } of perSport) {
    if (leans.length === 0) continue;
    items.push({
      title: `Today's hottest ${SPORTS[sport].name} props`,
      link: absoluteUrl(`/${sport}/board?utm_source=rss`),
      description: leans
        .map(
          (l) =>
            `${l.firstName} ${l.lastName} ${l.side === 'over' ? 'Over' : 'Under'} ${l.line} ${l.statShort}`,
        )
        .join(' · '),
      guid: `daily-${sport}-${dayIso}`,
      pubDate: now,
    });
  }
  return new Response(
    rssFeed({
      title: `${SITE.name} — Daily Hottest Props`,
      link: SITE.url,
      description: SITE.description,
      items,
    }),
    { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } },
  );
}
