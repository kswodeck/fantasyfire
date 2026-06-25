# FantasyFire 🔥

Multi-sport player-props research tool — **NBA, MLB, and NFL**. Hit rates,
matchup context (defense-vs-position / opposing pitching), sample-size confidence
(Wilson intervals), fair-price math, and a transparent "is this a good prop?"
FireScore — all computed from **free, public game logs**. Public, read-only,
SEO-driven. No login.

Origins and the original single-sport spec: [`docs/PLAN.md`](docs/PLAN.md)
(historical). Current strategy/sequencing: [`docs/GROWTH-PLAN.md`](docs/GROWTH-PLAN.md).

## What it does

- **Player pages** — per stat and a user-entered line, over/under hit rates across
  L5 / L10 / L20 / season with the raw game-by-game bars, each with a **Wilson
  confidence** badge + interval so a short hot streak can't masquerade as an edge.
- **Matchup context** — defense-vs-position (NBA, NFL) / opposing-pitching-allowed
  (MLB), ranked, with sample-size flags and an A–F matchup grade.
- **Depth panels** — home/away & rest-day splits, an EWMA + shrinkage projection,
  consistency (floor/ceiling), and an auto plain-language "why" readout.
- **FireScore** — a descriptive lean signal (tier + 0–100, gated by the Wilson
  lower bound) on the per-sport **Top Leans** board. Never a pick or +EV claim.
- **Daily-changing boards** — Today's slate, Streaks, Trends, Leaders, Matchups.
- **/accuracy** — a public, self-accumulating calibration backtest (snapshots are
  frozen nightly and graded once the game lands). Honest track record, not a pick log.
- **Fair-price readout** — enter the book's odds → implied probability, no-vig fair
  price, and edge vs. the historical hit rate.
- **Programmatic SEO** — indexable per-player, per-stat, per-matchup, and leader
  pages with a dense internal-link mesh, JSON-LD, and a dynamic sitemap. Most
  competitors sit behind a login and aren't crawlable — this is the moat.

## Stack

| Layer        | Choice                                                       |
| ------------ | ------------------------------------------------------------ |
| Framework    | Next.js 16 (App Router) + React 19 + TypeScript              |
| Styling      | Tailwind CSS v4                                              |
| Data         | PostgreSQL (Supabase / Neon) via Prisma 7 (`pg` adapter)     |
| Validation   | Zod v4                                                       |
| Client state | TanStack Query v5                                            |
| Tests        | Vitest (unit) + Playwright (e2e)                            |
| Ingest       | stats.nba.com · statsapi.mlb.com · ESPN football/nfl → Postgres (GitHub Actions) |
| Hosting      | Vercel (web) + GitHub Actions (nightly ingest + grading)     |

## Prerequisites

- **Node.js ≥ 20** (Next 16 needs ≥ 18.17; Prisma 7 needs ≥ 18.18 — use 20/22 LTS).
- **pnpm** (`corepack enable pnpm`).
- A **PostgreSQL** database. Free serverless options: [Supabase](https://supabase.com)
  or [Neon](https://neon.tech). You need two connection strings:
  - `DATABASE_URL` — **pooled** (app runtime + build)
  - `DIRECT_URL` — **direct/session** (migrations / CLI)

  See [`docs/SETUP.md`](docs/SETUP.md) for the exact Supabase pooler ports.

> This repo was scaffolded with a portable Node 22 toolchain under
> `C:\Development\.toolchain`. If you have your own Node ≥ 20 on PATH you can
> ignore that. To re-use it, prepend it to PATH:
> `export PATH="/c/Development/.toolchain/node-v22.23.1-win-x64:$PATH"`.

## Setup

```bash
# 1. Install deps (runs `prisma generate` via postinstall)
pnpm install

# 2. Configure environment
cp .env.example .env        # then fill in DATABASE_URL / DIRECT_URL

# 3. Create the schema in your database
pnpm db:migrate             # dev: creates + applies a migration
# (in CI/prod use: pnpm db:deploy)

# 4. Pull REAL data (run OUTSIDE a cloud IP for NBA; see "data reality" below)
pnpm ingest                 # NBA  (stats.nba.com)
pnpm ingest:mlb             # MLB  (statsapi.mlb.com)
pnpm ingest:nfl             # NFL  (ESPN football/nfl)
pnpm schedule               # upcoming slate (for the "Today" hub)

# 5. Run the app
pnpm dev                    # http://localhost:3000
```

There is **no synthetic seed** — the app runs on real ingested game logs. In the
off-season a sport simply has no upcoming slate and is hidden from the home page
(its historical pages still render).

## The data reality (read this)

The hard part of this product is the data, not the math.

- **Lines are user-entered.** No free API provides player prop lines; the app
  computes everything else (hit rates, matchup context, confidence, fair price,
  FireScore) from game logs.
- **Three free, keyless, unofficial sources**, one ingest job each:
  - **NBA → `stats.nba.com`** (`playerindex` + `leaguegamelog`). Free but
    **frequently blocks datacenter/cloud IPs** (AWS / Vercel / sometimes CI).
  - **MLB → `statsapi.mlb.com`** — generally **not** IP-blocked.
  - **NFL → ESPN's hidden `football/nfl` API** — generally **not** IP-blocked
    (ESPN is also the documented NBA fallback host).
- **Therefore the ingest does NOT run on Vercel.** It runs as a scheduled
  [GitHub Action](.github/workflows/ingest.yml) that writes to Postgres; the web app
  only reads. If the **NBA** step fails with `NbaLikelyBlockedError` (every request
  timed out), that's the IP block — re-run, move it to a VPS/local cron, or rely on
  the ESPN fallback ([`src/ingest/espn-fallback.ts`](src/ingest/espn-fallback.ts)).
  The MLB/NFL steps still run when NBA is blocked. **Do not fabricate data.**
- The NBA client (`src/ingest/nba/`) bakes in the required browser-like headers,
  rate limiting, retries, and block detection. See
  [`docs/nba-client-reference.md`](docs/nba-client-reference.md).

## Scripts

| Command             | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `pnpm dev`          | Next.js dev server                                    |
| `pnpm build`        | `prisma generate` + production build                  |
| `pnpm start`        | Run the production build                              |
| `pnpm lint`         | ESLint                                                |
| `pnpm typecheck`    | `tsc --noEmit`                                        |
| `pnpm test`         | Vitest unit tests                                     |
| `pnpm test:nba`     | Just the NBA client tests                             |
| `pnpm e2e`          | Playwright e2e (needs `playwright install` + a DB)    |
| `pnpm format`       | Prettier write                                        |
| `pnpm ingest`       | Pull NBA data (stats.nba.com → Postgres)              |
| `pnpm ingest:mlb`   | Pull MLB data (statsapi.mlb.com → Postgres)           |
| `pnpm ingest:nfl`   | Pull NFL data (ESPN football/nfl → Postgres)          |
| `pnpm schedule`     | Pull the upcoming slate (schedule feeds) → Postgres   |
| `pnpm snapshot`     | Freeze tonight's FireScore leans for grading          |
| `pnpm grade`        | Grade matured snapshots → /accuracy calibration       |
| `pnpm backtest`     | Backfill historical snapshots/grades                  |
| `pnpm db:migrate`   | Create + apply a dev migration                        |
| `pnpm db:deploy`    | Apply migrations (CI/prod)                            |
| `pnpm db:studio`    | Prisma Studio                                         |

Each data job has a `:prod` variant (e.g. `pnpm ingest:prod`) that loads
`.env.prod.local` via dotenv-cli so you never edit your local `.env`.

## Architecture

```
GitHub Actions (cron) ── NBA / MLB / NFL pulls ──▶ PostgreSQL ◀── reads ── Next.js (Vercel)
   ingest + schedule + grade + snapshot          upsert via Prisma          ISR pages
   workers (TS)                                                             /api/v1 route handlers
```

- **Compute-on-read with ISR.** Pages are statically generated and revalidated
  (hourly). Interactive "change the line/stat" lookups hit `/api/v1/[sport]/*`.
- **Versioned JSON API (`/api/v1/[sport]`) is the source of truth** for the client
  and any future mobile app. The pure-TypeScript compute layer (`src/lib/stats`,
  `src/lib/odds`) has zero React/Next imports so it ports unchanged. See
  [`docs/PLAN.md`](docs/PLAN.md) §3b.
- **One schema, many sports.** `Team` / `Player` / `Game` / `PlayerGameStat` carry a
  `sport` discriminator; `PlayerGameStat` holds a nullable superset of all three
  sports' box-score columns, read through a stat registry.

## Project layout

```
src/
├─ app/                       Next.js routes
│  ├─ page.tsx                home (per-sport dashboards)
│  ├─ [sport]/                /nba, /mlb, /nfl section hub + boards:
│  │  ├─ page.tsx                sport home
│  │  ├─ [playerSlug]/           player page (+ /[stat] SEO page, OG image)
│  │  ├─ board, today, streaks, trends, leaders, matchups, accuracy, players
│  ├─ api/v1/[sport]/         versioned JSON API (hitrate, players, slate)
│  ├─ methodology, about, faq, glossary, how-it-works,
│  │  privacy, terms, responsible-gaming, contact
│  └─ sitemap.ts · robots.ts · manifest.ts · opengraph-image.tsx
├─ lib/
│  ├─ db.ts                   Prisma client singleton (pg adapter)
│  ├─ sports.ts               sport registry (nba | mlb | nfl)
│  ├─ stats/                  hit rate, DvP, Wilson, projection, splits,
│  │                          consistency, streak, matchupGrade, fireScore (pure)
│  ├─ odds/                   implied prob, de-vig, fair price, EV (pure)
│  ├─ server/players.ts       DB-backed research/board/leaders queries
│  ├─ schemas/                Zod schemas
│  └─ site.ts                 site config (URL, name)
├─ components/                presentational, data-agnostic (props in)
├─ hooks/                     TanStack Query hooks → /api/v1
└─ ingest/
   ├─ nba/                    stats.nba.com client
   ├─ nfl/                    ESPN football/nfl client
   ├─ mlb.ts · espn.ts · espn-fallback.ts · schedule.ts · snapshot-lib.ts
   └─ run-*.ts                ingest / schedule / snapshot / grade / backtest
prisma/                       schema.prisma + migrations
tests/e2e/                    Playwright
```

## PWA, OG images & analytics

- **PWA**: `src/app/manifest.ts` + `public/sw.js` (offline shell, Cache-API only —
  no localStorage for app state). The SW registers in production only. Icons are
  generated from the flame mark with `node scripts/make-icons.mjs`.
- **OG images**: dynamic per-player (`src/app/[sport]/[playerSlug]/opengraph-image.tsx`)
  and a site default (`src/app/opengraph-image.tsx`), rendered with `next/og`.
- **Analytics**: cookieless [Umami](https://umami.is) (free Hobby tier), wired
  into `src/components/Analytics.tsx`. It loads **only on the production deployment**
  (off in local dev and Vercel previews so they don't skew the stats); set
  `NEXT_PUBLIC_ANALYTICS_ENABLED=true` to force it on elsewhere, or
  `NEXT_PUBLIC_UMAMI_WEBSITE_ID` / `NEXT_PUBLIC_UMAMI_SRC` to override. Page views
  are automatic; a few funnel events (`stat_switched`, `line_entered`,
  `fairprice_used`) fire via `src/lib/analytics.ts`. No other third-party scripts.

## Deployment (Vercel + Supabase/Neon + GitHub Actions)

Full step-by-step (Supabase pooler ports, env, domain) is in
[`docs/SETUP.md`](docs/SETUP.md). In brief:

1. **Database** — create a free Postgres. Copy the **pooled** URL (`DATABASE_URL`)
   and the **direct/session** URL (`DIRECT_URL`).
2. **Migrate** — from your machine: `pnpm db:deploy:prod`.
3. **Seed data** — run the ingest from a non-cloud host (your machine / VPS):
   `pnpm ingest:prod && pnpm ingest:mlb:prod && pnpm ingest:nfl:prod && pnpm schedule:prod`.
   (Don't run the NBA pull on Vercel — stats.nba.com blocks cloud IPs.)
4. **Web app on Vercel** — import the repo (Next.js auto-detected; `vercel.json`
   pins the build). Set env: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SITE_URL`
   (`https://fantasyfire.app`). The build runs `generateStaticParams`, which queries
   Postgres, so the DB must be reachable from the Vercel build.
5. **Nightly ingest on GitHub Actions** — add the `DATABASE_URL` secret (on the
   `Production` environment). The [`ingest.yml`](.github/workflows/ingest.yml) workflow
   runs daily and on manual dispatch: NBA → MLB → NFL → schedule → grade → snapshot,
   writing to the **same** Postgres the web app reads. Seasons are computed from the
   date in code; set `NBA_SEASON` / `MLB_SEASON` / `NFL_SEASON` repo variables only to
   force a specific season (e.g. a backfill).
6. **Domain** — add `fantasyfire.app` in Vercel and point DNS. `.app` is on the
   **HSTS preload** list, so it's **HTTPS-only** (Vercel serves HTTPS by default).
   Update `NEXT_PUBLIC_SITE_URL` to the apex.

The web app and the ingest worker share one Postgres: ingest **writes**, the app
only **reads** (ISR pages + `/api/v1`). That separation keeps the unofficial NBA
pull off Vercel's blocked IPs.

## License / disclaimer

Research tool only. Hit rates, matchup numbers, and FireScore describe **past
performance** — they are not predictions or betting advice. Not affiliated with the
NBA, MLB, or NFL. See [`docs/PLAN.md`](docs/PLAN.md) §11 for the legal/compliance
notes (gambling-adjacent; get review before monetizing). 21+ — if you or someone you
know has a gambling problem, call 1-800-GAMBLER.
</content>
</invoke>
