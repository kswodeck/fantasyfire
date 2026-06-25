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
  title: 'How It Works',
  description: `Exactly how ${SITE.name} works: hit rates, Wilson confidence intervals, defense-vs-position, qualifying games, default lines, fair-price math — and what it deliberately does not model.`,
  alternates: { canonical: '/how-it-works' },
};

// Single-sourced from the compute core so the documented numbers can never drift
// from the code that produces them.
const HIGH = CONFIDENCE_BADGE_WIDTHS.high;
const MED = CONFIDENCE_BADGE_WIDTHS.medium;

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
          Every number on {SITE.name}{' '}is computed from public NBA, MLB, and NFL game logs — no
          black box, no proprietary &ldquo;model&rdquo; you have to take on faith. This page
          documents exactly what we do, down to the constants the code actually uses, because a
          research tool is only as trustworthy as the math behind it — and because the most
          important thing we show is <strong>how much to trust each number</strong>, not just the
          number itself.
        </p>

        <h2>The data</h2>
        <p>
          Everything is computed from publicly available NBA, MLB, and NFL box-score game logs,
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
          When you open a player without entering a line, we pre-fill a{' '}
          <strong>book-style half-point line</strong> (x.5) so the default can never push —
          the same way a sportsbook posts a prop. We center it on the player&rsquo;s{' '}
          <strong>season median game</strong> (the typical game) and pick whichever half-point
          just below or above the median splits their games <strong>closest to 50/50</strong>{' '}
          over–under, so the default isn&rsquo;t tilted toward either side. (We don&rsquo;t just
          round the median up — that placed the line above the typical game and pushed every
          count stat toward the Under.) You can type any line you like — the point of the tool is
          to check the exact number on your card.
        </p>

        <h2>Which games count (opportunity filter)</h2>
        <p>
          A garbage-time cameo or an early injury exit isn&rsquo;t a representative game,
          so we drop games where a player was barely involved. The bar is{' '}
          <strong>per player</strong>, not a fixed floor: we blend each player&rsquo;s
          season-long workload with their last {RECENT_GAMES_WINDOW}{' '}games, so part-time
          and platoon players aren&rsquo;t zeroed out. Workload means minutes in the NBA
          and plate appearances for MLB hitters; MLB pitchers are not opportunity-filtered
          (a workload proxy is misleading for them). The matchup numbers
          (defense-vs-position / opposing pitching) use a team&rsquo;s full game logs, so
          they aren&rsquo;t affected by this per-player filter.
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
          <strong>NFL — Defense vs. Position.</strong> For each opponent and position
          bucket (QB / RB / WR / TE) we average the stat that opponent allows, then rank
          all 32 teams: <strong>rank 1 = allows the most</strong> (the softest matchup).
          As with the NBA, the buckets are coarse on purpose, and any cell built on fewer
          than {DVP_LOW_SAMPLE}{' '}player-games is flagged as low sample.
        </p>
        <p>
          <strong>MLB — opposing pitching.</strong> For a hitter we show how much of the
          stat the opponent&rsquo;s pitching staff has allowed per game. Pitcher props do
          not yet get a matchup number. The matchup, defense, estimate, and projection
          always describe the player&rsquo;s <strong>next game</strong> (or the current one
          if it has already started), not a past opponent.
        </p>
        <p>
          <strong>MLB — park factors.</strong> Each MLB player page shows their{' '}
          <strong>home park&rsquo;s</strong> run and home-run factor (1.00 = league-neutral)
          as context for their home games — Coors Field plays hitter-friendly, Oracle Park
          pitcher-friendly. These are a small static yearly table and are shown{' '}
          <strong>as context only</strong>: we do <em>not</em> fold them into the hit rates,
          because a player&rsquo;s game log already reflects the parks they&rsquo;ve played
          in, and silently re-weighting it would shift the numbers under you.
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
          <strong>Situational splits</strong> break any stat down by home/away and by days since
          the player&rsquo;s last game, and each split carries its <strong>own</strong> 95% Wilson
          confidence — so a small-sample &ldquo;crushes at home&rdquo; reads as Low, not as an edge.
          Splits describe past games in that situation; they are not a forecast.
        </p>
        <p>
          <strong>FireScore</strong> blends these descriptive signals into one transparent
          read of how a line leans — <em>Strong lean</em>, <em>Lean</em>,{' '}
          <em>Slight lean</em>, <em>No lean</em>, or <em>Pass</em>. It is a{' '}
          <strong>research signal, not a pick, prediction, or guarantee</strong>. Its status is
          decided by each sport&rsquo;s public accuracy page (
          <Link href="/nba/accuracy">NBA</Link>, <Link href="/mlb/accuracy">MLB</Link>,{' '}
          <Link href="/nfl/accuracy">NFL</Link>), whose badge moves from{' '}
          <strong>experimental</strong> → <strong>developing</strong> →{' '}
          <strong>validated</strong> based on whether the stronger tiers actually win more often
          (with the 95% Wilson lower bound above a coin flip) as graded results accumulate. Two
          things keep it honest:
        </p>
        <ul>
          <li>
            Its strength is the <strong>recency-weighted hit rate vs the line</strong> (shrunk
            toward 50% on thin samples), then scaled down by a{' '}
            <strong>95% Wilson lower-bound trust factor</strong> — so thin samples and hot streaks
            are discounted, not rewarded.
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
            <strong>No injury, lineup, or active-status data.</strong> We show the day&rsquo;s
            schedule (matchups and probable pitchers), but we describe past games and
            don&rsquo;t know who is active today. Confirm availability yourself.
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
          presented with their uncertainty — not predictions, advice, or a guarantee. New here?
          Start by <Link href="/players">browsing players</Link>, read more{' '}
          <Link href="/about">about {SITE.name}</Link>, or look up a term in the{' '}
          <Link href="/faq">FAQ &amp; glossary</Link>. And see{' '}
          <Link href="/responsible-gaming">responsible gaming</Link> before you wager.
        </p>
      </Prose>
    </div>
  );
}
