import { SpeedInsights as VercelSpeedInsights } from '@vercel/speed-insights/next';

/**
 * Vercel Speed Insights — real-user Core Web Vitals (a ranking input), first-party
 * and privacy-friendly (no cookies, no PII), so it adds nothing to the site's
 * consent surface. (The GA4 tag in Analytics.tsx is the one that DOES set cookies —
 * see /privacy.)
 *
 * Gated to the production deployment like Analytics, so local dev / Vercel preview
 * traffic doesn't pollute the field data (and we don't ship the script there). The
 * reporting endpoint (/_vercel/speed-insights/*) only exists on Vercel anyway.
 */
export function SpeedInsights() {
  const onProduction = (process.env.VERCEL_ENV ?? process.env.NODE_ENV) === 'production';
  if (!onProduction) return null;
  return <VercelSpeedInsights />;
}
