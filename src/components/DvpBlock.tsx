import type { DvpCell } from '@/lib/stats';
import { STAT_DEFS } from '@/lib/stats';
import { num1, ordinal, formatIsoDate } from '@/lib/format';
import { getTeam } from '@/lib/teams';
import type { Sport } from '@/lib/sports';
import { TeamLogo } from './TeamLogo';

const POS_LABEL: Record<string, string> = {
  G: 'guards',
  F: 'forwards',
  C: 'centers',
  QB: 'quarterbacks',
  RB: 'running backs',
  WR: 'wide receivers',
  TE: 'tight ends',
};

/**
 * Matchup block for the player's most-recent opponent: rank, raw average
 * allowed, and a low-sample flag — tinted in the opponent's team color, with
 * their logo and the game date. NBA/NFL = defense-vs-position; MLB = the opposing
 * pitching staff's allowed rate. Coarse on purpose — sample size is surfaced.
 */
export function DvpBlock({
  dvp,
  opponentAbbreviation,
  opponentExternalId,
  matchupDate,
  isHome,
  sport,
}: {
  dvp: DvpCell | null;
  opponentAbbreviation: string | null;
  opponentExternalId: number | null;
  matchupDate: string | null;
  isHome: boolean | null;
  sport: Sport;
}) {
  if (!dvp || !opponentAbbreviation) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
        No matchup data for this prop yet.
      </div>
    );
  }

  const team = getTeam(sport, opponentAbbreviation);
  const short = STAT_DEFS[dvp.stat].short;
  // Whom the average is allowed to.
  const unit = sport === 'mlb' ? 'hitters' : (POS_LABEL[dvp.posBucket] ?? 'this position');
  const allower = sport === 'mlb' ? `${opponentAbbreviation} pitching` : opponentAbbreviation;
  // Softness: low rank number = allows the most = softer matchup.
  const softness = dvp.rank / dvp.totalRanked;
  const tone =
    softness <= 1 / 3
      ? { label: 'Favorable', cls: 'text-over' }
      : softness >= 2 / 3
        ? { label: 'Tough', cls: 'text-under' }
        : { label: 'Neutral', cls: 'text-muted' };

  return (
    <div
      className="overflow-hidden rounded-xl border border-line p-4"
      style={{
        background: `linear-gradient(120deg, color-mix(in srgb, ${team.primary} 16%, var(--surface)) 0%, var(--surface) 62%)`,
        borderTop: `2px solid ${team.primary}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-muted">
          <TeamLogo
            sport={sport}
            externalId={opponentExternalId}
            abbr={opponentAbbreviation}
            size={18}
          />
          Matchup — {isHome ? 'vs' : '@'} {opponentAbbreviation}
        </h3>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          {matchupDate && <span className="text-muted">{formatIsoDate(matchupDate)}</span>}
          <span className={`font-semibold ${tone.cls}`}>{tone.label}</span>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{ordinal(dvp.rank)}</span>
        <span className="text-sm text-muted">
          of {dvp.totalRanked} in {short} allowed to {unit}
        </span>
      </div>

      <p className="mt-1 text-sm text-muted">
        {allower} allows{' '}
        <span className="font-medium text-foreground tabular-nums">
          {num1(dvp.avgAllowed)} {short}
        </span>{' '}
        per game to {unit} (rank 1 = allows the most).
      </p>

      <p className="mt-2 text-xs text-muted">
        Sample: {dvp.sampleSize} {sport === 'mlb' ? 'games' : 'player-games'}
        {dvp.lowSample && (
          <span className="ml-1 rounded bg-surface-warn px-1.5 py-0.5 font-medium text-conf-med">
            low sample — interpret with caution
          </span>
        )}
      </p>
    </div>
  );
}
