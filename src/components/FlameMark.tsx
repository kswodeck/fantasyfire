// Inline flame logo mark. Pure presentational SVG, no dependencies.
export function FlameMark({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2c.6 3.2-1.3 4.7-2.8 6.2C7.7 9.7 6 11.2 6 14a6 6 0 0 0 12 0c0-2-1-3.7-2.2-5-.5 1-1.3 1.6-2.3 1.7.8-2.2.3-4.6-1.5-6.4-.8-.8-1.4-1.6-1.7-2.3Z"
        fill="currentColor"
      />
    </svg>
  );
}
