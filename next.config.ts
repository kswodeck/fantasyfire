import type { NextConfig } from 'next';

// Build the Content-Security-Policy. Static (not nonce-based) on purpose: a nonce
// CSP forces every page to dynamic rendering in Next 16, which would gut the
// static/ISR SEO pages. 'unsafe-inline' is an accepted tradeoff here — the only
// inline scripts are the trusted JSON-LD we generate, and there is no
// user-generated content, no auth, and no cookies, so XSS blast radius is minimal.
//
// Allowlist notes:
//   - script/connect cloud.umami.is + the Umami beacon gateway  -> analytics
//   - script www.googletagmanager.com                           -> GA4 (gtag.js)
//   - connect/img *.google-analytics.com, *.analytics.google.com-> the GA4 collector.
//     Wildcards are required, NOT decoration: GA4 posts hits to a REGIONAL host
//     (region1.google-analytics.com, …) chosen at runtime, so a bare
//     www.google-analytics.com entry silently drops most traffic. img-src is the
//     no-beacon/older-browser fallback path.
//   - img cdn.nba.com / *.mlbstatic.com / a.espncdn.com         -> player/team art
//     (a.espncdn.com serves the NFL headshots + team logos)
//   - img icons.duckduckgo.com                                  -> book/source logos
//     (each book's own favicon via DuckDuckGo's privacy-respecting icon proxy)
const isDev = process.env.NODE_ENV !== 'production';

function contentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      'https://cloud.umami.is',
      'https://www.googletagmanager.com',
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://cdn.nba.com',
      'https://midfield.mlbstatic.com',
      'https://www.mlbstatic.com',
      'https://a.espncdn.com',
      'https://icons.duckduckgo.com',
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://*.google-analytics.com',
    ],
    'font-src': ["'self'"],
    'connect-src': [
      "'self'",
      'https://cloud.umami.is',
      'https://api-gateway.umami.dev',
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://*.google-analytics.com',
      'https://*.analytics.google.com',
    ],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  // `next dev` (React Refresh / HMR) needs eval and a dev websocket; never ship these.
  if (isDev) {
    directives['script-src'].push("'unsafe-eval'");
    directives['connect-src'].push('ws:', 'wss:');
  }

  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`);
  // upgrade-insecure-requests would break http://localhost dev, so prod-only.
  if (!isDev) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

const HSTS = { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' };
const NOSNIFF = { key: 'X-Content-Type-Options', value: 'nosniff' };
const REFERRER = { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' };

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
  HSTS,
  NOSNIFF,
  REFERRER,
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
];

// The /embed widget is MEANT to be iframed by third parties, so it opts out of the
// site-wide frame ban: no X-Frame-Options, and a minimal CSP with `frame-ancestors *`.
// It loads no scripts and no external resources (inline styles + inline SVG only),
// so the surface stays tiny.
const embedHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors *",
  },
  HSTS,
  NOSNIFF,
  REFERRER,
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      // /embed gets framing-friendly headers…
      { source: '/embed/:path*', headers: embedHeaders },
      // …everything else keeps the strict, frame-banning set.
      { source: '/((?!embed/).*)', headers: securityHeaders },
      // The service worker must never be served stale — a cached sw.js pins
      // users to old precache lists until the HTTP cache expires.
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      // Icons are stable, unfingerprinted assets — let browsers/CDN hold them a
      // day and serve stale for a week while revalidating.
      {
        source: '/icons/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // /[sport]/board merged into the sport home — the hub was a near-copy of the
      // Heat Check, so the sport home IS the board now. Permanent to preserve SEO.
      // (/board — the cross-sport Heat Check — is a single segment and never matches.)
      { source: '/:sport/board', destination: '/:sport', permanent: true },
      // /[sport]/today merged into the board (now the sport home), which has a
      // "today's slate" toggle. Straight to the final URL — no double hop.
      { source: '/:sport/today', destination: '/:sport', permanent: true },
      // /[sport]/streaks merged into Trends (each row now shows the current streak
      // alongside the L10 swing). Permanent redirect to preserve SEO.
      { source: '/:sport/streaks', destination: '/:sport/trends', permanent: true },
      // Junk root paths like /& and /$ that Search Console surfaced as 404s. The
      // site never emits these — they're external mis-links (social/scraper URL
      // parsers grabbing a trailing `&`/`$` off a shared link). They already 404
      // (dynamicParams=false on /[sport]), but a 301 to home clears them from the
      // index and lands any stray visitor somewhere real. Scoped to a single
      // segment that is exactly one of those chars, so no real slug can match.
      { source: '/:junk([&$])', destination: '/', permanent: true },
    ];
  },
};

export default nextConfig;
