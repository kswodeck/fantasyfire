import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Get in touch with ${SITE.name} — feedback, data corrections, partnerships, and press.`,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: 'Contact' }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">Contact</h1>

      <Prose>
        <p>
          Questions, feedback, a data correction, a partnership, or press? Email us and a
          human will read it.
        </p>

        <p>
          <a
            href={`mailto:${SITE.email}`}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground no-underline transition-colors hover:bg-brand-strong"
          >
            {SITE.email}
          </a>
        </p>

        <h2>Good things to email about</h2>
        <ul>
          <li>Bugs, wrong numbers, or a player/matchup that looks off</li>
          <li>Feature requests and feedback</li>
          <li>Partnership, advertising, or media inquiries</li>
        </ul>

        <p>
          We&rsquo;re a small, independent team, so please allow a few days for a reply.
          One thing we <strong>can&rsquo;t</strong> help with: picks or betting advice —
          {SITE.name}{' '}is a research tool, not a tout service (
          <Link href="/responsible-gaming">why</Link>).
        </p>
      </Prose>
    </div>
  );
}
