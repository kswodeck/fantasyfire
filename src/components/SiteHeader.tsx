import Link from 'next/link';
import { FlameMark } from './FlameMark';
import { SportMenu } from './SportMenu';
import { ThemeToggle } from './ThemeToggle';
import { MobileNav } from './MobileNav';
import { SPORT_LIST } from '@/lib/sports';

// Site chrome. Data-agnostic; safe to reuse in any build.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <FlameMark className="h-6 w-6 text-brand" />
          <span className="text-lg">
            Fantasy<span className="text-brand">Fire</span>
          </span>
        </Link>

        {/* Desktop / tablet (sm+): inline nav with hover menus. */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-4 text-sm text-muted sm:flex sm:gap-5"
        >
          <Link href="/" className="transition-colors hover:text-foreground">
            Home
          </Link>
          {SPORT_LIST.map((s) => (
            <SportMenu key={s} sport={s} />
          ))}
          <Link
            href="/playbook"
            className="transition-colors hover:text-foreground"
            title="My Playbook"
          >
            <span aria-hidden="true">★</span>
            <span className="sr-only">My Playbook</span>
          </Link>
          <ThemeToggle className="-mr-1.5" />
        </nav>

        {/* Mobile (sub-sm): theme toggle + hamburger menu. */}
        <div className="flex items-center gap-1 sm:hidden">
          <ThemeToggle />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
