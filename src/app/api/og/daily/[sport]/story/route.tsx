// GET /api/og/daily/{sport}/story — the daily-leans card as a VERTICAL
// 1080x1920 JPEG for Instagram Stories (the API's STORIES containers, like
// feed images, only accept JPEG URLs). Same selection (getDailyLeans) and
// visual language as the landscape card — a portrait layout, not a crop.
// JPEG conversion uses jimp (pure JS) — sharp's native binaries fail to load
// in the Vercel serverless bundle under pnpm.
import { ImageResponse } from 'next/og';
import { Jimp, JimpMime } from 'jimp';
import { sourceBrand, sourceLabel } from '@/lib/providedSources';
import { getDailyLeans, type DailyLean } from '@/lib/server/social';
import { isSport, SPORTS } from '@/lib/sports';
import { heatLabel } from '@/lib/tierStyle';

export const dynamic = 'force-dynamic';

const SIZE = { width: 1080, height: 1920 };

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

  const leans = await getDailyLeans(sport, 5).catch(() => [] as DailyLean[]);
  const dateLabel = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const cfg = SPORTS[sport];

  const png = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(160deg, #0c0a09 0%, #1c1917 100%)',
          padding: '120px 64px 100px',
          color: '#f5f5f4',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #fb923c, #ea580c)',
            }}
          />
          <div style={{ display: 'flex', fontSize: 56, fontWeight: 800 }}>
            Fantasy<span style={{ color: '#fb923c' }}>Fire</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 48 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 36,
              fontWeight: 800,
              color: '#fff',
              background: cfg.accent,
              borderRadius: 12,
              padding: '8px 24px',
            }}
          >
            {cfg.name}
          </div>
          <div style={{ display: 'flex', fontSize: 34, color: '#a8a29e' }}>{dateLabel}</div>
        </div>

        {/* No headline — the caption/board carries the words; the rows are the card.
            Instead: where the lines come from, in the site's source-badge treatment. */}
        {leans.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 28 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 10,
                fontSize: 19,
                fontWeight: 800,
                background: linesBrand(leans).bg,
                color: linesBrand(leans).fg,
              }}
            >
              {linesBrand(leans).monogram}
            </div>
            <div style={{ display: 'flex', fontSize: 32, color: '#a8a29e' }}>
              {linesBrand(leans).label}
            </div>
          </div>
        ) : null}

        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 40, flexGrow: 1 }}
        >
          {leans.length === 0 ? (
            <div style={{ display: 'flex', fontSize: 38, color: '#a8a29e' }}>
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
                    flexDirection: 'column',
                    gap: 10,
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 20,
                    padding: '26px 32px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>
                      {l.firstName.charAt(0)}. {l.lastName}
                    </div>
                    {l.teamAbbreviation ? (
                      <div style={{ display: 'flex', fontSize: 32, color: '#a8a29e' }}>
                        {l.teamAbbreviation}
                      </div>
                    ) : null}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>
                      {l.side === 'over' ? 'Over' : 'Under'} {l.line} {l.statShort}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        fontSize: 28,
                        fontWeight: 700,
                        color: '#fff',
                        background: badge.bg,
                        borderRadius: 999,
                        padding: '6px 22px',
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

        {/* No footer — the caption/board carries the link; the card is
            brand + attribution + the rows. */}
      </div>
    ),
    { ...SIZE },
  );

  const image = await Jimp.fromBuffer(await png.arrayBuffer());
  const jpeg = await image.getBuffer(JimpMime.jpeg, { quality: 90 });
  return new Response(new Uint8Array(jpeg), {
    headers: { 'content-type': 'image/jpeg' },
  });
}
