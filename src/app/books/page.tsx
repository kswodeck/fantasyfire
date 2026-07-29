import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Prose } from '@/components/Prose';
import { BookLogo } from '@/components/BookLogo';
import { BookLink } from '@/components/BookLink';
import { AffiliateDisclosure } from '@/components/AffiliateDisclosure';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'The Books We Track — Payout Structures Compared',
  description:
    'How the DFS pick’em apps and sportsbooks we pull lines from actually differ: flat-payout entries vs. demons and goblins vs. per-side multipliers, and what each one means for the number you need to hit.',
  alternates: { canonical: '/books' },
};

// 24h — this is editorial copy, not live data.
export const revalidate = 86400;

/**
 * The books we pull lines from, grouped by how their PAYOUTS work — which is the
 * distinction that actually changes the math (see payoutVariant.ts), and the one
 * thing a "best sportsbook" listicle never explains. Ordered within each group by
 * how central they are to the board.
 */
const GROUPS: {
  title: string;
  blurb: string;
  books: { id: string; note: string }[];
}[] = [
  {
    title: 'Flat-payout pick’em',
    blurb:
      'Pick 2–6 players over/under a line; every leg pays the same and the entry pays on how many legs land. Because the payout is flat, a leg is “fair” at 50% — so our FireFactor scores these against a plain coin flip.',
    books: [
      { id: 'prizepicks', note: 'The default board source. Also posts demons and goblins — see below.' },
      { id: 'underdog', note: 'Balanced lines plus alternate lines that carry their own posted multiplier.' },
      { id: 'sleeper', note: 'Prices each side separately, so the over and the under can need different hit rates.' },
      { id: 'pick6', note: 'DraftKings’ pick’em product. Two-sided markets read as standard lines.' },
      { id: 'dabble', note: 'Pick’em entries; social-style feed.' },
      { id: 'betr', note: 'Pick’em plus a sportsbook in some states.' },
      { id: 'parlayplay', note: 'Pick’em with alternate-line multipliers.' },
    ],
  },
  {
    title: 'Variant lines (demons, goblins, alternates)',
    blurb:
      'A harder line that pays more (a demon) or an easier line that pays less (a goblin) is NOT scored against 50% — each one has its own breakeven implied by the payout. A goblin can be a bad number even at a 75% hit rate, and a demon can be a good one at 35%. That is the single most misread thing in pick’em, and it is why our board scores every rung against its own bar rather than the raw hit rate.',
    books: [
      { id: 'prizepicks', note: 'Demons (boosted payout, harder line) and goblins (reduced payout, easier line).' },
      { id: 'underdog', note: 'Alternate lines ship an explicit multiplier, so the breakeven is exact.' },
      { id: 'parlayplay', note: 'Alternate lines with posted multipliers.' },
    ],
  },
  {
    title: 'Sportsbooks (odds we compare against)',
    blurb:
      'We read these mainly to build a cross-book consensus: with several books quoting the same prop we can de-vig to a fair price and show where one book’s number is softer than the market. Availability varies by state.',
    books: [
      { id: 'draftkings', note: '' },
      { id: 'fanduel', note: '' },
      { id: 'betmgm', note: '' },
      { id: 'caesars', note: '' },
      { id: 'espnbet', note: '' },
      { id: 'hardrock', note: '' },
      { id: 'betrivers', note: '' },
      { id: 'pointsbet', note: '' },
    ],
  },
];

export default function BooksPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs className="mb-4" items={[{ label: 'Home', href: '/' }, { label: 'Books' }]} />
      <h1 className="text-3xl font-bold tracking-tight">The books we track</h1>
      <p className="mt-2 text-sm text-muted">
        {SITE.name} reads lines from the apps below and scores every one of them the same
        way. This page explains how their <strong className="text-foreground">payout
        structures</strong> differ — the part that changes what hit rate you actually need.
      </p>

      <AffiliateDisclosure />

      {GROUPS.map((group) => (
        <section key={group.title} className="mt-8">
          <h2 className="text-xl font-bold tracking-tight">{group.title}</h2>
          <p className="mt-1 text-sm text-muted">{group.blurb}</p>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {group.books.map((b) => (
              <li key={`${group.title}-${b.id}`} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 shrink-0">
                  <BookLogo source={b.id} size={20} />
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <BookLink source={b.id} placement="books-page" className="font-semibold text-brand hover:text-brand-strong" />
                  {b.note && <span className="block text-xs text-muted">{b.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Prose>
        <h2>How we use these lines</h2>
        <p>
          Every board row is scored against the bar its own payout implies, not against a
          flat 50%. For a standard leg that bar is a coin flip; for a goblin or a demon it
          is the payout&rsquo;s breakeven; and where a book prices each side separately, it
          is that side&rsquo;s own number. The{' '}
          <Link href="/methodology">methodology</Link> page has the exact math, and the{' '}
          <Link href="/accuracy">accuracy ledger</Link> shows how the resulting leans
          actually settled.
        </p>
        <p>
          We are not affiliated with any of these operators, and none of them pays for
          placement, a better score, or a mention on the board. Which books appear depends
          only on which ones post lines we can read. Availability, promotions and legality
          vary by state and change often — check the operator&rsquo;s own site for what
          applies to you.
        </p>
        <p>
          21+ (19+ or 18+ where applicable). If gambling stops being fun, please see{' '}
          <Link href="/responsible-gaming">responsible gaming</Link> — call or text
          1-800-GAMBLER.
        </p>
      </Prose>
    </div>
  );
}
