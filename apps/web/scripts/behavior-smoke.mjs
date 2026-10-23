/**
 * Behaviour smoke test (0.77.3).
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
 * Run: npm run test:behavior -w @asohav/web
 * Filters (substring, case-insensitive), matching the other scripts' convention:
 *   BEHAVIOR_TEST=clock BEHAVIOR_VIEWPORT=390 BEHAVIOR_APPEARANCE=parchment
 */
import { chromium } from 'playwright';
import process from 'node:process';
import { VIEWPORTS as ALL_VIEWPORTS, APPEARANCES as ALL_APPEARANCES, startHarnessServer } from './harnessConfig.mjs';

const testFilter = (process.env.BEHAVIOR_TEST || '').toLowerCase();
const vpFilter = (process.env.BEHAVIOR_VIEWPORT || '').toLowerCase();
const appearanceFilter = (process.env.BEHAVIOR_APPEARANCE || '').toLowerCase();

// One phone, where a double-tap is a real thing, and one desktop. The behaviour does not change
// with the other widths, and every extra viewport multiplies the run for no extra coverage.
const WANTED_VIEWPORTS = ['390 phone', '1440 desktop'];
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
];

const tests = TESTS.filter((t) => !testFilter || t.name.toLowerCase().includes(testFilter));
if (!VIEWPORTS.length || !APPEARANCES.length || !tests.length) {
  console.error('No tests/viewports/appearances matched the given filter(s).');
  process.exit(1);
}

const { base, close: closeServer } = await startHarnessServer();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const failures = [];
let ran = 0;

for (const vp of VIEWPORTS) {
  for (const appearance of APPEARANCES) {
    for (const t of tests) {
      if (t.desktopOnly && vp.touch) continue;
      const where = `${vp.name} / ${appearance.label} / ${t.name}`;
      // A fresh context per test: the QueryClient is a module singleton seeded at load, and a
      // test that mutates it must not leak into the next.
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
      let problem = null;
      try {
        await page.goto(`${base}?${t.route}&appearance=${appearance.id}`, { waitUntil: 'domcontentloaded' });
        problem = await t.run(page);
      } catch (e) {
        problem = e instanceof Error ? e.message : String(e);
      }
      // A rejection nothing handled is the failure mode of the silent-failure bugs, so it fails a test.
      const unhandled = errors.find((e) => /unhandled|rejection/i.test(e));
      if (!problem && unhandled) problem = `page error: ${unhandled}`;
      ran++;
      if (problem) failures.push(`${where}: ${problem}`);
      console.log(`  ${(problem ? 'FAIL' : 'ok').padEnd(4)} ${where}${problem ? ` — ${problem}` : ''}`);
      await ctx.close();
    }
  }
}

await browser.close();
await closeServer();

if (failures.length) {
  console.error(`\n${failures.length} behaviour failure(s):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\nAll ${ran} behaviour checks passed.`);
