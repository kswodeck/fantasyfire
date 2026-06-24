import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: `The terms for using ${SITE.name} — an informational NBA research tool.`,
  alternates: { canonical: '/terms' },
};

const LAST_UPDATED = 'June 23, 2026';

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: 'Terms' }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">Terms of Use</h1>
      <p className="mt-1 text-xs text-muted">Last updated: {LAST_UPDATED}</p>

      <Prose>
        <p>
          By accessing or using {SITE.name} (the &ldquo;Service&rdquo;), you agree to
          these Terms. If you do not agree, please do not use the Service.
        </p>

        <h2>Informational use only — not advice</h2>
        <p>
          The Service provides statistics and research derived from publicly available
          NBA data. It is for informational and entertainment purposes only and is{' '}
          <strong>not betting, financial, investment, legal, or professional advice</strong>.
          Hit rates and matchup figures describe past performance and are not predictions
          or guarantees of any outcome. You are solely responsible for any decisions you
          make. See <Link href="/responsible-gaming">responsible gaming</Link>.
        </p>

        <h2>No warranty on accuracy</h2>
        <p>
          Data is sourced from third parties and may be incomplete, delayed, or
          incorrect. The Service is provided &ldquo;as is&rdquo; and &ldquo;as
          available,&rdquo; without warranties of any kind, express or implied, including
          accuracy, fitness for a particular purpose, or uninterrupted availability.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, {SITE.name} and its operators will not
          be liable for any losses or damages arising from your use of, or reliance on,
          the Service — including any wagering decisions.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>Don&rsquo;t scrape, overload, or attempt to disrupt or reverse-engineer the Service.</li>
          <li>Don&rsquo;t use it for unlawful purposes or where prohibited.</li>
          <li>Don&rsquo;t misrepresent the Service or its data as your own or as guaranteed.</li>
        </ul>

        <h2>Gambling &amp; eligibility</h2>
        <p>
          Any betting you do is your own responsibility and must comply with the laws of
          your jurisdiction, including minimum-age requirements (generally 21+). The
          Service does not accept wagers and is not a sportsbook.
        </p>

        <h2>Intellectual property</h2>
        <p>
          {SITE.name}{' '}is independent and is not affiliated with, endorsed by, or
          sponsored by the NBA. NBA team names, logos, and player likenesses are the
          property of their respective owners and are used for identification only.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these Terms from time to time; continued use after changes means
          you accept the updated Terms. The &ldquo;last updated&rdquo; date above reflects
          the current version.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these Terms? Email{' '}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
        </p>
      </Prose>
    </div>
  );
}
