// Shared pieces for the daily-card image routes (landscape + story) so the two
// layouts can't drift: the heat-read badge colors, the lines-source brand
// chip, player headshot fetching, and the ET date label. Pure helpers +
// satori-compatible JSX; no route exports here (route files may only export
// handlers/config).
import { sourceBrand, sourceLabel, sourceLogoPngUrl } from '@/lib/providedSources';
import type { DailyLean } from '@/lib/server/social';
import { formatEvidence } from '@/lib/social/compose';
import { SITE } from '@/lib/site';
import { socialDayIso } from '@/lib/social/schedule';
import { getTeam, playerHeadshotUrl, teamLogoUrl } from '@/lib/teams';
import { heatLabel } from '@/lib/tierStyle';
import type { Sport } from '@/lib/sports';

// The webapp's dark-theme direction/payout colors (globals.css tokens) — the
// cards render on the same dark gradient, so the dark values apply.
export const SIDE_COLOR = { over: '#fb923c', under: '#60a5fa' } as const;
const PAYOUT_COLOR: Record<string, string> = { demon: '#f87171', goblin: '#86efac' };

/** "1.31×" with trailing zeros trimmed — same treatment as the site's
 *  PayoutBadge (not imported: that module is a client component). */
export function formatMultiplier(m: number): string {
  return `${parseFloat(m.toFixed(2))}×`;
}

/** The multiplier/payout tag for a lean's rung, or null for a plain line:
 *  the exact multiplier when the book posts one (skipping a plain 1×), else
 *  the demon/goblin kind. Colored like the site's payout badges.
 *  Demon/goblin is PRIZEPICKS vocabulary — other books never get those words
 *  or colors here, even if a feed ever mislabels an oddsType. */
export function payoutTag(l: DailyLean): { text: string; color: string } | null {
  const kind =
    l.linesSource === 'prizepicks' && l.oddsType && PAYOUT_COLOR[l.oddsType] ? l.oddsType : null;
  if (l.multiplier != null && l.multiplier !== 1) {
    return {
      text: formatMultiplier(l.multiplier),
      color: kind ? PAYOUT_COLOR[kind] : '#a8a29e',
    };
  }
  if (kind) return { text: kind, color: PAYOUT_COLOR[kind] };
  return null;
}

/** Team display bits for a lean row: abbr in the team's brand color + logo key. */
export function teamStyle(sport: Sport, l: DailyLean): { color: string } {
  return { color: getTeam(sport, l.teamAbbreviation).primary };
}

/**
 * The VERTICAL card layout, shared by the story (1080x1920, 9:16) and the
 * Instagram feed/carousel (1080x1350, 4:5) so the two can't drift. Same visual
 * language as the landscape card: sport badge + date, source chip, then
 * two-line lean rows (avatar + name + team logo/abbr, then side + line +
 * payout + heat badge). The feed variant exists because Instagram letterboxes
 * a 1.91:1 landscape card into its portrait frame — the 4:5 render fills it.
 */
export function VerticalCard({
  sport,
  sportName,
  accent,
  variant,
  leans,
  headshots,
  teamLogos,
  sourceLogo,
  dateLabel,
}: {
  sport: Sport;
  sportName: string;
  accent: string;
  variant: 'story' | 'feed';
  leans: DailyLean[];
  headshots: Record<string, string>;
  teamLogos: Record<string, string>;
  sourceLogo: string | null;
  dateLabel: string;
}) {
  const story = variant === 'story';
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(160deg, #0c0a09 0%, #1c1917 100%)',
        // Feed top padding is tuned so the header sits BELOW the 1:1 grid-crop
        // line (a 1080x1350 card's square thumbnail shows y 135–1215): with
        // 140px the badge, chip, and all five rows land inside the thumbnail.
        padding: story ? '120px 64px 100px' : '140px 64px 56px',
        color: '#f5f5f4',
        fontFamily: 'sans-serif',
      }}
    >
      {/* No brand row — the posting profile already shows the FantasyFire
          name + avatar; the card leads with the sport + date instead. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div
          style={{
            display: 'flex',
            fontSize: 36,
            fontWeight: 800,
            color: '#fff',
            background: accent,
            borderRadius: 12,
            padding: '8px 24px',
          }}
        >
          {sportName}
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: '#a8a29e' }}>{dateLabel}</div>
      </div>

      {leans.length > 0 ? (
        <div style={{ display: 'flex', marginTop: story ? 28 : 22 }}>
          <SourceChip leans={leans} logo={sourceLogo} badgeSize={40} fontSize={19} labelSize={32} />
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: story ? 16 : 12,
          marginTop: story ? 32 : 24,
          flexGrow: 1,
        }}
      >
        {leans.length === 0 ? (
          <div style={{ display: 'flex', fontSize: 38, color: '#a8a29e' }}>
            No slate today — check back on the next {sportName} slate.
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
                  gap: story ? 6 : 4,
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 20,
                  padding: story ? '18px 32px' : '14px 30px',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <LeanAvatar lean={l} src={headshots[l.slug]} size={story ? 72 : 64} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>
                        {l.firstName} {l.lastName}
                      </div>
                      {/* The record the read rests on. Same string the caption prints
                          (formatEvidence), so a screenshot of the card and the post text
                          can never tell the reader different things. */}
                      {formatEvidence(l) ? (
                        <div
                          style={{
                            display: 'flex',
                            fontSize: story ? 26 : 24,
                            fontWeight: 600,
                            color: '#a8a29e',
                            marginTop: 2,
                          }}
                        >
                          {formatEvidence(l)}
                        </div>
                      ) : null}
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
                        style={{ display: 'flex', fontSize: 32, fontWeight: 700, color: team.color }}
                      >
                        {l.teamAbbreviation}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontSize: 40,
                      fontWeight: 700,
                    }}
                  >
                    <div style={{ display: 'flex', color: SIDE_COLOR[l.side] }}>
                      {l.side === 'over' ? 'Over' : 'Under'}
                    </div>
                    <div style={{ display: 'flex' }}>
                      {l.line} {l.statShort}
                    </div>
                    {l.bestLine ? <BestLineTag fontSize={24} /> : null}
                    {payout ? (
                      <div
                        style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: payout.color }}
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

      {/* Footer — see the landscape card for the reasoning. It matters MORE here:
          a 1080x1350 feed post or a 1080x1920 story is the format people screenshot
          and reshare, arriving somewhere with no profile and no caption. The
          wordmark, the bare domain and the descriptive framing have to survive that
          trip on the artwork itself. `domain` is null in a dev environment rather
          than publishing a localhost origin. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: story ? 28 : 22,
          paddingTop: story ? 20 : 16,
          borderTop: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ display: 'flex', fontSize: story ? 30 : 28, fontWeight: 800, color: '#f5f5f4' }}>
            FantasyFire
          </div>
          {cardDomain() ? (
            <div style={{ display: 'flex', fontSize: story ? 26 : 24, color: '#78716c' }}>
              {cardDomain()}/{sport}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', fontSize: story ? 22 : 21, color: '#78716c' }}>
          Research, not betting advice · 21+
        </div>
      </div>
    </div>
  );
}

/**
 * Host for the card footer, or null when it would leak a dev origin.
 * NEXT_PUBLIC_SITE_URL is unset in some environments and SITE.url then falls back to
 * localhost — which must never be published on artwork that travels off-platform.
 */
export function cardDomain(): string | null {
  const host = SITE.url.replace(/^https?:\/\//, '');
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|$)/.test(host) ? null : host;
}

/** "best line" marker (multi-source cards): this book posts the most favorable
 *  number across books for the player+stat. Amber like the site's heat-1. */
export function BestLineTag({ fontSize }: { fontSize: number }) {
  return (
    <div
      style={{
        display: 'flex',
        fontSize,
        fontWeight: 700,
        color: '#fbbf24',
        border: '1.5px solid rgba(251,191,36,0.45)',
        borderRadius: 999,
        padding: `${Math.round(fontSize * 0.15)}px ${Math.round(fontSize * 0.55)}px`,
      }}
    >
      best line
    </div>
  );
}

/** The social day's date label ("Jul 14, 2026") — ET-based, matching the
 *  posts, never the raw UTC date (which flips a day ahead after 8pm ET). */
export function cardDateLabel(now = new Date()): string {
  return new Date(`${socialDayIso(now)}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * A remote image as a data URI, or null. Fetched server-side BEFORE rendering
 * because a satori <img> pointing at a remote URL fails the WHOLE render if
 * the CDN hiccups — a null here just falls back to text/initials. Best-effort
 * with a short timeout; never throws. Rejects .ico (satori can't decode it).
 */
async function imageDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? 'image/png';
    if (!type.startsWith('image/') || type.includes('icon')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return null; // placeholder/empty responses
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Everything the card layouts need prefetched: player headshots (by slug),
 *  team logos (by abbreviation), and the book's real favicon (null → the
 *  monogram badge renders instead). One parallel sweep, all best-effort. */
export async function leanImages(
  sport: Sport,
  leans: DailyLean[],
): Promise<{
  headshots: Record<string, string>;
  teamLogos: Record<string, string>;
  sourceLogo: string | null;
}> {
  const headshots: Record<string, string> = {};
  const teamLogos: Record<string, string> = {};
  let sourceLogo: string | null = null;

  const jobs: Promise<void>[] = leans.map(async (l) => {
    if (!l.playerExternalId) return;
    const uri = await imageDataUri(playerHeadshotUrl(sport, l.playerExternalId, 'sm'));
    if (uri) headshots[l.slug] = uri;
  });
  for (const abbr of new Set(
    leans.map((l) => l.teamAbbreviation).filter((a): a is string => !!a),
  )) {
    const lean = leans.find((l) => l.teamAbbreviation === abbr);
    jobs.push(
      (async () => {
        const uri = await imageDataUri(teamLogoUrl(sport, lean?.teamExternalId ?? 0, abbr));
        if (uri) teamLogos[abbr] = uri;
      })(),
    );
  }
  const source = leans[0]?.linesSource ?? null;
  const logoUrl = source ? sourceLogoPngUrl(source) : null;
  if (logoUrl) {
    jobs.push(
      (async () => {
        sourceLogo = await imageDataUri(logoUrl);
      })(),
    );
  }
  await Promise.all(jobs);
  return { headshots, teamLogos, sourceLogo };
}

/** Round player avatar: the official headshot when we got one, else initials. */
export function LeanAvatar({
  lean,
  src,
  size,
}: {
  lean: DailyLean;
  src: string | undefined;
  size: number;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- satori JSX, not the DOM
      <img
        alt=""
        src={src}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          objectFit: 'cover',
          background: 'rgba(255,255,255,0.08)',
        }}
      />
    );
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.10)',
        color: '#d6d3d1',
        fontSize: Math.round(size * 0.36),
        fontWeight: 700,
      }}
    >
      {lean.firstName.charAt(0)}
      {lean.lastName.charAt(0)}
    </div>
  );
}

/** The site's heat-read badge (tierStyle.ts): overs warm (Hot/Blazing, orange →
 *  red), unders cool (Cold/Frozen, blue → indigo). */
export function heatBadge(l: DailyLean): { label: string; bg: string } {
  const strong = l.tier === 'Strong lean';
  return l.side === 'over'
    ? { label: heatLabel(l.tier, l.side), bg: strong ? '#dc2626' : '#ea580c' }
    : { label: heatLabel(l.tier, l.side), bg: strong ? '#4338ca' : '#2563eb' };
}

/** Where the lines came from — the book's brand badge (providedSources.ts, the
 *  same monogram treatment the site's source dropdown uses) or our own mark
 *  for the computed median fallback. */
export function linesBrand(leans: DailyLean[]): {
  monogram: string;
  bg: string;
  fg: string;
  label: string;
} {
  const source = leans[0]?.linesSource ?? null;
  if (!source) return { monogram: 'FF', bg: '#ea580c', fg: '#ffffff', label: 'FantasyFire' };
  const brand = sourceBrand(source);
  return { ...brand, label: sourceLabel(source) };
}

/** The source-attribution chip: the book's REAL favicon when we fetched one,
 *  else the brand monogram square — plus the book's name. `size` scales the
 *  badge; text sizes are passed by the layout. */
export function SourceChip({
  leans,
  logo,
  badgeSize,
  fontSize,
  labelSize,
}: {
  leans: DailyLean[];
  logo?: string | null;
  badgeSize: number;
  fontSize: number;
  labelSize: number;
}) {
  const brand = linesBrand(leans);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: badgeSize * 0.3 }}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- satori JSX, not the DOM
        <img
          alt=""
          src={logo}
          width={badgeSize}
          height={badgeSize}
          style={{
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize * 0.26,
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize * 0.26,
            fontSize,
            fontWeight: 800,
            background: brand.bg,
            color: brand.fg,
          }}
        >
          {brand.monogram}
        </div>
      )}
      <div style={{ display: 'flex', fontSize: labelSize, color: '#a8a29e' }}>{brand.label}</div>
    </div>
  );
}
