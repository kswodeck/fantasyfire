import { SPORTS, type Sport } from '@/lib/sports';

/**
 * Tiny league chip (NBA / MLB / NFL) tinted with the sport's accent — the per-row
 * sport identifier shown on the cross-sport ("All Sports") board and trends, where
 * rows from different leagues are interleaved. Presentational.
 */
export function SportTag({
  sport,
  className = '',
}: {
  sport: Sport;
  className?: string;
}) {
  const cfg = SPORTS[sport];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1 py-0.5 text-[10px] font-bold leading-none ${className}`}
      // light-dark(): the 700-level accent fails AA as text on the dark theme,
      // so dark mode swaps to the 400-level accent. 1a = ~10% alpha tint.
      style={{
        color: `light-dark(${cfg.accent}, ${cfg.accentDark})`,
        backgroundColor: `${cfg.accent}1a`,
      }}
      title={cfg.name}
    >
      {cfg.name}
    </span>
  );
}
