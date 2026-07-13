// GET /api/og/daily/{sport}/jpeg — the daily-leans card as JPEG. Instagram's
// Content Publishing API only accepts JPEG image URLs (it rejects the PNG that
// next/og produces), so this wraps the sibling PNG route and converts. Same
// image, same selection — one render path.
import sharp from 'sharp';
import { isSport } from '@/lib/sports';
import { GET as renderPngCard } from '../route';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, ctx: { params: Promise<{ sport: string }> }) {
  const { sport } = await ctx.params;
  if (!isSport(sport)) return new Response('Unknown sport', { status: 404 });

  const pngResponse = await renderPngCard(request, ctx);
  if (!pngResponse.ok) return pngResponse;

  const png = Buffer.from(await pngResponse.arrayBuffer());
  const jpeg = await sharp(png)
    .flatten({ background: '#0c0a09' })
    .jpeg({ quality: 90 })
    .toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { 'content-type': 'image/jpeg' },
  });
}
