'use client';

import { useEffect, useState } from 'react';
import {
  currentPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from '@/lib/push/client';
import { useFavorites } from '@/hooks/useFavorites';
import { track } from '@/lib/analytics';

/**
 * Value-first push opt-in. Rendered on /playbook (a high-intent surface — the
 * user has saved players/props), never as an interstitial. Hides itself entirely when
 * push is unconfigured/unsupported, so it never shows a dead button.
 */
export function PushOptIn() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const { favorites } = useFavorites();

  useEffect(() => {
    currentPushState().then(setState);
  }, []);

  // Loading, or nothing useful to show.
  if (state === null || state === 'unconfigured' || state === 'unsupported') return null;

  async function enable() {
    setBusy(true);
    try {
      const sports = [...new Set(favorites.map((f) => f.sport))];
      const ok = await subscribeToPush(sports);
      if (ok) track('push_enabled');
      setState(await currentPushState());
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      setState(await currentPushState());
    } finally {
      setBusy(false);
    }
  }

  if (state === 'subscribed') {
    return (
      <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-line bg-over-soft p-4 text-sm">
        <span>🔔 You&rsquo;ll get a heads-up when your players have a strong lean.</span>
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className="shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted transition-colors hover:text-foreground disabled:opacity-50"
        >
          Turn off
        </button>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <p className="mt-6 rounded-xl border border-line bg-surface p-4 text-xs text-muted">
        Notifications are blocked for this site in your browser settings. Re-enable them there to
        get lean alerts.
      </p>
    );
  }

  // 'default' | 'granted' (not subscribed)
  return (
    <div className="mt-6 rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold">Get a heads-up on strong leans</h2>
      <p className="mt-1 text-sm text-muted">
        An optional push, a few times a week at most — only when a saved-sport player shows a strong
        FireScore lean. No account, no email, unsubscribe anytime.
      </p>
      <button
        type="button"
        onClick={enable}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Enabling…' : '🔔 Enable lean alerts'}
      </button>
    </div>
  );
}
