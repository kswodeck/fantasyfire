// GET /api/og/daily/{sport}/jpeg — the daily-leans card as JPEG. Instagram's
// Content Publishing API only accepts JPEG image URLs (it rejects the PNG that
// next/og produces), so this wraps the sibling PNG route and converts. Same
// image, same selection — one render path. Conversion uses jimp (pure JS):
// sharp's native binaries fail to load in the Vercel serverless bundle under
// pnpm (500s in production), and a ~200KB card doesn't need native speed.
import { Jimp, JimpMime } from 'jimp';
import { isSport } from '@/lib/sports';
import { GET as renderPngCard } from '../route';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, ctx: { params: Promise<{ sport: string }> }) {
  const { sport } = await ctx.params;
  if (!isSport(sport)) return new Response('Unknown sport', { status: 404 });

  const pngResponse = await renderPngCard(request, ctx);
  if (!pngResponse.ok) return pngResponse;

  const image = await Jimp.fromBuffer(await pngResponse.arrayBuffer());
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
