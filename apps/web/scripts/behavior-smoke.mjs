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

/**
 * Opens info (`i`) tooltips and glossary-term bubbles spread down the character sheet, and checks
 * each bubble is next to its trigger, inside the viewport, and that the page never scrolls
 * sideways. Then taps empty background and checks the bubble closes. Returns a problem string or
 * null.
 */
async function tooltipProblems(page) {
  await mockApi(page, []);
  const infos = page.locator('button[aria-label^="More about"]');
  await infos.first().waitFor({ timeout: 8000 });
  await sleep(600);
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  const tapAt = (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  const pick = (n) => [...new Set([0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1])].filter((i) => i >= 0);
  const cases = [];
  const ni = await infos.count();
  const terms = page.locator('[role="button"][aria-label^="Definition:"]');
  const nt = await terms.count();
  if (!ni || !nt) return `expected info triggers and glossary terms on the sheet, found ${ni} and ${nt}`;
  for (const i of pick(ni)) cases.push({ loc: infos.nth(i), label: await infos.nth(i).getAttribute('aria-label') });
  for (const i of pick(nt)) cases.push({ loc: terms.nth(i), label: await terms.nth(i).getAttribute('aria-label') });
  // The triggers furthest right are the ones whose bubble can run off the page edge (I-02), and at
  // a given width they are not necessarily among the evenly-spread picks above: add the three
  // rightmost of each kind.
  for (const [group, n] of [[infos, ni], [terms, nt]]) {
    const xs = await group.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right + scrollX));
    const order = xs.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).slice(0, 3);
    for (const [, i] of order) if (i < n) cases.push({ loc: group.nth(i), label: await group.nth(i).getAttribute('aria-label') });
  }
  const bad = [];
  let lastOpened = null;
  for (const c of cases) {
    await c.loc.scrollIntoViewIfNeeded();
    await sleep(80);
    const b = await c.loc.boundingBox();
    await tapAt(b.x + b.width / 2, b.y + b.height / 2);
    await sleep(120);
    const r = await page.evaluate(() => {
      const trig = document.querySelector('[aria-expanded="true"][aria-label^="More about"], [aria-expanded="true"][aria-label^="Definition:"]');
      const bub = trig?.parentElement?.querySelector(':scope > [role="tooltip"]');
      if (!trig || !bub) return { missing: true };
      const t = trig.getBoundingClientRect();
      const q = bub.getBoundingClientRect();
      const de = document.documentElement;
      return { dy: Math.round(q.top - t.bottom), dyAbove: Math.round(t.top - q.bottom), left: Math.round(q.left), right: Math.round(q.right), vw: de.clientWidth, sw: de.scrollWidth };
    });
    if (r.missing) { bad.push(`${c.label}: no bubble opened`); continue; }
    lastOpened = c;
    // Below its trigger (or flipped above), never far from it.
    if (Math.min(Math.abs(r.dy), Math.abs(r.dyAbove)) > 48) bad.push(`${c.label}: bubble ${r.dy}px from its trigger`);
    if (r.left < 0 || r.right > r.vw) bad.push(`${c.label}: bubble spans ${r.left}-${r.right} in a ${r.vw}px viewport`);
    if (r.sw > r.vw) bad.push(`${c.label}: page scrolls sideways (${r.sw} > ${r.vw})`);
    await page.keyboard.press('Escape'); // close it so only one is open at a time
    await sleep(60);
  }
  if (bad.length) return bad.slice(0, 4).join('; ');
  // A tap on empty background must dismiss an open bubble (I-08).
  if (lastOpened) {
    await lastOpened.loc.scrollIntoViewIfNeeded();
    const b = await lastOpened.loc.boundingBox();
    await tapAt(b.x + b.width / 2, b.y + b.height / 2);
    await sleep(120);
    const spot = await page.evaluate(() => {
      for (let y = 4; y < innerHeight; y += 23) {
        for (let x = 4; x < innerWidth; x += 31) {
          const e = document.elementFromPoint(x, y);
          if (e && !e.closest('button, a, input, select, textarea, [role="button"], [role="tooltip"], label')) return { x, y };
        }
      }
      return null;
    });
    if (!spot) return 'found no empty background to tap';
    await tapAt(spot.x, spot.y);
    await sleep(150);
    if (await page.locator('[role="tooltip"]').count()) return 'a tap on empty background left the bubble open';
    // iOS Safari fires pointerdown for a tap on bare background but may never synthesise a
    // mousedown, and Chromium's touch emulation always does, so also send a pointerdown alone.
    await lastOpened.loc.scrollIntoViewIfNeeded();
    const b2 = await lastOpened.loc.boundingBox();
    await tapAt(b2.x + b2.width / 2, b2.y + b2.height / 2);
    await sleep(120);
    if (!(await page.locator('[role="tooltip"]').count())) return 'could not reopen the bubble for the pointerdown check';
    await page.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })));
    await sleep(150);
    if (await page.locator('[role="tooltip"]').count()) return 'a pointerdown on the background (no mousedown) left the bubble open';
  }
  return null;
}

/** Every visible text field on the pages people type into, as computed font sizes. Shared by the
 *  touch and the fine-pointer checks so the route list cannot drift between them. */
async function checkInputSizes(page, env, { requireCoarse }) {
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
  // active and the result would mean nothing: say so rather than report a pass. The fine-pointer
  // variant asserts the opposite, so that it cannot silently run under a coarse pointer.
  if (requireCoarse && !coarse) return { skip: 'this browser does not report (pointer: coarse) under touch emulation, so the 16px rule is not active' };
  if (!requireCoarse && coarse) return 'this run was meant to use a fine pointer but the browser reports (pointer: coarse)';
  if (checked === 0) return 'found no text fields to check';
  if (small.length) return `${small.length} field(s) under 16px (iOS would zoom on focus): ${small.slice(0, 6).join('; ')}`;
  return null;
}

/**
 * iPad chrome (claude/ipad-chrome, review items I-03 and R-20): the app bar was two rows (107-111px)
 * from 600 to 1023 and the character sheet's sticky header three (161px at 768-834) or two (117px
 * at 1024-1194), about 270px of permanent chrome on a 1180px-tall screen. Both must stay one slim
 * row at tablet widths, with nothing scrolling the page sideways. Returns a problem string or null.
 */
async function chromeProblems(page) {
  await mockApi(page, []);
  await page.locator('.app-bar').waitFor({ timeout: 8000 });
  await page.locator('.sheet-nav').waitFor({ timeout: 8000 });
  await sleep(600);
  const r = await page.evaluate(() => {
    const h = (el) => (el ? Math.round(el.getBoundingClientRect().height) : null);
    return {
      bar: h(document.querySelector('.app-bar')),
      header: h(document.querySelector('.sheet-header')?.parentElement),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      vw: innerWidth,
    };
  });
  const bad = [];
  if (r.bar === null || r.bar > 64) bad.push(`app bar is ${r.bar}px tall (budget 64)`);
  if (r.header === null || r.header > 90) bad.push(`sheet sticky header is ${r.header}px tall (budget 90)`);
  if (r.overflow > 0) bad.push(`page scrolls sideways by ${r.overflow}px at ${r.vw}px wide`);
  return bad.length ? bad.join('; ') : null;
}

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
    // back out. layout.css has a rule for it; nothing asserted that it holds for every field, so a
    // new input in a new component could ship under 16px unnoticed.
    name: 'inputs: every text field is at least 16px on a touch screen',
    route: 'route=/c/cm-1&as=mike&clocks=1',
    touchOnly: true,
    async run(page, env) {
      return checkInputSizes(page, env, { requireCoarse: true });
    },
  },
  {
    // iPad review I-07: the 16px rule used to sit behind `(pointer: coarse)`, but an iPad with a
    // Magic Keyboard or mouse can report `pointer: fine`, which would drop every field to 11-13px
    // and make Safari zoom on focus. The rule is now unconditional, so it must hold under a fine
    // pointer too. Its own viewport: 1440 wide with touch off, so (pointer: coarse) is false.
    name: 'inputs: every text field is at least 16px even under a fine pointer',
    route: 'route=/c/cm-1&as=mike&clocks=1',
    viewport: { name: '1440 fine pointer', width: 1440, height: 900, touch: false },
    async run(page, env) {
      return checkInputSizes(page, env, { requireCoarse: false });
    },
  },
  {
    // iPad review I-04: iPadOS Safari zooms on a double tap unless touch-action: manipulation is
    // set, and this app is built on rapid repeated taps (steppers, pips, Clock +1). Chromium does
    // not zoom, so this asserts the declaration rather than the zoom. Pinch-zoom must stay
    // available, so the viewport meta must not lock the scale either.
    name: 'touch: controls are touch-action manipulation and the viewport is not zoom-locked',
    route: 'route=/c/cm-1&as=mike&clocks=1',
    async run(page) {
      await mockApi(page, []);
      await page.getByRole('button', { name: 'New Clock', exact: true }).click();
      await page.locator('#new-clock-title').waitFor({ timeout: 5000 });
      const r = await page.evaluate(() => {
        const out = { bad: [], seen: { button: 0, a: 0, input: 0 }, viewport: document.querySelector('meta[name=viewport]')?.getAttribute('content') ?? '' };
        for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role=button], label, summary')) {
          if (el.offsetParent === null) continue;
          const kind = el.tagName.toLowerCase();
          if (kind in out.seen) out.seen[kind]++;
          const ta = getComputedStyle(el).touchAction;
          if (ta !== 'manipulation') out.bad.push(`${kind}${el.id ? `#${el.id}` : ''} is ${ta}`);
        }
        return out;
      });
      if (!r.seen.button || !r.seen.a || !r.seen.input) return `the page lacked a button, a link and an input to check (${JSON.stringify(r.seen)})`;
      if (r.bad.length) return `${r.bad.length} control(s) without touch-action: manipulation: ${r.bad.slice(0, 5).join('; ')}`;
      if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(r.viewport)) return `the viewport meta disables pinch-zoom: ${r.viewport}`;
      return null;
    },
  },
  {
    // iPad review I-11: at the end of a dialog's or drawer's scroll, a flick scrolled the page
    // behind it. overscroll-behavior: contain stops the chaining.
    name: 'overlays: dialogs and drawers contain their scroll',
    route: 'route=/c/cm-1/sheet&as=ryan',
    async run(page) {
      await mockApi(page, []);
      const dialogBtn = page.getByRole('button', { name: /^Take Strain/ });
      await dialogBtn.waitFor({ timeout: 8000 });
      await dialogBtn.click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ timeout: 5000 });
      const d = await dialog.evaluate((el) => getComputedStyle(el).overscrollBehaviorY);
      if (d !== 'contain') return `the modal dialog has overscroll-behavior-y: ${d}`;
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached', timeout: 3000 }).catch(() => { /* closing is not what is under test */ });
      await page.getByRole('button', { name: /^Moves/ }).first().click();
      const drawer = page.getByRole('dialog').first();
      await drawer.waitFor({ timeout: 5000 });
      const w = await drawer.evaluate((el) => getComputedStyle(el).overscrollBehaviorY);
      if (w !== 'contain') return `the drawer has overscroll-behavior-y: ${w}`;
      return null;
    },
  },
  {
    // iPad review I-12: the x on a tag removed on pointerdown, so a touch that began on it and
    // became a scroll had already deleted the item. Needs CDP touch input, so Chromium only.
    name: 'inline edit: a touch that starts on the remove button and scrolls does not remove the item',
    route: 'route=/c/cm-1/sheet&as=ryan',
    touchOnly: true,
    async run(page) {
      if (TEST_BROWSER !== 'chromium') return { skip: 'drives CDP touch input, which only Chromium offers' };
      await mockApi(page, []);
      const chip = page.getByRole('button', { name: /^Look 1:/ });
      await chip.waitFor({ timeout: 8000 });
      await chip.scrollIntoViewIfNeeded();
      await chip.click();
      const remove = page.getByRole('button', { name: /^Remove Look 1/ });
      await remove.waitFor({ timeout: 3000 });
      await remove.scrollIntoViewIfNeeded();
      const box = await remove.boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const cdp = await page.context().newCDPSession(page);
      const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p[0], y: p[1] })) });
      // A swipe that begins on the remove button.
      await touch('touchStart', [[x, y]]);
      for (let i = 1; i <= 8; i++) { await touch('touchMove', [[x, y - i * 25]]); await sleep(16); }
      await touch('touchEnd', []);
      await sleep(300);
      if (!(await page.getByRole('button', { name: /^Remove Look 1/ }).count())) return 'the item was removed by a touch that started on the remove button and scrolled';
      // Control: a plain tap on the same button must still remove it.
      await sleep(500); // let the fling settle, or the tap would just stop it
      await remove.scrollIntoViewIfNeeded();
      const box2 = await remove.boundingBox();
      await touch('touchStart', [[box2.x + box2.width / 2, box2.y + box2.height / 2]]);
      await touch('touchEnd', []);
      await until('the tap to remove the item', async () => (await page.getByRole('button', { name: /^Remove Look 1/ }).count()) === 0, 3000)
        .catch(() => { throw new Error('a plain tap on the remove button no longer removes the item'); });
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
  {
    // 0.79.2 (iPad review I-01, I-02, I-08): below 600px the bubble was `position: fixed`, but a
    // container-type panel re-bases fixed descendants, so it landed hundreds of px from its
    // trigger; from 600 to 768 an absolute bubble in the right column ran off the page edge and
    // made it scroll sideways; the outside-tap dismiss listened for mousedown.
    name: 'tooltips: bubbles sit by their trigger, inside the screen, and close on a background tap',
    route: 'route=/c/cm-1/sheet&as=ryan',
    async run(page) { return tooltipProblems(page); },
  },
  {
    name: 'tooltips: 678px iPad Split View',
    route: 'route=/c/cm-1/sheet&as=ryan',
    viewport: { name: '678x1024 iPad split view', width: 678, height: 1024, touch: true },
    async run(page) { return tooltipProblems(page); },
  },
  {
    name: 'tooltips: 507px narrow Split View',
    route: 'route=/c/cm-1/sheet&as=ryan',
    viewport: { name: '507x800 narrow split', width: 507, height: 800, touch: true },
    async run(page) { return tooltipProblems(page); },
  },
  {
    name: 'tooltips: 744px iPad mini portrait',
    route: 'route=/c/cm-1/sheet&as=ryan',
    viewport: { name: '744x1133 iPad mini', width: 744, height: 1133, touch: true },
    async run(page) { return tooltipProblems(page); },
  },
  {
    name: 'chrome: app bar and sheet header stay one slim row at 678px',
    route: 'route=/c/cm-1/sheet&as=ryan',
    viewport: { name: '678x1024 chrome', width: 678, height: 1024, touch: true },
    async run(page) { return chromeProblems(page); },
  },
  {
    name: 'chrome: app bar and sheet header stay one slim row at 768px',
    route: 'route=/c/cm-1/sheet&as=ryan',
    viewport: { name: '768x1024 chrome', width: 768, height: 1024, touch: true },
    async run(page) { return chromeProblems(page); },
  },
  {
    name: 'chrome: app bar and sheet header stay one slim row at 820px',
    route: 'route=/c/cm-1/sheet&as=ryan',
    viewport: { name: '820x1180 chrome', width: 820, height: 1180, touch: true },
    async run(page) { return chromeProblems(page); },
  },
  {
    name: 'chrome: app bar and sheet header stay one slim row at 1180px',
    route: 'route=/c/cm-1/sheet&as=ryan',
    viewport: { name: '1180x820 chrome', width: 1180, height: 820, touch: true },
    async run(page) { return chromeProblems(page); },
  },
];

// iPad review I-05, I-09, I-13 (layout): each runs at the three iPad widths that matter (678 Split
// View, 820 portrait, 1180 landscape). Every one also asserts the page does not scroll sideways.
const IPAD = [
  { name: '678x1024 iPad split view', width: 678, height: 1024, touch: true },
  { name: '820x1180 iPad portrait', width: 820, height: 1180, touch: true },
  { name: '1180x820 iPad landscape', width: 1180, height: 820, touch: true },
];
const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
for (const vp of IPAD) {
  const wide = vp.width >= 820;
  TESTS.push({
    // I-05: Virtues sat beside Statuses + Reminders, 700px against 1900px, with a blank half page
    // under Virtues. The left stack (Virtues, Reminders, Growth) and Statuses must now be within
    // 25% of each other. At 678 it stays one column, so only the overflow is asserted.
    name: `layout: the sheet's two columns are balanced (${vp.width}px)`,
    route: 'route=/c/cm-1/sheet&as=ryan',
    viewport: vp,
    async run(page) {
      await mockApi(page, []);
      await page.locator('#p-status').waitFor({ timeout: 8000 });
      await sleep(500);
      const m = await page.evaluate(() => {
        const r = (id) => document.querySelector(id).getBoundingClientRect();
        const left = ['#p-virtues', '#p-reminders', '#p-growth'].map(r);
        const status = r('#p-status');
        const leftH = Math.max(...left.map((b) => b.bottom)) - Math.min(...left.map((b) => b.top));
        return { leftH, rightH: status.height, sideBySide: status.left > left[0].right - 1, sameTop: Math.abs(status.top - left[0].top) < 2 };
      });
      if ((await sideways(page)) > 0) return 'the sheet scrolls sideways';
      if (!wide) return m.sideBySide ? 'the sheet is two columns below 768px' : null;
      if (!m.sideBySide || !m.sameTop) return `Virtues and Statuses are not side by side (${JSON.stringify(m)})`;
      const ratio = Math.max(m.leftH, m.rightH) / Math.min(m.leftH, m.rightH);
      return ratio <= 1.25 ? null : `column heights ${Math.round(m.leftH)} and ${Math.round(m.rightH)} differ by ${Math.round((ratio - 1) * 100)}% (over 25%)`;
    },
  });
  TESTS.push({
    // I-09: the Combat deep link was a 640px ribbon on every screen. From 820 it uses the content
    // width and puts the participant lists beside the turn controls.
    name: `layout: Combat is two panes, wider than 640px (${vp.width}px)`,
    route: 'route=/c/cm-1/combat&as=mike&encounter=1',
    viewport: vp,
    async run(page) {
      await mockApi(page, []);
      await page.getByRole('button', { name: 'Next Round', exact: true }).waitFor({ timeout: 10000 });
      await sleep(400);
      const m = await page.evaluate(() => {
        const h1 = document.querySelector('h1').getBoundingClientRect();
        const party = [...document.querySelectorAll('h3')].find((e) => e.textContent.trim() === 'Party').getBoundingClientRect();
        const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Next Round').getBoundingClientRect();
        return { pageW: h1.width, partyLeft: party.left, controlsRight: btn.right };
      });
      if ((await sideways(page)) > 0) return 'Combat scrolls sideways';
      if (!wide) return m.partyLeft >= m.controlsRight ? 'Combat is two panes below 820px' : null;
      if (m.pageW <= 640) return `Combat content is ${Math.round(m.pageW)}px wide (the old 640px cap)`;
      return m.partyLeft >= m.controlsRight - 1 ? null : `the Party list (left ${Math.round(m.partyLeft)}) is not beside the turn controls (right ${Math.round(m.controlsRight)})`;
    },
  });
  TESTS.push({
    // I-13: Content Admin was one pane below 1024. From 768 a collection shows its list and the
    // open record together.
    name: `layout: Content Admin shows list and record together (${vp.width}px)`,
    route: 'route=/admin/moves/m-defiant&as=mike',
    viewport: vp,
    async run(page) {
      await mockApi(page, []);
      await page.locator('.admin-detail').waitFor({ timeout: 10000 });
      await sleep(400);
      const m = await page.evaluate(() => {
        const v = (sel) => {
          const e = document.querySelector(sel);
          if (!e || e.offsetParent === null) return null;
          const b = e.getBoundingClientRect();
          return b.width ? { left: b.left, right: b.right, w: b.width } : null;
        };
        return { list: v('.admin-list'), detail: v('.admin-detail') };
      });
      if ((await sideways(page)) > 0) return 'Content Admin scrolls sideways';
      if (vp.width < 768) return m.list ? 'Content Admin shows the list and the record together below 768px' : null;
      if (!m.list || !m.detail) return `list and record are not both visible (${JSON.stringify(m)})`;
      if (m.detail.left < m.list.right - 1) return 'the record is not beside the list';
      return m.detail.w >= 400 ? null : `the record pane is only ${Math.round(m.detail.w)}px wide`;
    },
  });
}

// The printable sheet (/c/:id/sheet/print). Print media at US Letter width (816px = 8.5in at 96dpi):
// no app chrome, no toolbar, black ink on white paper whichever appearance is active, nothing wider
// than the page, and every section present. `scripts/print-sheet.mjs` writes real PDFs of the same
// route for a human to look at; this is the part CI can assert.
for (const [label, qs, filled] of [
  ['filled', 'route=/c/cm-1/sheet/print&as=ryan&printdemo=1', true],
  ['blank', 'route=%2Fc%2Fcm-1%2Fsheet%2Fprint%3Fblank%3D1&as=ryan', false],
]) {
  TESTS.push({
    name: `print: the ${label} sheet is paper, not the app, and fits Letter width`,
    route: qs,
    viewport: { name: '816px Letter', width: 816, height: 1056, touch: false },
    async run(page) {
      await mockApi(page, []);
      await page.getByRole('heading', { name: 'Character Sheet' }).waitFor({ timeout: 10000 });
      await page.evaluate(() => document.fonts.ready);
      await page.emulateMedia({ media: 'print' });
      await sleep(200);
      const m = await page.evaluate(() => {
        const shown = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
        const sheet = document.querySelector('h1').closest('div');
        const buttons = [...document.querySelectorAll('button')].filter(shown).map((b) => b.textContent.trim());
        const links = [...document.querySelectorAll('a')].filter(shown).map((a) => a.textContent.trim());
        return {
          appBar: shown(document.querySelector('.app-bar')),
          controls: [...buttons, ...links],
          overflow: document.documentElement.scrollWidth - innerWidth,
          bodyBg: getComputedStyle(document.body).backgroundColor,
          ink: getComputedStyle(sheet).color,
          paper: getComputedStyle(sheet).backgroundColor,
          headings: [...document.querySelectorAll('h2')].map((h) => h.textContent.trim()),
          columns: getComputedStyle(document.querySelector('h2').parentElement.parentElement).columnCount,
        };
      });
      if (m.appBar) return 'the app bar is visible in print';
      if (m.controls.length) return `controls visible in print: ${m.controls.join(', ')}`;
      if (m.overflow > 0) return `the sheet is ${m.overflow}px wider than a Letter page`;
      if (m.bodyBg !== 'rgb(255, 255, 255)' || m.paper !== 'rgb(255, 255, 255)') return `not white paper: body ${m.bodyBg}, sheet ${m.paper}`;
      if (m.ink !== 'rgb(0, 0, 0)') return `ink is ${m.ink}, not black`;
      if (m.columns !== '2') return `expected two columns on paper, got ${m.columns}`;
      for (const h of ['Virtues', 'Strain & Status', 'Reminders', 'Background', 'Load & Item Charges', 'Advancement', 'Connections', 'Party Identity', 'The Moves']) {
        if (!m.headings.includes(h)) return `missing section "${h}" (have ${m.headings.join(' | ')})`;
      }
      const text = await page.locator('body').innerText();
      if (filled && !(text.includes('Ember') && text.includes('Twisted Ankle') && text.includes('Cinderstep'))) return 'the filled sheet lacks the Hero\'s own values';
      if (!filled && text.includes('Ember')) return 'the blank sheet carries a character\'s values';
      return null;
    },
  });
}

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
