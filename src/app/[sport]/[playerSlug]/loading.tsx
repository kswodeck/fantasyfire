/**
 * Skeleton for on-demand (long-tail) player renders: dynamicParams pages block on
 * the full research read the first time they're built, so stream this shell
 * immediately instead of a blank screen. Layout mirrors the header card + panels.
 */
export default function LoadingPlayer() {
  return (
    <div
      role="status"
      aria-label="Loading player research"
      className="mx-auto w-full max-w-5xl animate-pulse px-4 py-6"
    >
      <div className="h-4 w-48 rounded bg-surface-2" />
      <div className="mt-6 rounded-2xl border border-line bg-surface">
        <div className="flex items-center gap-4 p-5">
          <div className="h-[84px] w-[84px] shrink-0 rounded-full bg-surface-2" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-surface-2" />
            <div className="h-7 w-56 rounded bg-surface-2" />
            <div className="h-4 w-40 rounded bg-surface-2" />
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="h-28 rounded-xl border border-line bg-surface" />
        <div className="h-28 rounded-xl border border-line bg-surface" />
        <div className="h-28 rounded-xl border border-line bg-surface" />
      </div>
      <div className="mt-6 h-64 rounded-xl border border-line bg-surface" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
