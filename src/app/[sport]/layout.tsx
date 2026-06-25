import type { ReactNode } from 'react';
import { SportNav } from '@/components/SportNav';
import { isSport } from '@/lib/sports';

// Renders the per-sport secondary nav above every /[sport]/* page. Reading
// route params (not searchParams) keeps these pages statically rendered.
export default async function SportLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  return (
    <>
      {isSport(sport) && (
        <div className="mx-auto w-full max-w-5xl px-4 pt-4">
          <SportNav sport={sport} />
        </div>
      )}
      {children}
    </>
  );
}
