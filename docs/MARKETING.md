# FantasyFire — Free & Automated Marketing Strategy

_Last updated: 2026-07-12. The operating marketing plan. Constraints, by design:
**$0 budget** and **automation-first** — every recurring activity should either run
itself (GitHub Actions / built-in product features) or be reduced to a
copy-paste-sized daily task. Four pillars: **user outreach**, **brand building**,
**user retention**, **organic visibility & growth**._

> Companion docs: [`ACQUISITION.md`](ACQUISITION.md) (tactical acquisition
> playbook), [`GROWTH-PLAN.md`](GROWTH-PLAN.md) (product/feature sequencing +
> the strategic rationale), [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md)
> (professional setup: DNS, email, security, monitoring). This doc is the
> **marketing engine** that sits on top of them — what gets published, where,
> when, and by what automation.

---

## 0. The one-page summary

| Pillar | Automated engine | Owner's one-time setup |
|---|---|---|
| **Organic visibility** | Nightly ingest → ISR pages → sitemap `lastmod` → IndexNow ping (✅ all shipped). Add: RSS feeds + `llms.txt` (Dev). | Verify Google Search Console + Bing, submit sitemap (~1 hr) |
| **Brand building** | Daily auto-posts to Bluesky / Discord / Telegram with branded OG-style cards (Dev, new). `SITE.socials` → footer + JSON-LD `sameAs` light up automatically. | Reserve handles, create accounts, generate API secrets (~2 hrs) |
| **User retention** | Web Push lean alerts (✅ built — needs keys + schedule), daily-changing boards (✅), PWA install nudge (Dev, small). | Generate VAPID keys, add secrets (~20 min) |
| **User outreach** | **Cannot be fully automated safely** (platform anti-spam rules). Automate the *prep*: a nightly "content pack" of ready-to-paste posts + links delivered to a private Discord channel. Human posts them. | ~15 min/day of paste-and-engage, 1 community answer/week |

**The honest framing:** three of the four pillars can be ~fully automated because
the product already recomputes interesting content every night (streaks, trends,
Top Leans, today's slate). The nightly data pipeline *is* the content pipeline —
marketing automation is a thin publishing layer bolted onto the ingest that
already runs on GitHub Actions. Outreach is the one pillar where automation
actively backfires (Reddit/Discord spam bans), so we automate everything *around*
the human: what to say, where to link, which image to attach.

---

## 1. Guardrails (inherited from the brand — non-negotiable)

Every automated post, card, and push notification obeys the same rules as the
site (see GROWTH-PLAN "Risks & guardrails"):

- **Descriptive, never predictive.** "Top Leans," "streaks," "hit rates" —
  never "picks," "locks," "best bets," "guaranteed," "we predict." The post
  composer gets the same banned-token unit test as `buildWhyText`.
- **Wilson honesty travels with the content.** Cards show the confidence badge
  and sample size; captions say "over his last N games," never a bare hero %.
- **Freshness honesty.** "Updated through {date} — nightly box scores, not live."
- **Responsible-gaming line** in every profile bio (21+, 1-800-GAMBLER) and on
  recurring posts (a standing footer line in the card image is cheapest).
- **Organic only on X.** X banned compensated gambling partnerships (Feb 2026);
  our account is strictly organic/educational anyway. No affiliate links
  anywhere until the lawyer-first review in LAUNCH-CHECKLIST §7.
- **College sports caution.** Several states restrict college player props —
  keep CFB/CBB posts framed as stats research, and consider excluding them from
  the daily auto-post rotation entirely (config flag).
- **No fabricated presence.** `SITE.socials` stays empty until a handle is real
  and tidy (already enforced in code). An abandoned profile is worse than none.

---

## 2. Channel matrix — what's actually free and automatable in 2026

Researched July 2026. This determines everything below.

| Channel | Free? | Automatable? | Verdict |
|---|---|---|---|
| **Bluesky** | ✅ Free API, no app review, no paid tier | ✅ Fully (app password, ~1,666 posts/hr limit — irrelevant at our volume) | **Tier 1 — primary automated channel.** Bonus: free `@fantasyfire.app` domain handle = official-account proof |
| **Discord (own server)** | ✅ Webhooks free | ✅ Trivially (one POST, supports embeds/images) | **Tier 1 — automated + doubles as the community home** |
| **Telegram (own channel)** | ✅ Bot API free | ✅ Fully (BotFather bot, `sendPhoto`) | **Tier 1 — near-zero cost to add alongside the other two** |
| **Web Push** (owned) | ✅ Built into the product | ✅ `run-push.ts` exists; needs VAPID keys + cron | **Tier 1 — the retention channel** |
| **RSS/Atom** (owned) | ✅ | ✅ Static routes off existing board queries | **Tier 1 — feeds power syndication + AI/reader discovery** |
| **X / Twitter** | ❌ Free API tier **discontinued Feb 2026**; pay-per-use ($0.015/post, $0.20 with a link) | Manual posting is free | **Tier 2 — manual.** Keep the handle, post the content-pack text by hand where it matters (game-day moments). Revisit paid API only if X drives measurable traffic |
| **Threads** | ✅ API free | ✅ Own-account posting needs NO App Review (dev-mode app, self as tester); 250 posts/day cap | **Tier 1 — automated** (shipped; 60-day token refresh is the only upkeep) |
| **Instagram** | ✅ API free | ✅ Same no-review own-account path; ~50 publishes/day cap; JPEG-only public image URL; captions can't carry clickable links | **Tier 1 — automated** (shipped: feed post + vertical story per sport; brand reach, not click traffic — link in bio). Music stickers are app-only (no API); Reels need real video — deferred |
| **Reddit** | ✅ | ❌ **Do not automate.** Link-dropping bots get accounts and the domain banned | **Manual, high-value.** 1 genuinely useful answer/week from the content pack. Own subreddit only when there's a community to fill it |
| **Mastodon** | ✅ Free API | ✅ Fully | Tier 3 — tiny US sports audience; add only because it's ~30 lines if ever desired |
| **TikTok / YouTube** | ✅ | ⚠️ APIs exist but content production (video/reels) is the real cost | **Skip for now** — revisit if the daily card images prove shareable |
| **Email digest** | — | — | **Rejected** (GROWTH-PLAN "explicitly NOT doing") — push covers it without the ESP/CAN-SPAM surface |

Sources: [X API pricing 2026](https://www.socialcrawl.dev/blog/x-twitter-api-2026)
([more](https://postproxy.dev/blog/x-api-pricing-2026/)),
[Bluesky rate limits](https://docs.bsky.app/docs/advanced-guides/rate-limits) /
[Bluesky bots guide](https://docs.bsky.app/docs/starter-templates/bots),
[Threads API pricing/limits](https://www.blotato.com/blog/threads-api-pricing).

---

## 3. The centerpiece: the nightly auto-publish pipeline (Dev)

This is IDEAS.md #1, built to the brand guardrails. It rides the existing
GitHub Actions ingest — no new infrastructure, no third-party scheduler, $0.

### 3.1 What it posts

Once per day, **per in-season sport** (a sport qualifies if it has ≥1 game today
— the same `ScheduledGame` data `/[sport]/today` uses):

- **Text**: "🔥 Today's top {sport} leans — {Player A} {stat} ({hit rate} over
  L{N}, Wilson-gated), {Player B}…" + "Full board →
  fantasyfire.app/{sport}/board?utm_source=bluesky&utm_medium=social&utm_campaign=daily-leans"
  (per-channel `utm_source` so Umami attributes every visit).
- **Image**: a branded daily-leans card — the top 3–5 leans with tier badges,
  Wilson badges, the flame mark, date stamp, and the responsible-gaming footer
  line. Rendered by a new route reusing the existing `next/og` setup
  (e.g. `/api/og/daily/[sport]`), fetched by the poster job as a PNG.
- **Links**: the sport's Top Leans board (primary) + optionally the #1 lean's
  player-stat page. Deep links are the point — every post lands on an
  indexable page.

Weekly bonus post (Sunday): "This week's longest active streaks" from the
streaks board — same pipeline, different query.

**The daily multi-format digest** (fixed daily slot, when ≥2 sports have
leans): an Instagram **carousel** + per-sport **story**, a Threads
**carousel**, a Telegram **album + poll**, a Discord **multi-embed message +
native poll**, and a Bluesky **thread** (digest root, one card per reply).
The push digest attaches the lead sport's card as a rich notification image.
Polls are engagement framed as a question to the audience ("which lean
hits?"), never a prediction from us — same banned-token enforcement.

### 3.2 How it runs

```
ingest.yml (nightly, exists) ──▶ new final job: social-publish
                                   pnpm social   →  src/ingest/run-social.ts
                                   ├─ query in-season sports + top leans (reuses fireScore/board queries)
                                   ├─ compose captions (banned-token-tested composer)
                                   ├─ fetch card PNG from /api/og/daily/[sport] on production
                                   ├─ post → Bluesky (AT proto, app password)
                                   ├─ post → Discord (webhook embed)
                                   ├─ post → Telegram (sendPhoto)
                                   └─ write "content pack" → private Discord webhook (see §5)
```

Implementation notes:

- **Timing is game-aware.** The workflow ticks hourly through the posting
  window (**noon–10pm ET**, DST-aware — never overnight) behind a ~15-second
  due-check (`/api/v1/social/due`), and each sport posts at the first tick
  where **its** first game is within 2 hours — which moves day to day. Slates
  whose first game tips before noon ET catch up at the window-open tick.
  Sports with no feed start time, the content pack, and the push digest use
  the window-open slot (noon ET).
- **Idempotency.** A tiny `SocialPost` table (channel, sport, date, postedAt)
  — or simpler, a per-day guard keyed on (channel, sport, date) — so a re-run
  or a retry never double-posts.
- **Secrets** (GitHub Actions): `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD`,
  `DISCORD_WEBHOOK_URL`, `DISCORD_CONTENT_PACK_WEBHOOK_URL`,
  `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. All owner-provided (checklist §8).
- **Dependencies.** Zero new heavyweight deps: Bluesky = `@atproto/api` (small,
  official); Discord/Telegram = plain `fetch`. Fits the existing
  `src/ingest/run-*.ts` pattern.
- **Failure posture.** Best-effort like `run-indexnow.ts` — a failed post never
  fails the ingest pipeline; log + continue per channel.
- **Off-season.** No in-season sports → the job posts nothing (never a "dead"
  post). The Sunday streaks post falls back to season leaders, same as the
  boards do.
- **Kill switch.** `SOCIAL_PUBLISH_ENABLED` env/repo variable, default off,
  so the owner flips it on only after eyeballing a dry-run output
  (`pnpm social --dry-run` prints captions + card URLs without posting).

### 3.3 Why this respects the moat

Every card carries the Wilson badge and descriptive framing — the automation
*amplifies* the honesty differentiator instead of diluting it into "lock of the
day" noise. Competitors' social feeds scream picks; ours shows sample sizes.
That contrast **is** the brand.

---

## 4. Organic visibility & growth (mostly shipped — finish the edges)

The SEO engine is the strongest existing asset: programmatic player/stat/
matchup/leader pages, internal-link mesh, JSON-LD (`Dataset`, breadcrumbs),
per-player sitemap `lastmod`, IndexNow pings after every ingest, dynamic OG
images, ISR freshness. What remains:

**Owner (one-time, ~1.5 hrs total):**
1. **Google Search Console** — verify the domain property (DNS TXT), submit
   `sitemap.xml`, request indexing for `/`, each sport hub, `/methodology`.
   This is the single highest-value free marketing action available.
2. **Bing Webmaster Tools** — one-click "Import from GSC" (powers Bing,
   DuckDuckGo, Copilot answers).
3. Confirm the `NEXT_PUBLIC_SITE_URL` repo variable is set so the IndexNow job
   actually fires (it skips on localhost).
4. **Vercel Speed Insights** — enable in dashboard (Core Web Vitals are a
   ranking input).

**Dev (new, small):**
5. **RSS/Atom feeds** — `/[sport]/feed.xml` for Top Leans/streaks (one route
   handler reusing board queries) + a site-wide feed. Feeds are free
   distribution: readers, aggregators, and increasingly AI assistants consume
   them, and they're a prerequisite for any future zero-cost syndication.
6. **`llms.txt`** — the emerging convention for AI crawlers: a small static
   route pointing language models at `/methodology`, `/glossary`, the sport
   hubs, and the Dataset schema. Costs minutes; positions FantasyFire as the
   *citable source* for AI answers ("Answer-Engine Optimization" — the hedge
   against zero-click search, per ACQUISITION §4).
7. **Seasonal freshness** — the auto-post pipeline (§3) doubles as a recrawl
   signal: every post is a fresh external link to a board page on a
   high-crawl-rate platform (Bluesky is fully public/indexable).

**Already-shipped growth loops to keep seeding (Owner, ongoing):**
- **Embed widget** (`/embed/[sport]/[slug]`) — every embed carries a "View on
  FantasyFire" backlink. Mention it in directory submissions and Reddit answers
  ("you can embed this card").
- **Share buttons + per-stat OG cards** — every share drops a branded,
  Wilson-badged card into a group chat.

---

## 5. User outreach — automate the prep, keep the human

Platform reality: automating posts *into other people's communities* (Reddit,
PrizePicks/Underdog Discords) is the fastest way to get the domain banned where
the audience actually lives. So the automation target is **making the human's
outreach take 5 minutes instead of 45**.

### 5.1 The nightly content pack (Dev — part of the §3 job)

The `run-social.ts` job also composes a **private daily briefing** and posts it
to an owner-only Discord channel (second webhook):

- Today's top leans per sport, with pre-written, guardrail-safe snippets in two
  voices: a **community-answer voice** ("He's cleared 24.5 in 9 of his last 10
  — full game log with confidence intervals here: {link}") and a **social
  voice** (for manual X posting).
- The 2–3 most *remarkable* stats of the day (longest streak, biggest matchup
  mismatch) — the things worth a standalone post or a Reddit comment.
- Direct links (UTM-tagged `utm_source=community`) + the embed iframe snippet.

The owner's daily job becomes: open Discord, skim, paste where relevant.

### 5.2 The human 15 minutes (Owner, recurring)

- **1 genuinely useful community answer per week minimum** (r/sportsbook,
  r/dfsports, pick-em Discords) — answer a real "is this number good?" with a
  player page. One good answer > ten posts. (ACQUISITION §4 — unchanged.)
- **Game-day moments**: playoffs, opening day, primetime — paste the content
  pack's social snippet to X manually; that's when "is this number good?"
  search and social volume peaks.
- **Directory submissions** (one-time batch, ~1 hr): 3–5 "free sports betting
  tools" / "prop research tools" / indie-tool directories + pitch 2–3 "best
  free prop tools" roundup authors with the embed angle.
- **HARO / journalist requests** (opportunistic): a quotable, sourced stat earns
  a high-authority backlink.

### 5.3 Own community (later trigger, not now)

The Discord server created for auto-posting doubles as a community home — but
**don't promote it as a community until the daily-leans channel has an audience**
watching it (e.g. >50 members organically). An empty Discord reads as abandoned;
a webhook-fed feed channel reads as a useful utility. Same logic for a
subreddit: revisit at meaningful traffic.

---

## 6. User retention — turn on what's already built

The product already has the retention loop (daily-changing boards, favorites,
`/my-players` playbook, share cards, PWA). The gaps are activation, not code:

1. **[Owner, ~20 min] Web Push lean alerts** — generate VAPID keys, add the
   secrets, and schedule `pnpm push` in the ingest workflow (the runner
   `run-push.ts` already exists). The browser subscription *is* the identity —
   no accounts, honors the no-auth stance. Content: leans/streaks for
   **favorited players only**, capped ~3–4/week, value-first. This is the
   highest-retention automation available and it's one config task away.
2. **[Dev, small] PWA install nudge** — a subtle "Add to home screen" for
   repeat visitors (2nd+ visit). Turns the shipped PWA into a home-screen icon
   — the cheapest possible "come back tomorrow" surface.
3. **[Dev, small] "Save this player" nudge** for SEO landers — an SEO visitor
   who favorites one player before bouncing becomes push-reachable and gets a
   populated `/my-players` on return. One gentle inline prompt on player pages.
4. **Automated re-engagement content** — the same §3 pipeline gives Discord/
   Telegram/Bluesky followers a daily reason to return without any new work;
   the boards recompute themselves.
5. **Trust = retention** (standing rule): methodology page, named author,
   Wilson gating, freshness stamps. Every automated surface must reinforce, not
   erode, this — it's why a skeptical bettor comes back.

---

## 7. Brand building — consistency on autopilot

- **[Owner, ~1 hr] Reserve handles** — `fantasyfire` (fallback
  `fantasyfireapp`) on Bluesky, X, Reddit, Discord, Telegram, YouTube. Same
  FlameMark avatar, brand orange `#ea580c`, same one-line bio ("Player-prop
  research that's honest about uncertainty. Hit rates + confidence intervals,
  free. 21+"), `https://fantasyfire.app` link. Claim only what will stay tidy —
  with the §3 pipeline, Bluesky/Discord/Telegram stay tidy *automatically*.
- **[Owner, 10 min] Bluesky domain handle `@fantasyfire.app`** — one `_atproto`
  DNS TXT record. Free, permanent "official account" proof; do this before the
  first automated post so the bot posts under the official handle from day 1.
- **[Dev, 5 min] Fill `SITE.socials`** in `src/lib/site.ts` once handles exist
  — footer social row, Organization `sameAs`, and `twitter.site` all light up
  automatically (already wired).
- **[Owner, 30 min] Validate social cards** before the first share — Meta
  Sharing Debugger, LinkedIn Post Inspector, an X-card previewer (X caches ~7
  days and can't be purged, so validate *first*).
- **Visual consistency is free**: the daily cards, OG images, embeds, and PWA
  icons all derive from the same FlameMark + orange — the §3 card route must
  reuse the existing OG components/palette so every surface matches.
- **Voice**: the honesty framing is the brand. Bios, captions, and the card
  footer all repeat the same line: *stats, not picks*.

---

## 8. Owner setup checklist (everything you must do yourself)

Code can't create accounts. One-time, in order — roughly one afternoon total:

| # | Task | Where | Time |
|---|---|---|---|
| 1 | Verify **Google Search Console** (DNS TXT), submit sitemap | search.google.com/search-console | 45 min |
| 2 | **Bing Webmaster** — Import from GSC | bing.com/webmasters | 10 min |
| 3 | Set `NEXT_PUBLIC_SITE_URL` repo variable (unblocks IndexNow) | GitHub → repo → Variables | 5 min |
| 4 | Reserve **handles**: Bluesky, X, Reddit, Discord, Telegram, YouTube | each platform | 60 min |
| 5 | **Bluesky domain handle** — `_atproto` TXT record | DNS panel | 10 min |
| 6 | Bluesky **app password** (Settings → App Passwords) → `BLUESKY_IDENTIFIER` + `BLUESKY_APP_PASSWORD` secrets | Bluesky + GitHub Secrets | 10 min |
| 7 | Create **Discord server**, two channels (`#daily-leans` public, `#content-pack` private), a webhook for each → secrets | Discord | 15 min |
| 8 | Create **Telegram bot** (@BotFather) + public channel, add bot as admin → `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` secrets | Telegram + GitHub Secrets | 15 min |
| 9 | Generate **VAPID keys** (`npx web-push generate-vapid-keys`) → secrets/env for push | terminal + GitHub/Vercel | 20 min |
| 10 | Enable **Vercel Speed Insights** | Vercel dashboard | 5 min |
| 11 | **Umami**: turn `shared` / `favorite_added` / `push_enabled` + the funnel events into Goals | Umami Cloud | 20 min |
| 12 | Validate **social cards** (Meta debugger, LinkedIn inspector, X previewer) | web tools | 30 min |
| 13 | Tell the dev handles exist → `SITE.socials` fill + flip `SOCIAL_PUBLISH_ENABLED` after a dry-run review | — | 5 min |

Recurring (the irreducible human part):

| Cadence | Task | Time |
|---|---|---|
| Daily (optional but high-value) | Skim the content pack in Discord; paste 0–2 snippets to X / a community if genuinely relevant | 5–15 min |
| Weekly | 1 real community answer with a useful link; glance at GSC + Umami goals | 30 min |
| One-time batches | Directory/roundup submissions; HARO when relevant | ~1 hr each |

---

## 9. Dev implementation roadmap

Ordered so each phase is independently shippable and nothing waits on traffic:

**Phase 1 — the publishing engine (the big unlock)**
1. ✅ `src/ingest/run-social.ts` + `pnpm social` (+ `--dry-run` / `--force`):
   in-season check → top-leans query (`getDailyLeans`, shared with the card) →
   caption composer (banned-token-tested, `src/lib/social/compose.ts`) → Bluesky /
   Discord / Telegram posters (raw fetch, no new deps) → content-pack briefing →
   once-per-day guard on `IngestRun`.
2. ✅ `/api/og/daily/[sport]` card route (`next/og`): top 5 leans with tier
   badges, sport accent, date, RG footer line.
3. ✅ `.github/workflows/social.yml` — game-aware hourly ticks (each sport posts
   ~an hour before its first game; cheap `/api/v1/social/due` pre-check skips
   idle hours) + manual dispatch with dry-run/force inputs; inert until the
   `SOCIAL_PUBLISH_ENABLED` repo variable is `true` and channel secrets exist.

**Phase 2 — retention activation**
4. ✅ `pnpm push` scheduled in `social.yml` (inert until owner supplies VAPID keys).
5. ✅ PWA install nudge (`InstallNudge`, 2nd visit + `beforeinstallprompt`) and
   "save this player" nudge (`SaveNudge`, empty-Playbook visitors only).

**Phase 3 — visibility edges**
6. ✅ RSS feeds: `/feed.xml` (site-wide) + `/{sport}/feed.xml`, advertised via
   `<link rel=alternate>`; one item per sport per social day.
7. ✅ `llms.txt` (`src/app/llms.txt/route.ts`).
8. `SITE.socials` fill (5 min, when handles exist).
   _Also shipped: 1024px social avatars in `public/brand/` (rounded + full-bleed
   square for circle-cropping platforms), generated from the FlameMark._

**Phase 4 — expansion (only if metrics justify)**
9. ✅ Weekly "longest active streaks" recap — Sundays at the noon-ET slot
   (text post via every configured channel's `postText`).
10. Mastodon poster (~30 lines, one `channels.ts` entry) if ever wanted.
11. ✅ Weekly Umami metrics digest (`pnpm metrics`, Sundays in `weekly.yml` →
    content-pack channel). `weekly.yml` also auto-refreshes the Meta tokens
    (needs a `GH_PAT` fine-grained secret with **Environments: read and
    write** on the repo — environment secrets are written through the
    Environments API, not the Secrets one).

---

## 10. Measurement — prove each channel before feeding it

- **Attribution**: every automated post carries `utm_source=<channel>`; Umami
  splits sessions by source, so within weeks the data says whether Bluesky,
  Discord, Telegram, or community answers actually deliver visitors.
- **The gates**:
  - A channel earning ~zero sessions after 60 days gets dropped from the
    rotation (automation isn't free attention — it still spends brand surface).
  - Push opt-ins and `favorite_added` events tell us whether retention nudges
    work before building more retention surface.
  - GSC impressions/clicks on board + player-stat pages remain the primary
    long-game dashboard; pages ranking #5–15 are the ones worth strengthening.
- **The discipline** (unchanged from GROWTH-PLAN): SEO compounds over months;
  social/community is the short game. Don't judge SEO in weeks or social in
  quarters — and let Umami, not vibes, pick where the next hour goes.

---

## 11. What we're deliberately NOT doing (and why)

- **Paid anything** — ads, boosts, paid schedulers, paid APIs (incl. X's
  $0.015–$0.20/post pay-per-use). Constraint of this plan.
- **Automated posting into third-party communities** — spam bans destroy the
  domain's standing exactly where the audience lives.
- **Email digests** — rejected in GROWTH-PLAN (ESP dependency + compliance
  surface for content push already delivers).
- **GA4 / Meta Pixel / any cookie-based tracker** — would force a consent
  banner and undercut the cookieless honesty brand (LAUNCH-CHECKLIST §3).
- **"Pick of the day" framing** — the entire moat is descriptive honesty;
  automation that sounds like every tout account erases the differentiator.
- **Video/short-form content** — real production cost, unautomatable quality;
  revisit only if the static cards demonstrably travel.
- **Buying followers / engagement pods / AI-generated engagement replies** —
  brand poison; nothing to discuss.
