// GET /{sport}/feed.xml — the per-sport daily-leans RSS feed (one item per
// social day). Same selection as the social posts and cards.
import { getDailyLeans } from '@/lib/server/social';
import { rssFeed, type RssItem } from '@/lib/rss';
import { socialDayStart } from '@/lib/social/schedule';
import { SITE, absoluteUrl } from '@/lib/site';
import { isSport, SPORTS } from '@/lib/sports';

export const revalidate = 1800;

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ sport: string }> },
): Promise<Response> {
  const { sport } = await ctx.params;
  if (!isSport(sport)) return new Response('Unknown sport', { status: 404 });

  const now = new Date();
  const dayIso = socialDayStart(now).toISOString().slice(0, 10);
  const leans = await getDailyLeans(sport, 5, now).catch(() => []);
  const items: RssItem[] =
    leans.length === 0
      ? []
      : [
          {
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
          },
        ];
  return new Response(
    rssFeed({
      title: `${SITE.name} — ${SPORTS[sport].name} Daily Hottest Props`,
      link: absoluteUrl(`/${sport}`),
      description: SPORTS[sport].tagline,
      items,
    }),
    { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } },
  );
}
