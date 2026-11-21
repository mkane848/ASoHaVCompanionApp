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
 *   versions     — HANDOFF's "Version:" line was a release behind package.json.
 *   agent stubs  — each AGENTS.md has a CLAUDE.md that only imports it (added 0.86.3).
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
 * links to pages this repo does not contain. The project-authored skills ARE checked --
 * `AGENTS.md` requires them to stay in sync with the docs they cite.
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

/* ---- 5. a doc that states the app's version states the real one -------------------------- */
/* The recurring defect this exists for: HANDOFF's Current-state "Version:" line is the place a
   release is supposed to update and the one nobody remembers to. On 2026-09-13 it was a release
   behind (as was the old `CLAUDE.md`'s "The app is at X", by two) at the end of a session whose
   whole subject was stale documentation, which is the clearest possible evidence that remembering
   is not a strategy. Three open issues had the same shape that day (19 understated the live library
   by sixteen releases, 14's second half was already done, 17's title advertised a rebuild that had
   shipped): a body kept current while its headline figure quietly rotted.

   `0.86.3` moved the agent instructions to `AGENTS.md` and dropped the version claim from them
   rather than move it: a version number is not an instruction, and it was the one line of that
   file every release had to touch (`docs/decisions.md`, 0.86.3).

   Only this site is checked, and deliberately so. Prose that names a version historically
   ("shipped in 0.44.0", "as of 0.50.0") is correct precisely by NOT tracking the current version,
   so a blunter "every version string must be current" rule would be wrong far more often than
   right. */
const pkgVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
const VERSION_CLAIMS = [
  ['HANDOFF.md', /^- \*\*Version:\*\* `([0-9]+\.[0-9]+\.[0-9]+)`/m, 'Current state\'s "Version:" line'],
];
for (const [file, re, label] of VERSION_CLAIMS) {
  if (!existsSync(file)) continue;
  const m = readFileSync(file, 'utf8').match(re);
  if (!m) {
    fail(file, `${label} is missing — it is a checked claim, so removing it hides a staleness check`);
  } else if (m[1] !== pkgVersion) {
    fail(file, `${label} says ${m[1]}, but package.json is ${pkgVersion}`);
  }
}

/* ---- 6. every AGENTS.md has a CLAUDE.md import stub beside it, and vice versa -------------- */
/* `AGENTS.md` (root and nested) is the one source of agent instructions. Claude Code reads
   `CLAUDE.md`, not `AGENTS.md`, so each directory with one also carries a `CLAUDE.md` whose whole
   content is the `@AGENTS.md` import. Factory's guidance is not to duplicate rules across
   compatible filenames, so a stub that grows its own rules, or an `AGENTS.md` without a stub
   (invisible to Claude Code), is the drift this catches. Vendored skills ship their own AGENTS.md
   and are not ours. */
const STUB = '@AGENTS.md';
for (const file of allMd) {
  if (isForeign(file) || file.startsWith('.agents/')) continue;
  const base = file.split('/').pop();
  const dir = dirname(file);
  if (base === 'AGENTS.md') {
    const stub = join(dir, 'CLAUDE.md');
    if (!existsSync(stub)) fail(file, `has no sibling CLAUDE.md stub (\`${STUB}\`), so Claude Code never loads it`);
  } else if (base === 'CLAUDE.md') {
    if (readFileSync(file, 'utf8').trim() !== STUB) {
      fail(file, `must contain only \`${STUB}\` — put the rules in AGENTS.md, not a second copy here`);
    }
    if (!existsSync(join(dir, 'AGENTS.md'))) fail(file, 'imports an AGENTS.md that does not exist beside it');
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
