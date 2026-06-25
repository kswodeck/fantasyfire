# FantasyFire — Online Presence & Professional Setup Guide

_Last updated: 2026-06-24. A tailored, prioritized checklist to make fantasyfire.app look
established and professional. Each item is marked **[Owner]** (you, in a dashboard/DNS) or
**[Dev]** (a code change in this repo — I can do these for you)._

> Stack assumed: Next.js 16 on **Vercel**, Postgres on **Supabase**, domain **fantasyfire.app**
> (`.app` = HSTS-preloaded, HTTPS-only), cookieless **Umami** analytics already live.

---

## ✅ What you already have (don't rebuild these)

- Dynamic `/sitemap.xml` (accurate per-player `lastmod`) and `/robots.txt`.
- Full metadata: per-page title/description/canonical, OpenGraph + Twitter cards, dynamic
  per-player OG images.
- Structured data (JSON-LD): Organization + WebSite site-wide; per-player Person +
  BreadcrumbList + Dataset; FAQPage on `/faq`.
- PWA (manifest + service worker + icons), favicons.
- Cookieless **Umami** analytics (no cookies, no PII) → **no cookie-consent banner needed**.
- Trust/legal pages: about, how-it-works, methodology, faq, glossary, contact, privacy,
  terms, responsible-gaming; footer with 21+ / 1-800-GAMBLER and "not advice" language.
- HTTPS + HSTS enforced automatically by the `.app` TLD.

So this guide is mostly **external accounts** + a few **professional hardening** touches.

---

## 🔴 Two things that are broken *right now* — fix before promoting anything

1. **`/privacy` is inaccurate. [Dev]** It says *"Analytics are off by default. If enabled…"*
   but Umami is live in production. A knowingly-wrong privacy statement is a real
   FTC/GDPR exposure and undercuts the honesty brand. Must say plainly that Umami
   (cookieless) runs, name the processors, and state the legal basis. **Highest-priority fix.**
2. **`hello@fantasyfire.app` may be a dead address. [Owner]** It's referenced in `/contact`,
   `/privacy`, `/terms`, and the Organization JSON-LD. A contact address that bounces reads
   as abandoned. Set up free forwarding (below) before announcing the site anywhere.

---

## ▶ Do these first (the canonical order)

The single hard prerequisite is the **DNS lookup** — it decides your Search Console, email,
and DMARC paths, so doing it first prevents redo-work.

1. **[Owner] Find out where your DNS lives.** Run an NS lookup — open
   <https://www.whatsmydns.net/#NS/fantasyfire.app> (or `dig NS fantasyfire.app`). Write down
   whether the nameservers are **Vercel** (`ns1.vercel-dns.com`…), **Cloudflare**
   (`…ns.cloudflare.com`), or your **registrar**. Everything below forks on this.
2. **[Owner] Lock the registrar** (10 min, free): Registrar/Transfer **Lock ON**,
   **Auto-Renew ON**, **WHOIS privacy ON**, **2FA ON** on the account.
   (`.app` renews ~$15/yr; Porkbun ~$14.93, Cloudflare ~$14.20.)
3. **[Owner] Fix `/privacy`** (have me do it — see Dev batch) and **stand up `hello@`** email
   forwarding — the two "broken now" items above.
4. **[Owner] Google Search Console** — verify the domain, submit the sitemap (§2).
5. **[Dev] Security headers + CSP** in `next.config.ts` (§4).
6. **[Owner] Better Stack** uptime + heartbeat on the nightly ingest (§4).
7. **[Dev] Free off-site Supabase backups** via GitHub Actions — the free tier has **none** (§4).
8. **[Owner] Reserve social handles** before squatters do (§5).

Everything else is "soon / later." **Defer all monetization** (AdSense, affiliate links) — it's
lawyer-review-first (§7).

---

## 1. Domain · DNS · Professional email

**[Owner] Choose a DNS model.** Two fine options; pick one:
- **DNS on Vercel** (simplest): Vercel → project → Settings → Domains → add `fantasyfire.app`
  **and** `www.fantasyfire.app`, pick one as primary and let Vercel auto-redirect to a single
  canonical host. Set the registrar's records to **exactly** what Vercel's dashboard shows
  (Vercel now issues *per-project* A/CNAME targets like `*.vercel-dns-016.com` — don't copy old
  hardcoded values).
- **Cloudflare DNS-only** (unlocks free email): move nameservers to Cloudflare, add the same
  records pointing at Vercel, all set to **DNS-only / gray cloud**. **Never** orange-cloud/proxy
  Cloudflare in front of Vercel — Vercel recommends against it (breaks edge routing/caching).
- Decide your **canonical host** (apex vs www) *before* submitting to Search Console, so signals
  don't split. Guide: <https://vercel.com/kb/guide/cloudflare-with-vercel>

**[Owner] Professional email** (free). Vercel does **not** provide email, so it lives elsewhere:
- **If DNS is on Cloudflare** → **Cloudflare Email Routing** (free, up to 200 routes, auto-creates
  MX/SPF). Forward `hello@`, `support@`, `contact@` → your Gmail. Receive-only.
  <https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/>
- **If DNS is on Vercel/registrar** → **ImprovMX** free (1 domain, 25 aliases, 500 fwd/day); add
  its MX + SPF TXT in Vercel DNS. <https://improvmx.com/>
- **[Owner] Reply *as* `hello@`** with Gmail → Settings → Accounts → "Send mail as" (Gmail SMTP +
  an App Password). <https://support.google.com/mail/answer/22370>
- **[Owner] Add DMARC** (one TXT record, `_dmarc`): start `v=DMARC1; p=none; rua=mailto:dmarc@fantasyfire.app; fo=1`,
  then tighten to `p=quarantine`/`p=reject` after reports are clean. Test at
  <https://www.mail-tester.com>. Anti-spoofing matters extra for a betting-*adjacent* brand.
- **Later (digest emails):** send via **Resend** (free 3,000/mo, 100/day) from a *subdomain*
  `send.fantasyfire.app`, with one-click `List-Unsubscribe`. <https://resend.com/pricing>
- A real mailbox (Zoho free / Google Workspace ~$7/user/mo) is **optional** — forwarding +
  Gmail send-as is enough.

---

## 2. Search engines & indexing

**[Owner] Google Search Console** — your most important free tool.
<https://search.google.com/search-console>
- Add a **Domain property** for `fantasyfire.app` (covers all subdomains/protocols). It can
  **only** be verified by **DNS TXT** — add the `google-site-verification=…` TXT in whichever DNS
  panel step 1 identified. Keep the record forever.
- *Alternative if you can't touch DNS:* add a **URL-prefix** property `https://fantasyfire.app`
  and use the **HTML-tag** method — that's a one-line **[Dev]** change
  (`verification: { google: … }` in `layout.tsx` metadata).
- **Submit the sitemap:** Sitemaps → enter `sitemap.xml`.
- **URL Inspection** → "Request indexing" for `/`, `/nba`, `/mlb`, `/nfl`, `/methodology`, and 1–2
  flagship player pages (don't mass-request; the sitemap handles bulk).
- Add a backup email as Owner so you never lose access.

**[Owner] Bing Webmaster Tools** — one-click **Import from GSC** (auto-verifies, pulls the
sitemap). Powers Bing/DuckDuckGo/Copilot. <https://www.bing.com/webmasters>

**[Both] IndexNow** (instant recrawl for Bing/Yandex; *not* Google) — a natural fit since your
nightly ingest changes a known set of URLs. **[Dev]** generate a key, host `/<key>.txt`, and have
the ingest POST changed URLs to `https://api.indexnow.org/indexnow`.

**[Owner] Validate structured data** with the **Rich Results Test**
(<https://search.google.com/test/rich-results>) — confirm Organization/WebSite/Person/Dataset/
BreadcrumbList/FAQPage all parse.
- _Note:_ Google is **removing the FAQ rich result** (rolling out ~mid-2026). Keep the markup —
  it's still valid schema and Google still parses it — just don't expect the FAQ accordion in
  results.

---

## 3. Analytics & measurement

Your minimal, brand-consistent **free** stack: **GSC (search) + Umami (product) + Vercel Speed
Insights (Core Web Vitals) + PageSpeed/Lighthouse (lab).**

- **[Owner] Umami Goals/Funnels** — you already fire `stat_switched` / `line_entered` /
  `fairprice_used`; turn them into goals in Umami Cloud. <https://umami.is/docs/goals>
- **[Both] Vercel Speed Insights** — real-user Core Web Vitals (a ranking input), first-party &
  privacy-friendly. Enable in the Vercel dashboard, then **[Dev]** add `@vercel/speed-insights`
  `<SpeedInsights/>` next to `<Analytics/>`. Free on Hobby (10k events/mo).
  <https://vercel.com/docs/speed-insights/quickstart>
- **[Both] PageSpeed Insights** (no account) for lab diagnostics + CrUX field data.
  <https://pagespeed.web.dev>
- **🚫 Do NOT add Google Analytics 4.** You asked about it, so the honest call: GA4 still writes
  **first-party cookies**, which would force a **consent banner** + Consent Mode v2 + a `/privacy`
  rewrite — directly undercutting your cookieless, honesty-first brand. Umami + GSC already cover
  product + search. (Adding *any* cookie-based tracker — GA4, Meta Pixel, ad/affiliate pixel —
  flips you to banner-required; treat each as a deliberate, separate decision.)

---

## 4. Security · reliability · backups

- **[Dev] Security headers + CSP** in `next.config.ts` (currently empty, so no conflicts). Add
  `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `X-Frame-Options: DENY`, and a **static CSP**. Use `'unsafe-inline'`
  (NOT a nonce CSP — in Next 16 a nonce CSP forces every page dynamic and kills your static
  SEO/ISR). The CSP must allowlist: `script/connect-src https://cloud.umami.is` and
  `img-src https://cdn.nba.com https://midfield.mlbstatic.com https://www.mlbstatic.com https://a.espncdn.com`
  (a.espncdn.com serves the NFL headshots + team logos). Test on a Vercel **Preview** with DevTools
  open across NBA + MLB + NFL pages and `/faq`, clearing every violation first.
  <https://nextjs.org/docs/app/guides/content-security-policy>
- **[Owner] Test headers:** <https://securityheaders.com> (web UI; the API was retired) and
  Mozilla **HTTP Observatory** (the authoritative CSP check — it'll flag `unsafe-inline`, which
  is an accepted v1 tradeoff since there's no user content/auth/cookies).
- **[Owner] Uptime monitoring → Better Stack** (free: 10 monitors + 10 heartbeats, 1 status page).
  **Avoid UptimeRobot's free plan** — it became **non-commercial-only on Dec 1 2024**, which a
  branded/monetizable site violates. Add an HTTP monitor with a **keyword check** (e.g. a player
  name) to catch "up but broken." <https://betterstack.com/uptime>
- **[Both] Heartbeat the nightly ingest** — have the GitHub Action curl a Better Stack heartbeat
  on success, so a silently-skipped run pages you. **Then deliberately fail one run to confirm the
  alert fires** (an untested alert isn't an alert).
- **[Owner] Public status page** (free on Better Stack) at `status.fantasyfire.app` — a strong
  "established" signal. Keep the same disclaimer tone ("tracks availability & data freshness, not
  betting outcomes").
- **[Both] Free off-site Supabase backups — the free tier has ZERO automatic backups/PITR and the
  dashboard download is disabled.** Add a GitHub Actions step running `supabase db dump` (or
  `pg_dump`) to an off-site store (Cloudflare R2 / Backblaze B2 / a private repo), ~7–14 day
  retention, secret in GitHub Actions only. **Do a restore test once.**
  <https://supabase.com/docs/guides/platform/backups>
- **[Owner] Secrets & deploy hygiene** — keep all secrets (DB URL, Resend key, IndexNow key,
  Vercel/GitHub) in Vercel + GitHub secrets, never committed; enable Vercel deployment protection
  on previews; in GitHub Actions, pin third-party actions to commit SHAs and minimize
  `GITHUB_TOKEN` permissions (a compromised ingest could poison the public data your "honesty"
  brand depends on).
- **[Both] Sentry (optional)** error monitoring — free Developer plan (5k errors/mo); one-command
  setup `npx @sentry/wizard@latest -i nextjs`; keep tracing sample rate ~0; add its ingest host to
  the CSP `connect-src`. <https://docs.sentry.io/platforms/javascript/guides/nextjs/>

---

## 5. Brand & social presence

- **[Owner] Reserve one consistent handle** (`fantasyfire`, fallback `fantasyfireapp`) on **X**,
  **Bluesky**, **Reddit** (account only — subreddit creation needs ~30-day age + karma),
  **Discord**, and a **YouTube** brand channel. Use the same FlameMark avatar, brand orange
  `#ea580c`, one-line bio, and `https://fantasyfire.app` link everywhere. Empty Instagram/TikTok
  read as abandoned — only claim what you'll keep tidy.
- **[Owner] Set your Bluesky handle to `@fantasyfire.app`** via an `_atproto` DNS TXT record — free,
  permanent, the cheapest "this is the official account" proof.
  <https://bsky.social/about/blog/4-28-2023-domain-handle-tutorial>
- **[Owner] Validate social cards** before your first share (each platform caches separately; X
  caches ~7 days and can't be purged): **Meta Sharing Debugger**
  (<https://developers.facebook.com/tools/debug/>), **LinkedIn Post Inspector**
  (<https://www.linkedin.com/post-inspector/>), and a current third-party X-card previewer.
- **[Dev] Link the brand to its profiles** — add a `sameAs` array (X, Bluesky, Reddit, YouTube) to
  the Organization JSON-LD and `twitter.site` to metadata once handles exist; centralize them in
  `src/lib/site.ts` and add a footer social row.
- **[Both] Tiny brand kit** — export FlameMark to SVG/PNG (512/1024), make a square avatar +
  banners in Canva/Figma free, write a one-paragraph brand spec. Keep it in `/public/brand`.
- **[Owner] Don't add a cookie banner.** With cookieless Umami nothing is stored on the device, so
  under ePrivacy Art. 5(3) no consent banner is required — and a clean no-banner site is the
  trustworthier UX. Just keep `/privacy` accurate about it. (Umami doesn't even store IPs — it
  hashes them in memory and discards them.)

---

## 6. Legal · compliance · trust

- **[Dev] Rewrite `/privacy`** (the #1 fix): state plainly that the production site uses **Umami
  Cloud** cookieless analytics (no cookies, no PII, IPs not stored); legal basis = legitimate
  interest, no consent banner needed; list processors **Vercel, Supabase, Umami Cloud (umami.is),
  GitHub Actions, NBA/MLB image CDNs** with links to each one's privacy/DPA page; add a "Your
  privacy rights & data deletion" line (email `hello@`, you hold no account data); bump
  `LAST_UPDATED`.
- **[Dev] `security.txt`** (RFC 9116) at `/.well-known/security.txt` with `Contact:` + `Expires:`,
  and a **DMCA/abuse** contact line in `/terms` (you already use league logos under a fair-use
  claim). <https://www.rfc-editor.org/rfc/rfc9116>
- **[Dev] Accessibility pass** (WCAG 2.1 AA) — run Lighthouse + axe DevTools. Likely fixes: the
  `text-muted` low-contrast lines (target 4.5:1), visible keyboard focus rings, a skip-to-content
  link, and the **interactive props widgets** (stat/line controls) — not just the legal pages,
  since that's where keyboard/focus issues hide.
- **[Owner] Responsible-gaming wording** — keep the "generally 21+" hedge (a few states are 18/19);
  optionally link per-state ages from FAQ/methodology.
- **[Owner] Business entity before revenue** — once any ad/affiliate income flows, an **LLC** +
  **dedicated business bank account** (opened *before* first revenue, no commingling) gives a
  liability shield. EIN is **free at irs.gov**; state filing ~$35–$500; you can be your own
  registered agent. *General info, not legal advice — do a short consult with a gaming/advertising
  attorney + CPA before monetizing.*
- **[Dev] CCPA** — you're far under the thresholds, so **skip** a "Do Not Sell" flow; just keep the
  simple email-based deletion path above.

---

## 7. ⛔ Monetization — defer, lawyer-first (do NOT treat as quick wins)

- **Google AdSense:** gambling-adjacent "tips/odds/handicapping/comparison" is a **restricted,
  approval-gated** AdSense category, and there's a **publisher restriction barring ads on any page
  that *links* to gambling content**. A rejection/violation can taint your whole Google identity.
  Don't drop AdSense code speculatively; never combine AdSense with sportsbook links on the same
  page. <https://support.google.com/adsense/answer/10437795>
- **Sportsbook affiliate links = state licensing, not free money.** Several states require *you*
  (the affiliate) to be **licensed/registered before a single tracked link goes live** (e.g. AZ
  ~$1,500 initial/$500 renewal, CO ~$350, MI ~$200), with 30–60 day lead times. **CPA** comp is
  simpler to license than rev-share. Geo-gate links to legal+licensed states, add FTC disclosure +
  `rel="sponsored nofollow"`. **Get a gaming attorney's review first.**
- **X paid-partnership ban** (effective **Feb 2026**) covers affiliate *and* influencer deals — keep
  your X account strictly organic/educational; never run compensated betting promos through it.
- **App stores** (only if you ever wrap the PWA): Apple Guideline **5.3** can force a 17+ rating on
  gambling-*adjacent* apps and **4.7** bars HTML5 real-money gaming. None of this binds your
  open-web PWA today — re-review before any submission.

---

## 🛠 Code changes I can make for you (the [Dev] batch)

Grouped by priority. Say the word and I'll implement any/all:

**Now — ✅ DONE (2026-06-24, browser-verified):**
1. ~~Rewrite `/privacy`~~ ✅ now states Umami (cookieless, IPs not stored) + processors (Vercel,
   Supabase, Umami Cloud, GitHub, league CDNs) + a data-deletion path; the false "off by default"
   text is gone.
2. ~~Security headers + static CSP~~ ✅ added to `next.config.ts` (HSTS, CSP, X-Content-Type-Options,
   Referrer-Policy, Permissions-Policy, X-Frame-Options). CSP allowlists `cloud.umami.is` + the
   NBA/MLB image CDNs; dev-aware (adds `unsafe-eval`/`ws:` only in `next dev`). Verified: images +
   Umami load, zero CSP violations. _Still do: run securityheaders.com / Mozilla Observatory once
   it's on production._
3. ~~`/.well-known/security.txt` + DMCA line in `/terms`~~ ✅ done (Contact + Expires; DMCA +
   security-reporting sections added to `/terms`).

**Soon:**
4. **GSC verification meta tag** (only if you pick the URL-prefix path) via `layout.tsx` metadata.
5. **Vercel Speed Insights** component (`@vercel/speed-insights`), production-gated like Umami.
6. **Supabase backup** GitHub Actions step (+ heartbeat ping to Better Stack) — needs you to add
   the `SUPABASE_DB_URL` secret.
7. **IndexNow** key file + ingest POST of changed URLs.
8. **Accessibility fixes** (contrast, focus rings, skip-link).

**When handles exist:**
9. **`sameAs` social links** in Organization JSON-LD + `twitter.site` + a footer social row +
   `SITE.socials` in `site.ts`.

---

## Notes on sources / freshness

Facts here were web-verified June 2026; a few moving targets: Google FAQ rich result removal
(~mid-2026), `securityheaders.com` API retired (web UI live), UptimeRobot free = non-commercial
since Dec 2024, X gambling paid-partnership ban = Feb 2026, Vercel DNS targets are now per-project.
Re-check pricing/free tiers at signup time.
