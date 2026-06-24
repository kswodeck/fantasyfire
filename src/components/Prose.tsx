import type { ReactNode } from 'react';

/**
 * Styled wrapper for long-form content pages (about, legal, etc.). Styles
 * descendant elements with Tailwind so we don't need the typography plugin.
 */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      className={[
        'mt-6 text-sm leading-relaxed text-muted',
        '[&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground',
        '[&_h3]:mt-5 [&_h3]:mb-1 [&_h3]:font-semibold [&_h3]:text-foreground',
        '[&_p]:mt-3',
        '[&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5',
        '[&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5',
        '[&_li]:marker:text-muted',
        '[&_a]:font-medium [&_a]:text-brand [&_a]:underline-offset-2 hover:[&_a]:underline',
        '[&_strong]:text-foreground',
        '[&_hr]:my-6 [&_hr]:border-line',
      ].join(' ')}
    >
      {children}
    </div>
  );
}
