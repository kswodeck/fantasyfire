import { test, expect } from '@playwright/test';

// Phase 0 smoke test: the landing page renders without a database.
// Run with: pnpm exec playwright install && pnpm e2e
test('home page renders the FantasyFire hero', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/FantasyFire/);
  await expect(
    page.getByRole('heading', { name: /honest nba player-prop research/i }),
  ).toBeVisible();
  await expect(page.getByPlaceholder(/search players/i)).toBeVisible();
});
