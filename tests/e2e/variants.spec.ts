import { test, expect, type Page } from '@playwright/test';

// Payout-variant flows: the demon/goblin/alternate chips on board rows, the payout
// filter, and the over-only gating on the player page. All of these depend on the
// seeded DB actually carrying PrizePicks/Underdog variant lines for today's slate,
// so each test skips (rather than fails) when the current data has none.

const DEMON_CHIP = 'button[title^="Demon"]';
const GOBLIN_CHIP = 'button[title^="Goblin"]';
const ALT_CHIP = 'button[title^="Alternate line"]';

/** Open the NBA Heat Check (the sport home) and wait for rows or the empty state. */
async function gotoBoard(page: Page): Promise<void> {
  await page.goto('/nba');
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

test('kind filter defaults to Standard only, adds kinds via the menu, and persists in the URL', async ({ page }) => {
  await gotoBoard(page);
  // The kind multiselect is a dropdown whose button captions the selection
  // ("Standard", "Standard +1", …). Absent = no variants on today's board.
  const linesMenu = page.getByRole('button', { name: /^Standard( \+\d+)?$/ });
  test.skip(!(await linesMenu.isVisible().catch(() => false)), 'no kind filter on today\'s board');

  // Default = Standard only: the menu opens with Standard checked, Goblins not —
  // but the rows' variant chips stay clickable regardless.
  await linesMenu.click();
  const goblinBox = page.getByRole('checkbox', { name: 'Goblins' });
  test.skip(!(await goblinBox.isVisible().catch(() => false)), 'no goblins offered today');
  await expect(page.getByRole('checkbox', { name: 'Standard' })).toBeChecked();
  await expect(goblinBox).not.toBeChecked();
  await expect(page.locator(GOBLIN_CHIP).first()).toBeVisible();

  // Turning Goblins on records the non-default selection in the URL…
  await goblinBox.check();
  await expect(goblinBox).toBeChecked();
  await expect(page).toHaveURL(/kinds=/);

  // …and the selection survives a reload (the URL is the state).
  await page.reload();
  await page.getByRole('button', { name: /^Standard( \+\d+)?$/ }).click();
  await expect(page.getByRole('checkbox', { name: 'Goblins' })).toBeChecked();
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
