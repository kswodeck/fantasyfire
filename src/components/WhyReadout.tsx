/**
 * Plain-language "why" readout (PLAN §1 item 4). The text is generated server-
 * side by buildWhyText() and passed in as a string — this component is purely
 * presentational.
 */
export function WhyReadout({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <h3 className="mb-2 text-sm font-semibold">The read</h3>
      <p className="text-sm leading-relaxed text-muted">{text}</p>
    </div>
  );
}
