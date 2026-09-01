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
 * Three weights, because the right amount of disclosure depends on how much of the
 * page is about the books:
 *  - `box`     — the boxed version for the top of /books, a page that is entirely
 *                about the operators and where the fuller context belongs.
 *  - `inline`  — the one-liner for a page whose main job is something else but
 *                which builds toward a book action (the Playbook's entry builder).
 *  - `minimal` — one quiet line for research pages, where the books are incidental
 *                to the numbers and the disclosure should be findable without
 *                competing with the analysis. Still adjacent and still legible at
 *                the site's normal caption size (`text-xs text-muted`, the same
 *                treatment as every other note on the page) — the brevity comes
 *                out of the word count, never out of the visibility, because a
 *                disclosure nobody can read carries the obligation without the
 *                benefit.
 */
export function AffiliateDisclosure({
  variant = 'box',
}: {
  variant?: 'box' | 'inline' | 'minimal';
}) {
  if (!hasAnyRefLink()) return null;

  // The short form keeps the two things that actually have to be said: that the
  // links are paid, and that they don't move the numbers. The second half is not
  // padding — it is the whole reason a research site can carry paid links at all.
  if (variant === 'minimal') {
    return (
      <p className="mt-3 text-xs text-muted">
        Book links are referral links — we may earn a commission. It never affects the
        numbers on this page.
      </p>
    );
  }

  const text = (
    <>
      Some links to sportsbooks and DFS apps on this page are referral links — if you
      sign up through one, we may earn a commission at no extra cost to you. It never
      changes our numbers: the leans, hit rates and accuracy ledger are computed from
      public game logs, and no book pays for placement or a better score.
    </>
  );

  if (variant === 'inline') {
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
