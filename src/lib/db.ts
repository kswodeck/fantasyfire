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
  const adapter = new PrismaPg({
    connectionString,
    max: 3,
    // Fail a stalled connect in ~10s instead of waiting on the OS TCP timeout (tens
    // of seconds). The pooler occasionally blips; callers that retry (see dbRetry.ts)
    // then recover quickly rather than burning a cron run's whole budget on one hang.
    connectionTimeoutMillis: 10_000,
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
