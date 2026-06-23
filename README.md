# FantasyFire 🔥

NBA player-props research tool. Hit rates, defense-vs-position matchups,
sample-size confidence (Wilson intervals), and fair-price math — all computed
from **free, public NBA game logs**. Public, read-only, SEO-driven. No login.

Full product spec and build plan: [`docs/PLAN.md`](docs/PLAN.md).

## Stack

| Layer        | Choice                                             |
| ------------ | -------------------------------------------------- |
| Framework    | Next.js 16 (App Router) + React 19 + TypeScript    |
| Styling      | Tailwind CSS v4                                     |
| Data         | PostgreSQL (Neon / Supabase) via Prisma 7          |
| Validation   | Zod v4                                              |
| Client state | TanStack Query v5                                   |
| Tests        | Vitest (unit) + Playwright (e2e)                    |
| Ingest       | stats.nba.com client → Postgres (GitHub Actions)   |
| Hosting      | Vercel (web) + GitHub Actions (nightly ingest)     |

## Prerequisites

- **Node.js ≥ 20** (Next 16 needs ≥ 18.17; Prisma 7 needs ≥ 18.18 — use 20/22 LTS).
- **pnpm** (`corepack enable pnpm`).
- A **PostgreSQL** database. Free serverless options: [Neon](https://neon.tech) or
  [Supabase](https://supabase.com). You need two connection strings:
  - `DATABASE_URL` — **pooled** (app runtime)
  - `DIRECT_URL` — **direct** (migrations / CLI)

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

# 4a. Seed SYNTHETIC demo data so the UI is browsable without live NBA access
pnpm seed
#  -- or --
# 4b. Pull REAL data from stats.nba.com (must run OUTSIDE a cloud IP; see below)
pnpm ingest

# 5. Run the app
pnpm dev                    # http://localhost:3000
```

## The data reality (read this)

The hard part of this product is the data, not the math.

- **v1 lines are user-entered.** No free API provides player prop lines; the app
  computes everything else (hit rates, DvP, confidence, fair price) from game logs.
- **Game logs come from `stats.nba.com`** (two bulk endpoints: `playerindex` +
  `leaguegamelog`). It's free and keyless but **unofficial** and **frequently blocks
  datacenter/cloud IPs** (AWS / Vercel / sometimes CI runners).
- **Therefore the ingest does NOT run on Vercel.** It runs as a scheduled
  [GitHub Action](.github/workflows/ingest.yml) that writes to Postgres; the web app
  only reads. If the ingest fails with `NbaLikelyBlockedError` (every request timed
  out), that's the IP block — re-run, move it to a VPS/local cron, or implement the
  documented ESPN fallback. **Do not fabricate data to get around it.**
- The provided NBA client (`src/ingest/nba/`) bakes in the required browser-like
  headers, rate limiting, retries, and block detection. See
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
| `pnpm ingest`       | Pull real data from stats.nba.com → Postgres          |
| `pnpm seed`         | Load synthetic demo data → Postgres                   |
| `pnpm db:migrate`   | Create + apply a dev migration                        |
| `pnpm db:deploy`    | Apply migrations (CI/prod)                            |
| `pnpm db:studio`    | Prisma Studio                                         |

## Architecture

```
GitHub Actions (cron) ── stats.nba.com pull ──▶ PostgreSQL ◀── reads ── Next.js (Vercel)
   ingest worker (TS)        upsert via Prisma                          ISR player pages
                                                                        /api/v1 route handlers
```

- **Compute-on-read with ISR.** Player pages are statically generated and revalidated
  hourly. Interactive "change the line" lookups hit `/api/v1/*` route handlers.
- **Versioned JSON API (`/api/v1`) is the source of truth** for the client and any
  future mobile app. Pure-TypeScript compute layer (`src/lib/stats`, `src/lib/odds`)
  has zero React/Next imports so it ports unchanged. See `docs/PLAN.md` §3b.

## Project layout

```
src/
├─ app/                  Next.js routes (pages, /api/v1, sitemap, robots)
├─ lib/
│  ├─ db.ts              Prisma client singleton (pg adapter)
│  ├─ stats/             hit rate, DvP, Wilson confidence (pure)
│  ├─ odds/              implied prob, de-vig, fair price (pure)
│  ├─ schemas/           Zod schemas
│  └─ site.ts            site config (URL, name)
├─ components/           presentational, data-agnostic (props in)
├─ hooks/                TanStack Query hooks → /api/v1
└─ ingest/
   ├─ nba/               PROVIDED stats.nba.com client (drop-in)
   └─ run-ingest.ts      upsert orchestration
prisma/                  schema.prisma + seed-demo.ts
tests/e2e/               Playwright
```

## PWA, OG images & analytics

- **PWA**: `src/app/manifest.ts` + `public/sw.js` (offline shell, Cache-API only —
  no localStorage for app state). The SW registers in production only. Icons are
  generated from the flame mark with `node scripts/make-icons.mjs`.
- **OG images**: dynamic per-player (`src/app/[playerSlug]/opengraph-image.tsx`) and
  a site default (`src/app/opengraph-image.tsx`), rendered with `next/og`.
- **Analytics**: off by default. Set `NEXT_PUBLIC_ANALYTICS_ENABLED=true` plus
  `NEXT_PUBLIC_ANALYTICS_SRC` and `NEXT_PUBLIC_ANALYTICS_DOMAIN` (Plausible/Umami-
  style, cookieless) to enable. No third-party scripts otherwise.

## Deployment (Vercel + Neon/Supabase + GitHub Actions)

1. **Database** — create a free Postgres (Neon/Supabase). Copy the **pooled** URL
   (`DATABASE_URL`) and the **direct** URL (`DIRECT_URL`).
2. **Migrate** — from your machine: `DIRECT_URL=… pnpm db:deploy`.
3. **Seed data** — run the ingest from a non-cloud host (your machine / a VPS):
   `pnpm ingest`. (Do NOT run it on Vercel — stats.nba.com blocks cloud IPs.)
4. **Web app on Vercel**:
   - Import the repo. Framework auto-detects Next.js (`vercel.json` pins the build).
   - Set env vars: `DATABASE_URL`, `DIRECT_URL`, `NBA_SEASON`, `NEXT_PUBLIC_SITE_URL`
     (`https://fantasyfire.app`). The build runs `generateStaticParams`, which
     queries Postgres, so the DB must be reachable from the Vercel build.
   - Deploy.
5. **Nightly ingest on GitHub Actions** — add repo **secrets** `DATABASE_URL` and
   `DIRECT_URL`, and (optionally) a repo **variable** `NBA_SEASON`. The
   [`ingest.yml`](.github/workflows/ingest.yml) workflow runs daily and on manual
   dispatch, writing to the **same** Postgres the web app reads. If a run fails with
   `NbaLikelyBlockedError`, that's the cloud-IP block — re-run, move ingest to a VPS,
   or implement the ESPN fallback. Never fabricate data.
6. **Domain** — add `fantasyfire.app` in Vercel and point DNS. Note: `.app` is on the
   **HSTS preload** list, so it's **HTTPS-only** (Vercel serves HTTPS by default —
   there is no plain-HTTP fallback). Update `NEXT_PUBLIC_SITE_URL` to the apex.

The web app and the ingest worker share one Postgres: ingest **writes**, the app
only **reads** (ISR pages + `/api/v1`). That separation keeps the unofficial NBA
pull off Vercel's blocked IPs.

## License / disclaimer

Research tool only. Hit rates and matchup numbers describe past performance — they
are not predictions or betting advice. Not affiliated with the NBA. See `docs/PLAN.md`
§11 for the legal/compliance notes (gambling-adjacent; get review before monetizing).
