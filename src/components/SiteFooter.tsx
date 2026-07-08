import Link from 'next/link';
import { FlameMark } from './FlameMark';
import { SITE, activeSocials } from '@/lib/site';
import { SPORT_LIST, SPORTS } from '@/lib/sports';

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Sports',
    // Derived from the registry so a new sport lands here automatically.
    links: [
      { label: 'My Playbook', href: '/playbook' },
      ...SPORT_LIST.map((sport) => ({ label: SPORTS[sport].name, href: `/${sport}` })),
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'How it works', href: '/how-it-works' },
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
            <Link href="/" className="flex items-center gap-2 font-semibold">
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
              className="mt-3 inline-block text-xs text-muted transition-colors hover:text-foreground"
            >
              {SITE.email}
            </a>
            {activeSocials().length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {activeSocials().map((s) => (
                  <li key={s.key}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="me noopener noreferrer"
                      className="text-muted transition-colors hover:text-foreground"
                    >
                      {s.label}
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
                      className="text-muted transition-colors hover:text-foreground"
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
            built on public NBA, WNBA, MLB, NFL, NHL, MLS, CFB, and CBB game logs. Hit rates and matchup numbers are
            descriptive statistics about past performance — they are{' '}
            <strong className="text-foreground">
              not predictions, advice, or a guarantee
            </strong>
            . Nothing here is betting or financial advice. 21+. Problem gambling? Call
            1-800-GAMBLER.
          </p>
          <p>
            Not affiliated with or endorsed by the NBA, WNBA, MLB, NFL, NHL, MLS, the NCAA, or any team or school. © {year}{' '}
            {SITE.name}.
          </p>
        </div>
      </div>
    </footer>
  );
}
