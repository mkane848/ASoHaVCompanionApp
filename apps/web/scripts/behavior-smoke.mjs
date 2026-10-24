/**
 * Behaviour smoke test (0.77.3; WebKit and iPad sizes 0.79.1).
 *
 * `responsive-smoke.mjs` and `interaction-smoke.mjs` measure layout. Neither asserts what a tap
 * *does*, which is how a double-tap that advanced two rounds, a Clock tick that vanished under
 * latency, and a Start Combat that wiped the GM's draft on a refusal all sat behind a fully green
 * suite until the 2026-10-23 UX review found them. This drives the real pages through the same
 * no-server harness, but intercepts the `/api` calls so a test can slow one down, refuse one, and
 * count exactly what was sent.
 *
 * Every test is a regression guard for a defect that was actually shipped and fixed; each says
 * which in its comment. Add a test here when a fix is about what an input *does*, not how it looks.
 *
 * Mocked responses only: the fixtures are in `src/harness.tsx`, and a request nothing mocks
 * answers 404 rather than reaching a server.
 *
 * Run: npm run test:behavior -w @asohav/web   (TEST_BROWSER=webkit for the Safari/iPadOS engine)
 * Filters (substring, case-insensitive), matching the other scripts' convention:
 *   BEHAVIOR_TEST=clock BEHAVIOR_VIEWPORT=390 BEHAVIOR_APPEARANCE=parchment
 */
import process from 'node:process';
import { VIEWPORTS as ALL_VIEWPORTS, APPEARANCES as ALL_APPEARANCES, TEST_BROWSER, startHarnessServer, launchBrowser } from './harnessConfig.mjs';

const testFilter = (process.env.BEHAVIOR_TEST || '').toLowerCase();
const vpFilter = (process.env.BEHAVIOR_VIEWPORT || '').toLowerCase();
const appearanceFilter = (process.env.BEHAVIOR_APPEARANCE || '').toLowerCase();

// One phone and the two iPad orientations, where a double-tap is a real thing, plus a desktop. The
// behaviour does not change with the other widths, and every extra viewport multiplies the run for
// no extra coverage. Under WebKit the desktop is dropped: the point of that run is the engine
// Safari and iPadOS use, on the touch sizes people hold.
const WANTED_VIEWPORTS =
  TEST_BROWSER === 'webkit'
    ? ['390 phone', '820 iPad portrait', '1180 iPad landscape']
    : ['390 phone', '820 iPad portrait', '1180 iPad landscape', '1440 desktop'];
const VIEWPORTS = ALL_VIEWPORTS.filter((v) => WANTED_VIEWPORTS.includes(v.name) && (!vpFilter || v.name.toLowerCase().includes(vpFilter)));
const APPEARANCES = ALL_APPEARANCES.filter((a) => !appearanceFilter || a.id.includes(appearanceFilter) || a.label.toLowerCase().includes(appearanceFilter));

const DELAY_MS = 400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poll until `fn` is truthy; throws with `what` if it never is. */
async function until(what, fn, timeout = 6000) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeout) throw new Error(`timed out waiting for ${what}`);
    await sleep(40);
  }
}

/**
 * Intercepts `/api/**`. `handlers` is a list of `{ method, match, delay?, status?, body }` where
 * `body` is an object or a function of the parsed request body. Returns the log of every request.
 */
async function mockApi(page, handlers) {
  const log = [];
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api/, '');
    let body = null;
    try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch { /* not JSON */ }
    const entry = { method: req.method(), path, body };
    log.push(entry);
    const h = handlers.find((x) => x.method === entry.method && x.match.test(path));
    if (!h) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not mocked' }) });
      return;
    }
    if (h.delay) await sleep(h.delay);
    const payload = typeof h.body === 'function' ? h.body(body, entry) : h.body;
    await route.fulfill({ status: h.status ?? 200, contentType: 'application/json', body: JSON.stringify(payload ?? {}) });
  });
  return log;
}

const clockFrom = (body) => ({ clock: body });

const TESTS = [
  {
    // 0.77.1, R-01: a tick was computed from the prop, which only updated after the server
    // answered, so a second tap inside the round trip sent the same value again and one tick was
    // lost (two taps of +1 left the Clock one higher, not two).
    name: 'clock: two quick +1 taps both count',
    route: 'route=/c/cm-1&as=mike&clocks=1',
    async run(page) {
      const log = await mockApi(page, [{ method: 'PUT', match: /\/clocks\//, delay: DELAY_MS, body: clockFrom }]);
      const plusOne = page.getByRole('button', { name: '+1', exact: true }).first();
      await plusOne.waitFor({ timeout: 8000 });
      await plusOne.click();
      await plusOne.click();
      const puts = await until('two clock saves', () => {
        const p = log.filter((e) => e.method === 'PUT');
        return p.length >= 2 ? p : null;
      });
      await sleep(DELAY_MS + 250); // let the second save answer before the page is torn down
      const [first, second] = puts;
      if (first.path !== second.path) return `the two saves hit different Clocks (${first.path}, ${second.path})`;
      if (second.body.SuccessMarks !== first.body.SuccessMarks + 1) {
        return `second save carried SuccessMarks ${second.body.SuccessMarks} after the first carried ${first.body.SuccessMarks}; expected one more`;
      }
      return null;
    },
  },
  {
    // 0.77.1, R-02: Next Round had no guard, so an accidental double-tap advanced two rounds.
    name: 'combat: a double-tap on Next Round advances one round',
    route: 'route=/c/cm-1/combat&as=mike&encounter=1',
    async run(page) {
      const log = await mockApi(page, [{ method: 'PUT', match: /\/combat\//, delay: DELAY_MS, body: (b) => ({ encounter: b }) }]);
      const label = page.getByText(/^Round \d+$/).first();
      await label.waitFor({ timeout: 8000 });
      const before = Number((await label.textContent()).replace('Round ', ''));
      const next = page.getByRole('button', { name: 'Next Round', exact: true });
      await next.click();
      await next.click({ force: true }).catch(() => { /* a disabled button refuses the tap, which is the point */ });
      await sleep(DELAY_MS * 2 + 400);
      const puts = log.filter((e) => e.method === 'PUT');
      if (puts.length !== 1) return `expected one save, saw ${puts.length}`;
      if (puts[0].body.Round !== before + 1) return `saved Round ${puts[0].body.Round}, expected ${before + 1}`;
      return null;
    },
  },
  {
    // 0.77.1, R-04: Start Combat cleared the GM's goal and checkboxes before the server answered,
    // so a refusal left a blank form and no message (and the rejection was unhandled).
    name: 'combat: a refused Start Combat keeps the draft and says why',
    route: 'route=/c/cm-1/combat&as=mike',
    async run(page) {
      await mockApi(page, [{ method: 'POST', match: /\/combat\/start$/, status: 409, body: { error: 'Combat can only start while the campaign is Playing.' } }]);
      const goal = page.locator('#combat-goal');
      await goal.waitFor({ timeout: 8000 });
      await goal.fill('Hold the bridge');
      await page.getByRole('button', { name: 'Start Combat', exact: true }).click();
      await page.getByRole('alert').first().waitFor({ timeout: 5000 }).catch(() => { throw new Error('no toast appeared after the refusal'); });
      if ((await goal.inputValue()) !== 'Hold the bridge') return 'the Combat Goal was cleared by a refused start';
      return null;
    },
  },
  {
    // 0.77.1, R-03: a failed bootstrap left the page on "Loading…" forever with no way out.
    name: 'campaign: a failed load shows a message and Retry refetches',
    route: 'route=/c/cm-9&as=mike',
    async run(page) {
      const log = await mockApi(page, [{ method: 'GET', match: /\/campaigns\/cm-9$/, status: 500, body: { error: 'boom' } }]);
      const retry = page.getByRole('button', { name: 'Retry', exact: true });
      await retry.waitFor({ timeout: 10000 }).catch(() => { throw new Error('no Retry button after a failed load'); });
      const before = log.filter((e) => e.method === 'GET' && /cm-9/.test(e.path)).length;
      await retry.click();
      await until('a second bootstrap request', () => log.filter((e) => e.method === 'GET' && /cm-9/.test(e.path)).length > before);
      return null;
    },
  },
  {
    // 0.77.1, R-08: a confirmation opened with the destructive button focused, so Enter on open
    // removed the Clock. The safe button must be the one focused.
    name: 'confirm dialog: Cancel is focused when it opens',
    route: 'route=/c/cm-1&as=mike&clocks=1',
    async run(page) {
      await mockApi(page, []);
      const remove = page.getByRole('button', { name: /^Remove / }).first();
      await remove.waitFor({ timeout: 8000 });
      await remove.click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ timeout: 5000 });
      const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
      if (focused !== 'Cancel') return `focus landed on "${focused}", expected "Cancel"`;
      return null;
    },
  },
  {
    // 0.77.2, R-07: a text selection dragged out of a dialog and released over the backdrop
    // closed it and discarded the draft. Only a press that also began on the backdrop closes.
    name: 'dialog: dragging out of it onto the backdrop does not close it',
    route: 'route=/c/cm-1&as=mike&clocks=1',
    desktopOnly: true, // page.mouse drives the pointer path this guards
    async run(page) {
      await mockApi(page, []);
      await page.getByRole('button', { name: /^Remove / }).first().click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ timeout: 5000 });
      const box = await dialog.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + 30);
      await page.mouse.down();
      await page.mouse.move(4, 4, { steps: 6 });
      await page.mouse.up();
      await sleep(250);
      if (!(await dialog.isVisible())) return 'the dialog closed after a drag that began inside it';
      // And a plain press-and-release on the backdrop must still close it.
      await page.mouse.move(4, 4);
      await page.mouse.down();
      await page.mouse.up();
      await sleep(250);
      if (await dialog.isVisible()) return 'a plain click on the backdrop no longer closes the dialog';
      return null;
    },
  },
  {
    // 0.77.1, R-04: Create closed the form before the server answered, so a refusal (or a slow
    // save) left the GM looking at a form that was gone with their title in it and no message.
    name: 'clocks: a refused Create keeps the form and the typed title',
    route: 'route=/c/cm-1&as=mike&clocks=1',
    async run(page) {
      await mockApi(page, [{ method: 'POST', match: /\/clocks$/, status: 409, body: { error: 'This campaign is archived.' } }]);
      await page.getByRole('button', { name: 'New Clock', exact: true }).click();
      const title = page.locator('#new-clock-title');
      await title.fill('Behaviour test');
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await page.getByRole('alert').first().waitFor({ timeout: 5000 }).catch(() => { throw new Error('no toast appeared after the refusal'); });
      if (!(await title.isVisible()) || (await title.inputValue()) !== 'Behaviour test') return 'the New Clock form lost the typed title after a refused Create';
      return null;
    },
  },
  {
    // 0.77.1: a double-tap on Create must send one request. (Passed before the fix too, because the
    // form used to unmount on the first tap; it guards the pending state that replaced that.)
    name: 'clocks: a double-tap on Create sends one request',
    route: 'route=/c/cm-1&as=mike&clocks=1',
    async run(page) {
      const log = await mockApi(page, [
        {
          method: 'POST',
          match: /\/clocks$/,
          delay: DELAY_MS,
          body: (b) => ({
            clock: {
              Id: 'clk-behavior-new', CampaignId: 'cm-1', Title: b.title, Kind: b.kind, Segments: b.segments ?? 4, SuccessMarks: 0, FailureMarks: 0,
              Goal: '', SkillTags: [], Developments: [], PromotedToBoard: false, Status: 'Open', History: [],
              CreatedAt: new Date().toISOString(), UpdatedAt: new Date().toISOString(),
            },
          }),
        },
      ]);
      await page.getByRole('button', { name: 'New Clock', exact: true }).click();
      await page.locator('#new-clock-title').fill('Behaviour test');
      const create = page.getByRole('button', { name: 'Create', exact: true });
      await create.click();
      await create.click({ force: true }).catch(() => { /* disabled while the first is in flight */ });
      await sleep(DELAY_MS * 2);
      const posts = log.filter((e) => e.method === 'POST' && /\/clocks$/.test(e.path));
      if (posts.length !== 1) return `expected one create request, saw ${posts.length}`;
      return null;
    },
  },
  {
    // iOS and iPadOS Safari zoom the page when a text field under 16px is focused, and do not zoom
    // back out. layout.css has a rule for it on a coarse pointer; nothing asserted that it holds
    // for every field, so a new input in a new component could ship under 16px unnoticed.
    name: 'inputs: every text field is at least 16px on a touch screen',
    route: 'route=/c/cm-1&as=mike&clocks=1',
    touchOnly: true,
    async run(page, env) {
      await mockApi(page, []);
      const routes = [
        { qs: 'route=/c/cm-1&as=mike&clocks=1', open: async () => { await page.getByRole('button', { name: 'New Clock', exact: true }).click(); } },
        { qs: 'route=/c/cm-1&as=mike' },
        { qs: 'route=/c/cm-3/create-character&as=dax' },
        { qs: 'route=/c/cm-1/combat&as=mike' },
        { qs: 'route=/c/cm-1/sheet&as=ryan' },
        { qs: 'route=/&as=mike' },
      ];
      const small = [];
      let coarse = null;
      let checked = 0;
      for (let i = 0; i < routes.length; i++) {
        if (i > 0) {
          await page.goto(`${env.base}?${routes[i].qs}&appearance=${env.appearance}`, { waitUntil: 'domcontentloaded' });
          await mockApi(page, []);
        }
        await sleep(1000);
        if (routes[i].open) await routes[i].open().catch(() => { /* a form that is not there is covered by the other routes */ });
        const r = await page.evaluate(() => {
          const sel = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=button]):not([type=submit]):not([type=file]), select, textarea';
          const fields = [...document.querySelectorAll(sel)].filter((el) => el.offsetParent !== null);
          return {
            coarse: window.matchMedia('(pointer: coarse)').matches,
            count: fields.length,
            small: fields
              .map((el) => ({ what: `${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ''}${el.id ? `#${el.id}` : ''}${el.getAttribute('aria-label') ? ` "${el.getAttribute('aria-label')}"` : ''}`, px: parseFloat(getComputedStyle(el).fontSize) }))
              .filter((f) => f.px < 16),
          };
        });
        coarse = r.coarse;
        checked += r.count;
        for (const f of r.small) small.push(`${routes[i].qs.replace('route=', '')}: ${f.what} is ${f.px}px`);
      }
      // If the engine's touch emulation does not report a coarse pointer, the rule under test is not
      // active and the result would mean nothing: say so rather than report a pass.
      if (!coarse) return { skip: 'this browser does not report (pointer: coarse) under touch emulation, so the 16px rule is not active' };
      if (checked === 0) return 'found no text fields to check';
      if (small.length) return `${small.length} field(s) under 16px (iOS would zoom on focus): ${small.slice(0, 6).join('; ')}`;
      return null;
    },
  },
  {
    // A phone held sideways is ~390px tall, and an iPad in Split View or with the keyboard up is
    // not much taller. A dialog taller than the visible area runs off the bottom with its buttons
    // out of reach (R-11 found two that capped at 85vh, which ignores the browser toolbar).
    name: 'dialogs: fit a short landscape screen',
    route: 'route=/c/cm-1/combat&as=mike&encounter=1',
    viewport: { name: '844x390 phone landscape', width: 844, height: 390, touch: true },
    async run(page) {
      await mockApi(page, []);
      const add = page.getByRole('button', { name: 'Add Participant', exact: true });
      await add.waitFor({ timeout: 8000 });
      await add.click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ timeout: 5000 });
      // The Heroes tab is short enough to fit anywhere; the Villains list is the tall one, which is
      // what makes this check able to fail (verified by removing the dialog's height cap).
      await dialog.getByRole('tab', { name: /villain/i }).click().catch(() => { /* fall back to the default tab */ });
      await sleep(300);
      const r = await dialog.evaluate((el) => {
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return { top: b.top, bottom: b.bottom, vh: window.innerHeight, overflowY: cs.overflowY, scrolls: el.scrollHeight > el.clientHeight + 1 };
      });
      if (r.top < -1 || r.bottom > r.vh + 1) return `the dialog spans ${Math.round(r.top)}–${Math.round(r.bottom)}px in a ${r.vh}px-tall screen`;
      if (r.scrolls && !/auto|scroll/.test(r.overflowY)) return 'the dialog is taller than its box but does not scroll';
      return null;
    },
  },
];

const tests = TESTS.filter((t) => !testFilter || t.name.toLowerCase().includes(testFilter));
if (!VIEWPORTS.length || !APPEARANCES.length || !tests.length) {
  console.error('No tests/viewports/appearances matched the given filter(s).');
  process.exit(1);
}

const { base, close: closeServer } = await startHarnessServer();
const browser = await launchBrowser();
const failures = [];
let ran = 0;
let skipped = 0;

async function runOne(vp, appearance, t) {
  const where = `${vp.name} / ${appearance.label} / ${t.name}`;
  // A fresh context per test: the QueryClient is a module singleton seeded at load, and a
  // test that mutates it must not leak into the next.
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
  let problem = null;
  let skip = null;
  try {
    await page.goto(`${base}?${t.route}&appearance=${appearance.id}`, { waitUntil: 'domcontentloaded' });
    const result = await t.run(page, { base, appearance: appearance.id });
    if (result && typeof result === 'object' && 'skip' in result) skip = result.skip;
    else problem = result;
  } catch (e) {
    problem = e instanceof Error ? e.message : String(e);
  }
  // A rejection nothing handled is the failure mode of the silent-failure bugs, so it fails a test.
  const unhandled = errors.find((e) => /unhandled|rejection/i.test(e));
  if (!problem && !skip && unhandled) problem = `page error: ${unhandled}`;
  if (skip) {
    skipped++;
    console.log(`  SKIP ${where} — ${skip}`);
  } else {
    ran++;
    if (problem) failures.push(`${where}: ${problem}`);
    console.log(`  ${(problem ? 'FAIL' : 'ok').padEnd(4)} ${where}${problem ? ` — ${problem}` : ''}`);
  }
  await ctx.close();
}

for (const vp of VIEWPORTS) {
  for (const appearance of APPEARANCES) {
    for (const t of tests) {
      if (t.viewport) continue; // runs once, at its own size, below
      if (t.desktopOnly && vp.touch) continue;
      if (t.touchOnly && !vp.touch) continue;
      await runOne(vp, appearance, t);
    }
  }
}
for (const t of tests.filter((x) => x.viewport)) {
  for (const appearance of APPEARANCES) await runOne(t.viewport, appearance, t);
}

await browser.close();
await closeServer();

if (failures.length) {
  console.error(`\n${failures.length} behaviour failure(s):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\nAll ${ran} behaviour checks passed${skipped ? ` (${skipped} skipped, listed above)` : ''} in ${TEST_BROWSER}.`);
