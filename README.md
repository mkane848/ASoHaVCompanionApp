# ASoHaV — Character Sheet, Content Admin & Campaign Shell

A Story of Heroes and Villains: the player-facing digital toolset built from the design
handoff in `Planning Docs/`. Three surfaces, one app: the player **Character Sheet**, the
designers' **Content Admin** panel, and the **Campaign Shell** (roster, invites, GM live-peek,
Bond handshake).

*A Story of Heroes and Villains is Powered by the Apocalypse — built on the Apocalypse Engine
design lineage originated by D. Vincent Baker and Meguey Baker (Apocalypse World). All Virtues,
Moves, Arcs, and other setting/rules content in this repository are original to this game.*

## Stack

- **Client** (`apps/web`): Vite + React 19 + TypeScript, zustand-free (state lives in
  TanStack Query's cache — see *Architecture notes*), TanStack Query for all server state,
  a small WebSocket hook feeding the query cache for real-time updates. Auth (sign up / sign
  in / sign out) goes straight to Supabase Auth from the browser via `@supabase/supabase-js`.
- **Server** (`apps/server`): Express + TypeScript, Postgres via Supabase (`supabase-js` with
  the service-role key — authorization is enforced here in the route handlers, not in RLS;
  see `supabase/migrations/0001_init.sql`), `ws` for real-time push (auth via a Supabase-issued
  JWT passed as a query param, not a cookie).
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
npm run dev:web      # http://localhost:5173 — proxies /api and /ws to the server
```

Open http://localhost:5173. The server seeds five dev accounts in Supabase Auth on first boot
(password `asohav-dev` for all of them):

| Email | Character | Role |
|---|---|---|
| mike@asohav.dev | — | GM, content admin |
| ryan@asohav.dev | Ember | Player, content admin |
| sam@asohav.dev | Matryoshka | Player |
| ivy@asohav.dev | Oleander | Player |
| dax@asohav.dev | Frostbite | Player |

("The two game designers" from the handoff — Mike and Ryan — are seeded as content admins,
matching the admin panel prototype's "editing as" options.)

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
   writes as the bug.
2. **No character-creation flow.** The design's four premade characters map 1:1 to the four
   non-GM seed accounts; inviting a new player and standing up a fresh character (Virtue
   spread, starting Theme, ability picks) isn't a screen the handoff designed. Invite
   send/revoke works as specified; turning an accepted invite into a new character is out of
   scope here.
3. **Sheet-level "Reset to seed" and campaign-level "Reset campaign data" were dropped.** They
   were prototype-only affordances for demoing against localStorage. Against a real shared
   database they'd let one player nuke everyone's data, so I kept the admin panel's
   library-only reset (safe — content, not play state) and cut the other two.
4. **Real-time transport is a hand-rolled WebSocket layer** even though the database is now
   Supabase Postgres — Supabase Realtime (Postgres change-data-capture over a managed socket)
   would let the client subscribe directly and drop `apps/server/src/ws.ts` entirely. Not yet
   done; the wire contract in `packages/shared` wouldn't need to change either way.
5. **Auth is Supabase Auth**: email + password, handled by Supabase directly from the browser
   (no server-side password storage). The Express server verifies the resulting JWT and enforces
   authorization itself — see `apps/server/src/auth.ts` and the RLS note in
   `supabase/migrations/0001_init.sql`. No email delivery customization, password reset flow, or
   OAuth wired up yet.
6. **The Bond handshake's row-locking is still a TODO.** `saveBond`/`insertBond` go through
   `supabase-js` (PostgREST), which is a plain check-then-write, not a real transactional row
   lock. `apps/server/package.json` already carries `pg` for this — the plan (documented in
   `supabase/migrations/0001_init.sql`) is a direct Postgres connection via `DATABASE_URL` for
   the propose/accept/reject sequence specifically. Blocked on having that connection string.

## What's not built

Per the handoff's own "Known Gaps & Risks": combat, Statuses/Conditions targeting another
character as a real reference, Skill modifiers, dice rolling, and Bond-proposal expiry are all
deliberately out of scope — the design doc calls these out as future work, not omissions here.

## License & attribution

Code in this repository is licensed under the [MIT License](LICENSE). The repository itself
is currently private; the license governs the code's terms whenever it's shared.

ASoHaV is Powered by the Apocalypse, built on the Apocalypse Engine design lineage originated
by D. Vincent Baker and Meguey Baker (*Apocalypse World*). That credit covers the general
moves-based system (2d6 + stat, 10+/7–9/miss); the Virtues, Moves, Arcs, Bonds, and every other
piece of rules and setting content in `Planning Docs/` and `packages/shared` are original to
this game.
