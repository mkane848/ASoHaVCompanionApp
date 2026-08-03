/**
 * Responsive smoke test.
 *
 * Renders every route through harness.html (real components, seed fixtures, no
 * server) at a spread of viewports and asserts the three things that silently
 * regressed before anyone was measuring:
 *
 *   1. no horizontal page overflow, at any width;
 *   2. no interactive element under 44x44 on a touch viewport;
 *   3. no two controls with overlapping hit areas — a bigger target that
 *      overlaps its neighbour is worse than the small one it replaced;
 *   4. no uncaught page errors.
 *
 * Hit area means the ::after overlay where one is used, not the painted box:
 * `.tap` and `.pip` grow the touchable region without resizing the control, so
 * measuring getBoundingClientRect alone would report false failures.
 *
 * Run: npm run test:responsive -w @asohav/web
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import process from 'node:process';

const VIEWPORTS = [
  { name: '360 phone', width: 360, height: 780, touch: true },
  { name: '390 phone', width: 390, height: 844, touch: true },
  { name: '768 tablet portrait', width: 768, height: 1024, touch: true },
  { name: '1024 tablet landscape', width: 1024, height: 768, touch: true },
  { name: '1440 desktop', width: 1440, height: 900, touch: false },
];

const ROUTES = [
  { name: 'home', qs: 'route=/&as=ryan' },
  { name: 'campaign (player)', qs: 'route=/c/cm-1&as=ryan' },
  { name: 'campaign (GM)', qs: 'route=/c/cm-1&as=mike' },
  { name: 'character sheet', qs: 'route=/c/cm-1/sheet&as=ryan' },
  { name: 'content admin', qs: 'route=/admin&as=mike' },
];

const TAP_MIN = 44;
/** Sub-pixel slack: layout rounding can land a 44px box on 43.6. */
const EPS = 0.6;

/** Runs in the page. Mirrors how the browser actually routes a tap. */
function collect({ tapMin, eps }) {
  function hitRect(el) {
    const base = el.getBoundingClientRect();
    const after = getComputedStyle(el, '::after');
    if (after.content === 'none' || !after.width || after.width === 'auto') return base;
    const w = parseFloat(after.width);
    const h = parseFloat(after.height);
    if (!w || !h) return base;
    const cx = base.left + base.width / 2;
    const cy = base.top + base.height / 2;
    const width = Math.max(w, base.width);
    const height = Math.max(h, base.height);
    return { left: cx - width / 2, right: cx + width / 2, top: cy - height / 2, bottom: cy + height / 2, width, height };
  }

  const label = (el) =>
    (el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.tagName)
      .trim()
      .slice(0, 32) || el.tagName;

  const controls = Array.from(document.querySelectorAll('button, a, input, select, textarea')).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });

  const small = [];
  const rects = [];
  for (const el of controls) {
    const r = hitRect(el);
    rects.push({ el, r });
    if (r.height < tapMin - eps || r.width < tapMin - eps) {
      small.push({ label: label(el), w: Math.round(r.width), h: Math.round(r.height) });
    }
  }

  const overlaps = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i].r;
      const b = rects[j].r;
      // 2px of tolerance: shared borders and rounding produce hairline touches
      // that no finger can land in.
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 2 && oy > 2) {
        overlaps.push({ a: label(rects[i].el), b: label(rects[j].el), by: `${Math.round(ox)}x${Math.round(oy)}` });
      }
    }
  }

  const doc = document.documentElement;
  return {
    overflow: doc.scrollWidth > doc.clientWidth + 1 ? { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth } : null,
    small,
    overlaps: overlaps.slice(0, 8),
    overlapCount: overlaps.length,
  };
}

const server = await createServer({
  root: new URL('..', import.meta.url).pathname,
  server: { port: 0 },
  logLevel: 'error',
  // The harness never reaches Supabase, but supabaseClient.ts throws at import
  // time if these are unset, which would blank the page before anything renders.
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:9/stub'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || 'stub-anon-key'),
  },
});
await server.listen();
const base = `http://127.0.0.1:${server.config.server.port}/harness.html`;

/* CI runs `npx playwright install chromium` and lets Playwright find its own
   build. CHROMIUM_PATH is for environments that already ship a Chromium whose
   build number doesn't match the pinned Playwright. */
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const failures = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.touch,
    isMobile: vp.touch,
  });
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    await page.goto(`${base}?${route.qs}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);

    const r = await page.evaluate(collect, { tapMin: TAP_MIN, eps: EPS });
    const where = `${vp.name} / ${route.name}`;

    if (r.overflow) {
      failures.push(`${where}: horizontal overflow — page is ${r.overflow.scrollWidth}px wide in a ${r.overflow.clientWidth}px viewport`);
    }
    // Only asserted for touch: a mouse pointer doesn't need a 44px target, and
    // the design deliberately keeps controls compact on the desktop layout.
    if (vp.touch && r.small.length) {
      failures.push(
        `${where}: ${r.small.length} control(s) under ${TAP_MIN}x${TAP_MIN} — ` +
          r.small.slice(0, 6).map((s) => `${s.label} (${s.w}x${s.h})`).join(', '),
      );
    }
    if (r.overlapCount) {
      failures.push(
        `${where}: ${r.overlapCount} pair(s) of controls with overlapping hit areas — ` +
          r.overlaps.slice(0, 4).map((o) => `${o.a} / ${o.b} by ${o.by}`).join(', '),
      );
    }
    if (errors.length) failures.push(`${where}: page error — ${errors[0]}`);

    const status = r.overflow || (vp.touch && r.small.length) || r.overlapCount || errors.length ? 'FAIL' : 'ok';
    console.log(`  ${status.padEnd(4)} ${where}`);
    await page.close();
  }
  await ctx.close();
}

await browser.close();
await server.close();

if (failures.length) {
  console.error(`\n${failures.length} responsive failure(s):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nAll routes clean at every viewport.');
