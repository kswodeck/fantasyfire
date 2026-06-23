import { test, expect } from '@playwright/test';

// Loads a real player page (via the players list, so no slug is hard-coded) and
// asserts the core research UI renders. Requires a seeded database.
test('player page shows hit-rate cards, chart, matchup and read', async ({ page }) => {
  await page.goto('/players');

  // First player card in the results grid.
  const firstPlayer = page.locator('main a[href^="/"]').first();
  await expect(firstPlayer).toBeVisible();
  await firstPlayer.click();

  // Header + interactive controls.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('tab').first()).toBeVisible(); // stat selector chips
  await expect(page.getByLabel('Line', { exact: true })).toBeVisible(); // line input

  // The four hit-rate windows (scoped to the hit-rates region, exact text, so we
  // don't collide with the chart caption or the "...last 10 games..." readout).
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

test('players search filters by name', async ({ page }) => {
  await page.goto('/players?q=jokic');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/jokic/i);
  // A matching card should link to a jokic slug.
  await expect(page.locator('a[href*="jokic" i]').first()).toBeVisible();
});
