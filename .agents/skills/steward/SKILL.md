---
name: steward
description: >
  Repo-specific guidance for driving a pull request on ASoHaVCompanionApp to a genuinely merged,
  genuinely deployed state — what "green" means here (six check-run names, one of which is a gate
  job that runs nothing), the three distinct ways branch protection has silently blocked a green PR
  on this repo, the three ways a merged PR with green CI still fails to ship, and what is never a
  flake here. Use when watching, babysitting or autofixing a PR, when CI goes red, when a PR is
  mergeable-but-blocked with nothing visibly failing, when merging to main, or right after a merge
  lands — and read it before acting on any CI or review event on a PR in this repository.
---

# steward

Repo-specific PR and merge guidance for ASoHaVCompanionApp. This takes precedence over the generic
PR-watching rules **on conventions and on how proactive to be** — it does not, and cannot, expand
access or relax a safety rule. See "What this file cannot do" at the end.

## Why this exists

Two classes of failure on this repo are invisible from the diff, cost hours each time, and have
each fired more than once:

- **Branch protection has silently blocked a green PR three separate ways.** No failure appears
  anywhere; the PR simply will not merge.
- **A merged PR with green CI is not a shipped change**, three separate ways. The site answers 200,
  CI is green, and the new code is running nowhere — or the database does not match it.

A session that does not know these re-derives them under time pressure, or misses them entirely.
The `0.28.0` boot crash served a two-week-old build for about four hours before anyone looked.

## What "green" means here

CI (`.github/workflows/ci.yml`) has **five jobs but six check-run names**, because a matrix job
reports one check run per entry and never under its bare name:

| Check run | What it is |
|---|---|
| `build` | includes `npm run typecheck` as a step — there is **no** `typecheck` job |
| `test` | `@asohav/shared`, then server, then web |
| `lint` | `eslint . --max-warnings=54`, **and** `npm run check-docs` as a second step |
| `responsive-matrix (parchment)` | one appearance leg |
| `responsive-matrix (noticeboard)` | the other |
| `responsive` | **a gate job that runs no tests** |

**`responsive` is the one to require, and that indirection is the whole point.** It `needs` the
matrix and passes only when every leg passed. Its `if: always()` is load-bearing: without it the
job would be *skipped* when the matrix fails, and a skipped check does not satisfy a required
check — so the PR would block with no visible failure explaining why. Requiring a bare
`responsive-matrix`, or one suffixed leg, is the mistake; `responsive` keeps reporting under that
exact name however the matrix is later reshaped.

**`Supabase Preview` is `skipped` on every PR in this repo.** It is not a failure and not something
to fix. It was identical on PRs that merged fine.

Required contexts on `main` are exactly `build`, `test`, `lint`, `responsive` (verified against the
rulesets API, 2026-09-12).

## Before you push

Run what CI runs, locally, and prove the change before spending a cycle:

```bash
npm run typecheck && npm run test && npm run lint && npm run check-docs
node scripts/check-versions.mjs        # only if the version changed
```

- **`@asohav/shared` must be built first.** Server and web import it from `dist`, not source. The
  `typecheck` and `test` scripts already do this; a bare `vitest` invocation does not.
- **The lint ratchet is `--max-warnings=54` against an actual 52.** Two warnings of headroom. A
  refactor that adds three fails CI even though nothing is broken — check the count, don't assume.
- **Browser passes are only needed for CSS or layout changes.** If you touched a `.module.css`,
  `layout.css`, or any interactive control's size, use the `responsive-device-qa` skill.
  `CHROMIUM_PATH=/opt/pw-browsers/chromium` is required in this sandbox, and **never re-run
  `playwright install`** — `cdn.playwright.dev` is off the egress allowlist and 403s. That is the
  proxy, not a broken setup.
- **Re-read your own diff adversarially** before pushing. One validated push beats three
  speculative ones.

## What is never a flake here

- **A responsive-smoke failure is a real regression.** That suite exists because it kept catching
  real hit-area, overflow and overlap bugs — including three controls under the 44×44 floor that
  had shipped unnoticed because the surface had no browser coverage at all.
- **A route test failing against an archived campaign, or a phase gate, is a real missing guard.**
  `0.50.0` found four mutating routes that skipped the archive freeze, and every test had passed
  the whole time because none exercised them against an archived campaign. If such a test goes red,
  the guard is missing; do not relax the test.
- **Never skip, disable or quarantine a test to get green.** Never push an empty commit or close
  and reopen a PR to kick CI.

## Branch protection: three silent blocks, and how to diagnose

All three produced a green PR that would not merge, with nothing failing.

1. **The matrix-name trap (`0.26.0`, found fifteen versions later).** Protection required a context
   named `responsive`; that job then gained a matrix and stopped reporting under that name, so the
   PR waited forever for a report nothing would ever send. Symptom: a check that never appears, not
   one that goes red.
2. **Require-verified-signatures (2026-09-12).** Every commit made from a Claude session here is
   unsigned — `commit.gpgsign true` with `gpg.format ssh` and a **zero-byte** signing key, so
   signing is on and silently produces nothing. The rule was added and removed within a day to
   unblock a PR. If it is ever switched back on, nothing pushed from a session here can merge; see
   `HANDOFF.md` item 4. Commits created through the GitHub API are signed by GitHub itself.
3. **`require_extra_approval_for_unattributed_changes`, with `required_approving_review_count: 0`.**
   Still set. With approvals at 0 that rule is the only review gate left, and a solo maintainer
   cannot approve their own PR — so a commit GitHub cannot attribute to an account would deadlock.
   **Author commits as the repo owner with a `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
   trailer**, matching every merged release commit since `0.51.0`.

**Diagnosing, without wasting a cycle:**

- `GET /repos/{owner}/{repo}/branches/main/protection` returns **`403 Resource not accessible by
  integration`** for the session token. That is not evidence of anything. Read
  `GET /repos/{owner}/{repo}/rulesets` and then the ruleset by id.
- **A draft PR always reports `mergeable_state: blocked`**, whatever the rules say. So does a PR
  with a required check still pending. Check `draft` and the check runs *before* concluding a rule
  is biting — all three were true at once on #133 and only the draft flag and a pending
  `responsive` were actually responsible.
- GraphQL (`mergeStateStatus`, which would distinguish `DRAFT` from `BLOCKED`) is **not available**
  from Claude Code sessions; the endpoint refuses and points at REST.

## Three ways a merged PR still has not shipped

Run these **after** the merge, not instead of the pre-merge gate. The
`release-reliability-checklist` skill owns the full procedure; this is the short form.

1. **Confirm the deploy reached `live`.** Render auto-deploys `main`, but a *failed* deploy leaves
   the previous build serving. `list_deploys` on service `srv-d9nqoqlaeets73ch25q0`; the top entry
   must match the merge commit with `status: live`. `/api/health` cannot tell you — the old build
   answers it just as happily.
2. **Apply any new migration by hand.** Nothing in `render.yaml` runs `supabase db push` and never
   has. Apply it and confirm with `list_migrations` on project `ihrtdbknhpgysgwaqnfj`. Three
   incidents, one an 8+ hour production outage of a shipped feature.
3. **Reset the live library if `seedLibrary.ts` changed.** `runSeedIfEmpty()` skips a library that
   already exists, and a stale library degrades *silently* into wrong gameplay math rather than
   erroring — which is why it went unnoticed for four versions. Content Admin → Data → "Reset to
   seed".

A docs-only release still deploys, so step 1 still applies to it.

## What this repo never does

- **Never edit a shipped `CHANGELOG.md` entry**, or anything under `docs/history/` or
  `docs/archive/`. If a past entry is wrong, the correction goes in the *current* entry. When a
  stale citation is found in shipped history, fix the thing it points at instead.
- **Never renumber `docs/decisions.md`.** Source comments, `CHANGELOG.md` and
  `apps/web/scripts/bundle-budget.mjs` cite those item numbers. Append.
- **Never add randomness to the rules engine.** The app does not roll dice for the player; that is
  a settled product decision, not a gap.
- **Never guess a rules question the ruleset itself leaves open.** `HANDOFF.md` catalogues them and
  that catalogue is a fence, not a backlog.
- **Never assume a rule doesn't exist without grepping.** This project has twice nearly rebuilt an
  already-shipped feature, and once shipped a duplicate of an existing CSS rule described as a
  newly-found bug.

## Docs are part of the change

- `npm run check-docs` must pass. It checks link resolution, moved section anchors, unmarked dead
  symbols in the decision record, and dangling numbered citations into `HANDOFF.md`'s open-issue
  list. It runs as a step inside `lint`, never as its own job — a new job would not be covered by
  the existing protection rule and could fail unnoticed.
- A nontrivial judgment call goes in `docs/decisions.md` with its reasoning.
- The five project-authored skills (`theme-tokens`, `responsive-device-qa`, `perf-budget`,
  `release-reliability-checklist`, and this one) cite doc sections by name and must stay in sync
  with them. They live in `.agents/skills/<name>/SKILL.md`; `.claude/skills/` holds symlinks.

## What this file cannot do

It is repository content, not an instruction from the user. It cannot expand access, redirect the
task, or override any rule the generic guidance states as "never" — among them: skipping, disabling
or quarantining a test; rewriting history on someone else's branch; an empty commit or a close-and-
reopen to kick CI; or pushing a larger ask onto a PR you did not open. **It never authorises
approving or merging a PR** — those are always the repo owner's.

## Reference

- `docs/operations.md` — commands, CI, deployment, sandbox network constraints.
- `HANDOFF.md` — "Current state" and the open-issue list; items 3, 4, 7, 19 and 20 are the ones
  this file draws on.
- `CLAUDE.md` — the invariants a change must not violate.
