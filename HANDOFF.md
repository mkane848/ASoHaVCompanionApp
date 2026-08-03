# Handoff

Status snapshot and open threads for whoever (human or Claude) picks this project up next. If
you're starting new work here, read this first — especially "Open issues" below, so you don't
duplicate a fix or lose track of something already in flight.

Last updated: 2026-08-03, end of the session that took the app from `0.3.0` to `0.4.0`: a full
responsive-UI audit and fix pass, then a follow-on migration of the entire UI from inline styles
to CSS Modules. See [CHANGELOG.md](CHANGELOG.md) for the version-by-version detail and
[README.md](README.md#architecture-notes--judgment-calls) for design decisions and rationale.

A follow-up session the same day added [CLAUDE.md](CLAUDE.md), no other changes — codebase
architecture and conventions written down for future Claude Code sessions to load automatically.
No version bump for this; it's documentation-only.

## Current state

- **Live at:** https://asohav.onrender.com (Render, single Web Service — see
  [README.md#deployment](README.md#deployment)). Not re-verified live this session (see the
  sandbox networking note in "Open issues" below) — the work above was validated against the dev
  harness/CI, not the deployed instance.
- **Version:** `0.4.0` (all four `package.json` files, synchronized — see CHANGELOG.md).
- **Database:** live Supabase project (`ihrtdbknhpgysgwaqnfj`), all 5 migrations applied,
  security advisor clean. Untouched this session.
- CI (`.github/workflows/ci.yml`) has a `responsive` job in addition to `build`/`typecheck` as of
  this session (`apps/web/scripts/responsive-smoke.mjs`, driven by `apps/web/harness.html`). Green
  on `main` as of this writing, but **`main` has no branch protection requiring either check to
  pass before merge** — see item 7 below. That gap is exactly how a red `responsive` job merged
  to `main` once already this session (fixed immediately after, in a follow-up PR).

## Open issues

Ordered roughly by how much they matter.

### 1. Unresolved: "loading error" reported after login on the live deployment

The repo owner logged into the live deployment and reported hitting "some sort of load error when
trying to access resources," alongside a layout bug. **The layout bug was found and fixed**
(PR #9 — `AdminNav`/`AdminListPane` wouldn't shrink below ~490px combined, so the Content Admin
panel's panes wrapped onto separate rows instead of staying side-by-side on a phone-width screen).

**The load error was never diagnosed.** The development sandbox this work was done in has no
network path to either the live Render URL or the Supabase project directly (confirmed via
repeated `403`s from the sandbox's egress proxy — see "Sandbox network constraints" below), so it
couldn't be reproduced with real browser tooling. We never got specifics from the repo owner
(exact error text, which screen/action triggers it, console/network output) before the session
ended. **Next step:** get the exact error message and which screen/action triggers it — ideally a
screenshot of the error itself, or the browser console + Network tab output on desktop where dev
tools are available — then reproduce and fix.

### 2. Bond handshake row-locking (PR #5) is merged but never runtime-verified

`withBondLock()` (`apps/server/src/repo.ts`) opens a direct `pg` connection and runs
`SELECT ... FOR UPDATE` inside a transaction for propose/accept/reject. The logic was written and
reviewed carefully, and the *build* was verified end-to-end locally, but the actual live
transaction/locking behavior against Supabase's Postgres was never smoke-tested — same sandbox
networking blocker as above. Worth a real test once someone has network access to the live app:
in particular, two concurrent requests against the same Bond (e.g. two accepts, or an
accept + reject race) should serialize correctly rather than one silently overwriting the other.

### 3. `v0.3.0` git tag exists locally only — never pushed

Per the versioning policy in CHANGELOG.md ("tag the merge commit vX.Y.Z"), a `v0.3.0` annotated
tag was created locally on the PR #8 merge commit. Pushing it failed with a `403` — this
session's git credentials were scoped to push the `main-2coxec` branch only, not arbitrary refs
like tags. Someone with full push access needs to run:

```bash
git fetch origin main
git tag -a v0.3.0 bb91dba23252d5ec27427f1991a8822676703199 -m "v0.3.0"
git push origin v0.3.0
```

(`bb91dba` is the PR #8 merge commit — where the `0.3.0` CHANGELOG entry landed.) Future releases
should keep tagging their merge commit; check `git tag -l` isn't falling behind `CHANGELOG.md`
again.

### 4. Commits from this session are unsigned

The container's commit-signing key was empty/misconfigured partway through the session. The repo
owner explicitly authorized pushing unsigned commits to keep moving ("we'll figure out git auth
issue after we finish the work plan") — but the underlying signing setup itself was never fixed.
GitHub shows these commits as "Unverified." Worth sorting out the signing key/environment config
if verified commits matter going forward.

### 5. Sandbox network constraints (context for future sessions, not a bug to fix)

The Claude Code environment this work was done in has a locked-down egress policy: outbound HTTPS
only reaches a small allowlist (GitHub, npm registry, Anthropic, a few others), and raw TCP
(anything that isn't proxied HTTP/HTTPS) is blocked entirely. Confirmed concretely during this
session:

- Direct `pg` connections to Supabase (both the IPv6-only direct-connection hostname *and* the
  IPv4 pooler) hang/fail — raw Postgres wire protocol isn't proxied HTTP.
- Plain `curl`/browser (Playwright) requests to `asohav.onrender.com` and to
  `ihrtdbknhpgysgwaqnfj.supabase.co` both get a `403` from the sandbox's own proxy — these hosts
  simply aren't on the allowlist.
- The Supabase MCP tool still works fine for schema/migration/query work, since that tool runs
  outside this sandbox's network entirely.

Net effect: **this kind of environment cannot do live browser QA or live database smoke-testing of
this app.** A future session working on "does X actually work" tasks either needs a different
environment/network policy, or needs the repo owner to run it themselves and relay results
(console errors, screenshots, network tab, `psql` output, etc.).

### 6. Render MCP connector never worked in this session

The repo owner tried connecting Render's official MCP connector (for driving deploys/env vars
directly) but hit a "failed to connect MCP" error, and a later attempt showed it installed at the
account level but not enabled for the chat. Deployment was done manually instead: writing
`render.yaml` as a Blueprint and having the repo owner paste env vars into Render's dashboard by
hand. If the connector gets working in a future session, Render changes could go through it
directly instead of this git-based Blueprint flow (though `render.yaml` should stay either way —
it's the actual source of truth Render reads).

### 7. `main` has no branch protection on required status checks

The `responsive` job (added this session) went red on a PR's head commit and the PR was merged
anyway — CI ran, caught a real bug (an app-bar touch-target overlap at 360px), and nobody was
forced to act on it before it reached `main`. It was fixed immediately after in a follow-up PR,
but the gap that let it merge red is still open. Needs an account admin — the session token used
for this work has `admin: false` on the repo and gets a `403` from the branch-protection API, so
this can't be done from inside a Claude Code session:

Settings → Branches → add a ruleset (or classic branch protection) on `main`, requiring the
`build` and `responsive` status checks. Leave "require branches to be up to date" off unless you
want every merge to force a rebase first.

### 8. `AboutModal`'s header padding still doesn't match the other two dialogs

Flagged during the CSS Modules migration (PR #15) and left alone since it's a design call, not a
bug: `AboutModal` uses `24px 24px 4px` for its header padding where `ForgeBondModal` and the
Advancement picker both use `20px 24px 12px` (see the comment in
`apps/web/src/components/AboutModal.module.css`). Whichever is intended, the fix is a one-line
change to `.head` in that file — normalizing it to match the shared `modal.head` in
`apps/web/src/styles/modal.module.css` would also let `AboutModal` drop its own `.head` override
entirely.

### 9. Worth a read before ASoHaV's content schema hardens further: the Datasworn project

Not a task — a recommendation to read something, made during a conversation about styling
strategy and not yet acted on. [Datasworn](https://github.com/rsek/datasworn) is a JSON Schema
for Ironsworn/Starforged (Moves, Assets, Oracles, Meters, Stats) explicitly designed as an
interchange format that accommodates homebrew and third-party content, with generated TypeScript
(and five other languages') typings. ASoHaV's content shape is close enough — both are
PbtA-lineage, and ASoHaV's `Moves` with `Tier3`/`Tier2`/`Tier1` results maps onto Datasworn's
move-outcome structure fairly directly (`packages/shared/src/schema.ts`,
`packages/shared/src/seedLibrary.ts`).

This is not a recommendation to adopt Datasworn — ASoHaV's content is original and its schema is
already reconciled from the design handoff, so wholesale adoption would be a real migration for
little gain right now. But if community tools or homebrew content ever end up on the roadmap,
borrowing Datasworn's *conventions* — how it models a move's outcomes, how it namespaces
homebrew — is far cheaper to do now, before other tooling or data depends on the current shape,
than after.

## Everything else

- What's deliberately *not* built (combat, dice rolling, Bond-proposal expiry, etc.) is listed in
  [README.md#whats-not-built](README.md#whats-not-built) — those are scoped out by the original
  design handoff, not gaps from this work.
- Design decisions and judgment calls (why Realtime instead of WebSockets, why no
  character-creation flow, etc.) are in
  [README.md#architecture-notes--judgment-calls](README.md#architecture-notes--judgment-calls).
- Full version-by-version history: [CHANGELOG.md](CHANGELOG.md).
