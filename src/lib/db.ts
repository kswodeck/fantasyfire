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
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
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
