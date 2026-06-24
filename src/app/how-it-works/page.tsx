import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'How It Works',
  description: `The methodology behind ${SITE.name}: hit rates, Wilson confidence intervals, defense-vs-position, the minutes filter, and fair-price math.`,
  alternates: { canonical: '/how-it-works' },
};

export default function HowItWorksPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: 'How it works' }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">How it works</h1>

      <Prose>
        <p>
          Every number on {SITE.name} is computed from public NBA game logs — no black
          box, no proprietary &ldquo;model&rdquo; you have to take on faith. Here&rsquo;s
          exactly what we do.
        </p>

        <h2>Hit rate</h2>
        <p>
          For a chosen stat (points, rebounds, PRA, etc.) and a line, we count how often
          a player went <strong>over</strong> vs. <strong>under</strong> across a window
          of recent games. Pushes (landing exactly on the line) are excluded from the
          denominator, so a 60% over rate means 6 overs in 10 <em>decided</em> games. We
          show L5, L10, L20 and the full season, plus the raw per-game bars and the
          mean.
        </p>

        <h2>Sample-size confidence (the important part)</h2>
        <p>
          A percentage alone is misleading on small samples. For every hit rate we
          compute a 95% <strong>Wilson score interval</strong> — the statistically sound
          way to express &ldquo;how sure can we be?&rdquo; A 4/5 streak might have a true
          range as wide as roughly 30–95%, while a 40/50 season sits in a tight band. We
          surface that range and a High / Medium / Low badge so you never mistake a tiny
          sample for a real edge.
        </p>

        <h2>Defense vs. Position (DvP)</h2>
        <p>
          For each opponent we average how much of a stat they allow to a player&rsquo;s
          position bucket (Guard / Forward / Center) and rank all 30 teams, where rank 1
          allows the most (the softest matchup). Positions are intentionally coarse — NBA
          labels are loose and many players are multi-position — so we keep three buckets
          for denser samples and always show the sample size rather than over-claiming
          precision.
        </p>

        <h2>The minutes filter</h2>
        <p>
          Garbage-time cameos and injury exits distort prop research. By default we
          exclude games under ten minutes, so the rates reflect games a player actually
          factored into.
        </p>

        <h2>Fair price</h2>
        <p>
          Enter a book&rsquo;s American odds and we convert them to an implied
          probability. Enter both sides and we remove the vig to show the no-vig fair
          price, then compare it to the player&rsquo;s historical hit rate to estimate an
          edge. This is <strong>history versus the price you entered — not a
          prediction</strong>, and we label it that way.
        </p>

        <h2>Data &amp; freshness</h2>
        <p>
          Player profiles, box scores, and matchups come from publicly available NBA game
          logs and are refreshed nightly. The current season is determined automatically
          by the calendar. Lines are entered by you — {SITE.name} does not pull live
          sportsbook odds.
        </p>

        <p>
          New here? Start by <Link href="/players">browsing players</Link>, or read more{' '}
          <Link href="/about">about {SITE.name}</Link>.
        </p>
      </Prose>
    </div>
  );
}
