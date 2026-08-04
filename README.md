# ASoHaV — Character Sheet, Content Admin & Campaign Shell

A Story of Heroes and Villains: the player-facing digital toolset built from the design
handoff in `Planning Docs/`. Three surfaces, one app: the player **Character Sheet**, the
designers' **Content Admin** panel, and the **Campaign Shell** (roster, invites, GM live-peek,
Bond handshake).

*A Story of Heroes and Villains is Powered by the Apocalypse — built on the Apocalypse Engine
design lineage originated by D. Vincent Baker and Meguey Baker (Apocalypse World). All Virtues,
Moves, Arcs, and other setting/rules content in this repository are original to this game.*

**Picking this project back up?** See [HANDOFF.md](HANDOFF.md) for current status, open issues,
and pending work before starting anything new.

## Stack

- **Client** (`apps/web`): Vite + React 19 + TypeScript, zustand-free (state lives in
  TanStack Query's cache — see *Architecture notes*), TanStack Query for all server state,
  a small hook (`useLiveCampaign`) subscribing to Supabase Realtime and feeding the query cache
  for real-time updates. Auth (sign up / sign in / sign out) goes straight to Supabase Auth from
  the browser via `@supabase/supabase-js`.
- **Server** (`apps/server`): Express + TypeScript, Postgres via Supabase (`supabase-js` with
  the service-role key — authorization is enforced here in the route handlers, not in RLS;
  see `supabase/migrations/0001_init.sql`). No custom real-time layer: the client subscribes to
  Supabase Realtime directly, scoped by the same RLS policies the REST routes rely on.
- **Shared** (`packages/shared`): the reconciled data model as TypeScript types, the seeded
  library content and demo campaign (ported from the handoff's `library.js`/`store.js`),
  the admin schema definitions, and pure helper functions (load capacity, damage tiers, the
  Bond handshake resolution logic) used by both client and server.
- **Database** (`supabase/migrations`): Postgres schema + RLS policies, applied to a Supabase
  project. Requires a Supabase project's URL/keys in `apps/server/.env` and
  `apps/web/.env` (see the `.env.example` files in each).

## Running it

```bash
npm install
npm run dev:server   # http://localhost:8787 — seeds Supabase Auth + Postgres on first run
npm run dev:web      # http://localhost:5173 — proxies /api to the server; talks to Supabase
                      # (Auth + Realtime) directly from the browser
```

Open http://localhost:5173. The server seeds eight dev accounts in Supabase Auth on first boot
(password `asohav-dev` for all of them):

| Email | Character | Role |
|---|---|---|
| mike@asohav.dev | — | GM, content admin |
| ryan@asohav.dev | Ember | Player, content admin |
| sam@asohav.dev | Matryoshka | Player |
| ivy@asohav.dev | Oleander | Player |
| dax@asohav.dev | Frostbite | Player |
| rob@asohav.dev | — | content admin |
| dave@asohav.dev | — | content admin |
| tyler@asohav.dev | — | content admin |

("The two game designers" from the handoff — Mike and Ryan — are seeded as content admins,
matching the admin panel prototype's "editing as" options. Rob, Dave, and Tyler are additional
content admin accounts following the same pattern.)

## Deployment

Hosted on [Render](https://render.com) as a single Web Service, defined declaratively in
[`render.yaml`](render.yaml) (a Render "Blueprint" — connect the repo and Render reads this file
directly, no manual service setup). One service, not two: `apps/server/src/index.ts` already
serves the built `apps/web/dist` client and falls back to it for client-side routes when
`NODE_ENV=production`, and the client only ever calls relative `/api/...` paths, so there's no
separate static site and no CORS to configure.

Env vars Render needs (set in its dashboard — `render.yaml` declares these with `sync: false` so
it prompts for them rather than storing them in git):

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API
- `DATABASE_URL` — Project Settings → Database → **Connection pooling** → URI (session or
  transaction pooler, `aws-*.pooler.supabase.com`). Must be the pooler, not the direct-connection
  hostname (`db.<ref>.supabase.co`) — that one's IPv6-only and won't resolve from an IPv4-only
  network.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — same Project Settings → API values, read at
  *build* time (Vite inlines them into the client bundle).

Two non-obvious build-time gotchas already hit and fixed (see `render.yaml` for the actual
config, and CHANGELOG.md 0.3.0 for the write-ups):

- `NODE_ENV=production` (needed for the app's own runtime — static-file serving) also governs
  `npm ci` during the build step, which by default omits devDependencies — silently dropping
  `@types/node` and breaking the server's `tsc` build. Fixed with `NPM_CONFIG_PRODUCTION=false`,
  which forces devDependencies to install regardless of `NODE_ENV` (an npm install setting only —
  it doesn't touch the running app's `process.env.NODE_ENV`).
- The first boot seeds eight dev accounts into Supabase Auth + Postgres if the database is empty
  (see *Running it* above) — expected on a fresh project, but worth knowing before it shows up
  unannounced in the deploy logs.

See [HANDOFF.md](HANDOFF.md) for what's actually been verified on the live deployment versus
what's still outstanding.

## Architecture notes / judgment calls

A few places where I filled a gap or resolved a conflict the handoff flagged as open. Flagging
these rather than burying them:

1. **The two prototype files disagree on how Kin/Forge changes are written.** `Campaign.dc.html`
   correctly routes every Bond change through `proposeBondChange`; `CharacterSheet.dc.html`'s
   Kin pips and Forge button mutate `KinTrack`/`BondLevel` directly, bypassing the handshake
   entirely. The README's own prose ("Any Bond change — mark Kin, spend Kin, Forge — is
   submitted as a proposal, not a write") is unambiguous, and the server enforces this for
   all three change types. So the sheet's Kin & Bonds panel now shows read-only Kin pips and
   "Propose…" buttons, matching the Campaign Shell — I treated the sheet prototype's direct
   writes as the bug. **Partially revisited in `0.5.0` — see item 7**: Spend Kin specifically no
   longer goes through this handshake, though Mark Kin and Forge Bond still do.
2. **No character-creation flow.** The design's four premade characters map 1:1 to the four
   non-GM seed accounts; inviting a new player and standing up a fresh character (Virtue
   spread, starting Theme, ability picks) isn't a screen the handoff designed. Invite
   send/revoke works as specified; turning an accepted invite into a new character is out of
   scope here.
3. **Sheet-level "Reset to seed" and campaign-level "Reset campaign data" were dropped.** They
   were prototype-only affordances for demoing against localStorage. Against a real shared
   database they'd let one player nuke everyone's data, so I kept the admin panel's
   library-only reset (safe — content, not play state) and cut the other two.
4. **Real-time transport is Supabase Realtime**, not a hand-rolled WebSocket layer — the client
   (`useLiveCampaign`) subscribes directly to Postgres change events on `party`/`bonds`/
   `character_sheets` (filtered by `campaign_id`) and `library` (global). There's no server-side
   broadcast code at all: Realtime evaluates each table's existing RLS SELECT policy per
   subscribing client, so a player only receives sheet-change events for their own sheet (or
   any sheet, if they're the GM) and campaign-scoped events for campaigns they belong to — the
   same authorization the REST routes already enforce, for free. `character_sheets` picked up a
   `campaign_id` column (`supabase/migrations/0005_sheet_campaign_id.sql`) specifically so
   Realtime's equality-only filters could scope it by campaign; it wasn't there before since
   sheets were only ever looked up by `character_id`.
5. **Auth is Supabase Auth**: email + password, handled by Supabase directly from the browser
   (no server-side password storage). The Express server verifies the resulting JWT and enforces
   authorization itself — see `apps/server/src/auth.ts` and the RLS note in
   `supabase/migrations/0001_init.sql`. No email delivery customization, password reset flow, or
   OAuth wired up yet.
6. **The Bond handshake's propose/accept/reject now takes a real row lock.** `withBondLock`
   (`apps/server/src/repo.ts`) opens a direct Postgres connection via `pg`/`DATABASE_URL`
   (`apps/server/src/pgPool.ts`) and runs `SELECT ... FOR UPDATE` inside a transaction, so two
   concurrent requests against the same Bond serialize instead of racing on a plain
   check-then-write. Everything else in the app still goes through `supabase-js` (PostgREST),
   which doesn't support holding a lock across a read and a write. **Not runtime-verified**: the
   development sandbox this was written in has no raw TCP egress (HTTPS-proxied only), so this
   couldn't be smoke-tested against the live database before merging — worth confirming end to
   end once it's running somewhere with normal network access.
7. **Spending Kin is unilateral; Mark Kin and Forge Bond are not.** Item 1 above unified all three
   Bond change types under one handshake, reasoning purely from data integrity ("two people can
   write one record"). The game's own rules text draws a real distinction the software design
   didn't carry forward: "either PC on the Bond Track can spend Kin," versus Forging, which
   explicitly needs both players to agree. `0.5.0` split this out — `SpendKin` now applies
   immediately (`applySpendKin()` in `packages/shared/src/logic.ts`, invoked directly from the
   `/propose` route rather than being staged as a `PendingChange`) and is recorded to `Bond.History`
   with a `'spent'` action, while `MarkKin` and `ForgeBond` still go through
   propose/accept/reject exactly as before. `withBondLock`'s row lock (item 6) still serializes
   concurrent writes to the same Bond regardless of type, so this doesn't reopen a race condition
   — it only removes the *approval* step for this one action.

## What's not built

Per the handoff's own "Known Gaps & Risks": combat, Statuses/Conditions targeting another
character as a real reference, Skill modifiers, dice rolling, and Bond-proposal expiry are all
deliberately out of scope — the design doc calls these out as future work, not omissions here.

## Versioning

All four `package.json` files (root, `@asohav/server`, `@asohav/web`, `@asohav/shared`) share one
[Semantic Versioning](https://semver.org/) number, bumped together — see [CHANGELOG.md](CHANGELOG.md)
for what's in each release and the policy for what counts as MAJOR/MINOR/PATCH pre-1.0.

## License & attribution

Code in this repository is licensed under the [MIT License](LICENSE). The repository itself
is currently private; the license governs the code's terms whenever it's shared.

ASoHaV is Powered by the Apocalypse, built on the Apocalypse Engine design lineage originated
by D. Vincent Baker and Meguey Baker (*Apocalypse World*). That credit covers the general
moves-based system (2d6 + stat, 10+/7–9/miss); the Virtues, Moves, Arcs, Bonds, and every other
piece of rules and setting content in `Planning Docs/` and `packages/shared` are original to
this game.
