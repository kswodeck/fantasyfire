// GET /api/og/daily/{sport}/story — the daily-leans card as a VERTICAL
// 1080x1920 JPEG for Instagram Stories (the API's STORIES containers, like
// feed images, only accept JPEG URLs). Layout shared with the 4:5 feed
// variant via cardParts.VerticalCard. JPEG conversion uses jimp (pure JS) —
// sharp's native binaries fail to load in the Vercel serverless bundle under
// pnpm.
import { ImageResponse } from 'next/og';
import { Jimp, JimpMime } from 'jimp';
import { getDailyLeans, type DailyLean } from '@/lib/server/social';
import { isSport, SPORTS } from '@/lib/sports';
import { cardDateLabel, leanImages, VerticalCard } from '../cardParts';

export const dynamic = 'force-dynamic';

const SIZE = { width: 1080, height: 1920 };

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
        variant="story"
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
