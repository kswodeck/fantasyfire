# FantasyFire — Acquisition & Visibility Playbook

_The honest premise: the product is now feature-rich and trustworthy. The binding
constraint is **traffic, not features**. Almost everything here is **[Owner]** work
(dashboards, DNS, outreach) — cheap, high-leverage, and not blocked by code. Items
the code already supports are marked **✅ shipped**; the few **[Dev]** items are small._

> Your own GROWTH-PLAN says it best: _"you are building a turnstile before the
> stadium… retention features for an audience of near-zero are wasted effort.
> Acquisition runs in parallel from day one."_ This is the stadium.

---

## ⭐ If you only do five things this week

1. **[Owner]** Verify the domain in **Google Search Console** and **submit `sitemap.xml`**. Nothing ranks until Google crawls it. (§1) DONE
2. **[Owner]** **Bing Webmaster Tools** → one-click "Import from GSC". Powers Bing + DuckDuckGo + Copilot. (§1) DONE
3. **[Owner]** Post one genuinely useful link (a streak board or a player card) in **r/sportsbook / a PrizePicks Discord** when it actually answers someone's "is this number good?". (§4)
4. **[Owner]** Submit to 3–5 **"best free prop tools" directories / roundups**. (§4)
5. **[Owner]** Reserve the **social handles** + set the Bluesky `@fantasyfire.app` domain handle (free "official account" proof). (§5)

Everything below is the fuller list, roughly in priority order.

---

## 1. Search indexing groundwork — the highest-leverage hour you can spend

You have **hundreds of programmatic pages** (per-player, per-stat, per-matchup,
leaders, boards). They compound only once they're indexed.

- **[Owner] Google Search Console** — <https://search.google.com/search-console>
  - Add a **Domain property** for `fantasyfire.app` (verify by DNS TXT — covers all
    subdomains/protocols). _Alternative if you can't touch DNS:_ a **URL-prefix**
    property verified by the **HTML tag** — set `GOOGLE_SITE_VERIFICATION` (✅ the
    meta tag is already wired into the app; just paste the token).
  - **Submit the sitemap:** Sitemaps → `sitemap.xml` (✅ dynamic, accurate per-player
    `lastmod`).
  - **URL Inspection → Request indexing** for `/`, `/nba`, `/mlb`, `/nfl`,
    `/methodology`, and 1–2 flagship player pages. Don't mass-request — the sitemap
    handles bulk.
- **[Owner] Bing Webmaster Tools** — <https://www.bing.com/webmasters> → **Import
  from GSC** (auto-verifies, pulls the sitemap). Free Bing/DDG/Copilot reach.
- **✅ IndexNow** is shipped — the nightly ingest pings Bing/Yandex/DDG with the
  exact URLs that changed (changed player pages + in-season boards). Just confirm the
  `NEXT_PUBLIC_SITE_URL` repo variable is set so it targets the live apex.
- **[Owner] Validate structured data** with the **Rich Results Test**
  (<https://search.google.com/test/rich-results>): confirm Organization / WebSite /
  Person / Dataset / BreadcrumbList / FAQPage all parse. (✅ all emitted.)
- **[Owner] Watch crawl health** in GSC → Pages: make sure off-season pages aren't
  flagged as **soft-404s** and that thin pages stay out (✅ `qualify.ts` gating
  already prevents most thin content).

---

## 2. On-page & technical SEO — quick wins (mostly already done — verify, then extend)

Most of the technical SEO moat is built. The job is to **confirm it's live in
production** and squeeze the last few points.

- **✅ One-sentence computed-answer H1** on per-stat pages (the featured-snippet /
  AI-Overview target). _Extend:_ make sure every high-value page leads with a
  crawlable, factual answer sentence — that's what wins "position zero".
- **✅ Internal-link mesh** (`RelatedLinks`) so nothing is orphaned. _Quick win:_
  spot-check a few deep pages and confirm they each link to 4–6 siblings.
- **✅ Daily freshness signals** ("Stats updated through {date}", per-URL sitemap
  `lastmod`). Fresh pages get recrawled more — keep the nightly ingest healthy
  (✅ `/status` now shows this).
- **✅ Fast + mobile-first + no layout shift.** Enable **Vercel Speed Insights** in
  the dashboard (✅ component shipped, production-gated) and run **PageSpeed Insights**
  (<https://pagespeed.web.dev>) once on a player page — Core Web Vitals are a ranking
  input.
- **✅ Canonical tags, OpenGraph + Twitter cards, dynamic per-player & per-stat OG
  images** (the per-stat card now bakes in the Wilson badge). Validate once with the
  **Meta Sharing Debugger** and **LinkedIn Post Inspector** before your first share
  (each platform caches separately).
- **[Owner] `robots.txt` / crawl budget** (✅ emitted) — no action unless GSC reports
  crawl waste.

---

## 3. Programmatic SEO & content — lean into the long tail

~70% of this niche's search volume is **entity + market long-tail**: "[player]
points prop", "[player] vs [team]", "NBA defense vs position", "[player] last 10
games". These are exactly the queries paywalled competitors **can't** rank for.

- **✅ Per-player / per-stat / per-matchup / leaders pages** already target these.
  _Quick win:_ in GSC → Performance, after a few weeks, find queries where you rank
  #5–15 and **strengthen those exact pages** (tighten the H1 answer, add an internal
  link from a board).
- **[Dev, small] A few evergreen informational pages** to catch top-of-funnel
  queries: "How to read a hit rate", "What is a Wilson interval", "Defense vs
  position, explained". (✅ `/methodology`, `/how-it-works`, `/glossary` already do
  much of this — consider 2–3 more targeted at real search phrases.)
- **[Owner] Seasonal/event spikes** — playoffs, opening day, a big primetime game
  drive search. Share the relevant board/player pages **into those moments**; that's
  when "is this number good?" volume peaks.
- **Avoid** thin combinatorial pages (e.g. `/compare/[a-vs-b]`) — Google penalizes
  near-duplicates (✅ already deferred in the plan).

---

## 4. Off-site, backlinks & being the citable source

This is where near-zero traffic actually turns into traffic.

- **[Owner] Seed the communities where prop bettors already are** — r/sportsbook,
  r/dfsports, PrizePicks / Underdog / Sleeper Discords. The move is to **answer a real
  question** ("is this number good?") with a genuinely useful link (a streak page, a
  player card), not to drop spam. One good answer > ten posts.
- **[Owner] Directories & roundups** — submit to "free sports betting tools",
  "prop research tools", indie-tool directories, and pitch "best free prop tools"
  roundup authors. Each is a backlink + a trickle of qualified traffic.
- **[Owner/Dev] Be the citable source (Answer-Engine Optimization).** AI Overviews
  and writers cite primary sources. Your **methodology page, the public `/accuracy`
  calibration, and the `Dataset` schema** make you that source — this is the hedge
  against zero-click search. Keep them sharp and link them from posts.
- **✅ Embeddable card widget** (`/embed/[sport]/[slug]`) — anyone can paste the
  `<iframe>` (the **Embed** button on every player page copies it) and it carries a
  **"View on FantasyFire" backlink**. That's a self-replicating backlink engine —
  _but only if you actually seed it_: drop it in a blog post, a Reddit answer, or
  pitch it to tool roundups with a "embed this on your site" line.
- **[Owner] HARO / journalist requests** — occasionally a reporter wants a stat angle;
  a quotable, sourced number earns a high-authority backlink.

---

## 5. Brand & social presence (cheap credibility + distribution)

- **[Owner] Reserve one consistent handle** (`fantasyfire`, fallback
  `fantasyfireapp`) on **X, Bluesky, Reddit, Discord, YouTube**. Same FlameMark
  avatar, brand orange `#ea580c`, one-line bio, `https://fantasyfire.app` link.
  _Don't_ claim accounts you won't keep tidy — an empty profile reads as abandoned.
- **[Owner] Set the Bluesky handle to `@fantasyfire.app`** via an `_atproto` DNS TXT
  record — free, permanent, the cheapest "this is official" proof.
- **[Dev] ✅ Footer + JSON-LD `sameAs` are wired** — just fill `SITE.socials` in
  `src/lib/site.ts` once the handles exist and they light up automatically.
- **[Owner] Post the daily boards** — the streak/trends/"top leans" pages change
  every morning. A short daily "today's notable lines" post (organic, educational —
  never a "lock of the day") is free, repeatable distribution.

---

## 6. Retention quick wins (so acquired visitors come back)

Acquisition fills the top; these stop the leak. Most are already built — the job is
to **surface** them.

- **✅ A daily reason to return** — Streaks / Trends / Top Leans / Today boards
  recompute every night. Make sure they're one tap from the home page (they are).
- **✅ Favorites + `/my-players`** (just shipped) — the ☆ on every player page.
  _Quick win:_ nudge it ("save this player") so SEO visitors build a list before they
  bounce.
- **✅ Web Push lean alerts** (just shipped, opt-in on `/my-players`) — generate VAPID
  keys and schedule `pnpm push` to turn it on. The browser subscription _is_ the
  identity (no account). Value-first, capped ~3–4/week.
- **✅ Shareable cards** (just shipped) — the Share button + per-stat OG card put a
  branded, Wilson-badged card into group chats. Every share is a tiny ad.
- **[Dev, small] PWA "install" nudge** — a subtle "Add to home screen" prompt for
  repeat visitors turns the PWA (✅ manifest + SW already shipped) into a one-tap app.
- **✅ Trust = retention** — the methodology page, named author, accuracy track
  record, and "updated through {date}" stamps are why a skeptical bettor trusts the
  numbers enough to return. Keep them honest.

---

## 7. Measurement — so the next bet is data, not a guess

- **✅ Umami** (cookieless) is live with funnel events (`stat_switched`,
  `line_entered`, `fairprice_used`, and now `favorite_added` / `shared` /
  `push_enabled`). **[Owner]** Turn these into **Goals/Funnels** in Umami Cloud and
  watch which features actually drive return visits **before** building more.
- **[Owner] GSC → Performance** — your single best acquisition dashboard: which
  queries/pages get impressions and clicks, and where you rank #5–15 (the pages worth
  strengthening).
- **[Owner] Vercel Speed Insights** — real-user Core Web Vitals (a ranking input).
- **The discipline:** acquisition is the long game (months to compound via SEO) plus
  the short game (communities, shares). Retention features retain nobody until traffic
  exists — so weight your time toward §1, §4, and §5 first.

---

## Owner vs. Dev quick reference

| Do now | Who | Effort |
|---|---|---|
| GSC verify + submit sitemap | Owner | 1 hr |
| Bing import from GSC | Owner | 10 min |
| Set `NEXT_PUBLIC_SITE_URL` repo var (IndexNow target) | Owner | 5 min |
| Reserve social handles + Bluesky domain handle | Owner | 30 min |
| Seed 1 community answer / week | Owner | ongoing |
| Submit to 3–5 directories/roundups | Owner | 1 hr |
| Enable Vercel Speed Insights in dashboard | Owner | 5 min |
| Turn Umami events into Goals | Owner | 20 min |
| Generate VAPID keys + schedule `pnpm push` | Owner | 20 min |
| Fill `SITE.socials` once handles exist | Dev | 5 min |
| (Optional) 2–3 evergreen explainer pages | Dev | half day |
| (Optional) PWA install nudge | Dev | 1–2 hr |

> See also [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md) for the professional-setup
> details (DNS, email, security headers, backups, status page) and
> [`GROWTH-PLAN.md`](GROWTH-PLAN.md) §6 for the strategic acquisition rationale.
</content>
