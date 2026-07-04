'use client';

import { useEffect, useRef, useState } from 'react';
import { sourceBrand, sourceLabel, sourceLogoUrl } from '@/lib/providedSources';

/**
 * Small square logo for a line/odds source (PrizePicks, Underdog, Sleeper, …). Shows
 * the book's real logo (its own favicon, via DuckDuckGo's privacy-respecting icon
 * proxy — see sourceLogoUrl) and falls back to a brand-colored monogram badge if the
 * logo can't load or the source's domain is unknown.
 *
 * The monogram is the BASE layer; the image is overlaid and revealed only once it
 * actually loads, so a slow/failed logo never flashes a broken-image icon (the
 * load-before-hydration case is handled in an effect). Decorative by default (the
 * source name is shown alongside it); pass `title` for standalone use.
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
  const logoUrl = sourceLogoUrl(source);
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
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- tiny external brand mark; next/image adds no value
        <img
          ref={ref}
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain"
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth > 0) setLoaded(true);
          }}
        />
      )}
    </span>
  );
}
