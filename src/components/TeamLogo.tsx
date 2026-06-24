import { getTeam, teamLogoUrl } from '@/lib/teams';

/** Official NBA team logo (SVG by TEAM_ID). Renders nothing for unknown teams. */
export function TeamLogo({
  abbr,
  size = 18,
  className,
}: {
  abbr: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const team = getTeam(abbr);
  if (!team.nbaId) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={teamLogoUrl(team.nbaId)}
      alt={`${team.fullName} logo`}
      width={size}
      height={size}
      loading="lazy"
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}
