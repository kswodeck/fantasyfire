import { test, expect, type Page } from '@playwright/test';

// Payout-variant flows: the demon/goblin/alternate chips on board rows, the payout
// filter, and the over-only gating on the player page. All of these depend on the
// seeded DB actually carrying PrizePicks/Underdog variant lines for today's slate,
// so each test skips (rather than fails) when the current data has none.

const DEMON_CHIP = 'button[title^="Demon"]';
const GOBLIN_CHIP = 'button[title^="Goblin"]';
const ALT_CHIP = 'button[title^="Alternate line"]';

/** Open the NBA Heat Check and wait for either rows or the empty state. */
async function gotoBoard(page: Page): Promise<void> {
  await page.goto('/nba/board');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test('demon/goblin chip cycles its ladder and funnels back to the standard line', async ({ page }) => {
  await gotoBoard(page);
  const chip = page.locator(`${DEMON_CHIP}, ${GOBLIN_CHIP}`).first();
  test.skip(!(await chip.isVisible().catch(() => false)), 'no demon/goblin variants on today\'s board');

  // Standard is the no-chip-highlighted state.
  await expect(chip).toHaveAttribute('aria-pressed', 'false');

  // First click funnels through the variant…
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  // …and repeated clicks walk the ladder, then return to the standard line
  // (aria-pressed drops back to false). Bounded so a data oddity can't loop forever.
  let returned = false;
  for (let i = 0; i < 8; i++) {
    await chip.click();
    if ((await chip.getAttribute('aria-pressed')) === 'false') {
      returned = true;
      break;
    }
  }
  expect(returned, 'cycling an active chip should funnel back to the standard line').toBe(true);
});

test('kind filter defaults to Standard only, adds kinds on click, and persists in the URL', async ({ page }) => {
  await gotoBoard(page);
  const goblinFilter = page.getByRole('button', { name: 'Goblins' });
  test.skip(!(await goblinFilter.isVisible().catch(() => false)), 'no kind filter on today\'s board');

  // Default = Standard only: the standard chip is on, the variant kinds are off,
  // but the rows' variant chips stay clickable regardless.
  await expect(page.getByRole('button', { name: 'Standard' })).toHaveAttribute('aria-pressed', 'true');
  await expect(goblinFilter).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator(GOBLIN_CHIP).first()).toBeVisible();

  // Turning Goblins on records the non-default selection in the URL…
  await goblinFilter.click();
  await expect(goblinFilter).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/kinds=/);

  // …and the selection survives a reload (the URL is the state).
  await page.reload();
  await expect(page.getByRole('button', { name: 'Goblins' })).toHaveAttribute('aria-pressed', 'true');
});

test('a variant line is over-only on the player page (no under odds input)', async ({ page }) => {
  await gotoBoard(page);
  const chip = page.locator(`${DEMON_CHIP}, ${GOBLIN_CHIP}, ${ALT_CHIP}`).first();
  test.skip(!(await chip.isVisible().catch(() => false)), 'no variants on today\'s board');

  // Funnel the row through its variant, then open the player page at that rung.
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  const row = page.locator('li', { has: chip });
  await row.locator('a[href*="line="]').first().click();

  // The player page opens at the variant line: the fair-price tool takes no under.
  await expect(page.getByText('Fair-price calculator')).toBeVisible();
  await expect(page.getByText(/doesn.t take an under/i)).toBeVisible();
  await expect(page.getByLabel('Under odds')).toHaveCount(0);

  // Swapping back to a standard rung in the ladder restores the under input.
  const ladder = page.getByText('payout options');
  if (await ladder.isVisible().catch(() => false)) {
    const standardRung = page.getByRole('button', { name: /standard/ }).first();
    if (await standardRung.isVisible().catch(() => false)) {
      await standardRung.click();
      await expect(page.getByLabel('Under odds')).toBeVisible();
    }
  }
});
