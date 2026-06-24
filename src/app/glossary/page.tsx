import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Glossary',
  description: `Plain-English definitions of the stats and betting terms used on ${SITE.name}.`,
  alternates: { canonical: '/glossary' },
};

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

export default function GlossaryPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: 'Glossary' }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">Glossary</h1>
      <p className="mt-2 text-sm text-muted">
        Plain-English definitions for the stats and betting terms used across{' '}
        {SITE.name}. New to the math?{' '}
        <Link href="/how-it-works" className="font-medium text-brand hover:underline">
          See how it works
        </Link>
        .
      </p>

      <dl className="mt-6 divide-y divide-line border-t border-line">
        {TERMS.map((t) => (
          <div key={t.term} className="py-4">
            <dt className="font-semibold">{t.term}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">{t.def}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
