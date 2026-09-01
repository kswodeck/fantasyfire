# FantasyFire — Monetization: what to build, what to refuse

_Last updated: 2026-09-01. A research + recommendation doc, not a spec. Every item lists the
files it touches so it can be picked up directly. Companion to [`GROWTH-PLAN.md`](GROWTH-PLAN.md)
(strategy), [`ACQUISITION.md`](ACQUISITION.md) (traffic) and [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md)
(§7 of which this doc supersedes — see §0)._

> **The one-line answer.** Don't add a revenue stream. You already have one, it is the
> right one, and it is under-built and out of compliance. Finish it, measure it per
> surface, and refuse everything else until traffic exists.

---

## TL;DR — the five things, in order

| # | What | Who | Effort | Status |
|---|------|-----|--------|--------|
| **P1** | **Fix the FTC disclosure gap** — 3 of 5 paid-link surfaces carry no disclosure | Dev | ~30 min | ✅ **shipped** — one quiet `minimal` disclosure on the player page covers all three |
| **P2** | Give the live links a real (honest) **conversion surface** — one contextual CTA at the decision point | Dev | ~half day | ✅ **shipped** — `BookCta` under the verdict (`player-cta`) |
| **P3** | **Per-placement sub-IDs** so the affiliate dashboard attributes revenue to a surface | Owner + Dev | ~2 hrs + emails | ⚙️ **plumbing shipped, inert** — needs the param names from each affiliate manager |
| **P4** | **State-aware links** — don't send a Missouri user to a banned market | Dev | ~3 hrs | ✅ **shipped** for PrizePicks; other books' tables unverified (fail open) |
| **P5** | **Widen the book roster** (not the link density) | Owner | ongoing | Owner work — already a zero-code-change switch |

> **What's left for the Owner after this batch:**
> 1. Ask each affiliate manager for their **sub-id parameter name**, then set
>    `NEXT_PUBLIC_REF_SUBID_PARAMS` (e.g. `{"prizepicks":"af_sub1"}`). Until then P3 is
>    built but tagging nothing — deliberately, since a guessed param drops tracking silently.
> 2. Ask the same managers about **deep-link parameters** (P3 below).
> 3. Verify the **state tables** for Underdog / Sleeper / DK Pick6 in
>    `src/lib/bookAvailability.ts`. They are intentionally empty, so those books' links
>    show everywhere until someone confirms where they shouldn't.
> 4. The **LLC / business account** item in §0, which is now overdue rather than premature.

Everything else — display ads, sportsbook affiliates, prediction markets, a paywall — is
**refused below with a reason**, and the reasons are load-bearing (§4).

---

## 0. Start here: monetization already shipped

Most of this repo's planning docs still say *"defer all monetization — lawyer-review-first"*
([`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md) §7). That is **out of date**. Commit `7481eb5`
("feat: enable the four live referral deals") baked four live referral URLs into
[`src/lib/providedSources.ts`](../src/lib/providedSources.ts):

```
prizepicks · underdog · sleeper · pick6   →  live, paid, rel="sponsored"
```

So the honest status is not "should we monetize?" It is **"we are monetizing, and the
compliance obligations attached to that are active right now."**

**What's already right** (and it's genuinely well built — this is a good foundation):

- One `BookLink` component owns compliance for every call site: `rel="sponsored"` **only** on
  genuinely paid links, `nofollow noopener noreferrer` on all of them.
- Per-book activation. A book with no deal renders as **plain text**, not a link — so a deal
  can be added or pulled per-book via `NEXT_PUBLIC_REF_LINKS` with no code change.
- `AffiliateDisclosure` renders **nothing** until a real deal exists, so the site never claims
  a paid relationship it doesn't have.
- Outbound clicks fire `book_link_click` tagged with `{book, placement, sponsored}`.
- 21+ / 1-800-GAMBLER, `/responsible-gaming`, and an affiliate paragraph in `/terms`.

**What's wrong, and it is the top of the list:**

`AffiliateDisclosure` is rendered on exactly **two** surfaces — `/books` and the Playbook's
`EntryCalculator`. But paid links also render on **three** more:

| Placement | File | Disclosure (before) | Now |
|---|---|---|---|
| `books-page` | `src/app/books/page.tsx` | ✅ | ✅ `box` |
| `playbook-entry` | `src/components/EntryCalculator.tsx` | ✅ | ✅ `inline` |
| **`player-line`** | `src/components/PlayerResearchClient.tsx` | ❌ | ✅ `minimal` |
| **`variant-ladder`** | `src/components/VariantLadder.tsx` | ❌ | ✅ `minimal` |
| **`market-edge`** | `src/components/MarketEdgePanel.tsx` | ❌ | ✅ `minimal` |

The FTC standard is **clear and conspicuous, near the link** — a paragraph in `/terms` does
not cover a paid link on a player page, and the footer doesn't carry one either. The player
page is the highest-traffic page type on the site and the entire point of the SEO strategy.

**P1 was therefore not a revenue task. It was fixing a defect on the surface you are trying
hardest to send strangers to.**

**How it was fixed (2026-09-01):** `AffiliateDisclosure` gained a third weight, `minimal` — one
quiet line at the site's normal caption size, rendered **once** in `PlayerResearchClient`.
Because `VariantLadder` and `MarketEdgePanel` render **only** inside that component, a single
placement covers all three previously-uncovered surfaces without stacking three copies on one
page. The brevity comes out of the word count, never out of the visibility: a disclosure nobody
can read carries the obligation without the benefit. The component still self-suppresses when no
deal is configured, so it stays correct if a deal is pulled.

> **[Owner], urgent and non-code:** [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md) says to form an
> **LLC + dedicated business bank account _before_ first revenue**. Those links are live. If
> anything has converted, that milestone has already passed. Worth a same-week call with a CPA,
> and a short consult with a gaming/advertising attorney now that the links are real rather than
> hypothetical. _General information, not legal advice._

---

## 1. The constraint, and the arithmetic

Your own [`GROWTH-PLAN.md`](GROWTH-PLAN.md) says it: _"you are building a turnstile before the
stadium."_ That applies to monetization more sharply than to anything else. **The binding
constraint is traffic, not the choice of mechanism.** No scheme earns meaningfully at
near-zero traffic.

That is *not* an argument to do nothing. It is an argument to pick the mechanism that (a) costs
almost nothing to build, (b) does no damage to the SEO/trust engine that is supposed to produce
the traffic, and (c) compounds automatically when traffic arrives. Exactly one option scores
well on all three, and you already have it.

**Illustrative arithmetic** (not a promise — these are industry ranges applied to a hypothetical
10,000 monthly pageviews ≈ ~4,000 sessions):

| Path | Assumptions | Monthly |
|---|---|---|
| **DFS affiliate** | 3% of sessions click a well-placed contextual CTA (120 clicks); 5–10% become qualified depositors; $25–100 CPA | **~$150–1,200** |
| Display ads (if you could run them) | $10 page RPM | ~$100 |
| Subscription | needs auth + Stripe + a paywall; see §4.4 | ~$0 (and −SEO) |

Sports-betting affiliate click→deposit conversion is cited at **5–12%**, and DFS CPA at
**$25–150 per qualified depositor**. Display RPMs run **$3–12 (AdSense)**, **$8–20 (Ezoic)**,
**$15–40 (Mediavine — which requires 50,000 sessions/month you don't have)**.

Affiliate wins by roughly **4–10×** at the same traffic, has **no traffic threshold**, adds **no
consent banner**, and the deals are **already signed**. The ranking isn't close, and it stays
true at every traffic level you'll plausibly see in the next year.

---

## 2. The design principle: monetize the exit, not the entrance

This is the whole answer to _"least bothersome to users."_

FantasyFire's moat is **honesty** — Wilson intervals on every hit rate, descriptive-never-
predictive language, a `buildWhyText` unit test that fails on the word "lock." Monetization that
contradicts that costs more than it earns, because the trust *is* the product.

The resolution is that a user who has just read a verdict and decided they like a prop **has a
genuine next step**, and that next step is the book. A link that takes them there is a
*shortcut they wanted*, not an advertisement. The `EntryCalculator` already gets this exactly
right, and its code comment says so:

> _"The one CTA in the Playbook, and it only appears once the user has a fully priced entry in
> front of them — at that point 'go build it' is the actual next step, not an interruption."_

**Make that the written rule for every placement:**

1. **After the read, never before it.** A paid link may never sit above the number it refers to.
2. **One per view.** Not one per component — one per screen the user is looking at.
3. **Never gate, never interrupt.** No interstitials, no modals, no blurred numbers, no "sign up
   to see." Nothing that exists on the page for a crawler may be hidden from a human.
4. **The link is a destination, not a recommendation.** "Open this line on PrizePicks →", never
   "Bet this."
5. **Placement never touches the math.** The disclosure already promises this ("no book pays for
   placement or a better score") — keep FireFactor, board ranking and source ordering strictly
   independent of which books pay.

A monetization surface built to that rule is one users tend to *thank* you for. That's the bar.

---

## 3. The recommended path

### P1 — Close the disclosure gap · [Dev] · ~30 min · **do first**

Render `<AffiliateDisclosure inline />` on every page that renders a paid link — the player page
(`PlayerResearchClient`), and wherever `VariantLadder` / `MarketEdgePanel` appear. Prefer one
disclosure per *page* over one per *component* so a player page with all three doesn't stack
three copies; the component self-suppresses when no deal is configured, so it can be placed
unconditionally.

Consider also a permanent footer line in [`SiteFooter.tsx`](../src/components/SiteFooter.tsx)
gated on `hasAnyRefLink()` — belt and braces, but the near-link disclosure is the one that
actually satisfies "clear and conspicuous."

### P2 — Give the links a conversion surface · [Dev] · ~half day

Today four of the five placements are the *book's name rendered as a link* inside a sentence
("PrizePicks line", "PrizePicks payout options"). Those are labels, not calls to action. Nothing
on the player page — the page the entire SEO strategy is built to rank — invites the click.

Add **one** contextual CTA at the genuine decision point, styled like the Playbook's:

- **Player page**, directly under the verdict + `SavePropControl` row:
  `Open this line on {book} →` — appearing only when the line came from a book that has a deal.
- **The expanded/detail view** of a board row, same treatment.

⚠️ **Respect the constraint already documented in `BookLink`**: it must *not* go inside a board
row (the whole row is a stretched `<a>`, and nested anchors are invalid HTML that breaks the row
link) or inside an `<option>`. Those keep plain `sourceLabel` text. Put the CTA in the detail
view, not the row.

Expected effect is large in relative terms — you're going from ~0 to a real CTA — and it costs
no new infrastructure, no new legal surface, and no user friction under the §2 rules.

### P3 — Per-placement sub-IDs and deep links · [Owner + Dev] · ~2 hrs + emails

`book_link_click` already tags `placement`, so Umami tells you **which surfaces get clicked**.
It cannot tell you **which surfaces earn**, because conversion happens on the book's side. Those
two numbers routinely disagree — a high-click, low-intent placement is exactly the one worth
deleting.

- **[Owner]** Ask each affiliate manager what **sub-ID / clickref** parameter their link supports.
- **[Dev]** Append `placement` as that sub-ID in `refLinkFor()` / `BookLink`. One small change in
  one file closes the loop permanently.
- **[Owner]** While you have them: ask what **deep-link** parameters your link supports. Two of
  your four links (`prizepicks.onelink.me`, `sleeper.onelink.me`) are **AppsFlyer OneLinks**, where
  `af_web_dp` can steer the web fallback destination. True in-app deep links via `deep_link_value`
  only work if the destination app honors that value — so **ask, don't assume**. Landing a user on
  the player they were just researching, instead of a homepage, is the single biggest conversion
  lever available and costs nothing but an email.

### P4 — State-aware links · [Dev] · ~3 hrs

DFS pick'em availability is genuinely fragmented, and a dead click is both lost revenue and a bad
experience:

- PrizePicks player pick'em: ~**36 states + DC**.
- Versus-the-house pick'em is **banned** in NY, FL, MI, MA, MD, OH, CT, IA and TN — PrizePicks
  runs its peer-to-peer **Arena** product there instead.
- **Arizona** allows no pick'em or best-ball. **Missouri** specifically disallows over/under
  player-prop contests — i.e. *the exact market this site is about*.

⚠️ **Implementation caveat that matters more than the feature:** reading Vercel's geo headers
server-side **forces dynamic rendering**, which would destroy the ISR/static generation the whole
SEO moat depends on. Do **not** do that. Instead: a tiny edge route (e.g. `/api/v1/geo`) returning
the coarse region, fetched client-side by `BookLink`, which then swaps the CTA for a neutral note
or hides it. Default to **showing** the link when geo is unknown — never let a failed lookup
silently break the page.

### P5 — Widen the roster, not the density · [Owner] · ongoing

The temptation once revenue appears is to add *more links per page*. Resist it — that's the
mechanism by which trust-first sites become the thing they set out to replace. The scalable
direction is **more books, same link count**: `NEXT_PUBLIC_REF_LINKS` already activates a book
with zero code change, and `PROVIDED_SOURCE_LABELS` already carries Dabble, Betr and ParlayPlay
with no deals attached. Each additional pick'em deal also **covers states the others can't**,
which is what makes P4 pay off rather than just suppress links.

---

## 4. Explicitly refused — and why each refusal is a trust asset

### 4.1 Display advertising / AdSense — **no, and not a close call**

Google's publisher restrictions bar placing ads on gambling content **or on any page that *links
to* gambling content**, outside a limited set of countries and only with AdSense Policy Team
approval. Every page carrying a `BookLink` is now such a page. Beyond the policy risk to your
whole Google identity:

- The arithmetic is bad (§1): ~$100/mo vs ~$150–1,200/mo at the same traffic.
- Mediavine's tier needs 50,000 sessions/month.
- Ad tags mean **third-party cookies → a consent banner**, directly undoing the cookieless,
  no-tracker position `/privacy` currently stakes out. `LAUNCH-CHECKLIST.md` already refused GA4
  on exactly this reasoning; ads are the same decision with worse economics.
- It is precisely the "bothersome" thing you asked to avoid.

### 4.2 Sportsbook (non-DFS) affiliate links — **no, and mind the footgun**

This is the sharpest distinction in the whole doc, and the registry currently obscures it:

- **DFS affiliates** are materially lighter — fantasy sports carry a federal carve-out and DFS
  affiliate programs generally require **no licensing or background check**.
- **Sportsbook affiliates** must in several states be **licensed/registered before a single
  tracked link goes live** — AZ ~$1,500 initial, CO ~$350, MI ~$200, with 30–60 day lead times.

Your four live deals are all **DFS pick'em**. That is the low-burden category, and it happens to
be the one that actually matches your product. **Keep it that way.**

⚠️ **The footgun:** `providedSources.ts` already carries `draftkings`, `fanduel`, `betmgm`,
`caesars` and a dozen more as first-class ids, and `NEXT_PUBLIC_REF_LINKS` will happily activate
any of them. Turning on a sportsbook link is **one environment variable away**, requires no code
review, and would silently move you into a licensed-affiliate regime. Worth a comment in that
file saying so, next to `DEFAULT_REF_LINKS`.

### 4.3 Prediction markets (Kalshi / Polymarket) — **watch, don't build**

Superficially ideal: CFTC-regulated so they sidestep state affiliate licensing entirely (the
Third Circuit held in April 2026 that the CFTC has exclusive jurisdiction over Kalshi's
sports-related event contracts), they pay ~$25–100 CPA, and major sports publishers like Covers
and Action Network already run these deals.

**But the audience fit collapses on the specifics.** The CFTC's June 10, 2026 proposed rule would
permit contracts on macro outcomes (who wins the championship, game totals) while **explicitly
banning contracts on individual player performance** — yards, points, strikeouts. FantasyFire is
a *player props* tool. The markets you'd be sending users to are precisely the ones proposed for
prohibition.

The rule is proposed, not final, and the comment period runs into late 2026. **Revisit only if
the final rule permits player-performance contracts.** Until then it's a distraction.

### 4.4 A paywall or subscription — **not now; the gates are in §5**

Competitors anchor at **$19.99/month** (Props.Cash; Outlier at $19.99 / $29.99 / $79.99), so
there is a real willingness to pay in this niche. But three facts make it wrong *today*:

1. **There is no auth infrastructure at all.** `prisma/schema.prisma` has no `User`, no session,
   no accounts — the Playbook is `localStorage`, push identity is the browser subscription
   endpoint. A subscription means building auth + Stripe + entitlements from zero.
2. **A paywall attacks the acquisition strategy.** Your stated moat is that competitors are
   *behind logins and therefore uncrawlable*. Gating content converts your one structural
   advantage into their disadvantage. Whatever eventually gets gated must be the
   **personal/computed** layer (cross-device Playbook sync, alerts, the entry optimizer), never
   an indexed page.
3. **You'd be gating for an audience of near-zero.** Turnstile, stadium.

**The honest interim option, if you want direct revenue without any of that:** a plain
**"support the site"** link — Stripe Payment Link, Ko-fi, or GitHub Sponsors — that gates
**nothing**. Zero engineering, zero auth, zero SEO damage, completely consistent with the brand.
Expect little, but it's real, and "this is free and stays free; chip in if it helped" is a
message this particular product has earned the right to send.

### 4.5 Affiliate links inside the `/embed` widget — **no**

The embed is a self-replicating **backlink** engine. Putting *paid* links inside it places
undisclosed sponsored links on third parties' sites, creating an FTC problem for **them** — and
the moment that's noticed, the widget stops getting embedded. Keep the embed clean: attribution
backlink only. It earns its keep through SEO, not commission.

---

## 5. Sequencing and decision gates

**Gate A — now, at any traffic level.** P1 (disclosure), P2 (one CTA per decision point), P3
(sub-IDs + ask about deep links). Total ≈ one focused day. Ship these regardless of traffic:
they're cheap, they're correct, and they mean every visitor the acquisition work later delivers
lands on a finished surface instead of a half-built one.

**Gate B — at ~2,000 sessions/month.** Read the sub-ID data. **Delete the worst-performing
placement** rather than adding a sixth — a deliberate cull is what keeps this from ratcheting.
Then P4 (state-aware links) and P5 (more books).

**Gate C — at ~20–30k sessions/month _and_ a demonstrated return-visitor rate.** Only then
revisit a paid tier, and only over the personal/computed layer. Two gates, both required: traffic
without retention means a subscription has nothing to renew against.

**Never, at any traffic level:** gate an indexed page, let a paying book influence a score or a
ranking, or add a placement that appears before the number it refers to.

---

## Sources

Facts here were web-verified 2026-09-01. Regulatory items in this space move fast — re-check
the CFTC rulemaking and DFS state availability before acting on them.

- [Daily Fantasy Sports Affiliate Programs 2026: Operator Guide — Track360](https://track360.io/blog/daily-fantasy-sports-affiliate-program-operator-guide-2026) (DFS CPA ranges; no affiliate licensing)
- [Sports Betting Affiliate Marketing 2026: How To Get Started Legally — BettingUSA](https://www.bettingusa.com/affiliate/) (state affiliate licensing)
- [Sports Betting Affiliate Programs 2026 — Track360](https://track360.io/blog/sports-betting-affiliate-programs-2026) (conversion + commission benchmarks)
- [What conversion rate benchmarks should iGaming affiliates target? — White Label Coders](https://whitelabelcoders.com/blog/what-conversion-rate-benchmarks-should-igaming-affiliates-target/)
- [Google Publisher Restrictions — AdSense Help](https://support.google.com/adsense/answer/10437795) (ads barred on pages linking to gambling content)
- [Best Ad Networks for Publishers in 2026: Ranked by RPM — Newor Media](https://newormedia.com/blog/best-ad-networks-for-publishers-2026/) (RPM ranges, Mediavine threshold)
- [No injuries, no props: CFTC proposes prediction market rules — ESPN](https://www.espn.com/espn/betting/story/_/id/49019930/cftc-proposes-rules-limiting-prediction-markets-kalshi-sports)
- [CFTC Issues Proposed Rule Regarding Prediction Markets — Congressional Research Service](https://www.congress.gov/crs-product/LSB11441)
- [Third Circuit Affirms Kalshi's Preliminary Injunction — Skadden](https://www.skadden.com/insights/publications/2026/04/third-circuit-affirms-kalshis-preliminary-injunction)
- [Prediction Market Referral Programs Teardown 2026 — Track360](https://track360.io/blog/prediction-market-referral-programs-kalshi-polymarket-teardown-2026)
- [Where Is PrizePicks Legal? Full List of Legal States (2026) — Saturday Down South](https://www.saturdaydownsouth.com/dfs/prizepicks/legal-states/)
- [Underdog Fantasy Legal States 2026 — Lines.com](https://www.lines.com/guides/underdog-fantasy-states-legal-guide)
- [Props.Cash vs Outlier Premium 2026 — XCLSV](https://xclsvmedia.com/props-cash-vs-outlier-premium-2026-best-19-99-month-ev-tool-sharp-bettors/) (competitor pricing)
- [Create deep linking and redirection links with OneLink — AppsFlyer](https://support.appsflyer.com/hc/en-us/articles/208874366-Create-deep-linking-and-redirection-links-for-your-campaigns-with-OneLink)

_Nothing in this document is legal, tax or financial advice. The gambling-adjacent items —
affiliate licensing, entity formation, FTC disclosure adequacy — warrant a short consult with a
gaming/advertising attorney and a CPA, which is now overdue rather than premature (§0)._
