# FantasyFire — environment setup (Supabase + Vercel + GitHub)

Everything here is free-tier. You'll end up with **two Supabase projects** (dev + prod),
one Vercel project, and a GitHub repo running the nightly ingest.

---

## 1. Supabase (Postgres)

Supabase free tier allows **2 projects** — use one for dev, one for prod (this is the
"separate cloud dev database" approach; Supabase "branching" is a paid feature, two
projects is the free equivalent).

For **each** project:

1. Create the project at [supabase.com](https://supabase.com) → note the **database password** you set.
2. Open **Project → Connect** (top bar) → **ORMs / Prisma**, or **Settings → Database → Connection string**.
3. Grab **two** pooler connection strings (same host, different ports):
   - **Transaction pooler — port 6543** → `DATABASE_URL` (app + build)
   - **Session pooler — port 5432** → `DIRECT_URL` (migrations)

> **Why two pools?** Vercel is IPv4 and Supabase's *direct* connection is IPv6-only,
> so you must use a pooler. The **transaction** pooler (6543) multiplexes many clients
> onto a few server connections — essential because the production **build** statically
> generates pages across many workers and would otherwise blow past the session
> pooler's ~15-client cap (`max clients reached in session mode`). Migrations need
> session semantics (advisory locks), so `DIRECT_URL` uses the **session** pooler
> (5432). Both work with Prisma 7's `pg` driver adapter (verified). Add `?sslmode=require`.

```
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require"
```

---

## 2. Local dev (uses the DEV Supabase project)

```bash
cp .env.example .env
# paste the DEV project's session-pooler strings into DATABASE_URL + DIRECT_URL
pnpm install
pnpm db:deploy          # create the schema in the dev DB
pnpm ingest             # pull real NBA data (runs from your machine — works)
pnpm dev                # http://localhost:3000
```

`.env` for local should look like:

```
DATABASE_URL="...dev project session pooler...?sslmode=require"
DIRECT_URL="...dev project session pooler...?sslmode=require"
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> The "qualifying games" filter is per-player (avg of season + last-10 workload),
> computed automatically — NBA = minutes, MLB hitters = plate appearances, MLB
> pitchers = every appearance. No env var.

> The portable local Postgres on `:5433` we used during the build still works offline,
> but the cloud dev project is the durable path (survives reboots, matches prod).

---

## 3. Production (Vercel, uses the PROD Supabase project)

1. Push to GitHub (commands below), then **import the repo** at [vercel.com/new](https://vercel.com/new).
   Framework auto-detects Next.js; `vercel.json` pins the build (`prisma generate && next build`).
2. In **Vercel → Settings → Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | prod project session-pooler URL (`?sslmode=require`) |
   | `DIRECT_URL` | same |
   | `NEXT_PUBLIC_SITE_URL` | `https://fantasyfire.app` |
3. **Before the first deploy**, migrate + seed the prod DB from your machine. Put the
   PROD password into `.env.prod.local` (gitignored), then:
   ```bash
   pnpm db:deploy:prod   # apply migrations to the prod Supabase project
   pnpm ingest:prod      # pull real NBA data into prod
   ```
   These use `.env.prod.local` via dotenv-cli, so you never have to edit your local
   `.env`. (The production **build** runs `generateStaticParams`, which queries the DB,
   so the schema must exist first.)
4. Deploy.

---

## 4. Nightly ingest (GitHub Actions)

In the GitHub repo → **Settings → Secrets and variables → Actions**:
- **Secrets**: `DATABASE_URL`, `DIRECT_URL` (prod session-pooler URLs).
- **Variable** (optional): `NBA_SEASON` (defaults to `2025-26`).

The [`ingest.yml`](../.github/workflows/ingest.yml) workflow then runs daily and on
manual dispatch, writing to the prod DB. If it ever fails with `NbaLikelyBlockedError`,
that's stats.nba.com blocking the runner IP — re-run, or move ingest to a small VPS /
your machine on a cron.

---

## 5. Domain

In **Vercel → Settings → Domains** add `fantasyfire.app` and follow the DNS records at
your registrar. `.app` is HTTPS-only (HSTS preload) — Vercel serves HTTPS by default, so
nothing extra to do; just don't expect any http:// fallback.

---

## Season note

`NBA_SEASON` controls both what the ingest pulls **and** which season DvP is computed
over. Keep it at the season your DB actually holds. As of mid-2026 that's `2025-26`
(complete). Switch to `2026-27` only once that season has games (preseason ~early Oct
2026) and you've re-ingested — otherwise DvP will be empty.
