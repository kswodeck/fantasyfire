import { test, expect, type Page } from '@playwright/test';

// Player-page research UI, driven through the players list so no slug is
// hard-coded. Uses the players-grid testid — an href-based locator here matches
// the SportNav section links (Trends/Injuries/…/Accuracy) before any player
// card. Skips (rather than fails) when a sport has no players in the current
// database, so the suite is honest against any seed or season.

/** Open /{sport}/players and click the first player card; skip if none exist. */
async function openFirstPlayer(page: Page, sport: string): Promise<void> {
  await page.goto(`/${sport}/players`);
  const cards = page.getByTestId('players-grid').locator('a');
  if ((await cards.count()) === 0) {
    test.skip(true, `no ${sport} players in this database`);
  }
  await cards.first().click();
}

test('player page shows hit-rate cards, chart, matchup and read', async ({ page }) => {
  await openFirstPlayer(page, 'mlb');

  // Breadcrumb back-link to the players page.
  const crumb = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumb.getByRole('link', { name: 'Players' })).toHaveAttribute(
    'href',
    '/mlb/players',
  );

  // Header + interactive controls. The stat chips are a role="group" of toggle
  // buttons by design (see StatSelector) — not a tablist.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const statChips = page.getByRole('group', { name: 'Choose stat' });
  await expect(statChips.getByRole('button').first()).toBeVisible();
  await expect(page.getByLabel('Line', { exact: true })).toBeVisible(); // line input

  // The four hit-rate windows.
  const hitRates = page.getByRole('region', { name: 'Hit rates' });
  await expect(hitRates.getByText('Last 5', { exact: true })).toBeVisible();
  await expect(hitRates.getByText('Last 10', { exact: true })).toBeVisible();
  await expect(hitRates.getByText('Last 20', { exact: true })).toBeVisible();
  await expect(hitRates.getByText('Season', { exact: true })).toBeVisible();

  // At least one confidence badge.
  await expect(page.getByText(/confidence/i).first()).toBeVisible();

  // The game-by-game chart (SVG), the auto "read", and the fair-price tool.
  await expect(page.locator('svg').first()).toBeVisible();
  await expect(page.getByText('The read')).toBeVisible();
  await expect(page.getByText('Fair-price calculator')).toBeVisible();
});

test('players search filters the grid by name', async ({ page }) => {
  await page.goto('/mlb/players');
  const cards = page.getByTestId('players-grid').locator('a');
  if ((await cards.count()) === 0) test.skip(true, 'no mlb players in this database');

  // Search for the LAST NAME of the first listed player — data-agnostic.
  const name = (await cards.first().innerText()).trim().split('\n')[0];
  const lastName = name.split(' ').pop()!;
  await page.getByLabel(/search .*players/i).fill(lastName);

  await expect(cards.first()).toContainText(new RegExp(lastName, 'i'));
});

test('a basketball player page renders basketball stat chips', async ({ page }) => {
  await openFirstPlayer(page, 'wnba');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const hitRates = page.getByRole('region', { name: 'Hit rates' });
  await expect(hitRates.getByText('Season', { exact: true })).toBeVisible();
  // Basketball stat chips — the accessible name is the FULL stat label
  // (aria-label="Points"); the visible chip text is the short "PTS".
  await expect(
    page
      .getByRole('group', { name: 'Choose stat' })
      .getByRole('button', { name: 'Points', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Fair-price calculator')).toBeVisible();
});
