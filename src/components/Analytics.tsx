import Script from 'next/script';

/**
 * Privacy-friendly, cookieless analytics (Plausible/Umami-compatible). OFF by
 * default — only renders when NEXT_PUBLIC_ANALYTICS_ENABLED=true AND a script
 * src + domain are configured. No third-party scripts otherwise.
 */
export function Analytics() {
  const enabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';
  const src = process.env.NEXT_PUBLIC_ANALYTICS_SRC;
  const domain = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;
  if (!enabled || !src || !domain) return null;

  return <Script defer data-domain={domain} src={src} strategy="afterInteractive" />;
}
