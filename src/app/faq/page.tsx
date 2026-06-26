import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'FAQ & Glossary',
  description: `Frequently asked questions about ${SITE.name} — what it is, where the data comes from, how to read it — plus plain-English definitions of the stats and betting terms used across the site.`,
  alternates: { canonical: '/faq' },
};

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is FantasyFire?',
    a: 'FantasyFire is an NBA, MLB, and NFL player-prop research tool. Search any player to see hit rates, matchups, sample-size confidence, and fair-price math — all computed from public game logs.',
  },
  {
    q: 'Where does the data come from?',
    a: 'Everything is computed from publicly available NBA, MLB, and NFL game logs, refreshed nightly. FantasyFire is independent and is not affiliated with the NBA, MLB, NFL, or any team.',
  },
  {
    q: 'Do you sell picks or give betting advice?',
    a: 'No. FantasyFire is a research tool, not a tout service. Hit rates and matchup numbers are descriptive statistics about past games — not predictions, advice, or guarantees.',
  },
  {
    q: 'What does the confidence badge mean?',
    a: "Every hit rate comes with a 95% Wilson score interval — a statistically sound range for how reliable the rate is given the sample size. A High, Medium, or Low badge summarizes how wide that range is, so a hot streak over a few games doesn't masquerade as a sure thing.",
  },
  {
    q: 'What is Defense vs. Position (DvP)?',
    a: "It's how much of a stat each opponent gives up to a player's position (guard, forward, or center), ranked 1 to 30 where rank 1 allows the most. A quick read on whether today's matchup is soft or tough for that role.",
  },
  {
    q: 'Why does the line default to a half-point like 24.5?',
    a: "Half-point lines can't push (land exactly on the number), which matches how sportsbooks usually post props and keeps the over/under split clean. You can change the line to anything you want.",
  },
  {
    q: "Why aren't all of a player's games counted?",
    a: 'By default we exclude games under ten minutes — garbage-time cameos and injury exits are not representative of a player’s output. The game count shown reflects the qualifying games.',
  },
  {
    q: 'How current is the data?',
    a: "It's refreshed nightly, and the season is detected automatically from the calendar (it rolls over to the new season in mid-October).",
  },
  {
    q: 'Can I change the stat and line?',
    a: 'Yes. Pick any stat (points, rebounds, assists, PRA, threes, fouls, and more) and type any line — the hit-rate cards, chart, and matchup update instantly, and the URL is shareable.',
  },
  {
    q: 'How does the fair-price calculator work?',
    a: "Enter a sportsbook's American odds and we show the implied probability, the no-vig fair price when both sides are entered, and the edge versus the player's historical hit rate. It's history versus the price you entered — not a prediction.",
  },
  {
    q: 'Which sports do you cover?',
    a: 'FantasyFire currently covers the NBA, MLB, and NFL, each with its own home, player pages, and stat markets. More sports may follow.',
  },
];

const TERMS: { term: string; def: string }[] = [
  {
    term: 'Hit rate',
    def: 'How often a player went over vs. under a line, with pushes excluded from the denominator. Shown as overs / decided games and a percentage.',
  },
  {
    term: 'Over / Under',
    def: 'An over hits when the stat is above the line; an under when it is below.',
  },
  {
    term: 'FireFactor',
    def: 'Our 0–100 research signal for a line, shown as a heat read: an over runs warm — Warm, Hot, or Blazing (a flame, amber → red) — and an under runs cool — Cool, Cold, or Frozen (a snowflake, sky → indigo); a balanced line is No read. Deeper color means a stronger edge. It blends the recency-weighted hit rate, recent-form estimate, consistency, and matchup, and is research, never a pick.',
  },
  {
    term: 'Line value (discount)',
    def: 'How a book’s number compares to the market consensus (the median line across books). A softer number you’d clear more often is a discount, and FireFactor folds a small, capped boost into the heat for it. Each player’s page shows the full book-by-book comparison.',
  },
  {
    term: 'Push',
    def: 'When the stat lands exactly on the line. Pushes are excluded from the hit-rate denominator.',
  },
  {
    term: 'Window (L5 / L10 / L20 / Season)',
    def: 'The set of recent games a rate is computed over — the last 5, 10, 20, or the full season.',
  },
  {
    term: 'Wilson confidence interval',
    def: 'A 95% range for the true hit rate given the sample size — wider on small samples. We show it instead of a bare percentage so uncertainty is visible.',
  },
  {
    term: 'Confidence badge',
    def: 'A High / Medium / Low summary of how wide the Wilson interval is.',
  },
  {
    term: 'Defense vs. Position (DvP)',
    def: 'The average of a stat an opponent allows to a position bucket, ranked 1–30 where rank 1 allows the most (the softest matchup).',
  },
  {
    term: 'Position bucket',
    def: 'A coarse role grouping — Guard, Forward, or Center — used to keep DvP samples dense.',
  },
  {
    term: 'Sample size / low sample',
    def: 'The number of games behind a number. Small samples are flagged because they are less reliable.',
  },
  {
    term: 'Minutes filter',
    def: 'Games under ten minutes are excluded so garbage-time and injury games do not skew the rates.',
  },
  {
    term: 'PRA / PR / PA / RA',
    def: 'Combined stats: Points+Rebounds+Assists, Points+Rebounds, Points+Assists, and Rebounds+Assists.',
  },
  { term: 'Stocks', def: 'Steals + Blocks combined.' },
  {
    term: 'OREB / DREB / PF',
    def: 'Offensive rebounds, defensive rebounds, and personal fouls.',
  },
  {
    term: 'Plus/minus',
    def: "The team's point differential while the player was on the floor.",
  },
  {
    term: 'American odds',
    def: 'Odds shown as +150 / −110. Positive is the profit on a 100 stake (underdog); negative is the stake needed to win 100 (favorite).',
  },
  {
    term: 'Implied probability',
    def: 'The win probability baked into a price, before the book’s margin.',
  },
  {
    term: 'Vig / hold',
    def: "The book's built-in margin — the two sides' implied probabilities sum to more than 100%.",
  },
  {
    term: 'No-vig fair price',
    def: 'The price with the vig removed, so both sides sum to 100%.',
  },
  {
    term: 'Edge',
    def: 'Historical hit rate minus the fair (or implied) probability. Positive suggests value vs. that price — not a guarantee.',
  },
];

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026'),
        }}
      />
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: 'FAQ & glossary' }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">FAQ &amp; glossary</h1>
      <p className="mt-2 text-sm text-muted">
        The common questions, plus plain-English definitions of every stat and betting term used
        across {SITE.name}.
      </p>

      <Prose>
        {FAQS.map((f) => (
          <div key={f.q}>
            <h2>{f.q}</h2>
            <p>{f.a}</p>
          </div>
        ))}
      </Prose>

      {/* Glossary — kept as a definition list so terms stay scannable. */}
      <h2 className="mt-10 text-xl font-semibold tracking-tight">Glossary</h2>
      <dl className="mt-3 divide-y divide-line border-t border-line">
        {TERMS.map((t) => (
          <div key={t.term} className="py-4">
            <dt className="font-semibold">{t.term}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">{t.def}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-8 text-sm text-muted">
        Still have a question? <Link href="/about#contact" className="font-medium text-brand hover:underline">Get in touch</Link>, or read{' '}
        <Link href="/how-it-works" className="font-medium text-brand hover:underline">how it works</Link>.
      </p>
    </div>
  );
}
