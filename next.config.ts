import type { NextConfig } from 'next';

// Build the Content-Security-Policy. Static (not nonce-based) on purpose: a nonce
// CSP forces every page to dynamic rendering in Next 16, which would gut the
// static/ISR SEO pages. 'unsafe-inline' is an accepted tradeoff here — the only
// inline scripts are the trusted JSON-LD we generate, and there is no
// user-generated content, no auth, and no cookies, so XSS blast radius is minimal.
//
// Allowlist notes:
//   - script/connect cloud.umami.is + the Umami beacon gateway  -> analytics
//   - img cdn.nba.com / *.mlbstatic.com / a.espncdn.com         -> player/team art
//     (a.espncdn.com serves the NFL headshots + team logos)
const isDev = process.env.NODE_ENV !== 'production';

function contentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", 'https://cloud.umami.is'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://cdn.nba.com',
      'https://midfield.mlbstatic.com',
      'https://www.mlbstatic.com',
      'https://a.espncdn.com',
    ],
    'font-src': ["'self'"],
    'connect-src': ["'self'", 'https://cloud.umami.is', 'https://api-gateway.umami.dev'],
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

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
