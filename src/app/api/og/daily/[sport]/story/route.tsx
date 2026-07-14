// GET /api/og/daily/{sport}/story — the daily-leans card as a VERTICAL
// 1080x1920 JPEG for Instagram Stories (the API's STORIES containers, like
// feed images, only accept JPEG URLs). Same selection (getDailyLeans) and
// visual language as the landscape card — a portrait layout, not a crop.
// JPEG conversion uses jimp (pure JS) — sharp's native binaries fail to load
// in the Vercel serverless bundle under pnpm.
import { ImageResponse } from 'next/og';
import { Jimp, JimpMime } from 'jimp';
import { getDailyLeans, type DailyLean } from '@/lib/server/social';
import { isSport, SPORTS } from '@/lib/sports';
import {
  cardDateLabel,
  heatBadge,
  LeanAvatar,
  leanImages,
  payoutTag,
  SIDE_COLOR,
  SourceChip,
  teamStyle,
} from '../cardParts';

export const dynamic = 'force-dynamic';

const SIZE = { width: 1080, height: 1920 };


export async function GET(_request: Request, ctx: { params: Promise<{ sport: string }> }) {
  const { sport } = await ctx.params;
  if (!isSport(sport)) return new Response('Unknown sport', { status: 404 });

  const leans = await getDailyLeans(sport, 5).catch(() => [] as DailyLean[]);
  const { headshots, teamLogos, sourceLogo } = await leanImages(sport, leans);
  const dateLabel = cardDateLabel();
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
        {/* No brand row — the posting profile already shows the FantasyFire
            name + avatar; the story leads with the sport + date instead. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
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
          <div style={{ display: 'flex', marginTop: 28 }}>
            <SourceChip leans={leans} logo={sourceLogo} badgeSize={40} fontSize={19} labelSize={32} />
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
              const team = teamStyle(sport, l);
              const logo = l.teamAbbreviation ? teamLogos[l.teamAbbreviation] : undefined;
              const payout = payoutTag(l);
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <LeanAvatar lean={l} src={headshots[l.slug]} size={72} />
                      <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>
                        {l.firstName.charAt(0)}. {l.lastName}
                      </div>
                    </div>
                    {l.teamAbbreviation ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {logo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- satori JSX
                          <img
                            alt=""
                            src={logo}
                            width={34}
                            height={34}
                            style={{ width: 34, height: 34, objectFit: 'contain' }}
                          />
                        ) : null}
                        <div
                          style={{
                            display: 'flex',
                            fontSize: 32,
                            fontWeight: 700,
                            color: team.color,
                          }}
                        >
                          {l.teamAbbreviation}
                        </div>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 40, fontWeight: 700 }}>
                      <div style={{ display: 'flex', color: SIDE_COLOR[l.side] }}>
                        {l.side === 'over' ? 'Over' : 'Under'}
                      </div>
                      <div style={{ display: 'flex' }}>
                        {l.line} {l.statShort}
                      </div>
                      {payout ? (
                        <div
                          style={{
                            display: 'flex',
                            fontSize: 30,
                            fontWeight: 700,
                            color: payout.color,
                          }}
                        >
                          {payout.text}
                        </div>
                      ) : null}
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
