import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/site';

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Site-wide default OG image.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 24,
          background: 'linear-gradient(135deg, #0c0a09 0%, #1c1917 100%)',
          padding: '72px',
          color: '#f5f5f4',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #fb923c, #ea580c)',
            }}
          />
          <div style={{ display: 'flex', fontSize: 56, fontWeight: 800 }}>
            Fantasy<span style={{ color: '#fb923c' }}>Fire</span>
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>
          Honest player-prop research
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#a8a29e' }}>
          NBA &amp; MLB · hit rates · matchups · sample-size confidence · fair price
        </div>
      </div>
    ),
    { ...size },
  );
}
