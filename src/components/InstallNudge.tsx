'use client';

// Subtle PWA install nudge (MARKETING.md Phase 2): after the visitor's SECOND
// visit, if the browser offers install (beforeinstallprompt — Chrome/Edge/
// Android; Safari never fires it, so iOS sees nothing), show a small dismiss-
// able banner. localStorage only, honoring the no-auth stance; dismissing is
// permanent.
import { useEffect, useState } from 'react';

const VISITS_KEY = 'ff:visits';
const DISMISS_KEY = 'ff:installnudge:v1';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallNudge() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
      // Count one visit per browser session.
      if (!sessionStorage.getItem(VISITS_KEY)) {
        sessionStorage.setItem(VISITS_KEY, '1');
        const visits = Number(localStorage.getItem(VISITS_KEY) ?? '0') + 1;
        localStorage.setItem(VISITS_KEY, String(visits));
      }
      const visits = Number(localStorage.getItem(VISITS_KEY) ?? '0');
      if (visits < 2) return;

      const onPrompt = (e: Event) => {
        e.preventDefault();
        setDeferred(e as BeforeInstallPromptEvent);
        setVisible(true);
      };
      window.addEventListener('beforeinstallprompt', onPrompt);
      return () => window.removeEventListener('beforeinstallprompt', onPrompt);
    } catch {
      // Storage unavailable (private mode etc.) — never block the page.
      return;
    }
  }, []);

  if (!visible || !deferred) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const install = async () => {
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      dismiss();
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full border border-line bg-surface-2 py-2 pl-4 pr-2 text-sm shadow-lg">
        <span>
          Add <span className="font-semibold">FantasyFire</span>{' '}
          to your home screen — one tap to today&rsquo;s boards.
        </span>
        <button
          type="button"
          onClick={install}
          className="rounded-full bg-brand px-3 py-1 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
        >
          Install
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install suggestion"
          className="rounded-full px-2 py-1 text-muted transition-colors hover:text-foreground"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
