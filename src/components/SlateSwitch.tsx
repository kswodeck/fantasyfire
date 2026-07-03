'use client';

/**
 * One-control "today's slate only" switch (RotoWire-style) — ON filters the board
 * to players with a game on the current slate (the site-wide persisted default),
 * OFF shows every active player. Replaces the old two-button Today / All players
 * toggle: same state, half the space.
 */
export function SlateSwitch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  /** "Today only" for daily sports, "This week only" for NFL. */
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="group inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground"
    >
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          on ? 'bg-brand' : 'bg-line group-hover:bg-line/80'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] ${
            on ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
      {label}
    </button>
  );
}
