import { redirect, notFound } from 'next/navigation';
import { isSport } from '@/lib/sports';
import { DEFAULT_LEADERS_STAT } from '@/lib/relatedLinks';

// /[sport]/leaders has no table of its own — send it to the marquee stat.
export default async function LeadersIndex({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  if (!isSport(sport)) notFound();
  redirect(`/${sport}/leaders/${DEFAULT_LEADERS_STAT[sport]}`);
}
