// prisma/seed-demo.ts
//
// Seeds CLEARLY-SYNTHETIC data so the UI is browsable without live NBA access.
// This is NOT real NBA data — names are "Demo …" and ids live in a high range so
// they never collide with a real `pnpm ingest`. For real data use `pnpm ingest`.
//
//   pnpm seed
import 'dotenv/config';
import { db } from '../src/lib/db';
import { slugify } from '../src/ingest/nba';

const SEASON = process.env.NBA_SEASON ?? '2025-26';

// Deterministic PRNG so demo averages are stable across runs.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);
const randn = () => (rng() + rng() + rng() - 1.5) * 1.4; // ~N(0,1)-ish
const clamp0 = (n: number) => Math.max(0, Math.round(n));

const TEAMS = ['DMA', 'DMB', 'DMC', 'DMD', 'DME', 'DMF', 'DMG', 'DMH'];
const POS = ['G', 'G', 'F', 'F', 'C'] as const;
const BUCKET: Record<string, string> = { G: 'G', F: 'F', C: 'C' };

// Per-position scoring baselines (points, reb, ast).
const BASE: Record<string, { pts: number; reb: number; ast: number; tpm: number }> = {
  G: { pts: 18, reb: 4, ast: 6, tpm: 2.5 },
  F: { pts: 15, reb: 7, ast: 3, tpm: 1.5 },
  C: { pts: 13, reb: 10, ast: 2, tpm: 0.4 },
};

async function main() {
  console.log(`[seed-demo] seeding SYNTHETIC data for season ${SEASON}…`);

  // Teams (defense factor drives DvP variety).
  const teamIdByAbbr = new Map<string, number>();
  const defFactor = new Map<string, number>();
  for (let i = 0; i < TEAMS.length; i++) {
    const abbr = TEAMS[i];
    defFactor.set(abbr, 0.85 + (i / (TEAMS.length - 1)) * 0.3); // 0.85..1.15
    const t = await db.team.upsert({
      where: { nbaId: 990000 + i },
      create: { nbaId: 990000 + i, abbreviation: abbr, name: `Demo ${abbr}` },
      update: { abbreviation: abbr, name: `Demo ${abbr}` },
    });
    teamIdByAbbr.set(abbr, t.id);
  }

  // Players: 5 per team.
  type P = { id: number; abbr: string; pos: string; pid: number; base: typeof BASE['G'] };
  const players: P[] = [];
  let pidx = 0;
  for (const abbr of TEAMS) {
    for (let j = 0; j < POS.length; j++) {
      const pos = POS[j];
      const nbaId = 9000000 + pidx;
      const first = 'Demo';
      const last = `${abbr}-${pos}${j}`;
      const slug = slugify(`demo ${abbr} ${pos}${j}`);
      const rec = await db.player.upsert({
        where: { nbaId },
        create: {
          nbaId,
          firstName: first,
          lastName: last,
          slug,
          position: pos,
          posBucket: BUCKET[pos],
          teamId: teamIdByAbbr.get(abbr),
        },
        update: { teamId: teamIdByAbbr.get(abbr), posBucket: BUCKET[pos] },
      });
      players.push({ id: rec.id, abbr, pos, pid: nbaId, base: BASE[pos] });
      pidx++;
    }
  }

  // Games: each team plays each other once (home/away alternates). ~28 games.
  const playersByTeam = new Map<string, P[]>();
  for (const p of players) {
    const arr = playersByTeam.get(p.abbr) ?? [];
    arr.push(p);
    playersByTeam.set(p.abbr, arr);
  }

  let gameSeq = 0;
  const baseDate = new Date('2026-03-01T00:00:00Z').getTime();
  for (let a = 0; a < TEAMS.length; a++) {
    for (let b = a + 1; b < TEAMS.length; b++) {
      const homeAbbr = TEAMS[a];
      const awayAbbr = TEAMS[b];
      const homeId = teamIdByAbbr.get(homeAbbr)!;
      const awayId = teamIdByAbbr.get(awayAbbr)!;
      // Play this matchup a few times so windows have enough games.
      for (let rep = 0; rep < 4; rep++) {
        const nbaId = `DEMO${String(gameSeq).padStart(5, '0')}`;
        const date = new Date(baseDate + gameSeq * 36e5 * 24);
        const game = await db.game.upsert({
          where: { nbaId },
          create: { nbaId, date, season: SEASON, homeTeamId: homeId, awayTeamId: awayId },
          update: {},
        });

        for (const [teamAbbr, oppAbbr, isHome] of [
          [homeAbbr, awayAbbr, true] as const,
          [awayAbbr, homeAbbr, false] as const,
        ]) {
          const def = defFactor.get(oppAbbr)!;
          for (const p of playersByTeam.get(teamAbbr)!) {
            const pts = clamp0((p.base.pts + randn() * 5) * def + (isHome ? 1 : 0));
            const reb = clamp0((p.base.reb + randn() * 2.5) * def);
            const ast = clamp0((p.base.ast + randn() * 2) * def);
            const tpm = clamp0((p.base.tpm + randn()) * def);
            await db.playerGameStat.upsert({
              where: { playerId_gameId: { playerId: p.id, gameId: game.id } },
              create: {
                playerId: p.id,
                gameId: game.id,
                teamId: teamIdByAbbr.get(teamAbbr)!,
                opponentTeamId: teamIdByAbbr.get(oppAbbr)!,
                isHome,
                season: SEASON,
                gameDate: date,
                minutes: 30,
                points: pts,
                rebounds: reb,
                assists: ast,
                steals: clamp0(1 + randn() * 0.7),
                blocks: clamp0(0.6 + randn() * 0.6),
                turnovers: clamp0(1.8 + randn()),
                fgm: clamp0(pts / 2.3),
                fga: clamp0(pts / 1.1),
                fg3m: tpm,
                fg3a: clamp0(tpm * 2.4),
                ftm: clamp0(pts / 6),
                fta: clamp0(pts / 5),
              },
              update: {},
            });
          }
        }
        gameSeq++;
      }
    }
  }

  console.log('[seed-demo] done:');
  console.table({
    teams: TEAMS.length,
    players: players.length,
    games: gameSeq,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
