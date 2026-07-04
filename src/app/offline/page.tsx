import type { Metadata } from 'next';
import Link from 'next/link';
import { FlameMark } from '@/components/FlameMark';

export const metadata: Metadata = {
  title: 'Offline',
  description: 'FantasyFire is offline — reconnect to load fresh player-prop research.',
  // Service-worker fallback shell, useless to crawlers.
  robots: { index: false, follow: false },
};

/**
 * Offline fallback shell. The service worker precaches this page and serves it
 * when a navigation fails with nothing usable in the page cache, so users get a
 * branded explanation instead of the browser's network-error screen.
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <FlameMark className="h-10 w-10 text-brand" />
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="text-muted">
        This page isn&apos;t cached and the network is unreachable. Reconnect and try again —
        recently visited pages may still load from the offline cache.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
      >
        Back to home
      </Link>
    </div>
  );
}
