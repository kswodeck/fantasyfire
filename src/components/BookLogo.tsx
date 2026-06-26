'use client';

import { useEffect, useRef, useState } from 'react';
import { sourceBrand, sourceLabel } from '@/lib/providedSources';

/**
 * Small square logo for a line/odds source (PrizePicks, Underdog, Sleeper, …). Shows
 * the real book logo when artwork exists at `public/books/<id>.svg`; otherwise falls
 * back to a brand-colored monogram badge.
 *
 * Book logos are supplied as local files because no feed provides them — RotoWire's
 * API carries TEAM logos only, and the books' marks are trademarked — so drop an
 * official SVG named by source id (e.g. public/books/prizepicks.svg) to light one up.
 *
 * The monogram is the BASE layer; the image is overlaid and revealed only once it
 * actually loads, so a missing file never flashes a broken-image icon (and the
 * already-complete-before-hydration case is handled in an effect). Decorative by
 * default (the source name is shown alongside it); pass `title` for standalone use.
 */
export function BookLogo({
  source,
  size = 18,
  className,
  title,
}: {
  source: string;
  /** Badge edge length in px. */
  size?: number;
  className?: string;
  /** Accessible label. Omit when an adjacent text label already names the source. */
  title?: string;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  // Catch a logo that finished loading before React hydrated (onLoad would be missed).
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);

  const { monogram, bg, fg } = sourceBrand(source);
  const label = title ?? sourceLabel(source);
  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      title={label}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded font-bold leading-none ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        background: loaded ? 'transparent' : bg,
        color: fg,
        fontSize: Math.round(size * 0.42),
        letterSpacing: '-0.02em',
      }}
    >
      {!loaded && monogram}
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny local brand mark; next/image adds no value */}
      <img
        ref={ref}
        src={`/books/${source}.svg`}
        alt=""
        width={size}
        height={size}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth > 0) setLoaded(true);
        }}
      />
    </span>
  );
}
