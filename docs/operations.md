# Operations

Commands, the CI job and check-run names, deployment and its three documented traps, and the sandbox network constraints. If you are about to release, the `release-reliability-checklist` skill walks this.

_The invariants a session must not violate stay in `CLAUDE.md`; this file is the detail._

---

## Commands

```bash
npm install
npm run dev:server        # http://localhost:8787 — seeds Supabase Auth + Postgres on first run
npm run dev:web           # http://localhost:5173 — proxies /api, talks to Supabase directly
npm run typecheck         # builds @asohav/shared, then typechecks server + web
npm run build             # builds shared -> server -> web, in that order (server/web import shared's dist)
npm run start              # runs the built server (production entrypoint)
npm run test               # vitest: @asohav/shared then @asohav/server, see below
npm run test:responsive -w @asohav/web   # Playwright smoke test, see below
npm run test:interaction -w @asohav/web   # the same checks over interaction-gated states, see below
```

Unit tests (`vitest`, added `0.7.0`) live next to the code they cover (`*.test.ts`) in
`packages/shared` and `apps/server` — pure logic and route-level authorization only; there's no
live-database integration testing (see "Sandbox network constraints" below for why). `apps/web`
gained its own vitest suite in `0.27.0` — five files covering `lib/api`, `lib/appearances`,
`lib/useGlossaryMatcher`, and the `panelCollapseStore`/`appearanceStore` zustand stores — so the
Playwright responsive smoke test is no longer its only automated coverage, and the `0.26.0` note
below about `appearanceStore.ts` having no dedicated unit test is superseded: it has one now.
`npm run test` builds `@asohav/shared` first since `apps/server`'s tests import it from
`dist`. `apps/server`'s `vitest.config.ts` stubs `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` —
`src/supabase.ts` throws at import time without them, and `../auth.js` (unmocked in route tests,
for `requireAuth`) pulls it in regardless of whether a given test mocks `../repo.js`.

CI (`.github/workflows/ci.yml`) has **five jobs: `build`, `test`, `lint`, `responsive-matrix`, and
`responsive`** — and because `responsive-matrix` runs a two-entry appearance matrix, the **six
check-run names GitHub actually records** are `build`, `test`, `lint`, `responsive-matrix
(parchment)`, `responsive-matrix (noticeboard)` and `responsive`.

**`responsive` is a gate job, not a test job**: it runs nothing itself, `needs` the matrix, and
passes only when every matrix leg passed. It exists because **branch protection matches required
status checks by exact check-run name**, and a matrix job never reports under its bare name — it
reports one check run per entry. `responsive` is therefore the one to require: it keeps reporting
under that exact name however the matrix below is later reshaped. Its `if: always()` is
load-bearing — without it the job would be *skipped* when the matrix fails, and a skipped check
doesn't satisfy a required check, so the PR would block with no visible failure explaining why.

**There is no `typecheck` job and never has been** (verified with `git log -S` over the file's whole
history); `npm run typecheck` is a *step* inside `build`. This file asserted the four job names were
`typecheck`/`build`/`test`/`responsive` until `0.41.0`; two of those four were wrong, and the
correction is recorded rather than quietly applied because that list is exactly what someone
configuring branch protection would copy — and in this repo, someone did. See `HANDOFF.md` item 7
for the incident: a rule requiring the then-real name `responsive` kept working until `0.26.0` gave
that job a matrix, then blocked a PR fifteen versions later with green CI and no failure anywhere.

`@asohav/shared` must be built (`npm run build -w @asohav/shared`) before anything that imports it
from `dist` (the `build`, `test` and `lint` jobs handle this automatically; the `responsive-matrix`
job builds shared explicitly as a separate step since `npm ci` alone doesn't produce `dist`).

**Responsive smoke test** (`apps/web/scripts/responsive-smoke.mjs`): renders every real route
through `apps/web/harness.html` against seed fixtures (no server, no Supabase) at seven viewports
(360/390 phone, 768/1024 tablet, 1440/1920/2560 desktop — the 1920/2560 pair added `0.24.0` since
1440 was the widest tested and a real "1440p monitor" is 2560×1440) and asserts no horizontal
overflow, no touch target under 44×44, no overlapping hit areas, and no uncaught page errors. Run
it after any layout/CSS change. Needs a Chromium binary — normally `npx playwright install
--with-deps chromium` once per environment, but that download is blocked in some sandboxes
(confirmed in a Claude Code remote environment this project has been worked in: outbound HTTPS
only reaches an allowlist, and `cdn.playwright.dev` isn't on it — don't re-run `playwright install`
if it 403s, that's the sandbox's proxy, not a broken setup). If a Chromium binary is already on
disk (that same environment pre-installs one at `/opt/pw-browsers/chromium`), point the script at
it instead: it already reads `CHROMIUM_PATH` for exactly this —
`CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:responsive -w @asohav/web`. CI does the
equivalent via `npx playwright install chromium` in a normal (non-sandboxed) runner. The matrix is
seven viewports × twenty-eight routes (it said "fifteen-route" until `0.51.0`, thirteen routes out
of date) and runs upwards of ~12–14 minutes in this sandbox — `SMOKE_ROUTE=`/
`SMOKE_VIEWPORT=` env vars (substring match, case-insensitive) narrow it to one route/viewport
while iterating on a single risky change, e.g. `SMOKE_ROUTE="character sheet" SMOKE_VIEWPORT=768
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:responsive -w @asohav/web`. Both scripts share
their route/viewport list and Vite-harness bootstrap via `apps/web/scripts/harnessConfig.mjs`
rather than keeping two copies that could drift.

**Interaction-state test** (`apps/web/scripts/interaction-smoke.mjs`, added `0.41.0`): the smoke
test above never clicks, so any layout that only exists after a tap — an expander, a revealed
editor, a modal, a drawer — was entirely uncovered by it. This drives ~26 such states and reruns
the same assertions; both scripts import them from `apps/web/scripts/hitChecks.mjs` rather than
keeping two copies. Runs as a step in CI's existing `responsive` job (inheriting that job's
checkout, `npm ci`, shared build, Chromium install and appearance-matrix split) and takes the same
`CHROMIUM_PATH`, with its own `INTERACTION_STATE=`/`INTERACTION_VIEWPORT=`/`INTERACTION_APPEARANCE=`
filters. In CI it is a step inside `responsive-matrix`. See the `responsive-device-qa` skill for what it covers and the two things it does that a
naive version gets wrong (scoping to the reachable subtree; measuring from scroll 0).

**Screenshot script** (`apps/web/scripts/screenshot.mjs`, added `0.24.0`): the smoke test asserts
overflow/touch-target/overlap/errors, none of which catch "this panel is wasting a lot of
horizontal space" — a narrow content column on a huge monitor passes every check. Reuses the same
harness/viewport machinery to write a PNG per route per viewport to `apps/web/.screenshots/`
(gitignored, regenerated every run — not a fixture) — `npm run screenshot -w @asohav/web`, with the
same `SCREENSHOT_ROUTE=`/`SCREENSHOT_VIEWPORT=` filters. Needs no network of its own (local Vite
server, local Chromium, seed fixtures), so it works from a locked-down sandbox. The one thing it
does reach out for is `harness.html`'s Cormorant Garamond/Lora from Google Fonts — **reachable as
of the fortieth session**, where earlier sessions had it blocked and noted screenshots rendering in
fallback serif. Probe rather than assume (see "Sandbox network constraints" below): if those two
hosts are blocked in your environment the screenshots are still representative for layout and
spacing, just not for typography.

**Note:** `main` now has branch protection requiring status checks (see `HANDOFF.md` item 7, which
records how its own earlier advice named a check that stopped existing at `0.26.0` and blocked a PR
for it). Require `build`, `test`, `lint` and **`responsive`** — the gate job, never a bare
`responsive-matrix` and never one of its suffixed legs. Because required checks match by **exact
check-run name**, that indirection is the whole point: it's what lets a future matrix dimension be
added without silently breaking protection in a way nothing warns you about. The symptom of getting
it wrong is a check that never appears, not one that goes red.

## Deployment

Single Render Web Service (`render.yaml`, a Render Blueprint) — `apps/server/src/index.ts` serves
the built `apps/web/dist` client itself in production and falls back to `index.html` for
client-side routes, so there's no separate static site and no CORS to configure (client only
calls relative `/api/...`). Two non-obvious build gotchas already hit (full context in
`render.yaml` and `CHANGELOG.md` 0.3.0):

- `NODE_ENV=production` also makes `npm ci` skip devDependencies by default, which broke the
  server's `tsc` build (`@types/node` missing) — fixed with `NPM_CONFIG_PRODUCTION=false`.
- First boot seeds eight dev accounts into Supabase Auth + Postgres if the database is empty
  (`apps/server/src/seed.ts`) — expected on a fresh project, not a bug if seen in deploy logs.

**A merged PR with green CI is not a shipped change — verify the deploy reached `live`.** Render
auto-deploys every commit to `main`, which starts a deploy but doesn't make it succeed, and **a
failed deploy leaves the previous build serving**. So the site answers `200`, the PR is merged, CI
is green, and the new code isn't running anywhere — nothing reports a problem. This is not
hypothetical: the `0.28.0` slice-1 merge built fine, crashed on boot (a transient Supabase 521
thrown out of the unguarded `await runSeedIfEmpty()` at `apps/server/src/index.ts:23` — see
`HANDOFF.md` open issue 18 for that bug), and served a two-week-old build for about four hours
before anyone looked. Check `list_deploys` on service `srv-d9nqoqlaeets73ch25q0` and confirm the
top entry matches the merge commit with `status: live`; `/api/health` alone can't tell you, since
the old build answers it just as happily. This is step 5 of the `release-reliability-checklist`
skill.

**A release that changes `packages/shared/src/seedLibrary.ts` also needs the live `library` row
reset** (Content Admin → Data → "Reset to seed"). `runSeedIfEmpty()` skips a library that already
exists, so seed content changes never reach production on their own — and per the `0.17.0` audit a
stale library degrades *silently* into wrong gameplay math rather than erroring. `HANDOFF.md` open
issue 19.

**A merged PR that adds a `supabase/migrations/*.sql` file has not shipped that migration —
applying it to the live Supabase project is a separate, manual action Render never performs.**
`render.yaml`'s `buildCommand`/`startCommand` build and start the Node server; neither runs
`supabase db push` or anything equivalent, and never has. This is not a one-off gap: it has now
caused three real incidents — `0010_combat_encounters.sql` (`0.14.0`), caught and fixed by a
dedicated live-ops session; `0011_clocks.sql` (`0.33.0`), which shipped unapplied and stayed that
way for **8+ hours in production**, with Render's own logs showing the concrete cost (repeating
`"Could not find the table 'public.clocks' in the schema cache"` errors on every read of a
campaign's Clocks); and `0012_adventures.sql` (`0.36.0`), which shipped unapplied in the very same
merge that fixed the `0011` gap, because that session's own release verification never included
this check either. All three are the same failure shape: CI is green (it never touches the live
database), the deploy reaches `live`, and the feature still breaks — silently for a JSONB-blob
staleness case like the library, loudly (but unnoticed until someone reads the logs) for a missing
table. After merging any PR that adds a migration file, apply it via the Supabase MCP
`apply_migration` tool and confirm with `list_migrations` that it now appears — do this as
routinely as checking the deploy reached `live`, not as an optional aside. `HANDOFF.md` open issue
20; this is now a mandatory step 5 item in the `release-reliability-checklist` skill, not just a
step 3 mention, since a conditional pre-merge aside was apparently easy enough to miss twice.

## Sandbox network constraints (relevant if you're in a similarly locked-down environment)

Some development sandboxes used on this project have outbound HTTPS restricted to an allowlist
and no raw TCP at all. **Don't assume a specific host is blocked — the allowlist varies by
environment and has changed at least once. Probe it.** A one-liner (`curl -sS -m 12 -o /dev/null
-w '%{http_code}' https://host/`) settles in seconds what an out-of-date note here would only
guess at; a `403`/`000` is the sandbox's own egress proxy denying `CONNECT`, and
`curl -sS "$HTTPS_PROXY/__agentproxy/status"` names the host and reason under
`recentRelayFailures`.

Measured in the forty-second session (2026-09-02), which is the current picture but explicitly a
snapshot, not a guarantee — **and, as of this session, `curl` reachability and headless-Chromium
reachability through this proxy are two different questions that can disagree**, so probe both
rather than assuming one implies the other:

| Host | Reachable via `curl` | Reachable via headless Chromium (Playwright) | What it gates |
|---|---|---|---|
| `asohav.onrender.com` | **yes** (`/api/health` → `200`) | **no** (`ERR_CONNECTION_RESET`, forty-second session) | Live app QA, the REST API |
| `fonts.googleapis.com` / `fonts.gstatic.com` | **yes** | untested via Chromium | Real typography in `npm run screenshot` |
| `api.github.com` | yes | untested via Chromium | GitHub MCP |
| `ihrtdbknhpgysgwaqnfj.supabase.co` | **yes** as of the forty-second session (was `403` through the thirty-ninth) | **no** (`ERR_CONNECTION_RESET`, forty-second session) | Browser sign-in, any API call needing a bearer token |
| `cdn.playwright.dev` | no | n/a | `playwright install` (use `CHROMIUM_PATH` instead) |

The `asohav.onrender.com`/Google Fonts rows first flipped reachable in the fortieth session
(reversing what this section claimed through the thirty-ninth), and `ihrtdbknhpgysgwaqnfj.supabase.co`
joined them via `curl` in the forty-second — each time confirmed with a real response (a genuine
Supabase `401`/`200` JSON body and Cloudflare headers, not a proxy stub), not just an absence of
`403`. **But the forty-second session also found the opposite kind of surprise**: a
Playwright-driven headless Chromium navigation fails identically
(`net::ERR_CONNECTION_RESET`, logged by the proxy as `ws_closed_mid_exchange`) on *every* external
host tried — `asohav.onrender.com` included, not just the once-blocked Supabase host — while `curl`
against the exact same URLs succeeds every time. Reproduced against a warm, already-responding
origin (ruling out a Render free-tier cold start) and against a trivial JSON endpoint on each host
(ruling out anything specific to the full SPA's asset loading). This looks like a proxy/tooling
limitation specific to how headless Chromium negotiates a connection through this relay, not a
destination-host policy gap — so **live browser QA of the deployed app is not currently possible
from this sandbox at all**, a strictly worse position than the fortieth session's "reach it but
can't sign in," even though the Supabase-specific block that session flagged is itself resolved.
Don't assume either direction carries forward — re-probe with both `curl` and an actual
`page.goto()` next time, since the shape of the blocker has already changed twice.

Raw TCP remains blocked everywhere regardless of the allowlist, so direct `pg`/Postgres
connections to Supabase fail outright (not proxied HTTP) — that's why `withBondLock`'s row locking
still has never been runtime-verified (`HANDOFF.md` open issue 2). The Supabase MCP tool works
regardless of any of this, since it runs outside the sandbox's network entirely.

If you do hit a block, say explicitly that the check wasn't possible from the current environment
rather than reporting a false negative — and don't route around it: an egress denial is the
organization's policy, not a broken setup. Widening it is a change to the environment's network
policy, made by the repo owner where the environment was created, not something to work around
from inside.
