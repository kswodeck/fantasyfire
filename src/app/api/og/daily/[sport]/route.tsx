// GET /api/og/daily/{sport} — the branded "Today's Hottest Props" card the social
// auto-publish pipeline attaches to its posts (docs/MARKETING.md §3). Reads the
// SAME selection as the poster job (getDailyLeans) so the image can never
// disagree with the caption. Renders a low-key "no slate today" card when the
// sport has no games (the poster never attaches it, but the URL stays 200).
import { ImageResponse } from 'next/og';
import { getDailyLeans, type DailyLean } from '@/lib/server/social';
import { isSport, SPORTS } from '@/lib/sports';
import {
  BestLineTag,
  cardDateLabel,
  heatBadge,
  LeanAvatar,
  leanImages,
  payoutTag,
  SIDE_COLOR,
  SourceChip,
  teamStyle,
} from './cardParts';

export const dynamic = 'force-dynamic';

const SIZE = { width: 1200, height: 630 };

export async function GET(request: Request, ctx: { params: Promise<{ sport: string }> }) {
  const { sport } = await ctx.params;
  if (!isSport(sport)) return new Response('Unknown sport', { status: 404 });

  // ?s=<book> pins the card to one book's lines (the multi-source carousel
  // renders one card per book); default is the site's board preference.
  const source = new URL(request.url).searchParams.get('s')?.trim().toLowerCase() || undefined;
  const leans = await getDailyLeans(sport, 5, new Date(), source).catch(() => [] as DailyLean[]);
  const { headshots, teamLogos, sourceLogo } = await leanImages(sport, leans);
  const dateLabel = cardDateLabel();
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
        {/* No brand row — the posting profile already shows the FantasyFire
            name + avatar; repeating them here wasted a header line. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                fontSize: 32,
                fontWeight: 800,
                color: '#fff',
                background: cfg.accent,
                borderRadius: 10,
                padding: '8px 22px',
              }}
            >
              {cfg.name}
            </div>
            <div style={{ display: 'flex', fontSize: 28, color: '#a8a29e' }}>{dateLabel}</div>
          </div>
          {leans.length > 0 ? (
            <SourceChip leans={leans} logo={sourceLogo} badgeSize={34} fontSize={16} labelSize={26} />
          ) : null}
        </div>

        {/* No headline — the post caption already says "Today's hottest props";
            duplicating it here crowded 5 rows into overlap. The rows ARE the card. */}
        {/* Height budget (630px canvas, 96px page padding): header ~50 +
            margin 24 + 5 rows of 72 (48px avatar + 12px×2) + 4 gaps of 14 =
            ~530. Anything taller overlaps — satori squeezes, it doesn't clip. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24, flexGrow: 1 }}>
          {leans.length === 0 ? (
            <div style={{ display: 'flex', fontSize: 30, color: '#a8a29e' }}>
              No slate today — check back on the next {cfg.name} slate.
            </div>
          ) : (
            leans.map((l, i) => {
              const badge = heatBadge(l);
              const team = teamStyle(sport, l);
              const logo = l.teamAbbreviation ? teamLogos[l.teamAbbreviation] : undefined;
              const payout = payoutTag(l);
              return (
                <div
                  key={`${l.slug}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 14,
                    padding: '12px 24px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <LeanAvatar lean={l} src={headshots[l.slug]} size={48} />
                    <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>
                      {l.firstName.charAt(0)}. {l.lastName}
                    </div>
                    {l.teamAbbreviation ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {logo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- satori JSX
                          <img
                            alt=""
                            src={logo}
                            width={26}
                            height={26}
                            style={{ width: 26, height: 26, objectFit: 'contain' }}
                          />
                        ) : null}
                        <div
                          style={{
                            display: 'flex',
                            fontSize: 24,
                            fontWeight: 700,
                            color: team.color,
                          }}
                        >
                          {l.teamAbbreviation}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    {l.bestLine ? <BestLineTag fontSize={18} /> : null}
                    {payout ? (
                      <div
                        style={{
                          display: 'flex',
                          fontSize: 22,
                          fontWeight: 700,
                          color: payout.color,
                        }}
                      >
                        {payout.text}
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 30, fontWeight: 700 }}>
                      <div style={{ display: 'flex', color: SIDE_COLOR[l.side] }}>
                        {l.side === 'over' ? 'Over' : 'Under'}
                      </div>
                      <div style={{ display: 'flex' }}>
                        {l.line} {l.statShort}
                      </div>
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
