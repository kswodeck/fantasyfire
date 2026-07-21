import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SportSelect } from '@/components/SportSelect';
import { AllSportsNav } from '@/components/AllSportsNav';
import { RecapRowList } from '@/components/YesterdayRecapStrip';
import { getAllSportsAccuracy } from '@/lib/server/recap';
import { formatIsoDate } from '@/lib/format';
import type { AccuracyLedger } from '@/lib/types';

// 6h — matches the per-sport ledgers' cache window (this merges them in memory,
// adding no scans), so regenerating faster would only re-serve the same data.
export const revalidate = 21600;

export const metadata: Metadata = {
  title: 'FireFactor Accuracy — Settled Leans, Every Sport',
  description:
    "How FantasyFire's FireFactor leans actually settled across every in-season league, day by day: each slate's strongest pre-game recent-form reads checked against the real box scores. Recomputed from public game logs — descriptive facts, not a track record or picks.",
  alternates: { canonical: '/accuracy' },
  openGraph: { type: 'website', title: 'FireFactor Accuracy', url: '/accuracy' },
};

function Record({ label, hits, misses, pushes }: { label: string; hits: number; misses: number; pushes: number }) {
  const settled = hits + misses;
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
        {settled === 0 ? '—' : `${hits} of ${settled}`}
      </div>
      <div className="text-[11px] text-muted">
        {settled === 0
          ? 'nothing settled'
          : `${Math.round((hits / settled) * 100)}% landed${pushes > 0 ? ` · ${pushes} push` : ''}`}
      </div>
    </div>
  );
}

export default async function AllAccuracyPage() {
  let ledger: AccuracyLedger | null = null;
  try {
    ledger = await getAllSportsAccuracy();
  } catch {
    // DB unavailable — render the empty state.
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-2 py-8 sm:px-4">
      <AllSportsNav />
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: 'Accuracy' }]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">FireFactor Accuracy</h1>
        <SportSelect section="accuracy" value="all" includeAll />
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        The settled ledger across every in-season league: each recent slate&rsquo;s strongest
        pre-game <strong className="text-foreground">FireFactor</strong> leans — recomputed
        from only the game logs available <em>before</em> that slate — checked against what
        actually happened. Each row is tagged with its sport; pick a single league above.
      </p>

      {!ledger || ledger.days.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          No settled leans across any sport right now. Check back after tonight&rsquo;s games
          settle, or open a single sport&rsquo;s{' '}
          <Link href="/mlb/accuracy" className="text-brand hover:text-brand-strong">
            accuracy ledger
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Record label="All leans · recent slates" {...ledger.totals} />
            <Record label="Strong leans (Blazing / Frozen)" {...ledger.byTier.strong} />
            <Record label="Leans (Hot / Cold)" {...ledger.byTier.lean} />
          </div>

          <div className="mt-6 space-y-4">
            {ledger.days.map((d) => {
              const settled = d.hits + d.misses;
              return (
                <section
                  key={d.date}
                  aria-label={`Settled leans for ${d.date}`}
                  className="rounded-xl border border-line bg-surface p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h2 className="text-sm font-semibold">{formatIsoDate(d.date)}</h2>
                    <span className="text-sm font-semibold tabular-nums">
                      {d.hits} of {settled} landed
                      {d.pushes > 0 && (
                        <span className="font-normal text-muted"> · {d.pushes} push</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-3">
                    {/* showSport tags each row with its own league (a merged day mixes sports). */}
                    <RecapRowList rows={d.rows} showSport />
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-6 text-xs leading-relaxed text-muted">
        How to read this honestly: rows are recomputed after the fact from the same public
        game logs the live board uses, at our book-style half-point line — not a
        sportsbook&rsquo;s posted number — and without the matchup / Vegas / pace context the
        live board folds in (that context can&rsquo;t be faithfully reconstructed later). A
        small sample of settled days proves nothing either way; the point is transparency, not
        a win-rate claim. Descriptive research — never predictions, picks, or betting advice.
        See{' '}
        <Link href="/methodology" className="text-brand hover:text-brand-strong">
          the methodology
        </Link>{' '}
        for the exact math.
      </p>
    </div>
  );
}
