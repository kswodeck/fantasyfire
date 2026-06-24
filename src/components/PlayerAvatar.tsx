'use client';

import { useState } from 'react';
import { playerHeadshotUrl } from '@/lib/teams';
import type { Sport } from '@/lib/sports';

/**
 * Official league headshot (by external id), cropped to a circle. Falls back to
 * the player's initials if the image fails to load. Uses a plain <img> (remote
 * CDN + onError fallback; next/image would need remotePatterns and can't onError).
 */
export function PlayerAvatar({
  sport,
  externalId,
  name,
  size = 44,
  ring,
}: {
  sport: Sport;
  externalId: number;
  name: string;
  size?: number;
  ring?: string;
}) {
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size, minWidth: size };
  const ringStyle = ring ? { boxShadow: `0 0 0 2px ${ring}` } : undefined;

  if (failed || !externalId) {
    const initials = name
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-muted"
        style={{ ...dim, ...ringStyle, fontSize: size * 0.36 }}
        aria-hidden="true"
      >
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={playerHeadshotUrl(sport, externalId, size > 120 ? 'lg' : 'sm')}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-surface-2 object-cover"
      style={{ ...dim, ...ringStyle, objectPosition: 'center 18%' }}
    />
  );
}
