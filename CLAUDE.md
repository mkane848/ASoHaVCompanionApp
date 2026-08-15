# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ASoHaV Companion App — the player-facing digital toolset for *A Story of Heroes and Villains*, a
Powered-by-the-Apocalypse tabletop game. Three surfaces in one app: the player **Character
Sheet** (now backed by a real rules engine as of `0.13.0` — roll-modifier breakdowns, Status
give/heal/Resist, the Subdued chain — see "Architecture: the rules engine" below; extended in
`0.18.0` with Wealth/Treasure resources, an informational Advantage/Disadvantage roll flag, and
the End the Session Rapport/Hold flow — see "Architecture: Wealth, Treasure, Advantage, and End the
Session"), the designers' **Content Admin** panel (library CRUD, validation, changelog, user
account management, and cross-campaign Play Data deletion as of `0.8.0`), and the **Campaign
Shell** (roster, invite send/accept/decline, a GM-controlled campaign-setup phase — Signup → Party
Creation → Playing, as of `0.12.0` — character creation, GM live-peek, the Bond handshake, GM-only
campaign archiving as of `0.11.0`, and a live **Combat** Encounter view as of `0.14.0`–`0.16.0` —
see "Architecture: Combat" below). A full codebase/rules/schema audit in `0.17.0`–`0.18.0` fixed
several gaps between the shipped code and `Planning Docs/` that had gone unnoticed for multiple
versions — see `HANDOFF.md`'s twenty-second/twenty-third session notes before assuming a stale
rules doc mismatch is new. A separate engineering-quality audit in `0.19.0`, run against all six
Claude Code skills installed in the repo rather than against `Planning Docs/`, fixed a different
class of gap — design-token drift, an N+1-shaped hot route, missing modal/heading/label
accessibility, an unsplit bundle, and a boolean-prop-matrix component — see `HANDOFF.md`'s
twenty-fifth session notes and the `0.19.0` `CHANGELOG.md` entry for the full list. A mobile-
device UI cleanup pass in `0.25.0`, driven by direct repo-owner testing feedback rather than an
audit, added the `.action-grid` layout primitive (see "Frontend conventions" below), a player-
facing **Glossary drawer** reachable from both the sheet and the Campaign Shell, and a real fix
for a tooltip-nesting bug — see "Architecture: the rules engine" below for the glossary depth-cap
details and `HANDOFF.md`'s corresponding session note. A switchable **appearance** system landed in
`0.26.0` — Parchment (the original look, still the default) and a second, dark **Notice Board**
appearance built on a papers-pinned-to-a-corkboard metaphor for the sheet's tag collections, with
its own self-hosted display/body typefaces — and the parchment-damage overlay was deleted entirely,
from both appearances, in the same pass. See "Architecture: appearances" below and
`AppThemeGuidelines.md` for the full reasoning, including two deliberate, dated reversals of that
document's own prior "no wood grain, no drop shadows pretending to be a physical object" principle,
scoped to Notice Board only. Built from a
static-prototype design handoff in `Planning Docs/` — when
in doubt about intended behavior, that's the source of truth, and judgment calls made where the
handoff was ambiguous or contradictory are documented in
`README.md#architecture-notes--judgment-calls`. A large, messier working design doc also exists in
`Planning Docs/` (see "Architecture: the rules engine" below for how it was reconciled) — parts of
it are outdated drafts or unrelated
brainstorming, not all of it is current design.

Read `README.md` and `HANDOFF.md` before starting nontrivial work — `HANDOFF.md` in particular
lists open issues and in-flight threads from the last session; check it so you don't duplicate a
fix or lose track of something already flagged.

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
```

Unit tests (`vitest`, added `0.7.0`) live next to the code they cover (`*.test.ts`) in
`packages/shared` and `apps/server` — pure logic and route-level authorization only; there's no
live-database integration testing (see "Sandbox network constraints" below for why). `apps/web`
has no vitest suite of its own; the Playwright responsive smoke test is its only automated
coverage. `npm run test` builds `@asohav/shared` first since `apps/server`'s tests import it from
`dist`. `apps/server`'s `vitest.config.ts` stubs `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` —
`src/supabase.ts` throws at import time without them, and `../auth.js` (unmocked in route tests,
for `requireAuth`) pulls it in regardless of whether a given test mocks `../repo.js`.

CI (`.github/workflows/ci.yml`) runs `typecheck`, `build`, `test`, and `responsive` as four
separate jobs. `@asohav/shared` must be built (`npm run build -w @asohav/shared`) before anything
that imports it from `dist` (typecheck/build/test handle this automatically; the CI `responsive`
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
equivalent via `npx playwright install chromium` in a normal (non-sandboxed) runner. The seven-
viewport × fifteen-route matrix runs ~12–14 minutes in this sandbox — `SMOKE_ROUTE=`/
`SMOKE_VIEWPORT=` env vars (substring match, case-insensitive) narrow it to one route/viewport
while iterating on a single risky change, e.g. `SMOKE_ROUTE="character sheet" SMOKE_VIEWPORT=768
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:responsive -w @asohav/web`. Both scripts share
their route/viewport list and Vite-harness bootstrap via `apps/web/scripts/harnessConfig.mjs`
rather than keeping two copies that could drift.

**Screenshot script** (`apps/web/scripts/screenshot.mjs`, added `0.24.0`): the smoke test asserts
overflow/touch-target/overlap/errors, none of which catch "this panel is wasting a lot of
horizontal space" — a narrow content column on a huge monitor passes every check. Reuses the same
harness/viewport machinery to write a PNG per route per viewport to `apps/web/.screenshots/`
(gitignored, regenerated every run — not a fixture) — `npm run screenshot -w @asohav/web`, with the
same `SCREENSHOT_ROUTE=`/`SCREENSHOT_VIEWPORT=` filters. Needs no network (local Vite server, local
Chromium, seed fixtures), so — unlike live browser QA — it works from this same locked-down
sandbox; the one caveat is `harness.html` pulling Cormorant Garamond/Lora from Google Fonts, which
a sandboxed proxy typically blocks, so screenshots render in fallback serif — representative for
layout/spacing, not for typography.

**Note:** `main` has no branch protection requiring CI to pass before merge (see `HANDOFF.md`
item 7) — don't treat a green local run as optional just because a red PR *could* merge.

## Workspace layout

npm workspaces monorepo: `apps/*` + `packages/*`, one synchronized version across all four
`package.json` files (root, `@asohav/server`, `@asohav/web`, `@asohav/shared`) — see the
versioning policy at the top of `CHANGELOG.md` for what counts as MAJOR/MINOR/PATCH pre-1.0.
Bump all four together, add a CHANGELOG entry, tag the merge commit `vX.Y.Z`.

- **`packages/shared`** — the reconciled data model (`src/types.ts`), pure business logic
  (`src/logic.ts`: load capacity, the Bond handshake resolution; `src/engine.ts`,
  added `0.13.0`: roll-modifier breakdowns, Resist Rolls, the Status give/heal/Subdued engine;
  `src/combat.ts`, added `0.14.0`–`0.16.0`: Range bands, Toughness, Enemy Limits, Gambits;
  `src/glossary.ts`: glossary term matching/linking, see "Frontend conventions" below), seeded
  library content and demo campaign (`src/seedLibrary.ts`, `src/seedPlay.ts`, ported from the
  handoff's `library.js`/`store.js`), admin schema (`src/schema.ts`), and the `api.ts`
  request/response shapes. **Both server and web import this from its built `dist`, not source**
  — rebuild it after editing (`npm run dev -w @asohav/shared` watches; `npm run build -w
  @asohav/shared` for a one-shot). `src/types.ts` is explicitly documented as the wire contract:
  keep shapes stable, add fields rather than renaming them, since JSONB columns in Postgres store
  these shapes verbatim.
- **`apps/server`** — Express + TypeScript. Route handlers in `src/routes/*.ts`, one file per
  resource (`auth`, `library`, `campaign`, `sheet`, `party`, `bond`, `characters`, `invites`,
  `admin`, `combat` — the last one added `0.14.0` for Encounter start/update/end), mounted in
  `src/index.ts`. `src/repo.ts` is the only place that talks to Postgres/Supabase; `src/auth.ts`
  attaches `req.user` from a Supabase Auth bearer token and provides `requireAuth`/`requireAdmin`
  middleware.
- **`apps/web`** — Vite + React 19 + TypeScript. Routed pages in `src/pages/`, feature panels
  grouped by surface in `src/features/{admin,campaign,sheet,combat}/` (`combat/` added `0.14.0`:
  `EncounterView.tsx` plus its modals), data-fetching hooks and the API client in `src/lib/`. No
  global app state store beyond two small zustand stores for pure UI state
  (`src/store/panelCollapseStore.ts`, `adminUiStore.ts`, `sheetUiStore.ts`) — all server state
  lives in TanStack Query's cache.
- **`supabase/migrations`** — numbered SQL migrations, applied in order to the Supabase Postgres
  project. `0001_init.sql` has the schema design notes (RLS strategy, JSONB shape rationale) at
  its top — read it before touching schema. `0010_combat_encounters.sql` (`0.14.0`) is the first
  new table since `0009` — everything between them was JSONB-field additions needing no migration.

## Architecture: authorization is in the Express layer, not RLS

This is the single most important thing to know before touching data access. Every table has RLS
enabled (Supabase auto-exposes tables over PostgREST to the anon key otherwise), but **only
`SELECT` policies exist** for the `authenticated` role. All INSERT/UPDATE/DELETE goes through
`apps/server/src/repo.ts`, which uses the Supabase **service-role key** (bypasses RLS entirely) —
business rules (membership checks, GM-only actions, admin-only library writes, Bond handshake
rules) are enforced in the Express route handlers, not in Postgres policies. Don't add new
mutating routes that assume RLS is doing authorization for you; check `req.user` /
`membershipFor()` explicitly, following the pattern in `apps/server/src/routes/bond.ts`.

The SELECT policies exist for a second reason beyond direct anon reads: they scope what
**Supabase Realtime** delivers. There is no server-side broadcast/WebSocket layer — the client's
`useLiveCampaign` hook (`apps/web/src/lib/useLiveCampaign.ts`) subscribes directly to
`postgres_changes` on `party`/`bonds`/`character_sheets` (filtered by `campaign_id`) and `library`
(global), and Realtime evaluates each table's SELECT policy per subscribing client — so a player
only receives events for campaigns/sheets they can already see, for free, using the same
authorization the REST routes enforce. If you add a new play-state table that should sync live,
give it a `campaign_id` column and a matching SELECT policy (see migration `0005` for why
`character_sheets` needed one retrofitted — Realtime's `filter` only supports equality on a
column, so the table needs the FK to filter on even if it's otherwise reached via
`character_id`).

A second, easy-to-miss Realtime constraint: **the SELECT policy itself also needs to be joinless**,
not just the subscription filter. Realtime's `postgres_changes` authorization check does not
reliably evaluate an RLS policy whose `USING` clause joins out to another table (an inline
`exists (select ... from other_table ...)`) — `party`/`bonds` never hit this because their policies
were always a single `private.is_campaign_member(campaign_id, uid)` call over a column already on
the row, but `character_sheets`' policy kept an inline join to `characters` even after `0005` added
`campaign_id` directly to the row, and this caused GM live-peek to intermittently miss a just-marked
Condition until some later sheet write happened to deliver (fixed in migration `0006` with
`private.can_view_sheet(campaign_id, character_id, user_id)`, a joinless function-call policy in
the same shape as `is_campaign_member`/`is_gm`). If you add a Realtime-synced table whose SELECT
policy needs to check anything beyond a plain campaign-membership match, wrap the check in a
`private.*` SECURITY DEFINER function called with columns already on the row — never write the
join inline in the policy body.

## Architecture: the Bond handshake and row locking

Bonds (`propose` → `accept`/`reject`) are the one place with real concurrency risk (two players
racing to accept/reject the same pending change). `withBondLock()` in `apps/server/src/repo.ts`
opens a **direct `pg` connection** (`apps/server/src/pgPool.ts`, via `DATABASE_URL`) and runs
`SELECT ... FOR UPDATE` inside a transaction — deliberately bypassing `supabase-js`/PostgREST,
which has no way to hold a lock across a read and a write. Everything else in the server goes
through `supabase-js`. When extending Bond logic, mutate inside the `withBondLock` callback and
throw (don't return an error value) to abort/rollback — see `apps/server/src/routes/bond.ts` for
the `HttpError`-vs-`BondHandshakeError` catch pattern each route handler uses.

**This code path has never been runtime-verified against live Postgres** (see `HANDOFF.md` item
2) — the dev sandboxes this project has been built in so far have no raw TCP egress, only
HTTPS-proxied. Keep that in mind if asked to "verify" Bond concurrency; you likely can't from
inside a similar sandbox (see "Sandbox network constraints" below).

**Mark Kin and Forge Bond are a proposal**, never a direct write — an explicit judgment call
reconciling a disagreement between the two design-handoff prototypes; see
`README.md#architecture-notes--judgment-calls` item 1 before changing this. **Spend Kin is the one
exception**, as of `0.5.0`: it applies immediately with no handshake (`applySpendKin()` in
`packages/shared/src/logic.ts`, called directly from `POST /:bondId/propose` in
`apps/server/src/routes/bond.ts` rather than being staged as a `PendingChange`), since the game's
own rules text draws a real distinction here ("either PC can spend Kin" vs. Forging needing mutual
agreement) that the original all-three-types-identical handshake didn't carry forward — see
`README.md#architecture-notes--judgment-calls` item 7. `withBondLock`'s row lock still serializes
concurrent writes to the same Bond regardless of type, so this doesn't reopen a race condition; it
only drops the *approval* step for this one action. Don't assume all three `BondChangeType`s behave
the same when touching this code.

**A Bond maxed at Level 5 with a full Kin Track locks** (`isBondLocked()`, `0.17.0`) — per
`Advancements.md`: "When you place your 5th Kin at Bond 5, your Bond Level locks and can not be
moved down. You can no longer spend Kin on that track." `applySpendKin()` throws
`BondHandshakeError` once locked instead of silently dropping the Bond back below Level 5; the
`ForgeBond` route guard also refuses a further Forge on an already-locked Bond (forging again would
otherwise reset `KinTrack` to 0 and unlock it). This went unenforced for the entire life of the
Bond handshake until a full-codebase audit caught it — worth remembering that a rule can be
correctly documented in `Advancements.md` and still never make it into the actual `Bond` state
machine if nobody checks the two against each other.

## Architecture: three Advancement tracks — Potential, Kin, Rapport

`AdvancementTrack` (`packages/shared/src/types.ts`) has three values, matching
`Planning Docs/Advancements.md`'s three parallel Advancement categories: **Potential** (Personal,
scoped to one character), **Kin** (Social, scoped to a Bond between two characters), **Rapport**
(Party, scoped to the whole campaign) — see `ADVANCEMENT_TRACK_SCOPE` for that mapping in code.
Only Potential and Rapport have authored library content (`library.advancements`, tiered 1–4,
picked via `AdvancementPicker.tsx` when the relevant track fills) — Kin doesn't, by design: Mark
Kin and Forge Bond are played out live through the Bond handshake (see above), and Forging stays
a freeform "write it together" move on `Bond.BondMoves` rather than a pick from a Tier-gated list,
confirmed with the repo owner (`README.md#architecture-notes--judgment-calls` item 8). Don't take
Kin's lack of library content as a sign it isn't a real Advancement track — an earlier session made
exactly that mistake when reorganizing the Content Admin nav (`CHANGELOG.md` 0.5.0), which is why
Content Admin's Advancements group now has three nav entries (Kin/Potential/Rapport, alphabetical)
instead of two: `KinAdvancementView.tsx` for Kin (explanatory, no CRUD — a permanent home for
whatever Kin-specific content or rules land later) and `AdminListPane`-backed CRUD screens,
filtered by `Track`, for Potential/Rapport (`AdminNav.tsx`'s `ADVANCEMENT_TRACK_VIEWS` only maps
the latter two, on purpose — see the comment there before adding Kin to that map).

## Architecture: the rules engine — modifier transparency, not dice simulation

`packages/shared/src/engine.ts` (added `0.13.0`) is the start of the actual game engine: dice-roll
modifier breakdowns and mechanical-effect application for Moves, Statuses, and Conditions.
**This app never rolls dice for the player, by explicit product decision** (confirmed directly
with the repo owner, not assumed) — `computeRollBreakdown()` returns 2d6 + Virtue's `Total`, itemized
in `Sources` (base score, Condition penalty, any `Permanent`-duration Ability `RollBonus` effect),
so the player knows what to roll and why. **As of `0.20.0`, the highest helpful/hindering Status is
deliberately *not* folded into `Total`** — it's returned separately as `StatusSources`. An earlier
version summed it into `Total`, which read as if a Status swing *were* the named Virtue's own
modifier (a real repo-owner-reported bug, not a style preference — "Roll 2d6 + Heart: +5" implied
Heart itself was +5 when it was actually +1, with the rest coming from a Status). UI call sites
render `Sources` as the headline total and `StatusSources` as a clearly separate "also affecting
this roll" list — see `MoveRollHelper.tsx`/`CombatMoveModal.tsx`. Ability `RollBonus` effects with
any other `Duration` depend on a fictional trigger this engine can't evaluate
(`AbilityEffect.TriggerText` is free text) —
`conditionalRollBonuses()` surfaces those separately rather than silently guessing whether they
apply. Once a roll happens at the table and the player reports which tier they hit (or, for a
formula like Healing a Status's "1d6 + Mettle," the d6 they rolled), the engine applies the
resulting mechanical change — that's the actual "engine" part. Don't add real randomness
(`Math.random()`, a dice library, anything non-deterministic) to this module or its callers
without checking this decision with the repo owner first; it's a settled call, not an oversight.

Statuses are the game's damage/HP system, not a separate stat — a Negative Status reaching
`GameSettings.StatusMaxRank` (default 6) triggers **Subdued** (`StatusesPanel.tsx`'s
`SubduedModal`) instead of just sitting at "Rank 6": the player chooses Take a Scar, Risk Death
(`resolveRiskDeath()`), or Blaze of Glory. `giveStatus()`/`healStatus()`/`applyOpposingStatus()`
are the three ways a `CharacterStatus[]` array changes; all are pure functions over the array, not
tied to `commit()` — see `StatusesPanel.tsx` for how they're wired into a sheet mutation.
`CharacterSheet.Recoveries` (refills to `GameSettings.RecoveriesMax` at Make Camp) is spent
1-for-1 to heal a Status; `CharacterSheet.Scars` is free-text, populated only through the Subdued
flow. See `README.md#architecture-notes--judgment-calls` items 12-13 for the reconciliation
decisions behind this (the doc's "Crumble" mechanic folded into the already-shipped "Dishonored,"
which Combat draft is canonical for whenever Combat gets its own slice) and `HANDOFF.md` for the
list of design questions the doc leaves unresolved that this slice deliberately didn't guess at.

**Adding a new required field to `CharacterSheet` needs a read-time default, not just a type
change.** `Recoveries`/`Scars` shipped in `0.13.0` with no backfill for sheets already saved to
Postgres — an old sheet's JSONB blob has no such keys, so they deserialize as `undefined`, and an
unguarded read (`sheet.Scars.length`, etc.) crashes on render. Fixed in `0.16.1` with
`normalizeSheet()` (`packages/shared/src/logic.ts`), called from `apps/server/src/repo.ts`'s
`getSheet()` on every read — the same self-heal-on-read pattern `campaign.ts`'s bootstrap route
already uses for a missing `Party` row. If you add another required field to `CharacterSheet` (or
any other JSONB-blob type with rows already live in Postgres — `Party`, `Bond`, `Library`), extend
`normalizeSheet()` (or add its equivalent) rather than trusting the TypeScript type to guarantee
the field is actually present on data written before the field existed.

**This rule wasn't actually followed for `Library` until a `0.17.0` audit caught it.** Every
`GameSettings` field added across `0.13.0`/`0.14.0` (`SkillsAtCreation`, `AdvancementTier2At`/
`3At`/`4At`, `RecoveriesMax`) plus `0.9.0`'s `glossary` and `0.14.0`'s `enemies` had no read-time
default, and the live project's `library` singleton predated all of them — silently breaking real
gameplay math (0 Recoveries on new characters, an unenforced Skill-count cap, Advancement Tiers
stuck at 1 forever) rather than crashing, which is *why* it went unnoticed for four versions: no
error ever pointed back to the cause. Fixed with `normalizeLibrary()` (`packages/shared/src/
logic.ts`, unit tested), called from `repo.ts`'s `getLibrary()`, same shape as `normalizeSheet()`.
`Party` and `Bond` haven't needed this yet, but the same audit is a good reminder to actually check
next time either of them gains a required field, rather than assuming the pattern was followed.

## Architecture: Combat — track-and-display, per-Status Enemy Limits, no grid

The live Encounter view is against the doc's Combat Basics V2.2 draft (the most recent of three
competing drafts — see `README.md#architecture-notes--judgment-calls` item 12). Confirmed with the
repo owner before building: **track-and-display, not enforcement** — the app shows whose turn it
is, AP remaining, Range, and Statuses live to everyone, but never blocks an action; the GM can
always override. `Encounter`/`CombatParticipant` (`packages/shared/src/types.ts`) are new
play-state, backed by a `combat_encounters` table (migration `0010`, same joinless-RLS-policy
shape as `party`/`bonds`/`character_sheets` — see the Realtime section above) — the first new
table since the campaign-setup work, everything before this was JSONB-field additions.

**Combat is no longer its own screen, as of `0.23.0`.** Repo-owner testing feedback was that
leaving Combat behind a separate `/combat` link cost a click and a full page transition mid-fight,
when the rest of a session lives on the Campaign Shell page. `CombatPanel.tsx`
(`apps/web/src/features/combat/`) holds the actual Encounter view — start-form, `EncounterView`,
all the modals — extracted from what used to be `CombatPage.tsx`'s entire body. `CampaignPage.tsx`
now renders `CombatPanel` inline in **both** `GmView` and `PlayerView` (players are the ones who
apply Status offers and Interpose, so a GM-only section would strand them — confirmed with the
repo owner rather than assumed), imported via `React.lazy` from both call sites to preserve the
`0.19.0` code-split: eagerly importing `EncounterView` and its modals from `CampaignPage`, which
every player loads, would have undone that bundle win. The GM's view always renders the lazy
panel, since a GM always needs the start-Encounter form regardless of whether one is running; a
player's view only triggers the lazy import once `boot.encounter` is non-null, otherwise a plain
`<p>No Combat right now.</p>` with no import at all. `CombatPage.tsx` still exists at
`/c/:campaignId/combat` — now a thin wrapper around the same lazy `CombatPanel` — kept alive
deliberately as a working deep link, not left over by accident.

**Range is theater-of-the-mind bands** (`CombatRange`: Melee/Close/Far/VeryFar/OutOfRange), not a
rendered grid — a real map is out of scope for this app (confirmed with the repo owner), not an
oversight. The doc's Maneuver ("up to 6 squares")/Shift ("up to 2 squares") distinction doesn't
translate cleanly to bands; `shiftRange()` in `packages/shared/src/combat.ts` is a deliberate
simplification (documented there, not silently invented) and the UI only exposes one generic
1-band-per-AP reposition control, not separate Maneuver/Shift buttons — revisit if that split
turns out to matter in play.

**PCs keep one source of truth for their own Statuses: their own `CharacterSheet`.**
`CombatParticipant.Statuses`/`Toughness`/`StatusLimits` are Enemy-only fields — a PC participant
is a thin pointer (`RefId` = `CharacterId`) at data that already lives on their sheet. This
collides with the sheet's existing owner-only write rule (`sheet.ts`'s PUT: only
`membership.CharacterId === characterId` may save it — not even the GM), which matters a lot in
Combat: an Enemy's attack can't write a Status directly onto the PC it's hitting. The fix is
`Encounter.PendingStatusOffers` — anyone can create one (it's just an Encounter field), but only
the target's own player can fulfill it, from their own participant card, optionally Resisting
first (`resistRollReduction()`, same formula as everywhere else) before it lands on their sheet
via `useCommitSheet`. Don't try to have the GM write a PC's Statuses directly if you extend this;
route it through a `PendingStatusOffer` instead.

**Enemies are defeated per-Status, not by one shared pool**: `isEnemyDefeated()` checks each of an
Enemy's `StatusLimits` independently — reaching *any one* Limit (e.g. `Hurt 4`) defeats it, even if
every other tracked Status is still low. `Toughness` (`applyToughness()`) blunts what an Enemy
takes: Medium is a flat −2 to the incoming Rank (floored at 1), Heavy re-derives the Rank as if
the roll had landed one tier lower — both per the doc's own wording.

**Enemy authoring is ad-hoc-first with an optional save to a reusable library** (confirmed with
the repo owner over the "ad-hoc only" vs "full library" fork): `AddParticipantModal.tsx` lets a
GM spawn an Enemy purely ad-hoc (nothing persists) or from `library.enemies`
(`EnemyTemplate`, real Content Admin CRUD, generic schema-driven like every other collection) —
and an ad-hoc one can be checked to save itself to the library on the way in, so the GM never has
to author monsters in a separate screen mid-session if they don't want to.

**Gambits (`0.15.0`) attach to an Engage roll, PC actor only** — their cost is marking a
Condition, which only PCs have, so the `CombatMoveModal`'s Gambit picker only appears when
`actorSheet` is non-null (i.e. the viewer is the acting PC; an Enemy's Engage never offers them).
`gambitConditionCost()` (`packages/shared/src/combat.ts`) encodes the doc's cost rule: 1 Condition
per Gambit on a 10+ (the first free if the roll was exactly 12+, reported via a checkbox — this
app doesn't simulate dice, see the engine note above), one Gambit only on a 7-9, costing 2
Conditions. Of the nine Gambits (`GAMBITS`), **six reduce cleanly to the existing Status/Range
primitives and are fully automated** (Bolster: +1 to the Rank the roll already gives; Press: shift
2 Range bands free; Halt/Impede: a second Rank-2 hindering Status on the target; Calculate/Brace:
a Rank-1 helpful Status — Focused/Braced — on the actor, which then naturally shows up as the
"highest helpful Status" in future roll breakdowns, no separate buff-tracking system needed).
**Repel, Seize, and Other are logged to `Encounter.History` only** — their effects (an exact push
distance, "take something," anything freeform) are a table call, not something to invent a formula
for; see `EncounterView.tsx`'s `applyGambits()` before changing this split.

**Dishonored's Combat effect (Vulnerable 4) is real as of `0.17.0`**, not the "once it's built"
placeholder its own glossary text promised for four versions. `applyDishonoredVulnerable()`
(`packages/shared/src/combat.ts`) grants a flat Rank-4 negative "Vulnerable" Status the moment a
PC's Condition mark inside `EncounterView.tsx`'s `applyGambits()` — the only place Combat currently
marks a Condition — pushes them into Dishonored (all five Conditions marked), reusing `giveStatus()`
rather than a new mechanic, same pattern as Calculate/Brace. It only fires once, at the
false-to-true transition, so it doesn't re-stack on every later Gambit paid for while already
Dishonored. **Deliberately scoped narrower than "whenever a PC is Dishonored in Combat," and
flagged here as a judgment call worth revisiting, not a settled edge case**: a PC who enters an
Encounter already Dishonored, or who becomes Dishonored some other way while an Encounter is merely
open in the background, does not get this applied retroactively — there's currently no other
in-Combat path that marks a Condition to hook into. Revisit this scoping if a wider set of
in-Combat Condition-marking triggers gets built later (e.g. a Combat Move that costs a Condition
outside the Gambit system).

**All five Reaction Moves are now wired up** (`0.16.0`), the last two with a shared theme: neither
needed a new mechanic, just reuse of existing ones off-turn. **Opportunity Attack** is literally
`CombatMoveModal`'s Engage-in-Melee flow (roll breakdown, tier, even Gambits) triggered from a
standalone "Reactions" button rather than from the acting participant's own card, with a `free`
flag on the `engaging` state that skips the AP deduction both `applyToEnemy`/`offerToPC` normally
do. It's manually triggered, not auto-detected — this app already collapsed Maneuver/Shift into
one generic Reposition (no distinct "which move did the enemy use to leave" signal to react to),
so whether the fictional trigger happened is a table judgment call, same as everywhere else in
Combat. **Interpose** redirects an existing `PendingStatusOffer` to the interposer instead of
creating a new one — sets `Resistable: false` (the doc is explicit interposing can't be Resisted)
and does a real Range swap between the two participants ("swap into their space"). Both are
PC-only, same reasoning as Gambits: their trigger conditions (an ally in `PendingStatusOffers`, an
Enemy at Melee range) only make sense from a PC's-eye view of the fight.

**Deliberately not built this slice, real scope for later, not oversights** — see `HANDOFF.md`
for the fuller list:
- Hero Moves — blocked on Playbooks not existing as a concept yet; the doc itself has these as an
  unfinished brainstorm, not a spec.
- A rendered grid, and the Maneuver/Shift distinction noted above.

**`ParticipantCard.tsx` is three explicit variants, not one component with a boolean matrix
(`0.19.0`).** It used to take 6 boolean props (`canControl`, `canEngage`, `isOwnPC`,
`canRecuperate`, `canDefend`, `canHelp`) to render what were always one of three fixed
combinations — the tell was `EncounterView.tsx`'s enemy call site passing three literal no-op
handlers (`onRecuperate`/`onDefend`/`onHelp={() => {}}`) purely to satisfy the shared prop type.
Only `canControl` turned out to be a genuinely orthogonal permission (true for both an own-PC card
and an enemy card, varying per viewer for both); the other five collapsed into exactly which of
`OwnPCCard`/`AllyPCCard`/`EnemyCard` a card is — a shared, unexported `ParticipantCardShell` in the
same file holds the actually-common chrome (name/badges, Range/AP stepper, Statuses, the
remove-confirm flow), and each variant supplies its own action buttons as plain children rather
than a render prop, since none of them need anything from the shell beyond what they already have
via `participant`. `EncounterView.tsx`'s Party section picks `OwnPCCard` vs `AllyPCCard` per
participant based on `p.RefId === myCharacterId`; Enemies always render `EnemyCard`, with Engage
gated on the same `canControl` flag rather than a separate `canEngage` prop (they were always the
same value, `isGM`). If Combat ever needs a fourth kind of card, extend this pattern — a new
variant plus whatever the shell needs to expose — rather than reintroducing a boolean-matrix
component.

## Architecture: Wealth, Treasure, Advantage, and End the Session (`0.18.0`)

`0.17.0`'s full-codebase audit found several doc-described mechanics with zero representation in
code (see `HANDOFF.md` Open issue 12's "Track B" list). `0.18.0` built the ones that were
unambiguous once scoped with the repo owner; a couple of related pieces are still deliberately
deferred — see below.

**`CharacterSheet.Wealth`/`Treasure` are per-character numbers, not a shared party pool.** Every
doc mention of either (Follow a Lead, Enjoy Downtime's Rest/Acquire/Train/Carouse, refreshing Gear
Charges "at a Merchant") reads as a personal spend ("you may spend 1 Wealth..."), unlike Rapport,
which is explicitly the party's shared track. The doc never describes how a player *gains* either
— per the repo owner, that's deliberately unresolved for now ("we'll decide if we want to reward it
as a GM-side action later"), so both are just a freely player/GM-adjusted `+`/`−` stepper on the
sheet (`StatusesPanel.tsx`), with no automated earn or spend hook anywhere else. Don't wire a
"spend Wealth for Advantage" button into `m-lead`'s Move text or similar — there's no per-Move
custom-action system in this app (Moves are reference text plus the generic roll breakdown), and
inventing one for a single Move would be new scope, not a small addition.

**Advantage/Disadvantage are purely informational, and — as of `0.20.0` — not even a control.**
`0.18.0` shipped this as `AdvantageToggle.tsx`, an interactive Normal/Advantage/Disadvantage
segmented control repeated at both render sites. The repo owner reported this as over-built for
what's actually a per-roll table judgment call the app has no way to track (same reasoning that
already governs conditional Ability `RollBonus` effects) — there's nothing to "toggle" here, only
something to explain. Replaced with a static `InfoTooltip`/`TooltipSection` (the same tap-to-reveal
component used everywhere else for reference text, e.g. `VirtuesPanel.tsx`'s Virtue tooltips)
explaining what Advantage/Disadvantage mean (roll 3d6, keep the best/worst two) and that they're a
GM call, not something this app detects. `AdvantageToggle.tsx`/`AdvantageState` are gone entirely —
no replacement component, just an `InfoTooltip` call inline at each of the two sites
(`MoveRollHelper.tsx`, `CombatMoveModal.tsx`), still duplicated rather than shared for the same
reason as before (no single shared roll-breakdown-rendering component exists to hook a shared
version into).

**`EndSessionModal.tsx` doesn't author or count Playbook-specific questions** — this app has no
Playbook system yet (blocking Hero Moves too, see above), so the doc's example "did we uncover
something new" / "did you have a notable moment" questions aren't modeled as data. The table
answers them out loud; the modal only asks how many hit (0 / 1–2 / 3+ for the party's Rapport
delta, a free-form count for a player's own Hold grant). `CharacterSheet.Hold` is persisted (not
resolved in one sitting) and spent 1-for-1 through four actions: refresh a Gear item's Charges,
clear a Condition, mark Kin (reuses the existing `MarkKinModal`/Bond-propose flow — Hold spending
doesn't bypass the handshake, it just gates *offering* the proposal), or mark Potential (reuses the
existing tier-picker-at-5 pattern from `AdvancementPanel.tsx`).

**Deliberately deferred, not guessed at:**
- **The Level Up/Progress the Party Tier-unlock formula.** The doc gates Tier 2 on "4 Tier-1
  advancements *and* Level 5" — but if Level is (as every other reading implies) just the count of
  Potential/Rapport-funded Advancement picks taken, the two clauses can't both be true at once: a
  4th pick puts you at Level 4, and a 5th pick (still Tier 1, since Tier 2 isn't unlocked yet) makes
  it 5 Tier-1 picks, not 4. This compounds the already-flagged `Advancements.md` Potential-tier
  contradiction (item 12/README item 20). No `Level`/`PartyLevel` field exists; `unlockedTier()`
  still gates purely on count, exactly as it has since `0.13.0`. The Move entries for Level Up and
  Progress the Party were still added (their core "spend 5 Potential/Rapport → advance" mechanic
  isn't in question, it's identical to what already ships) — their text just omits the contested
  compound formula rather than asserting an unresolved rule as settled.
- **Undertake a Journey and Enjoy Downtime have no dedicated UI or library Move entries yet.** Both
  are full multi-step flows (Scout Ahead → Venture Forth with GM-chosen complication lists; five
  distinct Downtime activities) — whether either needs a guided flow beyond generic Move-text
  reference (the way most other Moves already work) wasn't decided before this pass; revisit with
  the repo owner before building either.

## Architecture: campaign archive freeze

A GM can archive their own campaign (`Campaign.Status: 'Active' | 'Archived'`, migration
`0008_campaign_status.sql`, toggled via GM-only `PATCH /api/campaigns/:id/status` in
`apps/server/src/routes/campaign.ts`). Archiving isn't just a label — it also freezes further
play-state mutations on that campaign. `assertCampaignActive()`
(`packages/shared/src/logic.ts`, throws `CampaignArchivedError` → the route catches it and
responds `409`) is called from every mutating route that touches an archived campaign's state:
sending an invite (`campaign.ts`), Bond propose/accept/reject (`bond.ts`'s shared
`requireCampaignPlayer` helper, so all three get it for free), sheet edits (`sheet.ts`), party
edits (`party.ts`), character creation (`characters.ts`), and redeeming an invite to join
(`invites.ts`). Declining an invite is the one deliberate exception — it doesn't commit anything
new to the archived campaign, so it stays allowed. **If you add a new mutating route under
`/api/campaigns/:id/...`, call `assertCampaignActive(campaign)` after loading the campaign and
before writing anything**, following the try/catch-`CampaignArchivedError` pattern already in
every route above — it's easy to add a new mutation and forget this, since (unlike the
Express-layer-authorization pattern above) there's no RLS or middleware layer that would catch
the omission for you.

On the client, `CampaignBonds.tsx` and `AdvancementPanel.tsx` — the two places with Bond
propose/accept/decline/withdraw controls — hide those controls when `campaign.Status ===
'Archived'` rather than leaving them to fail against the server's `409`. Deliberately **not**
extended to every other sheet field (Virtues, Statuses, Load, etc.): those stay visually editable
on an archived campaign and rely on the server-side freeze alone, since a failed save there
already gets the same minimal `console.error`-only handling as any other failed save in this app
— see `CHANGELOG.md` 0.11.0 for the full scoping rationale if extending this further.

## Architecture: campaign setup phases (Signup → Party Creation → Playing)

`Campaign.Phase: 'Signup' | 'PartyCreation' | 'Playing'` (`packages/shared/src/types.ts`,
migration `0009_campaign_phase.sql`, added `0.12.0`) is a **separate field from `Status`**, not an
expanded archive enum — `Status` stays purely the archive/freeze toggle above; a campaign can be
`Archived` at any `Phase`. See `README.md#architecture-notes--judgment-calls` item 10 before
folding these back into one field. `Phase` is optional on the type: always read it through
`campaignPhase(campaign)` (`packages/shared/src/logic.ts`), which defaults a missing value to
`'PartyCreation'` — matching the migration's backfill default for pre-existing rows, so an
already-running campaign keeps letting a newly-invited player create a character rather than being
retroactively locked out by this feature. New campaigns explicitly start at `'Signup'`
(`POST /api/campaigns`).

GM-only `PATCH /api/campaigns/:id/phase` (`apps/server/src/routes/campaign.ts`) moves between
phases; `CAMPAIGN_PHASE_TRANSITIONS` in `logic.ts` only allows Signup→PartyCreation,
PartyCreation→Playing, and PartyCreation→Signup (the GM reopening signup). Nothing auto-advances
`Phase` to `'Playing'` — `partyReadiness(members)` computes a live "N / M ready" readout (Player
memberships only) purely for the GM to look at; starting play is always the GM's own
`PATCH .../phase` call, `ConfirmModal`-gated on the client if not everyone's ready yet, mirroring
the Archive button's existing pattern. `Membership.Ready` (also optional, defaults to `false`) is
set by the player themselves via `PATCH /api/campaigns/:id/ready` and isn't validated against any
real per-player confirmation yet — see the character-creation note below.

Character creation (`POST /api/campaigns/:id/characters`) is the one route actually gated on
`Phase`: `assertPartyCreationPhase(campaign)` 409s outside `'PartyCreation'`. **Invite-sending is
deliberately not phase-gated** — gating it would retroactively block existing/legacy campaigns
(which default to `Phase: 'PartyCreation'`) from inviting new players at all, a real regression;
closing signup only changes what the client shows (the phase button, the chargen route's redirect
guard), not what the invite API accepts. If you add a new phase-aware mutating route, decide
deliberately whether blocking it on old/legacy campaigns (implicit `'PartyCreation'`) is actually
wanted before gating it — it usually isn't, character creation is the one clear exception.

## Data shapes: JSONB blobs keyed by TypeScript

Play-state aggregates — a character's `CharacterSheet`, the campaign's `Party`, each `Bond` — are
stored as single JSONB columns matching `packages/shared/src/types.ts` exactly, not normalized
into columns. The library (game content: virtues, moves, items, abilities, etc.) is one JSONB
singleton row (`library` table, `id='singleton'`). This means most repo functions are thin
`select ... .data` / `upsert({ data: obj })` wrappers — when adding a field, add it to the
TypeScript interface in `packages/shared/src/types.ts` and it flows through without a migration,
*except* when the field needs to be independently queried/filtered (e.g. `campaign_id` on
`character_sheets`, added in migration `0005` specifically so Realtime could filter on it) —
those need a real column plus a migration.

Field naming is PascalCase in TypeScript (`CharacterId`, `UpdatedAt`) but snake_case in Postgres
columns (`character_id`, `updated_at`); the `repo.ts` `map*()` functions do this translation by
hand for row-shaped tables. JSONB blob fields keep their TypeScript PascalCase as-is inside the
JSON.

## Architecture: appearances — a switchable UI look, not a game concept (`0.26.0`)

`WorkPlan-0.26.0.md`, approved by the repo owner before implementation: the app has two
switchable **appearances** — Parchment (the only look before this version, still the default) and
Notice Board (a dark corkboard-and-pinned-paper metaphor). **Always "Appearance," never "Theme"**
in code or UI copy — `CharacterSheet.Theme`/`ThemePanel.tsx`/`library.themes` are an existing game
concept (a character's narrative Theme), and naming the UI concept the same word would make
`grep -rn theme` useless in a repo whose working convention is "read the code before changing it."
See `README.md#architecture-notes--judgment-calls` item 27 for the full naming writeup.

**Three tiers of token**, all defined in both `apps/web/src/styles/tokens.css` (Parchment) and
`apps/web/src/styles/appearances.css` (`:root[data-appearance='noticeboard']`, same `tokens`
cascade layer — its higher selector specificity outranks plain `:root` on the same element with no
separate cascade layer needed):
- **Tier 1** — the existing palette (colors, `--font-display`/`--font-body`). Notice Board's own
  values live entirely in `appearances.css`; `tokens.css` itself only gained an explicit
  `color-scheme` and the new `--ink-on-ground` token (below).
- **Tier 2** — `--ground-texture`/`--panel-texture`, so `base.css` no longer hardcodes the
  parchment gradients directly.
- **Tier 3** — `--board-*`/`--posting-*`/`--pin-*`, consumed by `.board`/`.posting`
  (`apps/web/src/styles/surfaces.css`, `@layer utilities` — the same layer as `.action-grid`/
  `.tap`, so the decoration reliably outranks a component's own rules without `!important`).

**The rule this establishes: a new token is defined in every appearance, never only in the one
being worked on.** A token defined in just one appearance is the new version of the hardcoded
literal `theme-tokens`'s skill already exists to prevent — Notice Board's Tier-3 values are
neutralised (`transparent`/`none`/`0deg`/`0`) under Parchment specifically so a `.board`/`.posting`
element renders exactly as it did before either class existed.

**`.posting`'s background/border/padding are *not* plain unconditional tokens, unlike everything
else here** — see `surfaces.css`'s own comment for the full reasoning. The items it decorates (a
Looks chip, a Load item row, a Status row, …) already have their own component-authored
background/border/padding, and the `utilities` layer already outranks `components` by design — a
naive `.posting { background: var(--posting-bg); }` with Parchment's value neutralised to
`transparent` would still *win* the cascade and silently erase the item's real background instead
of leaving it alone. The fix: only the properties genuinely inert at their neutral value (tilt,
drop shadow, a new pin pseudo-element) live in an unconditional `.posting` rule; background/
border/padding are scoped to `:root[data-appearance='noticeboard'] .posting`, so that rule simply
doesn't exist for Parchment's cascade to contend with. `.board` doesn't need this split — every
container it's applied to (a bare flex/grid wrapper like `.chips`) has no background/border/
padding of its own to lose.

**Tilt is a per-call-site opt-in** (a `.tilt` class alongside `.posting`), varied deterministically
via `:nth-child(4n+1…4)` — never `Math.random()`, so `npm run screenshot`'s before/after comparison
stays reliable — and capped at 1.5°. On for chip-shaped items (Looks, quest chips, Load items,
Abilities & Skills entries, Armor entries); **off** for `StatusesPanel`'s full-width interactive
rows, per the plan's own carve-out — `getBoundingClientRect()` reports the *transformed* box, and a
tilted row is worse to actually use, not just riskier to lay out.

**`--ink-on-ground`** (`tokens.css`) is the one ink token that genuinely flips polarity per
appearance (`--ink` under Parchment, `--ink-on-dark` under Notice Board) — every other `--ink-*`
opacity stop stays meaningful unchanged, because `.panel`/`.dialog`/`.drawer` all stay a light
surface in both appearances (Notice Board's ground goes dark; its panels don't). Apply it
explicitly wherever text renders straight on the bare page background instead of inside a
`.panel`/`.dialog`/`.drawer` — a real, previously invisible class of UI (`HomePage`'s greeting,
every top-level page's own title, `SectionHead`'s "The party"/"Combat", `CharacterSheetPage`'s
sticky-bar identity, `App.tsx`'s loading screens) that Parchment's near-identical `--ground`/
`--panel` values had been silently papering over the whole time, long before this appearance
system existed to expose it.

**Two more real, previously invisible bugs surfaced by Notice Board's genuinely dark ground, both
fixed for both appearances rather than patched only for Notice Board:**
- `layout.css`'s `.admin-pane` (Content Admin's list/detail panes) never had its own background —
  always relied on the page ground showing through, indistinguishable from real panel chrome only
  because Parchment's `--ground`/`--panel` happen to be nearly the same pale cream. Now explicit
  `--panel`.
- Any unstyled `<button>` fell back to the UA stylesheet's `color: buttontext`, which is
  `color-scheme`-aware — under Notice Board's `color-scheme: dark` (needed for native `<select>`
  chrome, below) that silently resolved to a light default, so a button that forgot its own color
  rendered light-on-light against a `--panel` background. `base.css`'s `button` rule now has
  `color: inherit`, matching `input`/`select`/`textarea`, which already had it.

**`color-scheme: dark` is set on Notice Board's `:root` block** (`color-scheme: light`, newly
explicit, on Parchment's) — needed so native form-control chrome (a `<select>`'s own dropdown/
scrollbar rendering, including the appearance picker itself) doesn't default to whatever the OS/
browser guesses regardless of the page's own painted colors.

**Persistence and no-flash** (`apps/web/src/store/appearanceStore.ts`, `apps/web/src/lib/
appearances.ts`): `localStorage`, mirroring `panelCollapseStore.ts`'s try/catch-with-fallback shape
exactly — read/write live in their own `loadAppearance()`/`saveAppearance()` functions so a
server-backed source can replace them later without touching a call site. The store does not own
the *initial* paint: `index.html`/`harness.html` each carry a small inline `<head>` script that
sets `document.documentElement.dataset.appearance` from the same `localStorage` key before any CSS
paints (has to be inline — a module import runs too late to help). `loadAppearance()` also checks a
`?appearance=` query param before `localStorage` (harmless in the real app, where nothing ever sets
this param) — the test harness navigates with it to force an appearance deterministically for
`responsive-smoke.mjs`/`screenshot.mjs`, and without this check the picker's own displayed value
would silently disagree with what the query param actually rendered — a real mismatch a human
reviewing `screenshot.mjs`'s output would see.

**The picker** is a labelled `<select>` in the app bar (`AppShell.tsx`), alongside About and Sign
out — `0.25.0` ruled the app bar is account/navigation chrome and game-rules controls don't belong
in it; an appearance picker *is* account chrome, so this follows that rule rather than bending it.
Verified against the bar's own documented tightness (see `AppShell.module.css`'s `.adminShort`
comment) at 320/360/390px before landing — it fit; the plan's fallback (move the picker into
`AboutModal`) wasn't needed.

**Testing**: the responsive-smoke/screenshot matrix gained an appearance dimension —
`harnessConfig.mjs`'s `APPEARANCES` list, `harness.html`'s `?appearance=`, and
`SMOKE_APPEARANCE=`/`SCREENSHOT_APPEARANCE=` filters matching the existing route/viewport
convention. CI's `responsive` job is a two-entry matrix over appearance so wall-clock stays flat
rather than doubling. **`appearanceStore.ts` has no dedicated unit test** — `apps/web` has no
vitest suite at all (see "Commands" above), and standing one up (plus a DOM environment for
`localStorage`) just to cover one small store was judged disproportionate to this pass; flagged in
`HANDOFF.md` rather than silently skipped. It's exercised the same way every other web-side store
in this app is (the responsive smoke test, manual QA) — consistent with `panelCollapseStore.ts`
having no dedicated test either.

**The doubled matrix earned its cost immediately**: the first full both-appearance run caught a
real regression the Parchment-only-era hand arithmetic had no way to see — at 360px under Notice
Board, `.board`+`.posting`'s combined horizontal padding squeezed `StatusesPanel`'s dedicated
six-pip Status-rank row (see its own file for the exact number) below what six pips need, so
`Pips` wrapped internally and its touch overlays collided, reproducing the exact overlap bug that
row's whole layout exists to prevent. Fixed with a negative `margin-inline` on `.pipsCell`, driven
by two new tokens (`--posting-pad-x`/`-y`, decomposed out of `--posting-pad` so the fix could
target the horizontal axis alone) — verified with a real rendered measurement after the first
attempt (bleeding only the row's own padding) came in one pixel short in an actual browser, not
just close on paper. That fix then regressed the desktop widths (1024/1440/1920px) in turn, caught
by re-running the full matrix a second time: the negative margin needed resetting inside the
existing `@media (min-width: 1024px)` block (which already resets a different `.pipsCell` property
for the same width switch) and wasn't. Two regressions, two full-matrix runs, both caught before
either shipped — see `StatusesPanel.module.css`'s `.pipsCell` comment for the full numbers.

## Frontend conventions

- **Server state only in TanStack Query.** No Redux/Context-based server-state store. Hooks in
  `apps/web/src/lib/` (`useBootstrap`, `useLibrary`, `useMe`) wrap `useQuery`; `lib/mutations.ts`
  wraps `useMutation`. `useLiveCampaign` invalidates query keys on Realtime events rather than
  patching cache data directly — treat Realtime as a signal to refetch, not a data source.
- **CSS Modules everywhere**, one `.module.css` per component (the whole UI was migrated off
  inline styles for this — see `CHANGELOG.md` 0.4.0). Design tokens (`apps/web/src/styles/tokens.css`)
  are CSS custom properties ported verbatim from the design handoff — reuse them (`--ink`,
  `--gold`, `--panel`, etc.) rather than hardcoding colors/fonts; if a value repeats and none of
  the existing tokens match, add one rather than writing another literal (`CHANGELOG.md` 0.4.2 did
  a pass consolidating these — read its entry before adding a new `--ink-*` stop, in case one
  already covers it). CSS that's genuinely byte-identical across components lives in a shared
  stylesheet and gets pulled in via CSS Modules `composes: ... from` rather than redefined per
  component — `apps/web/src/styles/modal.module.css` (modal shell) and
  `apps/web/src/styles/buttons.module.css` (the primary-button treatment) are the two so far. Only
  extract a class this way when every consumer's properties match exactly; near-duplicates that
  differ in size/color/spacing are usually real per-context variation, not copy-paste drift —
  forcing them into one class is a design decision (a type scale, a button-variant system), not a
  mechanical dedup. See `CHANGELOG.md` 0.4.2 for what was judged safe to unify and what wasn't.
- **44×44px minimum touch targets**, deliberate 768px/1024px breakpoints (not accidental ones
  from flex-wrap arithmetic) — both are enforced by the responsive smoke test, so a regression
  fails CI rather than getting noticed visually.
- **A row of peer actions of equal weight uses `.action-grid` (`layout.css`, `0.25.0`), not
  `flex-wrap`.** `flex-wrap: wrap` on content-sized buttons isn't a layout, it's an overflow
  fallback — each button is exactly as wide as its own label, so a row breaks wherever labels
  happen to run out of room, `justify-content`'s `flex-start` default leaves every wrapped row
  ragged-right, and leftover space collects at the right edge of the last line rather than being
  distributed. `.action-grid` is `display: grid; grid-template-columns: repeat(auto-fit,
  minmax(var(--action-min, 150px), 1fr))` — every child gets an equal share, the column count
  falls out of the available width, and `--action-min` is set per call site (a row of two long
  labels wants a higher floor than four short ones). Used for the sheet footer row, Statuses'
  Wealth/Treasure/Recoveries and Give/Heal Status rows, Bond actions (`AdvancementPanel`,
  `CampaignBonds`, `EndSessionModal`), and Combat's round-action row. **`auto-fit` over a container
  query on purpose**: a container query still needs someone to derive the right px threshold from
  the widest label plus gaps plus padding (see `StatusesPanel.module.css`'s 1024px comment for how
  much arithmetic that takes and how often it's been re-derived) — `auto-fit` computes the right
  column count from the real content every time, with nothing to get wrong. Container queries stay
  the right tool for *rearranging* a layout (Abilities & Skills going two-column, Load splitting
  tiers from items); `auto-fit` is the right tool for *distributing peers*. **Does not apply to**:
  mixed rows (a flexible text input beside a button — Home's create-campaign row, Statuses' quick-add
  row, Combat's initiative input — these keep the `display: contents` regroup technique from
  `0.18.3`'s `.addRow` instead, since the input should take the slack, not share an equal-width
  cell), chip/tag rows where ragged is genuinely correct (`CampaignTile` roster names, `MovesDrawer`
  filter chips, `ThemePanel`'s available-quest chips — these stay `flex-wrap` for their own layout;
  `ThemePanel`'s chips separately gained `.board`/`.posting` in `0.26.0`, an unrelated appearance-
  system decoration layered on top, not a `flex-wrap`-vs-`.action-grid` call — see "Architecture:
  appearances" above), and multi-pip rows (`Pips` has
  its own hit-area tiling math from the bullet below — don't put one in an `.action-grid` cell
  without redoing that arithmetic). A lone trailing item on the last row is deliberately left as an
  empty half-cell rather than stretched to fill it: there's no CSS-only way to detect "alone on the
  last row" once the column count itself varies with `auto-fit`, and a trailing empty cell reads as
  grid rhythm, not raggedness — an explicit `.span-all` utility (`grid-column: 1 / -1`) is available
  for the rare case a full-width action is a deliberate emphasis choice at every width, applied
  per-child at the call site, never automatically.
- **A tag-collection container/item (a Looks chip, a Load item row, a Status row, …) uses
  `.board`/`.posting` (`surfaces.css`, `0.26.0`) for the pinned-paper-on-a-corkboard look under
  Notice Board** — see "Architecture: appearances" above for the full primitive, the tilt
  constraint, and why `.posting`'s background/border/padding specifically can't be plain
  neutralised tokens the way the rest of this app's token system works. Scoped to the character
  sheet's tag collections per the plan's decision 3 (Looks, Theme's quest chips, Load items,
  Abilities & Skills entries, Armor entries, Statuses rows); everything else in the app gets the
  token repaint only.
- **A repeated-control row (like `Pips`) sharing a line with a flexible text input needs a real
  breakpoint, not a wrapping flex row, once the repeated controls get wide enough.** `Pips` grows
  each dot's *tap* area to 44px on a coarse pointer while keeping the painted dot small (see
  `layout.css`'s `.pip-row` comment) — six pips alone claim ~239px, which the comment there assumes
  will have a line to itself. `StatusesPanel.tsx`'s per-status row (name input + 6 Pips + rank +
  remove, `0.18.2`) used to put all four in one `flex-wrap: wrap` row; on a real iPhone the name
  input rendered narrower than its own value (`"Chubby"` displayed as `"Chubb"`) and the rank digit
  got stranded on its own line next to the remove button, because `flex: 1`'s `flex-basis: 0%`
  doesn't cleanly bump a whole sibling group to the next line the way a stated breakpoint does. Fixed
  by switching `.rowHead` to a `display: grid` with two named-area templates: one row (`name pips
  rank remove`) — today's original layout, unchanged — reflowing below 1024px to `name rank remove`
  on one row and `pips` alone on the next. **`pips` needs a row entirely to itself, not shared with
  `rank` in a split column** — the first cut of the two-row template split "pips | rank" across the
  two mobile columns, which left `pips` only the `1fr` share (~222px at 360px, still short of the
  ~239px six pips need), so `Pips`' own internal `flex-wrap` kicked in and its 44px-tall touch
  overlays (sized for `--tap-min`, not the ~19px painted dot — see `layout.css`'s `.pip::after`,
  unconditional on every pointer type) overlapped between the two wrapped lines, caught by the
  responsive smoke test's hit-area-overlap check. `rank` moved up next to `name`/`remove` instead,
  since it's just a small number badge with room to spare there — and even with a row fully to
  itself, `pips`' 44px-tall overlay still reaches ~12.5px past the painted dot, which very nearly
  overlapped the `Link to…`/`Affected by…` row directly underneath (`.links`, `margin-top: 7px`);
  `.pipsCell` carries an extra `margin-bottom: 14px` below 1024px to cover that.
  **The single-row template only turns on at 1024px, not the phone/tablet 600px break used
  elsewhere in this file** — the first cut used 600px and the responsive smoke test caught it
  overflowing at 768px. This panel doesn't sit at full viewport width: `.sheet-grid` goes
  two-column at 768px, and `StatusesPanel` is in the second (wider) `.sheet-col`, but that column
  is only `minmax(0, 1.5fr)` there — ~382px of content at a 768px viewport, short of the ~470px
  the single-row template needs. It isn't comfortably wide enough until 1024px, where the ratio
  becomes `1.7fr` (~564px of content). The general lesson: a panel inside `.sheet-col` cannot
  assume viewport width is its own width once 768px is crossed — check the actual column math (or
  just run the responsive smoke test) rather than picking a breakpoint from the viewport alone.
  Chosen over the alternative of always stacking those two rows regardless of viewport (simpler —
  one layout rule instead of two — at the cost of extra vertical space on desktop where it isn't
  needed); revisit that trade if the two-template grid proves annoying to maintain. If another panel
  ever puts a multi-pip `Pips` row next to a flexible-width input on the same line, check whether it
  needs the same treatment rather than assuming `flex-wrap` will degrade gracefully — it doesn't
  once the pip count is high enough.
  **The quick-add row's four controls (`.addRow`, `0.18.3`) hit the same too-narrow-below-1024px
  problem and reuse the same threshold, but not the grid technique** — Polarity/Rank/Add are all
  modest, well-behaved widths (nothing like Pips' 239px), so there's no flex-basis:0 wrapping trap
  to design around. A plain `display: flex; flex-direction: column` on `.addRow` puts the name input
  on its own full-width row with a nested `.addControls` flex row (Polarity, Rank, Add) below it;
  at 1024px, `.addRow` flips to `flex-direction: row` and `.addControls` switches to
  `display: contents`, dissolving the wrapper so its children rejoin `.addRow`'s single-row layout
  directly — reproducing the original one-line order with no extra nesting affecting layout. Prefer
  this simpler `display: contents` approach over `.rowHead`'s named-grid-area trick when a
  breakpoint-gated regroup doesn't involve an item wide enough to trigger the flex-wrap trap in the
  first place.
- **The character sheet's two-column layout is `.sheet-stack` (full-width bands) wrapping
  `.sheet-grid` (a two-column grid), not one element doing both jobs (`0.22.0`)** — a Figma-workshopped
  fix for every panel being forced into one of two columns regardless of fit (3 panels on the left, 5
  on the right, which read as arbitrary rather than deliberate). `.sheet-stack` (`layout.css`) is now
  the outer container — `max-width`/centering/padding/vertical `gap` live here, as direct children in
  render order: `.sheet-grid`, `.sheet-pair`, Abilities & Skills, Load, Advancement, the footer row
  (reordered in `0.23.0` — see below). `.sheet-grid` itself keeps only the grid-column behavior (the
  same `minmax(280px,1fr)
  minmax(0,1.5fr)` at 768px / `minmax(320px,1fr) minmax(0,1.7fr)` at 1024px ratio as before — see the
  `.sheet-grid` comment for why that ratio wasn't rebalanced to an even split just because there are
  only two panels in it now: Statuses' rows still need more width than Virtues', so the width each of
  them gets is unchanged from before this pass, and `StatusesPanel.module.css`'s 1024px breakpoint
  math didn't need re-deriving as a result — confirmed by re-running the responsive smoke test, not
  just by the arithmetic. **Prose text in the newly full-width panels needed a separate fix**: Theme/
  Abilities & Skills/Load render authored rules text and descriptions that would otherwise stretch to
  150+ characters per line at desktop widths now that their panel isn't capped at half the sheet's
  width. A new `.prose` utility (`layout.css`, `max-width: 68ch`) is applied at each affected `<p>`/
  text-block call site individually (not blanket-applied, and not applied to `AdvancementPanel`,
  whose own prose sits inside already-bounded row/badge layouts rather than running the panel's full
  width) rather than capping the panels themselves, so structured content (chip rows, pip trackers)
  still gets to use the full band width.
- **`.sheet-grid` (Virtues \| Statuses) moved to the top of `.sheet-stack`, and Theme/Looks now
  pair up in their own row instead of stacking as two separate full-width bands (`0.23.0`)** —
  direct repo-owner testing feedback: Virtues and Statuses are what a player checks most during
  play and were previously buried below Theme/Looks/Abilities & Skills/Load. `CharacterSheetPage.tsx`
  reorders its `PANEL_IDS`/render order accordingly; a new `.sheet-pair` class (`layout.css`) gives
  Theme and Looks an even 1fr/1fr split, reusing the same `.sheet-col` styling `.sheet-grid`'s
  columns already use rather than inventing a second column treatment. `.sheet-grid`'s own
  Virtues:Statuses ratio was deliberately left unchanged by this move (still `1fr`/`1.5fr`/`1.7fr` at
  the breakpoints described above) — reordering which row comes first doesn't change how wide either
  column needs to be, and `StatusesPanel.module.css`'s breakpoint math was reconfirmed against the
  responsive smoke test rather than assumed to still hold.
- **`.sheet-stack`'s render order changed again in `0.24.0`, and every panel is now a container-
  query container for its own measured width, not just a `.sheet-col` grid item.** Current order:
  `.sheet-grid` (Virtues | Statuses, unchanged since `0.23.0`) → `BackgroundPanel` (full width) →
  `.sheet-pair` (now Abilities & Skills | Load, not `0.23.0`'s Theme | Looks) → Advancement →
  footer row. **Theme and Looks merged into one "Background" section** (`BackgroundPanel.tsx`,
  new), Looks first per the repo owner's markup — `ThemePanel.tsx`/`LooksPanel.tsx` are demoted to
  plain sections inside it (a `.sectionLabel`-style heading, no `Panel`/`PanelHeader`), same
  "integrated sub-section" shape `ArmorSection` established inside `StatusesPanel` in `0.22.0`.
  Freeing `.sheet-pair` is what let it take Abilities & Skills | Load instead — see `layout.css`'s
  `.sheet-pair` comment for why that pairing kept the existing even `1fr`/`1fr` split rather than
  inventing an asymmetric one. `PANEL_IDS`'s old separate `theme`/`looks` collapse keys collapsed
  into one `background` key; a client with either old key already persisted in its zustand store
  just carries it as a harmless unused entry, no migration needed.
  **Every `Panel` (`Panel.module.css`'s `.panel` class) is now a named container-query container**
  (`container-type: inline-size; container-name: sheet-panel`) — the real fix for the footgun
  CLAUDE.md had already documented ("a panel inside `.sheet-col` cannot assume viewport width is
  its own width once 768px is crossed"), chosen over containing at `.sheet-col` so a full-width
  band (Advancement) and a half-width paired panel (Abilities & Skills, Load) share one mechanism.
  Three panels now query their own width via `@container sheet-panel (min-width: …)` rather than a
  hand-derived viewport breakpoint: `AbilitiesSkillsPanel` goes two columns at 560px (one combined
  `.list` grid, abilities then skills, not two separate `.map()`s restarting the flow); `LoadPanel`
  splits into a 1fr tiers column / 2fr items column at 700px (deliberately conservative — see
  `LoadPanel.module.css`'s `.body` comment for the arithmetic showing this rarely activates while
  paired with Abilities & Skills at ordinary desktop widths, only reliably at the sheet's own
  `>=1800px` wide step); `AdvancementPanel`'s two `.subBox`es (Potential, Rapport) pair at 850px
  (worked out from a 5-pip `Pips` row's own coarse-pointer width, per `AdvancementPanel.module.css`'s
  `.tracksRow` comment). `StatusesPanel.module.css`'s own existing 1024px media-query math was
  **deliberately not converted** in this pass — flagged as a follow-up, not bundled into a feature
  PR, per the lesson in the `.tap`-overlay bullet below. See `README.md#architecture-notes--
  judgment-calls` item 24 for the full container-query adoption writeup.
  **`VirtuesPanel`'s score box moved from leading to trailing the row, and the Condition checkbox
  is gone.** This reverses `0.22.0`'s Figma "Option A" pick on a newer, more specific markup from
  the repo owner: `.naming` (name + tagline, in that order — tagline moved back under the name,
  where it lived before `0.22.0`) leads the row; `.trailing` (the score box above the Condition
  button) trails it. The Condition button itself now carries the "press me" affordance instead of
  a separate checkmark glyph — unmarked uses the `--gold-tint`/`--gold-line` "interactive chip"
  pair already used for `ThemePanel`/`LooksPanel`'s own chips, rather than the old near-invisible
  neutral border. `VirtuesPanel.module.css`'s comment blocks were rewritten, not just deleted, to
  describe the new arrangement and note the reversal — see the file itself for the full tap-overlay
  arithmetic redone for the new layout (the old `.conditionRow`'s 24px margin-top doesn't carry
  over: `.naming`'s tooltip trigger and the Condition button are no longer vertically adjacent in
  this layout, but the Condition button and its own tooltip trigger, now side by side in
  `.trailing`, are a new pair that needed its own clearance worked out).
  **Explicit glossary tags** (`packages/shared/src/glossary.ts`, `0.24.0`) — CommonMark reference-
  link syntax (`[Term]`, `[display][id-or-name]`, `\[`/`\]` to escape a literal bracket) lets an
  author opt a specific occurrence out of auto-linking, or link a display word that isn't a term's
  own `Name`/`Alias`, without a new global `Alias`. A field with at least one explicit tag disables
  the regex auto-linker for that whole field — see `linkifyText()`'s doc comment. New
  `GameSettings.GlossaryAutoLink` (default `true`) is a separate, library-wide kill switch for the
  regex pass; explicit tags resolve independently of it either way. Content Admin's Validation
  panel now also surfaces an unresolved tag (`findUnresolvedGlossaryTags()`, wired into
  `validateLibrary()` in `apps/server/src/adminLogic.ts`) across every `text`/`textarea` field, the
  same way it already surfaces a dangling ref. See `README.md#architecture-notes--judgment-calls`
  item 23 for the full syntax-choice writeup.
  **Game history moved into a shared modal** (`apps/web/src/components/HistoryModal.tsx`) at all
  three places `AdvancementPanel.tsx` used to render it inline at all times (Potential, party
  Rapport, per-Bond) — a "History (N)" trigger opens it instead. Built on `modal.module.css` and
  `useModalA11y.ts` like every other dialog (see the modal-count note below); per-Bond history also
  dropped its `.slice(0, 8)` truncation, which only existed to fit inline on the sheet.
- **Armor lives inside StatusesPanel now, not its own Panel (`0.22.0`)** — `ArmorPanel.tsx` is gone;
  `ArmorSection.tsx` renders the same controls (per-Armor Used toggle, Refresh all with the same
  `ConfirmModal`) as a plain `<div>` section inline inside `StatusesPanel.tsx`, ahead of the Positive/
  Neutral/Negative groups, with its own small `.groupLabel`-style heading instead of a `PanelHeader`.
  Prompted by a direct repo-owner request: marking Armor Used is an alternative to taking a Status, so
  the controls should feel integrated rather than living in a separate collapsible section below.
  `StatusesPanel.tsx` also dropped its inert "Link to…/Affected by…" row (a `LinkedToIds`/
  `AffectedByIds` future-feature stub that was never wired to anything — the underlying
  `CharacterStatus` fields are untouched, only the dead UI row is gone) and tightened `.row`'s padding,
  both in the same space-optimization pass.
- **A `.tap` element's overlay only overhangs the axis where the element itself is under 44px** — worth
  internalizing exactly, not just approximately, because a near-miss here doesn't fail loudly, it fails
  as a CI-only overlapping-hit-area error. `.tap::after`'s `width`/`height` are each `max(100%,
  var(--tap-min))` independently: a button already ≥44px wide gets zero *horizontal* overhang even if
  it's short, and vice versa. `VirtuesPanel.module.css`'s `0.22.0` VirtuesPanel rework shipped a real
  instance of getting this wrong: merging `.tagline` into `.conditionRow` (so Condition could move to
  the row's trailing edge, per the same Figma pick above) removed a tagline-only spacer line that used
  to separate a Virtue's own InfoTooltip trigger from the Condition row below it, and the `margin-top`
  separating them was left at the old layout's 7px instead of being re-derived for the new one — its
  own comment even claimed a responsive-smoke-test check that had never actually been run. CI caught
  real overlaps at 360px and 768px (the two narrowest widths this panel renders at, not necessarily
  the two narrowest viewports overall — see the `.sheet-grid` note above for why 768px, right at the
  single-to-two-column transition, is tighter than 360px here). Fixed by bumping the margin to 24px
  with the overlay arithmetic worked through in the CSS comment, rather than by trial-and-error. If you
  change spacing between two `.tap`-classed elements that both fall under 44px in the same dimension,
  redo this math rather than assuming a value that worked in a different layout still applies.
- Auth (sign up/in/out) calls `@supabase/supabase-js` directly from the browser
  (`apps/web/src/lib/supabaseClient.ts`) — it does not proxy through the Express server. The
  Express API client (`apps/web/src/lib/api.ts`) attaches the Supabase session's access token as
  a Bearer header to every `/api/...` call.
- Small shared components — reuse rather than re-inventing:
  `apps/web/src/components/ConfirmModal.tsx` (`0.5.0`, yes/no confirmation dialog, built on
  `modal.module.css`) for any button that bulk-resets/refreshes sheet state or destroys a single
  record — Make Camp/Refresh-all/import-overwrite since `0.5.0`, extended in `0.19.0` to revoking
  an invite, removing a Combat participant, deleting a Status, and dropping a Quest, all of which
  used to fire immediately with no way back;
  `apps/web/src/components/InfoTooltip.tsx` (`0.5.0`, tap-to-reveal "i" trigger, not a native
  `title` — those never show on touch) for description/flavor text that's authored in the library
  but not otherwise rendered on the sheet (a Virtue's `Essence`/`UsageHelperText`, an Armor Type's
  `Description`, ...); and `apps/web/src/components/GlossaryText.tsx` (`0.9.0`) for any authored
  or player-authored prose rendered anywhere in the app — not just the Character Sheet (a
  Move/Skill/Ability's description/effect/rules text, an Item/Theme/Quest's description, a Bond
  proposal/history `Note`, ...) but the Campaign Shell too (`CampaignBonds.tsx`'s Bond move text
  and notes; `0.10.1` closed a gap where this duplicate render path had been missed) — it
  auto-links every glossary term the text contains into its own tap-to-reveal definition, so
  don't hand-roll term-specific tooltips, and don't add a new free-text render site without it.
  Pass it
  the matcher from `apps/web/src/lib/useGlossaryMatcher.ts` (memoized off `library.glossary`, one
  matcher shared across the tree). `InfoTooltip` and `GlossaryText`'s bubbles share their
  open/dismiss-on-outside-click-or-Escape behavior via `apps/web/src/lib/useTapReveal.ts` rather
  than each reimplementing it — extend that hook, don't fork it, if a third tap-to-reveal surface
  shows up. See `README.md#architecture-notes--judgment-calls` item 9 for why a linked term is a
  `<span role="button">` rather than a real `<button>` (44×44 touch targets on words packed
  together mid-sentence would overlap) before changing how `GlossaryTermLink` renders.
  `apps/web/src/components/HistoryModal.tsx` (`0.24.0`) is the newest addition to this list — a
  shared "game history" display (title + a scrollable list of timestamped entries, each optionally
  carrying `GlossaryText`-rendered detail) for any place this app shows a retrospective record
  rather than live reference; reuse it rather than rendering history inline the way
  `AdvancementPanel.tsx` used to before this version. Combat's `Encounter.History` log stayed a
  collapsible in-page section rather than moving to this modal — it's live reference read *during*
  a fight, not a retrospective record, and a modal would cover the board mid-turn; flagged as an
  open question in `WorkPlan-0.24.0.md` rather than silently decided either way, in case that
  judgment call gets revisited.
- **Every modal shares focus-trap/initial-focus/Escape-to-close/focus-restore behavior via
  `apps/web/src/lib/useModalA11y.ts` (`0.19.0`)** — attach its returned ref to the `modal.dialog`
  element alongside `role="dialog"` `aria-modal="true"` `aria-labelledby={titleId}` `tabIndex={-1}`
  (those stay in each consumer's own JSX since they don't vary at runtime the way the hook's
  behavior does). It's a **callback ref, not `useRef` + a mount effect** — most modals unmount
  when closed, but `AdvancementPicker` is rendered unconditionally by its caller and internally
  `return null`s when there's no active picker, so it never unmounts; only the dialog's own
  subtree appears/disappears, and only a callback ref fires correctly on both patterns. It also
  tracks a small open-dialog stack so Escape only closes the topmost dialog — `EndSessionModal`
  nests `MarkKinModal` (Mark Kin, spent from Hold), the one place two of this app's modals are open
  at once, and a bare per-dialog Escape listener would otherwise close both in one keypress.
  Applied to all 13 modals in the app (`HistoryModal.tsx`, `0.24.0`, is the newest). Extend this
  hook, don't fork it, for any new modal.
- **Form fields: a shared `Field`/`TextInput`/`Select`/`NumberInput`/`CheckboxRow` set
  (`apps/web/src/components/form/`, `0.23.0`), and react-hook-form + zod scoped to where they
  replace real duplicated logic, not adopted everywhere.** `Field` is a label+control pair (a
  `Fragment`, not a wrapping `<div>` — matches the plain sibling `<label>`/`<input>` markup it
  replaces exactly, so it carries zero layout risk); `TextInput`/`Select`/`NumberInput` are thin
  styled wrappers taking `ref` as a plain React 19 prop so `register()`'s returned `ref` spreads
  straight through for an uncontrolled RHF field. `characterCreationSchema(library)`
  (`packages/shared/src/characterCreationSchema.ts`) is a zod schema factory — `zod` is
  `@asohav/shared`'s first-ever runtime dependency — bound to a `Library` snapshot since character
  creation is the one form in this app that validates against real content, not just field shapes;
  `apps/server/src/routes/characters.ts` (`safeParse`) and `CreateCharacterPage.tsx`
  (`zodResolver` via `useForm`) both call it, replacing what used to be two independently
  hand-maintained copies of the same rules. `AddParticipantModal.tsx`/`CombatMoveModal.tsx` only
  `register()` their simple, independent fields — no zod schema, since there was no duplicated
  validation to unify there, just repeated markup the new primitives replace. Both modals'
  genuinely dynamic per-row arrays (Status Limits, Gambits) deliberately stayed local `useState`
  rather than `useFieldArray`, to avoid rebuilding already-working Combat state management with no
  live-QA path in this sandbox to catch a regression. See `README.md#architecture-notes--
  judgment-calls` item 22 for the full scoping rationale, including which of the five modals
  sharing this CSS actually migrated (two) versus were deliberately left alone (three, plus
  `CreateCharacterPage`'s own differently-styled fields) and the bundle-size cost of not
  lazy-loading `CreateCharacterPage` the way `/admin`/`/combat` are (below).
- **`/admin` and `/combat` are behind `React.lazy`/`Suspense` (`0.19.0`)** in `App.tsx` — Content
  Admin is designer/admin-only (~960 lines of schema-driven CRUD) and Combat is only relevant
  mid-session, so neither belongs in the bundle every player downloads just to open their
  character sheet. One `<Suspense fallback={...}>` wraps the whole `<Routes>` block rather than
  each lazy route individually, since only one route ever renders at a time anyway; the fallback
  reuses the in-shell "Loading…" convention (`padding: 20px`, `App.module.css`'s `.routeLoading`)
  rather than the full-viewport pre-auth `.loading` class, since it renders inside `AppShell`. If
  another route grows large and is similarly rare in a typical session, split it the same way.

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

## Sandbox network constraints (relevant if you're in a similarly locked-down environment)

Some development sandboxes used on this project have outbound HTTPS restricted to an allowlist
and no raw TCP at all. Confirmed effects: direct `pg`/Postgres connections to Supabase fail
outright (not proxied HTTP), and plain `curl`/browser requests to the live Render URL or the
Supabase project host get blocked by the sandbox's own proxy. If you hit this, don't conclude the
live app or database is down — say explicitly that live QA/DB smoke-testing isn't possible from
the current environment rather than reporting a false negative. The Supabase MCP tool, when
available, works regardless (it runs outside the sandbox's network).

## Working conventions

- **Author docs, not just code.** This project keeps `README.md` (architecture + judgment calls),
  `CHANGELOG.md` (versioned history), and `HANDOFF.md` (session-to-session status/open issues)
  actively maintained. When you make a nontrivial change or a judgment call on ambiguous handoff
  content, add a line to the relevant doc rather than leaving it implicit in a commit message.
- **`.claude/skills/` has four project-authored skills that automate conventions documented
  above**, each pointing back to the relevant section here as its source of truth: `theme-tokens`
  (design-token reuse — "Frontend conventions"), `responsive-device-qa` (the responsive smoke test
  plus a manual breakpoint-math review — "Commands" and the Pips/quick-add-row notes under
  "Frontend conventions"), `perf-budget` (latency-risk patterns in route handlers, `repo.ts`,
  TanStack Query, and `useLiveCampaign`), and `release-reliability-checklist` (the
  typecheck/build/test/responsive gate plus the version-sync/CHANGELOG/tag policy, since `main` has
  no branch protection — see "Commands"). If you change one of those sections in a way that
  invalidates what its skill says, update the skill too — they're meant to stay in sync, not fork.
  The repo also has generic (not project-authored) skills installed for Supabase and Vercel's
  React/Next.js, component-composition, and Web Interface Guidelines best practices — those carry
  their own external conventions and don't reference this file.
- **What's deliberately not built** — dice rolling (a permanent product decision, not a gap),
  Skill modifiers, Bond-proposal expiry, generalized cross-character Status targeting, Hero Moves
  (blocked on Playbooks), and a rendered Combat grid — see `README.md#whats-not-built` for the
  current, maintained list. Don't treat these as bugs or TODOs unless asked to actually build them.
- **Virtue scores and Theme are read-only on the sheet, as of `0.5.0`.** As of `0.7.0` there is
  one in-app character-creation flow (`apps/web/src/pages/CreateCharacterPage.tsx`, reached from
  a Player membership with no `CharacterId` yet, gated to the campaign's Party Creation phase as of
  `0.12.0` — see `README.md#architecture-notes--judgment-calls` item 2), where a Virtue's starting
  value and a character's initial Theme are chosen once. Once a sheet exists, a Virtue only changes
  by taking the "Raise a Virtue by 1" Potential Advancement (`ad-p-virtue1`), and Theme only
  changes by taking "Change your Theme" (`ad-p-theme`) — both wired up in
  `apps/web/src/features/sheet/AdvancementPicker.tsx`, which is also the only place that should
  ever mutate `sheet.Virtues[].Score` or `sheet.Theme` outside a raw import. Don't add a stepper/
  `<select>` back onto `VirtuesPanel`/`ThemePanel` without checking this was actually asked for —
  it was a direct one-line request from the repo owner, not an oversight.
- **Character creation is no longer "deliberately narrow," as of `0.12.0`.** The `0.7.0`-era scope
  note (name + standard-array Virtues + Theme only, everything else starts empty) is superseded:
  `CreateCharacterPage.tsx` now also collects Looks (a repeatable list, joined with `\n` into the
  existing `CharacterSheet.Looks: string` field — the wire shape didn't change, only the
  creation-time input did), optional Quests from the chosen Theme, and starting Skills/Abilities
  (checkboxes capped at `GameSettings.SkillsAtCreation`/`AbilitiesAtCreation`, Abilities filtered
  to `Acquisition: 'Starting'`). Rapport and Kin are still a static placeholder card — see
  `README.md#architecture-notes--judgment-calls` item 12 — not real fields on the creation payload.
  If you extend chargen further, validate new fields server-side in
  `apps/server/src/routes/characters.ts` the same way the existing fields are (against the
  library, not just client-side) — this route has no other authorization layer to catch a missing
  check.
