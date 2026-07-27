import Script from 'next/script';

// Umami Cloud. The website id isn't secret (it ships in the page), so it's baked
// in and works on deploy with no env config. Override via env only to point at a
// different site or a self-hosted instance.
const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC || 'https://cloud.umami.is/script.js';
const UMAMI_WEBSITE_ID =
  process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || '052cb7d5-e1c7-4ec7-93c1-3033a40a6579';

/** GA4 measurement id — public by design (it ships in the page), same as Umami's.
 *  Override per-environment with NEXT_PUBLIC_GA_MEASUREMENT_ID. */
const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-TRK9V04018';

/**
 * Whether analytics should load at all: PRODUCTION ONLY, so local dev and Vercel
 * preview traffic never pollute the stats. NEXT_PUBLIC_ANALYTICS_ENABLED=true
 * forces it on elsewhere (e.g. to verify an install locally).
 */
function analyticsEnabled(): boolean {
  const onProduction = (process.env.VERCEL_ENV ?? process.env.NODE_ENV) === 'production';
  return onProduction || process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';
}

/**
 * Google Analytics 4 (gtag.js).
 *
 * NOTE: unlike Umami below, GA4 IS cookie-based — it writes `_ga` / `_ga_<id>`
 * first-party cookies to identify returning visitors. That's a privacy-policy and
 * (in the EU/UK) a consent-banner question, not just a script tag; see
 * /privacy and the notes in docs/MARKETING.md before assuming the site is still
 * "cookieless".
 *
 * The loader is `afterInteractive` (next/script's default) so it never blocks
 * first paint, and the bootstrap is an inline script — which per the Next docs
 * MUST carry an `id` for Next to track it. Both googletagmanager.com and the
 * google-analytics.com collector are allowlisted in the CSP (next.config.ts);
 * without those entries every request here is blocked.
 */
function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
      </Script>
    </>
  );
}

/**
 * Site analytics. Two providers, deliberately:
 *  - Umami — cookieless, the aggregate day-to-day numbers.
 *  - GA4   — Search Console / Google Ads integration and the deeper reports.
 *
 * Page views are automatic on both; custom funnel events (stat_switched,
 * line_entered, fairprice_used) fire through window.umami — see src/lib/analytics.ts.
 */
export function Analytics() {
  if (!analyticsEnabled()) return null;

  return (
    <>
      <Script src={UMAMI_SRC} data-website-id={UMAMI_WEBSITE_ID} strategy="afterInteractive" />
      <GoogleAnalytics />
    </>
  );
}
