import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: `What ${SITE.name} is: matchup-adjusted projections and +EV for NBA, MLB, and NFL player props, priced against the market and shown with their uncertainty.`,
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
          {SITE.name}{' '}is a projection and +EV research tool for NBA, MLB, and NFL player
          props. We turn public game logs into a matchup-adjusted projection for every prop,
          convert it to the probability the line clears, and price it against the market — so
          you can find the soft number instead of trusting someone else&rsquo;s
          &ldquo;locks.&rdquo;
        </p>

        <h2>What it does</h2>
        <ul>
          <li>
            <strong>Projections</strong> for any stat and line — a recency-weighted base
            adjusted for the opponent, pace, the Vegas game total, and recent usage, then
            turned into a probability with a sound distribution.
          </li>
          <li>
            <strong>Edge vs. the market</strong> — we de-vig the books we track to a no-vig
            fair price, flag the best available number, and show the +EV, automatically.
          </li>
          <li>
            <strong>FireFactor</strong> — one transparent heat read blending the projection,
            hit rate, consistency, and matchup, with its full component breakdown.
          </li>
          <li>
            <strong>Sample-size confidence</strong> — a 95% Wilson interval on every rate,
            so a hot streak on a few games doesn&rsquo;t masquerade as an edge.
          </li>
          <li>
            <strong>Availability</strong> — injury and Out flags that gate a read, so you
            aren&rsquo;t reading a number for a player who isn&rsquo;t taking the field.
          </li>
        </ul>

        <h2>What makes it different</h2>
        <p>
          Most prop tools sell confidence. We show our work. Every projection comes with its{' '}
          <strong>uncertainty</strong> — a &ldquo;4 of 5&rdquo; over a handful of games and a
          &ldquo;40 of 50&rdquo; over a season are not the same bet, and we make that difference
          impossible to miss. No black box: the weights are published and the math is on the{' '}
          <Link href="/how-it-works">how it works</Link> page.
        </p>

        <h2>What it isn&rsquo;t</h2>
        <p>
          {SITE.name}{' '}is not a tout service and does not sell picks. A projection and a
          +EV number are <strong>research, not a guarantee</strong> — nothing here is betting,
          financial, or investment advice, and a soft line can still lose. We show you the math
          and the market price; the wager is yours. See{' '}
          <Link href="/responsible-gaming">responsible gaming</Link>.
        </p>

        <h2>Where the data comes from</h2>
        <p>
          Projections are computed from publicly available NBA, MLB, and NFL game logs, refreshed
          nightly. The market prices, Vegas game totals, and injury status come from public
          sportsbook and league feeds, refreshed through the day. {SITE.name} is independent and
          is not affiliated with or endorsed by the NBA, MLB, NFL, any team, or any sportsbook;
          league and team names and logos are the property of their respective owners.
        </p>

        <h2 id="contact">Contact</h2>
        <p>
          Questions, feedback, a data correction, a partnership, or press? Email us and a
          human will read it.
        </p>
        <p>
          <a
            href={`mailto:${SITE.email}`}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground! no-underline! transition-colors hover:bg-brand-strong hover:no-underline!"
          >
            {SITE.email}
          </a>
        </p>
        <p>
          <strong>Good things to email about:</strong>
        </p>
        <ul>
          <li>Bugs, wrong numbers, or a player/matchup that looks off</li>
          <li>Feature requests and feedback</li>
          <li>Partnership, advertising, or media inquiries</li>
        </ul>
        <p>
          We&rsquo;re a small, independent team, so please allow a few days for a reply.
          One thing we <strong>can&rsquo;t</strong> help with: picks or betting advice —
          {SITE.name}{' '}is a research tool, not a tout service (
          <Link href="/responsible-gaming">why</Link>).
        </p>
      </Prose>
    </div>
  );
}
