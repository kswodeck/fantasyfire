'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Editable prop-line input. Debounces commits (~400ms) so live API lookups don't
 * fire on every keystroke. Re-syncs to `value` from outside (e.g. when switching
 * stats resets the default line) unless the field is focused.
 */
export function LineInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (line: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function handleChange(v: string) {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const n = Number.parseFloat(v);
      if (Number.isFinite(n) && n >= 0) onCommit(n);
    }, 400);
  }

  function step(delta: number) {
    const n = Number.parseFloat(text);
    const next = Math.max(0, (Number.isFinite(n) ? n : value) + delta);
    setText(String(next));
    onCommit(next);
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label="Decrease line"
        onClick={() => step(-0.5)}
        className="h-8 w-8 rounded-md border border-line bg-surface text-muted hover:text-foreground"
      >
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        step="0.5"
        min="0"
        value={text}
        aria-label="Line"
        onFocus={() => (focused.current = true)}
        onBlur={() => (focused.current = false)}
        onChange={(e) => handleChange(e.target.value)}
        className="w-20 rounded-md border border-line bg-surface px-2 py-1 text-center text-sm tabular-nums outline-none focus:border-brand"
      />
      <button
        type="button"
        aria-label="Increase line"
        onClick={() => step(0.5)}
        className="h-8 w-8 rounded-md border border-line bg-surface text-muted hover:text-foreground"
      >
        +
      </button>
    </div>
  );
}
