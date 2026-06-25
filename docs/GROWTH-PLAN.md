# FantasyFire — Growth, Retention & Legitimacy Plan

_Last updated: 2026-06-24. This is a strategy/sequencing doc, not a spec. Each item lists the
concrete files it touches so it can be picked up directly._

> **Update 2026-06-25 — NFL added + FireScore.** A third sport, **NFL** (ESPN
> `football/nfl` ingest), now rides the same shared schema and section routes
> (board / streaks / trends / leaders / matchups / accuracy / players / today), so
> the "two sports" framing below is now **three** (NBA + MLB + NFL). The "projection /
> lean" idea from X1/X5 shipped concretely as **FireScore** (`src/lib/stats/fireScore.ts`)
> — a descriptive, Wilson-lower-bound-gated tier + 0–100 signal powering the per-sport
> **Top Leans** board and the `ProjectionSnapshot` → `/accuracy` calibration. NFL is
> **weekly**, not nightly, so the snapshot/grade/slate cadence needs an NFL-specific
> pass (tracked separately). Everything below predates these two changes; read it with
> that in mind.

## ✅ Shipped status (2026-06-24)

- **NOW (N0–N4):** all shipped — Umami analytics, median→raw-median default line (rebalanced Over/Under),
  per-page freshness, recent-window upsert, methodology + named author + responsible-gaming.
- **NEXT (the retention + SEO engine):**
  - **X1** ✅ player-page splits / projection / consistency / matchup-grade depth (VerdictPanel, SplitsPanel).
  - **X2** ✅ confidence-gated **Streaks** (`/[sport]/streaks`) + **Trends** (`/[sport]/trends`) boards
    (`computeStreak`, `getStreakBoard`/`getTrendBoard`, Wilson-ranked).
  - **X3** ✅ programmatic SEO family + internal-link mesh: per-stat `/[sport]/[playerSlug]/[stat]`,
    `/[sport]/leaders/[stat]`, `/[sport]/matchups` (Defense-vs-Position / Pitching-Allowed), the
    `RelatedLinks` mesh, a `SportNav` sub-nav, JSON-LD (BreadcrumbList + Dataset) + sitemap coverage.
  - **X4** ⏸️ deferred — nightly precompute tables. ISR already amortizes the DvP query to once/revalidation;
    revisit only if traffic makes per-revalidation compute a real cost.
  - **X5** ✅ projection snapshots + grading + public `/[sport]/accuracy` (recalibrated; tiers now discriminate).
- **LATER:** **L1** ✅ schedule → `/[sport]/today`; **L5** ✅ ESPN ingest fallback. L2 (push), L3 (favorites),
  L4 (OG cards), L6 (park factors) remain.

The remaining high-leverage work is acquisition (§6) + the LATER re-engagement items once traffic exists.

## The thesis

FantasyFire wins on **honesty as a moat**, not on data volume. Two assets nobody can easily copy:

1. A clean, pure compute core that already does what paid competitors won't — a **Wilson confidence
   interval on every hit rate** (sample-size honesty), an auto "why" readout, and DvP/matchup context.
2. **Full free game-log data for two sports**, ingested nightly, fully indexable (public, no login).

The binding constraint is **the solo dev's time, not data cost** — almost every high-leverage move is
pure recompute over data already in Postgres. The two hard limits to design around: **no odds/props
feed** (lines are user-entered) and **no auth** (initially).

The retention engine has two compounding loops:
- **A daily-changing reason to return** — streak/trends boards, a "tonight" slate hub, projections that
  move each night.
- **Trust that the numbers are real** — Wilson-gated badges, a public accuracy track record, a real
  methodology page, a named maintainer, and accurate freshness signals.

> **The one thing this plan refuses to forget (the skeptic's sharpest point):** you are building a
> turnstile before the stadium. ~30 of the candidate ideas retain or notify an audience you don't have
> yet, and **zero** addressed acquisition. Retention features for an audience of near-zero are wasted
> effort. Acquisition (§6) runs in parallel from day one, and **analytics ships first** so every later
> bet is measured, not guessed.

---

## What the successful competitors actually do (research takeaways)

- **Props.Cash / Outlier.bet (direct competitors):** the #1 reason users pay is **stackable situational
  splits** — "this player, at home, on 0 days rest, vs this defense." They surface a projection, a
  matchup grade (A–F), L5/L10/L20 + season hit rates, streak/heat indicators, and a value-vs-line edge.
  Most of this sits behind a paywall and behind a login → **uncrawlable**. The split/projection math is
  all free-data; the line-vs-edge and +EV parts need a paid feed.
- **PrizePicks / Underdog / Sleeper (where users actually bet):** "more/less" pick-em, trending/popular
  picks, demon/goblin, and **player streak/heater framing**. They deliberately don't give you research —
  that's the gap a free tool fills in the 60 seconds before a user locks a pick. To capture it you need
  to be fast, mobile, and answer "is this number good?" instantly.
- **Retention mechanics that work:** a dated **"today's slate" hub**, **prop-of-the-day / trends boards
  that change every morning**, fixed-time **push/email digests**, **streak trackers**, and saved players.
  The ones that don't require login: SEO boards, streak/trends pages, push (the browser subscription _is_
  the identity), and localStorage favorites.
- **SEO moat:** ~70% of search volume is **entity + market long-tail** — "[player] points prop",
  "[player] vs [team]", "NBA defense vs position", "[player] last 10 games". These are exactly the pages
  paywalled competitors **can't** rank for. Winners use programmatic per-player/per-stat/per-matchup
  pages, a one-sentence computed answer in the H1 (wins featured snippets), daily freshness for recrawl,
  and a dense internal-link mesh so nothing is orphaned.
- **Calculations credible tools show (free-data feasible):** weighted/EWMA recent projection + regression
  to season mean, opponent adjustment (we already have DvP), home/away & rest-day splits, floor/ceiling &
  consistency (CV, % over X), a projection→over-probability, and EV framing. Park factors (MLB) are a
  tiny static table. _Paid-only:_ real-time lines, line shopping, cross-book +EV.
- **Legitimacy signals (gambling-adjacent / YMYL):** a transparent **methodology page**, a public
  **accuracy/track-record backtest**, a **real named author** (E-E-A-T), accurate **data-freshness**
  stamps, conspicuous **responsible-gaming** disclosure (21+, 1-800-GAMBLER), and schema.org. Honesty
  about uncertainty (our Wilson angle) is the highest-trust, lowest-cost differentiator a no-picks tool
  can own.

---

## The reconciled roadmap

Sequenced by `(retention × SEO × trust) / effort`, **with the skeptic's corrections folded in**:
analytics first, data-correctness before the trust pillar, the internal-link mesh + freshness before the
page explosion, and push/email/schedule deferred until there's an audience and instrumentation to prove
they convert.

### NOW — cheap foundation that everything else depends on (all S-effort, all free-data)

These don't need an audience, a feed, or auth. They make the site _correct and trustworthy_ and unblock
later work. Ship them first; several are one-line or one-file changes.

**N0. Hosted cookieless analytics — ship today.**
Today there is **zero instrumentation**, so every feature bet below is blind. Add a hosted, cookieless
script tag (Umami) — _not_ a first-party events table yet — and instrument the core funnel:
player view → stat switch → line entry → fair-price use. The repo already has a gated `Analytics.tsx` +
`NEXT_PUBLIC_ANALYTICS_*` envs; just turn it on and add a few custom events.
_Why first: you cannot tell whether streaks, splits, or the slate board drive return without it._

**N1. Median default line (kills the systematic Over bias).**
`defaultLine()` at [`src/lib/server/players.ts:418`](src/lib/server/players.ts:418) currently uses the
**mean** (`mean → roundToHalfLine`). Means are right-skewed on counting stats, so the default line sits
low and every page subtly over-states the Over. Switch to the **season median**, then `roundToHalfLine`.
Add a `median()` helper (to `src/lib/format.ts` or `src/lib/stats`) with a unit test.
_This must land **early**, before any streak board, OG card, or projection snapshot caches a mean-based
line — otherwise the numbers shift retroactively under users._

**N2. Real per-page freshness.**
[`src/app/sitemap.ts`](src/app/sitemap.ts) sets a blanket `lastModified: now` on every URL including
player pages — a weak/again-false recrawl signal. Compute each player's `max(gameDate)` (one batched
`groupBy`), set per-entry `lastModified` to it, add a visible **"Stats updated through {date} — nightly
box scores, not live"** stamp on the player page header, and add a `Dataset` node with `dateModified` to
the existing JSON-LD `@graph`. Never claim "live"/"real-time" on a nightly ingest — that's itself a trust
violation.

**N3. Recent-window upsert (data correctness — a near-prerequisite for the whole trust pillar).**
[`run-ingest.ts:268`](src/ingest/run-ingest.ts:268) writes stats with `createMany({ skipDuplicates:true })`,
so a **corrected box score never overwrites** the original — a single bad stat silently poisons that
player's hit rates, streaks, projections, _and_ any future accuracy snapshot. Split writes: rows with
`gameDate >= today − 5` → per-row `upsert` on the `@@unique([playerId,gameId])`; older rows keep the fast
batched `createMany`. Do the same in `run-ingest-mlb.ts`.
_Do this **before** the public /accuracy page (NEXT) — a track record on un-correctable data is a
credibility time bomb._

**N4. Methodology page + named author + responsible-gaming guardrails.**
For a YMYL site, trust outranks every other E-E-A-T signal, and this is the highest-trust-per-hour work
the site lacks:
- New `src/app/methodology/page.tsx` that **imports the real code constants** (`WILSON_Z_95`,
  `DVP_LOW_SAMPLE`, `RECENT_GAMES_WINDOW`) so docs can't drift from code. Document hit-rate math (pushes
  excluded), the badge thresholds, DvP rank semantics, and an honest **"what is NOT modeled"** list
  (no schedule/injury/lineup, no trained model, pitcher-matchup gap).
- Promote [`src/app/about/page.tsx`](src/app/about/page.tsx) to a **real-named maintainer** with
  `Person`/`Organization` JSON-LD; add `Organization` + `WebSite` JSON-LD in `layout.tsx`.
- A unit test on `buildWhyText` asserting it **never emits banned tokens** ("guaranteed", "lock",
  "sure thing", "we predict") — locks in the descriptive-never-predictive brand.
- A persistent **21+ / 1-800-GAMBLER** disclosure strip in the footer.

### NEXT — the retention + SEO engine (build on the foundation, measured by N0)

**X1. The interactive splits/projection depth on the player page — _the un-summarizable tool._**
This is the skeptic's recommended centerpiece: build the one genuinely interactive thing AI Overviews and
ChatGPT **can't** answer inline, so the long tail links to it and returns. All pure modules in
`src/lib/stats` (unit-tested, re-exported), wired through `getPlayerResearch` + `PlayerResearchClient`:
- `splits.ts` — home/away (off the existing `isHome` flag) and **rest-day** splits (gaps in `gameDate`,
  bucketed 0/1/2/3+), each with its **own Wilson badge**.
- `projection.ts` — EWMA (α≈0.28) + shrinkage toward the season mean; show raw L5 mean **and** stabilized
  **and** median, never one hero number.
- `consistency.ts` — CV + p20/p80 floor/ceiling → Steady / Volatile / Boom-Bust badge (promote the
  existing `insight.ts` CV word).
- `matchupGrade(cell)` in `dvp.ts` — map DvP rank percentile to A–F (NR on low sample).
- Upgrade `fairPrice.ts` to emit break-even % and the Wilson CI on the historical edge.
- **Hold or heavily bury** a bare `P(over) = 64%` probability number — it reads as a prediction and
  undercuts the entire descriptive-never-predictive moat. If shipped, only _inside_ the Wilson CI framing.

**X2. Confidence-gated streak & trends boards (daily habit hook) — but mesh + freshness first.**
New pure `computeStreak(values, line)` in `src/lib/stats/streak.ts` (+ test); new
`getStreakBoard(sport)` / `getNotableLines(sport)` in `players.ts` reusing the `qualify.ts` cutoff;
new ISR routes `/[sport]/streaks` and `/[sport]/trends`, **ranked by the Wilson lower bound** (so a 70%
L5 tiny sample sits below a 65% L20 — the honest twist), with the "updated through {date}" stamp and
BreadcrumbList JSON-LD. The list changes every morning after ingest → the strongest no-auth return
mechanic, and an internal-link hub that de-orphans player pages.

**X3. Programmatic SEO page family — ship the internal-link mesh in the _same_ batch.**
New routes: `/[sport]/[playerSlug]/[stat]` (targets "[player] points prop"), `/[sport]/[playerSlug]/vs/[opponent]`
(the `opponentTeamId` index already exists), a standalone `/nba/defense-vs-position` + `/mlb/pitching-allowed`
reference, and `/[sport]/leaders/[stat]`. Each gets a **one-sentence computed-answer H1** (wins featured
snippets / AI Overviews citation), Dataset/BreadcrumbList schema, and a **`RelatedLinks` mesh**
(`src/components/RelatedLinks.tsx`) rendered as real server-side `<a>` hrefs so no page is orphaned.
Gate every page on `qualify.ts` minimums to avoid thin content. Use sub-path self-canonical URLs, not
query params. **Defer `/compare/[a-vs-b]`** — it combinatorially explodes into thin near-duplicates Google
penalizes. _AI-Overview hedge: lean on the interactive tool (X1) and on being the cited dataset source;
don't bet everything on ranking for pure factual lookups._

**X4. Nightly precompute tables (perf, before the boards scale).**
`getNbaDvp` currently runs a full-league window-function query on **every** player-page render. Materialize
DvP + the streak/trends scan into small `DvpSnapshot` / `TrendSnapshot` tables via a new
`src/ingest/run-precompute.ts` step (importing the same pure fns so snapshot and live paths can't diverge);
read snapshots first, fall back to the live query for the offseason. This is the engine the boards, push
digest, and accuracy page all read from.

**X5. THE BIGGEST BET — projection snapshot + grading + public `/accuracy`.**
The single highest-trust asset a no-picks tool can own: a self-accumulating, verifiable record.
- New `ProjectionSnapshot` model; nightly `run-snapshot.ts` freezes each qualified (player, stat)
  projection (L10 hit rate, Wilson lower bound) keyed to the player's **next game**; `run-grade.ts` grades
  it once the result lands (pushes excluded, mirroring `hitRate.ts`).
- Public `src/app/[sport]/accuracy/page.tsx` with a **calibration table**: of props we flagged ~70% over,
  how often did they actually go over? — with `n` and a Wilson interval on the _realized_ rate per bucket.
- **Guardrails are mandatory:** label everything "descriptive backtest of past performance, not a
  prediction or pick"; never a single hero win-rate; show `n` on every bucket.
- **Hard dependency:** must come **after N3 (corrections)**, and the schedule decision (X6) should be made
  first so snapshots key to a real upcoming game, not "whenever the player next plays" — otherwise the
  denominator is one users never experienced. Snapshots are append-only history you can't cleanly rewrite,
  so get the inputs right before the first one is written.

### LATER — re-engagement once an audience exists, + the data unlocks

**L1. Free schedule ingest → "Tonight" slate + matchup hub.** The #1 daily-return ritual, _but_ the skeptic
is right that on a single 10:00-UTC cron it's stale by US evening and — with **no injury/lineup feed** — it
will list benched/scratched players as "research tonight," a real trust hazard. Ship only with **(a)** a
second pre-slate cron and **(b)** a prominent "we don't know who's active — confirm yourself" disclaimer.
New `ScheduledGame` model (MLB schedule even yields free probable pitchers); routes `/[sport]/today` and
`/[sport]/matchup/[away-vs-home]`. This unblocks the "your players play tonight" upgrades below.

**L2. PWA Web Push digest.** The browser subscription _is_ the identity (honors no-auth). Value-first
opt-in after a high-intent moment (2+ views or a favorite), capped ~3–5/week, content from `TrendSnapshot`.
Real channel, but iOS web-push is fickle and opt-in rates are low pre-traffic — it **follows** the content
that earns the audience, it doesn't lead.

**L3. localStorage favorites + `/my-players`.** Zero auth, zero backend; upgrades to "N of your players play
tonight" once L1 lands. Honest caveat (device-local, clears with site data). Lower priority because an
SEO-acquired visitor often sees one page and leaves before building a list.

**L4. Shareable OG hit-rate/streak cards.** A branded growth amplifier (the Wilson badge travels with the
card), but it's a virality lottery, not a retention mechanic — amplifies surfaces that should exist first.

**L5. Ingest durability — ESPN fallback + freshness monitoring.** `IngestRun` audit row, `/api/v1/status`
+ `/status` page, and the documented ESPN scoreboard fallback for when stats.nba.com IP-blocks the runner.
Protects the freshness the whole thesis depends on.

**L6. MLB park factors** — a tiny static yearly table feeding the projection for home games. Methodology
depth; low marginal value.

**Explicitly NOT doing (and why that's a trust asset):**
- **Email digest** — a strictly more expensive duplicate of push (the only feature creating a stored
  identifier + ESP dependency + CAN-SPAM/GDPR surface) for byte-identical content. Skip unless push
  demonstrably underperforms.
- **A paid props/odds feed** — line-shopping/+EV/projection-vs-real-line are exactly what rivals charge
  $40–$400 for; chasing them is the wrong bet for a bootstrapped solo dev. Record the decision in an ADR;
  optionally scaffold a nullable `ProvidedLine` model behind a flag so a cheap feed could slot in additively
  later. Stating plainly on-site that these are omitted _because they need paid data we don't have_ is
  itself candor-as-trust versus the "AI lock of the day" crowd.

---

## §6 — The acquisition workstream (runs in parallel from day one)

SEO is the long game (months to compound). Retention features retain nobody until traffic exists. So,
alongside NOW:
- **Seed the communities where prop bettors already are** — answer "is this number good?" questions on
  r/sportsbook, r/dfsports, PrizePicks/Underdog Discords, with a genuinely useful free link (the
  player/streak page), not spam.
- **Submit to free-tool directories** and "best free prop research tools" roundups.
- **Be the citable source** — the methodology + accuracy pages and the Dataset schema make FantasyFire
  the kind of primary source AI Overviews and writers cite, which is the hedge against zero-click search.

## Risks & guardrails (carry these into every item)

- **Protect the moat:** Wilson interval shown everywhere; descriptive, never predictive. No bare
  probability headlines, no "research tonight" lists naming benched players.
- **Honesty about freshness:** "updated through {date}", never "live".
- **Thin-content risk:** gate every programmatic page on `qualify.ts`; ship the internal-link mesh with the
  pages, not after.
- **Off-season emptiness:** NBA and MLB barely overlap — every daily board needs a season-leaders fallback
  so it never looks dead in July (no NBA) or January (no MLB).
- **Measure before scaling:** N0 analytics gates the Later phase — don't harden push/email/schedule plumbing
  until the funnel shows people actually return.
