# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ASoHaV Companion App — the player-facing digital toolset for *A Story of Heroes and Villains*, a
Powered-by-the-Apocalypse tabletop game. Three surfaces in one app: the player **Character
Sheet**, the designers' **Content Admin** panel (library CRUD, validation, changelog), and the
**Campaign Shell** (roster, invites, GM live-peek, the Bond handshake). Built from a static-prototype
design handoff in `Planning Docs/` — when in doubt about intended behavior, that's the source of
truth, and judgment calls made where the handoff was ambiguous or contradictory are documented in
`README.md#architecture-notes--judgment-calls`.

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
npm run test:responsive -w @asohav/web   # Playwright smoke test, see below
```

There is no unit test suite — CI (`.github/workflows/ci.yml`) runs only `typecheck`, `build`, and
the `responsive` job. `@asohav/shared` must be built (`npm run build -w @asohav/shared`) before
anything that imports it from `dist` (typecheck/build handle this automatically; the CI
`responsive` job builds shared explicitly as a separate step since `npm ci` alone doesn't produce
`dist`).

**Responsive smoke test** (`apps/web/scripts/responsive-smoke.mjs`): renders every real route
through `apps/web/harness.html` against seed fixtures (no server, no Supabase) at five viewports
(360/390 phone, 768/1024 tablet, 1440 desktop) and asserts no horizontal overflow, no touch target
under 44×44, no overlapping hit areas, and no uncaught page errors. Run it after any layout/CSS
change. Needs a Chromium binary — normally `npx playwright install --with-deps chromium` once per
environment, but that download is blocked in some sandboxes (confirmed in a Claude Code remote
environment this project has been worked in: outbound HTTPS only reaches an allowlist, and
`cdn.playwright.dev` isn't on it — don't re-run `playwright install` if it 403s, that's the
sandbox's proxy, not a broken setup). If a Chromium binary is already on disk (that same
environment pre-installs one at `/opt/pw-browsers/chromium`), point the script at it instead: it
already reads `CHROMIUM_PATH` for exactly this —
`CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:responsive -w @asohav/web`. CI does the
equivalent via `npx playwright install chromium` in a normal (non-sandboxed) runner.

**Note:** `main` has no branch protection requiring CI to pass before merge (see `HANDOFF.md`
item 7) — don't treat a green local run as optional just because a red PR *could* merge.

## Workspace layout

npm workspaces monorepo: `apps/*` + `packages/*`, one synchronized version across all four
`package.json` files (root, `@asohav/server`, `@asohav/web`, `@asohav/shared`) — see the
versioning policy at the top of `CHANGELOG.md` for what counts as MAJOR/MINOR/PATCH pre-1.0.
Bump all four together, add a CHANGELOG entry, tag the merge commit `vX.Y.Z`.

- **`packages/shared`** — the reconciled data model (`src/types.ts`), pure business logic
  (`src/logic.ts`: load capacity, damage tiers, the Bond handshake resolution), seeded library
  content and demo campaign (`src/seedLibrary.ts`, `src/seedPlay.ts`, ported from the handoff's
  `library.js`/`store.js`), admin schema (`src/schema.ts`), and the `api.ts` request/response
  shapes. **Both server and web import this from its built `dist`, not source** — rebuild it after
  editing (`npm run dev -w @asohav/shared` watches; `npm run build -w @asohav/shared` for a one-shot).
  `src/types.ts` is explicitly documented as the wire contract: keep shapes stable, add fields
  rather than renaming them, since JSONB columns in Postgres store these shapes verbatim.
- **`apps/server`** — Express + TypeScript. Route handlers in `src/routes/*.ts`, one file per
  resource (`auth`, `library`, `campaign`, `sheet`, `party`, `bond`), mounted in `src/index.ts`.
  `src/repo.ts` is the only place that talks to Postgres/Supabase; `src/auth.ts` attaches
  `req.user` from a Supabase Auth bearer token and provides `requireAuth`/`requireAdmin`
  middleware.
- **`apps/web`** — Vite + React 19 + TypeScript. Routed pages in `src/pages/`, feature panels
  grouped by surface in `src/features/{admin,campaign,sheet}/`, data-fetching hooks and the API
  client in `src/lib/`. No global app state store beyond two small zustand stores for pure UI
  state (`src/store/panelCollapseStore.ts`, `adminUiStore.ts`, `sheetUiStore.ts`) — all server
  state lives in TanStack Query's cache.
- **`supabase/migrations`** — numbered SQL migrations, applied in order to the Supabase Postgres
  project. `0001_init.sql` has the schema design notes (RLS strategy, JSONB shape rationale) at
  its top — read it before touching schema.

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
- Auth (sign up/in/out) calls `@supabase/supabase-js` directly from the browser
  (`apps/web/src/lib/supabaseClient.ts`) — it does not proxy through the Express server. The
  Express API client (`apps/web/src/lib/api.ts`) attaches the Supabase session's access token as
  a Bearer header to every `/api/...` call.
- Two small shared components, both added in `0.5.0` — reuse rather than re-inventing:
  `apps/web/src/components/ConfirmModal.tsx` (yes/no confirmation dialog, built on
  `modal.module.css`) for any button that bulk-resets or bulk-refreshes sheet state, and
  `apps/web/src/components/InfoTooltip.tsx` (tap-to-reveal "i" trigger, not a native `title` —
  those never show on touch) for description/flavor text that's authored in the library but not
  otherwise rendered on the sheet (a Virtue's `Essence`/`UsageHelperText`, an Armor Type's
  `Description`, ...).

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
- **What's deliberately not built** (combat, dice rolling, Statuses/Conditions targeting another
  character, Skill modifiers, Bond-proposal expiry, a character-creation flow) is scoped out by
  the original design handoff — see `README.md#whats-not-built`. Don't treat these as bugs or
  TODOs unless asked to actually build them.
- **Virtue scores and Theme are read-only on the sheet, as of `0.5.0`.** There's no in-app
  character-creation flow (see above), so a Virtue's starting value and a character's initial
  Theme only ever come from seed/import data. From then on, a Virtue only changes by taking the
  "Raise a Virtue by 1" Potential Advancement (`ad-p-virtue1`), and Theme only changes by taking
  "Change your Theme" (`ad-p-theme`) — both wired up in
  `apps/web/src/features/sheet/AdvancementPicker.tsx`, which is also the only place that should
  ever mutate `sheet.Virtues[].Score` or `sheet.Theme` outside a raw import. Don't add a stepper/
  `<select>` back onto `VirtuesPanel`/`ThemePanel` without checking this was actually asked for —
  it was a direct one-line request from the repo owner, not an oversight.
