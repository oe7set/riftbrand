import { expect, type Page, test } from '@playwright/test';

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__riftbrand?.ready === true);
  // Let a few ticks run so the loop is demonstrably alive.
  await page.waitForFunction(() => (window.__riftbrand?.tick() ?? 0) > 10);
}

test('boots without console errors and the player moves with the keyboard', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/?seed=42');
  await waitForGame(page);
  await expect(page.locator('#app canvas')).toBeVisible();

  const start = await page.evaluate(() => window.__riftbrand?.playerPosition());
  const startTick = await page.evaluate(() => window.__riftbrand?.tick() ?? 0);
  await page.keyboard.down('KeyD');
  // Wait for sim time, not wall time: slow CI runners render fewer ticks per second.
  await page.waitForFunction((t) => (window.__riftbrand?.tick() ?? 0) >= t + 30, startTick);
  await page.keyboard.up('KeyD');
  const end = await page.evaluate(() => window.__riftbrand?.playerPosition());

  expect(start).toBeDefined();
  expect(end?.x ?? 0).toBeGreaterThan((start?.x ?? 0) + 50);
  expect(errors).toEqual([]);
});

test('Escape toggles the pause overlay', async ({ page }) => {
  await page.goto('/?seed=1');
  await waitForGame(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.rb-pause')).toBeVisible();
  const tick = await page.evaluate(() => window.__riftbrand?.tick() ?? 0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__riftbrand?.tick() ?? 0)).toBe(tick);
  await page.keyboard.press('Escape');
  await expect(page.locator('.rb-pause')).toBeHidden();
});

test('the first wave spawns enemies and the run stays error-free', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/?seed=7');
  await waitForGame(page);
  // Slow CI runners with software GL need longer than a phone until the first wave spawns.
  await page.waitForFunction(() => (window.__riftbrand?.enemiesAlive() ?? 0) > 0, null, {
    timeout: 30_000,
  });
  expect(await page.evaluate(() => window.__riftbrand?.wave())).toBe(1);
  // Swing a few times; the sword must not throw even without targets in reach.
  for (let i = 0; i < 5; i++) await page.keyboard.press('KeyJ');
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('a run starts from the title via the refuge: map, then a room', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__riftbrand?.ready === true);
  expect(await page.evaluate(() => window.__riftbrand?.mode())).toBe('title');
  await page.getByRole('button', { name: /to the refuge|zur zuflucht/i }).click();
  await expect(page.locator('.rb-hub')).toBeVisible();
  // First visit: Maren, Nix and Sel introduce themselves.
  await expect(page.locator('.rb-speech')).toHaveCount(3);
  await page.getByRole('button', { name: /set out|aufbrechen/i }).click();
  await expect(page.locator('.rb-map')).toBeVisible();
  // The pre-selected start node enters with one click; others need two (mis-tap guard).
  await page.locator('.rb-node.available.selected').click();
  await page.waitForFunction(() => window.__riftbrand?.mode() === 'room');
  await page.waitForFunction(() => (window.__riftbrand?.enemiesAlive() ?? 0) > 0, null, {
    timeout: 15_000,
  });
  // The run is saved on room entry, so a reload offers to continue.
  await page.reload();
  await page.waitForFunction(() => window.__riftbrand?.ready === true);
  await expect(page.getByRole('button', { name: /continue run|run fortsetzen/i })).toBeVisible();
  expect(errors).toEqual([]);
});
