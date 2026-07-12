// Generates social profile BANNERS — an abstract "rising embers" pattern in the
// brand palette. Deliberately NO flame mark or tile: the round profile avatar
// already shows the flame (and overlaps the banner's bottom-left on most
// platforms), so the banner repeating it reads as clutter. Two variants per
// size: the plain pattern, and one with a SMALL centered wordmark (center stays
// clear of the avatar overlap zone on every platform). No other text — banner
// copy can't be edited later, so nothing that might change belongs here.
// Run once:
//   node scripts/make-banners.mjs
//
// Outputs (public/brand/):
//   banner-x-1500x500[-plain].png        X header (also fine on Bluesky)
//   banner-bluesky-3000x1000[-plain].png Bluesky banner (3:1, retina)
//   banner-youtube-2560x1440[-plain].png YouTube channel art (wordmark inside
//                                        the 1546x423 safe area = dead center)
//   banner-discord-960x540[-plain].png   Discord server banner
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const FONT = 'Liberation Sans, DejaVu Sans, sans-serif';
const EMBER_COLORS = ['#fb923c', '#f97316', '#ea580c', '#fdba74'];

/** Deterministic PRNG (LCG) so re-running the script produces identical PNGs. */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * The pattern: dark stone gradient, two soft radial glows anchoring the
 * corners, a faint diagonal heat sweep, and scattered ember "sparks" (denser
 * toward the bottom, like they're rising). Optional small centered wordmark.
 */
function banner({ width, height, wordmark, safeH }) {
  const rng = makeRng(20260712);
  const u = height / 500; // scale unit relative to the X banner
  // Wordmark scales with the VISIBLE height — YouTube crops to a 423px center
  // strip on desktop, so its wordmark keys off that, not the 1440px canvas.
  const visibleH = safeH ?? height;

  // Sparks — count scales with area; kept clear of a center box when the
  // wordmark is present so the text sits on calm background.
  const sparkCount = Math.round((width * height) / 18000);
  const clearW = wordmark ? Math.min(width * 0.42, visibleH * 2.6) : 0;
  const clearH = wordmark ? visibleH * 0.3 : 0;
  let sparks = '';
  for (let i = 0; i < sparkCount; i++) {
    const x = rng() * width;
    // Bias downward: sqrt pushes values toward 1 (the bottom half).
    const y = Math.sqrt(rng()) * height;
    if (
      wordmark &&
      Math.abs(x - width / 2) < clearW / 2 &&
      Math.abs(y - height / 2) < clearH / 2
    ) {
      continue;
    }
    const r = (1 + rng() * 2.6) * u;
    const color = EMBER_COLORS[Math.floor(rng() * EMBER_COLORS.length)];
    const opacity = (0.12 + rng() * 0.55).toFixed(2);
    sparks += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" opacity="${opacity}"/>`;
  }

  const wordSize = visibleH * 0.13;
  const word = wordmark
    ? `<text x="${width / 2}" y="${height / 2 + wordSize * 0.35}" text-anchor="middle" font-family="${FONT}" font-weight="bold" font-size="${wordSize}" letter-spacing="${wordSize * 0.02}" fill="#f5f5f4">Fantasy<tspan fill="#fb923c">Fire</tspan></text>`
    : '';

  return Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0c0a09"/>
      <stop offset="1" stop-color="#1c1917"/>
    </linearGradient>
    <radialGradient id="glowBR" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ea580c" stop-opacity="0.5"/>
      <stop offset="0.55" stop-color="#ea580c" stop-opacity="0.14"/>
      <stop offset="1" stop-color="#ea580c" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowTL" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#f97316" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#f97316" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sweep" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#ea580c" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#ea580c" stop-opacity="0.07"/>
      <stop offset="1" stop-color="#fb923c" stop-opacity="0.14"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#sweep)"/>
  <ellipse cx="${width * 0.9}" cy="${height * 0.95}" rx="${width * 0.38}" ry="${height * 0.85}" fill="url(#glowBR)"/>
  <ellipse cx="${width * 0.07}" cy="${height * 0.05}" rx="${width * 0.24}" ry="${height * 0.55}" fill="url(#glowTL)"/>
  ${sparks}
  ${word}
</svg>`,
  );
}

async function main() {
  await mkdir('public/brand', { recursive: true });
  const sizes = [
    { width: 1500, height: 500, name: 'x-1500x500' },
    { width: 3000, height: 1000, name: 'bluesky-3000x1000' },
    // Only the central 1546x423 of YouTube channel art shows on every device.
    { width: 2560, height: 1440, name: 'youtube-2560x1440', safeH: 423 },
    { width: 960, height: 540, name: 'discord-960x540' },
  ];
  for (const s of sizes) {
    for (const wordmark of [true, false]) {
      const out = `public/brand/banner-${s.name}${wordmark ? '' : '-plain'}.png`;
      await sharp(banner({ ...s, wordmark })).png().toFile(out);
      console.log('wrote', out);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
