import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: `What ${SITE.name} is, how it stays honest about uncertainty, and where its data comes from.`,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: 'About' }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">About {SITE.name}</h1>

      <Prose>
        <p>
          {SITE.name}{' '}is a free NBA player-prop research tool. We turn public game
          logs into clear, honest answers about player props — hit rates, matchups,
          and how much you can actually trust each number — so you can do your own
          research without paying for &ldquo;locks&rdquo; or wading through ads.
        </p>

        <h2>What it does</h2>
        <ul>
          <li>
            <strong>Hit rates</strong> for any stat and line over the last 5, 10, 20
            games and the full season — with the raw game-by-game bars, not just a
            percentage.
          </li>
          <li>
            <strong>Defense vs. Position</strong> — how many points, rebounds, assists
            (and more) each opponent gives up to a player&rsquo;s role.
          </li>
          <li>
            <strong>Sample-size confidence</strong> — a 95% Wilson interval on every
            hit rate, so a hot streak on a few games doesn&rsquo;t masquerade as an edge.
          </li>
          <li>
            <strong>Fair-price math</strong> — enter a book&rsquo;s odds to see the
            implied probability, the no-vig fair price, and the edge vs. recent history.
          </li>
        </ul>

        <h2>What makes it different</h2>
        <p>
          Most prop tools sell confidence. We sell context. The headline feature is the
          one most sites hide: <strong>uncertainty</strong>. A &ldquo;4 of 5&rdquo; over a
          handful of games and a &ldquo;40 of 50&rdquo; over a season are not the same
          bet, and we make that difference impossible to miss. Read the full approach in{' '}
          <Link href="/how-it-works">how it works</Link>.
        </p>

        <h2>What it isn&rsquo;t</h2>
        <p>
          {SITE.name}{' '}is not a tout service and does not sell picks. Nothing here is
          betting, financial, or investment advice. Hit rates and matchup numbers are{' '}
          <strong>descriptive statistics about past games</strong> — not predictions or
          guarantees. See <Link href="/responsible-gaming">responsible gaming</Link>.
        </p>

        <h2>Where the data comes from</h2>
        <p>
          Everything is computed from publicly available NBA game logs, refreshed
          nightly. {SITE.name} is independent and is not affiliated with or endorsed by
          the NBA; team names and logos are the property of their respective owners.
        </p>

        <p>
          Have feedback or spotted a bug? <Link href="/contact">Get in touch</Link> — we
          read everything.
        </p>
      </Prose>
    </div>
  );
}
