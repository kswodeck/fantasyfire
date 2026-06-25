import { redirect, notFound } from 'next/navigation';
import { isSport } from '@/lib/sports';

// /[sport]/leaders has no table of its own — send it to the marquee stat.
export default async function LeadersIndex({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  if (!isSport(sport)) notFound();
  redirect(`/${sport}/leaders/${sport === 'mlb' ? 'hits' : sport === 'nfl' ? 'passYds' : 'pts'}`);
}
