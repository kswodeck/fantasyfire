// Generates social profile BANNERS from the flame mark, one per platform size.
// Deliberately minimal — just the brand lockup on the dark gradient with a
// flame watermark. No taglines, feature lists, or disclaimers: banner text
// can't be edited per-platform later, so nothing that might change belongs
// here (bios carry the words). Same visual language as the OG images and
// make-icons.mjs. Run once:
//   node scripts/make-banners.mjs
//
// Outputs (public/brand/):
//   banner-x-1500x500.png        X header (also fine on Bluesky)
//   banner-bluesky-3000x1000.png Bluesky banner (3:1, retina)
//   banner-youtube-2560x1440.png YouTube channel art (lockup inside the
//                                1546x423 "safe area" every device shows)
//   banner-discord-960x540.png   Discord server banner
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const FLAME =
  'M12 2c.6 3.2-1.3 4.7-2.8 6.2C7.7 9.7 6 11.2 6 14a6 6 0 0 0 12 0c0-2-1-3.7-2.2-5' +
  '-.5 1-1.3 1.6-2.3 1.7.8-2.2.3-4.6-1.5-6.4-.8-.8-1.4-1.6-1.7-2.3Z';

const FONT = 'Liberation Sans, DejaVu Sans, sans-serif';

/**
 * One layout: the flame-tile + "FantasyFire" wordmark, centered in a content
 * box, over the dark gradient with a huge low-opacity flame bleeding off the
 * right edge. `box` constrains the lockup (YouTube's device safe area).
 */
function banner({ width, height, box }) {
  const b = box ?? { x: 0, y: 0, w: width, h: height };
  // Lockup height ≈ 40% of the box, capped by width so it always fits with margin.
  const tile = Math.min(b.h * 0.4, b.w / 9);
  const wordSize = tile * 0.96;
  const wordW = wordSize * 0.52 * 'FantasyFire'.length;
  const lockupW = tile + tile * 0.3 + wordW;
  const tileX = b.x + (b.w - lockupW) / 2;
  const tileY = b.y + (b.h - tile) / 2;
  const wordX = tileX + tile * 1.3;
  // Baseline that optically centers Liberation Sans caps against the tile.
  const wordY = tileY + tile * 0.82;

  const watermark = height * 1.6;

  return Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0c0a09"/>
      <stop offset="1" stop-color="#1c1917"/>
    </linearGradient>
    <linearGradient id="fire" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fb923c"/>
      <stop offset="1" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <g transform="translate(${width - watermark * 0.62},${height / 2 - watermark / 2}) scale(${watermark / 24})" fill="#ea580c" opacity="0.09">
    <path d="${FLAME}"/>
  </g>
  <rect x="${tileX}" y="${tileY}" width="${tile}" height="${tile}" rx="${tile * 0.19}" fill="url(#fire)"/>
  <g transform="translate(${tileX + tile * 0.14},${tileY + tile * 0.14}) scale(${(tile * 0.72) / 24})" fill="#ffffff">
    <path d="${FLAME}"/>
  </g>
  <text x="${wordX}" y="${wordY}" font-family="${FONT}" font-weight="bold" font-size="${wordSize}" fill="#f5f5f4">Fantasy<tspan fill="#fb923c">Fire</tspan></text>
</svg>`,
  );
}

async function main() {
  await mkdir('public/brand', { recursive: true });
  const jobs = [
    { spec: { width: 1500, height: 500 }, out: 'public/brand/banner-x-1500x500.png' },
    { spec: { width: 3000, height: 1000 }, out: 'public/brand/banner-bluesky-3000x1000.png' },
    {
      // YouTube: only the central 1546x423 is guaranteed visible on every device.
      spec: { width: 2560, height: 1440, box: { x: (2560 - 1546) / 2, y: (1440 - 423) / 2, w: 1546, h: 423 } },
      out: 'public/brand/banner-youtube-2560x1440.png',
    },
    { spec: { width: 960, height: 540 }, out: 'public/brand/banner-discord-960x540.png' },
  ];
  for (const j of jobs) {
    await sharp(banner(j.spec)).png().toFile(j.out);
    console.log('wrote', j.out);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
