# CBB (Men's College Basketball) — Readiness & Season-Start Checklist

_Last updated: 2026-07 (off-season). CBB tips off the first week of November; the
title game is early April. This doc records what's wired, what's verified, and the
exact first-week-of-season checks — the scraped book market names can only be
confirmed against live boards._

## Status: fully wired, pending in-season market-name verification

CBB rides the shared multi-sport schema and `[sport]` routes like every other
league. All plumbing exists and passes typecheck/tests; the only unknowns are the
book scrapers' display-string → StatKey maps, which no one can confirm until CBB
markets are live.

### ✅ Wired and structurally verified (works the moment data lands)

| Surface | Where | Notes |
|---|---|---|
| Box-score ingest | `run-ingest-espn.ts` (`cbb` config) | ESPN `basketball/mens-college-basketball`, D-I only (`&groups=50&limit=400`), season types 2+3, Nov 1 → May 1 window. Reuses the WNBA/NBA basketball box-score shape. |
| Position buckets | `espnSports.ts` `toCbbPosBucket` | G/F/C from ESPN's position field; falls back to `F` (neutral) when absent — basketball box scores don't split G/F/C, so DvP is coarse by design. |
| Teams / brand | `teams.ts` `CBB_TEAMS = {}` | **Intentionally empty** — ESPN `/teams` lists 700+ schools with non-unique abbreviations, so teams resolve from box scores (`skipLeagueTeams`, `rosterFromBoxTeams`) and the UI uses the DB display name + neutral colors. Logos come from ESPN's shared `ncaa` bucket by team id. |
| Schedule + game odds | `run-schedule.ts`, `gameOdds.ts` | Same D-I groups filter; resolver from box-score teams. |
| Injuries | `injuries.ts` | ESPN CBB injuries feed. |
| Stat keys / SEO pages | `stats/types.ts` (shares `NBA_STAT_KEYS`), `propStats.ts` | pts, reb, ast, fg3m, pra, stl, blk, tov, fs. |
| Season resolution | `season.ts` `currentCbbSeason` | "YYYY-YY"; cutoff Oct 1. |
| Book lines | prizepicks / underdog / sleeper / pick6 / rotowire | CBB stat/wager maps present in all five (see below). |
| Off-season fallback | verified locally | `/cbb`, `/cbb/accuracy`, `/cbb/players`, `/cbb/leaders` all render the graceful off-season state (no games → leaders/browse fallback), HTTP 200. |

### ⚠️ Needs a first-week-of-season spot check (cannot be done off-season)

Every book scraper matches the source's **display string** to our StatKey. Those
strings are confirmed for MLB (live when written) but **best-guess for CBB** — a
mismatch silently drops that market (falls back to our computed line; never wrong,
just missing). Check each book's CBB board once markets post and add any unmapped
strings the logs report:

1. **PrizePicks** — `prizepicks.ts` `PP_STAT_MAP.cbb`. Most complete (includes
   pr/pa/ra combos + **Fantasy Score**). Confirm the display strings
   (`'3-PT Made'`, `'Pts+Rebs+Asts'`, `'Blocked Shots'`, `'Fantasy Score'`).
2. **Underdog** — `underdog.ts` `cbb` map (lowercased keys).
3. **Sleeper** — `sleeper.ts` `cbb` map (wager types). Comment already flags
   "best-guess … verify in season."
4. **DK Pick6** — `pick6.ts` `P6_STAT_MAP.cbb`. Comment: "College mirrors the pro
   market names (best-guess — verify in season)."
5. **RotoWire** — `rotowire.ts` `cbb` map.

6. **CBB Fantasy Score formula** — `stats/types.ts` maps `cbb → 'fs'`, i.e. the
   NBA basketball formula (PTS×1 · REB×1.2 · AST×1.5 · STL×3 · BLK×3 · TOV×−1).
   PrizePicks applies one uniform basketball formula across NBA/WNBA/CBB, so this
   should be correct — but **verify against a live PP CBB Fantasy Score prop**:
   pick a player, compute the formula from their box score, confirm it matches the
   FS line's implied scoring. If PP ever diverges the college formula, split a
   `cbbFs` key out rather than sharing `'fs'` (the historical FS values we compute
   would otherwise be wrong).

### How to run the day-one check (≈15 min, in-season)

```bash
# 1. Pull a live slate (needs to run outside a cloud IP only for NBA; CBB via ESPN is fine)
pnpm ingest:cbb          # box scores → Player/Game/PlayerGameStat
pnpm schedule            # upcoming slate

# 2. Pull book lines and READ THE PER-SOURCE COUNTS in the log line:
#    "[providedlines] upserted N (prizepicks=.., underdog=.., …)"
#    A source at 0 for CBB while its board clearly has CBB props = a stat-map miss.
pnpm ingest:providedlines

# 3. Eyeball a CBB player page: /cbb/<slug> — stat chips, hit rates, a real book
#    line, and (if PP is on) the Fantasy Score chip. Spot-check the FS math.
```

Unmapped markets are logged, not fatal — grep the ingest output for skipped stat
types and add them to the maps above.

## Monetization note (carried from GROWTH-PLAN)

Several states **restrict college player props**. The site is research-only, but
CBB (and CFB) are excluded from social auto-posts by default
(`SOCIAL_SPORTS_EXCLUDE=cfb,cbb`). Keep that in mind before any CBB-specific
monetization or promotion.
