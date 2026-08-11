---
name: release-reliability-checklist
description: >
  Runs the ASoHaVCompanionApp pre-release checklist for a solo maintainer with no second
  reviewer and no branch protection on main — the actual verification commands
  (typecheck/build/test/responsive) plus the documented Render deployment gotchas and the
  version-sync/CHANGELOG/tag policy. Use whenever the user says they're about to deploy,
  cut a release, bump the version, merge to main, or asks "is this ready to ship," "ready
  to deploy," or "am I missing anything before release" — merging to main and deploying
  are effectively the same checkpoint in this project (Render auto-deploys on commit to
  main), so run this once per release rather than twice.
---

# release-reliability-checklist

## Why this exists

`main` has no branch protection requiring CI to pass before merge (CLAUDE.md), and Render
auto-deploys on every commit to `main` (`render.yaml`'s `autoDeployTrigger: commit`) — so
"merged" and "about to be live" are effectively the same moment in this project. There is
no separate release-cut step and no second reviewer to catch a skipped check. Run this
checklist before merging a release-bound change to `main`; treat "about to deploy" and
"about to merge" as the same trigger, not two separate checkpoints.

## Step 1: run the actual verification commands

Run these yourself if you have shell access — don't ask the user to run them and take
their word for it. This mirrors what `.github/workflows/ci.yml` runs as four separate
jobs, and since main has no required-checks gate, this may be the only time these actually
run before the code is live:

```bash
npm run typecheck        # builds @asohav/shared, then typechecks server + web
npm run build             # shared -> server -> web, in that order
npm run test               # vitest: @asohav/shared then @asohav/server
npm run test:responsive -w @asohav/web   # Playwright smoke test
```

If `test:responsive` fails to launch Chromium, that's very likely the sandboxed-CI-like
environment described in CLAUDE.md, not a real regression — retry with
`CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:responsive -w @asohav/web`.

Report the exact failing output, not a paraphrase — same principle as `responsive-device-
qa`. A release checklist that says "tests failed" without the actual failing line isn't
actionable at the moment someone's about to ship.

## Step 2: versioning policy (CHANGELOG.md's "Versioning policy" section)

If this release bumps the version:

- [ ] All four `package.json` files show the **same** version: root, `@asohav/server`,
      `@asohav/web`, `@asohav/shared`. Check them explicitly — don't assume a bump script
      kept them in sync, there isn't one:
      ```bash
      grep -h '"version"' package.json apps/server/package.json apps/web/package.json packages/shared/package.json
      ```
- [ ] `CHANGELOG.md` has a new entry for this version, following the existing format (a
      full UTC timestamp `YYYY-MM-DDTHH:MM:SSZ`, per the policy note as of `0.4.0`).
- [ ] The merge commit will be tagged `vX.Y.Z` matching the bumped version. If this
      checklist runs before the merge, note this as a follow-up rather than skipping it —
      the tag can only be applied after the merge commit exists.
- [ ] The version bump matches the actual change per SemVer as this project applies it
      pre-1.0: PATCH for a fix/config change with no user-visible behavior change, MINOR
      for new functionality or a notable internal architecture change, MAJOR reserved
      until the app is in real use. If unsure which it is, say so rather than guessing —
      getting this wrong doesn't break anything mechanically, but it does make the
      CHANGELOG's history less trustworthy for the next session.

If this release does *not* bump the version (e.g. a docs-only or draft-skill change), say
so explicitly rather than silently skipping the section — a release checklist that goes
quiet on a step looks the same whether it was checked and passed or just forgotten.

## Step 3: Render deployment gotchas (CLAUDE.md's "Deployment" section)

- [ ] `render.yaml` still sets `NPM_CONFIG_PRODUCTION=false`. Without it,
      `NODE_ENV=production` makes `npm ci` skip devDependencies (including `@types/node`),
      which breaks the server's `tsc` build. This is easy to lose in an unrelated
      `render.yaml` edit — check it's still there, don't assume it silently stays correct.
- [ ] If this deploy touches `supabase/migrations/`: confirm the new migration file(s)
      are numbered to sort after every existing one, and — if you have Supabase MCP access
      — that they've actually been applied to the live project, not just committed. A
      migration that's committed but never applied is a silent gap between what the code
      expects and what the database has.
- [ ] If this is a deploy to an **already-seeded production project** (not a fresh one):
      `apps/server/src/seed.ts` seeding eight dev accounts on first boot is expected
      behavior on an empty database, but unexpected — and worth investigating, not
      shrugging off — if it happens again on a project that should already have data. Don't
      let "seeding on boot is documented as normal" default-excuse an unexpected reseed.

## Step 4: check HANDOFF.md for release-blocking open issues

Skim `HANDOFF.md`'s "Open issues" section for anything that reads as blocking for *this*
release specifically — not every open issue is; most are tracked context for future
sessions, not a merge gate. Use judgment: an open issue about an already-shipped feature
this release doesn't touch isn't a blocker. An open issue that directly contradicts what
this release claims to fix, or flags a code path this release's diff touches as unverified,
is worth surfacing before calling the release ready.

## Report shape

```
Verification: typecheck <pass/FAIL>  build <pass/FAIL>  test <pass/FAIL>  responsive <pass/FAIL>
Version sync: <n/a (no bump), or pass/FAIL with the mismatched file>
CHANGELOG entry: <n/a, or pass/FAIL>
Render gotchas: <ok, or the specific flag>
HANDOFF.md: <nothing blocking found, or the specific item and why it's relevant>
```

Don't report "ready to ship" as a bare verdict — report the checklist state and let that
speak for itself, the same way the other finished skills in this repo report specific
findings rather than a pass/fail summary judgment.

## Reference files

- `.github/workflows/ci.yml` — the four CI jobs this mirrors
- `CHANGELOG.md` — versioning policy (top of file) and the entry format to match
- `render.yaml` — the deploy config and its `NPM_CONFIG_PRODUCTION` comment
- `apps/server/src/seed.ts` — first-boot seeding behavior
- `HANDOFF.md` — "Open issues" section
