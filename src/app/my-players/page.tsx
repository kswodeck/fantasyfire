import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { MyPlayersClient } from '@/components/MyPlayersClient';
import { PushOptIn } from '@/components/PushOptIn';

export const metadata: Metadata = {
  title: 'My Players',
  description:
    'Your saved players — pinned on this device for quick access to their hit rates and matchups. No login required.',
  alternates: { canonical: '/my-players' },
  // Personal, device-local, and empty for crawlers — keep it out of the index.
  robots: { index: false, follow: true },
};

export default function MyPlayersPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: 'My Players' }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">My Players</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Players you&rsquo;ve saved with the ☆ button — pinned on this device for one-tap access to
        their latest hit rates and matchups.
      </p>
      <MyPlayersClient />
      <PushOptIn />
    </div>
  );
}
