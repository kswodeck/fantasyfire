// Generates PWA + favicon PNGs from the flame mark. Run once:
//   node scripts/make-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const FLAME =
  'M12 2c.6 3.2-1.3 4.7-2.8 6.2C7.7 9.7 6 11.2 6 14a6 6 0 0 0 12 0c0-2-1-3.7-2.2-5' +
  '-.5 1-1.3 1.6-2.3 1.7.8-2.2.3-4.6-1.5-6.4-.8-.8-1.4-1.6-1.7-2.3Z';

function svg({ size = 512, pad = 128, rounded = true } = {}) {
  const scale = (size - pad * 2) / 24;
  const radius = rounded ? Math.round(size * 0.1875) : 0;
  return Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fb923c"/>
          <stop offset="1" stop-color="#ea580c"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
      <g transform="translate(${pad},${pad}) scale(${scale})" fill="#ffffff">
        <path d="${FLAME}"/>
      </g>
    </svg>`,
  );
}

async function main() {
  await mkdir('public/icons', { recursive: true });
  const jobs = [
    { buf: svg({ size: 192, pad: 40 }), out: 'public/icons/icon-192.png' },
    { buf: svg({ size: 512, pad: 110 }), out: 'public/icons/icon-512.png' },
    // Maskable: extra padding so the flame stays inside the safe zone.
    { buf: svg({ size: 512, pad: 150, rounded: false }), out: 'public/icons/maskable-512.png' },
    { buf: svg({ size: 180, pad: 30 }), out: 'public/apple-icon.png' },
    { buf: svg({ size: 32, pad: 5 }), out: 'public/icons/favicon-32.png' },
  ];
  for (const j of jobs) {
    await sharp(j.buf).png().toFile(j.out);
    console.log('wrote', j.out);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
