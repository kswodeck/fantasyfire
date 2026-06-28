import type { PlayerAvailability } from '@/lib/types';
import { formatIsoDate } from '@/lib/format';
import { injuryDesignation } from '@/lib/injury';
import { InjuryBadge } from './InjuryBadge';

/**
 * Injury / availability section (idea #5) on the player page. Leads with the finest
 * designation we have (GTD / Probable / IL tier) as a labeled badge, then the full
 * detail: the exact injury, the expected return, and the latest beat-writer note. For
 * an "Out" player it also gates the read (the read below describes past games only).
 * Presentational.
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
  const { label } = injuryDesignation(availability);
  // A real return timeline is meaningful for players who are out; for game-time tiers
  // ESPN's date is usually a season placeholder, so skip it there.
  const showReturn = out && availability.returnDate;
  const note = availability.news || availability.comment;

  return (
    <section
      aria-label={`${playerName} injury report`}
      role="status"
      className="mb-4 rounded-xl border border-line bg-surface p-3 text-sm"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <InjuryBadge injury={availability} />
        <span className={`font-semibold ${accent}`}>{label}</span>
        <span className="text-xs text-muted">
          {out
            ? `${playerName} isn't expected to play — the read below describes past games only.`
            : `Confirm ${playerName}'s status before the game.`}
        </span>
      </div>

      <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
        {availability.detail && (
          <div className="flex gap-1">
            <dt className="text-muted">Injury:</dt>
            <dd className="font-medium">{availability.detail}</dd>
          </div>
        )}
        {showReturn && (
          <div className="flex gap-1">
            <dt className="text-muted">Est. return:</dt>
            <dd className="font-medium">{formatIsoDate(availability.returnDate!)}</dd>
          </div>
        )}
      </dl>

      {note && <p className="mt-1.5 line-clamp-3 text-xs text-muted">{note}</p>}
    </section>
  );
}
