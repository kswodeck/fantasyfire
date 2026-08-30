// GET /api/og/daily/{sport} — the branded "Today's Hottest Props" card the social
// auto-publish pipeline attaches to its posts (docs/MARKETING.md §3). Reads the
// SAME selection as the poster job (getDailyLeans) so the image can never
// disagree with the caption. Renders a low-key "no slate today" card when the
// sport has no games (the poster never attaches it, but the URL stays 200).
import { ImageResponse } from 'next/og';
import { getDailyLeans, type DailyLean } from '@/lib/server/social';
import { isSport, SPORTS } from '@/lib/sports';
import { formatEvidence } from '@/lib/social/compose';
import {
  BestLineTag,
  cardDateLabel,
  cardDomain,
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
  // Shared with the vertical cards so both footers apply the same dev-origin guard.
  const domain = cardDomain();
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
          padding: '40px 64px',
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
        {/* Height budget (630px canvas, 80px page padding -> 550 usable): header ~50
            + margin 20 + 5 rows of 72 (48px avatar + 12px x2) + 4 gaps of 10 = 470,
            + footer ~48 = ~538. Anything taller OVERLAPS — satori squeezes, it does
            not clip — so page padding came down from 48 to 40 and the row gap from
            14 to 10 to pay for the footer. The per-row left block is two lines (28px
            name + 18px record) inside the same 48px avatar height, so rows did not
            grow. Verified by rendering the real card, not by arithmetic alone. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20, flexGrow: 1 }}>
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
                    padding: '8px 24px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <LeanAvatar lean={l} src={headshots[l.slug]} size={48} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', fontSize: 28, fontWeight: 700 }}>
                        {l.firstName} {l.lastName}
                      </div>
                      {/* The record behind the read — the identical string the caption
                          prints (formatEvidence), so card and post can never disagree.
                          Sits inside the existing 48px avatar height, so the row does
                          not grow and the height budget below still holds. */}
                      {formatEvidence(l) ? (
                        <div
                          style={{ display: 'flex', fontSize: 18, fontWeight: 600, color: '#a8a29e' }}
                        >
                          {formatEvidence(l)}
                        </div>
                      ) : null}
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

        {/* Footer. The old card deliberately had none, reasoning that the posting
            profile supplies the brand — true in-feed, but images are the part that
            travels: screenshotted, reshared, pinned to a subreddit with no profile
            and no caption attached. A wordmark plus the bare domain makes an
            out-of-context card still say who made it and where to check it, and the
            21+/research line keeps the descriptive framing attached to the artwork
            rather than living only in a caption that may not come along. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, color: '#f5f5f4' }}>
              FantasyFire
            </div>
            {domain ? (
              <div style={{ display: 'flex', fontSize: 20, color: '#78716c' }}>
                {domain}/{sport}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', fontSize: 18, color: '#78716c' }}>
            Historical hit rates · research, not betting advice · 21+
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      // The card content is keyed by the caller's ?d= (social day) + ?s= (book), so a
      // same-day copy is always correct — let the CDN serve repeat crawler/preview
      // fetches instead of re-running the satori render + DB read every hit. Adding
      // `headers` only augments (does not clobber) the built-in image content-type.
      headers: { 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=86400' },
    },
  );
}
