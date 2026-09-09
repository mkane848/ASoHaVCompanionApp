---
name: release-reliability-checklist
description: >
  Runs the ASoHaVCompanionApp release checklist for a solo maintainer with no second
  reviewer — the actual verification commands
  (typecheck/build/test/responsive), the documented Render deployment gotchas, the
  version-sync/CHANGELOG/tag policy, and the post-merge confirmation that the deploy
  reached `live` AND that any new supabase/migrations/ file was actually applied to the
  live project (Render never runs migrations — this has caused three real incidents, one an
  8+ hour production outage of a shipped feature). Use whenever the user says they're about
  to deploy, cut a release, bump the version, merge to main, or asks "is this ready to
  ship," "ready to deploy," or "am I missing anything before release" — merging to main and
  deploying are effectively the same checkpoint in this project (Render auto-deploys on
  commit to main), so run steps 1-4 once per release rather than twice. ALSO use it right
  after a release-bound merge lands, for step 5 alone: auto-deploy starts a deploy but does
  not make it succeed, and a failed deploy silently keeps the previous build serving, so
  "merged with green CI" is not "shipped" — and even a successful deploy doesn't apply a new
  migration, so "deployed" still isn't "the database matches the code."
---

# release-reliability-checklist

## Why this exists

`main` now has branch protection requiring CI status checks (added by the repo owner; see
`HANDOFF.md` item 7 — this skill said the opposite until the fifty-third session). That
protection matches required checks **by exact check-run name**. The six names CI records are
`build`, `test`, `lint`, `responsive-matrix (parchment)`, `responsive-matrix (noticeboard)`
and `responsive` — and **`responsive` is the one to require**. It is a gate job that runs no
tests, `needs` the matrix, and passes only when every leg passed; it exists precisely so the
required name survives future matrix changes. There is no `typecheck` job (it's a step inside
`build`). A required name that no job produces blocks the PR forever with "Expected — waiting
for status to be reported" while CI is entirely green; that has already happened once, which
is why the gate job exists. Never require a bare `responsive-matrix` or one of its legs.

Protection stops a *red* merge, but it does not make a merge safe: Render auto-deploys on
every commit to `main` (`render.yaml`'s `autoDeployTrigger: commit`), so "merged" and "about
to be live" are effectively the same moment in this project. There is no separate release-cut
step and no second reviewer. Run this checklist before merging a release-bound change to
`main`; treat "about to deploy" and "about to merge" as the same trigger, not two separate
checkpoints.

**But "about to be live" is not "live".** Auto-deploy makes the merge *start* a deploy; it
does not make the deploy succeed. Step 5 exists because that gap is real and has already
cost this project a release — see it before you call anything shipped.

**And a successful deploy is still not "the database matches the code".** Render's deploy
never applies a Postgres migration — that has always been a separate, manual action, and
skipping it has now caused three real incidents (`0010`/`0011`/`0012`, one of them an 8+
hour production outage of a shipped feature — HANDOFF open issue 20). This checklist named
the risk once before, in step 3, and it was still missed twice more; step 5's version below
is the one that actually has to be followed, since step 5 is the mandatory post-merge half
of this checklist and step 3's was only ever a conditional pre-merge aside.

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
- [ ] If this deploy touches `supabase/migrations/`: confirm the new migration file(s) are
      numbered to sort after every existing one. **Don't rely on this pre-merge check alone
      for whether the migration is actually applied** — this release's own migration file
      may not exist on `main` yet at the point you run this step, and even when it does,
      confirming it live is exactly the kind of check that's easy to do here and then skip
      again after merging. Step 5 below has the mandatory version of this check; treat this
      bullet as "the file is well-formed," not "the database has it."
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

## Step 5: AFTER the merge — confirm the deploy actually reached `live`

Every step above runs before the merge. This one runs after, and it is not optional: a
merged PR with green CI is **not** a shipped change in this project.

This is the one failure this checklist was missing, and it is not hypothetical. On
2026-09-02 the `0.28.0` slice-1 merge built successfully and then **crashed on boot** —
Supabase returned a transient Cloudflare 521 during `runSeedIfEmpty()`, node exited before
`app.listen`, and Render marked the deploy `update_failed`. Render's behavior on a failed
deploy is to **keep serving the previous one**, so for about four hours the site served a
two-week-old build while `main`, CI, and the merged PR all looked green. Nothing anywhere
reported a problem. The failure mode is worse than a crash, because it presents as a
healthy site.

- [ ] Find the deploy for the merge commit and confirm its status is `live`, not
      `build_failed` or `update_failed`. With Render MCP access:
      `list_deploys` on service `srv-d9nqoqlaeets73ch25q0` (workspace
      `tea-d9hs81ernols73aknf00`) and check the top entry's `commit.id` matches the merge
      and its `status` is `live`. Otherwise the Render dashboard shows the same thing.
- [ ] Hit the health endpoint: `curl -sS https://asohav.onrender.com/api/health` should
      return `{"ok":true}`. Note this is **necessary but not sufficient** on its own — a
      failed deploy leaves the *old* build serving, which answers `200` perfectly happily.
      Only the deploy status distinguishes "the new code is live" from "some code is live."
- [ ] If it failed: read the boot logs (`list_logs` for the service, filtered to the
      deploy's time window) before re-triggering. A transient upstream error is worth one
      re-trigger; a real crash means the merge shipped a bug and needs a fix, not a retry.
- [ ] If this release changed `packages/shared/src/seedLibrary.ts`, the live `library` row
      is now **stale** — `runSeedIfEmpty()` skips a library that already exists, so seed
      content changes never reach production on their own. Reset it via Content Admin ->
      Data -> "Reset to seed". A stale library degrades *silently* into wrong gameplay math
      rather than erroring (this is what the `0.17.0` audit found, four versions late), so
      it will not announce itself. HANDOFF open issue 19.
- [ ] **If this release added a file to `supabase/migrations/`, confirm it has actually
      been applied to the live Supabase project — this is not optional and is not the same
      check as "the deploy reached `live`" above.** Render never runs `supabase db push` or
      anything equivalent; nothing in `render.yaml` applies a migration, ever. With Supabase
      MCP access: `list_migrations` on project `ihrtdbknhpgysgwaqnfj` and confirm this
      release's migration file(s) appear by name; if not, `apply_migration` with the exact
      SQL from the repo file, then re-run `list_migrations` to confirm. This is not
      hypothetical, and has now happened three times: `0010_combat_encounters.sql`
      (`0.14.0`) shipped unapplied and needed a dedicated later session to catch it;
      `0011_clocks.sql` (`0.33.0`) shipped unapplied and stayed that way for **8+ hours in
      production**, with Render's own logs showing the concrete cost (repeating `"Could not
      find the table 'public.clocks' in the schema cache"` errors on every read); and
      `0012_adventures.sql` (`0.36.0`) shipped unapplied in the very same merge that fixed
      the `0011` gap, because that release's own verification pass never ran this check
      either. CI cannot catch this — it never touches the live database — so this step is
      the only thing that does. HANDOFF open issue 20.

## Report shape

```
Verification: typecheck <pass/FAIL>  build <pass/FAIL>  test <pass/FAIL>  responsive <pass/FAIL>
Version sync: <n/a (no bump), or pass/FAIL with the mismatched file>
CHANGELOG entry: <n/a, or pass/FAIL>
Render gotchas: <ok, or the specific flag>
HANDOFF.md: <nothing blocking found, or the specific item and why it's relevant>
Deploy reached live: <not yet merged, or live/FAILED with the deploy id>
Live library reset: <n/a (seed unchanged), or done/still needed>
Migrations applied: <n/a (no new migration file), or applied/PENDING with the file name(s)>
```

Don't report "ready to ship" as a bare verdict — report the checklist state and let that
speak for itself, the same way the other finished skills in this repo report specific
findings rather than a pass/fail summary judgment.

## Reference files

- `.github/workflows/ci.yml` — the four CI jobs this mirrors
- `CHANGELOG.md` — versioning policy (top of file) and the entry format to match
- `render.yaml` — the deploy config and its `NPM_CONFIG_PRODUCTION` comment
- `apps/server/src/seed.ts` — first-boot seeding behavior, and the unguarded call at
  `apps/server/src/index.ts:23` that can fail a deploy (HANDOFF open issue 18)
- `supabase/migrations/` — the files themselves; project id `ihrtdbknhpgysgwaqnfj` for
  `list_migrations`/`apply_migration` (HANDOFF open issue 20)
- `HANDOFF.md` — "Open issues" section, and the fortieth-session note for the deploy
  failure Step 5 exists to catch
