'use client';

// Page-level error boundary: keeps the site header/footer (the root layout) on
// screen when a page throws, instead of falling through to global-error.tsx.
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { useEffect } from 'react';
import { FlameMark } from '@/components/FlameMark';

export default function Error({
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
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <FlameMark className="h-10 w-10 text-brand" />
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted">
        This page hit an unexpected error. It&apos;s been reported — try again, or head
        back home.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
