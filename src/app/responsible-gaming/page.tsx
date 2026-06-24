import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Responsible Gaming',
  description:
    'Bet responsibly. FantasyFire is a research tool, not betting advice. Help and resources for problem gambling.',
  alternates: { canonical: '/responsible-gaming' },
};

export default function ResponsibleGamingPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Home', href: '/' }, { label: 'Responsible gaming' }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">Responsible gaming</h1>

      <Prose>
        <p>
          {SITE.name}{' '}is a research and entertainment tool. The hit rates and matchup
          numbers here describe <strong>past performance</strong> — they are not
          predictions, advice, or a guarantee of any outcome. Nothing on this site is
          betting or financial advice.
        </p>

        <h2>If you choose to bet</h2>
        <ul>
          <li>You must be of legal age — generally <strong>21+</strong> — and bet only where it is legal.</li>
          <li>Set a budget you can afford to lose, and never chase losses.</li>
          <li>Bet for entertainment, not as a way to make money or solve financial problems.</li>
          <li>Take breaks, and don&rsquo;t bet while stressed, upset, or impaired.</li>
        </ul>

        <h2>Get help</h2>
        <p>
          If gambling stops being fun or feels out of control, help is free and
          confidential:
        </p>
        <ul>
          <li>
            <strong>1-800-GAMBLER</strong> (1-800-426-2537) — 24/7 confidential support.
          </li>
          <li>
            National Council on Problem Gambling —{' '}
            <a href="https://www.ncpgambling.org" target="_blank" rel="noopener noreferrer">
              ncpgambling.org
            </a>{' '}
            (call or text 1-800-522-4700, or chat online).
          </li>
          <li>
            Most states and licensed sportsbooks offer <strong>self-exclusion</strong> and
            deposit/time limits — use them.
          </li>
        </ul>

        <p>
          If you or someone you know may have a gambling problem, please reach out to one
          of the resources above.
        </p>
      </Prose>
    </div>
  );
}
