'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { track } from '@/lib/analytics';

/** Chromium's non-standard install event — not in lib.dom, so typed here. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'install-prompt-dismissed';
// Re-offer after 60 days — a one-click "not now" shouldn't be forever.
const DISMISS_TTL_MS = 60 * 24 * 60 * 60 * 1000;

// Environment facts that never change during a page's lifetime, read via
// useSyncExternalStore so SSR/hydration render nothing and the real values
// apply after mount (no sync setState in an effect, no hydration mismatch).
const subscribeNever = () => () => {};

function wasDismissedSnapshot(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function isStandaloneSnapshot(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}

function isIosSnapshot(): boolean {
  // iPadOS 13+ reports itself as macOS; the touch check catches it.
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

/**
 * Value-first install affordance, rendered inline on high-intent surfaces (the
 * Playbook) — never an interstitial. Three states:
 *   - Chromium: `beforeinstallprompt` fired → button that opens the native prompt.
 *   - iOS Safari (no prompt API): short Share → Add to Home Screen instructions.
 *   - Installed / unsupported / dismissed: renders nothing.
 */
export function InstallPrompt() {
  const isStandalone = useSyncExternalStore(subscribeNever, isStandaloneSnapshot, () => true);
  const isIos = useSyncExternalStore(subscribeNever, isIosSnapshot, () => false);
  const dismissedBefore = useSyncExternalStore(subscribeNever, wasDismissedSnapshot, () => true);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep Chrome's mini-infobar from double-prompting
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setClosed(true);
      track('pwa_installed');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Nothing to offer: installed, dismissed, or a browser with no install path
  // where we'd just show a dead card (desktop Firefox, etc.).
  if (isStandalone || dismissedBefore || closed || (!installEvent && !isIos)) return null;

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    track('pwa_install_prompt', { outcome });
    if (outcome === 'accepted') setClosed(true);
    setInstallEvent(null); // the event is single-use
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode — dismissal just won't persist */
    }
    setClosed(true);
  }

  return (
    <div className="mt-6 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Add FantasyFire to your home screen</h2>
          {isIos && !installEvent ? (
            <p className="mt-1 text-sm text-muted">
              Install the app for full-screen research and offline access: tap{' '}
              <span className="font-medium text-foreground">Share</span>
              <span aria-hidden="true"> (the square with an up arrow)</span>, then{' '}
              <span className="font-medium text-foreground">Add to Home Screen</span>.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">
              Faster loads, offline access to recent pages, and heat alerts — no app store
              needed.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install suggestion"
          className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted transition-colors hover:text-foreground"
        >
          Not now
        </button>
      </div>
      {installEvent && (
        <button
          type="button"
          onClick={install}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
        >
          <span aria-hidden="true">⬇️</span> Install app
        </button>
      )}
    </div>
  );
}
