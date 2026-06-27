import type { PlayerAvailability } from '@/lib/types';

const STATUS_LABEL: Record<PlayerAvailability['status'], string> = {
  out: 'Out',
  doubtful: 'Doubtful',
  questionable: 'Questionable',
  'day-to-day': 'Day-to-day',
};

/**
 * Injury / availability banner (idea #5). For an "Out" player it gates the read —
 * the numbers below describe past games, not a player who's taking the field. The
 * game-time-decision tiers are a caution to confirm status. Presentational only.
 */
export function AvailabilityBanner({
  availability,
  playerName,
}: {
  availability: PlayerAvailability;
  playerName: string;
}) {
  const out = availability.status === 'out';
  const accent = out ? 'text-under' : 'text-heat-2';
  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-1 rounded-xl border border-line bg-surface p-3 text-sm"
    >
      <div>
        <span className={`font-semibold ${accent}`}>
          {STATUS_LABEL[availability.status]}
          {availability.detail ? ` · ${availability.detail}` : ''}
        </span>
        <span className="text-muted">
          {out
            ? ` — ${playerName} isn't expected to play. The read below describes past games only.`
            : ` — confirm ${playerName}'s status before the game.`}
        </span>
      </div>
      {availability.comment && (
        <p className="text-xs text-muted">{availability.comment}</p>
      )}
    </div>
  );
}
