import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${SITE.name} handles your data — cookieless analytics, no accounts, as little as possible.`,
  alternates: { canonical: '/privacy' },
};

const LAST_UPDATED = 'June 24, 2026';

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
          The short version: {SITE.name}{' '}collects as little as possible, uses
          privacy-friendly analytics that set <strong>no cookies</strong>, and never sells
          or rents your data. Browsing the site does not require an account.
        </p>

        <h2>Information we collect</h2>
        <p>
          Browsing {SITE.name}{' '}does not require you to create an account or provide
          personal details such as your name or email — there are no logins, so we hold no
          account-level personal data about you. If we introduce accounts or paid features
          in the future, we will update this policy to explain what is collected, and why,
          before those features go live.
        </p>

        <h2>Analytics</h2>
        <p>
          In production we use{' '}
          <a href="https://umami.is" target="_blank" rel="noopener noreferrer">
            Umami
          </a>
          , a privacy-friendly analytics tool, to understand aggregate usage — page views,
          referrers, and a few anonymous interaction counts. It is{' '}
          <strong>cookieless</strong>: it sets no cookies, stores nothing on your device,
          builds no cross-site profile, and does not identify you. IP addresses are{' '}
          <strong>not stored</strong> — they are used only momentarily, in memory, to
          estimate unique daily visits, then discarded.
        </p>
        <p>
          Because nothing is stored on or read from your device and no personal profile is
          built, this processing rests on our legitimate interest in understanding how the
          site is used, and <strong>no cookie-consent banner is required</strong>. We do not
          run advertising, ad pixels, or cross-site trackers.
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
            <strong>Supabase</strong> — the database storing public NBA and MLB statistics (
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
            directly in your browser from the NBA&rsquo;s and MLB&rsquo;s CDNs (
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
            ).
          </li>
        </ul>

        <h2>Your privacy rights</h2>
        <p>
          You can ask what personal data relates to you and request its deletion at any time
          by emailing <a href={`mailto:${SITE.email}`}>{SITE.email}</a>; we aim to respond
          within 30 days. Because there are no accounts and our analytics are aggregate and
          non-identifying, in practice we hold little or no personal data tied to you. This
          covers the access and deletion rights provided under laws such as the EU/UK GDPR
          and California&rsquo;s CCPA/CPRA.
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
