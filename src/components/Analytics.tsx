import Script from 'next/script';

// Umami Cloud. The website id isn't secret (it ships in the page), so it's baked
// in and works on deploy with no env config. Override via env only to point at a
// different site or a self-hosted instance.
const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC || 'https://cloud.umami.is/script.js';
const UMAMI_WEBSITE_ID =
  process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || '052cb7d5-e1c7-4ec7-93c1-3033a40a6579';

/**
 * Cookieless analytics by Umami. Loads ONLY on the production deployment, so
 * local dev and Vercel preview traffic don't pollute the stats. Set
 * NEXT_PUBLIC_ANALYTICS_ENABLED=true to force it on elsewhere (e.g. to verify
 * the install locally).
 *
 * Page views are automatic; custom funnel events (stat_switched, line_entered,
 * fairprice_used) fire through window.umami — see src/lib/analytics.ts.
 */
export function Analytics() {
  const onProduction = (process.env.VERCEL_ENV ?? process.env.NODE_ENV) === 'production';
  const forced = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';
  if (!onProduction && !forced) return null;

  return <Script src={UMAMI_SRC} data-website-id={UMAMI_WEBSITE_ID} strategy="afterInteractive" />;
}
