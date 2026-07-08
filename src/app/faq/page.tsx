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
    a: 'FantasyFire is a projection and +EV research tool for NBA, WNBA, MLB, NFL, NHL, MLS, CFB, and CBB player props. For any player it projects each prop, turns that into the probability the line clears, and prices it against the market — all built on public game logs, with the uncertainty shown.',
  },
  {
    q: 'How do you project a player?',
    a: "We start with a recency-weighted average of recent games, regressed toward the season average so a short streak doesn't run away, then adjust it for the specific game: the opponent (defense-vs-position, or the probable starter in MLB), pace, the Vegas game total, and recent usage. Each adjustment is gently capped, so context nudges the number without swinging it.",
  },
  {
    q: 'What does +EV mean here?',
    a: "When the books we track post two-sided odds, we remove the vig and take the median to get a no-vig 'fair' probability, then flag the best available price and its expected value (+EV). A book paying better than that fair price — or our model disagreeing with it — is where an edge lives. It's a comparison of numbers, not a guarantee.",
  },
  {
    q: 'Where does the data come from?',
    a: 'Projections are computed from publicly available game logs, refreshed nightly. Market prices, Vegas game totals, and injury status come from public sportsbook and league feeds through the day. FantasyFire is independent and is not affiliated with any league, team, or sportsbook.',
  },
  {
    q: 'Do you sell picks or give betting advice?',
    a: 'No. We show a projection, a fair price, and where a line looks soft — research, not a tout service. A +EV number is not a promise; a soft line can still lose. Nothing here is betting, financial, or investment advice.',
  },
  {
    q: 'Do you account for injuries?',
    a: "Yes, several ways. An Out / IL player is forced to No read and dropped from the board; game-time tiers (doubtful / questionable / GTD) discount FireFactor and add a caution — the same gate on the board and player page. Each page also shows the injury, estimated return, and news (see the injury report), plus how the player's line shifts when an impactful teammate is out. We surface status; confirm the final call yourself.",
  },
  {
    q: 'What does the confidence badge mean?',
    a: "Every hit rate comes with a 95% Wilson score interval — a statistically sound range for how reliable the rate is given the sample size. A High, Medium, or Low badge summarizes how wide that range is, so a hot streak over a few games doesn't masquerade as a sure thing.",
  },
  {
    q: 'What is Defense vs. Position (DvP)?',
    a: "It's how much of a stat each opponent gives up to a player's position, ranked across the league where rank 1 allows the most (the softest matchup). In MLB the equivalent is opposing pitching — how much a team's staff gives up to hitters. A quick read on whether today's matchup is soft or tough for that role.",
  },
  {
    q: 'Why does the line default to a half-point like 24.5?',
    a: "Half-point lines can't push (land exactly on the number), which matches how sportsbooks usually post props and keeps the over/under split clean. You can change the line to anything you want.",
  },
  {
    q: "Why aren't all of a player's games counted?",
    a: 'We drop games where a player was barely involved — a garbage-time cameo or an early injury exit isn’t representative. The bar adapts per player (minutes in the NBA, plate appearances for MLB hitters), so part-time players aren’t zeroed out. The game count shown reflects the qualifying games.',
  },
  {
    q: 'How current is the data?',
    a: "It's refreshed nightly, and each sport's current season is detected automatically from the calendar.",
  },
  {
    q: 'Can I change the stat and line?',
    a: 'Yes. Pick any stat we offer for that sport and type any line — the hit-rate cards, chart, and matchup update instantly, and the URL is shareable.',
  },
  {
    q: 'How does the fair-price calculator work?',
    a: "When the books we track post odds, we de-vig them automatically and show the fair price, best number, and +EV. You can also enter a sportsbook's American odds yourself to see the implied probability, the no-vig fair price (with both sides), and the edge versus the player's history. Either way it's a comparison of numbers, not a prediction.",
  },
  {
    q: 'Which sports do you cover?',
    a: "The NBA, WNBA, MLB, NFL, NHL, MLS, and men's college football (CFB) and basketball (CBB) — each with its own home page, player pages, and stat markets. More sports may follow.",
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
    term: 'Projection',
    def: 'Our number for a player+stat: a recency-weighted, season-regressed base, then adjusted (gently capped) for the opponent, pace, the Vegas game total, and recent usage. Shown next to the raw L5/L10/median it’s built from.',
  },
  {
    term: 'Model probability',
    def: 'The projection turned into P(the line clears), using a negative-binomial / Poisson distribution for counts and a normal for yardage. It’s what we compare to the market price.',
  },
  {
    term: 'FireFactor',
    def: 'Our 0–100 read of the model’s estimated chance the side hits, shown as a heat read: an over runs warm — Warm, Hot, or Blazing (a flame, amber → red) — and an under runs cool — Cool, Cold, or Frozen (a snowflake, sky → indigo); a balanced line is No read. A coin flip sits near 0 (a Pass), a clear edge reads Slight or Normal, and only a near-certain (~90%+) read nears 100 (rare — there’s no sure bet). It blends the hit rate, the projection’s probability vs the line, consistency, and matchup, discounted for small samples — the pure directional signal, identical on the board and a player’s page for the same line. (Price reads like +EV live in their own panel.) It is research, never a pick.',
  },
  {
    term: 'No-vig consensus / +EV',
    def: 'We de-vig each book’s two-sided odds and take the median for a “fair” probability, then flag the best available price and its expected value. A price beating the fair number is +EV.',
  },
  {
    term: 'Game environment',
    def: 'A player’s implied team total — half the Vegas game total, shifted by the spread — versus the league average. A high-total game is a richer scoring environment and nudges the projection up.',
  },
  {
    term: 'Line value (discount)',
    def: 'How a book’s number compares to the market consensus (the median line across books). A softer number you’d clear more often is a discount. Shown as its own read on each player’s page (the full book-by-book comparison), separate from the FireFactor score.',
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
    def: 'The average of a stat an opponent allows to a position group, ranked across the league where rank 1 allows the most (the softest matchup).',
  },
  {
    term: 'Position bucket',
    def: 'A coarse role grouping used to keep matchup samples dense — Guard/Forward/Center in the NBA, QB/RB/WR/TE in the NFL.',
  },
  {
    term: 'Sample size / low sample',
    def: 'The number of games behind a number. Small samples are flagged because they are less reliable.',
  },
  {
    term: 'Opportunity filter',
    def: 'Games where a player was barely involved are excluded so garbage-time and injury exits do not skew the rates. The bar adapts per player — minutes in the NBA, plate appearances for MLB hitters.',
  },
  {
    term: 'PRA / PR / PA / RA (NBA)',
    def: 'Combined stats: Points+Rebounds+Assists, Points+Rebounds, Points+Assists, and Rebounds+Assists.',
  },
  { term: 'Stocks (NBA)', def: 'Steals + Blocks combined.' },
  {
    term: 'OREB / DREB / PF (NBA)',
    def: 'Offensive rebounds, defensive rebounds, and personal fouls.',
  },
  {
    term: 'Plus/minus (NBA)',
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
