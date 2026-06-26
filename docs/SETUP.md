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
pnpm ingest             # NBA  (runs from your machine — works; cloud IPs get blocked)
pnpm ingest:mlb         # MLB  (statsapi.mlb.com — not IP-blocked)
pnpm ingest:nfl         # NFL  (ESPN football/nfl — not IP-blocked)
pnpm schedule           # upcoming slate for the "Today" hub
pnpm dev                # http://localhost:3000
```

> There is **no synthetic seed script** — the app runs on real ingested game
> logs. Run whichever sports are in season; off-season sports just have no
> upcoming slate (their historical pages still render).

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

## 3. Production (Vercel, uses the PROD Supabase project — a separate PRO org)

> **Two isolated orgs.** The PROD project lives in a **paid Pro** Supabase org; the
> DEV project in a **free** org. Billing + the egress quota are per-org, so dev work
> and the develop preview can't eat into production's allowance (and vice-versa).
> Vercel **Preview** points at the free DEV project; **Production** at the Pro PROD
> project. Verify any env with `pnpm db:target` / `pnpm db:target:prod`.

1. Push to GitHub (commands below), then **import the repo** at [vercel.com/new](https://vercel.com/new).
   Framework auto-detects Next.js; `vercel.json` pins the build (`prisma generate && next build`).
2. In **Vercel → Settings → Environment Variables**, set values **per environment scope**:
   | Key | Production scope | Preview scope |
   |---|---|---|
   | `DATABASE_URL` | PROD project, transaction pooler `:6543` (`?sslmode=require`) | DEV project, transaction pooler `:6543` |
   | `DIRECT_URL` | PROD project, session pooler `:5432` | DEV project, session pooler `:5432` |
   | `NEXT_PUBLIC_SITE_URL` | `https://fantasyfire.app` | develop alias, e.g. `https://fantasyfire-git-develop-<scope>.vercel.app` |
   | `PROVIDED_LINES_ENABLED` | `true` (once real lines ship to prod) | `true` |
3. **Before the first deploy**, migrate + seed the prod DB from your machine. Put the
   PROD password into `.env.prod.local` (gitignored), then:
   ```bash
   pnpm db:deploy:prod   # apply migrations to the prod Supabase project
   pnpm ingest:prod      # NBA  → prod
   pnpm ingest:mlb:prod  # MLB  → prod
   pnpm ingest:nfl:prod  # NFL  → prod
   pnpm schedule:prod    # upcoming slate → prod
   ```
   These use `.env.prod.local` via dotenv-cli, so you never have to edit your local
   `.env`. (The production **build** runs `generateStaticParams`, which queries the DB,
   so the schema must exist first.)
4. Deploy.

---

## 4. Nightly ingest (GitHub Actions)

In the GitHub repo → **Settings → Secrets and variables → Actions** (the
`DATABASE_URL` secret lives on the **Production** environment):
- **Secret**: `DATABASE_URL` (prod **pooled** transaction-pooler URL, `:6543`).
  Migrations are **not** run here (they're in `migrate.yml`), so `DIRECT_URL` isn't
  needed by this job.
- **Variables** (optional): `NBA_SEASON` / `MLB_SEASON` / `NFL_SEASON` — only to
  force a specific season; otherwise seasons are computed from the date in code.

The [`ingest.yml`](../.github/workflows/ingest.yml) workflow runs daily and on manual
dispatch, in order: **NBA → MLB → NFL → schedule → grade → snapshot**, all writing to
the prod DB. Each step is best-effort: if the **NBA** step fails with
`NbaLikelyBlockedError` (stats.nba.com blocking the runner IP), the MLB/NFL/schedule/
grade/snapshot steps still run. Re-run the job, or move the NBA pull to a small VPS /
your machine on a cron.

---

## 5. Domain

In **Vercel → Settings → Domains** add `fantasyfire.app` and follow the DNS records at
your registrar. `.app` is HTTPS-only (HSTS preload) — Vercel serves HTTPS by default, so
nothing extra to do; just don't expect any http:// fallback.

---

## Season note

Seasons are **computed from the current date in code** (per sport), so a fresh clone
pulls the right season without configuration. The optional `NBA_SEASON` /
`MLB_SEASON` / `NFL_SEASON` env vars / repo variables **override** that — set one only
to force a specific season (e.g. to backfill a completed season or pin a value during
the changeover). Whatever the season resolves to also controls which season DvP /
pitching-allowed is computed over, so a forced season with no ingested games yields
empty matchup tables. The three sports don't overlap much (NBA Oct–Jun, MLB Mar–Oct,
NFL Sep–Jan), which is why the home page only surfaces sports with an upcoming slate.
