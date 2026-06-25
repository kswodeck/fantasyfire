import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { PlaybookClient } from '@/components/PlaybookClient';
import { PushOptIn } from '@/components/PushOptIn';

export const metadata: Metadata = {
  title: 'My Playbook',
  description:
    'Your saved players and props — pinned on this device for quick access to their hit rates, matchups, and live FireScore reads. No login required.',
  alternates: { canonical: '/playbook' },
  // Personal, device-local, and empty for crawlers — keep it out of the index.
  robots: { index: false, follow: true },
};

export default function PlaybookPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs className="mb-4" items={[{ label: 'Home', href: '/' }, { label: 'My Playbook' }]} />
      <h1 className="text-3xl font-bold tracking-tight">My Playbook</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Players and props you&rsquo;ve saved — pinned on this device. Save a whole player with the{' '}
        <span className="font-medium text-foreground">☆ Save player</span> button, or track a
        specific stat, line, and side with the{' '}
        <span className="font-medium text-foreground">★ Over / Under</span> buttons under any
        verdict.
      </p>
      <PlaybookClient />
      <PushOptIn />
    </div>
  );
}
