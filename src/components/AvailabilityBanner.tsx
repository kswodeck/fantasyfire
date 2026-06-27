import type { PlayerAvailability } from '@/lib/types';
import { formatIsoDate } from '@/lib/format';

const STATUS_LABEL: Record<PlayerAvailability['status'], string> = {
  out: 'Out',
  doubtful: 'Doubtful',
  questionable: 'Questionable',
  'day-to-day': 'Day-to-day',
};

/**
 * Injury / availability banner (idea #5). Leads with the finest status we have
 * (GTD / Probable / IL tier), the actual injury, and — for players who are out — the
 * estimated return, plus the latest beat-writer note. For an "Out" player it gates the
 * read; the game-time tiers are a caution to confirm. Presentational only.
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
  // Prefer the finer fantasy designation (GTD / 15-Day IL) over the coarse bucket.
  const label = availability.fantasyStatus || STATUS_LABEL[availability.status];
  // A real return timeline is meaningful for players who are out; for game-time tiers
  // ESPN's date is usually a season placeholder, so skip it there.
  const showReturn = out && availability.returnDate;
  const note = availability.news || availability.comment;

  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-1 rounded-xl border border-line bg-surface p-3 text-sm"
    >
      <div>
        <span className={`font-semibold ${accent}`}>{label}</span>
        {availability.detail && <span className="text-muted"> · {availability.detail}</span>}
        <span className="text-muted">
          {out
            ? ` — ${playerName} isn't expected to play. The read below describes past games only.`
            : ` — confirm ${playerName}'s status before the game.`}
        </span>
        {showReturn && (
          <span className="text-muted"> Est. return {formatIsoDate(availability.returnDate!)}.</span>
        )}
      </div>
      {note && <p className="line-clamp-3 text-xs text-muted">{note}</p>}
    </div>
  );
}
