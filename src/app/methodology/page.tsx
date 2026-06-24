import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';
import {
  WILSON_Z_95,
  CONFIDENCE_BADGE_WIDTHS,
  DVP_LOW_SAMPLE,
  RECENT_GAMES_WINDOW,
  EWMA_ALPHA,
  SHRINKAGE_K,
  CONSISTENCY_CV_THRESHOLDS,
  FIRESCORE_WEIGHTS,
  FIRESCORE_MIN_GAMES,
} from '@/lib/stats';

export const metadata: Metadata = {
  title: 'Methodology',
  description: `Exactly how ${SITE.name} computes hit rates, sample-size confidence, matchup context, default lines, and fair price — and what it deliberately does not model.`,
  alternates: { canonical: '/methodology' },
};

// Single-sourced from the compute core so the documented numbers can never drift
// from the code that produces them.
const HIGH = CONFIDENCE_BADGE_WIDTHS.high;
const MED = CONFIDENCE_BADGE_WIDTHS.medium;

export default function MethodologyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: 'Methodology' }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">Methodology</h1>

      <Prose>
        <p>
          This page documents exactly how {SITE.name}{' '}turns public game logs into the
          numbers you see, including the constants the code actually uses. We publish it
          because a research tool is only as trustworthy as the math behind it — and
          because the most important thing we show is <strong>how much to trust each
          number</strong>, not just the number itself.
        </p>

        <h2>The data</h2>
        <p>
          Everything is computed from publicly available NBA and MLB box-score game logs,
          ingested nightly into our database. The web app only reads that data — it never
          invents it. Each player page shows a <strong>&ldquo;Stats updated through&rdquo;
          date</strong>: these are completed-game box scores refreshed once a day, not a
          live feed. If a game just finished, it may not appear until the next nightly
          update, and late official stat corrections are re-pulled for recent games.
        </p>

        <h2>Hit rate</h2>
        <p>
          For a chosen stat, line, and window (last 5, 10, 20 games, or the full season),
          we count how often the player went <em>over</em> versus <em>under</em> the line:
        </p>
        <p>
          <strong>hit rate (over) = overs / (overs + unders)</strong>
        </p>
        <p>
          Games that land exactly on the line (<em>pushes</em>) are <strong>excluded from
          the denominator</strong>, because a push is neither a win nor a loss. So a 60%
          over rate means 6 overs in 10 <em>decided</em> games, and a player can have
          fewer decided games than games played. We also show the raw game-by-game bars so
          you can see the distribution, not just the summary.
        </p>

        <h2>Sample-size confidence (the part most tools hide)</h2>
        <p>
          A hit rate from 5 games and a hit rate from 50 games are not equally
          trustworthy, so we never show a percentage on its own. For{' '}
          <em>x</em> overs in <em>n</em> decided games we compute the{' '}
          <strong>95% Wilson score interval</strong> (z = {WILSON_Z_95}) — the range the
          true rate plausibly sits in given the sample size — and display it alongside
          every hit rate. A small sample produces a wide interval, which we surface rather
          than bury.
        </p>
        <p>We map the interval&rsquo;s width to a three-level badge:</p>
        <ul>
          <li>
            <strong>High</strong> — width below {HIGH}{' '}(about {Math.round(HIGH * 100)}{' '}
            percentage points)
          </li>
          <li>
            <strong>Medium</strong> — width below {MED}
          </li>
          <li>
            <strong>Low</strong> — anything wider
          </li>
        </ul>
        <p>
          A &ldquo;4 of 5&rdquo; hot streak therefore reads as <strong>Low</strong>{' '}
          confidence, not as an edge. That honesty is the whole point.
        </p>

        <h2>Default line</h2>
        <p>
          When you open a player without entering a line, we pre-fill the{' '}
          <strong>season median</strong> for that stat, rounded to the nearest half
          (x.5) so it never pushes. We use the median rather than the average on purpose:
          counting stats are right-skewed, so the mean sits above a typical game and would
          quietly bias the default toward the over. You can type any line you like — the
          point of the tool is to check the exact number on your card.
        </p>

        <h2>Which games count (opportunity filter)</h2>
        <p>
          A garbage-time cameo or an early injury exit isn&rsquo;t a representative game,
          so we drop games where a player was barely involved. The bar is{' '}
          <strong>per player</strong>, not a fixed floor: we blend each player&rsquo;s
          season-long workload with their last {RECENT_GAMES_WINDOW}{' '}games, so part-time
          and platoon players aren&rsquo;t zeroed out. Workload means minutes in the NBA
          and plate appearances for MLB hitters; MLB pitchers are not opportunity-filtered
          (a workload proxy is misleading for them).
        </p>

        <h2>Matchup context</h2>
        <p>
          <strong>NBA — Defense vs. Position.</strong> For each opponent and position
          bucket (guards / forwards / centers) we average the stat that opponent allows,
          then rank all teams: <strong>rank 1 = allows the most</strong> (the softest
          matchup). Positions are coarse on purpose — three buckets give denser samples —
          and any cell built on fewer than {DVP_LOW_SAMPLE}{' '}player-games is flagged as low
          sample. Don&rsquo;t read precision into a noisy cell.
        </p>
        <p>
          <strong>MLB — opposing pitching.</strong> For a hitter we show how much of the
          stat the opponent&rsquo;s pitching staff has allowed per game. Pitcher props do
          not yet get a matchup number.
        </p>

        <h2>Fair-price math</h2>
        <p>
          If you enter a book&rsquo;s American odds, we convert them to an implied
          probability; if you enter <em>both</em> sides we remove the vig to show the
          no-vig fair price. The &ldquo;edge&rdquo; we display is the difference between
          the player&rsquo;s historical hit rate and that price —{' '}
          <strong>a comparison of past results against the number you typed, not a
          prediction</strong> that the over or under will hit.
        </p>

        <h2>Recent-form estimate &amp; the FireScore signal (experimental)</h2>
        <p>
          As a quick read we add a <strong>recent-form estimate</strong>: a
          recency-weighted average (EWMA, α = {EWMA_ALPHA}) of recent games, then regressed
          toward the player&rsquo;s season average by {SHRINKAGE_K}{' '}pseudo-games so a
          short hot or cold streak doesn&rsquo;t masquerade as the true level. We always
          show it as a <strong>range</strong> — last-5 mean, last-10 mean, and median next
          to the stabilized number — never one hero figure. It is a descriptive summary of
          past games, <strong>not a forecast</strong> of a specific game, and carries no
          opponent, rest, injury, or lineup adjustment.
        </p>
        <p>
          <strong>Consistency</strong> reads a player&rsquo;s floor and ceiling (the 20th
          and 80th percentiles of recent games) and labels the spread Steady, Variable, or
          Boom-Bust from the coefficient of variation (Steady below{' '}
          {CONSISTENCY_CV_THRESHOLDS.steady}, Boom-Bust at or above{' '}
          {CONSISTENCY_CV_THRESHOLDS.boomBust}). The <strong>matchup grade</strong> (A–F)
          turns the Defense-vs-Position rank into a letter — A = one of the softest matchups
          for the role, F = one of the toughest — and shows <strong>NR</strong> (not rated)
          on low-sample cells.
        </p>
        <p>
          <strong>FireScore</strong> blends these descriptive signals into one transparent
          read of how a line leans — <em>Strong lean</em>, <em>Lean</em>,{' '}
          <em>Slight lean</em>, <em>No lean</em>, or <em>Pass</em>. It is a{' '}
          <strong>research signal, not a pick, prediction, or guarantee</strong>, and it is{' '}
          <strong>experimental</strong> until our planned accuracy page validates it. Two
          things keep it honest:
        </p>
        <ul>
          <li>
            It is <strong>gated by the same Wilson lower bound</strong> as the confidence
            badge, so thin samples and hot streaks are discounted, not rewarded — leans are
            ranked by the lower bound, never the raw rate.
          </li>
          <li>
            The number is always shown with its <strong>component breakdown</strong> (hit
            rate, recent-form estimate, consistency, matchup), weighted{' '}
            {Math.round(FIRESCORE_WEIGHTS.hit * 100)}/
            {Math.round(FIRESCORE_WEIGHTS.proj * 100)}/
            {Math.round(FIRESCORE_WEIGHTS.consistency * 100)}/
            {Math.round(FIRESCORE_WEIGHTS.matchup * 100)}, and any missing input is dropped
            rather than guessed. Fewer than {FIRESCORE_MIN_GAMES}{' '}games is always a Pass.
            If you enter a real price, FireScore adds the one legitimate value read — the
            edge and expected value versus the number you typed, labeled as such and never a
            guarantee.
          </li>
        </ul>

        <h2>What we deliberately do not model</h2>
        <p>
          Being honest about the limits is part of the method:
        </p>
        <ul>
          <li>
            <strong>No live odds or prop lines.</strong> No free data source provides
            player prop lines, so lines are entered by you. We do not do line shopping or
            cross-book +EV.
          </li>
          <li>
            <strong>No schedule, injury, or lineup data.</strong> We describe past games;
            we don&rsquo;t know who is active tonight. Confirm availability yourself.
          </li>
          <li>
            <strong>No trained/fitted projection model.</strong> The recent-form estimate
            and FireScore are transparent heuristics with published weights, shown with
            their uncertainty and labeled experimental until our accuracy backtest validates
            them — not a fitted forecast of a specific game.
          </li>
          <li>
            <strong>Coarse positions and pitcher matchups.</strong> DvP uses three buckets,
            and MLB pitcher props have no matchup adjustment yet.
          </li>
        </ul>

        <p>
          In short: these are <strong>descriptive statistics about past performance</strong>,
          presented with their uncertainty — not predictions, advice, or a guarantee. See{' '}
          <Link href="/how-it-works">how it works</Link> for a friendlier walkthrough and{' '}
          <Link href="/responsible-gaming">responsible gaming</Link> before you wager.
        </p>
      </Prose>
    </div>
  );
}
