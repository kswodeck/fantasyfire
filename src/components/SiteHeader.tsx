import Link from 'next/link';
import { FlameMark } from './FlameMark';
import { SportsMenu } from './SportsMenu';
import { ThemeToggle } from './ThemeToggle';
import { MobileNav } from './MobileNav';

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
          {/* One condensed Sports menu (each sport + its section pages inside)
              instead of eight top-level buttons, then the all-sports surfaces. */}
          <SportsMenu />
          <Link href="/board" className="transition-colors hover:text-foreground">
            Heat Check
          </Link>
          <Link href="/trends" className="transition-colors hover:text-foreground">
            Trends
          </Link>
          <Link href="/accuracy" className="transition-colors hover:text-foreground">
            Accuracy
          </Link>
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
