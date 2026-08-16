/**
 * Version-sync check.
 *
 * CLAUDE.md's workspace policy is one version, synchronized across all four package.json
 * files (root, @asohav/server, @asohav/web, @asohav/shared) — see CHANGELOG.md's versioning
 * policy. Nothing has ever enforced that: HANDOFF.md records the four-package version bump
 * missing a package-lock.json update as a recurring failure. This checks both halves —
 * the four package.json files agree with each other, and package-lock.json's own recorded
 * workspace versions agree with them — since a stale lockfile is the half a diff review
 * easily misses (the version string only appears in package-lock.json's own workspace
 * entries, not in a dependency range anyone would read).
 *
 * Run: node scripts/check-versions.mjs
 * Wired as the first step of CI's build job (TechStackAudit.md D12) so it fails in seconds,
 * before npm ci pays for a full install.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.dirname(fileURLToPath(import.meta.url)) + '/..';

function readJson(relPath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

const PACKAGE_JSON_FILES = [
  'package.json',
  'apps/server/package.json',
  'apps/web/package.json',
  'packages/shared/package.json',
];

// package-lock.json's `packages` map keys workspace entries by their path relative to the
// repo root (the root workspace itself is the empty-string key) — see lockfileVersion 3's
// format. Order matches PACKAGE_JSON_FILES above so a mismatch reports against the right name.
const LOCKFILE_WORKSPACE_KEYS = ['', 'apps/server', 'apps/web', 'packages/shared'];

const packageJsons = PACKAGE_JSON_FILES.map(readJson);
const versions = packageJsons.map((p) => p.version);
const [expected] = versions;

const mismatches = [];

PACKAGE_JSON_FILES.forEach((file, i) => {
  if (versions[i] !== expected) {
    mismatches.push(`${file}: version "${versions[i]}" does not match ${PACKAGE_JSON_FILES[0]}'s "${expected}"`);
  }
});

const lockfile = readJson('package-lock.json');
LOCKFILE_WORKSPACE_KEYS.forEach((key, i) => {
  const entry = lockfile.packages?.[key];
  const lockVersion = entry?.version;
  if (lockVersion !== expected) {
    mismatches.push(
      `package-lock.json: packages[${JSON.stringify(key)}].version is ${JSON.stringify(lockVersion)}, expected "${expected}" (from ${PACKAGE_JSON_FILES[i]}) — run npm install to refresh the lockfile`,
    );
  }
});

if (mismatches.length > 0) {
  console.error(`Version mismatch across the workspace (expected "${expected}"):\n`);
  for (const m of mismatches) console.error(`  - ${m}`);
  console.error('\nBump every package.json to the same version and run npm install before committing.');
  process.exit(1);
}

console.log(`All four package.json files and package-lock.json agree on version ${expected}.`);
