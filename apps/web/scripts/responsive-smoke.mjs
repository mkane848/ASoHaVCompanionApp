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
 * Optional filters (substring match, case-insensitive), for iterating on one risky change
 * without paying for the full 7-viewport x 15-route matrix every time:
 *   SMOKE_ROUTE=sheet SMOKE_VIEWPORT=768 npm run test:responsive -w @asohav/web
 */
import { chromium } from 'playwright';
import process from 'node:process';
import { VIEWPORTS as ALL_VIEWPORTS, ROUTES as ALL_ROUTES, startHarnessServer } from './harnessConfig.mjs';

const routeFilter = (process.env.SMOKE_ROUTE || '').toLowerCase();
const viewportFilter = (process.env.SMOKE_VIEWPORT || '').toLowerCase();
const VIEWPORTS = ALL_VIEWPORTS.filter((v) => !viewportFilter || v.name.toLowerCase().includes(viewportFilter));
const ROUTES = ALL_ROUTES.filter((r) => !routeFilter || r.name.toLowerCase().includes(routeFilter));

// A typo'd SMOKE_ROUTE/SMOKE_VIEWPORT silently matches zero routes/viewports otherwise — every
// assertion below is vacuously true over an empty matrix, so the run would report "All routes
// clean" for a check that never actually rendered a page. screenshot.mjs (same harnessConfig.mjs
// filters) already guards this; port it here rather than let a false green slip through the exact
// narrow-scope workflow these filters exist for.
if (!VIEWPORTS.length || !ROUTES.length) {
  console.error('No routes/viewports matched the given filter(s).');
  process.exit(1);
}

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
  const root = document.getElementById('root');
  return {
    controls: controls.length,
    rootChildren: root ? root.childElementCount : 0,
    rendered: !!root && root.childElementCount > 0 && (root.textContent || '').trim().length > 0,
    overflow: doc.scrollWidth > doc.clientWidth + 1 ? { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth } : null,
    small,
    overlaps: overlaps.slice(0, 8),
    overlapCount: overlaps.length,
  };
}

const { base, close: closeServer } = await startHarnessServer();

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

    /* Guard against a false pass. Every assertion below is satisfied by an empty
       document, so without this the check goes green when the app fails to boot
       — which is exactly what happened when CI ran it without building
       @asohav/shared first. */
    if (!r.rendered || r.controls === 0) {
      failures.push(`${where}: page did not render (${r.controls} controls, ${r.rootChildren} root children) — the app failed to boot`);
    }

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

    const status =
      r.overflow || (vp.touch && r.small.length) || r.overlapCount || errors.length || !r.rendered || r.controls === 0 ? 'FAIL' : 'ok';
    console.log(`  ${status.padEnd(4)} ${where}`);
    await page.close();
  }
  await ctx.close();
}

/* ---------- Bubble positioning (WorkPlan-0.25.0.md section F) ----------
 * A "page at rest" check can't catch this: a definition bubble only exists after a tap, so the
 * main loop above never sees one. Below 600px it's a fixed card positioned from the trigger's own
 * measured rect (useTapReveal.ts) — this opens the rightmost glossary-term link, and separately
 * the rightmost InfoTooltip "i" trigger, on the character sheet at each narrow viewport, and
 * asserts the resulting bubble stays inside the viewport. Scoped to one route and the phone-width
 * viewports rather than the full matrix: this is checking one specific interaction, not sweeping
 * every page again. */
async function checkBubbleFits(page, selector, label, where) {
  const triggers = page.locator(selector);
  const count = await triggers.count();
  if (count === 0) return;
  let rightmost = null;
  let maxRight = -1;
  for (let i = 0; i < count; i++) {
    const box = await triggers.nth(i).boundingBox();
    if (box && box.x + box.width > maxRight) {
      maxRight = box.x + box.width;
      rightmost = triggers.nth(i);
    }
  }
  await rightmost.scrollIntoViewIfNeeded();
  await rightmost.click();
  const box = await page.locator('[role="tooltip"]').first().boundingBox();
  const viewportWidth = page.viewportSize().width;
  const fits = !!box && box.x >= -0.5 && box.x + box.width <= viewportWidth + 0.5;
  if (!fits) {
    failures.push(`${where} [bubble: ${label}]: bubble box ${JSON.stringify(box)} does not fit inside a ${viewportWidth}px viewport`);
  }
  console.log(`  ${(fits ? 'ok' : 'FAIL').padEnd(4)} ${where} [bubble: ${label}]`);
}

const bubbleRoute = ROUTES.find((r) => r.name === 'character sheet');
const narrowViewports = VIEWPORTS.filter((v) => v.width < 600);
if (bubbleRoute && narrowViewports.length) {
  for (const vp of narrowViewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });
    const page = await ctx.newPage();
    await page.goto(`${base}?${bubbleRoute.qs}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const where = `${vp.name} / ${bubbleRoute.name}`;
    await checkBubbleFits(page, '[role="button"][aria-label^="Definition:"]', 'term', where);
    await checkBubbleFits(page, '[aria-label^="More about"]', 'info', where);
    await page.close();
    await ctx.close();
  }
}

await browser.close();
await closeServer();

if (failures.length) {
  console.error(`\n${failures.length} responsive failure(s):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nAll routes clean at every viewport.');
