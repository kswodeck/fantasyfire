'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface MultiSelectOption {
  value: string;
  /** Menu-item text (e.g. the spelled-out stat label). */
  label: ReactNode;
}

/**
 * Compact dropdown multiselect — a labeled button that captions the current
 * selection and opens a checkbox list. The same pattern as the board's "Lines"
 * kind menu, generalized for plain option lists (the props filter). Closes on
 * outside click / Escape. Selection semantics belong to the caller (e.g. empty
 * set = "everything").
 */
export function MultiSelectMenu({
  label,
  caption,
  options,
  isSelected,
  onToggle,
}: {
  /** Small text label rendered before the button (e.g. "Props"). */
  label: string;
  /** Button caption summarizing the selection (e.g. "All props", "H +2"). */
  caption: string;
  options: MultiSelectOption[];
  isSelected: (value: string) => boolean;
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex items-center gap-2 text-xs">
      {label && <span className="text-muted">{label}</span>}
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
      >
        {caption}
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute left-0 top-full z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl shadow-black/40"
        >
          {options.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-surface-2"
            >
              <input
                type="checkbox"
                checked={isSelected(o.value)}
                onChange={() => onToggle(o.value)}
                className="h-3.5 w-3.5 shrink-0 accent-brand"
              />
              <span className="min-w-0 font-medium">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
