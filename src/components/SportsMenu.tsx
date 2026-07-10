'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SPORTS, isSport, type Sport } from '@/lib/sports';
import { NAV_SPORT_ORDER, sectionHref, sportSections } from '@/lib/sportNav';

/**
 * The header's single "Sports" menu — replaces the row of per-sport buttons. A
 * two-column panel: sports on the left (popularity order — see NAV_SPORT_ORDER),
 * the highlighted sport's section pages on the right. Clicking a sport navigates
 * to its hub; hovering/focusing it swaps the sections column. Opens on hover or
 * focus (same semantics as the old SportMenu), closes on Escape / blur / click.
 */
export function SportsMenu() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const menuId = useId();

  const seg = pathname.split('/')[1];
  const onSportPage = isSport(seg);
  const [active, setActive] = useState<Sport>(onSportPage ? seg : NAV_SPORT_ORDER[0]);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const openNow = () => {
    cancelClose();
    // Re-anchor the sections column on the sport being viewed, so the menu opens
    // "about here" instead of wherever it was left last time.
    if (onSportPage) setActive(seg);
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={`flex items-center gap-1 transition-colors hover:text-foreground ${
          onSportPage ? 'text-foreground' : ''
        }`}
      >
        Sports
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
      </button>

      {/* Disclosure of plain links, NOT role="menu" — same rationale as the old
          per-sport menu: Tab-through links, no fake menu semantics. */}
      {open && (
        <div id={menuId} aria-label="Sports" className="absolute left-0 top-full z-30 pt-2">
          <div className="flex w-[26rem] overflow-hidden rounded-xl border border-line bg-surface shadow-xl shadow-black/40">
            <ul className="w-28 shrink-0 border-r border-line py-1">
              {NAV_SPORT_ORDER.map((s) => (
                <li key={s}>
                  <Link
                    href={`/${s}`}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setActive(s)}
                    onFocus={() => setActive(s)}
                    aria-current={seg === s ? 'page' : undefined}
                    className={`block px-3 py-1.5 text-sm font-medium transition-colors hover:text-foreground ${
                      active === s ? 'bg-surface-2 text-foreground' : 'text-muted'
                    }`}
                  >
                    {SPORTS[s].name}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="min-w-0 flex-1 py-1" aria-label={`${SPORTS[active].name} sections`}>
              {sportSections(active).map((s) => (
                <Link
                  key={s.seg}
                  href={sectionHref(active, s.seg)}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 transition-colors hover:bg-surface-2"
                >
                  <div className="text-sm font-medium text-foreground">{s.label}</div>
                  <div className="text-xs text-muted">{s.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
