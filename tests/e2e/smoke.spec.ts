import { test, expect } from '@playwright/test';

// Smoke test: the cross-sport dashboard renders without a database.
test('home dashboard renders the hero and both sport panels', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/FantasyFire/);
  await expect(
    page.getByRole('heading', { name: /honest player-prop research/i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /open nba/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /open mlb/i })).toBeVisible();
});

test('NBA sport home renders the search box', async ({ page }) => {
  await page.goto('/nba');
  await expect(page.getByPlaceholder(/search nba players/i)).toBeVisible();
});
