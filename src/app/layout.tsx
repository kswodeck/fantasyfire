import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Providers } from './providers';
import { Analytics } from '@/components/Analytics';
import { SpeedInsights } from '@/components/SpeedInsights';
import { InstallNudge } from '@/components/InstallNudge';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { SITE, absoluteUrl, activeSocials, twitterHandle } from '@/lib/site';

// Google Search Console "URL-prefix property → HTML tag" verification. Set the
// GOOGLE_SITE_VERIFICATION env var (the token from the meta tag GSC shows) to
// emit <meta name="google-site-verification">. Omitted when unset.
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim() || undefined;
const xHandle = twitterHandle();

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  // Only used inside the Embed modal — never above the fold, so skip the preload.
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: {
    canonical: '/',
    types: { 'application/rss+xml': [{ url: '/feed.xml', title: 'FantasyFire — Daily Hottest Props' }] },
  },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: SITE.url,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    ...(xHandle ? { site: xHandle, creator: xHandle } : {}),
  },
  ...(googleVerification ? { verification: { google: googleVerification } } : {}),
  robots: { index: true, follow: true },
  manifest: '/manifest.webmanifest',
  // iOS home-screen install: proper standalone treatment and app title (iOS
  // ignores most of the web manifest and reads these meta tags instead).
  appleWebApp: {
    capable: true,
    title: SITE.name,
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#ea580c',
  colorScheme: 'light dark',
};

// Site-wide Organization + WebSite identity (E-E-A-T / trust signal). Content is
// static and trusted (no user input), so a plain stringify is safe here.
const orgJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE.url}/#organization`,
      name: SITE.name,
      url: SITE.url,
      email: SITE.email,
      description: SITE.description,
      logo: absoluteUrl('/icons/icon-192.png'),
      // Only real, configured profiles — empty until handles are reserved.
      ...(activeSocials().length ? { sameAs: activeSocials().map((s) => s.url) } : {}),
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE.url}/#website`,
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      publisher: { '@id': `${SITE.url}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Warm up the player-art CDNs so the LCP headshot doesn't pay DNS+TLS
            setup on top of the download (hosts are already CSP img-src allowed). */}
        <link rel="preconnect" href="https://cdn.nba.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://a.espncdn.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://midfield.mlbstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://icons.duckduckgo.com" />
      </head>
      <body className="flex min-h-full flex-col">
        {/* Apply the saved theme before paint (no flash). With no saved choice the
            CSS color-scheme: light dark follows the OS automatically. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();",
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Providers>
          <SiteHeader />
          <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
          <SiteFooter />
          <InstallNudge />
        </Providers>
        <ServiceWorkerRegister />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
