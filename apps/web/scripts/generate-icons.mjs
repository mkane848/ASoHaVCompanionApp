/**
 * Generates the PLACEHOLDER Home Screen icons in public/icons/ (ipad-installable).
 *
 * No brand asset exists, so this draws a gold serif "A" on the Notice Board ground (#241c15) with a
 * thin gold ring, via an inline SVG screenshotted in Chromium. Output PNGs are committed; this is a
 * manual tool, not run by CI or the build. Replace public/icons/* with real artwork when there is
 * some (keep the file names and sizes, or update public/manifest.webmanifest and index.html).
 *
 * Run: CHROMIUM_PATH=/path/to/chrome node apps/web/scripts/generate-icons.mjs
 *      (omit CHROMIUM_PATH if Playwright's own Chromium is installed)
 *
 * Colours mirror styles/tokens.css + appearances.css (--ground, --gold) by hand: a plain Node
 * script cannot import CSS. The glyph uses the bundled Cinzel (public/fonts), embedded as a data
 * URI, so the output does not depend on system fonts.
 */
import process from 'node:process';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'icons');
const GROUND = '#241c15';
const GOLD = '#a9863a';
const GOLD_LIGHT = '#d4b565';

const cinzel = (await readFile(path.join(root, 'public', 'fonts', 'cinzel-variable.woff2'))).toString('base64');

/** `safe` scales the glyph: maskable icons must keep their content inside the central 80% circle,
 *  since the platform crops the rest. */
function svg(size, { ring, safe }) {
  const c = size / 2;
  const fontSize = size * safe * 0.78;
  const ringEl = ring
    ? `<circle cx="${c}" cy="${c}" r="${size * 0.42}" fill="none" stroke="${GOLD}" stroke-width="${size * 0.012}" opacity="0.7"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><style>@font-face{font-family:'CinzelI';src:url(data:font/woff2;base64,${cinzel}) format('woff2');font-weight:400 900}</style>
  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD_LIGHT}"/><stop offset="1" stop-color="${GOLD}"/></linearGradient></defs>
  <rect width="${size}" height="${size}" fill="${GROUND}"/>
  ${ringEl}
  <text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central" dy="${size * 0.02}" font-family="CinzelI" font-weight="700" font-size="${fontSize}" fill="url(#g)">A</text>
</svg>`;
}

const targets = [
  { file: 'icon-192.png', size: 192, ring: true, safe: 0.9 },
  { file: 'icon-512.png', size: 512, ring: true, safe: 0.9 },
  // Full-bleed, glyph inside the 80% safe zone, no ring that a circular mask could clip.
  { file: 'icon-maskable-512.png', size: 512, ring: false, safe: 0.7 },
  // iOS rounds the corners itself and fills transparency with black, so this one is opaque.
  { file: 'apple-touch-icon.png', size: 180, ring: true, safe: 0.9 },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><body style="margin:0">${svg(t.size, t)}</body>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, t.file), omitBackground: false });
  await page.close();
  console.log('wrote', t.file);
}
await browser.close();
