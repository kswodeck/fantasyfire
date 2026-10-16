'use client';

// Last-resort boundary: replaces the root layout when it (or anything not caught
// by src/app/error.tsx) throws, so it must render its own <html>/<body>. Reports
// to Sentry, because client-side render errors caught by a boundary are not
// reported automatically.
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import './globals.css';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <title>Something went wrong · FantasyFire</title>
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted">
            FantasyFire hit an unexpected error. It&apos;s been reported — try again, or
            head back home.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
            >
              Try again
            </button>
            {/* Plain <a>: the root layout (and router context) may be what crashed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold"
            >
              Back to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
