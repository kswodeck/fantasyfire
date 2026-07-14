// Shared pieces for the daily-card image routes (landscape + story) so the two
// layouts can't drift: the heat-read badge colors, the lines-source brand
// chip, player headshot fetching, and the ET date label. Pure helpers +
// satori-compatible JSX; no route exports here (route files may only export
// handlers/config).
import { sourceBrand, sourceLabel, sourceLogoPngUrl } from '@/lib/providedSources';
import type { DailyLean } from '@/lib/server/social';
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
 *  the demon/goblin kind. Colored like the site's payout badges. */
export function payoutTag(l: DailyLean): { text: string; color: string } | null {
  if (l.multiplier != null && l.multiplier !== 1) {
    return {
      text: formatMultiplier(l.multiplier),
      color: PAYOUT_COLOR[l.oddsType ?? ''] ?? '#a8a29e',
    };
  }
  if (l.oddsType && PAYOUT_COLOR[l.oddsType]) {
    return { text: l.oddsType, color: PAYOUT_COLOR[l.oddsType] };
  }
  return null;
}

/** Team display bits for a lean row: abbr in the team's brand color + logo key. */
export function teamStyle(sport: Sport, l: DailyLean): { color: string } {
  return { color: getTeam(sport, l.teamAbbreviation).primary };
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
