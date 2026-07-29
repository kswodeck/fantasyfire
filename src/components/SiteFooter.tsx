import Link from 'next/link';
import { FlameMark } from './FlameMark';
import { SocialIcon } from './SocialIcons';
import { SITE, activeSocials } from '@/lib/site';

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    // The all-sports surfaces, not a per-league directory — every league is one
    // tap away inside each of these (and in the header nav).
    title: 'Research',
    links: [
      { label: 'My Playbook', href: '/playbook' },
      { label: 'Heat Check', href: '/board' },
      { label: 'Trends', href: '/trends' },
      { label: 'Accuracy', href: '/accuracy' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'How it works', href: '/how-it-works' },
      { label: 'Books we track', href: '/books' },
      { label: 'Status', href: '/status' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'FAQ & glossary', href: '/faq' },
      { label: 'Responsible gaming', href: '/responsible-gaming' },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-line bg-surface-2">
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold transition-opacity hover:opacity-75"
            >
              <FlameMark className="h-5 w-5 text-brand" />
              <span>
                Fantasy<span className="text-brand">Fire</span>
              </span>
            </Link>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Honest player-prop research, built on public game logs across eight leagues.
            </p>
            <a
              href={`mailto:${SITE.email}`}
              className="mt-3 inline-block text-xs text-brand underline-offset-4 transition-colors hover:text-brand-strong hover:underline"
            >
              {SITE.email}
            </a>
            {activeSocials().length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-xs">
                {activeSocials().map((s) => (
                  <li key={s.key}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="me noopener noreferrer"
                      aria-label={s.label}
                      title={s.label}
                      className="inline-flex items-center gap-1.5 text-muted transition-all duration-150 hover:-translate-y-0.5 hover:text-brand"
                    >
                      <SocialIcon network={s.key} className="h-4 w-4" />
                      <span className="sr-only sm:not-sr-only">{s.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-muted underline-offset-4 transition-colors hover:text-brand hover:underline"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-2 border-t border-line pt-6 text-xs leading-relaxed text-muted">
          <p>
            <strong className="text-foreground">{SITE.name}</strong> is a research tool
            built on public game logs from eight pro and college leagues. Hit rates and matchup numbers are
            descriptive statistics about past performance — they are{' '}
            <strong className="text-foreground">
              not predictions, advice, or a guarantee
            </strong>
            . Nothing here is betting or financial advice. 21+. Problem gambling? Call
            1-800-GAMBLER.
          </p>
          <p>
            Not affiliated with or endorsed by any league, the NCAA, or any team or school. © {year}{' '}
            {SITE.name}.
          </p>
        </div>
      </div>
    </footer>
  );
}
