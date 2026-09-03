/**
 * Bundle budget — first-load JS bytes.
 *
 * TechStackAudit.md D1/G3/G5. Reads dist/.vite/manifest.json (vite.config.ts's
 * build.manifest), finds the entry chunk (isEntry: true), and transitively sums its own
 * file plus every chunk reachable through imports[] — deliberately excluding
 * dynamicImports[], since those are exactly the bytes NOT paid before first paint
 * (the React.lazy chunks: /admin, /combat, and CreateCharacterPage as of this same pass).
 * Gzips each file with node:zlib to match the gzip figure this repo already cites
 * (README.md judgment call 22: "726.69 kB raw / 211.64 kB gzip", measured at PR #87) — JS
 * only, not CSS, for the same before/after comparability.
 *
 * Ships report-only (always exits 0) until BUDGET_GZIP_BYTES below is set from a real
 * CI-measured number (TechStackAudit.md G5).
 *
 * Run: npm run bundle-budget -w @asohav/web   (after npm run build -w @asohav/web)
 * Visual explorer: npm run build:visualize -w @asohav/web, then open .stats/bundle.html
 */
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(webRoot, 'dist');
const manifestPath = path.join(distDir, '.vite', 'manifest.json');

if (!existsSync(manifestPath)) {
  console.error(`No manifest at ${manifestPath} — run "npm run build -w @asohav/web" first.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
if (!entryKey) {
  console.error('No isEntry:true record in the manifest — is build.manifest still enabled in vite.config.ts?');
  process.exit(1);
}

// Walk imports[] (synchronous, first-load) only — never dynamicImports[] (the React.lazy
// chunks this whole exercise exists to keep OUT of first load).
function collectFirstLoadChunks(key, seen = new Set()) {
  if (seen.has(key)) return seen;
  seen.add(key);
  for (const imp of manifest[key].imports ?? []) collectFirstLoadChunks(imp, seen);
  return seen;
}

const files = [...collectFirstLoadChunks(entryKey)].map((k) => manifest[k].file);

const rows = files.map((file) => {
  const buf = readFileSync(path.join(distDir, file));
  return { file, raw: buf.length, gzip: gzipSync(buf).length };
});
rows.sort((a, b) => b.raw - a.raw);

const rawTotal = rows.reduce((sum, r) => sum + r.raw, 0);
const gzipTotal = rows.reduce((sum, r) => sum + r.gzip, 0);

console.log('First-load JS (entry + synchronous imports; dynamic route chunks excluded):\n');
for (const r of rows) {
  console.log(`  ${r.file.padEnd(40)} ${(r.raw / 1024).toFixed(2).padStart(8)} kB raw  ${(r.gzip / 1024).toFixed(2).padStart(8)} kB gzip`);
}
console.log(`\n  TOTAL${' '.repeat(36)}${(rawTotal / 1024).toFixed(2).padStart(8)} kB raw  ${(gzipTotal / 1024).toFixed(2).padStart(8)} kB gzip`);

// TechStackAudit.md G5: flipped from report-only (null) to enforcing. Ceiling is G4's
// measured post-lazy-load first-load gzip (176.00 kB, read from this same script's own
// output in this sandbox's build) plus ~5% headroom — not a round number, so it's traceable
// back to that measurement rather than picked by feel. Raise it deliberately (with a new
// measurement recorded here) if a legitimate first-load dependency is ever added; a silent
// creep past this line is exactly what D1/G3 exist to catch instead.
//
// Raised for G13 (React Compiler, TechStackAudit.md D10): the compiler inlines a runtime
// memoization helper (the `_c`/cache-slot machinery) into every one of the 88 components it
// compiles, which is real, expected, first-load-JS cost for the feature — not a regression to
// chase down. Measured 197.83 kB gzip post-G13 in this same sandbox; this is that number plus
// the same ~5% headroom policy, not a one-off exception to it.
//
// Raised again for V0.5 slice 7 (Party Playbook & Camp, 0.34.0): `PartyPlaybookPanel` (the
// party's Motif/Quest/Tags/Camp Assets — always-rendered sheet content, same footing as
// Advancement's Rapport/Bonds) is real, necessary first-load weight, not a regression — the four
// guided-flow modals (Camp Actions, Keep Watch, Undertake a Journey, Enjoy Downtime) and the
// shared `PartyAdvanceModal` were all lazy-loaded specifically to keep them OUT of this number,
// the same as the check above already does for Combat/Clocks/CreateCharacterPage. Measured
// 208.74 kB gzip after that lazy-loading pass; this is that number plus the same ~5% headroom
// policy, not a one-off exception to it.
const BUDGET_GZIP_BYTES = 220 * 1024; // 208.74 kB measured (V0.5 slice 7) * 1.05 ~= 219.18 kB

if (BUDGET_GZIP_BYTES !== null && gzipTotal > BUDGET_GZIP_BYTES) {
  console.error(`\nFirst-load JS gzip (${(gzipTotal / 1024).toFixed(2)} kB) exceeds the ${(BUDGET_GZIP_BYTES / 1024).toFixed(2)} kB budget.`);
  process.exit(1);
}
console.log(BUDGET_GZIP_BYTES === null ? '\n(report-only — no budget set yet)' : `\n(within the ${(BUDGET_GZIP_BYTES / 1024).toFixed(2)} kB budget)`);
