import { SITE } from '@/lib/site';

// Footer with the gambling-adjacent disclaimer (see docs/PLAN.md §11).
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface-2">
      <div className="mx-auto w-full max-w-5xl space-y-3 px-4 py-8 text-xs leading-relaxed text-muted">
        <p>
          <strong className="text-foreground">{SITE.name}</strong> is a free research
          tool built on public NBA game logs. Hit rates and matchup numbers are
          descriptive statistics about past performance — they are{' '}
          <strong className="text-foreground">not predictions, advice, or a guarantee</strong>{' '}
          of future results.
        </p>
        <p>
          Nothing here is betting or financial advice. If you choose to bet, do so
          responsibly and only where legal. 21+. Problem gambling? Call 1-800-GAMBLER.
        </p>
        <p className="pt-2 text-muted/80">
          Not affiliated with or endorsed by the NBA. Player and game data sourced from
          publicly available statistics.
        </p>
      </div>
    </footer>
  );
}
