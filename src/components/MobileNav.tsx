'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SPORTS, type Sport } from '@/lib/sports';
import { NAV_SPORT_ORDER, sectionHref, sportSections } from '@/lib/sportNav';

/**
 * Mobile (sub-sm) site navigation: a hamburger button that opens a full-width panel
 * with Home, each sport (tap the name for its hub, the chevron to reveal its section
 * pages), and My Playbook — so nothing is cut off on a narrow screen. Desktop keeps the
 * inline nav + hover menus (this whole control is hidden at sm+).
 *
 * The panel is portalled to <body> because the header's `backdrop-blur` would otherwise
 * become the containing block for its fixed positioning. On open it locks background
 * scroll and moves focus into the panel (it sits last in the DOM, so without this a
 * keyboard user would tab through the whole page first). It closes on navigation, Escape,
 * a backdrop tap, or the viewport growing past `sm` (which also releases the scroll lock).
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Sport | null>(null);
  const pathname = usePathname();
  const panelId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Route changed (a link was tapped, or browser back/forward) → close.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  // While open: lock background scroll, move focus into the panel, and close on Escape
  // or when the viewport grows past `sm` (so the scroll lock can't get stranded once the
  // desktop nav takes over and this control is hidden).
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      // Keep Tab cycling inside the panel — it overlays the page like a modal,
      // so walking out into the dimmed background strands keyboard users.
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        const inside = panelRef.current.contains(active);
        if (e.shiftKey && (active === first || !inside)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !inside)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const mq = window.matchMedia('(min-width: 640px)');
    const onBreakpoint = () => {
      if (mq.matches) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    mq.addEventListener('change', onBreakpoint);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onBreakpoint);
      // Return focus to the hamburger so closing doesn't drop focus to <body>.
      trigger?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);
  const itemBase =
    'block rounded-lg px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-surface-2';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="-mr-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {open ? (
            <>
              <path d="M6 6 18 18" />
              <path d="M18 6 6 18" />
            </>
          ) : (
            <>
              <path d="M3 6h18" />
              <path d="M3 12h18" />
              <path d="M3 18h18" />
            </>
          )}
        </svg>
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="sm:hidden">
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={close}
              className="fixed inset-0 top-14 z-30 bg-black/40"
            />
            <nav
              ref={panelRef}
              id={panelId}
              tabIndex={-1}
              aria-label="Site"
              className="fixed inset-x-0 top-14 z-40 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-line bg-background shadow-xl shadow-black/20 outline-none"
            >
              <ul className="mx-auto w-full max-w-5xl px-2 py-2">
                <li>
                  <Link
                    href="/"
                    onClick={close}
                    aria-current={pathname === '/' ? 'page' : undefined}
                    className={`${itemBase}${pathname === '/' ? ' bg-surface-2' : ''}`}
                  >
                    Home
                  </Link>
                </li>
                {/* The all-sports surfaces — mirrors the desktop header's links. */}
                <li className="border-t border-line/60">
                  <Link
                    href="/board"
                    onClick={close}
                    aria-current={pathname === '/board' ? 'page' : undefined}
                    className={`${itemBase}${pathname === '/board' ? ' bg-surface-2' : ''}`}
                  >
                    Heat Check
                  </Link>
                </li>
                <li className="border-t border-line/60">
                  <Link
                    href="/trends"
                    onClick={close}
                    aria-current={pathname === '/trends' ? 'page' : undefined}
                    className={`${itemBase}${pathname === '/trends' ? ' bg-surface-2' : ''}`}
                  >
                    Trends
                  </Link>
                </li>

                {NAV_SPORT_ORDER.map((s) => {
                  const name = SPORTS[s].name;
                  const isOpen = expanded === s;
                  const hub = `/${s}`;
                  const hubActive = pathname === hub;
                  return (
                    <li key={s} className="border-t border-line/60">
                      <div className="flex items-center">
                        <Link
                          href={hub}
                          onClick={close}
                          aria-current={hubActive ? 'page' : undefined}
                          className={`flex-1 ${itemBase}${hubActive ? ' bg-surface-2' : ''}`}
                        >
                          {name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : s)}
                          aria-expanded={isOpen}
                          aria-controls={isOpen ? `${panelId}-${s}` : undefined}
                          aria-label={`${name} sections`}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 12 12"
                            fill="none"
                            aria-hidden="true"
                            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          >
                            <path
                              d="M3 4.5 6 7.5 9 4.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                      {isOpen && (
                        <ul id={`${panelId}-${s}`} className="pb-1 pl-3">
                          {sportSections(s).map((sec) => {
                            const href = sectionHref(s, sec.seg);
                            const secActive = pathname === href;
                            return (
                              <li key={sec.seg}>
                                <Link
                                  href={href}
                                  onClick={close}
                                  aria-current={secActive ? 'page' : undefined}
                                  className={`block rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-surface-2${
                                    secActive ? ' bg-surface-2' : ''
                                  }`}
                                >
                                  <span className="font-medium text-foreground">{sec.label}</span>
                                  <span className="ml-2 text-xs text-muted">{sec.desc}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}

                <li className="border-t border-line/60">
                  <Link
                    href="/playbook"
                    onClick={close}
                    aria-current={pathname === '/playbook' ? 'page' : undefined}
                    className={`${itemBase}${pathname === '/playbook' ? ' bg-surface-2' : ''}`}
                  >
                    <span aria-hidden="true" className="mr-2 text-brand">
                      ★
                    </span>
                    My Playbook
                  </Link>
                </li>
              </ul>
            </nav>
          </div>,
          document.body,
        )}
    </>
  );
}
