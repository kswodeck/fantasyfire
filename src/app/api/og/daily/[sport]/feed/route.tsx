// GET /api/og/daily/{sport}/feed — the daily-leans card as a 4:5 PORTRAIT
// 1080x1350 JPEG for Instagram FEED posts and carousels. Instagram letterboxes
// the 1.91:1 landscape card into its portrait frame (big black bars); 4:5 is
// the tallest feed-native ratio and fills it edge to edge. Layout shared with
// the story via cardParts.VerticalCard; JPEG via jimp (pure JS — sharp's
// native binaries fail in the Vercel serverless bundle under pnpm).
import { ImageResponse } from 'next/og';
import { Jimp, JimpMime } from 'jimp';
import { getDailyLeans, type DailyLean } from '@/lib/server/social';
import { isSport, SPORTS } from '@/lib/sports';
import { cardDateLabel, leanImages, VerticalCard } from '../cardParts';

export const dynamic = 'force-dynamic';

const SIZE = { width: 1080, height: 1350 };

export async function GET(request: Request, ctx: { params: Promise<{ sport: string }> }) {
  const { sport } = await ctx.params;
  if (!isSport(sport)) return new Response('Unknown sport', { status: 404 });

  const source = new URL(request.url).searchParams.get('s')?.trim().toLowerCase() || undefined;
  const leans = await getDailyLeans(sport, 5, new Date(), source).catch(() => [] as DailyLean[]);
  const { headshots, teamLogos, sourceLogo } = await leanImages(sport, leans);
  const cfg = SPORTS[sport];

  const png = new ImageResponse(
    (
      <VerticalCard
        sport={sport}
        sportName={cfg.name}
        accent={cfg.accent}
        variant="feed"
        leans={leans}
        headshots={headshots}
        teamLogos={teamLogos}
        sourceLogo={sourceLogo}
        dateLabel={cardDateLabel()}
      />
    ),
    { ...SIZE },
  );

  const image = await Jimp.fromBuffer(await png.arrayBuffer());
  const jpeg = await image.getBuffer(JimpMime.jpeg, { quality: 90 });
  return new Response(new Uint8Array(jpeg), {
    // Day/book-keyed URL (?d=, ?s=), so CDN-cache repeat fetches instead of
    // re-encoding the JPEG (jimp) on every hit.
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'public, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
