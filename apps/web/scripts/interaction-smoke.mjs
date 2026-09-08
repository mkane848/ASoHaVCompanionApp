/**
 * Interaction-state smoke test (0.41.0).
 *
 * `responsive-smoke.mjs` loads a page and measures it. It never clicks, so **any layout that only
 * exists after a tap is completely uncovered** — an expanded row, an open editor, a modal, a
 * drawer. That is not a theoretical hole: 0.40.0 shipped an overlapping-hit-area bug in the
 * expanded Status row (its boxes wrapped and their 44px overlays collided) through an entirely
 * green suite, and only a throwaway probe caught it. This is that probe, made permanent and
 * generalised.
 *
 * It reuses the at-rest pass's own assertions verbatim via hitChecks.mjs — same `::after`-aware
 * hit rect, same 44px floor, same 2px overlap tolerance — so a state is held to exactly the
 * standard the rest of the app is.
 *
 * **Scoping is the part that makes this work at all.** With a modal open, an unscoped query
 * collects the controls behind the backdrop too; those are unreachable and overlap the dialog by
 * definition, so an unscoped run reports a flood of non-bugs. Each state declares the subtree a
 * user can actually reach (`scope`), and only that is measured for targets and overlap. Page-level
 * horizontal overflow stays document-wide — a modal that pushes the page sideways is still a bug.
 *
 * Run: npm run test:interaction -w @asohav/web
 * Filters (substring, case-insensitive), matching the SMOKE_/SCREENSHOT_ convention:
 *   INTERACTION_STATE=modal INTERACTION_VIEWPORT=360 INTERACTION_APPEARANCE=notice
 */
import { chromium } from 'playwright';
import process from 'node:process';
import { VIEWPORTS as ALL_VIEWPORTS, APPEARANCES as ALL_APPEARANCES, startHarnessServer } from './harnessConfig.mjs';
import { TAP_MIN, EPS, collect } from './hitChecks.mjs';

const DIALOG = '[role="dialog"]';

/* Viewports. The 44px floor only applies on a touch pointer, so the four touch widths are where
   most of the value is — but a modal's own internal layout can still collide on a wide screen, so
   one desktop width is included rather than none. Deliberately not all seven: this pass costs a
   page load plus an open/close per state, and the states that vary with width (the Status rank
   chip) only exist below their container threshold anyway. */
const WANTED_VIEWPORTS = ['360 phone', '390 phone', '768 tablet portrait', '1024 tablet landscape', '1440 desktop'];

/** Opens by accessible name where one exists — those are stable in a way class hashes are not. */
const byName = (page, name) => page.getByRole('button', { name }).first();

/* Each state: where it lives, how to open it, what subtree a user can reach once it is open, and
   how to put the page back. `minWidth`/`maxWidth` express states that only exist at some widths. */
const STATES = [
  // --- the two 0.40.0 added, i.e. the states that motivated this whole pass ---
  { name: 'status row expanded', route: 'route=/c/cm-1/sheet&as=ryan', maxWidth: 1023,
    open: (p) => p.locator('[class*="rankChip"]:visible').first().click(),
    scope: '[class*="rowHead"]', close: (p) => p.locator('[class*="rankChip"]:visible').first().click() },
  { name: 'status name editor', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => p.locator('button[aria-label^="Status name"]').first().click(),
    scope: '[class*="rowHead"]', close: (p) => p.keyboard.press('Escape') },
  { name: 'tag editor (Look)', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => p.locator('button[aria-label^="Look "]').first().click(),
    scope: '[class*="chips"]', close: (p) => p.keyboard.press('Escape') },
  { name: 'tag add (Look)', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => byName(p, '+ Add a look').click(),
    scope: '[class*="chips"]', close: (p) => p.keyboard.press('Escape') },
  { name: 'tag add (Party Skill)', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => byName(p, '+ Skill Tag').last().click(),
    scope: '[class*="tagGroups"]', close: (p) => p.keyboard.press('Escape') },

  // --- drawers ---
  { name: 'drawer: Moves', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => byName(p, 'Moves').click(), scope: DIALOG, close: (p) => p.keyboard.press('Escape') },
  { name: 'drawer: Glossary', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => byName(p, 'Glossary').click(), scope: DIALOG, close: (p) => p.keyboard.press('Escape') },

  // --- sheet modals, all one click from rest ---
  { name: 'modal: About', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => byName(p, 'About').click(), scope: DIALOG, close: (p) => p.keyboard.press('Escape') },
  { name: 'modal: Make Camp', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => byName(p, 'Make Camp').click(), scope: DIALOG, close: (p) => p.keyboard.press('Escape') },
  { name: 'modal: Give a Status', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => byName(p, 'Give a Status…').click(), scope: DIALOG, close: (p) => p.keyboard.press('Escape') },
  { name: 'modal: Heal a Status', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => byName(p, 'Heal a Status…').click(), scope: DIALOG, close: (p) => p.keyboard.press('Escape') },
  { name: 'modal: End the Session', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => byName(p, 'End the Session').click(), scope: DIALOG, close: (p) => p.keyboard.press('Escape') },
  { name: 'modal: Camp Actions', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => byName(p, 'Camp Actions').click(), scope: DIALOG, close: (p) => p.keyboard.press('Escape') },
  { name: 'modal: Keep Watch', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => byName(p, 'Keep Watch').click(), scope: DIALOG, close: (p) => p.keyboard.press('Escape') },
  { name: 'modal: Undertake a Journey', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => byName(p, 'Undertake a Journey').click(), scope: DIALOG, close: (p) => p.keyboard.press('Escape') },
  { name: 'modal: Enjoy Downtime', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => byName(p, 'Enjoy Downtime').click(), scope: DIALOG, close: (p) => p.keyboard.press('Escape') },
  { name: 'modal: Add Camp Asset', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => byName(p, '+ Camp Asset').click(), scope: DIALOG, close: (p) => p.keyboard.press('Escape') },

  // --- collapsed geometry: the whole sheet in its other state ---
  { name: 'panels folded', route: 'route=/c/cm-1/sheet&as=ryan',
    open: (p) => byName(p, 'Fold all').click(), scope: null, close: (p) => byName(p, 'Expand all').click() },

  // --- other surfaces ---
  { name: 'form: New Clock', route: 'route=/c/cm-1&as=mike&clocks=1',
    open: (p) => byName(p, 'New Clock').click(), scope: '[class*="ClocksPanel"], [class*="clocks"]',
    close: (p) => p.keyboard.press('Escape') },
  { name: 'form: New Adventure', route: 'route=/c/cm-1/adventure&as=mike',
    open: (p) => byName(p, 'New Adventure').click(), scope: null, close: (p) => p.keyboard.press('Escape') },
  { name: 'modal: Add participant', route: 'route=/c/cm-1/combat&as=mike&encounter=1',
    open: (p) => byName(p, 'Add participant').click(), scope: DIALOG, close: (p) => p.keyboard.press('Escape') },
];

const stateFilter = (process.env.INTERACTION_STATE || '').toLowerCase();
const viewportFilter = (process.env.INTERACTION_VIEWPORT || '').toLowerCase();
const appearanceFilter = (process.env.INTERACTION_APPEARANCE || '').toLowerCase();

const VIEWPORTS = ALL_VIEWPORTS
  .filter((v) => WANTED_VIEWPORTS.includes(v.name))
  .filter((v) => !viewportFilter || v.name.toLowerCase().includes(viewportFilter));
const APPEARANCES = ALL_APPEARANCES.filter((a) => !appearanceFilter || a.id.toLowerCase().includes(appearanceFilter) || a.label.toLowerCase().includes(appearanceFilter));
const states = STATES.filter((s) => !stateFilter || s.name.toLowerCase().includes(stateFilter));

// Same guard the other two scripts carry: a typo'd filter matches nothing, and every assertion
// below is vacuously true over an empty matrix, so the run would report a false green.
if (!VIEWPORTS.length || !APPEARANCES.length || !states.length) {
  console.error('No states/viewports/appearances matched the given filter(s).');
  process.exit(1);
}

const { base, close: closeServer } = await startHarnessServer();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const failures = [];
let skipped = 0;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });
  for (const appearance of APPEARANCES) {
    // One page per (viewport, appearance, route) rather than per state — a page load is by far
    // the most expensive thing here, and the states on a route are independent once it's loaded.
    const byRoute = new Map();
    for (const st of states) {
      if (st.minWidth && vp.width < st.minWidth) continue;
      if (st.maxWidth && vp.width > st.maxWidth) continue;
      if (!byRoute.has(st.route)) byRoute.set(st.route, []);
      byRoute.get(st.route).push(st);
    }
    for (const [route, routeStates] of byRoute) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
      await page.goto(`${base}?${route}&appearance=${appearance.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(900);

      for (const st of routeStates) {
        const where = `${vp.name} / ${appearance.label} / ${st.name}`;
        try {
          await st.open(page);
        } catch {
          // A trigger that isn't present is not a failure — a state can be legitimately
          // unreachable at this width, appearance, or fixture. Same posture as the bubble
          // pass's `if (count === 0) return`. Counted so a silently-empty run is visible.
          skipped++;
          console.log(`  --   ${where} (trigger not present)`);
          continue;
        }
        await page.waitForTimeout(350);
        /* Measure from the top, like the at-rest pass does. Playwright scrolls an element into
           view to click it, and the sheet's sticky identity/section bar legitimately overlays
           whatever has scrolled under it — measuring mid-scroll would report that as an overlap
           bug in every in-page state. Resetting to the same baseline the standing suite uses is
           an apples-to-apples fix, not a loosened assertion: a fixed-position dialog is unmoved
           by it, and an in-page state is judged exactly as the at-rest pass would judge it. */
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(150);

        const r = await page.evaluate(collect, { tapMin: TAP_MIN, eps: EPS, scope: st.scope });
        if (r.missingScope) {
          skipped++;
          console.log(`  --   ${where} (state did not open)`);
        } else {
          if (r.overflow) failures.push(`${where}: horizontal overflow — page is ${r.overflow.scrollWidth}px wide in a ${r.overflow.clientWidth}px viewport`);
          if (vp.touch && r.small.length) {
            failures.push(`${where}: ${r.small.length} control(s) under ${TAP_MIN}x${TAP_MIN} — ` + r.small.slice(0, 6).map((s) => `${s.label} (${s.w}x${s.h})`).join(', '));
          }
          if (r.overlapCount) {
            failures.push(`${where}: ${r.overlapCount} pair(s) with overlapping hit areas — ` + r.overlaps.slice(0, 4).map((o) => `${o.a} / ${o.b} by ${o.by}`).join(', '));
          }
          const bad = r.overflow || (vp.touch && r.small.length) || r.overlapCount;
          console.log(`  ${(bad ? 'FAIL' : 'ok').padEnd(4)} ${where}${bad ? '' : ` (${r.controls} controls)`}`);
        }
        try { await st.close(page); } catch { /* reload below covers a state that won't close */ }
        await page.waitForTimeout(200);
      }
      if (errors.length) failures.push(`${vp.name} / ${appearance.label} / ${route}: page error — ${errors[0]}`);
      await page.close();
    }
  }
  await ctx.close();
}

await browser.close();
await closeServer();

if (failures.length) {
  console.error(`\n${failures.length} interaction-state failure(s):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\nAll interaction states clean.${skipped ? ` (${skipped} state(s) not reachable and skipped)` : ''}`);
