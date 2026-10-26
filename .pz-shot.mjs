import { chromium } from '@playwright/test';

const out = process.argv[2];
async function walkTo(page, x, y) {
  const held = new Set();
  const set = async (key, on) => {
    if (on && !held.has(key)) {
      held.add(key);
      await page.keyboard.down(key);
    } else if (!on && held.has(key)) {
      held.delete(key);
      await page.keyboard.up(key);
    }
  };
  for (let i = 0; i < 400; i++) {
    const p = await page.evaluate(() => window.__riftbrand?.playerPosition());
    if (!p) break;
    const dx = x - p.x,
      dy = y - p.y;
    if (Math.hypot(dx, dy) < 10) break;
    await set('KeyD', dx > 6);
    await set('KeyA', dx < -6);
    await set('KeyS', dy > 6);
    await set('KeyW', dy < -6);
    await page.waitForTimeout(20);
  }
  for (const key of [...held]) await set(key, false);
}
async function hold(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:4321/');
await p.waitForFunction(() => window.__riftbrand?.ready === true);
const load = async (id) => {
  await p.keyboard.press('Backquote');
  await p.waitForTimeout(150);
  const s = p.getByText('Puzzles', { exact: true });
  if (!(await p.getByRole('button', { name: `Puzzle: ${id}` }).isVisible())) await s.click();
  await p.getByRole('button', { name: `Puzzle: ${id}` }).click();
  await p.keyboard.press('Backquote');
  await p.waitForTimeout(300);
};
await load('four_bowls');
await walkTo(p, 260, 570);
await hold(p, 'KeyW', 60);
await p.keyboard.press('KeyJ');
await p.waitForTimeout(500);
await walkTo(p, 500, 770);
await hold(p, 'KeyW', 60);
await p.keyboard.press('KeyJ');
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/pz2-bowls.png` });
await walkTo(p, 740, 570);
await hold(p, 'KeyW', 60);
await p.keyboard.press('KeyJ');
await p.waitForTimeout(300);
await walkTo(p, 500, 370);
await hold(p, 'KeyW', 60);
await p.keyboard.press('KeyJ');
await p.waitForTimeout(700);
await p.screenshot({ path: `${out}/pz2-bowls-solved.png` });
await load('stone_plates');
await walkTo(p, 372, 700);
await hold(p, 'KeyW', 2600);
await walkTo(p, 560, 628);
await hold(p, 'KeyD', 2200);
await walkTo(p, 500, 330);
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/pz2-plates.png` });
await load('rune_path');
await walkTo(p, 750, 720);
await p.waitForTimeout(200);
await walkTo(p, 750, 640);
await walkTo(p, 750, 720);
await walkTo(p, 640, 760);
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/pz2-hint.png` });
console.log(errors);
await b.close();
