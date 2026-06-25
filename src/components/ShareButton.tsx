'use client';

import { useState } from 'react';
import { track } from '@/lib/analytics';

/**
 * Share the current page. Uses the native Web Share sheet on mobile (which carries
 * the page's OG card), and falls back to copying the link to the clipboard on
 * desktop. Shares window.location.href so a per-stat page shares its stat-specific
 * card.
 */
export function ShareButton({ title, className = '' }: { title?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = window.location.href;
    track('shared');
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: title ?? document.title, url });
      } catch {
        // User dismissed the share sheet — nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — silently ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      aria-label="Share this page"
      title="Share"
      className={
        'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground ' +
        className
      }
    >
      <span aria-hidden="true">{copied ? '✓' : '↗'}</span>
      <span>{copied ? 'Copied' : 'Share'}</span>
    </button>
  );
}
