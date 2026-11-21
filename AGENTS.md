# Repository guide

## What this project is

The player-facing companion app for *A Story of Heroes and Villains*, a Powered-by-the-Apocalypse
tabletop game. It has four surfaces: the player **Character Sheet**, the **Campaign Shell** (roster,
invites, setup phases, GM live-peek, Bonds, Combat, Clocks), the designers' **Content Admin**, and
the GM-only **Adventure Prep**. It is an npm workspaces monorepo: an Express + TypeScript server, a
Vite + React 19 client, a shared package that is the wire contract, and Supabase Postgres. Ruleset
**V0.7** (`Planning Docs/Ruleset-V0.7.md`) is canonical.

**Before nontrivial work, read `HANDOFF.md`.** Its "Current state" is the accurate snapshot, and
its open-issues list keeps you from duplicating a fix or losing something already flagged.

## Commands

Run from the repo root. Node >= 22.

- Install: `npm install`
- Run the server: `npm run dev:server` (http://localhost:8787; seeds Supabase on first run)
- Run the web client: `npm run dev:web` (http://localhost:5173; proxies `/api`)
- Type check: `npm run typecheck` (builds `@asohav/shared` first, then server and web)
- Test: `npm test` (builds shared, then vitest in shared, server, web)
- Lint: `npm run lint`
- Doc integrity: `npm run check-docs`
- Contrast of muted text tones: `node scripts/check-contrast.mjs`
- Version sync: `node scripts/check-versions.mjs`
- Build: `npm run build` (shared, then server, then web; both apps import shared's built `dist`)

Workspace-specific commands (the responsive smoke test, print renders, focused tests) live in each
workspace's own `AGENTS.md`. The full command reference and the CI job and check-run names are in
[`docs/operations.md`](docs/operations.md).

## Project layout

- `packages/shared/` holds the data model (`src/types.ts`), the pure rules and business logic,
  seed content, and API shapes. → [`packages/shared/AGENTS.md`](packages/shared/AGENTS.md)
- `apps/server/` is Express. It has one route file per resource in `src/routes/`, and
  `src/repo.ts` is the only code that talks to Postgres. → [`apps/server/AGENTS.md`](apps/server/AGENTS.md)
- `apps/web/` is Vite + React. Pages are in `src/pages/`, feature panels in `src/features/`, and
  hooks and the API client in `src/lib/`. → [`apps/web/AGENTS.md`](apps/web/AGENTS.md)
- `supabase/migrations/` holds timestamp-versioned SQL migrations. → [`supabase/AGENTS.md`](supabase/AGENTS.md)
- `docs/` is read on demand:
  - [`architecture/`](docs/architecture/README.md) has one doc per subsystem, describing what the
    app does now.
  - [`decisions.md`](docs/decisions.md) records judgment calls.
  - [`not-built.md`](docs/not-built.md) lists what is deliberately absent.
  - [`operations.md`](docs/operations.md) covers commands, CI and deployment.
  - [`TechStackAudit.md`](docs/TechStackAudit.md) is the stack audit. It is live and still has open
    items.
  - [`history/`](docs/history/README.md) and [`archive/`](docs/archive/README.md) are kept but not
    maintained, and you should not edit them.
- `Planning Docs/` holds the ruleset, the migration work plans and meeting notes.
  `Planning Docs/archive/` holds superseded rules files.
- A bare-filename citation (`WorkPlan-0.38.0.md`, `TechStackAudit.md D2`) resolves through the
  name→path indexes in `docs/archive/README.md` and `docs/history/README.md`.

## Verification

Before calling work finished, run what CI runs:

1. `npm run typecheck`
2. `npm test`
3. `npm run lint && npm run check-docs && node scripts/check-contrast.mjs`
4. `npm run build`

Also run these when they apply:

- If you changed CSS or added or resized a control, run the responsive smoke test (the
  `responsive-device-qa` skill; see `apps/web/AGENTS.md`).
- If you changed what a character sheet or the GM Reference shows, run `npm run print:sheet -w @asohav/web` /
  `npm run print:gm -w @asohav/web` and look at the pages.

If a command fails, fix the cause and rerun it. Never skip, disable or quarantine a test to get to
green.

## Safety

- **Never commit secrets.** `.env` and `.env.*` are gitignored; only `apps/server/.env.example` is
  tracked.
- **Authorization lives in Express, not in RLS.** All writes use the Supabase service-role key,
  which bypasses RLS. Every mutating route must check membership and role itself. See
  `apps/server/AGENTS.md` and `supabase/AGENTS.md`.
- **Never add randomness to the rules engine.** The app never rolls dice for the player. This is a
  settled product decision, not a gap. See `packages/shared/AGENTS.md`.
- **Don't guess at a rules question the ruleset leaves open.** `HANDOFF.md` catalogues the open
  ones; treat that list as a fence, not a TODO. When a call genuinely has to be made, record it and
  its reasoning in `docs/decisions.md`.
- **A merged PR with green CI is not a shipped change.** All three of the following have happened
  more than once:
  - A failed Render deploy keeps the old build serving. `verify-deploy.yml` catches this.
  - Render never applies migrations. `apply-migrations.yml` does.
  - A `seedLibrary.ts` change never reaches an existing library. A `SEED_VERSION` mismatch banner
    appears in Content Admin → Data.

  Use the `release-reliability-checklist` skill; the details are in
  [`docs/operations.md`](docs/operations.md).
- **Don't push tags from a session**; it fails here. `tag-release.yml` tags merges to `main`.
- **Don't claim to have verified `withBondLock()` against live Postgres** from a sandbox. Sandboxes
  have no raw TCP egress.

## Conventions

- **`packages/shared/src/types.ts` is the wire contract.** JSONB columns store its shapes verbatim,
  so add fields and never rename them.
- **Printables follow the rules.** Paper sheets render from the live sheet and library, so there
  must be no static PDF, image or hard-coded rules text. A new field on `CharacterSheet`, `Party`,
  `Bond` or `Library` fails typecheck in `printCoverage.ts` until you decide whether it prints. See
  `apps/web/AGENTS.md`.
- **Respect the product decisions.** `docs/not-built.md` lists what is deliberately absent (dice
  rolling, Bond-proposal expiry, Hero Moves, a rendered Combat grid and more). Don't treat those as
  bugs or TODOs unless you are asked to build them.
- **Character fields are write-once.** There is no post-creation edit route for any `Character`
  field, and adding one needs an explicit ask.
- **Grep before you build.** This project has twice nearly rebuilt a feature that had already
  shipped, and once shipped a second copy of an existing CSS rule.
- **Write the docs as well as the code.** `README.md`, `CHANGELOG.md`, `HANDOFF.md` and `docs/` are
  maintained. A nontrivial change updates the relevant doc, and a judgment call goes in
  `docs/decisions.md`.

## PR expectations

- **One version across four `package.json` files** (root, `@asohav/server`, `@asohav/web`,
  `@asohav/shared`) plus `package-lock.json`. Bump them together. The policy is at the top of
  `CHANGELOG.md`.
- Every version gets a `CHANGELOG.md` entry with a UTC timestamp, and the `Version:` line in
  `HANDOFF.md` "Current state" is updated to match. `check-docs` enforces the version line.
- Project skills live in `.agents/skills/<name>/SKILL.md`, with symlinks in `.claude/skills/`. If
  you change a convention a skill describes, update the skill. The `.claude/skills/steward` symlink
  is load-bearing: the PR-watching rules read it at that path.
  - `theme-tokens`: when editing CSS.
  - `responsive-device-qa`: for layout changes.
  - `perf-budget`: for routes, `repo.ts`, queries and Realtime.
  - `release-reliability-checklist`: before and after merge.
  - `steward`: when driving a PR to merged and deployed.
