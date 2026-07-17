# QA Full Regression + Growth Review — July 17, 2026

_Method: the live site could not be reached from the review sandbox (network policy),
so this regression ran the exact production code locally against a realistic
mid-July dataset (MLB + WNBA in season, six MLB teams × 91 games, today's slate,
injuries, ingest audit rows), crawled every page type, ran the full test suites,
and reviewed the stats/math layer line-by-line. Findings marked **[verify live]**
should be double-checked on fantasyfire.app since they depend on production env/config._

## Health snapshot

| Check | Result |
|---|---|
| TypeScript (`pnpm typecheck`) | ✅ clean |
| Unit tests (`pnpm test`) | ✅ 393/393 pass (42 files) |
| ESLint | ✅ 0 errors, 4 warnings (unused vars — see F7) |
| All page types render (home, board, sport hubs, players, leaders, matchups, trends, injuries, game, playbook, status, statics) | ✅ |
| Off-season fallback (NBA/NFL/NHL/CFB/CBB) | ✅ graceful leaders/browse fallback |
| Sitemap / robots / RSS / llms.txt / JSON-LD / canonical / OG image / embed route | ✅ all present and well-formed |
| Client console errors (Playwright, desktop + mobile) | ✅ none (external logo CDN blocked by sandbox only) |
| Math layer (Wilson, FireFactor log-odds fusion, EWMA+shrinkage, de-vig, DvP ranks, push handling) | ✅ correct and internally consistent |

The codebase is in genuinely professional shape. The findings below are almost all
presentation/comprehension issues and go-to-market gaps — not broken math.

---

## A. Data / numbers that will look odd to users

### F1 — The board's integer "median lines" read as wrong numbers (top issue)
The Heat Check ranks against the raw season-median line (`defaultLine`), which for
count stats is a whole number: rows render as **"Under 1 R", "Under 1 RBI",
"Over 1 H"**. Every book a user knows quotes 0.5 / 1.5. Consequences:

- The board looks "off" at first glance — no real prop is "Under 1 R".
- With pushes excluded, "Under 1 R (86%)" can correspond to only ~60% under at the
  bettable 0.5 line — the strength doesn't transfer to any number a user can bet.
- Low-line MLB unders (R/RBI at 1) structurally dominate the top of the board, so
  the board reads repetitive and samey.

The math is deliberate and documented (balanced over/under at the median), but the
presentation costs trust with the exact audience the site targets. Options, best first:
1. Enable `PROVIDED_LINES_ENABLED` in production (the ingest is built) so the board
   shows real PrizePicks/Underdog numbers — this single flag also makes the hero's
   "prices it against the market" claim true on-page. **[verify live]**
2. Where no real line exists, rank against `defaultPropLine` (the book-style x.5
   line that already exists in the codebase) instead of the integer median.
3. At minimum, de-dupe the board so one player/stat family can't fill the top 10.

### F2 — Verdict panel contradicts itself when the lean is "under"
Seen on a real render: matchup card says **"1st of 6 in H allowed — Favorable —
grade A"** while the FireFactor breakdown right above shows **"Matchup — 0"** and
the projection shows **"× 0.82 matchup"**. All three are individually correct:

- The sub-score is direction-relative (`score = 1 − grade` for an under lean), so
  "0" means "the soft matchup is evidence *against* this under" — but it renders as
  a bare zero bar next to an "A", which looks like broken data.
- For MLB hitters the projection swaps team DvP for the **probable starter's**
  multiplier (`players.ts` ~1506) — the page never says the number switched from
  "vs LAD staff" to "vs tonight's starter", so ×0.82 next to "grade A" looks like a bug.

Fixes: label the sub-score for the chosen side ("Matchup (for the under): weak"),
and caption the multiplier with its source ("vs probable starter X"). Same for
"Consistency — 0" → "Boom-Bust (hurts confidence)".

### F3 — Trends rows: "5 of 5 (100%) L10"
Decided-games counts render against a window labelled L10, so users see "5 of 5"
in a 10-game window with no explanation (pushes are excluded). Add "(5 decided)"
or a tooltip; otherwise it reads as a counting error.

### F4 — Status page banner can cry wolf **[verify live]**
`/status` shows "One or more data pulls are stale or failed" whenever **any** of the
8 sport jobs is stale (>30h). If any off-season sport's job ever stops logging
success rows (workflow disabled, ESPN change), the scary banner runs permanently.
Also: the `injuries` and `providedlines` jobs write `IngestRun` rows but aren't in
`KNOWN_JOBS`, so they're invisible on the page. Consider: per-sport in-season
awareness for the banner + list all jobs that actually run.

### F5 — Game pages list "No read — FF 7/8" rows
The per-game reads section includes rows below the no-read cutoff (FF 7, 8, 15).
They add noise; hide sub-cutoff rows or collapse them behind "weak reads".

### F6 — Duplicated-feel of tier words vs score
"Cold FF 70" ranks above "Hot FF 55" (tier encodes direction, score encodes
strength). Consider always pairing the word with the side ("Cold · under") — the
board already does this in most spots; the home-page mini cards don't.

## B. Functional / technical bugs

### F7 — The Embed button is commented out (this matters for growth)
`EmbedButton` is imported but commented out on both player pages
(`[playerSlug]/page.tsx:253`, `[stat]/page.tsx:204`). The `/embed/[sport]/[slug]`
route works and carries a "View on FantasyFire" backlink — ACQUISITION.md calls it
the "self-replicating backlink engine" — but no user can reach it. Re-enable it
(and the unused `lineSourceLabel` in `PlayerResearchClient` suggests a
line-source caption was also dropped — that caption would help F2).

### F8 — Unknown player URLs return HTTP 200 (soft-404)
`/mlb/anything-fake` streams the loading shell with status 200; the `notFound()`
fires after the shell is flushed, so the page carries `noindex` **plus** a
conflicting `index, follow` robots meta. Crawlers treat noindex as final, so this
is survivable, but returning a real 404 (block on the player lookup before
streaming, or `generateMetadata`-level check) is cleaner for crawl budget.
Same for `/[sport]/game/[bad-id]` (200).

### F9 — Mobile horizontal overflow
The player page scrolls sideways ~8px at 390px width (measured via Playwright
iPhone viewport). Likely one wide panel (alt-lines table or chart). Small polish
item, but it's the most-visited page type.

### F10 — Off-season home page is two cards
In July the home page shows only MLB + WNBA (+MLS when slated). Correct behavior,
but the hero says "eight pro and college leagues" and the page looks thin. Add an
"Off-season" strip linking each dormant sport's leaders/players so the breadth
claim is visible year-round.

## C. Copy / trust nits

- Hero: "prices it against the market … no odds to type" — only true when provided
  lines are enabled; if prod has the flag off, this overclaims. **[verify live]**
- `FANTASY_SCORE_KEY_BY_SPORT` maps `cbb → 'fs'` although the comment says only
  sports with a verified PrizePicks table are present — verify PP actually scores
  CBB fantasy, else drop it.
- Conflicting robots meta on not-found pages (F8).
- Footer is excellent (responsible-gaming, 1-800-GAMBLER, no-affiliation).

---

## D. Growth: why "close to zero users" and what to do

**The product is not the problem.** The site is feature-rich, honest, fast, and
SEO-plumbed (sitemap, JSON-LD, llms.txt, RSS, IndexNow, per-stat pages, internal
mesh). A web search for "fantasyfire.app" returns **nothing** — the site appears
to be effectively unindexed/unknown. Everything below follows from that.

### D1 — Confirm the search plumbing end-to-end **[verify live — do first]**
1. `NEXT_PUBLIC_SITE_URL=https://fantasyfire.app` set in Vercel prod (canonical,
   sitemap, robots `Host:` all derive from it — locally they fall back to localhost).
2. Google Search Console verified; sitemap submitted; **Coverage report read** —
   this tells you in one screen whether you have an indexing problem or a ranking
   problem. Bing: import from GSC (10 min).
3. `site:fantasyfire.app` on Google — if near-zero results after 2–3 weeks,
   nothing else on any growth list matters until fixed.
4. IndexNow job shows "never" on /status in some states — confirm it's actually
   running in prod.

### D2 — The moat needs the real lines on
The programmatic-SEO thesis ("competitors are paywalled and uncrawlable") is
right, but the long-tail query is "*is Judge over 1.5 total bases good on
PrizePicks*" — a page that answers with **the actual PrizePicks number** converts
and earns links; a page that answers with a self-computed median line ("Under 1
TB") doesn't match the searcher's number. Flipping `PROVIDED_LINES_ENABLED` is
the highest-leverage product change for both QA (F1) and growth.

### D3 — Ship the distribution that's already built (owner tasks, ~1 day total)
Per ACQUISITION.md/MARKETING.md, these engines exist in code and are inert
pending secrets/config: social auto-posts (Bluesky/Discord/Telegram +
branded card), web-push digests (VAPID keys), Umami goals, Bluesky
`@fantasyfire.app` domain handle (site.ts still points at
`fantasyfire.bsky.social`). Each is <30 min of owner setup.

### D4 — Concentrate, then broaden
Eight leagues × every stat is a lot of surface for zero audience. Pick the one
community moment that matches the season (right now: MLB + WNBA on PrizePicks)
and do the manual loop the docs already prescribe: one genuinely useful answer
per day in r/sportsbook / PrizePicks Discords linking a player card that shows
the *real* line (D2) with the Wilson interval — the honest-uncertainty framing is
the differentiator no pick-seller can copy. Re-enable embeds (F7) and pitch two
or three bloggers/tool-roundups to paste them.

### D5 — Retention follows a reason to return
The daily-changing boards are the retention engine; make the return trip explicit:
- Web push (built — turn it on) after a user saves a prop.
- A "yesterday's leans: how they landed" strip on the board would give a daily
  honesty loop — the accuracy *page* was rightly killed, but a lightweight
  "last night: 6/9 leans hit" line on the board is a cheap trust builder and a
  reason to come back tomorrow morning. (Descriptive, not a track-record claim.)
- The Playbook save flow is good; surface it on the board rows too, not only the
  player page.

### Suggested order of attack
1. D1 (indexing audit) — hours, decides everything else.
2. F1 + D2 (real lines on the board) — the single change that fixes the oddest-
   looking data *and* the SEO landing-page match.
3. F7 embeds + D3 owner switches — distribution that's already paid for.
4. F2/F3 verdict-panel labeling — trust polish on the money page.
5. D4 manual seeding loop — ongoing, 15 min/day.
