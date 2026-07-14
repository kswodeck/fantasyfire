'use client';

// One-line "start your Playbook" hint on player pages (MARKETING.md Phase 2):
// shown only while the visitor has saved NOTHING yet (the SEO-lander case —
// save one player and they're push-reachable with a populated /playbook on
// return) and disappears forever once dismissed or once anything is saved.
import { useEffect, useState } from 'react';

const SAVED_KEY = 'ff:savedprops:v1'; // savedProps.ts source of truth
const DISMISS_KEY = 'ff:savenudge:v1';

export function SaveNudge() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Deferred a tick: reading localStorage is fine in an effect, but setting
    // state synchronously inside one triggers cascading-render lint (React 19).
    const id = window.setTimeout(() => {
      try {
        if (localStorage.getItem(DISMISS_KEY)) return;
        const saved = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]');
        if (Array.isArray(saved) && saved.length === 0) setVisible(true);
      } catch {
        /* storage unavailable — skip */
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
      <span>
        <span aria-hidden="true">☆</span> Tap <span className="font-medium">Save player</span> (or
        save a specific prop under any verdict) to start your Playbook — saved on this device, no
        account needed.
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss save suggestion"
        className="shrink-0 rounded px-1.5 py-0.5 transition-colors hover:text-foreground"
      >
        ✕
      </button>
    </div>
  );
}
