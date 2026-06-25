import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'FAQ',
  description: `Frequently asked questions about ${SITE.name} — what it is, where the data comes from, and how to read it.`,
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
        items={[{ label: 'Home', href: '/' }, { label: 'FAQ' }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">Frequently asked questions</h1>

      <Prose>
        {FAQS.map((f) => (
          <div key={f.q}>
            <h2>{f.q}</h2>
            <p>{f.a}</p>
          </div>
        ))}
        <hr />
        <p>
          Still have a question? <Link href="/contact">Get in touch</Link>, or read{' '}
          <Link href="/how-it-works">how it works</Link>.
        </p>
      </Prose>
    </div>
  );
}
