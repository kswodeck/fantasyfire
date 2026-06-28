import { injuryDesignation, injuryTooltip, type InjuryLike } from '@/lib/injury';

const TONE_CLASS = {
  out: 'text-under',
  caution: 'text-heat-2',
  clear: 'text-muted',
} as const;

/**
 * Small abbreviated injury label (Q / D / GTD / P / OUT / IL …) for a player row or
 * card. The full designation, exact injury, and expected return are in the native
 * `title` tooltip on hover. Presentational and server-renderable (no hooks); renders
 * nothing extra when the player has no injury — callers can pass freely.
 */
export function InjuryBadge({
  injury,
  className = '',
}: {
  injury: InjuryLike | null | undefined;
  className?: string;
}) {
  if (!injury) return null;
  const { abbr, label, tone } = injuryDesignation(injury);
  return (
    <span
      title={injuryTooltip(injury)}
      aria-label={`Injury status: ${injuryTooltip(injury)}`}
      className={`inline-flex shrink-0 items-center rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold leading-none ${TONE_CLASS[tone]} ${className}`}
    >
      <span aria-hidden>{abbr}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
