import { getTeam, teamLogoUrl } from '@/lib/teams';
import type { Sport } from '@/lib/sports';

/** Official team logo (SVG by external TEAM_ID). Renders nothing for unknown teams. */
export function TeamLogo({
  sport,
  externalId,
  abbr,
  size = 18,
  className,
}: {
  sport: Sport;
  externalId: number | null | undefined;
  abbr?: string | null;
  size?: number;
  className?: string;
}) {
  if (!externalId) return null;
  const team = getTeam(sport, abbr);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={teamLogoUrl(sport, externalId)}
      alt={`${team.fullName || abbr || 'Team'} logo`}
      width={size}
      height={size}
      loading="lazy"
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}
