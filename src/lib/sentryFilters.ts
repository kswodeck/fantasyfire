// Client-side Sentry noise filters (used by src/instrumentation-client.ts).
//
// Errors whose stack points INTO a third-party script we load but don't own. They
// can't be fixed in this codebase, and as "unhandled" issues they bury real app
// errors. Matched against the event's top frame URL; each pattern matches both the
// raw URL and the `app:///…` form the Next SDK rewrites every frame origin to.
//
// SENTRY-FANTASYFIRE-APP-G: Vercel Speed Insights, which Vercel serves first-party at
// a hashed path (`/<16 hex>/script.js`, from NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_
// CONFIG), failed to PARSE on a handful of clients — "SyntaxError: Invalid or
// unexpected token" at 1:2. The same URL serves valid JS (plain and brotli) here, so
// the body was mangled in transit (a proxy/middlebox); the only loss is that
// visitor's vitals.
export const THIRD_PARTY_SCRIPT_URLS: RegExp[] = [
  // Vercel Speed Insights / Web Analytics, first-party-proxied at a hashed path…
  /\/[0-9a-f]{16}\/script(\.debug)?\.js/,
  // …or the older fixed paths / CDN.
  /\/_vercel\/(speed-)?insights\//,
  /va\.vercel-scripts\.com\//,
  // Analytics tags (Analytics.tsx).
  /cloud\.umami\.is\//,
  /googletagmanager\.com\//,
  /google-analytics\.com\//,
  // Browser extensions injecting into the page.
  /^(chrome|moz|safari(-web)?)-extension:\/\//,
];
