'use client';

import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import type { Sport } from '@/lib/sports';

/**
 * "Embed this" — shows a copy-paste <iframe> snippet for the player's hit-rate card.
 * Every embed carries a backlink, so this is the acquisition loop driver. Opens a
 * small modal so the snippet has room; the URL is built from the live origin so it
 * works in dev and prod.
 */
export function EmbedButton({
  sport,
  slug,
  className = '',
}: {
  sport: Sport;
  slug: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const snippet = `<iframe src="${origin}/embed/${sport}/${slug}" width="380" height="250" style="border:0;border-radius:14px;max-width:100%" loading="lazy" title="FantasyFire hit-rate card"></iframe>`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    taRef.current?.select();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      taRef.current?.select();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          track('embed_opened', { sport });
        }}
        aria-haspopup="dialog"
        className={
          'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground ' +
          className
        }
      >
        <span aria-hidden="true">{'</>'}</span>
        <span>Embed</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Embed this card"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold">Embed this card</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full px-2 text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">
              Paste this into any site or blog. It stays live and links back here.
            </p>
            <textarea
              ref={taRef}
              readOnly
              value={snippet}
              rows={4}
              className="mt-3 w-full resize-none rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs text-foreground"
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={copy}
                className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
              >
                {copied ? '✓ Copied' : 'Copy snippet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
