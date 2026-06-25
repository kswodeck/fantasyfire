/**
 * A small directional arrow for a prop side: ↑ for over, ↓ for under. Stroked
 * with currentColor so it takes the over/under tint of whatever it sits in.
 * Used in the compact Playbook chips where an "O"/"U" letter read cramped.
 */
const PATHS = {
  over: 'M8 13V3M4 7l4-4 4 4',
  under: 'M8 3v10M4 9l4 4 4-4',
} as const;

export function SideArrow({
  side,
  size = 11,
  className = '',
}: {
  side: 'over' | 'under';
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
      role="img"
      aria-label={side === 'over' ? 'over' : 'under'}
    >
      <path d={PATHS[side]} />
    </svg>
  );
}
