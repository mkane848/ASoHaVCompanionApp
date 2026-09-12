# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ASoHaV Companion App — the player-facing digital toolset for *A Story of Heroes and Villains*, a
Powered-by-the-Apocalypse tabletop game. npm workspaces monorepo: Express + TypeScript server,
Vite + React 19 web client, a shared package that is the wire contract, Supabase Postgres behind it.

Four surfaces: the player **Character Sheet**, the **Campaign Shell** (roster, invites, setup
phases, GM live-peek, Bonds, Combat, Clocks), the designers' **Content Admin** panel, and a GM-only
**Adventure Prep** surface. Ruleset **V0.6** is canonical
(`Planning Docs/Ruleset-V0.6.md`); its eight-slice migration shipped across `0.42.0`–`0.49.0` and
is complete. The app is at `0.52.0`.

**Read `HANDOFF.md` before starting nontrivial work** — its "Current state" is the fastest accurate
snapshot, and its open-issues list is what stops you duplicating a fix or losing something already
flagged. `README.md` covers the project at a glance; `CHANGELOG.md` is the versioned history.

## Where everything lives

This file is **an index plus the invariants a session must not violate**. It used to be 3,386
lines, which every session paid for whether or not it needed them; the detail now sits in `docs/`
and is read on demand.

| Path | What it holds |
|---|---|
| [`docs/architecture/`](docs/architecture/README.md) | One document per subsystem, describing what the app **currently does**. Start at its README. |
| [`docs/operations.md`](docs/operations.md) | Commands, the CI jobs and their exact check-run names, deployment, sandbox network constraints. |
| [`docs/decisions.md`](docs/decisions.md) | The judgment-call record — why an ambiguous or contradictory source document was resolved the way it was. |
| [`docs/not-built.md`](docs/not-built.md) | What is deliberately absent. Not a TODO list. |
| [`docs/AppThemeGuidelines.md`](docs/AppThemeGuidelines.md) | Design reasoning for the appearance system. Live, not history. |
| [`docs/TechStackAudit.md`](docs/TechStackAudit.md) | The stack audit. Live — it still has open items. |
| [`docs/history/`](docs/history/README.md) | Kept, not maintained: release narrative, ruleset migrations, the session log. |
| [`docs/archive/`](docs/archive/README.md) | Completed work plans and audits, with a name→path index. |
| `Planning Docs/` | The ruleset itself (`Ruleset-V0.6.md`) and its migration plan (`WorkPlan-V0.6.md`). `Planning Docs/archive/` holds **superseded rules files** — a different thing from `docs/archive/`, which holds **completed plans**. |

Bare-filename citations elsewhere in this repo (`TechStackAudit.md D2`, `WorkPlan-0.38.0.md
correction 3`) still resolve — the two archive indexes map name to path.

---

# Invariants

Everything below is a rule that has already been broken once, or would be expensive to get wrong.
Each links to the fuller treatment.

## Authorization is in the Express layer, not RLS

**The single most important thing to know before touching data access.** Every table has RLS
enabled, but **only `SELECT` policies exist** for the `authenticated` role. All INSERT/UPDATE/DELETE
goes through `apps/server/src/repo.ts` using the Supabase **service-role key**, which bypasses RLS
entirely. Business rules — membership checks, GM-only actions, admin-only library writes, Bond
handshake rules — are enforced in the Express route handlers, not in Postgres policies.

Do not add a mutating route that assumes RLS is doing authorization for you. Check `req.user` /
`membershipFor()` explicitly, following `apps/server/src/routes/bond.ts`.

→ [`docs/architecture/data-and-access.md`](docs/architecture/data-and-access.md)

## A Realtime-synced table needs a joinless SELECT policy

There is no server-side broadcast layer; the client subscribes to `postgres_changes` directly and
Realtime evaluates each table's SELECT policy per subscriber. Two constraints follow, and the
second has already caused a real bug:

- Realtime's `filter` only supports equality on a column, so a table that should sync live needs a
  `campaign_id` column to filter on.
- **The policy itself must also be joinless.** Realtime does not reliably evaluate a `USING` clause
  that joins out to another table. Wrap any check beyond a plain membership match in a `private.*`
  SECURITY DEFINER function called with columns already on the row — never write the join inline.

Also: a `postgres_changes` payload carries the subscribed row's **entire** `data` column regardless
of what the handler reads. That is why the `adventures` table is deliberately not subscribed — it
would leak unrevealed GM Secrets at the wire level, before any app code runs.

→ [`docs/architecture/data-and-access.md`](docs/architecture/data-and-access.md)

## Adding a required field to a JSONB aggregate needs a read-time default

Play-state aggregates are single JSONB columns matching `packages/shared/src/types.ts` exactly, so
a new field normally needs no migration — but rows already in Postgres have no such key, and it
deserializes as `undefined`. Extend the relevant `normalize*()` function
(`normalizeSheet`/`normalizeLibrary`/`normalizeParty`/`normalizeBond`/`normalizeEncounter`/
`normalizeAdventure`/`normalizeClock`/`normalizeWorld`), do not trust the TypeScript type.

This rule was stated and then not followed: by `0.49.0` four aggregates had gained required fields
with no read-time default, and a stale `library` singleton had been silently producing wrong
gameplay math for four versions rather than crashing — which is precisely why nobody noticed.
`0.50.0` fixed all of them. "We haven't needed this yet" ages badly.

A field that must be independently queried or filtered still needs a real column and a migration.

→ [`docs/architecture/data-and-access.md`](docs/architecture/data-and-access.md)

## Never add randomness to the rules engine

**This app never rolls dice for the player.** It computes and itemizes modifiers so the player
knows what to roll and why; once the table rolls, the player reports the tier and the engine applies
the mechanical consequence. Do not add `Math.random()`, a dice library, or anything
non-deterministic to `packages/shared/src/engine.ts` or its callers. This is a settled product
decision confirmed directly with the repo owner, not an oversight or an unfinished feature.

→ [`docs/architecture/rules-engine.md`](docs/architecture/rules-engine.md)

## Don't guess at a rules question the ruleset leaves open

`Ruleset-V0.6.md` contradicts itself in places and leaves real questions unanswered — the Party
Skill Tag economy, Forge a Bond's effect, Subdued's duration. `HANDOFF.md` catalogues them.
**Treat that catalogue as a fence, not a TODO.** Guessing an answer reintroduces exactly the class
of undocumented judgment call this project's audits keep having to find and fix afterwards. Where a
call genuinely has to be made, record it in `docs/decisions.md` with its reasoning.

`WorkPlan-V0.6.md` Section A is the record of every judgment call the migration already made. Read
it before changing rules code.

## The archive freeze and the phase gates

Archiving a campaign freezes further play-state mutation, not just labelling. Call
`assertCampaignActive(campaign)` from every mutating route that touches an archived campaign's
state. As of `0.50.0` `CampaignArchivedError` and its three phase-gate siblings carry `status =
409`, which `index.ts`'s `errorMiddleware` reads, so a new route can call it bare with no
try/catch. Four routes were missing this guard for multiple releases and every test passed
throughout, because none exercised them against an archived campaign.

Declining an invite is the one deliberate exception, and the reasoning sits at the call site —
an unexplained missing guard is indistinguishable from the four real omissions.

Character creation is gated to `PartyCreation` and starting Combat to `Playing`. Before gating a
*new* route on `Phase`, decide deliberately whether blocking legacy campaigns (which default to
`PartyCreation`) is actually wanted. It usually isn't.

→ [`docs/architecture/campaign-lifecycle.md`](docs/architecture/campaign-lifecycle.md)

## Bond mutations happen inside the row lock

Bonds are the one place with real concurrency risk. `withBondLock()` opens a direct `pg` connection
and holds `SELECT ... FOR UPDATE` across read and write — everything else in the server goes
through `supabase-js`, which cannot hold a lock. Mutate inside the callback and **throw** to abort
and roll back; do not return an error value.

This path has never been runtime-verified against live Postgres — the sandboxes this project is
developed in have no raw TCP egress. Don't claim to have verified it from one.

→ [`docs/architecture/party-and-bond.md`](docs/architecture/party-and-bond.md)

## 44×44 touch targets, and 16px text inputs

Every `button, a, input, select, textarea` must hold its own 44×44 non-overlapping hit area on a
touch viewport — enforced by the responsive smoke test, so a regression fails CI rather than being
noticed visually. Any control the user types into must be at least 16px (`--fs-input`) on a coarse
pointer, or iOS Safari zooms the page.

The 16px rule is **not new and was never broken** — it has been in `layout.css` since PR #68.
`0.40.0` shipped a second copy of it and described it as a newly-found iOS bug; it was not.
Grep for a rule before concluding it doesn't exist. This project has nearly rebuilt already-shipped
features twice that way.

→ [`docs/architecture/frontend.md`](docs/architecture/frontend.md)

## Use the tokens — colour, type scale, spacing scale

`apps/web/src/styles/tokens.css` defines the palette, `--fs-*` (11/12/13/15/18/23), `--track-*` and
`--sp-*` (4/8/12/16/20/28). There are **zero literal px font-sizes left** in any `.module.css` under
`apps/web/src`; a new one should be a deliberate, commented exception. A token must be defined in
**every** appearance, never only the one being worked on.

→ [`docs/architecture/frontend.md`](docs/architecture/frontend.md), [`docs/architecture/appearances.md`](docs/architecture/appearances.md)

## Three ways a release silently fails to ship

Each of these has actually happened, more than once:

- **A merged PR with green CI is not a shipped change.** Render auto-deploys `main`, but a *failed*
  deploy leaves the previous build serving — so the site answers 200, CI is green, and the new code
  is running nowhere. Confirm the top deploy matches the merge commit with `status: live`.
  `/api/health` cannot tell you; the old build answers it just as happily.
- **A merged migration has not been applied.** Nothing in `render.yaml` runs `supabase db push`,
  and never has. Apply it and confirm with `list_migrations`. This has caused three incidents, one
  an 8+ hour production outage of a shipped feature.
- **A `seedLibrary.ts` change never reaches production on its own.** `runSeedIfEmpty()` skips a
  library that already exists, and a stale library degrades *silently* into wrong gameplay math.
  Reset it from Content Admin → Data → "Reset to seed".

→ [`docs/operations.md`](docs/operations.md), and the `release-reliability-checklist` skill.

## The wire contract

`packages/shared/src/types.ts` is the wire contract. Keep shapes stable and **add** fields rather
than renaming them — JSONB columns store these shapes verbatim. Both server and web import this
package from its built `dist`, not source, so rebuild it after editing.

---

# Workspace layout

npm workspaces monorepo: `apps/*` + `packages/*`, one synchronized version across all four
`package.json` files (root, `@asohav/server`, `@asohav/web`, `@asohav/shared`) — see the versioning
policy at the top of `CHANGELOG.md` for what counts as MAJOR/MINOR/PATCH pre-1.0. Bump all four
together, add a CHANGELOG entry, tag the merge commit `vX.Y.Z`.

- **`packages/shared`** — the data model (`src/types.ts`), pure business logic (`src/logic.ts`,
  `src/engine.ts`, `src/combat.ts`, `src/clocks.ts`, `src/glossary.ts`), seeded library content and
  demo campaign (`src/seedLibrary.ts`, `src/seedPlay.ts`), the admin schema (`src/schema.ts`), and
  the `api.ts` request/response shapes. Imported from `dist` — rebuild after editing
  (`npm run dev -w @asohav/shared` watches).
- **`apps/server`** — Express + TypeScript. Route handlers in `src/routes/*.ts`, one file per
  resource, mounted in `src/index.ts`. `src/repo.ts` is the only place that talks to
  Postgres/Supabase; `src/auth.ts` attaches `req.user` from a Supabase Auth bearer token and
  provides `requireAuth`/`requireAdmin`.
- **`apps/web`** — Vite + React 19 + TypeScript. Routed pages in `src/pages/`, feature panels by
  surface in `src/features/{admin,campaign,sheet,combat,clocks}/`, hooks and the API client in
  `src/lib/`. No global app state store beyond small zustand stores for pure UI state; all server
  state lives in TanStack Query's cache.
- **`supabase/migrations`** — numbered SQL migrations. `0001_init.sql` carries the schema design
  notes (RLS strategy, JSONB rationale) at its top — read it before touching schema.

---

# Working conventions

- **Author docs, not just code.** `README.md`, `CHANGELOG.md`, `HANDOFF.md` and `docs/` are
  actively maintained. When you make a nontrivial change or a judgment call on ambiguous source
  material, add a line to the relevant doc rather than leaving it implicit in a commit message. A
  judgment call goes in `docs/decisions.md`.
- **Five project-authored skills automate conventions documented here**, and cite them by name:
  `theme-tokens` (token reuse), `responsive-device-qa` (the smoke test plus a breakpoint-math
  review), `perf-budget` (latency-risk patterns), `release-reliability-checklist` (the pre-merge
  gate, the version/CHANGELOG/tag policy, and the post-merge step 5 above), and `steward`
  (driving a PR to merged-and-actually-deployed: the six check-run names and the `responsive` gate
  job, the three ways branch protection has silently blocked a green PR here, and what is never a
  flake). If you change a section in a way that invalidates what its skill says, update the skill
  too. They live in `.agents/skills/<name>/SKILL.md`; `.claude/skills/` holds symlinks to them —
  **`steward` is read by the PR-watching rules at its `.claude/skills/` path, so that symlink is
  load-bearing, not cosmetic.** The other five installed skills are vendored and carry their own
  external conventions.
- **What's deliberately not built** — dice rolling, Bond-proposal expiry, generalized
  cross-character Status targeting, Hero Moves (cut, not deferred — Playbooks aren't part of the
  game's systems at all), and a rendered Combat grid. Don't treat these as bugs or TODOs unless
  asked to actually build them. → [`docs/not-built.md`](docs/not-built.md)
- **Virtue scores and Theme are read-only on the sheet.** They are chosen once at character
  creation; afterwards a Virtue changes only via the "Raise a Virtue by 1" Advancement and Theme
  only via "Change your Theme", both in `AdvancementPicker.tsx` — the only place that should mutate
  `sheet.Virtues[].Score` or `sheet.Theme` outside a raw import. Don't add a stepper or `<select>`
  back onto `VirtuesPanel`/`ThemePanel` without checking it was actually asked for; it was a direct
  repo-owner request, not an oversight.
- **There is no post-creation edit route for any `Character` field.** `Name` has been
  write-once since character creation shipped. Adding one needs an explicit ask.
- **If you extend character creation, validate new fields server-side** in
  `apps/server/src/routes/characters.ts` against the library, not just client-side — that route has
  no other authorization layer to catch a missing check. The shared zod schema factory
  `characterCreationSchema(library)` is called by both sides for exactly this reason.
