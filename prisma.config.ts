// Prisma 7 configuration. Replaces the old package.json `prisma` key.
// Prisma 7 does NOT auto-load .env at runtime, so we load it explicitly here.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Demo seed (clearly-labeled SYNTHETIC data) so the UI is runnable without
    // live NBA access. The real data path is `pnpm ingest` (stats.nba.com).
    seed: 'tsx prisma/seed-demo.ts',
  },
  datasource: {
    // The CLI (migrations) uses a DIRECT, non-pooled connection. Neon/Supabase
    // provide a separate DIRECT_URL; for a plain Postgres it equals DATABASE_URL.
    // The app runtime uses the pooled DATABASE_URL via the adapter in src/lib/db.ts.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
