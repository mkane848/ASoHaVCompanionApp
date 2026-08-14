/**
 * Screenshot script (added 0.24.0).
 *
 * The responsive smoke test asserts overflow, touch targets, hit-area overlap,
 * and page errors — none of which catch "wasted space." A 720px ribbon of
 * content on a 2560px monitor passes every one of those checks. This renders
 * every route at every viewport (same harness, same fixtures, same machinery
 * as the smoke test — see harnessConfig.mjs) and writes a PNG per
 * route/viewport, so a layout change can actually be looked at.
 *
 * Needs no network: local Vite dev server, local Chromium, seed fixtures — the
 * same reason the smoke test works from a locked-down sandbox. One caveat:
 * harness.html pulls Cormorant Garamond and Lora from Google Fonts, which a
 * sandboxed proxy typically blocks — screenshots render in fallback serif.
 * Layout and spacing are representative; typography is not.
 *
 * Run: npm run screenshot -w @asohav/web
 * Optional filters (substring match, case-insensitive):
 *   SCREENSHOT_ROUTE=sheet SCREENSHOT_VIEWPORT=2560 npm run screenshot -w @asohav/web
 *
 * Output goes to apps/web/.screenshots/<viewport>/<route>.png — gitignored,
 * regenerated on every run (not a fixture, not a golden-image diff).
 */
import { chromium } from 'playwright';
import process from 'node:process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEWPORTS, ROUTES, startHarnessServer } from './harnessConfig.mjs';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.screenshots');

const routeFilter = (process.env.SCREENSHOT_ROUTE || '').toLowerCase();
const viewportFilter = (process.env.SCREENSHOT_VIEWPORT || '').toLowerCase();
const viewports = VIEWPORTS.filter((v) => !viewportFilter || v.name.toLowerCase().includes(viewportFilter));
const routes = ROUTES.filter((r) => !routeFilter || r.name.toLowerCase().includes(routeFilter));

if (!viewports.length || !routes.length) {
  console.error('No routes/viewports matched the given filter(s).');
  process.exit(1);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const { base, close: closeServer } = await startHarnessServer();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

let count = 0;
for (const vp of viewports) {
  const vpDir = path.join(outDir, slug(vp.name));
  await mkdir(vpDir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.touch,
    isMobile: vp.touch,
  });
  for (const route of routes) {
    const page = await ctx.newPage();
    await page.goto(`${base}?${route.qs}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const file = path.join(vpDir, `${slug(route.name)}.png`);
    await page.screenshot({ path: file, fullPage: true });
    count += 1;
    console.log(`  wrote ${path.relative(process.cwd(), file)}`);
    await page.close();
  }
  await ctx.close();
}

await browser.close();
await closeServer();

console.log(`\n${count} screenshot(s) written to ${path.relative(process.cwd(), outDir)}/`);
