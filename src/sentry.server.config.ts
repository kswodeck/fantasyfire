// Sentry for the Node.js server runtime (Server Components, route handlers, ISR
// regenerations). Loaded from src/instrumentation.ts.
import * as Sentry from '@sentry/nextjs';
import { SENTRY_DATA_COLLECTION } from '@/lib/sentryDataCollection';

Sentry.init({
  // Unset DSN = SDK is inert, so the app runs fine before Sentry is connected.
  // The Vercel Marketplace integration sets these on the project.
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  // Errors only. Speed Insights already covers performance, and the free plan's
  // quota is better spent on errors than on spans.
  tracesSampleRate: 0,
  dataCollection: SENTRY_DATA_COLLECTION,
});
