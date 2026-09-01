// Prisma client singleton.
//
// Prisma 7 requires a driver adapter (here @prisma/adapter-pg over node-postgres).
// The pg Pool connects lazily on first query, so importing this module does not
// open a connection — the app can build/typecheck without a live database.
//
// The global cache guards against exhausting connections during Next.js dev
// hot-reload (each reload would otherwise create a fresh client).
import 'dotenv/config';
// Relative (not the @/ alias) so tsx-run scripts (ingest, seed) resolve it
// without needing tsconfig path support.
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const createPrismaClient = () => {
  const raw = process.env.DATABASE_URL ?? '';
  // Managed Postgres (Supabase/Neon) requires TLS. node-postgres parses `sslmode=`
  // from the URL and (as of pg 8.22) does FULL cert verification, which overrides any
  // explicit ssl option and fails on these providers' cert chains
  // (SELF_SIGNED_CERT_IN_CHAIN). Prisma's own connector — used by `prisma migrate` —
  // handles sslmode fine, but the driver adapter does not. So for the app/runtime we
  // strip sslmode and set ssl ourselves (encrypted, without bundling each CA).
  // `prisma migrate` keeps using the original URL (with sslmode) from prisma.config.ts.
  const hasSslmode = /[?&]sslmode=/i.test(raw);
  const connectionString = hasSslmode ? raw.replace(/[?&]sslmode=[^&]*/i, '') : raw;
  // Small per-process pool. DATABASE_URL should point at Supabase's TRANSACTION
  // pooler (port 6543), which multiplexes many clients onto few server connections
  // — so a low `max` per process keeps the multi-worker build and serverless
  // functions well under the pooler's client limit. (Migrations use DIRECT_URL /
  // the session pooler via prisma.config.ts.)
  // `next build` loads this module once per static-generation WORKER, each with its own
  // independent pool — and Vercel's builder ran seven of them. 7 x max:3 = 21 clients
  // asking Supabase's transaction pooler for connections at once, which is what killed
  // deployment 7dfATKvnJ at page 405 of 1,620 with "timeout exceeded when trying to
  // connect" while prerendering /mlb/cole-young.
  //
  // Prerendering is THROUGHPUT work, not request-latency work. A page that waits half a
  // minute for a connection is fine; a build that dies two-thirds of the way through is
  // not. So the build phase holds fewer connections per worker (less total demand on the
  // pooler) and waits far longer before giving up, while the serving runtime keeps the
  // tight timeout that makes a stalled request fail fast and retry.
  //
  // Next sets NEXT_PHASE for the duration of the build (next/dist/build/index.js).
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
  const adapter = new PrismaPg({
    connectionString,
    // 7 workers x 2 = 14 clients rather than 21. Within a worker the board path issues
    // its independent queries together, so a smaller pool means more queueing — which
    // the longer timeout below is there to absorb.
    max: isBuild ? 2 : 3,
    // Runtime: fail a stalled connect in ~10s instead of waiting on the OS TCP timeout
    // (tens of seconds). The pooler occasionally blips; callers that retry (see
    // dbRetry.ts) then recover quickly rather than burning a cron run's whole budget on
    // one hang. Build: wait it out instead — throwing here costs the whole deploy.
    connectionTimeoutMillis: isBuild ? 45_000 : 10_000,
    ...(hasSslmode ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientSingleton;
};

export const db: PrismaClientSingleton = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
