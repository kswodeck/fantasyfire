// Next.js server instrumentation hook — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Reports errors thrown while rendering Server Components, in route handlers and
// server actions — the ones that otherwise only reach Vercel's runtime logs.
export const onRequestError = Sentry.captureRequestError;
