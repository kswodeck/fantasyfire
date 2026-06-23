import Link from 'next/link';
import { FlameMark } from './FlameMark';

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
        <nav className="flex items-center gap-5 text-sm text-muted">
          <Link href="/" className="transition-colors hover:text-foreground">
            Search
          </Link>
          <Link href="/players" className="transition-colors hover:text-foreground">
            Players
          </Link>
        </nav>
      </div>
    </header>
  );
}
