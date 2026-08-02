# ASoHaV — Character Sheet, Content Admin & Campaign Shell

A Story of Heroes and Villains: the player-facing digital toolset built from the design
handoff in `Planning Docs/`. Three surfaces, one app: the player **Character Sheet**, the
designers' **Content Admin** panel, and the **Campaign Shell** (roster, invites, GM live-peek,
Bond handshake).

## Stack

- **Client** (`apps/web`): Vite + React 19 + TypeScript, zustand-free (state lives in
  TanStack Query's cache — see *Architecture notes*), TanStack Query for all server state,
  a small WebSocket hook feeding the query cache for real-time updates.
- **Server** (`apps/server`): Express + TypeScript, `node:sqlite` (Node's built-in driver —
  no native deps to compile), `ws` for real-time push, scrypt-based session auth (httpOnly
  cookie, no external auth provider).
- **Shared** (`packages/shared`): the reconciled data model as TypeScript types, the seeded
  library content and demo campaign (ported from the handoff's `library.js`/`store.js`),
  the admin schema definitions, and pure helper functions (load capacity, damage tiers, the
  Bond handshake resolution logic) used by both client and server.

## Running it

```bash
npm install
npm run dev:server   # http://localhost:8787 — seeds the DB on first run
npm run dev:web      # http://localhost:5173 — proxies /api and /ws to the server
```

Open http://localhost:5173. The server seeds five dev accounts on first boot (password
`asohav-dev` for all of them):

| Email | Character | Role |
|---|---|---|
| mike@asohav.dev | — | GM, content admin |
| ryan@asohav.dev | Ember | Player, content admin |
| sam@asohav.dev | Matryoshka | Player |
| ivy@asohav.dev | Oleander | Player |
| dax@asohav.dev | Frostbite | Player |

("The two game designers" from the handoff — Mike and Ryan — are seeded as content admins,
matching the admin panel prototype's "editing as" options.)

The SQLite file lives at `apps/server/data/asohav.sqlite` (gitignored). Delete it and
restart the server to re-seed from scratch.

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
4. **Real-time transport is a hand-rolled WebSocket layer**, not a BaaS with subscriptions
   built in (the handoff flagged this as "worth deciding early" but left it open). Given no
   infrastructure was already chosen, `ws` + `node:sqlite` keeps the whole stack dependency-light
   and running locally with zero accounts to set up. Swapping in a BaaS later would mean
   replacing `apps/server`; the wire contract in `packages/shared` wouldn't need to change.
5. **Auth is real but minimal**: email + password, scrypt-hashed, session cookie. No email
   delivery, password reset, or OAuth — sufficient for a friend group, not for the open internet.

## What's not built

Per the handoff's own "Known Gaps & Risks": combat, Statuses/Conditions targeting another
character as a real reference, Skill modifiers, dice rolling, and Bond-proposal expiry are all
deliberately out of scope — the design doc calls these out as future work, not omissions here.
