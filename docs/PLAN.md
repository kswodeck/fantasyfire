# FantasyFire — MVP Build Plan & Claude Code Instructions

NBA player-props/pickem research tool. v1 = free data only, lowest-hanging fruit, best bang-for-buck.

---

## 0. Read this first — three honest flags

**Domain: `fantasyfire.app` (confirmed).** One catch worth remembering: `.app` is on the HSTS preload list, so it's **HTTPS-only** — fine for Vercel (HTTPS by default), just don't expect any plain-HTTP fallback anywhere.

**Stack pivot from your earlier plan.** This spec uses your new stack (Next.js / TypeScript / Prisma / Postgres / Vercel), which **supersedes** the earlier "vanilla JS + Cloudflare Workers + D1" plan. **Decision: ship web + PWA for v1**, and make architecture choices *now* that keep a future mobile app cheap — see **§3b**. (Capacitor wrapping Next.js is awkward because App Router leans on Server Components / Server Actions that don't statically export cleanly; §3b is how we keep every mobile path open anyway, without leaving the stack.) This is also the standard, employable stack — good for marketability.

**The data reality (verified June 2026, verify again before relying).** The hard part of this product isn't the math — it's the data. What I confirmed:
- **balldontlie free tier** = teams, players, games only, capped ~5 req/min. **Per-game box scores are NOT free** (ALL-STAR $9.99/mo for game player stats; GOAT $39.99/mo for box scores/props/odds). So balldontlie free **cannot** power hit rates by itself.
- **the-odds-api free tier** = ~500 credits/month, h2h/spreads/totals only, **no player props**. Props are paid on every odds API I checked. So **don't** plan v1 around an automatic prop-line feed.
- **The genuinely free path for game logs + DvP is `stats.nba.com`** (NBA's own unofficial endpoints) or **ESPN's hidden JSON endpoints**. Free, no key — but unofficial, can change, and (important) **stats.nba.com often blocks datacenter/cloud IPs**, which affects where you run the ingest. Architecture below handles this.

Net: **v1 lines are user-entered/selected.** Everything else (hit rates, DvP, confidence, fair-price math) runs off free NBA game logs. This is the bang-for-buck core and matches your original 5-step build order almost exactly.

---

## 1. What v1 is (and isn't)

**In scope (all computable from free game logs):**
1. **Player hit-rate visuals** — for a chosen stat (pts, reb, ast, 3PM, PRA, etc.) and a user-entered line, show over/under hit rate across L5 / L10 / L20 / season, color-coded, with the raw game-by-game bars.
2. **Defense vs. Position (DvP)** — per opponent team + position + stat, the average allowed, ranked 1–30. This is your "Step 3" derived metric.
3. **Sample-size honesty** — a confidence indicator using a Wilson interval on each hit rate, so a "4/5 L5" doesn't masquerade as a real edge. *This is a differentiator — almost no competitor does it.*
4. **Plain-language "why"** — a short auto-generated readout per prop: recent form, the matchup (DvP rank), and volatility. *Second differentiator.*
5. **Fair-price readout** — if the user enters the book's odds, show implied probability, no-vig fair price (when both sides entered), and the edge vs. the historical hit rate.
6. **Programmatic SEO pages** — one statically-generated, indexable page per player (and later per matchup). *This is your real moat as a bootstrapper — most prop tools sit behind a login and aren't indexable.*

**Explicitly deferred (do NOT build in v1):**
- Live/automatic prop odds feeds, line shopping, +EV scanning across books.
- DFS optimizer / Monte Carlo sims / ownership projections.
- Bet auto-sync / CLV tracking.
- Game lines (spreads/moneylines/totals).
- A trained projection model (your "Step 5" — comes later).
- Subscriptions/payments.
- Auth — see note below.

**Auth decision: skip Auth.js entirely for v1.** The core is public, read-only, SEO-driven browsing — no login needed, and public pages are better for SEO. Add Auth.js later when you introduce "save favorites"/subscriptions. Design the `/api/v1` handlers now so adding an auth check later is a one-line change (see §3b).

---

## 2. Data sources — the decision

**Primary (free): `stats.nba.com`**, two bulk endpoints, pulled on a schedule:
- **`playerindex`** → every player with `PERSON_ID`, name, `TEAM_ID`, and **`POSITION`** (one call). Gives you positions for DvP.
- **`leaguegamelog`** (`PlayerOrTeam=P`) → every player's game-by-game box score for the season, including `PLAYER_ID`, `TEAM_ID`, `MATCHUP` (encodes opponent + home/away), and all the counting stats. It returns the **full set in one response** (no real pagination). 

Both use the same `PLAYER_ID`, so they join cleanly. **One nightly pull gets the entire league** — no per-player rate-limit hell. This is the elegant bit, and DvP falls straight out of the same data (you already have every player's line + position + opponent).

**Critical gotcha — where you run the ingest.** `stats.nba.com` frequently **blocks AWS/Vercel/cloud IP ranges** (requests hang/timeout). So **do not run the ingest from a Vercel function.** Run it as a **scheduled GitHub Actions workflow** that writes to Postgres. (Even GH Actions IPs are *occasionally* blocked — if that happens, fall back to ESPN, or run the ingest from a tiny VPS or locally on a cron.) This separation (ingest worker → DB; web app → reads DB) is good architecture regardless and echoes your original "caching backend" instinct.

**Required headers for `stats.nba.com`** (without these it hangs):
```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36
Accept: application/json, text/plain, */*
Accept-Language: en-US,en;q=0.9
Referer: https://www.nba.com/
Origin: https://www.nba.com
x-nba-stats-origin: stats
x-nba-stats-token: true
Connection: keep-alive
```
Response shape is **columnar**: `resultSets[0].headers` (array of column names) + `resultSets[0].rowSet` (array of value-arrays). Map headers→values per row. Throttle to ~1 req/sec; cache aggressively.

**Fallback (free, more robust against cloud-IP blocking): ESPN hidden endpoints** — e.g. `site.api.espn.com/apis/site/v2/sports/basketball/nba/...` for scoreboards/teams and `sports.core.api.espn.com/v2/...` for athletes/box scores. More calls and messier traversal than NBA's bulk endpoints, but rarely blocks datacenter IPs. Keep this as a documented Plan B.

**Optional (free, clean) for player metadata only: balldontlie free tier** (`/players`, `/teams`, `/games`). Has a clean `position` field. Downside: its IDs don't map to `PLAYER_ID`, so you'd join by name (fuzzy). Use only if you skip `playerindex`.

**Lines for v1: user-entered.** A simple input ("enter the line you're looking at"), plus optional odds inputs for the over/under to drive the fair-price readout. **Later** (Phase 5+), if you want automatic lines, budget for a paid props feed — that's the one place free data runs out.

---

## 3. Architecture

```
┌─────────────────────────┐        ┌──────────────────────┐
│ GitHub Actions (cron)   │ writes │  PostgreSQL          │
│ ingest worker (TS)      ├───────►│  (Neon / Supabase)   │
│ - stats.nba.com pull    │        └──────────┬───────────┘
│ - upsert via Prisma     │                   │ reads (Prisma)
└─────────────────────────┘                   ▼
                                   ┌──────────────────────┐
                                   │  Next.js (Vercel)    │
                                   │  - ISR player pages  │
                                   │  - hit-rate / DvP    │
                                   │    computed on read  │
                                   │  - Route Handlers    │
                                   │    for interactive   │
                                   │    line lookups      │
                                   └──────────────────────┘
```

- **Postgres host for v1:** **Neon** or **Supabase** free tier (both serverless Postgres, both work great with Prisma + Vercel). Your spec lists AWS RDS as a later add-on — keep RDS for production scale; a free serverless Postgres is the right v1 choice. Use a **pooled** connection string for the app (`DATABASE_URL`) and a **direct** one for migrations (`DIRECT_URL`).
- **Compute-on-read with ISR:** player pages are statically generated and revalidated (e.g., hourly). Interactive "change the line" lookups hit a Route Handler that queries Postgres and computes the hit rate live (it's cheap and indexed). Add **TanStack Query** on the client for the interactive line/stat switching (your stack lists it for interaction-heavy UI — this qualifies).

---

## 3b. Mobile-ready architecture decisions (web + PWA now, cheap mobile later)

Goal: ship web + PWA in v1, but make a future mobile app (Capacitor wrapper, or a thin native / React Native client) cheap — **without adding anything outside the chosen stack**. The whole strategy rests on one decision: **a stable, versioned JSON API boundary that both the website and any future mobile client consume.**

1. **JSON API is the source of truth.** Expose every read the client needs as versioned Route Handlers under `/api/v1/*` (e.g. `/api/v1/players/[slug]`, `/api/v1/hitrate`, `/api/v1/players` for search). SSR player pages may read Postgres directly via Prisma for SEO speed, but anything **interactive** goes through `/api/v1`. A future Capacitor webview or native app calls the exact same endpoints. (In-stack: Route Handlers + TanStack Query are both already in your stack.)
2. **Prefer Route Handlers over Server Actions for the client data path.** Server Actions couple the client to React Server Components and don't translate to a native client. Plain JSON Route Handlers keep the client path framework-portable.
3. **Presentational components are data-agnostic.** Components receive data via props; fetching lives in hooks (`useHitRate`, etc.). The same components render under SSR (data from the server) and in a future client-only build (data from `/api/v1`). No server-only imports inside presentational components.
4. **The interactive slice is fully client-capable.** Line/stat switcher, fair-price calc, and search all work purely client-side against `/api/v1`. That slice could later be statically built and wrapped by Capacitor, pointed at the deployed API — no server runtime needed in the wrapper.
5. **Framework-agnostic core.** All compute (`src/lib/stats`, `src/lib/odds`) stays pure TypeScript with zero Next/React imports (already planned). If you ever move to React Native, the entire compute + types layer ports unchanged.
6. **PWA-first is the bridge.** A proper installable PWA (manifest + service worker + offline shell, Phase 5) IS a mobile app for most users and is the cheapest path. You may not need Capacitor for a long time.
7. **Deep-linkable URLs + state in the URL.** Clean `/[playerSlug]` routes map directly to mobile deep links / universal links later. Keep meaningful UI state (selected stat + line) in the URL query so links are shareable and restorable — also better for SEO and for a native shell.
8. **Browser storage is cache-only.** Use the API + URL as the source of truth; treat localStorage/IndexedDB as a cache. Avoids state divergence and makes the native path trivial. (Capacitor supports storage, but don't depend on it for correctness.)
9. **Auth- and CORS-ready API (even though v1 has no auth).** Structure `/api/v1` handlers so adding an auth-header check later is a one-line middleware change, and scope CORS to your known origins (expandable to a future Capacitor/native origin) rather than `*`.

**Both mobile paths stay open, and what keeps each open:**
- **Capacitor wrapping a static client build** ← kept open by #3, #4, #8 (interactive slice runs client-only against the API).
- **Native / React Native client consuming the API** ← kept open by #1, #2, #5, #9 (stable versioned JSON + portable core).

**Honest tradeoff:** routing interactive reads through `/api/v1` + TanStack Query is marginally more code now than pure Server Components/Server Actions, and slightly less "idiomatic RSC." Since you explicitly want mobile cheap later, this is the right trade — and it stays entirely inside your chosen stack.

---

## 4. Prisma data model (starting schema)

```prisma
model Team {
  id           Int      @id @default(autoincrement())
  nbaId        Int      @unique
  abbreviation String   @unique
  name         String
  conference   String?
  division     String?
  players          Player[]
  homeGames        Game[]   @relation("home")
  awayGames        Game[]   @relation("away")
  playerGameStats  PlayerGameStat[] @relation("statTeam")
  opponentStats    PlayerGameStat[] @relation("statOpponent")
}

model Player {
  id        Int      @id @default(autoincrement())
  nbaId     Int      @unique          // PERSON_ID / PLAYER_ID
  firstName String
  lastName  String
  slug      String   @unique          // for SEO URLs, e.g. "lebron-james"
  position  String?                   // raw, e.g. "G", "F-C"
  posBucket String?                   // normalized: "G" | "F" | "C"
  teamId    Int?
  team      Team?    @relation(fields: [teamId], references: [id])
  gameStats PlayerGameStat[]
  @@index([lastName])
}

model Game {
  id         Int      @id @default(autoincrement())
  nbaId      String   @unique          // NBA GAME_ID is a zero-padded string
  date       DateTime
  season     String                    // "2025-26"
  homeTeamId Int
  awayTeamId Int
  homeTeam   Team     @relation("home", fields: [homeTeamId], references: [id])
  awayTeam   Team     @relation("away", fields: [awayTeamId], references: [id])
  stats      PlayerGameStat[]
  @@index([date])
}

model PlayerGameStat {
  id             Int      @id @default(autoincrement())
  playerId       Int
  gameId         Int
  teamId         Int
  opponentTeamId Int
  isHome         Boolean
  season         String
  gameDate       DateTime                 // denormalized for fast "last N" queries
  minutes        Float?
  points         Int
  rebounds       Int
  assists        Int
  steals         Int
  blocks         Int
  turnovers      Int
  fgm            Int
  fga            Int
  fg3m           Int
  fg3a           Int
  ftm            Int
  fta            Int
  player       Player @relation(fields: [playerId], references: [id])
  game         Game   @relation(fields: [gameId], references: [id])
  team         Team   @relation("statTeam", fields: [teamId], references: [id])
  opponentTeam Team   @relation("statOpponent", fields: [opponentTeamId], references: [id])
  @@unique([playerId, gameId])
  @@index([playerId, gameDate])
  @@index([opponentTeamId, season])
}
```

Composite stats (PRA = pts+reb+ast, PR, PA, RA, stocks = stl+blk) are **derived in code**, not stored. DvP can start as on-read SQL aggregation; if it gets slow, materialize it into a `DefenseVsPosition` table built by the nightly job.

---

## 5. The four algorithms (spell these out for Claude Code)

### 5a. Hit rate
For a player, stat `S`, line `L`, window `N ∈ {5,10,20,season}`:
- Pull the player's most recent `N` games by `gameDate` (or all, for season).
- `overs = count(games where value(S) > L)`, `unders = count(value(S) < L)`, `pushes = count(value(S) == L)`.
- `hitRateOver = overs / (N - pushes)` (exclude pushes from the denominator). Display as `overs/N` plus the percentage.
- Also return the raw per-game values for the bar chart and the **mean** and **standard deviation** of `S` over the window.

### 5b. Defense vs. Position (DvP)
For opponent team `T`, position bucket `P ∈ {G,F,C}`, stat `S`, over a window (start with **season**; consider last ~20 team games for recency later):
- `avgAllowed(T,P,S) = mean(value(S))` over all `PlayerGameStat` where `opponentTeamId = T` AND `player.posBucket = P`.
- Rank all 30 teams for `(P,S)`; **rank 1 = allows the most** (softest matchup / best for the over).
- Return rank, raw average, and **sampleSize** (number of player-games in the cell). Flag low-sample cells.
- **Caveat to surface in UI:** positions are coarse (NBA labels are loose; many players are multi-position). v1 uses 3 buckets for denser samples. Map raw → bucket: anything containing "G" → G; else containing "F" → F; else "C". Refine later.

### 5c. Confidence (sample-size honesty) — Wilson score interval
Don't just show the point estimate. For `overs = x` successes in `n = N - pushes` trials, compute the 95% **Wilson interval** (z = 1.96):
```
center = (p̂ + z²/(2n)) / (1 + z²/n)
margin = ( z * sqrt( (p̂(1-p̂) + z²/(4n)) / n ) ) / (1 + z²/n)
lower  = center - margin ;  upper = center + margin
where p̂ = x / n
```
Small `n` → wide interval → low confidence. Map interval width to a 3-level badge (e.g., width < 0.25 → High, < 0.45 → Medium, else Low) and **show the interval**, not just the badge. This is the honest, cheap, differentiating feature — lean into it.

### 5d. Fair-price readout (only if user enters odds)
American odds → implied probability:
```
odds > 0 : implied = 100 / (odds + 100)
odds < 0 : implied = (-odds) / ((-odds) + 100)
```
If the user enters **both** sides (over odds + under odds), remove the vig (multiplicative):
```
fairOver = impliedOver / (impliedOver + impliedUnder)
```
Implied probability → fair American odds:
```
p > 0.5 : american = -round( 100 * p / (1 - p) )
p ≤ 0.5 : american =  round( 100 * (1 - p) / p )
```
**Edge** = `historicalHitRateOver − fairProbOver` (or `− impliedOver` if only one side was entered). Positive ⇒ the history suggests value on the over *relative to this price*. **Label it honestly:** "Based on recent history vs. the price you entered — not a guarantee."

---

## 6. Build phases

- **Phase 0 — Scaffold:** Next.js (App Router, TS) + Tailwind + Prisma + Zod + Vitest/Playwright + ESLint/Prettier. Repo hygiene, env handling, CI skeleton.
- **Phase 1 — Data layer:** Prisma schema + the ingest worker (stats.nba.com `playerindex` + `leaguegamelog`, columnar parser, throttle, upsert). Run it once locally to seed; wire the GitHub Actions cron.
- **Phase 2 — Compute layer:** pure, unit-tested functions for hit rate, DvP, Wilson confidence, odds/fair-price math. No UI yet — just functions + Vitest tests with known inputs.
- **Phase 3 — Player pages (SEO core):** ISR route `/[playerSlug]` — game-log bar chart, hit-rate cards (L5/L10/L20/season) with a default line, DvP context, the auto-"why" readout. Sitemap + per-page metadata. This is the shippable heart of v1.
- **Phase 4 — Interactivity:** line/stat switcher (TanStack Query → Route Handler), the odds inputs + fair-price readout, a player search/index page.
- **Phase 5 — Polish & ship:** PWA manifest + service worker, OG images, basic analytics, deploy to Vercel, point the domain. *(Later: matchup pages, more sports, paid odds feed, auth + favorites, projection model.)*

---

## 7. Folder structure (target)

```
fantasyfire/
├─ docs/PLAN.md                  ← save THIS file here
├─ prisma/schema.prisma
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                ← home / search
│  │  ├─ [playerSlug]/page.tsx   ← ISR player page (reads DB directly for SEO)
│  │  └─ api/v1/                 ← versioned JSON API (source of truth for clients)
│  │     ├─ hitrate/route.ts     ← live line lookups
│  │     ├─ players/route.ts     ← search / list
│  │     └─ players/[slug]/route.ts
│  ├─ lib/
│  │  ├─ db.ts                   ← Prisma client singleton
│  │  ├─ stats/                  ← hit rate, DvP, Wilson (pure fns, no React)
│  │  ├─ odds/                   ← implied prob, de-vig, fair price (pure fns)
│  │  └─ schemas/                ← Zod schemas
│  ├─ components/                ← chart, cards, badges (data-agnostic, props in)
│  ├─ hooks/                     ← useHitRate etc. (TanStack Query → /api/v1)
│  └─ ingest/
│     ├─ nba/                    ← PROVIDED reference client (drop in as-is)
│     │  ├─ http.ts  columnar.ts  matchup.ts  client.ts  types.ts  index.ts
│     │  └─ client.test.ts
│     └─ run-ingest.ts           ← upsert players/games/stats (orchestration)
├─ tests/                        ← Vitest unit + Playwright e2e
├─ .github/workflows/
│  ├─ ci.yml                     ← lint + test on push
│  └─ ingest.yml                 ← scheduled data pull
├─ .env.example
└─ ...
```

## 8. Environment variables (`.env.example`)
```
DATABASE_URL=            # pooled Postgres URL (app)
DIRECT_URL=              # direct Postgres URL (migrations)
NBA_SEASON=2025-26       # current season string
# Optional / later:
BALLDONTLIE_API_KEY=     # only if used for metadata
THE_ODDS_API_KEY=        # only if you add a paid props feed later
AUTH_SECRET=             # only when Auth.js is enabled
```

---

## 9. How to use this with Claude Code

1. Create the folder and drop this file in it: `fantasyfire/docs/PLAN.md`.
2. Open Claude Code in the `fantasyfire` directory.
3. Paste the prompts below **in order**. Each ends with "stop and let me review" so you stay in control and can test between phases. Don't paste them all at once.
4. Before Phase 1's ingest runs, sign up for a free Postgres (Neon/Supabase), put the URLs in `.env`, and have your `NBA_SEASON` set correctly.

---

## 10. Claude Code prompts (paste in order)

### ▶ Prompt 0 — Scaffold
```
Read docs/PLAN.md fully before doing anything. We're building "FantasyFire," the NBA props research MVP described there. Stack: TypeScript, Next.js (App Router), Prisma, PostgreSQL, Zod, Tailwind, deploying to Vercel. Use pnpm.

Phase 0 only — scaffold the project:
- Initialize a Next.js App-Router app in TypeScript with Tailwind, in this directory.
- Add and configure: Prisma, Zod, ESLint + Prettier, Vitest (unit), and Playwright (e2e) with minimal passing example tests.
- Create the folder structure from docs/PLAN.md §7 (empty placeholder files where needed).
- Create .env.example exactly as in §8, and a src/lib/db.ts Prisma client singleton (guard against hot-reload duplication).
- Add two GitHub Actions workflows: ci.yml (install, lint, test on push/PR) and an empty ingest.yml stub I'll fill in Phase 1.
- Write a clear README with setup steps.

Do NOT build features yet. When done, summarize what you created, list every command I should run to verify it works locally, and stop for my review.
```

### ▶ Prompt 1 — Data layer + ingest
```
Phase 1 (per docs/PLAN.md §2, §3, §4). Build the data layer.

1. Implement the Prisma schema from §4 exactly. Generate the client and create the initial migration.
2. Build the ingest worker in src/ingest/:
   - Use the PROVIDED reference client in src/ingest/nba/ (http.ts, columnar.ts, matchup.ts, client.ts, types.ts, index.ts, client.test.ts). Drop those files in as-is and run their Vitest tests — do NOT rewrite them. If the NBA has renamed columns, the client's assertColumns() warnings will name exactly what to fix.
   - The client exposes getPlayerIndex() and getLeagueGameLog(), returning typed rows. leaguegamelog returns the FULL season in one response (no pagination). MATCHUP parsing, posBucket, slugs, throttling, timeouts, and cloud-IP-block detection are already handled inside it.
   - Build run-ingest.ts using the orchestration sketch in the reference README as the starting point: derive teams from the game log, upsert teams → players → games → player game stats idempotently, and batch the writes (createMany with skipDuplicates / transactions) for speed. Log a summary (counts) at the end.
3. Add a pnpm script `ingest` that runs run-ingest.ts (via tsx).
4. Fill in .github/workflows/ingest.yml to run the ingest on a daily schedule and on manual dispatch, using repo secrets for DATABASE_URL/DIRECT_URL. Add a comment noting stats.nba.com may block cloud IPs and that ESPN is the documented fallback (don't build ESPN yet).

Important: these endpoints are unofficial. Make the client resilient and log clearly if a request hangs/blocks. After building, run the ingest against my local .env, show me the row counts, and stop for review. If stats.nba.com blocks the request, tell me explicitly rather than faking data.
```

### ▶ Prompt 2 — Compute layer (pure functions + tests)
```
Phase 2 (per docs/PLAN.md §5). Build pure, well-tested computation functions in src/lib/stats and src/lib/odds. No UI.

- src/lib/stats/hitRate.ts: given a player's ordered game values, a stat, a line, and a window, return overs/unders/pushes, hit rate (pushes excluded from denominator), the per-game values, mean, and stdev. Support windows 5/10/20/season and composite stats (PRA, PR, PA, RA, stocks).
- src/lib/stats/dvp.ts: given game-stat rows, compute average stat allowed per (opponentTeam, posBucket, stat), rank teams 1–30 (1 = allows most), and return rank, raw avg, and sampleSize per cell.
- src/lib/stats/confidence.ts: 95% Wilson score interval (formula in §5c), plus the width→badge mapping (High/Medium/Low).
- src/lib/odds/fairPrice.ts: americanToImplied, deVigTwoWay (multiplicative), impliedToAmerican, and an edge calculator (formulas in §5d).
- Define Zod schemas in src/lib/schemas for all inputs.

Write thorough Vitest unit tests with hand-computed expected values (include edge cases: pushes, n=0, tiny samples, favorite vs underdog odds signs, devig). Make all tests pass. Then summarize coverage and stop for review.
```

### ▶ Prompt 3 — Player pages (the SEO core)
```
Phase 3 (per docs/PLAN.md §1 items 1–4 & 6, and §5). Build the ISR player page — the heart of v1.

- Route src/app/[playerSlug]/page.tsx, statically generated for all players with generateStaticParams, revalidated hourly (ISR). Read from Postgres via Prisma; compute hit rates, DvP context, and Wilson confidence on the server using the Phase 2 functions.
- Default to the points stat with a sensible default line (e.g., the player's season average rounded to .5). Show:
  - a game-by-game bar chart of the last 20 games vs the line (color over/under),
  - hit-rate cards for L5/L10/L20/season, each with the over/under split AND the Wilson confidence badge + interval,
  - a DvP block for tonight's/most-recent opponent: rank + raw allowed + sample-size flag,
  - an auto-generated plain-language "why" paragraph combining recent form, the DvP matchup, and volatility (stdev). Keep it factual and hedged.
- Add full SEO: per-player <title>/description/canonical/OpenGraph metadata, JSON-LD, and a dynamic sitemap.xml covering all player pages. Build a simple home/search page listing/finding players.
- Style with Tailwind: clean, fast, mobile-first, uncluttered, no ads. This UX is a stated differentiator.
- Mobile-ready (per §3b): keep presentational components data-agnostic (data in via props); no server-only imports inside them. This page reads data server-side for SEO, but the components must be reusable by a future client-only/mobile build.

Add a Playwright e2e test that loads a known player page and asserts the cards/chart render. Then stop for review.
```

### ▶ Prompt 4 — Interactivity (live line lookups + fair price)
```
Phase 4 (per docs/PLAN.md §1 item 5, §3, §3b, §5d). Make it interactive.

- Add a Route Handler src/app/api/v1/hitrate/route.ts that takes { playerSlug, stat, line } (validate with Zod), queries Postgres, and returns hit rates + Wilson confidence for all windows. This versioned JSON API is the canonical data source for the client AND for any future mobile app (per §3b), so keep it clean and stable. Also add src/app/api/v1/players (search/list).
- On the player page, add a stat selector and an editable line input wired with TanStack Query (in src/hooks) to that endpoint, so changing the stat/line live-updates the cards and chart without a full reload. Reflect selected stat + line in the URL query so links are shareable.
- Add optional "over odds" and "under odds" American-odds inputs that drive the fair-price readout (implied prob, no-vig fair price when both entered, and edge vs the displayed hit rate) using src/lib/odds. Label results honestly as historical-vs-price, not a guarantee.
- Keep everything fast, mobile-first, and fully client-capable against /api/v1 (don't use Server Actions for these reads).

Add tests for the Route Handler (valid + invalid input). Then stop for review.
```

### ▶ Prompt 5 — PWA + ship
```
Phase 5 (per docs/PLAN.md §1, §6). Production polish and deploy prep.

- Add PWA support: web manifest, icons, and a service worker for offline shell + caching of static assets (use a maintained Next.js PWA approach; don't use browser localStorage for app state).
- Add dynamic OG images for player pages, a robots.txt, and lightweight privacy-friendly analytics (configurable, off by default).
- Add a Vercel deployment config and document the exact steps to deploy and to connect the fantasyfire.app domain (note: HTTPS-only due to .app HSTS preload).
- Confirm the ingest GitHub Action and the web app read/write the same Postgres correctly in a deployed setting.
- Update the README with the full local + prod runbook.

Summarize deployment steps and any remaining manual actions, then stop.
```

---

## 11. Things to watch (so they don't bite you)
- **stats.nba.com from the cloud:** if the GitHub Action's ingest times out, that's the cloud-IP block. Switch the ingest to ESPN endpoints or run it from a small always-on box / local cron. Don't waste hours assuming your code is broken.
- **Season string & off-season:** `leaguegamelog` returns little/nothing in the offseason. Make `NBA_SEASON` configurable and handle empty data gracefully.
- **Coarse positions** make DvP noisy for hybrid players — that's why v1 buckets to G/F/C and shows sample size. Don't over-claim DvP precision in the UI.
- **Small samples** are the whole reason for the Wilson interval — make sure the UI actually *shows* uncertainty rather than hiding it behind a single percentage. That honesty is the product's edge.
- **Legal/compliance:** this is gambling-adjacent. State-by-state legality, affiliate licensing in some states, and app-store gambling policies all apply later. I'm not a lawyer — get it reviewed before monetizing or submitting to app stores.
- **Verify the data-source facts** (tiers, limits, endpoints) again at build time — this space changes monthly.
```
