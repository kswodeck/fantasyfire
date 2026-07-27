import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${SITE.name} handles your data — what our analytics collect, no accounts, as little as possible.`,
  alternates: { canonical: '/privacy' },
};

const LAST_UPDATED = 'July 26, 2026';

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: 'Privacy' }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-1 text-xs text-muted">Last updated: {LAST_UPDATED}</p>

      <Prose>
        <p>
          The short version: {SITE.name}{' '}collects as little as possible, never sells or
          rents your data, and does not require an account to browse. We use two analytics
          tools: a cookieless one (Umami) and Google Analytics, which{' '}
          <strong>does set cookies</strong> on your device — see{' '}
          <a href="#analytics">Analytics</a> and <a href="#cookies">Cookies</a> below.
        </p>

        <h2>Information we collect</h2>
        <p>
          Browsing {SITE.name}{' '}does not require you to create an account or provide
          personal details such as your name or email — there are no logins, so we hold no
          account-level personal data about you. If we introduce accounts or paid features
          in the future, we will update this policy to explain what is collected, and why,
          before those features go live.
        </p>

        <h2 id="analytics">Analytics</h2>
        <p>
          In production we use two analytics tools, and they behave differently:
        </p>
        <p>
          <strong>Umami</strong> (
          <a href="https://umami.is" target="_blank" rel="noopener noreferrer">
            umami.is
          </a>
          ) gives us aggregate usage — page views, referrers, and a few anonymous
          interaction counts. It is <strong>cookieless</strong>: it sets no cookies, stores
          nothing on your device, builds no cross-site profile, and does not identify you.
          IP addresses are <strong>not stored</strong> — they are used only momentarily, in
          memory, to estimate unique daily visits, then discarded.
        </p>
        <p>
          <strong>Google Analytics 4</strong> (
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google&rsquo;s privacy policy
          </a>
          ) gives us the deeper reports and the Search Console connection. Unlike Umami, it{' '}
          <strong>does set first-party cookies</strong> on your device (named{' '}
          <code>_ga</code> and <code>_ga_&lt;id&gt;</code>) so that repeat visits can be
          recognised as the same browser, and it sends your IP address, page URL, referrer,
          and device/browser details to Google, which acts as our analytics provider. Google
          may process this data on servers outside your country. We have{' '}
          <strong>not</strong> enabled Google Signals, ad personalisation, or Google Ads
          data sharing, and we do not run advertising or ad pixels on the site.
        </p>
        <p>
          You can opt out of Google Analytics on every site using Google&rsquo;s{' '}
          <a
            href="https://tools.google.com/dlpage/gaoptout"
            target="_blank"
            rel="noopener noreferrer"
          >
            browser opt-out add-on
          </a>
          , or block or clear these cookies in your browser settings — the site works
          exactly the same either way. Clearing cookies also clears them here.
        </p>

        <h2 id="cookies">Cookies</h2>
        <p>
          We use cookies only for the Google Analytics measurement described above. We set
          no advertising cookies, and we do not use cookies to build a profile of you or to
          track you across other websites. Blocking them does not affect any feature of the
          site.
        </p>

        <h2>Information handled automatically</h2>
        <p>
          Like any website, our hosting and infrastructure providers process basic technical
          data needed to deliver and secure the site — such as your IP address and browser
          type in standard server logs. This is used to operate the Service and prevent
          abuse, and is retained only as long as needed for those purposes.
        </p>

        <h2>Service providers</h2>
        <p>
          We rely on a small set of providers to run the site. Each handles data under its
          own privacy terms:
        </p>
        <ul>
          <li>
            <strong>Vercel</strong> — application hosting and content delivery (
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              privacy
            </a>
            ).
          </li>
          <li>
            <strong>Supabase</strong> — the database storing public sports statistics (
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
              privacy
            </a>
            ).
          </li>
          <li>
            <strong>Umami Cloud</strong> — cookieless analytics (
            <a href="https://umami.is/privacy" target="_blank" rel="noopener noreferrer">
              privacy
            </a>
            ).
          </li>
          <li>
            <strong>Google Analytics</strong> — cookie-based analytics; receives your IP
            address, page URLs, referrer and device details, and may process them outside
            your country (
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              privacy
            </a>
            ).
          </li>
          <li>
            <strong>GitHub</strong> — runs the scheduled job that pulls public game logs into
            the database (
            <a
              href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
              target="_blank"
              rel="noopener noreferrer"
            >
              privacy
            </a>
            ).
          </li>
          <li>
            <strong>League content networks</strong> — player headshots and team logos load
            directly in your browser from the NBA&rsquo;s, MLB&rsquo;s, and ESPN&rsquo;s CDNs
            (NFL data and images come from ESPN) (
            <a href="https://www.nba.com/privacy-policy" target="_blank" rel="noopener noreferrer">
              NBA
            </a>
            ,{' '}
            <a
              href="https://www.mlb.com/official-information/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              MLB
            </a>
            ,{' '}
            <a
              href="https://www.espn.com/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              ESPN
            </a>
            ).
          </li>
        </ul>

        <h2>Your privacy rights</h2>
        <p>
          You can ask what personal data relates to you and request its deletion at any time
          by emailing <a href={`mailto:${SITE.email}`}>{SITE.email}</a>; we aim to respond
          within 30 days. Because there are no accounts, we hold little personal data tied
          to you: our own records are aggregate and non-identifying, and the identifiers
          Google Analytics sets live in your browser&rsquo;s cookies, which you can clear or
          block at any time (see <a href="#analytics">Analytics</a>). This covers the access
          and deletion rights provided under laws such as the EU/UK GDPR and
          California&rsquo;s CCPA/CPRA.
        </p>

        <h2>Children</h2>
        <p>
          {SITE.name}{' '}is intended for adults and is not directed to children. Please see{' '}
          <Link href="/responsible-gaming">responsible gaming</Link>.
        </p>

        <h2>Changes</h2>
        <p>
          We may update this policy as the product evolves; we&rsquo;ll revise the
          &ldquo;last updated&rdquo; date above when we do.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about privacy, or a data request? Email{' '}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
        </p>
      </Prose>
    </div>
  );
}
