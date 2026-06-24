import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${SITE.name} handles your data — we collect as little as possible.`,
  alternates: { canonical: '/privacy' },
};

const LAST_UPDATED = 'June 23, 2026';

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
          The short version: {SITE.name} collects as little as possible, and we do not
          sell or rent your data. Browsing the site does not currently require an account.
        </p>

        <h2>Information we collect</h2>
        <p>
          Today, browsing {SITE.name} does not require you to create an account or provide
          personal details such as your name or email. If we introduce accounts or paid
          features in the future, we will update this policy to explain what is collected
          and why before those features go live.
        </p>

        <h2>Analytics</h2>
        <p>
          Analytics are <strong>off by default</strong>. If enabled, we use a
          privacy-friendly, cookieless analytics tool that reports only aggregate traffic
          (e.g. page views and referrers) and does not track or identify individuals
          across sites.
        </p>

        <h2>Information handled automatically</h2>
        <p>
          Like any website, our hosting and infrastructure providers process basic
          technical data needed to deliver and secure the site — such as your IP address
          and browser type in standard server logs. This is used to operate the service
          and prevent abuse, and is retained only as long as needed for those purposes.
        </p>

        <h2>Service providers</h2>
        <ul>
          <li><strong>Vercel</strong> — application hosting and delivery.</li>
          <li><strong>Supabase</strong> — the database storing public NBA and MLB statistics.</li>
          <li>
            <strong>League CDNs</strong> — player headshots and team logos are loaded
            directly by your browser from the NBA&rsquo;s and MLB&rsquo;s content networks.
          </li>
        </ul>

        <h2>Children</h2>
        <p>
          {SITE.name}{' '}is intended for adults and is not directed to children. Please
          see{' '}
          <Link href="/responsible-gaming">responsible gaming</Link>.
        </p>

        <h2>Changes</h2>
        <p>
          We may update this policy as the product evolves; we&rsquo;ll revise the
          &ldquo;last updated&rdquo; date above when we do.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about privacy? Email{' '}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
        </p>
      </Prose>
    </div>
  );
}
