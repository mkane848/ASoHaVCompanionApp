/**
 * Generates PDFs of the printable character sheet (`/c/:campaignId/sheet/print`) so the layout can
 * be looked at as paper rather than inferred from a screenshot. NOT part of CI: it writes files and
 * nothing asserts on them (the behaviour smoke's "printable sheet" test is the CI check).
 *
 * Renders the same no-server harness the other scripts use, emulates print media, and writes four
 * PDFs, each the way a browser's print dialog would produce it with its defaults — in particular
 * with "Background graphics" OFF (`printBackground: false`), because the filled boxes and pips must
 * survive that default, which `print-color-adjust: exact` in PrintSheet.module.css is there to do:
 *
 *   filled demo sheet  x  US Letter, A4
 *   blank sheet        x  US Letter, A4
 *
 * Prints each file's page count. Run:  npm run print:sheet -w @asohav/web
 * Output: apps/web/.print/*.pdf (gitignored). To see a page:  pdftoppm -r 70 -png file.pdf out
 *
 * Options (environment):
 *   PRINT_APPEARANCE=noticeboard   which appearance is active on screen (default parchment) — the
 *                                  PDF must come out the same either way
 *   PRINT_MOVES=off|summary|full   the Moves reference after the sheet (default summary)
 */
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHarnessServer, launchBrowser } from './harnessConfig.mjs';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.print');
const appearance = process.env.PRINT_APPEARANCE || 'parchment';
const moves = process.env.PRINT_MOVES || 'summary';
if (!['off', 'summary', 'full'].includes(moves)) throw new Error(`PRINT_MOVES must be off, summary or full, got "${moves}"`);

const VARIANTS = [
  { name: 'filled', qs: 'route=/c/cm-1/sheet/print&as=ryan&printdemo=1' },
  { name: 'blank', qs: 'route=%2Fc%2Fcm-1%2Fsheet%2Fprint%3Fblank%3D1&as=ryan' },
];
const FORMATS = ['Letter', 'A4'];

/** Page count: poppler's pdfinfo when installed, else count the page objects. */
async function pageCount(file) {
  try {
    const out = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
    const m = out.match(/^Pages:\s+(\d+)/m);
    if (m) return Number(m[1]);
  } catch {
    /* fall through to the object count */
  }
  const text = (await readFile(file)).toString('latin1');
  return (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const { base, close } = await startHarnessServer();
const browser = await launchBrowser();
const rows = [];

try {
  for (const variant of VARIANTS) {
    for (const format of FORMATS) {
      // A phone-sized or desktop-sized window must not matter to the PDF: the page width is the paper's.
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${base}?${variant.qs}&appearance=${appearance}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Character Sheet' }).waitFor({ timeout: 15000 });
      await page.evaluate(() => document.fonts.ready);
      // The toolbar button cycles summary, full, off.
      for (let i = 0; i < { summary: 0, full: 1, off: 2 }[moves]; i += 1) await page.getByRole('button', { name: /^Moves:/ }).click();
      await page.emulateMedia({ media: 'print' });
      const file = path.join(outDir, `${variant.name}-${format.toLowerCase()}.pdf`);
      const pdf = await page.pdf({ format, printBackground: false });
      await writeFile(file, pdf);
      rows.push({ file: path.relative(process.cwd(), file), pages: await pageCount(file) });
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  await close();
}

for (const r of rows) console.log(`  ${r.file.padEnd(48)} ${String(r.pages).padStart(2)} page(s)`);
console.log(`\n${rows.length} PDF(s) written to ${path.relative(process.cwd(), outDir)}/ (appearance: ${appearance}, Moves reference: ${moves})`);
