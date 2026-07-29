import Link from 'next/link';
import { hasAnyRefLink } from '@/lib/providedSources';

/**
 * The FTC-required disclosure for paid referral links, placed NEAR the links it
 * covers (the rule is "clear and conspicuous", not "buried in the footer").
 *
 * Renders NOTHING until at least one real referral link is configured
 * (hasAnyRefLink) — before any deal exists the book names link to plain
 * homepages that earn us nothing, and claiming a paid relationship we don't have
 * would be its own false statement. So this appears exactly when it becomes true.
 *
 * `inline` is the compact one-liner for in-page use; the default is the boxed
 * version for the top of /books.
 */
export function AffiliateDisclosure({ inline = false }: { inline?: boolean }) {
  if (!hasAnyRefLink()) return null;

  const text = (
    <>
      Some links to sportsbooks and DFS apps on this page are referral links — if you
      sign up through one, we may earn a commission at no extra cost to you. It never
      changes our numbers: the leans, hit rates and accuracy ledger are computed from
      public game logs, and no book pays for placement or a better score.
    </>
  );

  if (inline) {
    return (
      <p className="mt-2 text-xs text-muted">
        <span className="font-semibold">Ad disclosure:</span> {text}
      </p>
    );
  }

  return (
    <aside className="mt-4 rounded-xl border border-line bg-surface p-4 text-xs leading-relaxed text-muted">
      <p>
        <strong className="text-foreground">Advertising disclosure.</strong> {text}
      </p>
      <p className="mt-2">
        21+ (19+ or 18+ where applicable) and available only where legal. Please see{' '}
        <Link href="/responsible-gaming" className="text-brand hover:text-brand-strong">
          responsible gaming
        </Link>{' '}
        and our <Link href="/terms" className="text-brand hover:text-brand-strong">terms</Link>.
      </p>
    </aside>
  );
}
