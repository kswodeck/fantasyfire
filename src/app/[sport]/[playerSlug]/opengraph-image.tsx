import { ImageResponse } from 'next/og';
import { getPlayerBySlug } from '@/lib/server/players';
import { isSport, SPORTS } from '@/lib/sports';

export const alt = 'FantasyFire player prop research';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Match the player page's ISR window so the OG image's freshness tracks the page.
export const revalidate = 86400;

// Dynamic OG image per player. `params` is a Promise in Next 16.
export default async function Image({
  params,
}: {
  params: Promise<{ sport: string; playerSlug: string }>;
}) {
  const { sport, playerSlug } = await params;
  const sportName = isSport(sport) ? SPORTS[sport].name : 'NBA';
  const player = isSport(sport) ? await getPlayerBySlug(sport, playerSlug) : null;
  const name = player?.fullName ?? `${sportName} Player`;
  const sub = player
    ? [player.teamAbbreviation, player.position].filter(Boolean).join('  ·  ')
    : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0c0a09 0%, #1c1917 100%)',
          padding: '64px 72px',
          color: '#f5f5f4',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #fb923c, #ea580c)',
            }}
          />
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>
            Fantasy<span style={{ color: '#fb923c' }}>Fire</span>
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: '#a8a29e' }}>· {sportName}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
          {sub && (
            <div style={{ marginTop: 12, fontSize: 34, color: '#a8a29e' }}>{sub}</div>
          )}
        </div>

        <div style={{ display: 'flex', fontSize: 28, color: '#a8a29e' }}>
          Hit rates · matchup context · Wilson confidence — from public game logs
        </div>
      </div>
    ),
    { ...size },
  );
}
