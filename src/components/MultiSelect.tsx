'use client';

import { useEffect, useId, useRef, useState } from 'react';

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Optional count shown to the right of the label. */
  count?: number;
}

/**
 * Compact multi-select dropdown (a button that opens a checkbox list). Controlled.
 * An empty `selected` means "no filter" — callers treat that as show-all, which is
 * why the trigger reads "All …" when nothing is checked. Closes on outside click or
 * Escape. Used for the injuries-page designation filter.
 */
export function MultiSelect({
  options,
  selected,
  onChange,
  label,
  allLabel = 'All',
}: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Accessible name for the trigger, e.g. "Filter by designation". */
  label: string;
  /** Trigger text when nothing is selected, e.g. "All designations". */
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (value: string) =>
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );

  const triggerText =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ??
          `${selected.length} selected`)
        : `${selected.length} selected`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
      >
        <span>{triggerText}</span>
        <svg
          viewBox="0 0 12 12"
          width="10"
          height="10"
          aria-hidden
          className="text-muted"
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {/* role="group" of native checkboxes — listbox/option roles over checkbox
          inputs double-announce and promise arrow-key behavior that isn't there. */}
      {open && (
        <div
          id={listId}
          role="group"
          aria-label={label}
          className="absolute left-0 z-20 mt-1 max-h-72 w-56 overflow-auto rounded-lg border border-line bg-surface p-1 shadow-lg"
        >
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-brand hover:bg-surface-2"
            >
              Clear all
            </button>
          )}
          {options.map((o) => {
            const checked = selected.includes(o.value);
            return (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(o.value)}
                  className="h-3.5 w-3.5 accent-brand"
                />
                <span className="flex-1">{o.label}</span>
                {o.count != null && (
                  <span className="text-xs tabular-nums text-muted">{o.count}</span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
