/**
 * Renders public/icons/icon.svg to the PNG sizes the PWA manifest needs.
 * Run: pnpm icons (set PW_CHROMIUM_PATH to use a preinstalled Chromium).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const ICON_DIR = join(import.meta.dirname, '..', 'public', 'icons');
const svg = readFileSync(join(ICON_DIR, 'icon.svg'), 'utf8');

const TARGETS: Array<{ file: string; size: number; padding: number }> = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  // Maskable icons need the motif inside the central safe zone (~80%).
  { file: 'icon-maskable-512.png', size: 512, padding: 0.12 },
];

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
});
const page = await browser.newPage();
for (const { file, size, padding } of TARGETS) {
  await page.setViewportSize({ width: size, height: size });
  const inset = Math.round(size * padding);
  await page.setContent(
    `<body style="margin:0;background:#07060d"><div style="padding:${inset}px;width:${size - inset * 2}px;height:${size - inset * 2}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`,
  );
  await page.screenshot({ path: join(ICON_DIR, file), omitBackground: false });
  console.log(`wrote ${file}`);
}
await browser.close();
