'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SPORTS, isSport, type Sport } from '@/lib/sports';
import { NAV_SPORT_ORDER, sectionHref, sportSections } from '@/lib/sportNav';

/** How long the pointer must rest on a sport row before the sections column swaps
 *  to it. Kills the diagonal-travel bug: moving from a lower sport row toward its
 *  sections crosses the rows above it (NFL sits on top), and an instant swap would
 *  re-point every section link at whatever row the pointer grazed last. */
const HOVER_INTENT_MS = 120;

/**
 * The header's single "Sports" menu — replaces the row of per-sport buttons. A
 * two-column panel: sports on the left (popularity order — see NAV_SPORT_ORDER),
 * the highlighted sport's section pages on the right. Clicking a sport navigates
 * to its hub; hovering (with intent) or focusing it swaps the sections column.
 * Opens on hover or focus, closes on Escape / blur / item click.
 */
export function SportsMenu() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A focus/hover that just opened the menu must not be immediately undone by the
  // click event that follows it (touch fires hover+focus+click in one tap).
  const justOpened = useRef(false);
  const pathname = usePathname();
  const menuId = useId();

  const seg = pathname.split('/')[1];
  const onSportPage = isSport(seg);
  const [active, setActive] = useState<Sport>(onSportPage ? seg : NAV_SPORT_ORDER[0]);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const cancelIntent = () => {
    if (intentTimer.current) clearTimeout(intentTimer.current);
  };
  const close = () => {
    cancelClose();
    cancelIntent();
    justOpened.current = false;
    setOpen(false);
  };
  const openNow = () => {
    cancelClose();
    if (!open) {
      // Re-anchor the sections column on the sport being viewed ONLY when the
      // menu transitions closed -> open. Focus events BUBBLE from every link
      // inside the panel (a click focuses its link first), so re-anchoring on
      // any focus would yank the column back right before navigation.
      if (onSportPage) setActive(seg);
      justOpened.current = true;
    }
    setOpen(true);
  };
  // Small delay so crossing the tiny gap from button to menu doesn't flicker.
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      justOpened.current = false;
      setOpen(false);
    }, 90);
  };
  /** Swap the sections column after the pointer RESTS on a row (see HOVER_INTENT_MS);
   *  keyboard focus swaps immediately — no diagonal-travel problem there. */
  const intendActive = (s: Sport) => {
    cancelIntent();
    intentTimer.current = setTimeout(() => setActive(s), HOVER_INTENT_MS);
  };

  return (
    <div
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onFocus={openNow}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
    >
      <button
        type="button"
        onClick={() => {
          // The hover/focus of this same tap already opened it — don't re-toggle.
          if (justOpened.current) {
            justOpened.current = false;
            return;
          }
          if (open) close();
          else openNow();
        }}
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
            <ul className="w-28 shrink-0 border-r border-line py-1" onMouseLeave={cancelIntent}>
              {NAV_SPORT_ORDER.map((s) => (
                <li key={s}>
                  <Link
                    href={`/${s}`}
                    onClick={close}
                    onMouseEnter={() => intendActive(s)}
                    onFocus={() => {
                      cancelIntent();
                      setActive(s);
                    }}
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
                  onClick={close}
                  className="block px-3 py-2 transition-colors hover:bg-surface-2"
                >
                  <div className="text-sm font-medium text-foreground">
                    {s.label}
                    <span className="sr-only"> — {SPORTS[active].name}</span>
                  </div>
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
