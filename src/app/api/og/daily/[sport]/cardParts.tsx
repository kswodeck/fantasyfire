// Shared pieces for the daily-card image routes (landscape + story) so the two
// layouts can't drift: the heat-read badge colors and the lines-source brand
// chip. Pure helpers + satori-compatible JSX; no route exports here (route
// files may only export handlers/config).
import { sourceBrand, sourceLabel } from '@/lib/providedSources';
import type { DailyLean } from '@/lib/server/social';
import { heatLabel } from '@/lib/tierStyle';

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
