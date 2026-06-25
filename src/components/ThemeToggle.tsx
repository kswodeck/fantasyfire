'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function resolvedTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Light/dark toggle. The saved choice lives in localStorage and is applied
 * before paint by the inline script in the root layout; this just flips it.
 * A single contrast icon (no sun/moon swap) keeps SSR + first paint stable.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(resolvedTheme());
  }, []);

  function toggle() {
    const next: Theme = (theme ?? resolvedTheme()) === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Private mode / storage disabled — the toggle still works for this session.
    }
    setTheme(next);
  }

  const label = theme ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        {/* Left half filled — the universal "theme" mark, independent of mode. */}
        <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />
      </svg>
    </button>
  );
}
