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
  PROJECTION_ADJ_BOUNDS,
  CONSISTENCY_CV_THRESHOLDS,
  FIREFACTOR_WEIGHTS,
} from '@/lib/stats';

export const metadata: Metadata = {
  title: 'How It Works',
  description: `Exactly how ${SITE.name} projects a player prop, turns it into a probability, and prices it against the no-vig market to find +EV — with the uncertainty shown, down to the constants the code uses.`,
  alternates: { canonical: '/how-it-works' },
};

// Single-sourced from the compute core so the documented numbers can never drift
// from the code that produces them.
const HIGH = CONFIDENCE_BADGE_WIDTHS.high;
const MED = CONFIDENCE_BADGE_WIDTHS.medium;
const ADJ_MIN = Math.round((1 - PROJECTION_ADJ_BOUNDS.min) * 100);
const ADJ_MAX = Math.round((PROJECTION_ADJ_BOUNDS.max - 1) * 100);

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
          {SITE.name}{' '}does three things with public game logs: it <strong>projects</strong>{' '}
          every prop, turns that projection into the <strong>probability</strong> the line clears,
          and <strong>prices it against the market</strong> to show where the number is soft. No
          black box — this page documents exactly what we do, down to the constants the code uses,
          and every number is shown with <strong>how much to trust it</strong>, because a
          projection without its uncertainty is just a guess in a nicer font.
        </p>

        <h2>The data</h2>
        <p>
          The projections are computed from publicly available NBA, MLB, and NFL box-score game
          logs, ingested nightly. On top of that we read three public feeds through the day:{' '}
          <strong>book lines and odds</strong> (PrizePicks, Underdog, and major sportsbooks),{' '}
          <strong>Vegas game odds</strong> (the total and spread), and{' '}
          <strong>injury status</strong>. The app only reads this data — it never invents it. Each
          player page shows a <strong>&ldquo;Stats updated through&rdquo; date</strong>: the box
          scores are completed-game data refreshed once a day, not a live feed, and late official
          stat corrections are re-pulled for recent games.
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

        <h2>The projection</h2>
        <p>
          The base is a <strong>recency-weighted average</strong> (EWMA, α = {EWMA_ALPHA}) of the
          player&rsquo;s recent games, regressed toward their season average by {SHRINKAGE_K}{' '}
          pseudo-games so a short hot or cold streak doesn&rsquo;t masquerade as the true level.
          That base is then <strong>adjusted for the specific game it faces</strong>, each factor a
          gentle, clamped multiplier:
        </p>
        <ul>
          <li>
            <strong>Opponent.</strong> How soft the matchup is for the role — defense-vs-position
            in the NBA and NFL, and in MLB the <strong>specific probable starter</strong>&rsquo;s
            strikeout and hits-allowed rates for a hitter, falling back to the staff when no starter
            is posted.
          </li>
          <li>
            <strong>Pace (NBA).</strong> More possessions means more shots, rebounds, and assists
            to go around, so a fast projected game nudges counting stats up. Pace is estimated
            straight from box-score totals (FGA + 0.44·FTA − OREB + TOV).
          </li>
          <li>
            <strong>Game environment.</strong> The player&rsquo;s implied team total — half the
            Vegas game total, shifted by the spread — versus the league average. A high-total spot
            is a richer scoring environment.
          </li>
          <li>
            <strong>Usage trend.</strong> Recent opportunity (minutes in the NBA, carries and
            targets in the NFL, plate appearances in MLB) versus the season baseline, so a player
            whose role just expanded is projected up before the box score fully catches up.
          </li>
        </ul>
        <p>
          Each factor is capped, and their product is capped again (about −{ADJ_MIN}% to +{ADJ_MAX}%
          overall), so context <strong>nudges</strong> the projection — it can never swing it wildly
          off the player&rsquo;s established level. Any factor whose data is missing simply drops to
          neutral. We still show the raw L5, L10, and median next to the headline number, so you can
          always see the recent form the projection is built from.
        </p>

        <h2>From projection to probability</h2>
        <p>
          A projection of 27.3 against a 26.5 line means very different things for a steady player
          and a boom-or-bust one, so we don&rsquo;t stop at the point estimate — we turn it into{' '}
          <strong>P(the line clears)</strong> using the right distribution for the stat: a{' '}
          <strong>negative binomial</strong> (or Poisson) for counts like points, strikeouts, and
          home runs, which handles a streaky player&rsquo;s fatter tails, and a{' '}
          <strong>normal</strong> for continuous stats like passing and receiving yards. That model
          probability is what feeds the projection component of FireFactor and what we compare to the
          market.
        </p>

        <h2>Matchup context</h2>
        <p>
          <strong>NBA &amp; NFL — Defense vs. Position.</strong> For each opponent and
          position bucket — guards / forwards / centers in the NBA, QB / RB / WR / TE in
          the NFL — we average the stat that opponent allows, then rank every team:{' '}
          <strong>rank 1 = allows the most</strong> (the softest matchup). The buckets are
          coarse on purpose — fewer groups give denser samples — and any cell built on
          fewer than {DVP_LOW_SAMPLE}{' '}player-games is flagged as low sample. Don&rsquo;t
          read precision into a noisy cell.
        </p>
        <p>
          <strong>MLB — opposing pitching.</strong> For a hitter we show how much of the stat the
          opponent&rsquo;s staff has allowed per game, and when the <strong>probable starter</strong>{' '}
          is known we use that pitcher&rsquo;s own rates in the projection. Pitcher props do not yet
          get a matchup number. The matchup always describes the player&rsquo;s{' '}
          <strong>next game</strong> (or the current one if it has already started).
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

        <h2>Availability</h2>
        <p>
          A great-looking number is moot if the player isn&rsquo;t taking the field, so we read the
          public <strong>injury feed</strong> — status, the actual injury, an estimated return, and
          the latest note (see the per-sport injury report). An <strong>Out</strong> (or IL) player
          is forced to <strong>No read</strong> and dropped from the board entirely, so a lean is
          never shown for someone who isn&rsquo;t playing. The game-time tiers (doubtful / questionable
          / GTD) <strong>discount FireFactor</strong> toward a coin flip and add a caution. The same
          gate runs on the board and the player page, so the read stays consistent. We surface status;
          we don&rsquo;t pretend to know a coach&rsquo;s final call.
        </p>
        <p>
          We also tie the feed to the box scores: when an impactful teammate is out, each player page
          shows how that player&rsquo;s line has historically shifted <strong>with that teammate out
          vs. in</strong> — usage often rises when a starter sits. Descriptive splits, not a forecast.
        </p>

        <h2>Market edge &amp; +EV</h2>
        <p>
          When the books we track post two-sided odds for a prop, we <strong>remove the vig</strong>{' '}
          from each and take the median to get a <strong>no-vig consensus</strong> probability — a
          sharper &ldquo;fair&rdquo; price than any single book&rsquo;s number, since the margin is
          stripped out. From that we surface the <strong>best available price</strong> on each side
          and its <strong>expected value</strong>, and we compare our model&rsquo;s probability to
          the market&rsquo;s. A book paying better than the consensus, or a model that disagrees with
          it, is where an edge lives.
        </p>
        <p>
          You can also enter a price yourself: we convert American odds to an implied probability,
          remove the vig when you enter both sides, and show the edge versus the player&rsquo;s
          history. Whether the price is scraped or typed, the edge is{' '}
          <strong>a comparison of numbers, not a promise</strong> that the over or under hits.
        </p>

        <h2>Default line</h2>
        <p>
          When you open a player without a real book line, we pre-fill a{' '}
          <strong>book-style half-point line</strong> (x.5) so the default can never push. We center
          it on the player&rsquo;s <strong>season median game</strong> and pick whichever half-point
          just below or above the median splits their games <strong>closest to 50/50</strong>{' '}
          over–under, so the default isn&rsquo;t tilted toward either side. You can type any line you
          like — the point of the tool is to check the exact number on your card.
        </p>

        <h2>Which games count (opportunity filter)</h2>
        <p>
          A garbage-time cameo or an early injury exit isn&rsquo;t a representative game,
          so we drop games where a player was barely involved. The bar is{' '}
          <strong>per player</strong>, not a fixed floor: we blend each player&rsquo;s
          season-long workload with their last {RECENT_GAMES_WINDOW}{' '}games, so part-time
          and platoon players aren&rsquo;t zeroed out. Workload means minutes in the NBA,
          plate appearances for MLB hitters, and role involvement (pass attempts, carries,
          targets) in the NFL; MLB pitchers are not opportunity-filtered. The matchup numbers use a
          team&rsquo;s full game logs, so they aren&rsquo;t affected by this per-player filter.
        </p>

        <h2>Consistency &amp; splits</h2>
        <p>
          <strong>Consistency</strong> reads a player&rsquo;s floor and ceiling (the 20th
          and 80th percentiles of recent games) and labels the spread Steady, Variable, or
          Boom-Bust from the coefficient of variation (Steady below{' '}
          {CONSISTENCY_CV_THRESHOLDS.steady}, Boom-Bust at or above{' '}
          {CONSISTENCY_CV_THRESHOLDS.boomBust}). The <strong>matchup grade</strong> (A–F)
          turns the Defense-vs-Position rank into a letter — A = one of the softest matchups
          for the role, F = one of the toughest — and shows <strong>NR</strong> (not rated)
          on low-sample cells. <strong>Situational splits</strong> break any stat down by home/away
          and by days since the player&rsquo;s last game, each with its <strong>own</strong> 95%
          Wilson confidence — so a small-sample &ldquo;crushes at home&rdquo; reads as Low, not as an
          edge.
        </p>

        <h2>FireFactor</h2>
        <p>
          <strong>FireFactor</strong> blends these signals into one transparent{' '}
          <strong>heat read</strong>. An over read runs warm — a{' '}
          <span className="font-medium text-heat-1">Warm</span>,{' '}
          <span className="font-medium text-heat-2">Hot</span>, or{' '}
          <span className="font-medium text-heat-3">Blazing</span> flame as the edge grows; an
          under read runs cool — <span className="font-medium text-ice-1">Cool</span>,{' '}
          <span className="font-medium text-ice-2">Cold</span>, or{' '}
          <span className="font-medium text-ice-3">Frozen</span> snowflake — and a balanced line
          is <em>No read</em>. The 0–100 number tracks the model&rsquo;s estimated{' '}
          <strong>chance the side hits</strong>, on a deliberately steep curve: a coin-flip line
          sits near <strong>0</strong> (a Pass), a clear edge reads as a <strong>Slight</strong> or{' '}
          <strong>Normal</strong> lean, and only a near-certain (~90%+) read approaches{' '}
          <strong>100</strong> — rare by design, because there&rsquo;s no such thing as a sure bet.
          A thin sample pulls the number back toward a coin flip until the games back it up. It is a{' '}
          <strong>research signal, not a pick, prediction, or guarantee</strong>. Three things
          keep it honest:
        </p>
        <ul>
          <li>
            It ranks by the <strong>95% Wilson lower-bound trust factor</strong>, so thin samples
            and hot streaks are discounted, not rewarded — confidence is counted, not assumed.
          </li>
          <li>
            The number is always shown with its <strong>component breakdown</strong> — hit rate,
            the projection&rsquo;s probability vs the line, consistency, and matchup, weighted{' '}
            {Math.round(FIREFACTOR_WEIGHTS.hit * 100)}/
            {Math.round(FIREFACTOR_WEIGHTS.proj * 100)}/
            {Math.round(FIREFACTOR_WEIGHTS.consistency * 100)}/
            {Math.round(FIREFACTOR_WEIGHTS.matchup * 100)}, fused in log-odds so a neutral
            component abstains rather than dragging a strong read to the middle. Any missing input
            is dropped, not guessed, and a thin sample isn&rsquo;t thrown out — the trust factor
            just makes a read much harder to reach, so only a line with no decided games at all is
            an automatic No read.
          </li>
          <li>
            FireFactor is the <strong>directional signal only</strong> — the same number on the
            board and on a player&rsquo;s page for an identical line, stat, and matchup, never
            shifted by whether odds happen to be posted. Price questions are kept{' '}
            <strong>separate</strong>: the <strong>+EV versus the no-vig market</strong>, the best
            book, and the cross-book line value each live in their own panel.
          </li>
        </ul>

        <h2>What we still don&rsquo;t model</h2>
        <p>
          Being honest about the limits is part of the method:
        </p>
        <ul>
          <li>
            <strong>No trained/fitted forecast.</strong> The projection and FireFactor are
            transparent heuristics with published weights and clamps, shown with their uncertainty —
            not a machine-learned model of a specific game.
          </li>
          <li>
            <strong>No same-game correlation.</strong> Each prop is read on its own; we don&rsquo;t
            model how a player&rsquo;s props move together or build parlays.
          </li>
          <li>
            <strong>No weather, and coarse matchups.</strong> Positions use three NBA buckets,
            MLB pitcher props get no matchup adjustment yet, and we don&rsquo;t model wind or
            temperature.
          </li>
        </ul>

        <p>
          In short: these are <strong>transparent projections priced against the market</strong>,
          every number shown with its uncertainty — research, not a pick, advice, or a guarantee. New
          here? Start by <Link href="/players">browsing players</Link>, read more{' '}
          <Link href="/about">about {SITE.name}</Link>, or look up a term in the{' '}
          <Link href="/faq">FAQ &amp; glossary</Link>. And see{' '}
          <Link href="/responsible-gaming">responsible gaming</Link> before you wager.
        </p>
      </Prose>
    </div>
  );
}
