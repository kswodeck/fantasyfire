import { ImageResponse } from 'next/og';
import { getPlayerResearch } from '@/lib/server/players';
import { isSport, SPORTS } from '@/lib/sports';
import { isPropStat } from '@/lib/propStats';
import { STAT_DEFS, type StatKey } from '@/lib/stats';
import { pct } from '@/lib/format';

export const alt = 'FantasyFire hit-rate card';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Match the stat page's ISR window (daily) so the OG card tracks the page and
// stops re-emitting identical PNGs hourly across the crawled long tail.
export const revalidate = 86400;

const BADGE_COLOR: Record<string, string> = {
  High: '#4ade80',
  Medium: '#fbbf24',
  Low: '#f87171',
};

// Stat-specific shareable card: the over hit rate at our typical line, with the
// Wilson confidence badge baked in — so a shared link shows the actual number.
export default async function Image({
  params,
}: {
  params: Promise<{ sport: string; playerSlug: string; stat: string }>;
}) {
  const { sport, playerSlug, stat } = await params;
  const research =
    isSport(sport) && isPropStat(sport, stat)
      ? await getPlayerResearch(sport, playerSlug, stat as StatKey)
      : null;

  const sportName = isSport(sport) ? SPORTS[sport].name : 'NBA';

  // Fall back to a clean generic card if the player/stat didn't resolve.
  if (!research || research.stat !== stat) {
    return new ImageResponse(<GenericCard sportName={sportName} />, { ...size });
  }

  const def = STAT_DEFS[research.stat];
  const l10 = research.windows.find((w) => w.window === '10');
  const season = research.windows.find((w) => w.window === 'season');
  const win = l10 && l10.hitRate.decided > 0 ? l10 : season;
  const hr = win?.hitRate ?? null;
  const conf = win?.confidence ?? null;
  const windowLabel = win?.window === '10' ? 'last 10' : 'season';
  const overPct = hr?.hitRateOver ?? null;
  const badge = conf?.badge ?? 'Low';
  const badgeColor = BADGE_COLOR[badge] ?? '#a8a29e';
  const sub = [research.player.teamAbbreviation, research.player.position].filter(Boolean).join('  ·  ');

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
          padding: '60px 72px',
          color: '#f5f5f4',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #fb923c, #ea580c)' }}
          />
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>
            Fantasy<span style={{ color: '#fb923c' }}>Fire</span>
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: '#a8a29e' }}>· {sportName}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>
            {research.player.fullName}
          </div>
          <div style={{ display: 'flex', marginTop: 8, fontSize: 30, color: '#a8a29e' }}>
            {sub ? `${def.label}  ·  ${sub}` : def.label}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28, marginTop: 28 }}>
            <div style={{ display: 'flex', fontSize: 120, fontWeight: 800, color: '#4ade80', lineHeight: 1 }}>
              {overPct === null ? '—' : pct(overPct)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 12 }}>
              <div style={{ display: 'flex', fontSize: 34, fontWeight: 600 }}>
                over {research.line} {def.short}
              </div>
              <div style={{ display: 'flex', fontSize: 26, color: '#a8a29e' }}>
                {hr ? `${hr.overs} of ${hr.decided} decided · ${windowLabel}` : windowLabel}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 18px',
              borderRadius: 999,
              border: `2px solid ${badgeColor}`,
              color: badgeColor,
              fontSize: 26,
              fontWeight: 600,
            }}
          >
            {badge} confidence
            {conf ? `  ·  ${pct(conf.interval.lower)}–${pct(conf.interval.upper)}` : ''}
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: '#a8a29e' }}>
            95% Wilson interval — from public game logs
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function GenericCard({ sportName }: { sportName: string }) {
  return (
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
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #fb923c, #ea580c)' }} />
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>
          Fantasy<span style={{ color: '#fb923c' }}>Fire</span>
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: '#a8a29e' }}>· {sportName}</div>
      </div>
      <div style={{ display: 'flex', fontSize: 56, fontWeight: 800 }}>Player prop research</div>
      <div style={{ display: 'flex', fontSize: 28, color: '#a8a29e' }}>
        Hit rates · matchup context · Wilson confidence — from public game logs
      </div>
    </div>
  );
}
