// GET /api/og/daily/{sport} — the branded "Today's Hottest Props" card the social
// auto-publish pipeline attaches to its posts (docs/MARKETING.md §3). Reads the
// SAME selection as the poster job (getDailyLeans) so the image can never
// disagree with the caption. Renders a low-key "no slate today" card when the
// sport has no games (the poster never attaches it, but the URL stays 200).
import { ImageResponse } from 'next/og';
import { getDailyLeans, type DailyLean } from '@/lib/server/social';
import { isSport, SPORTS } from '@/lib/sports';
import { heatBadge, SourceChip } from './cardParts';

export const dynamic = 'force-dynamic';

const SIZE = { width: 1200, height: 630 };

export async function GET(_request: Request, ctx: { params: Promise<{ sport: string }> }) {
  const { sport } = await ctx.params;
  if (!isSport(sport)) return new Response('Unknown sport', { status: 404 });

  const [leans, dateLabel] = await Promise.all([
    getDailyLeans(sport, 5).catch(() => [] as DailyLean[]),
    Promise.resolve(
      new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    ),
  ]);
  const cfg = SPORTS[sport];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0c0a09 0%, #1c1917 100%)',
          padding: '48px 64px',
          color: '#f5f5f4',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #fb923c, #ea580c)',
              }}
            />
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 800 }}>
              Fantasy<span style={{ color: '#fb923c' }}>Fire</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {leans.length > 0 ? (
              <SourceChip leans={leans} badgeSize={30} fontSize={14} labelSize={24} />
            ) : null}
            <div
              style={{
                display: 'flex',
                fontSize: 28,
                fontWeight: 800,
                color: '#fff',
                background: cfg.accent,
                borderRadius: 10,
                padding: '6px 18px',
              }}
            >
              {cfg.name}
            </div>
            <div style={{ display: 'flex', fontSize: 26, color: '#a8a29e' }}>{dateLabel}</div>
          </div>
        </div>

        {/* No headline — the post caption already says "Today's hottest props";
            duplicating it here crowded 5 rows into overlap. The rows ARE the card. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28, flexGrow: 1 }}>
          {leans.length === 0 ? (
            <div style={{ display: 'flex', fontSize: 30, color: '#a8a29e' }}>
              No slate today — check back on the next {cfg.name} slate.
            </div>
          ) : (
            leans.map((l, i) => {
              const badge = heatBadge(l);
              return (
                <div
                  key={`${l.slug}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 14,
                    padding: '18px 26px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>
                      {l.firstName.charAt(0)}. {l.lastName}
                    </div>
                    {l.teamAbbreviation ? (
                      <div style={{ display: 'flex', fontSize: 24, color: '#a8a29e' }}>
                        {l.teamAbbreviation}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>
                      {l.side === 'over' ? 'Over' : 'Under'} {l.line} {l.statShort}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        fontSize: 22,
                        fontWeight: 700,
                        color: '#fff',
                        background: badge.bg,
                        borderRadius: 999,
                        padding: '4px 16px',
                      }}
                    >
                      {badge.label}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* No footer — the post caption carries the board link; the card is
            brand + attribution + the rows. */}
      </div>
    ),
    { ...SIZE },
  );
}
