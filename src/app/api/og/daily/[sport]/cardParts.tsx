// Shared pieces for the daily-card image routes (landscape + story) so the two
// layouts can't drift: the heat-read badge colors, the lines-source brand
// chip, player headshot fetching, and the ET date label. Pure helpers +
// satori-compatible JSX; no route exports here (route files may only export
// handlers/config).
import { sourceBrand, sourceLabel } from '@/lib/providedSources';
import type { DailyLean } from '@/lib/server/social';
import { socialDayIso } from '@/lib/social/schedule';
import { playerHeadshotUrl } from '@/lib/teams';
import { heatLabel } from '@/lib/tierStyle';
import type { Sport } from '@/lib/sports';

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
 * Official player headshots as data URIs, keyed by slug. Fetched server-side
 * BEFORE rendering because a satori <img> pointing at a remote URL fails the
 * whole render if the CDN hiccups — a missing entry here just falls back to
 * the initials circle. Best-effort with a short timeout; never throws.
 */
export async function leanHeadshots(
  sport: Sport,
  leans: DailyLean[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    leans.map(async (l) => {
      if (!l.playerExternalId) return;
      try {
        const res = await fetch(playerHeadshotUrl(sport, l.playerExternalId, 'sm'), {
          signal: AbortSignal.timeout(2500),
        });
        if (!res.ok) return;
        const type = res.headers.get('content-type') ?? 'image/png';
        if (!type.startsWith('image/')) return;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 100) return; // placeholder/empty responses
        out[l.slug] = `data:${type};base64,${buf.toString('base64')}`;
      } catch {
        /* CDN miss — the initials fallback renders instead */
      }
    }),
  );
  return out;
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
  if (!source) return { monogram: 'FF', bg: '#ea580c', fg: '#ffffff', label: 'FantasyFire lines' };
  const brand = sourceBrand(source);
  return { ...brand, label: `${sourceLabel(source)} lines` };
}

/** The source-attribution chip: brand monogram square + muted label. `size`
 *  scales the badge; text sizes are passed by the layout. */
export function SourceChip({
  leans,
  badgeSize,
  fontSize,
  labelSize,
}: {
  leans: DailyLean[];
  badgeSize: number;
  fontSize: number;
  labelSize: number;
}) {
  const brand = linesBrand(leans);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: badgeSize * 0.3 }}>
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
      <div style={{ display: 'flex', fontSize: labelSize, color: '#a8a29e' }}>{brand.label}</div>
    </div>
  );
}
