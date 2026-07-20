import { test, expect } from '@playwright/test';

// Smoke tests, SEASON-AGNOSTIC by design: the home page only shows cards for
// sports with games today, and a sport home swaps to an off-season fallback —
// so these assert the stable chrome (hero, CTA, nav) plus an either/or on the
// season-dependent regions, and pass against any database state.

test('home renders the hero and the Heat Check CTA', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/FantasyFire/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/find the heat/i);
  await expect(page.getByRole('link', { name: /open the heat check/i })).toBeVisible();

  // Season-dependent region: at least one sport teaser card, or the no-slate
  // empty state, or the between-slates strip — one of the three always renders.
  await expect(
    page
      .getByRole('link', { name: /open the full .* heat check/i })
      .or(page.getByText(/no games on the slate/i))
      .or(page.getByText(/between slates \/ off-season/i))
      .first(),
  ).toBeVisible();
});

test('a sport home renders its board or the off-season fallback', async ({ page }) => {
  await page.goto('/nba');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(/nba heat check/i);
  // In season: the board's player search. Off-season: the fallback explains and
  // links the browsable sections instead.
  await expect(
    page
      .getByPlaceholder(/search players/i)
      .or(page.getByText(/off-season/i))
      .first(),
  ).toBeVisible();
});
