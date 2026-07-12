// Generates social profile BANNERS from the flame mark, one per platform size.
// Same visual language as the OG images (dark stone gradient, brand orange,
// white flame) and the icons from make-icons.mjs. Run once:
//   node scripts/make-banners.mjs
//
// Outputs (public/brand/):
//   banner-x-1500x500.png        X header (also fine on Bluesky)
//   banner-bluesky-3000x1000.png Bluesky banner (3:1, retina)
//   banner-youtube-2560x1440.png YouTube channel art (text inside the
//                                1546x423 "safe area" every device shows)
//   banner-discord-960x540.png   Discord server banner
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const FLAME =
  'M12 2c.6 3.2-1.3 4.7-2.8 6.2C7.7 9.7 6 11.2 6 14a6 6 0 0 0 12 0c0-2-1-3.7-2.2-5' +
  '-.5 1-1.3 1.6-2.3 1.7.8-2.2.3-4.6-1.5-6.4-.8-.8-1.4-1.6-1.7-2.3Z';

const FONT = 'Liberation Sans, DejaVu Sans, sans-serif';

/**
 * One layout, scaled by `u` (the unit): flame-in-tile + wordmark, tagline,
 * feature line, and a bottom row (disclaimer left, domain right), all centered
 * inside a content box. A huge low-opacity flame bleeds off the right edge.
 */
function banner({ width, height, box }) {
  const b = box ?? { x: 0, y: 0, w: width, h: height };
  // Scale unit — the X banner (1500x500) is the reference. Height-driven, but
  // capped by width so narrow formats (Discord 16:9) keep side margins instead
  // of running the feature line edge-to-edge.
  const u = Math.min(b.h / 500, b.w / 1600);
  const cx = b.x + b.w / 2;

  // Vertical rhythm inside the box (reference-size values, scaled by u). When
  // width capped the unit, re-center the main block in the leftover height;
  // the bottom row stays anchored to the box bottom.
  const yShift = (b.h - 500 * u) / 2;
  const wordY = b.y + yShift + 190 * u;
  const tagY = b.y + yShift + 268 * u;
  const featY = b.y + yShift + 322 * u;
  const bottomY = b.y + b.h - 52 * u;

  const tile = 96 * u;
  const wordSize = 92 * u;
  // Approx text width to center the [tile + gap + wordmark] lockup as one unit.
  const wordW = wordSize * 0.52 * 'FantasyFire'.length;
  const lockupW = tile + 28 * u + wordW;
  const tileX = cx - lockupW / 2;
  const wordX = tileX + tile + 28 * u;

  const watermark = b.h * 1.6;

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
  <rect x="${tileX}" y="${wordY - tile + 12 * u}" width="${tile}" height="${tile}" rx="${tile * 0.19}" fill="url(#fire)"/>
  <g transform="translate(${tileX + tile * 0.14},${wordY - tile + 12 * u + tile * 0.14}) scale(${(tile * 0.72) / 24})" fill="#ffffff">
    <path d="${FLAME}"/>
  </g>
  <text x="${wordX}" y="${wordY}" font-family="${FONT}" font-weight="bold" font-size="${wordSize}" fill="#f5f5f4">Fantasy<tspan fill="#fb923c">Fire</tspan></text>
  <text x="${cx}" y="${tagY}" text-anchor="middle" font-family="${FONT}" font-weight="bold" font-size="${34 * u}" fill="#f5f5f4">Player-prop research that&#8217;s honest about uncertainty</text>
  <text x="${cx}" y="${featY}" text-anchor="middle" font-family="${FONT}" font-size="${26 * u}" fill="#a8a29e">Hit rates &#183; confidence intervals &#183; matchup context &#8212; 8 leagues, free, no login</text>
  <text x="${b.x + 24 * u}" y="${bottomY}" font-family="${FONT}" font-size="${20 * u}" fill="#78716c">Stats, not picks &#183; 21+ &#183; Gambling problem? 1-800-GAMBLER</text>
  <text x="${b.x + b.w - 24 * u}" y="${bottomY}" text-anchor="end" font-family="${FONT}" font-weight="bold" font-size="${26 * u}" fill="#fb923c">fantasyfire.app</text>
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
