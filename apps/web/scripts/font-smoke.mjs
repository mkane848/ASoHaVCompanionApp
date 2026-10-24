/**
 * Font smoke test (ipad-installable). Fonts are self-hosted; this guards that it stays that way.
 *
 * For each appearance it loads the harness home page and asserts:
 *   1. no request goes to fonts.googleapis.com or fonts.gstatic.com (any third-party font host
 *      would be a render-blocking cross-origin request again);
 *   2. the display and body faces of that appearance are really loaded from /fonts/ (not just
 *      declared): document.fonts.check() is true for each, and at least one woff2 came back 200
 *      with a font content type;
 *   3. the heading's computed font-family starts with the appearance's display family.
 *
 * Not a layout test (responsive-smoke does that). Not wired into CI; run by hand after touching
 * fonts, appearances.css or the HTML heads.
 *
 * Run: npm run test:fonts -w @asohav/web   (CHROMIUM_PATH=... if needed)
 */
import process from 'node:process';
import { APPEARANCES, startHarnessServer, launchBrowser } from './harnessConfig.mjs';

const EXPECT = {
  parchment: { display: 'Cormorant Garamond', body: 'Lora', displayWeight: 600, bodyWeight: 400 },
  noticeboard: { display: 'Cinzel', body: 'Zilla Slab', displayWeight: 600, bodyWeight: 400 },
};

const { base, close } = await startHarnessServer();
const browser = await launchBrowser();
let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`  FAIL ${msg}`);
};

try {
  for (const appearance of APPEARANCES) {
    const want = EXPECT[appearance.id];
    console.log(`${appearance.label}`);
    const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 } });
    const page = await ctx.newPage();
    const thirdParty = [];
    const fontResponses = [];
    page.on('request', (r) => {
      const host = new URL(r.url()).hostname;
      if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(host)) thirdParty.push(r.url());
    });
    page.on('response', (r) => {
      if (new URL(r.url()).pathname.startsWith('/fonts/')) {
        fontResponses.push({ path: new URL(r.url()).pathname, status: r.status(), type: r.headers()['content-type'] || '' });
      }
    });
    await page.goto(`${base}?route=/&as=ryan&appearance=${appearance.id}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    if (thirdParty.length) fail(`requests to a Google font host: ${thirdParty.join(', ')}`);
    else console.log('  ok   no fonts.googleapis.com / fonts.gstatic.com requests');

    const checks = await page.evaluate(
      ({ want }) => {
        const h = document.querySelector('h1, h2');
        const hFam = h ? getComputedStyle(h).fontFamily : '(no heading)';
        return {
          hFam,
          display: document.fonts.check(`${want.displayWeight} 16px "${want.display}"`),
          body: document.fonts.check(`${want.bodyWeight} 16px "${want.body}"`),
          loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight} ${f.style}`),
        };
      },
      { want },
    );
    if (!checks.display) fail(`document.fonts.check false for ${want.display}`);
    if (!checks.body) fail(`document.fonts.check false for ${want.body}`);
    // check() is also true for a family nobody declared, so require an actually-loaded face too.
    for (const fam of [want.display, want.body]) {
      if (!checks.loaded.some((l) => l.startsWith(`${fam} `))) fail(`no loaded FontFace for ${fam}`);
    }
    if (checks.display && checks.body) console.log(`  ok   document.fonts.check true for ${want.display} and ${want.body}`);
    if (!checks.hFam.replace(/["']/g, '').startsWith(want.display)) fail(`heading font-family is ${checks.hFam}, expected ${want.display} first`);
    else console.log(`  ok   heading font-family: ${checks.hFam}`);
    const bad = fontResponses.filter((f) => f.status !== 200 || !/font\/woff2|application\/(x-)?font-woff2/.test(f.type));
    if (!fontResponses.length) fail('no /fonts/ response observed');
    if (bad.length) fail(`bad font responses: ${JSON.stringify(bad)}`);
    else console.log(`  ok   ${fontResponses.length} /fonts/ response(s), all 200 woff2`);
    console.log(`  loaded faces: ${checks.loaded.join('; ')}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  await close();
}

if (failures) {
  console.error(`\n${failures} font check(s) failed.`);
  process.exit(1);
}
console.log('\nFont smoke passed.');
