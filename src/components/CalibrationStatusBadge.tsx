import type { CalibrationStatus } from '@/lib/calibrationVerdict';

// experimental (grey) → developing (amber) → validated (green). The label is
// decided by the realized /accuracy track record, not hardcoded.
const STYLES: Record<CalibrationStatus, string> = {
  insufficient: 'bg-surface-2 text-muted',
  developing: 'bg-surface-warn text-foreground',
  validated: 'bg-over-soft text-over',
};
const LABELS: Record<CalibrationStatus, string> = {
  insufficient: 'experimental',
  developing: 'developing',
  validated: 'validated',
};

export function CalibrationStatusBadge({
  status,
  className = '',
}: {
  status: CalibrationStatus;
  className?: string;
}) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STYLES[status]} ${className}`}
    >
      {LABELS[status]}
    </span>
  );
}
