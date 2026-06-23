# FantasyFire — `stats.nba.com` client (reference implementation)

Drop-in, dependency-free TypeScript client for the two free NBA endpoints the MVP runs on. Verified: typechecks clean and all unit tests pass.

## Where it goes
Copy the whole `nba/` folder into your repo at:
```
src/ingest/nba/
├─ types.ts        # shared types
├─ columnar.ts     # columnar parser (headers[]+rowSet[][] -> objects) + coercion
├─ matchup.ts      # "BOS @ LAL" / "BOS vs. LAL" -> opponent + home/away
├─ http.ts         # headers, rate limiter, fetch w/ timeout+retry+block detection
├─ client.ts       # NbaStatsClient: getPlayerIndex(), getLeagueGameLog()
├─ index.ts        # barrel exports
└─ client.test.ts  # Vitest unit tests (pure, no network)
```
No third-party deps — it uses global `fetch`/`AbortController` (Node 18+). Vitest is the only thing needed to run the tests.

## What it does
- **`getPlayerIndex()`** → one call to `/playerindex`: every player with `personId`, name, `slug`, `teamId`, `position`, and a coarse `posBucket` (`G`/`F`/`C`) for DvP.
- **`getLeagueGameLog()`** → one call to `/leaguegamelog` (`PlayerOrTeam=P`): every player's game-by-game box score for the season, with `MATCHUP` already parsed into `opponentAbbreviation` + `isHome`. **Returns the full season in a single response — there is no pagination.**

Both use the same NBA `PLAYER_ID`, so they join cleanly. One nightly pull of each = the entire league, with no per-player rate-limit problems.

## Built-in resilience (the important part)
- **Required browser-like headers** are baked in (without them, stats.nba.com hangs forever).
- **Serialized rate limiter** spaces requests ≥1.2s apart by default.
- **Per-request timeout + retry with exponential backoff.**
- **Cloud-IP-block detection:** if every retry times out — the classic symptom of stats.nba.com blocking a datacenter/cloud IP — it throws `NbaLikelyBlockedError` with a clear message and fixes, instead of looping silently. **If you see this, it's the IP block, not a bug. Do not stub/fake data to get around it** — run the ingest from GitHub Actions, a small VPS, or locally; or fall back to ESPN.
- **`assertColumns()`** logs a warning naming any expected column the NBA has renamed, so breakage is obvious and pinpointed (the parser maps by name, so reordering never breaks it).

## Usage — `run-ingest.ts` orchestration sketch
This is a starting point to adapt. It derives teams from the game log itself (no separate teams endpoint needed) and upserts everything idempotently.

> **Schema note:** make `Game.nbaId` a **String** (NBA `GAME_ID` is zero-padded — storing it as `Int` silently drops leading zeros). The MVP plan's schema has been updated for this.

> **Perf note:** the per-row `await` loops below are for clarity. For a full season (tens of thousands of rows) replace them with batched writes — `createMany({ ..., skipDuplicates: true })` for the initial seed, or chunked transactions — or the ingest will be slow.

```ts
// src/ingest/run-ingest.ts
// Run OUTSIDE Vercel (GitHub Actions / VPS / local) — stats.nba.com blocks many cloud IPs.
//   pnpm tsx src/ingest/run-ingest.ts
import { PrismaClient } from '@prisma/client';
import { NbaStatsClient } from './nba';

const prisma = new PrismaClient();
const SEASON = process.env.NBA_SEASON ?? '2025-26';

async function main() {
  const nba = new NbaStatsClient({ season: SEASON });

  console.log('Fetching player index…');
  const players = await nba.getPlayerIndex();
  console.log(`  ${players.length} players`);

  console.log('Fetching league game log (full season, one response)…');
  const logs = await nba.getLeagueGameLog();
  console.log(`  ${logs.length} player-game rows`);

  // 1) Teams — derive distinct teams from the game log.
  const teamByAbbr = new Map<string, { nbaId: number; abbreviation: string }>();
  for (const row of logs) {
    if (!teamByAbbr.has(row.teamAbbreviation)) {
      teamByAbbr.set(row.teamAbbreviation, {
        nbaId: row.teamId,
        abbreviation: row.teamAbbreviation,
      });
    }
  }
  for (const t of teamByAbbr.values()) {
    await prisma.team.upsert({
      where: { nbaId: t.nbaId },
      create: { nbaId: t.nbaId, abbreviation: t.abbreviation, name: t.abbreviation },
      update: { abbreviation: t.abbreviation },
    });
  }
  const teamRows = await prisma.team.findMany();
  const teamIdByNbaId = new Map(teamRows.map((t) => [t.nbaId, t.id]));
  const teamIdByAbbr = new Map(teamRows.map((t) => [t.abbreviation, t.id]));

  // 2) Players
  for (const p of players) {
    await prisma.player.upsert({
      where: { nbaId: p.personId },
      create: {
        nbaId: p.personId,
        firstName: p.firstName,
        lastName: p.lastName,
        slug: p.slug,
        position: p.position ?? undefined,
        posBucket: p.posBucket ?? undefined,
        teamId: p.teamId ? teamIdByNbaId.get(p.teamId) : undefined,
      },
      update: {
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position ?? undefined,
        posBucket: p.posBucket ?? undefined,
        teamId: p.teamId ? teamIdByNbaId.get(p.teamId) : undefined,
      },
    });
  }
  const playerRows = await prisma.player.findMany({ select: { id: true, nbaId: true } });
  const playerIdByNbaId = new Map(playerRows.map((p) => [p.nbaId, p.id]));

  // 3) Games + player game stats
  for (const row of logs) {
    const teamId = teamIdByAbbr.get(row.teamAbbreviation);
    const opponentTeamId = teamIdByAbbr.get(row.opponentAbbreviation);
    const playerId = playerIdByNbaId.get(row.playerId);
    if (!teamId || !opponentTeamId || !playerId) continue; // skip unmapped rows

    const homeTeamId = row.isHome ? teamId : opponentTeamId;
    const awayTeamId = row.isHome ? opponentTeamId : teamId;

    const game = await prisma.game.upsert({
      where: { nbaId: row.gameId }, // String
      create: {
        nbaId: row.gameId,
        date: new Date(row.gameDate),
        season: SEASON,
        homeTeamId,
        awayTeamId,
      },
      update: {},
    });

    await prisma.playerGameStat.upsert({
      where: { playerId_gameId: { playerId, gameId: game.id } },
      create: {
        playerId, gameId: game.id, teamId, opponentTeamId,
        isHome: row.isHome, season: SEASON, gameDate: new Date(row.gameDate),
        minutes: row.minutes ?? undefined,
        points: row.pts, rebounds: row.reb, assists: row.ast,
        steals: row.stl, blocks: row.blk, turnovers: row.tov,
        fgm: row.fgm, fga: row.fga, fg3m: row.fg3m, fg3a: row.fg3a,
        ftm: row.ftm, fta: row.fta,
      },
      update: {
        minutes: row.minutes ?? undefined,
        points: row.pts, rebounds: row.reb, assists: row.ast,
        steals: row.stl, blocks: row.blk, turnovers: row.tov,
        fgm: row.fgm, fga: row.fga, fg3m: row.fg3m, fg3a: row.fg3a,
        ftm: row.ftm, fta: row.fta,
      },
    });
  }

  console.log('Ingest complete.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
```

## Run the tests
```bash
pnpm vitest run src/ingest/nba
```

## Caveats / things to know
- **Unofficial endpoints.** They can change shape or disappear. `assertColumns()` warnings will tell you exactly what moved.
- **Offseason returns little/nothing.** `NBA_SEASON` is configurable; handle empty results gracefully.
- **Positions are coarse.** `posBucket` uses the primary listed position into 3 buckets (G/F/C) for denser DvP samples — don't over-claim DvP precision in the UI.
- **Don't run it on Vercel.** Cloud IP blocking is real; this is why the architecture puts ingest on GitHub Actions / a VPS / local, writing to Postgres, with the web app only reading.
- **ESPN is the documented fallback** if GH Actions IPs also get blocked. The shapes differ; you'd add an alternate client implementing the same `PlayerIndexRow` / `PlayerGameLogRow` outputs.
- **Re-verify the endpoints behave** the first time you run against a live season — confirm row counts look sane before trusting downstream metrics.
