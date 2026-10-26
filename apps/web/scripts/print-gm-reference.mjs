/**
 * Generates PDFs of the printable GM Reference (`/c/:campaignId/gm-reference/print`) so the layout
 * can be looked at as paper rather than inferred from a screenshot. NOT part of CI: it writes files
 * and nothing asserts on them (the behaviour smoke's "print: the GM Reference" tests are the CI check).
 *
 * Same harness and PDF settings as print-sheet.mjs (print media, `printBackground: false` as a
 * browser's print dialog defaults to), signed in as the GM persona. Writes two PDFs:
 *
 *   US Letter, A4
 *
 * Prints each file's page count. Run:  npm run print:gm -w @asohav/web
 * Output: apps/web/.print/gm-reference-*.pdf (gitignored). To see a page:
 *   pdftoppm -r 70 -png file.pdf out
 *
 * Options (environment):
 *   PRINT_APPEARANCE=noticeboard   which appearance is active on screen (default parchment) — the
 *                                  PDF must come out the same either way
 */
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHarnessServer, launchBrowser } from './harnessConfig.mjs';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.print');
const appearance = process.env.PRINT_APPEARANCE || 'parchment';
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

await mkdir(outDir, { recursive: true });

const { base, close } = await startHarnessServer();
const browser = await launchBrowser();
const rows = [];

try {
  for (const format of FORMATS) {
    // A phone-sized or desktop-sized window must not matter to the PDF: the page width is the paper's.
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${base}?route=/c/cm-1/gm-reference/print&as=mike&appearance=${appearance}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'GM Reference', level: 1 }).waitFor({ timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print' });
    const file = path.join(outDir, `gm-reference-${format.toLowerCase()}.pdf`);
    // The page's own @page (size: portrait, named `gmref`) carries the margins and the page numbers,
    // so the paper size is the only thing chosen here; `preferCSSPageSize` is deliberately off.
    const pdf = await page.pdf({ format, printBackground: false });
    await writeFile(file, pdf);
    rows.push({ file: path.relative(process.cwd(), file), pages: await pageCount(file) });
    await ctx.close();
  }
} finally {
  await browser.close();
  await close();
}

for (const r of rows) console.log(`  ${r.file.padEnd(48)} ${String(r.pages).padStart(2)} page(s)`);
console.log(`\n${rows.length} PDF(s) written to ${path.relative(process.cwd(), outDir)}/ (appearance: ${appearance})`);
