// Sentry for the Edge runtime (edge route handlers, OG images if they move to
// edge). Loaded from src/instrumentation.ts.
import * as Sentry from '@sentry/nextjs';
import { SENTRY_DATA_COLLECTION } from '@/lib/sentryDataCollection';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0,
  dataCollection: SENTRY_DATA_COLLECTION,
});
