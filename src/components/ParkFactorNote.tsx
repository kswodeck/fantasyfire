import { parkFor, type ParkTilt } from '@/lib/stats';

const TILT_COPY: Record<ParkTilt, { label: string; cls: string }> = {
  hitter: { label: 'hitter-friendly', cls: 'text-over' },
  pitcher: { label: 'pitcher-friendly', cls: 'text-under' },
  neutral: { label: 'neutral', cls: 'text-muted' },
};

/** ×1.16 etc. — a factor as a signed-ish multiplier label. */
function factorLabel(f: number): string {
  return `×${f.toFixed(2)}`;
}

/**
 * Home-park context for an MLB player (their own team's park, which applies to
 * roughly half their games). Shown as MATCHUP CONTEXT — it is not folded into the
 * hit-rate math (a player's log already reflects the parks they played in).
 * Renders nothing for unknown teams or non-MLB players (caller-gated).
 */
export function ParkFactorNote({
  teamExternalId,
  teamName,
  context = 'player',
}: {
  teamExternalId: number | null;
  teamName: string | null;
  /** 'player' = the player's own home park; 'game' = the venue this matchup is played at. */
  context?: 'player' | 'game';
}) {
  const park = parkFor(teamExternalId);
  if (!park) return null;
  const tilt = TILT_COPY[park.tilt];

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold">{context === 'game' ? 'Ballpark' : 'Home park'}</h3>
      <p className="mt-1 text-sm">
        <span className="font-medium">{park.name}</span>
        {teamName ? <span className="text-muted"> · {teamName}</span> : null}
      </p>
      <p className="mt-2 text-sm">
        <span className={`font-medium ${tilt.cls}`}>{tilt.label}</span>{' '}
        <span className="tabular-nums text-muted">
          (runs {factorLabel(park.runs)}, HR {factorLabel(park.hr)})
        </span>
      </p>
      <p className="mt-2 text-xs text-muted">
        {context === 'game'
          ? 'Where this game is played. Park factors describe run/HR scoring vs an average park — not folded into the reads above.'
          : "Park context for this player's home games. Not folded into the hit rates above — those already reflect the parks they've played in."}
      </p>
    </div>
  );
}
