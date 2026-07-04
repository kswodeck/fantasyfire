import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { PlaybookClient } from '@/components/PlaybookClient';
import { PushOptIn } from '@/components/PushOptIn';
import { InstallPrompt } from '@/components/InstallPrompt';

export const metadata: Metadata = {
  title: 'My Playbook',
  description:
    'Your saved players and props — pinned on this device for quick access to their hit rates, matchups, and live FireFactor reads. No login required.',
  alternates: { canonical: '/playbook' },
  // Personal, device-local, and empty for crawlers — keep it out of the index.
  robots: { index: false, follow: true },
};

export default function PlaybookPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-2 py-8 sm:px-4">
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
      <InstallPrompt />
    </div>
  );
}
