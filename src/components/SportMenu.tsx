'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SPORTS, type Sport } from '@/lib/sports';
import { sectionHref, sportSections } from '@/lib/sportNav';

/**
 * Header sport button with a hover/focus dropdown of that sport's section pages.
 * Clicking the button itself navigates to the sport home; the menu opens on hover
 * (desktop) or keyboard focus, and closes on Escape / blur / item click. On touch
 * (no hover) the button just navigates — the in-page SportNav covers sections there.
 */
export function SportMenu({ sport }: { sport: Sport }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const menuId = useId();

  const name = SPORTS[sport].name;
  const active = pathname === `/${sport}` || pathname.startsWith(`/${sport}/`);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const openNow = () => {
    cancelClose();
    setOpen(true);
  };
  // Small delay so crossing the tiny gap from button to menu doesn't flicker.
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 90);
  };

  return (
    <div
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onFocus={openNow}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <Link
        href={`/${sport}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={`flex items-center gap-1 transition-colors hover:text-foreground ${
          active ? 'text-foreground' : ''
        }`}
      >
        {name}
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </Link>

      {/* Disclosure of plain links, NOT role="menu" — declaring menu semantics
          without arrow-key/roving-focus support breaks the ARIA contract, and
          Tab-through links is exactly what this is. */}
      {open && (
        <div
          id={menuId}
          aria-label={`${name} sections`}
          className="absolute right-0 top-full z-30 pt-2"
        >
          <div className="w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-xl shadow-black/40">
            {sportSections(sport).map((s) => (
              <Link
                key={s.seg}
                href={sectionHref(sport, s.seg)}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 transition-colors hover:bg-surface-2"
              >
                <div className="text-sm font-medium text-foreground">{s.label}</div>
                <div className="text-xs text-muted">{s.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
