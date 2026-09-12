#!/usr/bin/env node
/**
 * Documentation integrity checks.
 *
 * The normal CI gate (typecheck/test/lint/responsive) is close to a no-op for a documentation
 * change, so these are the checks that actually guard `docs/`. Each one exists because the
 * corresponding mistake has already shipped in this repo at least once:
 *
 *   links        — `0.52.0` moved 12 files and split three more; a relative link that resolves
 *                  from the old location and not the new one fails silently forever.
 *   anchors      — README's two section anchors were cited 46 times before they moved.
 *   symbols      — README's decision record cited eight functions that exist nowhere in the
 *                  codebase; a paragraph-level scan found them, `grep` alone did not.
 *   citations    — HANDOFF's open-issue list was cited at 18, 19 and 20 while stopping at 17.
 *
 * Run: node scripts/check-docs.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const ROOT = process.cwd();
const failures = [];
const fail = (file, msg) => failures.push(`${file}: ${msg}`);

/** Files this project deliberately never edits: shipped history. Checked for nothing. */
const FROZEN = [/^CHANGELOG\.md$/, /^docs\/history\//, /^docs\/archive\//, /^Planning Docs\//];
const isFrozen = (p) => FROZEN.some((re) => re.test(p));

/**
 * Not ours to fix. `.claude/skills/` is symlinks onto `.agents/skills/`, so walking both would
 * double-report; and the five vendored skills carry their own external conventions and ship with
 * links to pages this repo does not contain. The four project-authored skills ARE checked --
 * `CLAUDE.md` requires them to stay in sync with the docs they cite.
 */
const VENDORED = ['supabase', 'supabase-postgres-best-practices', 'vercel-composition-patterns',
                  'vercel-react-best-practices', 'web-design-guidelines'];
const isForeign = (p) =>
  p.startsWith('.claude/skills/') ||
  VENDORED.some((v) => p.startsWith(`.agents/skills/${v}/`));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.md')) out.push(relative(ROOT, p));
  }
  return out;
}

const allMd = walk(ROOT);
const live = allMd.filter((p) => !isFrozen(p) && !isForeign(p));

/* ---- 1. every relative markdown link resolves ------------------------------------------- */
const LINK = /\[[^\]]*\]\(([^)]+)\)/g;
for (const file of live) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(LINK)) {
    const href = m[1].trim();
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    const [path] = href.split('#');
    if (!path) continue;
    const target = resolve(dirname(join(ROOT, file)), path);
    if (!existsSync(target)) fail(file, `dead link -> ${href}`);
  }
}

/* ---- 2. no live doc cites a section anchor that no longer exists -------------------------- */
const DEAD_ANCHORS = ['README.md#architecture-notes--judgment-calls', 'README.md#whats-not-built'];
for (const file of live) {
  const text = readFileSync(file, 'utf8').replace(/\s+/g, ' ');
  for (const a of DEAD_ANCHORS) {
    if (text.includes(a)) fail(file, `cites a section that moved in 0.52.0 -> ${a}`);
  }
}

/* ---- 3. no unmarked dead symbol in the decision record ----------------------------------- */
/* A symbol is "marked" if its own paragraph says it was retired, renamed or replaced — the
   decision record is historical by design, so the fix for a dead symbol is a marker, not a
   rewrite. Paragraph-level, because a `grep` for the marker file-wide always passes. */
const SRC_DIRS = ['packages/shared/src', 'apps/server/src', 'apps/web/src'];
let sourceText = '';
(function collect(dirs) {
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) collect([p]);
      else if (/\.(ts|tsx)$/.test(name)) sourceText += readFileSync(p, 'utf8');
    }
  }
})(SRC_DIRS);

const MARKER = /\b(retired|removed|deleted|renamed|replaced|no longer exists|gone|superseded)\b/i;
const decisionsFile = 'docs/decisions.md';
if (existsSync(decisionsFile)) {
  const paras = readFileSync(decisionsFile, 'utf8').split(/\n\s*\n/);
  for (const para of paras) {
    for (const m of para.matchAll(/`([a-z][A-Za-z0-9_]{3,})\(\)`/g)) {
      const sym = m[1];
      if (sourceText.includes(sym)) continue;
      if (MARKER.test(para)) continue;
      fail(decisionsFile, `cites \`${sym}()\`, which exists nowhere in src/, with no retirement marker in its paragraph`);
    }
  }
}

/* ---- 4. no dangling numbered citation into HANDOFF's open-issue list ---------------------- */
const handoff = readFileSync('HANDOFF.md', 'utf8');
const issueNums = new Set([...handoff.matchAll(/^### (\d+)\./gm)].map((m) => Number(m[1])));
const maxIssue = Math.max(...issueNums);
for (const file of [...live, 'CHANGELOG.md'].filter((f) => existsSync(f))) {
  const text = readFileSync(file, 'utf8').replace(/\s+/g, ' ');
  for (const m of text.matchAll(/(?:HANDOFF(?:\.md)?(?:'s)?[^.]{0,40}?)\bopen issue (\d+)/gi)) {
    const n = Number(m[1]);
    if (!issueNums.has(n)) {
      fail(file, `cites HANDOFF open issue ${n}, which does not exist (list runs 1-${maxIssue})`);
    }
  }
}

/* ---- report ------------------------------------------------------------------------------ */
if (failures.length) {
  console.error(`\ncheck-docs: ${failures.length} problem(s)\n`);
  for (const f of failures) console.error('  ' + f);
  console.error('');
  process.exit(1);
}
console.log(`check-docs: OK — ${live.length} live markdown files, ${allMd.length - live.length} frozen (history/changelog) skipped.`);
