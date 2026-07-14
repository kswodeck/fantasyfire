// GET /api/og/daily/{sport} — the branded "Today's Hottest Props" card the social
// auto-publish pipeline attaches to its posts (docs/MARKETING.md §3). Reads the
// SAME selection as the poster job (getDailyLeans) so the image can never
// disagree with the caption. Renders a low-key "no slate today" card when the
// sport has no games (the poster never attaches it, but the URL stays 200).
import { ImageResponse } from 'next/og';
import { sourceBrand, sourceLabel } from '@/lib/providedSources';
import { getDailyLeans, type DailyLean } from '@/lib/server/social';
import { SITE } from '@/lib/site';
import { isSport, SPORTS } from '@/lib/sports';
import { heatLabel } from '@/lib/tierStyle';

export const dynamic = 'force-dynamic';

const SIZE = { width: 1200, height: 630 };

/** The site's heat-read badge (tierStyle.ts): overs warm (Hot/Blazing, orange →
 *  red), unders cool (Cold/Frozen, blue → indigo). */
function heatBadge(l: DailyLean): { label: string; bg: string } {
  const strong = l.tier === 'Strong lean';
  return l.side === 'over'
    ? { label: heatLabel(l.tier, l.side), bg: strong ? '#dc2626' : '#ea580c' }
    : { label: heatLabel(l.tier, l.side), bg: strong ? '#4338ca' : '#2563eb' };
}

/** Where the lines came from — the book's brand badge (providedSources.ts, the
 *  same monogram treatment the site's source dropdown uses) or our own mark
 *  for the computed median fallback. */
function linesBrand(leans: DailyLean[]): {
  monogram: string;
  bg: string;
  fg: string;
  label: string;
} {
  const source = leans[0]?.linesSource ?? null;
  if (!source) return { monogram: 'FF', bg: '#ea580c', fg: '#ffffff', label: 'FantasyFire lines' };
  const brand = sourceBrand(source);
  return { ...brand, label: `${sourceLabel(source)} lines` };
}

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 800,
                    background: linesBrand(leans).bg,
                    color: linesBrand(leans).fg,
                  }}
                >
                  {linesBrand(leans).monogram}
                </div>
                <div style={{ display: 'flex', fontSize: 24, color: '#a8a29e' }}>
                  {linesBrand(leans).label}
                </div>
              </div>
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

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            marginTop: 20,
            paddingTop: 20,
            borderTop: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: '#fb923c' }}>
            {SITE.url.replace(/^https?:\/\//, '')}/{sport}/board
          </div>
        </div>
      </div>
    ),
    { ...SIZE },
  );
}
