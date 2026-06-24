// Client-side cookieless analytics event helper (Umami).
//
// A no-op until the Umami script has loaded and defined `window.umami` (so when
// analytics is disabled, calls drop silently). Safe to import anywhere; only does
// anything in the browser. We send a handful of funnel events (stat_switched,
// line_entered, fairprice_used) so we can learn what actually drives return
// visits — page views are captured automatically by the script.

type EventProps = Record<string, string | number | boolean>;

interface Umami {
  track: (event: string, data?: EventProps) => void;
}

declare global {
  interface Window {
    umami?: Umami;
  }
}

/** Record a custom analytics event. No-op when analytics is disabled. */
export function track(event: string, props?: EventProps): void {
  if (typeof window === 'undefined') return;
  window.umami?.track(event, props);
}
