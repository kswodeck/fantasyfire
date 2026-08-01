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
  // In season: the board's OWN player filter (by its aria-label — the site-wide
  // header typeahead is on every page and would make a placeholder match vacuous).
  // Off-season: the fallback explains and links the browsable sections instead.
  await expect(
    page
      .getByLabel('Search players by name')
      .or(page.getByText(/off-season/i))
      .first(),
  ).toBeVisible();
});

test('the header search finds a player across leagues and navigates to them', async ({ page }) => {
  await page.goto('/');
  const box = page.getByRole('combobox', { name: /search players across all leagues/i });
  await expect(box).toBeVisible();

  // Data-agnostic: take a real player from a board/list page, then look them up
  // from an unrelated page — the whole point of a site-wide search.
  await page.goto('/mlb/players');
  const cards = page.getByTestId('players-grid').locator('a');
  if ((await cards.count()) === 0) test.skip(true, 'no mlb players in this database');
  const fullName = (await cards.first().innerText()).trim().split('\n')[0];
  const lastName = fullName.split(' ').pop()!;

  await page.goto('/faq');
  await page.getByRole('combobox', { name: /search players across all leagues/i }).fill(lastName);

  const options = page.getByRole('listbox', { name: 'Player results' }).getByRole('option');
  await expect(options.first()).toContainText(new RegExp(lastName, 'i'));

  await options.first().click();
  await expect(page).toHaveURL(/\/(nba|mlb|nfl|nhl|wnba|mls|cfb|cbb)\/[a-z0-9-]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
