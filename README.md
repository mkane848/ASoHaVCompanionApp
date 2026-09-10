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
2. **No character-creation flow** — revisited in `0.7.0`, see below. Originally (through
   `0.5.1`): the design's four premade characters map 1:1 to the four non-GM seed accounts;
   inviting a new player and standing up a fresh character (Virtue spread, starting Theme,
   ability picks) wasn't a screen the handoff designed, so invite send/revoke worked as
   specified but turning an accepted invite into a new character was out of scope.
   **`0.7.0`** added the accept/decline/redeem-by-code side of the invite flow, plus the one
   character-creation screen in the app (`apps/web/src/pages/CreateCharacterPage.tsx`),
   reached when a Player membership has no `CharacterId` yet. Scoped deliberately narrow rather
   than a full chargen system: a player names their character, assigns a standard Virtue array
   across the five Virtues, and picks a starting Theme from the library. Skills, Abilities,
   Items, and Armor start empty, same as everywhere else in the app that still has no picker for
   those. The Virtue/Theme lock described in CLAUDE.md ("Virtue scores and Theme are read-only
   on the sheet") still holds from that point on — this is a one-time creation step, not a
   loophole back into free editing. **Revisited in `0.20.0`**: the single array this originally
   shipped with (`2, 1, 0, 0, -1`, inferred from the multiset every premade character in
   `seedPlay.ts` happened to share, since the handoff docs never actually specified one) turned
   out to be incomplete — the repo owner confirmed the real rule is five valid starting arrays
   (`STANDARD_VIRTUE_ARRAYS` in `packages/shared/src/logic.ts`), not one. The screen now has the
   player choose which array to assign from before the same per-Virtue assignment grid; the old
   array isn't among the five and is no longer accepted at creation (existing `seedPlay.ts`
   characters are unaffected, since this validation only ever runs at creation time).
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
8. **Kin is a real Advancement track, not a gap.** `0.5.0`'s Admin nav reorg (item above, and
   `CHANGELOG.md` 0.5.0's "Judgment calls") split Advancements into Potential/Rapport only,
   reasoning "there's no Kin library content to administer." `Planning Docs/archive/Advancements.md`
   says otherwise: it frames Potential/Kin/Rapport as three parallel Advancement categories —
   Personal, Social, Party — and describes Forging a Bond as picking "a Bond Move from the list of
   Bond Moves available to your Bond Level," the same shape as Potential/Rapport's "choose one
   option from your Playbook's advancement list," just scoped to a *pair* of characters instead of
   one character or the whole party (`AdvancementTrack` and `ADVANCEMENT_TRACK_SCOPE` in
   `packages/shared/src/types.ts` now say this explicitly). Confirmed with the repo owner that
   Forge-a-Bond should stay the freeform "write it together" move rather than becoming a pick from
   authored library content — that part of the earlier judgment call was right — so
   `packages/shared/src/schema.ts`'s `advancements` collection still only offers `Potential`/
   `Rapport` in its `Track` enum, and nothing changed about how Forging works. What changed is
   classification: Content Admin's Advancements group now has a third **Kin** entry
   (`KinAdvancementView.tsx`) alongside Potential/Rapport, explaining Kin is handled live through
   the Bond handshake rather than authored content, and giving Kin a permanent place in the nav for
   whatever Kin-specific content or rules land later instead of it being absent.

   **V0.5 confirms this reasoning was right, and keeps the shape unchanged.** Bond (the renamed Kin
   track — item 20/29 below) still has no authored library content the way Potential/Rapport do:
   Forging stays a freeform move, not a picker, per the same repo-owner call preserved above.

   **Correction, slice 4 (`0.31.0`): the "tiered Bond Improvements keyed to Bond Level" this item
   used to predict here never actually existed in the source document.** That was this item's own
   inference from V0.5's "Bond Track + Improvements" *header* — nobody had opened the section
   underneath it to check. Slice 4 did, while building the real Hero Improvement Tree model, and
   found it reads "Here that is!" with nothing else at all: no tiers, no tree names, no Bond-Level
   keying, no content of any kind — a bigger gap than Hero's 25 named-but-empty trees, which at
   least have names and themes to seed placeholders against. `BondAdvancementView.tsx`'s
   explanatory, no-CRUD framing was therefore left exactly as it was rather than rebuilt into
   Improvement-tree CRUD — there is nothing to build a picker or an admin screen for. See
   `HANDOFF.md` open issue 12 and item 30 below for the full slice-4 writeup.

   **The Kin → Bond rename shipped in `0.28.0`**; the track is `Bond` throughout code, and this
   item's reasoning about why it carries no authored library content still holds.

   > **V0.5:** Bond Improvements are named in the rules the same way Hero and Party Improvements
   > are, but — unlike Hero's 25 trees — no tree names or node content exist anywhere in the source
   > document to build against. **Not built, and not scoped to any slice** until the repo owner
   > authors real content for it. See `HANDOFF.md` open issue 12.
9. **The glossary is its own collection, not a `Description` field reused across existing
   entities.** Requested by the repo owner: inline tap-to-reveal definitions for rules terms and
   phrases appearing in authored sheet text (`packages/shared/src/glossary.ts`,
   `apps/web/src/components/GlossaryText.tsx`). The obvious shortcut — add a `Definition` field to
   `conditions`/etc. and link straight to it — doesn't cover most of what actually needed linking:
   general mechanics like "Kin," "Rapport," "Hold," and even "Condition" itself (the mechanic, as
   opposed to any of the five specific per-Virtue Conditions) have no single matching entity
   anywhere in the library. `glossary` is a freestanding `{ Id, Name, Aliases, Definition }`
   collection instead, matched into text by name/alias rather than by reference, so authoring a
   term doesn't require going back and tagging every field that happens to mention it. Matching is
   deliberately case-sensitive (only capitalized, Title-Case occurrences link) rather than matching
   every casing — this game's rules text always capitalizes its proper nouns, so requiring that
   casing is what keeps common English words that happen to share a term's spelling from getting
   linked by accident. A linked term renders as a `<span role="button">`, not a real `<button>`:
   the app's touch-target rule (`apps/web/scripts/responsive-smoke.mjs`, see CLAUDE.md) requires
   44×44 hit areas on touch, and multiple glossary terms often sit close together in one sentence
   (e.g. Offer Solace's "mark Potential, clear a Condition, or shift a Status") — real 44px hit
   boxes on adjacent inline words would overlap each other, the same failure mode `.tap-inline`
   (`apps/web/src/styles/layout.css`) was built to avoid for chip rows, just inside a sentence
   instead of a row. Inline text targets are WCAG's own documented exception to minimum target
   size (2.5.8) for exactly this reason.
10. **Campaign phase (`0.12.0`) is a separate field from `Status`, not an expanded `Status` enum.**
    The obvious shortcut — fold `'Signup' | 'PartyCreation' | 'Playing'` into `Status` alongside
    `'Active'`/`'Archived'` — was rejected: `Status` is purely the GM's archive/freeze toggle, and
    every existing `assertCampaignActive()` call site already means "not archived." Overloading it
    with setup-workflow states would force re-auditing every one of those call sites for a meaning
    that was never in question. `Campaign.Phase` is additive and orthogonal instead — a campaign
    can be `Archived` at any `Phase`. It's optional on the type (`campaignPhase()` in
    `packages/shared/src/logic.ts` defaults a missing value to `'PartyCreation'`) so pre-existing
    fixtures and already-running campaigns aren't retroactively locked out of character creation;
    see the migration `0009_campaign_phase.sql` comment for why that default isn't `'Signup'` or
    `'Playing'`.
11. **The GM confirms "Start playing" manually rather than the campaign auto-advancing once
    everyone's ready.** `partyReadiness()` computes the "N / M ready" count purely as a readout;
    nothing flips `Phase` to `'Playing'` on its own. Mirrors the Archive button's existing
    pattern (a GM-only action with a `ConfirmModal` on the consequential direction) rather than
    introducing a new "the server decides when to start" mechanism, and lets a GM start early
    (with a confirmation) if a straggler is holding things up.
12. **Reconciling the working design doc for the `0.13.0` game-engine slice.** `Planning Docs/`
    gained a large, messy running design doc mid-project — 14,000+ lines spanning a real rulebook
    draft, GM-facing brainstorming, other-game inspiration notes, and at least one wholesale
    abandoned earlier exploration (a section literally titled "FINAL SYSTEM IDENTITY" that uses
    Stat/Tag/Stress vocabulary matching nothing else in the doc or the app — treated as
    superseded, confirmed with the repo owner). Where the doc contradicted itself, resolved with
    the repo owner directly rather than guessed: the doc's "Crumble" mechanic (leave the
    scene/unconscious, +Vulnerable 4 in Combat) is a renamed exploration of the same trigger as
    the already-shipped **Dishonored** — kept the Dishonored name, folded Crumble's effects into
    it. The doc also describes three successive Combat drafts (V1 → V2.1 → V2.2); V2.2 is the
    one to build against whenever Combat gets its own slice — it's the most recent (enemy stat
    blocks + Toughness only appear there) and resolves an open question V1 leaves unresolved (the
    "Defiant Goal" mechanic). Several mechanics the doc leaves as open questions in its own text —
    whether "do harm"/"do magic" need their own Basic Move, whether Armor should be modeled as a
    Status, "Find Your Need," "Finish a Minion," whether re-marking an already-marked Condition
    should award Potential — are deliberately **not** implemented; noted here and in `HANDOFF.md`
    as deferred rather than guessed at.

    **Never actually in this repository.** Verified for the V0.5 adoption (`2026-09-01`) against
    `git ls-files`, deleted-file history, and disk: no file anywhere near 14,000 lines exists, or
    ever existed, in this repo's tracked history — the largest rules file actually present was
    `Planning Docs/archive/TheMoves.md` at 334 lines, and only this file's own prose contains the
    string "FINAL SYSTEM IDENTITY." For thirteen versions (`0.13.0` through `0.27.0`) the shipped
    Combat implementation described above was unverifiable against its own stated source — recorded
    here as history and a closed gap, not an accusation: the decisions made at the time were
    reasonable calls against a document a later reader simply cannot open.
    `Planning Docs/archive/Ruleset-V0.5.md` was adopted as that missing document's successor and closed the
    gap; see item 29 below for the adoption itself.

    **V0.5 reverses the Crumble/Dishonored merge decided above.** It keeps the name Crumble (not
    Dishonored) for this trigger, and adds an effect neither the missing doc nor the shipped app
    ever had: clearing one Condition when Crumble triggers, on top of the already-shipped
    Vulnerable 4 in Combat (item 19 below).

    **This shipped in `0.28.0`.** Crumble replaced Dishonored, and — more consequentially than a
    rename — stopped being derived state. Having all five Conditions marked is now a legal state;
    Crumble fires on the *next attempted mark*, clears one Condition, and grants Vulnerable 4 when
    it happens in Combat. See CLAUDE.md's rules-engine section for why that forced
    `markCondition()` to become the single funnel for marking a Condition. Worth noting the
    seeded `g-dishonored` glossary text had been V0.5-correct all along — it said "a **sixth**
    Condition with all five already marked" while `isDishonored()` fired at the fifth. The prose
    was right and the code was wrong.
13. **This app will never roll dice for the player, by explicit product decision** — confirmed
    directly with the repo owner rather than assumed. `packages/shared/src/engine.ts` computes and
    displays a roll's full modifier breakdown (Virtue, Condition penalty, highest Status,
    applicable Ability bonuses, each labeled with its source) and, once told which tier a
    physically-rolled roll landed in (or a reported d6 for formulas like "1d6 + Mettle"), applies
    the resulting mechanical change. The randomness itself always happens at the table.
14. **Background-connection confirm/deny (the outline's "similar confirm/deny menus" alongside the
    Bond handshake) is a placeholder, not built, in `0.12.0`.** The Bond propose/accept/reject
    shape (`packages/shared/src/logic.ts`, `apps/server/src/repo.ts`'s `withBondLock`) is a close
    template — a locked shared record, one `PendingChange` slot, asymmetric accept/reject — but a
    new record type and its own row-lock helper is real scope, deferred rather than rushed; see
    `HANDOFF.md`. The character-creation screen ships a static "Rapport & Kin" info card instead.
15. **Combat (`0.14.0`) is track-and-display, not enforced, confirmed with the repo owner before
    building.** The app shows whose turn it is, AP, Range, and Statuses live to everyone, but
    never blocks an action — no "it's not your turn" lockouts. Built against Combat Basics V2.2
    (item 12's canonical draft). Three real decisions made scoping this, all confirmed with the
    repo owner rather than assumed:
    - **Range is theater-of-the-mind bands** (Melee/Close/Far/Very Far/Out of Range), not a
      rendered grid — a real map/mini-VTT is out of scope for this app. The doc's Maneuver
      (up to 6 squares) vs. Shift (up to 2 squares) distinction doesn't translate cleanly to
      bands; `shiftRange()` in `packages/shared/src/combat.ts` picks one generic 1-band reposition
      rather than guessing at an exact square-to-band conversion — flagged as an interpretation in
      that file's own comment, not silently invented.
    - **A PC's Statuses stay on their own `CharacterSheet`** (single source of truth, same as
      everywhere else) rather than being duplicated onto the Combat record — which collides with
      sheet.ts's owner-only write rule (not even the GM can write another player's sheet) when an
      Enemy attacks a PC. Solved with `Encounter.PendingStatusOffers`: anyone can offer a Status to
      a PC participant, but only that PC's own player can apply it (optionally Resisting first)
      from their own card. See `CLAUDE.md`'s Combat architecture note before changing this.
    - **Enemy authoring is ad-hoc-first with an optional save to a reusable library**, not
      library-only — a GM can spawn a one-off Enemy with nothing persisting, or check a box to
      save it to `library.enemies` (real Content Admin CRUD) on the way in. Enemies are defeated
      per-Status (any one `StatusLimit` reached, not a shared HP-style pool).
    
    **Deliberately not built in this `0.14.0` slice** (see `HANDOFF.md` for the fuller list): Hero
    Moves (blocked on Playbooks not existing), Opportunity Attack, Interpose, and a rendered grid.
    Opportunity Attack and Interpose shipped in `0.16.0` — see item 17. The grid stays deferred;
    **Hero Moves are now cut outright, not deferred** — see the "Hero Moves" entry under
    "Deliberate, permanent omissions" below for the repo-owner confirmation that resolved this.

    **Not merely predated by V0.5 — actively re-affirmed against it.**
    `Planning Docs/Ruleset-V0.6.md` specifies a real map with squares or hexes (Melee = Range 1,
    Engage-at-Range = Range 10, Maneuver 6 spaces, Shift 2, enemies move 6, Repel pushes a stated
    number of spaces) — a genuinely different geometry from the theater-of-the-mind bands above.
    Asked directly whether to build the grid V0.5 now specifies, the repo owner chose to keep the
    bands instead: the grid stays a tabletop concept, and any V0.5 Combat work maps its space
    counts onto the existing 5-band ladder rather than rendering squares or hexes. This changes
    what the first sub-decision above *is* — written in `0.14.0` against an ambiguous handoff, it
    was an open interpretation; against V0.5's explicit, unambiguous grid, it is now a documented,
    deliberate deviation from the written rules, not an unresolved question. See item 29's
    locked-decisions table below.

    > **V0.5:** a real map with squares or hexes, and the Maneuver/Shift/Repel distances it defines
    > — **declined, not deferred.** The app keeps Range bands; V0.5's space counts are mapped onto
    > them as of slice 5 (`0.32.0`) — see `shiftRange()`'s doc comment in
    > `packages/shared/src/combat.ts` for the actual space-to-band ratio and item 31 below for the
    > turn-order/Repel/Resist work built alongside it.
16. **Gambits (`0.15.0`) are automated where they cleanly reduce to a Status/Range change, and
    logged narratively everywhere else — a deliberate split, not partial coverage by accident.**
    Bolster/Press/Halt/Impede/Calculate/Brace all become a `giveStatus`/`shiftRange` call the
    existing engine already knows how to do (Calculate/Brace even reuse Statuses themselves —
    "Focused"/"Braced" — as the buff mechanism, rather than inventing a separate temporary-effect
    tracker). Repel ("push back a Range band per their highest Negative Status Rank") and Seize
    ("take something from your target") don't reduce as cleanly — a Rank number isn't the same
    unit as a Range band, and "something" is deliberately open-ended in the doc — so those, plus
    the explicitly freeform "Other," are logged to `Encounter.History` for the table to resolve
    rather than forcing an invented formula. See `CLAUDE.md`'s Gambits note before changing this
    split.

    > **Superseded for Repel as of slice 5 (`0.32.0`)** — see item 31 below. Once a real
    > space-to-band conversion existed (needed anyway to document `shiftRange()` against V0.5's
    > actual numbers), the reason to leave Repel unautomated no longer held; `repelPushBands()` +
    > `shiftRange()` now apply it directly, with a Resist option. Seize and Other are still
    > genuinely open-ended in the doc and stay freeform.
17. **Opportunity Attack and Interpose (`0.16.0`) both reuse existing mechanics off-turn, rather
    than inventing new ones.** Opportunity Attack is `CombatMoveModal`'s ordinary Engage-in-Melee
    flow triggered from a standalone Reactions button with a `free` flag that skips the usual AP
    cost — deliberately **manually triggered, not auto-detected**: this app already collapsed
    Maneuver/Shift into one generic Reposition (item 15's Range-band note), so there's no signal
    left to tell "the enemy Maneuvered away" from "the enemy Shifted away," and the doc's trigger
    depends on that distinction. Whether it fired is a table call, same as the rest of Combat.
    Interpose redirects an existing `PendingStatusOffer` to the interposer (`Resistable: false`,
    per the doc's "can't be Resisted") and swaps their Range with the original target's, rather
    than creating a second offer — one offer, one resolution path, regardless of who ends up
    taking it. Both are PC-only, matching Gambits' precedent that Reactions are a Hero-side
    mechanic.

18. **A repo-owner-requested full audit (`0.17.0`) found the live `Library` singleton had drifted
    multiple versions stale** — missing `0.9.0`'s `glossary`, `0.14.0`'s `enemies`, and several
    `0.13.0`/`0.14.0` `GameSettings` fields, silently breaking real gameplay math (0 Recoveries on
    new characters, an unenforced Skill cap, Advancement Tiers frozen at 1) rather than crashing,
    which is why nobody had noticed. `normalizeLibrary()` closes the gap CLAUDE.md already
    documented as the general rule for JSONB-blob types but had only ever been applied to
    `CharacterSheet`. The same audit also found and fixed an unenforced rule (Bond Kin-lock at
    Level 5 — see `Advancements.md`) and a stale unfulfilled promise in seeded content (Dishonored's
    Combat effect, "once it's built" — now built). See `CHANGELOG.md` 0.17.0 for the full list and
    `HANDOFF.md` for the larger set of rules/content gaps the same audit surfaced but didn't act on
    (missing Moves, Wealth/Treasure, Character/Party Level, Advantage/Disadvantage rolls — all real
    scope, deferred pending the repo owner's choice of what to build next).
19. **Dishonored's Combat effect (Vulnerable 4, `0.17.0`) only fires from a Condition mark made
    inside a live Combat Encounter** — currently only reachable by paying a Gambit's Condition
    cost (`EncounterView.tsx`'s `applyGambits`), since that's the only place Combat marks a
    Condition today. A PC who enters an Encounter already Dishonored, or who becomes Dishonored
    through some other means while an Encounter is merely open in the background, does not get
    this applied retroactively — narrower than "whenever Dishonored in Combat" would imply.
    Confirmed with the repo owner as an acceptable scope for now, but flagged here and in
    `CLAUDE.md` as a judgment call worth revisiting if that gap turns out to matter at the table
    (e.g. once a wider set of in-Combat Condition-marking triggers exist).
20. **Track B (`0.18.0`) — the real content/mechanic gaps the `0.17.0` audit found — five decisions
    confirmed with the repo owner before building, all in `packages/shared/src/types.ts`/
    `apps/web/src/features/sheet/`:**
    - **Wealth and Treasure are per-character resources**, not a shared party pool — every doc
      mention of either is a "you"/per-player spend (Follow a Lead, Enjoy Downtime, Gear Charges),
      unlike Rapport. Neither has an earn mechanic in the doc; for now both are a freely
      player/GM-adjusted counter on the sheet, no automated grant — revisit if/when the GM should
      be able to award them as part of a move's result.

      **V0.5 slice 3 (`0.30.0`) built one real spend: Follow a Lead's 1-Wealth-for-Advantage.**
      Once `Move.AdvantageTrigger` existed as a real, typed per-Move mechanic (see below) rather
      than a one-off, wiring this one Move's named spend was no longer new scope. Every other
      named Wealth/Treasure sink (Enjoy Downtime's Rest/Acquire/Train/Carouse) still has no
      dedicated button — those wait on slice 7's Enjoy Downtime guided flow.

      **Built in `0.34.0` (slice 7).** `EnjoyDowntimeModal.tsx` gives all four (plus Recover,
      Pivot, Advance) real buttons — see CLAUDE.md's Party Playbook & Camp section.
    - **"Kith" (Make Camp's gate condition, `Planning Docs/archive/TheMoves.md`) is the same thing
      as "Kin"** everywhere else in the doc and all shipped code — consolidated under Kin, no new
      concept, no code changes needed (the app never used "Kith").

      **V0.5 confirms this** — it names the same track "Bond," "Kin," and "Kith" in three different
      places, treated as doc typos rather than three concepts (item 29 below). The track's code
      name changes for V0.5 too: `Kin` becomes **`Bond`** throughout (`AdvancementTrack`, both Bond
      UIs, the routes, the glossary, the seed) — planned for `WorkPlan-V0.5.md` slice 1.

      **Renamed in `0.28.0`** — `AdvancementTrack`, `Bond.BondTrack`, `BondChangeType`,
      `applySpendBond()`, `GameSettings.BondTrackLength`, both Bond UIs, the glossary and the seed
      data all say Bond now.
    - **Advantage/Disadvantage are purely informational** (`AdvantageToggle.tsx`) — consistent
      with item 13's "this app never rolls dice" decision, flagging Advantage doesn't change the
      roll-breakdown total; it just notes "roll 3d6, keep the best/worst two" for the table.

      **`0.20.0` went further.** Repo-owner feedback was that even a toggle was over-built for a
      per-roll table judgment the app has no way to track, so `AdvantageToggle.tsx` was removed
      entirely in favor of a static `InfoTooltip` explaining the same thing at both render sites
      (`MoveRollHelper.tsx`, `CombatMoveModal.tsx` — see CLAUDE.md's
      Wealth/Treasure/Advantage/End-the-Session section). That reasoning was correct for the
      ruleset as it stood — there was genuinely nothing mechanical to attach a control to.
      **V0.5 reverses it**: it attaches Advantage/Disadvantage to three concrete, checkable
      triggers — Consult the Past with a written record, Follow a Lead for 1 Wealth, and Venture
      Forth without having Scouted Ahead — so the "nothing to track" premise the `0.20.0` decision
      rested on no longer holds; those three cases are rules-determined, not GM discretion. Planned
      for `WorkPlan-V0.5.md` slice 3.

      **Built in `0.30.0` (slice 3) for two of the three named triggers.** A new
      `Move.AdvantageTrigger` (`'wealthSpend' | 'selfReport'`) drives real, roll-scoped state in
      `MoveRollHelper.tsx`: Follow a Lead's Wealth spend, and Consult the Past's self-reported
      "I have a written record" checkbox. **Venture Forth without Scouting Ahead has no roll UI to
      attach to yet** — Undertake a Journey ships as reference text only this slice (item 20's
      Wealth/Treasure note above has the same shape of deferral), so this third trigger waits on
      slice 7's guided flow for that Move. Every other Move, and `CombatMoveModal.tsx`'s own
      Engage-roll render site (no V0.5-named trigger of its own), keeps the informational-only
      tooltip from `0.20.0` unchanged.

      **`UndertakeJourneyModal.tsx` (slice 7, `0.34.0`) still doesn't wire this third trigger.**
      Building it would mean detecting "the party skipped Scout Ahead" and applying Disadvantage to
      the following Venture Forth roll — a real state-passing concern between the two phases this
      slice's modal doesn't carry; the modal always runs both phases in order rather than modeling
      a skip. Left as informational only at that render site, same as every other untriggered Move.
    - **The doc's Level Up/Progress the Party Tier-unlock formula is deferred, not guessed at.**
      "Tier 2 unlocks at 4 Tier-1 advancements *and* Level 5" can't be made internally consistent —
      the two clauses can't both be literally true at the same moment if Level is (as every other
      reading suggests) just the count of Potential/Rapport-funded Advancement picks taken, since
      your 4th pick puts you at Level 4, not 5, and a 5th pick (still Tier 1, since Tier 2 isn't
      unlocked yet) makes it 5 Tier-1 picks, not 4. Compounds the already-flagged item 12
      Potential-tier contradiction (2-tier vs. 4-tier). No `Level`/`PartyLevel` field was added;
      `unlockedTier()` still gates purely on count, unchanged since `0.13.0`. Level Up/Progress the
      Party/Forge a Bond got library Move entries anyway (their core "spend 5 Potential/Rapport/Kin
      → advance" mechanic already exists and isn't in question) — their text just omits the
      contested compound formula.

      **V0.5 doesn't resolve this in its own text**, but slice 4 (`0.31.0`) resolved it for this
      app's implementation. `Planning Docs/archive/Ruleset-V0.5.md` reproduced the same "4 Tier-1
      advancements and Level 5" compound gate unchanged and still self-inconsistent — but it also
      states the same gating rule a second, unambiguous way elsewhere in its own text (no Tier, no
      Level, just a prerequisite DAG), and the repo owner confirmed treating the compound-gate
      version as leftover draft text rather than the rule to build. `HANDOFF.md` open issue 12 is
      resolved on that basis; see item 30 below for the full writeup.
    - **Undertake a Journey and Enjoy Downtime are deferred entirely** — both are full multi-step
      Move flows (Scout Ahead → Venture Forth with GM-chosen complication lists; five distinct
      Downtime activities) where it wasn't yet decided whether they need dedicated guided UI or can
      just be generic library-text Move references like everything else. Not seeded this pass.

      **RESOLVED, slice 7 (`0.34.0`): both got real guided flows** —
      `UndertakeJourneyModal.tsx`/`EnjoyDowntimeModal.tsx`. See item 37 below and CLAUDE.md's Party
      Playbook & Camp section.
21. **`campaigns.gm_user_id`/`characters.user_id`/`memberships.user_id` deliberately have no
    `ON DELETE` behavior**, confirmed with the repo owner during a full-codebase audit pass — a
    full-codebase audit flagged the missing clause (defaults to `RESTRICT`) as worth a conscious
    call rather than an oversight, since a cascade would let deleting one GM's account silently
    wipe every other player's characters/sheets in their campaigns. The app has no in-app "delete
    my account" feature, so this only matters if an admin removes a Supabase Auth user directly —
    kept as the status quo (a hard failure that forces manual campaign/character cleanup first,
    rather than a silent cascade or an orphaned-record `SET NULL` state the rest of the app would
    then need to handle everywhere a GM/owner is read). Revisit if an in-app account-deletion flow
    is ever built — that would need its own explicit pre-delete cleanup step regardless of what the
    FK does.

22. **`zod` and `react-hook-form` (`0.23.0`) are scoped to where they replace real duplicated
    logic, not adopted uniformly across every form in the app.** Character creation is the case
    that justified pulling both in: `apps/server/src/routes/characters.ts` hand-validated ~70
    lines of name/Theme/Virtue-array/Looks/Quest/Skill/Ability rules that had drifted slightly out
    of sync with what `CreateCharacterPage.tsx`'s own client-side checks enforced (two independent,
    hand-maintained copies of the same rules). `packages/shared/src/characterCreationSchema.ts`'s
    `characterCreationSchema(library)` factory is now the single source of truth, consumed by both
    sides — `safeParse()` on the server, `zodResolver()` via `useForm` on the client. Its
    cross-field rule (a Quest can only be picked if it belongs to the chosen Theme) is a
    `.superRefine()`; the dedup-before-validate behavior the original server code had for
    `questIds`/`skillIds`/`abilityIds` is a `.transform()`, kept for parity rather than dropped.
    **`AddParticipantModal.tsx`/`CombatMoveModal.tsx` got a deliberately lighter touch**: only
    their simple, independent fields (`name`/`toughness`/`saveToLibrary`/`templateId` on the
    former; `targetId`/`statusName` on the latter) are `register()`-ed, with no zod schema at all
    — there was no duplicated validation logic to unify, just repeated `<label>`/`<input
    className={styles.input}>` markup better served by the new shared `Field`/`TextInput`/
    `Select`/`NumberInput` primitives (`apps/web/src/components/form/`). Each modal's genuinely
    dynamic array (`limits` in the former, `gambits` in the latter — both grow/shrink rows with
    their own multi-field shape) deliberately stayed plain `useState`, not `useFieldArray`:
    rebuilding already-working, intricate Combat UI state management wasn't this pass's goal, and
    this sandboxed dev environment has no way to click-test a regression in either flow before
    shipping it. `HealStatusModal`/`GiveStatusModal`/`MakeCampModal` share the same byte-identical
    `.label`/`.input`/`.select` CSS this unified `Field`/`TextInput`/`Select` primitive now covers
    (confirmed by exact-string diff before writing `field.module.css`) but were left untouched —
    this PR had no other reason to open them, and forcing every visually-identical form onto the
    new primitives in one pass was a bigger, less reviewable diff than the plan called for.
    Likewise `CreateCharacterPage.tsx`'s own `.fieldLabel`/`.input`/`.select` CSS is a real,
    different design (label stacked above the control, different spacing) from the modal
    convention — left as its own local CSS rather than forced onto the shared primitives, per this
    repo's existing "only byte-identical CSS gets unified" rule (`CHANGELOG.md` 0.4.2); only
    `CheckboxRow` (which had no competing implementation to diverge from) was promoted out of it
    into `apps/web/src/components/form/CheckboxRow.tsx`. **One real cost worth flagging**: `zod` +
    `react-hook-form` + `@hookform/resolvers` land in the app's main JS bundle, not a lazy chunk —
    `CreateCharacterPage` isn't behind `React.lazy` the way `/admin` and `/combat` are (see
    "Frontend conventions" in `CLAUDE.md`), so the ~104 kB raw / ~32 kB gzip these three
    dependencies add (measured directly: 622.71 kB → 726.69 kB raw, 179.89 kB → 211.64 kB gzip,
    comparing a build of this branch immediately before and after this change) ships to every
    player on every visit, not just the one-time character-creation session that actually needs
    it. Splitting `CreateCharacterPage` the same way `/admin`/`/combat` already are would fix this
    but wasn't part of this pass's scope — flagged here as a good candidate next time bundle size
    is revisited, following `CLAUDE.md`'s own "if another route grows large and is similarly rare
    in a typical session, split it the same way" guidance.
23. **Explicit glossary tags (`0.24.0`) use CommonMark reference-link syntax
    (`[Term]`/`[display][id-or-name]`), not a new invented syntax or a Markdown parser.** A
    research question ("is there a Markdown standard for tagging a glossary lookup, rather than
    relying on regex like we do now?") turned up four families of answer — generic directives
    (`:term[Condition]{#g-condition}`, needs a remark/micromark pipeline), MyST (a real standard,
    but belongs to the Sphinx/Jupyter docs toolchain), wikilinks (`[[Condition]]`, widespread but
    not a standard CommonMark will parse), and plain CommonMark reference-link syntax. The last one
    won: it's real, unextended CommonMark (the glossary plays the role of the link-reference
    table), needs no new runtime dependency, and if this app ever adopts a real Markdown renderer
    the authored text already parses as valid CommonMark rather than needing a second migration.
    **The rule that makes migration free**: a field containing at least one explicit `[...]` tag
    disables the regex auto-linker for that *entire* field, not just the tagged occurrence — see
    `scanExplicitTags()`'s doc comment in `packages/shared/src/glossary.ts`. That answers "don't
    link this occurrence" (problem 1 the auto-linker couldn't express) without inventing a second
    "don't link this" marker: an author who wants one occurrence unlinked writes `\[Word]`
    (a literal bracket, standard CommonMark escaping), which alone is enough to flip the whole
    field to explicit mode. `GameSettings.GlossaryAutoLink` (default `true`) is a separate,
    library-wide kill switch for retiring the regex matcher entirely once content has migrated —
    explicit tags keep resolving either way, since they never depended on the regex pass. Full
    Markdown rendering (headings, lists, images, tables) was explicitly **not** adopted: the 65
    existing `GlossaryText` call sites all take plain strings and render span-level, and Content
    Admin's validation panel now surfaces an unresolved tag (`findUnresolvedGlossaryTags()`) rather
    than needing a preview of block-level markup — real scope with real design consequences,
    not what was asked.
24. **CSS container queries (`0.24.0`), not another round of hand-derived viewport breakpoints, for
    panel-internal layout.** CLAUDE.md had already named this exact footgun before any code
    changed: "a panel inside `.sheet-col` cannot assume viewport width is its own width once 768px
    is crossed" — `StatusesPanel.module.css`'s existing 1024px breakpoint math is a long comment
    deriving that number by hand from `.sheet-grid`'s column ratio, re-derived (and gotten wrong
    once, per `CHANGELOG.md` `0.22.0`) every time the sheet layout moved. Two pieces of this pass's
    own feedback collided head-on without a real fix: Abilities & Skills becomes a half-width
    column at 768px (~350px of content) *and* was asked to run two items per row at "medium screens
    and higher" — two ~170px columns is not a layout. `Panel.module.css`'s `.panel` class is now a
    named container-query container (`container-type: inline-size; container-name: sheet-panel`)
    for every panel's own measured content-box width, chosen over containing at `.sheet-col`
    (offered as the alternative in the plan) so a full-width band (Advancement) and a paired
    half-width panel (Abilities & Skills, Load) share one mechanism rather than needing two.
    `AbilitiesSkillsPanel`'s two-up list, `LoadPanel`'s tiers/items split, and
    `AdvancementPanel`'s Potential|Rapport pairing all query `@container sheet-panel (min-width:
    …)` — each threshold worked out from the actual content that needs to fit (a `Pips` row's
    coarse-pointer width, a readable two-column prose measure), not guessed and then patched.
    **Deliberately not converted in this pass**: `StatusesPanel.module.css`'s own existing 1024px
    media-query math — it works, it's already heavily commented, and converting a working,
    hairy layout inside the same pass that ships new feature work is exactly how the `0.22.0`
    overlap regression happened. Flagged as a follow-up (see `WorkPlan-0.24.0.md`'s "Open items").
    Media queries stay for genuinely page-level decisions (how many columns `.sheet-grid` has, the
    app bar, Content Admin's panes) — the split going forward is page structure = media query,
    panel internals = container query.

25. **`.action-grid` (`0.25.0`) uses CSS Grid `auto-fit`, not a container query, to distribute a
    row of peer buttons.** `WorkPlan-0.25.0.md`'s mobile-cleanup pass found 63 `flex-wrap: wrap`
    declarations across 31 stylesheets and exactly one `repeat(auto-fit, minmax(...))` grid in the
    whole app — `flex-wrap` on content-sized buttons isn't a layout, it's an overflow fallback:
    each button wraps wherever its own label runs out of room, `justify-content`'s `flex-start`
    default leaves every wrapped row ragged-right, and leftover space collects at the end of the
    last line. `0.24.0` had just made every `Panel` a container-query container, which made a
    container query the obvious first reach for this too — rejected once the arithmetic was
    worked through: a container query still needs someone to derive the right px threshold from
    the widest label plus gaps plus padding (`StatusesPanel.module.css`'s 1024px comment is 40
    lines of exactly that derivation, redone three times across three versions as the sheet layout
    moved around it). `auto-fit` computes the column count from the real content every time, with
    no threshold to pick or get wrong. The two tools aren't interchangeable in general —
    container queries stay the right choice for *rearranging* a layout (Abilities & Skills going
    two-column, Load splitting tiers from items), where the question is "how should this
    reflow," not "how many equal-width columns fit." `.action-grid` only answers the second
    question. One real gap found implementing it, not anticipated by the plan: `--action-min`'s
    150px default (matching the plan's own stated value) never actually reached two-up for any
    row nested inside a `Panel`'s own padding — checked against a real screenshot rather than
    trusted from the arithmetic, the same lesson `StatusesPanel.module.css`'s comment already
    documents about this codebase's history of unverified breakpoint math. 130px does, without
    truncating the longest label found at any call site (`AdvancementPanel`'s "Propose +1 Kin").
26. **The glossary tooltip's nesting depth is capped at zero, not one, and "See also" chips replace
    the second level (`0.25.0`).** The original design let a definition's own text re-link into
    another bubble one level deep (`MAX_DEPTH = 1`) — intended as "one nested level, then stop."
    It never actually worked: `GlossaryText.tsx`'s `DefinitionText` passed a hardcoded `1` into
    every nested `linkifyText` call instead of `depth + 1`, so the depth counter never advanced
    past 1 no matter how many bubbles deep a chain of definitions went — Kin → Bond → Kin → …,
    exactly the runaway nesting a repo-owner screenshot reported. Rather than just fixing the
    counter and keeping one real nested level, the repo owner's read on the screenshot was that
    even a *correctly capped* single nested level was already one too many for a small tap-to-
    reveal bubble — so `MAX_DEPTH` dropped to `0` (no bubble ever opens a second bubble) and
    definitions gained a "See also" row instead: the other terms a definition mentions, as chips
    that open the new Glossary drawer (`GlossaryDrawer.tsx`, section D of the same plan) at that
    term rather than nesting further. The chip list is computed by a second `linkifyText` call
    fixed at depth 0, independent of the (now depth-capped) call used to render the definition's
    own text — calling the same already-existing function twice with different depths, not new
    matching logic, and the second call can't reopen the nesting problem since a chip opens the
    drawer rather than another bubble. The depth-cap fix incidentally closed a second, unrelated
    bug: the old past-depth early return (`return [{ text }]`) skipped `scanExplicitTags`
    entirely, so a definition authored with `0.24.0`'s `[display][id]` tag syntax would leak raw
    bracket syntax into a bubble the moment it stopped being linkified. The fixed early return
    still runs tag resolution and flattens the result to plain text (stripping any `term`
    reference, since no tap-target belongs this deep), so the fix and the depth-cap change are one
    commit rather than two coincidentally-related ones.
27. **A second UI look is "Appearance," not "Theme," and Notice Board is a deliberate, scoped
    reversal of two of Parchment's own stated design rules (`0.26.0`).** `WorkPlan-0.26.0.md`
    (repo-owner brief, merged docs-only as PR #94 before this implementation) named the new
    switchable-look system "Appearance" specifically to avoid colliding with this app's existing,
    unrelated use of "Theme" as a game term (`CharacterSheet.Theme`, `ThemePanel.tsx`,
    `library.themes`) — `AppearanceId`/`AppearanceDef`/`useAppearanceStore` in
    `apps/web/src/lib/appearances.ts`/`apps/web/src/store/appearanceStore.ts` never share a name
    with anything in `packages/shared/src/types.ts`'s game model, and the `<select>` picker
    (`AppShell.tsx`) is captioned "Appearance," not "Theme," for the same reason. Separately,
    `AppThemeGuidelines.md`'s original design philosophy states outright "No wood grain... no drop
    shadows pretending to be a physical object on a desk" — both of which Notice Board's corkboard/
    pinned-paper metaphor needs to look right (`--ground-texture`'s worn-plank gradient,
    `.posting`'s `--posting-shadow`). Rather than quietly contradicting the doc or diluting the
    rule for both appearances, `AppThemeGuidelines.md` was rewritten (not edited) to keep the
    original philosophy verbatim as Parchment's own still-binding rule, add a dated "Notice Board's
    reversal" section naming exactly which two rules are reversed and why, and state explicitly
    that both reversals are scoped to Notice Board's own tokens (`appearances.css`) — Parchment's
    `tokens.css` values, and the philosophy governing them, are untouched. The judgment call here
    isn't the reversal itself (that was the repo owner's own brief, not an interpretation), it's
    treating a "no exceptions" design rule as amendable-per-appearance rather than either breaking
    it silently or refusing to build what was actually asked for — see `AppThemeGuidelines.md` for
    the full reasoning and CLAUDE.md's "Architecture: appearances" section for the token-tier
    mechanism that keeps the reversal from leaking into Parchment.
28. **React Server Components and TanStack Start were evaluated and declined
    (`TechStackAudit.md`, 2026-08-16).** A direct repo-owner question prompted a full audit rather
    than a quick answer. The verdict rests on three independent grounds, any one of which would be
    enough alone: (1) this app is 100% authenticated with no SEO surface, so RSC's headline benefit
    doesn't apply; (2) the session token lives only in `localStorage`
    (`apps/web/src/lib/supabaseClient.ts`, no cookie anywhere in the repo) — making RSC possible at
    all would require migrating to cookie-based Supabase Auth, which introduces a CSRF attack
    surface this app is currently immune to by construction (no page can attach a bearer token it
    has to read out of this origin's own `localStorage`); (3) RSC's model — stream rendered output
    from the server on every data change — inverts against this app's actual hot path (optimistic
    local mutation via TanStack Query, reconciled by a Supabase Realtime push over an already-open
    WebSocket), so adopting it would make Combat and live sheet editing *slower*, not faster.
    TanStack Start was evaluated separately: it reached 1.0 in March 2026 without RSC support (so
    "adopt Start to get RSC" is incoherent as of this writing), and its own core value — a typed
    client/server boundary — duplicates what `packages/shared`'s zod schemas already provide (item
    22 above), while colliding with the authorization-in-Express-layer design (CLAUDE.md's opening
    section). TanStack Router alone got a genuine look too and also lost, on measurement rather than
    principle — the router surface is ~20 call sites with one route param in the whole app, and its
    headline benefit (loader prefetching) can't reach the app's actual waterfall, which is
    `App.tsx` blocking the whole tree on `useMe()` *above* the router. **Reopen conditions, not a
    permanent refusal**: the app grows a genuinely public surface (a shared read-only sheet, a
    public campaign log); Supabase ships cookie-based SSR auth with CSRF protection built in rather
    than left to the integrator; TanStack Start ships RSC with a story for running alongside an
    existing Express API; or `@vitejs/plugin-rsc` reaches 1.0 with this repo carrying web test
    coverage worth trusting a migration to. The audit's other half — sixteen ranked, smaller
    recommendations found while tracing what RSC would have needed (a server-side N+1, every user
    row shipping to every client on every campaign load, a two-round-trip cold load, adopting React
    Compiler, etc.) — was scoped and approved separately; see `CHANGELOG.md`'s `0.27.0` entry for
    what actually shipped from that list, and `HANDOFF.md` for the one item (local JWT verification)
    left deliberately unimplemented.
29. **`A Story of Heroes and Villains V0.5`** (now `Planning Docs/archive/Ruleset-V0.5.md`, adopted
    `2026-09-01`) is the first complete ruleset ever actually committed to this repository, and it
    supersedes almost everything this app was built against. It replaces the six rules files this
    project used until now — `TheBasics.md`, `TheGear.md`, `Advancements.md`, `TheMoves.md`,
    `TheSkills.md`, `TheArc.md` — all moved to `Planning Docs/archive/` with a SUPERSEDED banner
    rather than deleted (see `Planning Docs/archive/README.md` for what each covered, and item 8
    above for why `Advancements.md` in particular was this project's most load-bearing single
    source). It also supersedes the "large, messy running design doc" item 12 cited for Combat
    Basics V2.2, Gambits, Toughness, and enemy stat blocks — which item 12's own update above
    records was never actually committed to this repository at all. V0.5 is adopted as canon
    outright, not reconciled decision-by-decision against the old sources, because there is no
    older, more authoritative document left standing to reconcile it against.

    This branch is documentation-only: no source file changes, no version bump, no `CHANGELOG.md`
    entry — the version stays `0.27.0`, following the precedent of `WorkPlan-0.26.0.md` and
    `TechStackAudit.md` (item 28 above), both written at a stable version ahead of their own
    implementation work. The actual code migration is staged into nine slices in `WorkPlan-V0.5.md`
    — **none of it is built yet**; every V0.5 behavior cited anywhere in this document carries its
    own not-yet-built marker and a slice number for exactly that reason.

    A handful of decisions were locked with the repo owner before any of the V0.5 planning or
    migration work began, precisely so they would not need re-litigating slice by slice:
    - **Combat stays theater-of-the-mind Range bands, not V0.5's own real map** — see item 15's
      update above; the repo owner re-affirmed bands having actually read V0.5's grid, rather than
      the band model merely predating it.
    - **`Kin` renames to `Bond`** (the track, and `Bond Level`) throughout code, matching V0.5's
      own preferred name over its two other names for the same track ("Kin," "Kith") — see items 8
      and 20 above.
    - **Existing play data is a clean break.** No JSONB translation/migration logic converts an
      old-shape `CharacterSheet`/`Bond`/`Party` into the new one. Every sheet in the live database
      is pre-release test data; slice 1 wipes it rather than writing throwaway migration code for
      records nobody needs kept. **Done 2026-09-02** — as a single campaign-level delete (every
      play-state table cascades from `campaigns`), run after slice 1 was merged and deployed rather
      than before it, so the new shapes were live before anything wrote data in them again.
    - **GM tooling is fully in scope for this migration**, not the kind of scope this project has
      historically deferred pending a later decision (item 20's Wealth/Treasure earn mechanic is
      one example) — Clocks, Villains/NPCs/Locations, and full Adventure prep are real, numbered
      slices (6, 8, and 9 respectively), not aspirational line items.
    - **The first code slice is rules primitives, not a visible feature.** Slice 1 settles the wire
      contract — the Status box model, the Bond rename, Rapport-as-Aid, Recoveries-0 → Exhausted —
      before any screen gets rebuilt on top of it, on the reasoning that a type/shape change every
      later slice touches should happen once, first, rather than being threaded through screens
      that then need touching a second time.

    See `WorkPlan-V0.5.md` for the full nine-slice table and `HANDOFF.md` for the rules questions
    V0.5's own text leaves unresolved (Bond/Kin/Kith naming inside the book itself,
    Crumble/Fall/Dishonored naming, the Level-vs-Tier gate from item 20 above, and others) that
    block or complicate individual slices.

30. **Slice 4 (Improvements, `0.31.0`) needed two repo-owner decisions before any code, not one —
    the Level-vs-Tier gate everyone already knew about, and a deeper content gap nobody had
    actually gone looking for until this slice started.**

    First, the content gap: `Ruleset-V0.5.md`'s "Hero Improvements" section names all 25 trees (11
    Combat + 14 Narrative) with a one-line theme each, but authors zero actual nodes on any of
    them — no Starting Improvement, no prerequisite line, nothing. "Party Motif + Improvements" and
    "Bond Track + Improvements" are each a single line ("Here that is!") with nothing under them at
    all, not even tree names. The repo owner chose **"build the real mechanism now against
    clearly-labeled placeholder nodes"** over waiting for real content to be authored first —
    `seedLibrary.ts` gives all 25 Hero trees two placeholder nodes each (a Starting Improvement plus
    one chained node), enough to exercise the DAG gate and its Content Admin validation end to end,
    with `Effect` text that says "Placeholder" rather than inventing mechanics that don't exist in
    the source document. Party and Bond Improvements got no such placeholder treatment — there are
    no tree *names* to hang one off, and inventing them would mean inventing slice 7's Party Motif
    data model too, so both stayed out of scope: a full Rapport track clears via a plain
    `ConfirmModal` (raising `PartyLevel`) rather than opening a picker with no real options in it.

    Second, the Level-vs-Tier gate itself (item 20 above, `HANDOFF.md` open issue 12): once slice 4
    went looking for where V0.5 actually states the Hero Improvement gating rule, it found the rule
    stated twice, contradicting each other. The current, unambiguous version ("Motif Advancement —
    Potential," the section this app was already built against since slice 2) gates purely on the
    prerequisite DAG — no Tier, no Level, at all. A separate, older-reading "Level Up" section
    (under Make Camp) states the Tier-1..4-and-Level formula that reproduces the pre-V0.5
    `Advancements.md` contradiction verbatim. Rather than guess which section the repo owner meant
    to keep, both readings were put to them directly (`AskUserQuestion`, not inferred): **drop the
    Tier/Level gate as leftover, unreconciled draft text and gate purely on the DAG** — the same
    "doc contradicts itself, pick the reading that's actually usable and document why" call already
    made for Bond/Kin/Kith (item 8). `CharacterSheet.Level`/`Party.PartyLevel` still exist as plain
    counters (both doc sections agree a Level/PartyLevel value should go up), they just gate
    nothing — a deliberate half-adoption of a self-contradictory rule, not an oversight.

    The lesson worth carrying into slices 5-9: **a slice's own WorkPlan entry describing what it
    will build is not the same as confirming the source document actually contains what's needed to
    build it.** `WorkPlan-V0.5.md`'s slice 4 row said "25 trees seeded with a validated prerequisite
    graph" as if the trees' content already existed to seed from Section D's gate question — it
    didn't, and that gap was invisible until someone actually opened the "Hero Improvements" section
    looking for node text to type in.

31. **Slice 5 (Combat update, `0.32.0`) put four findings to the repo owner before writing any
    code, following item 30's own lesson** — an Explore agent catalogued the shipped Combat
    implementation precisely first, rather than trusting `WorkPlan-V0.5.md`'s paraphrase of what
    needed to change.

    **Boss Enemies get minimal wiring, not a full mechanism.** `Ruleset-V0.5.md`'s Boss content
    (Grizza's "Fall to my Power!", "Fearsome Yell," and similar) is bespoke per-boss flavor text,
    not a generalizable system — there's no shared formula to extract the way Engage's tier table or
    Toughness's Rank math already were. Building a real "Boss ability" engine would mean inventing
    mechanics the doc never specifies. The repo owner chose the same shape slice 4 used for its
    placeholder Improvement nodes: build the plumbing (`IsBoss`, a numbered `GambitCharges` pool, a
    derived Last-Stand badge reusing the existing per-Status-Limit defeat check without auto-setting
    `Defeated`) and leave the actual abilities as freeform GM narration cued by that plumbing, rather
    than inventing mechanical content the source document doesn't provide.

    **Per-unit turn order was chosen over keeping the single `ActingSide` toggle**, once V0.5's
    actual text ("Heroes should choose the order each round that best fits their current strategy,"
    sides alternating with the larger side's leftovers acting consecutively, two Heroes able to act
    as one pick) turned out to need more than a binary flag to represent at all — `ActingSide` alone
    can say whose *side* goes, not who specifically, and can't express a pair moving together.
    `Encounter.ActingParticipantId`/`PairedParticipantId` plus `nextActor()`'s suggestion-only side
    computation were confirmed with the repo owner as the right shape before implementation, on the
    same "track-and-display, GM can always override" footing as every other Combat control.

    **Repel's `0.15.0` freeform-only decision (item 16) is reversed, not superseded by accident.**
    That decision's own stated reasoning was "a Rank number isn't the same unit as a Range band" —
    true at the time, since no space-to-band conversion existed yet. Slice 5 needed to formalize
    exactly that conversion anyway (to document `shiftRange()`'s ratio against V0.5's real space
    counts, item 15's still-standing call), and once it existed, the reason to leave Repel
    unautomated no longer held. Put to the repo owner rather than assumed: automate it.

    **Resist is a standalone Reaction, not a per-card control gated on a persisted pending push.**
    The plan's first draft imagined mirroring `PendingStatusOffers`' shape — a new
    `Encounter.PendingForcedMoves` array the target's own client resolves asynchronously, matching
    how a Status offer must be async since only the target's own session may write their sheet.
    Range doesn't have that constraint: `CombatParticipant.Range` lives on the Encounter, which any
    campaign member may already write via a trusted whole-document PUT (see `reposition()`, callable
    by the GM on anyone including a PC target). Building a second async offer type for a field with
    no ownership restriction would be a real scope increase for no correctness gain. Resist instead
    reuses the same manually-triggered, self-reported pattern Opportunity Attack already established
    ("whether the fictional trigger happened is a table judgment call") — a standalone button in the
    Reactions section, visible whenever the viewer has a participant in the fight, asking how many
    bands they were pushed and reducing that by their own Mettle via `resistForcedMovementBands()`.

32. **Cover is a "pick any of the target's own Positive Statuses" control, not a hardcoded
    name-match against "Cover"/"Hidden"/"Invisible."** V0.5's own Cover examples are illustrative —
    the doc doesn't claim they're the only Statuses that can blunt an incoming hit, and this app's
    whole Status model treats every Status as author-defined free text (`giveStatus()`'s `Name` field
    has never been a closed enum). Pattern-matching specific names would silently fail for a table's
    own homebrew Status ("Behind the Barricade," "Smoke Cover") that means the same thing
    mechanically. `CombatMoveModal.tsx` instead lists whatever Positive Statuses the target actually
    holds and lets whoever's resolving the roll pick the relevant one (or None) — same transparency
    principle as `StatusSources` already showing every Status affecting a roll rather than curating
    a subset.

33. **The Combat-start Rapport modifier (`HANDOFF.md` open issue 13) was answered by `0.28.0`'s own
    Bond/Kin/Kith precedent, not re-litigated**: V0.5's Combat Loop step 1 states two clearly
    mutually-exclusive branches ("If the Heroes initiate... add 1... If the Heroes did not initiate
    and are ill-prepared... remove 1 *instead*") rather than three independent bonuses, so
    `combatStartRapportDelta()` was written as a two-branch function from the doc text directly, with
    no ambiguity requiring a repo-owner call this time — unlike the Bond/Kin/Kith or Level/Tier
    questions, this part of V0.5's text was internally consistent on a first close reading.

34. **`CLAUDE.md`'s "not built" claims for Armor-costs-AP-in-Combat and the Help Reaction Move were
    themselves wrong, found only because slice 5's pre-code Explore pass re-verified every claim
    against the actual shipped code rather than trusting the doc's own prior text.** Both had shipped
    correctly in `0.16.0`/`0.18.0` respectively; the doc simply never got updated to say so. Recorded
    here as the same class of gap item 12/17/25/30 keep finding — a correctly-built feature whose own
    documentation silently drifted false — rather than as a new decision, since no repo-owner input
    was needed to fix a description that disagreed with code already in the repository.

35. **Clocks (slice 6, `0.33.0`) collapse to three `Kind`s, not the doc's six named variants —
    confirmed with the repo owner before any code, not assumed from `WorkPlan-V0.5.md`'s own
    paraphrase.** `Ruleset-V0.5.md`'s "Clocks" chapter is explicitly marked "WIP" in the source
    text itself and gives only the base "Basic Clock" a complete mechanic (Success/Failure tracks,
    a Hero risking 1-3 Headway before rolling, a 10+/7-9/6- result table). The other five —
    Threat/Quest, Long-Term Project, Progress, Linked, Mission, Tug-of-War — are each described
    only as "a single track a GM ticks 1-3 on their own judgment" or "a single track that can also
    go down," with no mechanical difference stated between most of them; the doc even asks itself
    "\[Threat/Quest\] are these the same thing?" without answering, the same shape of
    self-contradiction as Bond/Kin/Kith (item 8) and Crumble/Fall/Dishonored (item 2).
    `WorkPlan-V0.5.md`'s own "done looks like" bar for this slice already sanctioned collapsing
    variants behind a flag rather than inventing six shapes — put to the repo owner as a concrete
    proposal (three `Kind`s: `Basic`, `Countdown` covering the five thin variants as one GM-ticked
    track, `TugOfWar` as that same track allowed to move down) rather than assumed, and confirmed
    as the recommended option. Linked Clocks are not a fourth Kind: `Clock.UnlocksClockId` is a
    plain forward-pointing reference (a prerequisite Clock names the Id of the Clock its own Success
    resolution unlocks), checked by `isClockLocked()` — deliberately still *displays* a locked
    Clock rather than hiding it, since the doc's own example ("a linked clock called 'Trapped'
    after 'Alert' fills") reads as the GM pre-announcing what's coming, not concealing it.

36. **The Clock-failure spend menu (up to 4 Headway, 1-for-1, on four listed effects) stays
    freeform and logged rather than mechanically enforced — a real scope boundary put to the repo
    owner, not a default assumed for expedience.** Two of the four effects grant "Advantage/
    Disadvantage Forward," V0.5's term (also seen in Discern the Truth's "+1 Forward") for a bonus
    that applies specifically to the very next roll — a concept this app has never tracked across
    rolls; Advantage/Disadvantage itself stays purely informational except for two narrow,
    already-built triggers (item 20). Building real Forward tracking would mean a new persisted
    per-character pending-roll-modifier concept, consumed and cleared by whichever roll comes
    next — a genuinely new cross-cutting mechanic, not a Clocks feature specifically, and a real
    scope increase the repo owner confirmed wasn't worth taking on this slice. Choosing a spend
    option just logs the choice to the Clock's own History; the table enacts it same as any other
    freeform Combat log entry (Seize/Other Gambits, item 16).

37. **Slice 7 (Party Identity & Camp, `0.34.0`) put three decisions to the repo owner before any
    code — Camp Assets, the Project Clock hookup, and Party identity fields — plus caught a near
    duplicate before it shipped.** Camp Assets needed a genuinely new UI shape rather than either
    of this app's two existing authored-content patterns: a pure library pick can't let a table
    write their own on the spot, and Combat's ad-hoc-or-library `AddParticipantModal.tsx` pattern
    carries an admin-only "save to library" option a player-run Camp flow shouldn't inherit. The
    repo owner's own suggestion — an autocomplete field, freeSolo — became a plain text input
    backed by a native `<datalist>` of `library.campAssets` names, with no new dependency: typing a
    catalog name autofills and links `RefId`; anything else stays a fully custom entry.
    "Progress a Personal Project Clock" was confirmed to wire into the real Clocks subsystem
    (`tickClock()`) rather than stay a freeform logged note, since Clocks aren't ownership-gated.
    Party Motif/Quest/SkillTags/WeaknessTags/Path/Goal were confirmed as freeform text — V0.5 named
    no catalog to pick from for any of these, the same "don't invent unwritten content" principle
    already applied to Quests and Bond Moves before any catalog existed for those. Separately, this
    slice's own first pass at Make Camp started rebuilding personal-resource clearing (Status Rank
    reduction, Armor refresh, Recoveries refill) before discovering `StatusesPanel.tsx` already had
    a working "Make Camp" button doing exactly that — a live reminder that "not mentioned in
    CLAUDE.md's shipped-feature prose" isn't the same claim as "not built," and worth a grep before
    assuming either.

    **Follow-up, same session: this slice's own name needed correcting.** The repo owner confirmed
    directly, after `0.34.0` shipped, that Playbooks aren't part of the game's systems at all —
    not merely unwritten yet, as `Ruleset-V0.5.md`'s own "Coming Soon" text for "Hero Moves and
    Playbooks" implied. Two consequences: **Hero Moves are cut, not deferred** (they were the one
    thing in the doc naming Playbooks as their own foundation — see the "Hero Moves" bullet below,
    moved out of "planned, not built" accordingly), and this slice's own name stops using "Party
    Playbook" in every living doc going forward, since nothing it built ever implemented an actual
    Playbook mechanic — it's freeform party identity data that happened to be introduced under that
    name. Already-shipped history (`CHANGELOG.md`'s `0.34.0` entry, `HANDOFF.md`'s forty-sixth-
    session note, this item's own header above) keeps the original wording; only the living
    description of the *feature* changed, not the record of what shipped when.

38. **Slice 8 (GM stat blocks, `0.35.0`) needed no repo-owner decision — the scope named in
    `WorkPlan-V0.5.md` ("extending the existing `library.enemies` pattern") was specific enough to
    build directly, unlike every slice since 4.** Three new interfaces (`Villain`, `NPC`,
    `Location`, `packages/shared/src/types.ts`) plus three matching `schema.ts` collection defs were
    enough to get full CRUD/validation/nav for free from Content Admin's existing generic
    machinery — the same "zero new plumbing beyond a `schema.ts` entry" precedent `CampAssetTemplate`
    set in slice 7. The one real design choice this slice made on its own: `EnemyTemplate.
    StatusLimits` — already flagged by `WorkPlan-V0.5.md` Section B hazard 1 as unvalidated raw
    `json`, and called out there as the field slice 8 was "most likely" to actually need to fix —
    got retrofitted onto the same new `statusLimits` `FieldType` built for `Villain`/`NPC`, since a
    real structured `{StatusName, Limit}[]` editor (`StatusLimitsEditor` in `FieldEditor.tsx`) and
    its shape validation (`adminLogic.ts`'s `validateLibrary()`) already existed once the two new
    collections needed them — extending it to the pre-existing field cost nothing extra and left no
    raw-JSON Status Limits field anywhere in the schema. Deliberately **not** done, and flagged as
    real future scope rather than an oversight: a Villain still cannot be spawned into a live Combat
    Encounter as a Boss `CombatParticipant` — `Villain` reuses `ToughnessTier`/`EnemyStatusLimit` so
    the *data shape* would line up if a later slice wants to bridge the two, but building that bridge
    is genuinely new scope (a `RefId`/spawn path, `AddParticipantModal.tsx` UI, a decision about
    whether a Villain's narrative-only fields like `Goal`/`Scar` even belong on a `CombatParticipant`)
    that `WorkPlan-V0.5.md`'s own "authored Content Admin collections" framing for this slice doesn't
    ask for. Seed content (one Villain, two NPCs, three Locations) is drawn from `Ruleset-V0.5.md`'s
    own worked Grizza-the-Tall example and the Concept/Hook text introducing her, not invented from
    scratch — see CLAUDE.md's "Architecture: GM stat blocks" section for exactly which seeded fields
    come from the doc verbatim versus are reasonable fill-ins attributed as such.
39. **Slice 9 (Adventures, `0.36.0`) tried a real linked `Clock` for the Countdown first, and
    reversed that design mid-slice once its consequences became clear — the one design this
    migration has walked back on its own, without a repo-owner round, rather than shipped it.**
    `WorkPlan-V0.5.md`'s own scope note reads "a Countdown is a clock variant," and the obvious
    first cut was exactly that: `Adventure.CountdownClockId` pointing at a real `Clock` row (`Kind:
    'Countdown'`), created alongside the Adventure so "includes a working Countdown" would be true
    the instant one existed — mirroring `combat.ts`'s own "create two things in one request"
    pattern for Encounter+Rapport. That fell apart on a fact every other Clock in this app gets to
    ignore: every existing Clock is fully player-visible by design (`ClocksPanel.tsx` renders for
    both GM and Player, and `useLiveCampaign.ts` Realtime-syncs the table to whoever's
    subscribed), but an Adventure's own Countdown is explicitly the GM's *off-screen* reference
    ("what is happening with the Villain when they are off-screen" — the doc's own phrase,
    distinguishing it from a *Threat*, also Countdown-kind but explicitly "player facing"). A
    linked Clock would have leaked through two channels at once: the shared `clocks` list a Player
    already sees in full, and — worse — `useLiveCampaign.ts`'s Realtime subscription, which
    delivers a `postgres_changes` payload's *entire row* to every subscribed client regardless of
    whether the handler reads it, meaning even a client that never renders the Clock's data would
    still receive it over the wire the instant the GM ticked it. Rather than invent this app's
    first field-level access-control mechanism (a `Hidden`/`GMOnly` flag on `Clock`, threaded
    through `listClocksForCampaign`, `ClocksPanel`, and the Realtime hook) to patch a leak in a
    subsystem slice 6 built with a different trust model in mind, slice 9 backed the design out
    entirely: `Adventure.CountdownMarks`/`CountdownSteps` embed the count and the five named steps
    directly on the Adventure document, and `tickAdventureCountdown()` (`adventures.ts`) reuses
    `Clock`'s own clamped-delta tick math as a small standalone function rather than a shared call
    into `clocks.ts` (the two operate on different, incompatible shapes). This keeps the entire
    Countdown inside the same GM-only boundary the rest of the Adventure already needs — see the
    next paragraph — with zero new access-control surface. A genuine Threat a GM *wants* players to
    see stays exactly what it always was: a real `Clock`, created directly through `ClocksPanel`,
    untouched by any of this.

    **The same leak risk is why Adventures are GM-only end to end — the first content in this app
    with no player-facing view at all, not a scoped-down one.** Every prior slice's "track and
    display" philosophy assumed the whole table should see the same state; an Adventure's Concept,
    Villain, and especially its floating Secrets (`Revealed: boolean` is GM bookkeeping — "has this
    come up in play yet" — not an access gate on its own) are spoiler content by the doc's own
    design ("never plan the explicit way the Heroes will uncover" a Secret). Rather than build a
    partial player view that carefully omits unrevealed Secret text (itself another field-level
    redaction mechanism, and one that still wouldn't be safe over Realtime for the same reason as
    above), the whole surface stays GM-only: `campaign.ts`'s bootstrap route only fetches
    `adventures` for a GM membership (the same conditional-fetch shape `invites` already uses for
    Players), all three Express routes (`adventures.ts`) require `Role === 'GM'` — unlike Clocks,
    where any campaign member may act — and `AdventuresPage.tsx` redirects a Player who navigates
    to `/c/:campaignId/adventure` directly. `useLiveCampaign.ts` deliberately does **not** subscribe
    to the `adventures` table at all, on the same Realtime-leaks-full-rows reasoning above; since
    only the GM ever edits an Adventure, a GM's own page just refetches normally and loses nothing
    by skipping live-push. A migration (`0012_adventures.sql`) still gives the table the same
    joinless membership-scoped RLS SELECT policy every other play-state table gets, for the same
    repo-wide reason stated in `0001_init.sql`'s design note (every table gets RLS regardless of
    whether this app's own client ever queries it directly) — not because anything here relies on
    it for the GM-only boundary, which is enforced entirely in the Express layer per this app's
    standing authorization pattern.

40. **`WorkPlan-0.37.0.md` put three decisions to the repo owner before any code — the invite
    email send path, what stays out of the copyable-link/resend UI, and how far "write-in
    answers" should reach — and a codebase audit closed a fourth question (the Adventure panel's
    six requested cleanup items) before any of it was written.** The invite-email decision: a
    **dual send path**, Supabase Auth's `inviteUserByEmail` for an address with no account yet,
    Resend for one that already has one — neither provider alone covers both cases, and this
    wasn't a free technical choice so much as a confirmation that no simpler single-provider
    design was actually available. The scope decision: the GM invite UI gains a copyable link and
    a resend button, but **persisted per-invite delivery status was offered and not selected** —
    so the feature needed no migration, and a send/resend's `delivery` result is transient,
    carried in the response only. The write-in decision: "write-in answers" means **free text on
    fixed-choice fields only** — `NPC.Type`/`Location.LocationType` gained an opt-in `allowCustom`
    flag, while custom user-defined fields per entry, glossary auto-linking on the three GM
    stat-block collections, and player-facing NPC/Location views were all offered and not
    selected. Treat all three "not selected" items as decisions, not an unfinished TODO — don't
    build them without a fresh repo-owner ask.

    **The Adventure-panel item needed no repo-owner decision, because a pre-code audit found half
    the request was already satisfied.** Three of six requested cleanup items — touch targets,
    appearance-token cleanliness, and page/nav chrome consistency — were verified against the
    actual code (`grep` for hardcoded colors, the responsive smoke test's own touch-target
    assertion, a direct comparison against `CombatPage.tsx`'s chrome) and found already correct;
    doing that work again would have been pure churn. The three real gaps — no responsive layout
    at all on the panel (a `640px`-capped stacked column at every width from 360px to 2560px),
    flat heading structure, and a genuinely unlabelled `<select>` — got the same treatment `0.24.0`
    already established for `AbilitiesSkillsPanel`/`LoadPanel`: a named CSS container on the card,
    `@container` pairing its NPCs/Locations ref-lists once measured wide enough, rather than a
    hand-derived viewport breakpoint. See `CLAUDE.md`'s "Architecture: campaign invites" section
    and `WorkPlan-0.37.0.md` for the full writeup of all four.

41. **`0.40.0`'s sheet density pass put five decisions to the repo owner before any code, and the
    binding constraint on three of them was arithmetic rather than taste.** The feedback was four
    iPhone screenshots: wasted space in Party Identity, oversized Status cards with overflowing
    text, the same squished feeling in Background/Motifs, and Looks chips that each took a row
    while rendering *larger* than the labels above them. The first decision was scope — a
    **systemic pass** (a real type and spacing scale, plus shared primitives, re-applied across
    four panels) rather than four targeted fixes, on the grounds that the complaints were four
    symptoms of one cause: the app had colour and font tokens but nothing dimensional, so size was
    the one axis its own `theme-tokens` skill could not enforce, and 19 distinct font sizes had
    accumulated in the sheet feature alone.

    **The Status row could not be built as literally requested, and measuring is what established
    that.** The ask was "the name and the pips on the same line, with the rank number shown in the
    filled pip instead of separately". The rank-in-the-box half is exactly what shipped. The
    same-line half runs into `responsive-smoke.mjs`, which requires every
    `button, a, input, select, textarea` to hold its own 44×44 non-overlapping hit area on a touch
    viewport: six tappable boxes therefore claim ~244px, against a *measured* 226px of row content
    at a 360px viewport under Notice Board. A name and six individually tappable boxes cannot share
    that line, at any font size. Two consequences were confirmed with the repo owner rather than
    guessed: the boxes **collapse behind a single rank chip that expands them** on a narrow row,
    and short authored text stops being rendered as a permanently-live `<input>` app-wide. The
    second is what actually buys the width — not by escaping the 44px floor (a read-only pill is
    still a `<button>` and still needs it) but by halving the *number* of controls per value.

    **Two of the numbers in the approved plan were wrong, and the browser corrected them.** The
    plan asserted 214px of row content (it is 226px) and that Statuses fell 6px short of three
    columns at 2560px (it has 15px of slack). Both came from arithmetic over token values; both
    were replaced by a scripted probe against the real harness. That probe also surfaced a latent
    bug no one had reported: `.statusGroups`' `minmax(290px, 1fr)` floor exceeded the 274px panel
    at 360px, so the board overran the panel's own padding — invisible to the smoke test, which
    only checks *document*-level overflow. `min(430px, 100%)` fixes the class of bug, not just the
    instance.

    **The column floor and the row layout had to be derived together, which the plan did not
    anticipate.** Raising the floor to 430px looks like a wide-screen tweak in isolation; it is
    actually what makes the one-line row reachable on a 1440p monitor at all. At the old 290px a
    2560px screen produced three columns of 261px — each too narrow for the row inside it, so the
    widest supported screen got the *collapsed* layout everywhere. Columns you cannot use are not
    density.

    **The expanded Status state reproduced a documented trap, and only a purpose-built probe caught
    it.** The first cut gave `boxes` a `1fr` column beside `remove`, leaving ~218px for a 244px
    row, so `.pip-row`'s own `flex-wrap` safety valve engaged and the wrapped boxes' 44px overlays
    overlapped vertically — the identical failure `0.39.0`'s `.rowHead` comment already records
    from an earlier cut that split `pips | rank` the same way. The responsive smoke test cannot see
    it, because it never opens the expanded state. Worth internalising: **a state reachable only by
    interaction is outside the smoke test's coverage entirely**, and a layout that only exists
    after a tap needs its own check.

42. **`0.41.0` finished `0.40.0`'s two follow-ups and, in doing so, found that three of `0.40.0`'s
    own claims were false — which is the more useful thing to record.** The work itself was as
    scoped: every literal px font-size in `apps/web/src` is gone (405 declarations across 67 files),
    and interaction-gated layout has a standing check for the first time. Two repo-owner decisions
    shaped it — map the large display sizes onto the existing six steps rather than extending the
    scale (accepted with the consequence stated: the biggest numerals on the sheet get visibly
    smaller), and cover every interaction-gated state in the app rather than only the two `0.40.0`
    added, fixing small pre-existing failures and reporting the rest.

    **The false claims are worth naming individually, because they failed in three different ways.**
    The first was a *fabricated discovery*: `0.40.0` reported finding and fixing an iOS zoom bug,
    when `layout.css` had already raised text controls to 16px on a coarse pointer since PR #68 —
    what actually shipped was a duplicate of that rule, narrated as a fix in the CHANGELOG, the PR
    body, `CLAUDE.md`, and directly to the repo owner twice. The failure was reasoning from
    documented browser behaviour plus the component CSS without ever grepping for an existing global
    rule. The second was an *understated leftover*: "~140 literals in ~19 untouched files" against a
    real 405 across 67, with the four panels called "converted" only partly converted. The third was
    a *fix that didn't work being described as one*: a commit widened a horizontal `gap` to resolve a
    vertical overlap and its message says it fixed it; the check still failed all 10 cells
    afterwards.

    **The common thread is that none of the three was caught by a test — all three were caught by
    inventory.** The type sweep needed a file-by-file survey, which is what surfaced the duplicated
    rule; the interaction check needed its failures read carefully, which is what surfaced the
    wrong-axis fix. A green suite said nothing about any of them. Worth remembering next time a
    release's own summary is the only evidence that something was fixed.

    **One bug found and deliberately left**: `InfoTooltip`'s trigger uses a `.tap` overlay inside
    tightly stacked vertical lists — precisely what `CheckboxRow`'s own doc comment says that
    overlay is the wrong tool for. `0.41.0` fixed the single failing instance; fixing the class
    changes every call site and needs its own verification pass.

43. **Ruleset V0.6 is adopted (fifty-third session, docs-only at `0.41.0`), and two of its calls are
    ours rather than the document's.** `Planning Docs/Ruleset-V0.6.md` supersedes `Ruleset-V0.5.md`,
    which moves to `Planning Docs/archive/` carrying a SUPERSEDED banner — archived rather than
    deleted, deliberately: the 2026-09-03 design meeting framed V0.6's harm model as *an experiment
    to compare against the existing system*, and Ryan's own stated process was to preserve V0.5 in
    the legacy material. If playtesting favours ranked Statuses, V0.5 is what the app falls back to.
    The migration is staged as eight slices in `WorkPlan-V0.6.md` (`0.42.0`-`0.49.0`), none built yet.

    **V0.6's central change: Statuses stop being ranked tracks.** Harm splits into **Strain** (a
    5-box short-term track that clears at end of scene) and **Statuses** (Minor ×3 / Major ×2 /
    Severe ×1 slots, each a written injury carrying a fixed penalty — Minor −1, Major Disadvantage,
    Severe roll 1d6 instead of 2d6, and only the highest ever applies). **Boons & Banes** — unranked
    situational tags compared for Advantage/Disadvantage — replace positive and situational ranked
    modifiers, and a **Healing Track** replaces Recovery spending. Skill and Flaw Tags become
    mechanical (+1 / −1, with a Flaw also marking Potential whether you hit or miss).

    **Decision 1: extend Strain into Combat ourselves.** `Ruleset-V0.6.md`'s Combat Basics chapter
    is **byte-identical to V0.5's** — verified by diffing the two ranges directly, not inferred. It
    was never rewritten: it still says "Apply *Status 5*", still spends Recoveries, still defines
    Unstable at Rank 4, still treats Cover as a ranked Positive Status, and still has Defend negate
    "a Status", none of which is compatible with the Strain chapter twelve pages earlier. Ryan
    flagged the same work himself, with a literal `Set Status Limits. !! UPDATE` marker on the
    Villain template. Three options were put to the repo owner — build Strain for Freeplay only and
    freeze Combat; extend Strain into Combat ourselves; or run both behind a ruleset switch — and
    **extending Strain into Combat was chosen**, so the app carries one coherent harm system rather
    than two. Because that means writing rules the document doesn't, the mapping is fixed **once**,
    in `WorkPlan-V0.6.md` Section B1, rather than improvised per-slice: Engage deals 5/4/3 (Melee)
    and 4/3/2 (Ranged) **Strain**; Toughness and the Resist formula keep their existing arithmetic
    with a new unit; Armor negating Strain outright is V0.6's own Armor rule verbatim and so isn't
    an invention at all; Cover becomes a **Boon** on the target rather than a ranked subtraction;
    Bolster is +1 Strain, Halt/Impede give a **Bane**, Brace is −1 Strain, Repel pushes bands equal
    to the target's highest Status **severity**; Recuperate in Combat becomes the Healing Track; and
    `PendingStatusOffer` becomes `PendingStrainOffer`, keeping the same ownership constraint that a
    PC's own player is the only one who may write their sheet. **The single largest invention is
    enemy Status Limits becoming Strain Limits** on a counting track — enemies have no severity
    slots and V0.6 never gives them any — and that is precisely where Ryan's `!! UPDATE` marker
    sits, so slice 3 should surface it as a documented assumption rather than bury it in a constant.

    **Decision 2: retire the Subdued flow, keep the data.** V0.6 deletes the entire "Limits, Scars,
    & Death" section — Scars, Risk Death, Blaze of Glory, Total Party Subdual and Resurrection all
    vanish with no replacement — and redefines Subdued purely as "no higher Strain box is free and
    no Status slot can absorb the rest". The 2026-09-03 meeting lists Last Stand, surrender and
    capture as explicitly unresolved, so this is a gap the document knows it has. The repo owner
    chose the middle option of three: `SubduedModal`'s three-way choice, `resolveRiskDeath()` and
    `makeScar()` **retire from the trigger path**, but `CharacterSheet.Scars[]` and its display
    **stay**, so no existing entry is lost and a future Last Stand rule has somewhere to land.
    Deleting them outright was offered and declined for that reason.

    **Four meeting decisions never reached V0.6's text and are treated as real scope anyway**, per
    the repo owner: Rapport overflow (Rapport may exceed its cap of 5, overflow is preserved until
    Camp, and spending *any* Rapport before Camp forfeits the overflow — 10/5 spending 1 becomes
    4/5, not 9/5), Load wildcard slots (unused boxes filled by declaring an ordinary item mid-play;
    ordinary items evaporate at Camp, named ones persist and permanently consume Load), Threats
    promoted onto a player-facing quest board, and pronouns on the Hero sheet. `WorkPlan-V0.6.md`
    Section A4 records that the document doesn't say any of this, because a future reader diffing
    the app against the ruleset would otherwise find four behaviours with no textual basis. This is
    the same discipline item 7 applies to the pre-V0.5 "14,000+ line working design doc": a decision
    that can't be checked against a citable source is recorded as a decision, not left to look like
    a reading.

    **Four V0.5 gaps closed on their own**, and are recorded as closed in `HANDOFF.md` rather than
    silently dropped — the Level-vs-Tier gate (V0.6 deletes the contradictory section, so item 29's
    DAG-only judgment call became the plain text), "Shot in the Dark" (deleted), the Recoveries
    "6 (or 8?)" question (moot), and whether the Status Rank cap of 6 should scale (moot for Heroes).
    Note the knock-on: `CharacterSheet.Level` was kept in `0.31.0` *only* because the now-deleted
    section named it, so it is left with no doc support at all.

44. **V0.6 slice 1 (harm primitives) shipped as `0.42.0`, and several judgment calls were made
    during the build itself, beyond the mapping item 43 already pre-planned.** `WorkPlan-V0.6.md`
    Section B1 answered *what* Combat's harm-dealing should map to; these are the *how*, settled
    while writing the code rather than in the planning pass.

    **An Enemy's "which Strain track" has to stay a real, GM-picked field.** Item 43's mapping table
    doesn't say how the attacker picks which of an Enemy's several named tracks (Hurt, Scared, …) an
    Engage roll marks — B1 only says Strain replaces ranked Status Ranks as the *unit*. Dropping the
    old Status-name text field entirely (since a PC target's Strain genuinely has no name any more)
    would have silently broken multi-track Enemy stat blocks, since `isEnemyDefeated()` keys off
    matching a named `EnemyStatusLimit.StatusName`. `CombatMoveModal.tsx` keeps a "which track"
    picker, sourced from the target's own `StatusLimits` when it has any — scoped to Enemy targets
    only, since a PC's Strain is genuinely unnamed.

    **Cover became a static reminder, not an interactive picker.** The old picker read a target's
    own Positive Statuses and subtracted the highest Rank from the incoming hit — a real numeric
    effect this app could compute. B1's replacement ("a Boon on the target, giving the attacker
    Disadvantage") is a dice-mechanic change with nothing left to compute: this app doesn't roll
    dice, and Boon/Bane-driven Advantage/Disadvantage isn't wired into any roll yet (that's Slice
    2). Building a Boon-sourced picker now would have meant inventing where a target's Boons even
    come from mid-Combat, ahead of the model Slice 2 actually settles. Chose the same "state it,
    don't fake computing it" treatment this app already gives informational Advantage/Disadvantage
    everywhere else, over inventing partial mechanics that would need redoing next slice.

    **Halt/Impede's Enemy-target path keeps marking a Strain track; its (unreachable in practice)
    PC-ally-target path is log-only.** Gambits only ever attach to a PC's own Engage roll, and a
    PC's Engage always targets the opposing (Enemy) side, so the PC-target branch is dead code in
    the current UI — kept as a real branch rather than deleted, since Combat's trust model lets a GM
    drive an Encounter into states the UI doesn't normally reach. Giving an Enemy a "Bane" has no
    mechanical meaning (Enemies don't roll), so that branch stays exactly what it already did:
    mark 2 on a named Strain track. The PC-target branch, if ever reached, logs rather than silently
    doing nothing — this app has no generalized cross-character Bane-offer mechanism (the same
    documented gap as the pre-existing "no generalized cross-character Status targeting" limit).

    **Calculate/Brace push the actor's own Boons array instead of granting a Rank-1 Positive
    Status.** Both used to call `giveStatus()` on the acting PC's own sheet; since Positive Statuses
    no longer exist, and both are genuinely temporary situational tags in V0.6's own framing
    ("Boons and Banes function like temporary Statuses"), pushing onto `Boons` is a direct reading
    of item 43's mapping rather than a new call — Slice 2 is expected to give these real roll
    weight once Boon/Bane comparison is wired into `computeRollBreakdown()`.

    **Make Camp's mechanic (clear one Condition, Recuperate, refresh Armor) was pulled forward from
    Slice 4's own "Moves and Camp content" scope, not left broken.** `StatusesPanel.tsx`'s Make Camp
    button directly manipulated the now-retired `Recoveries` field and ranked `Statuses` array, so
    it had to be rewritten regardless of which slice "owned" Make Camp's text — the alternative was
    shipping a Make Camp button that no longer compiled. The rest of Make Camp's Move text (the
    GM's Countdown-advance prompt, Camp Actions' tag-rewrite option) is untouched.

    **Legacy ranked-Status data is dropped on read, not migrated — confirming, not reopening,
    `WorkPlan-V0.6.md` Section B2's "clean break" call.** A `Statuses` entry with `Marks`/`Polarity`
    and no `Severity` is filtered out by `normalizeSheet()` the next time that sheet is read; there
    is no honest Rank-to-severity mapping, so guessing one would produce "plausible-looking
    garbage" (B2's own words). Same treatment the V0.5 migration's own slice 1 gave the equivalent
    shape change — this project is pre-1.0 with no real users yet, so a wipe-on-read for a shape
    that predates the current ruleset is a self-heal, not data loss requiring separate sign-off.

    **Healing Track uses `Pips`, not the repurposed `StatusBoxes`.** `StatusBoxes`' whole reason for
    existing is sparse marking (gaining 2 then 4 marks boxes 2 and 4, leaving 1 and 3 empty) — which
    is exactly Strain's own rule, so Strain reuses it directly. The Healing Track fills strictly
    left-to-right as segments accumulate (a real cumulative clock, same as Potential/Rapport/Bond),
    so it uses `Pips` instead — using `StatusBoxes` for a clock-shaped value would have been the
    same category error CLAUDE.md's own `Pips`-vs-`StatusBoxes` doc comment already warns against.

45. **V0.6 slice 2 (rolls) shipped as `0.43.0`, and several judgment calls were made settling how
    V0.6's Skill/Flaw Tag and Boon/Bane text becomes code.** `WorkPlan-V0.6.md` Section A2 names
    *what* changed (Tags become mechanical, Push Yourself, Boon/Bane-driven Advantage); these are
    the *how*, same split as item 44 above.

    **A Minor Status penalty folds into `Sources`/`Total`; Major/Severe stay a separate,
    non-numeric `StatusPenalty` display — and this slice deliberately invents no rule for how the
    two kinds of Disadvantage (a Major Status's, and a Boon/Bane comparison's) combine.** V0.6
    doesn't say, and `WorkPlan-V0.6.md` Section D is explicit this app doesn't guess at open
    questions. Both show, clearly labeled, and the table resolves the interaction — the same
    "state it, don't fake computing it" treatment item 44 above already gave Cover.

    **`Move.AdvantageTrigger` retires with no per-Move replacement, because V0.6's own text for
    both Moves that used it already reads as the general Boon/Bane mechanic.** Consult the Past
    says "add a relevant Boon"; Follow a Lead says "roll with Advantage" for a Wealth spend that
    is, itself, just acquiring a Boon under the new model. Neither needed a dedicated code path
    once any Boon can tip the comparison, so `MoveRollHelper.tsx` gained one universal Boons/Banes
    picker instead of two hardcoded branches. Move `Description` text for both was deliberately
    left unrewritten — close enough to make sense under the new mechanic as-is, and re-authoring
    seeded Move text against V0.6 is Slice 4's job, not this one's.

    **Push Yourself's Condition choice is a free pick among all five Virtues, not pinned to the
    rolled Virtue.** V0.6's text just says "mark one Condition," with no stated tie to the roll in
    progress, and this app already treats "which Virtue's Condition" as the player's own choice
    everywhere else (`VirtuesPanel.tsx`). Reuses `markCondition()`/`CrumbleModal` rather than a
    second Crumble-handling path.

    **Skill Tags cap at two per roll (one declared, one more via Push Yourself); Flaw Tags don't
    cap at all.** V0.6 phrases Skill Tag use as a binary choice — declare *your* tag, then Push
    Yourself once if a second applies — never "mark a Condition per additional tag." Flaw Tags get
    the opposite reading on purpose: "**each and any** Flaw Tag that is relevant... will give −1"
    reads as automatic, uncapped stacking, so the roll builder lets every applicable Flaw Tag be
    checked, each its own irreversible −1-and-mark-Potential action.

    **A Flaw Tag mark that fills a Motif's Potential track does not auto-open
    `MotifAdvanceModal`.** `addMotifPotential()` already reports readiness for this; wiring the
    roll builder to reach into the dedicated advance-picker modal mid-roll was judged more scope
    than this slice's own roll-mechanics focus asks for. The track fills and stays filled; the
    player advances it from the Motifs panel afterward. (V0.6 also changes *when* a full track
    advances — at the next Make Camp, not immediately — but that's Section A2's own separate item,
    untouched by this slice; `MotifAdvanceModal`/`PartyAdvanceModal` still fire on the spot.)

46. **V0.6 slice 3 (Combat on Strain) shipped as `0.44.0`, closing out `WorkPlan-V0.6.md` Section
    B1's mapping table and the remaining Combat Loop additions.** Slice 1 had already applied B1 at
    the primitive level (forced by `CharacterStatus`'s retype breaking compilation); this slice
    finished the parts that didn't need to happen just to compile.

    **Brace's mismapping was a real bug this slice's own research found, not new scope to invent.**
    B1 gives Calculate and Brace genuinely different shapes — Calculate is "+1 forward" (a temporary
    edge, exactly what a Boon already models), Brace is "−1 Strain from everything until your next
    turn" (a numeric reduction with a duration this app has never tracked). Slice 1's code mapped
    both onto the same "push a Boon" primitive, which made Brace look wired up while silently doing
    something the doc never described. Fixed by moving Brace to the same logged-only treatment
    Seize/Other already get, rather than inventing timed-buff tracking to make the Boon mapping
    technically work.

    **Surprise needed no new stored field** — `firstToActFromSurprise()` mirrors
    `firstToActFromInitiative()`'s shape (GM reports the outcome, the function derives `ActingSide`)
    with no roll at all, since Combat Loop step 4 is mutually exclusive with step 5's dice. The
    doc's own further "at the GM's discretion" clause (a head-start round, fewer actions, or
    Disadvantage for the surprised side) is deliberately left as GM narrative discretion rather than
    a formula — the same treatment this app already gives Seize/Other Gambits and Boss abilities.

    **Combat-Goal Potential had to be self-serve, not a GM-driven bulk action** — the sheet
    owner-only write rule (`sheet.ts`'s PUT) that already shapes `PendingStrainOffer` applies here
    too: the GM can mark the Encounter's `CombatGoalAchieved`, but only each player can mark their
    own Motif's Potential. A local `potentialClaimed` flag (not persisted on the Encounter) guards
    against a double-click, the same self-report trust model as Aid and Defiant Goal declarations.

    **"No Potential on a 6- in Combat" is recorded as a documented no-op, not built.** The doc's own
    full sentence frames this as a carve-out from a general "rolls can award Potential on a miss"
    rule — and this app has no such general rule. The only Potential-on-a-roll mechanic anywhere in
    the app is Slice 2's Flaw Tags, which mark Potential unconditionally and aren't tier-gated at
    all, so there is nothing for this carve-out to actually suppress. Building a suppression
    mechanism would mean inventing the general rule Section D item 10 itself flags as still
    unresolved ("Any rolls made with a Virtue marked with a Condition award 1 Potential
    (optional??)") — exactly the kind of guess this project's discipline forbids.

    **Boss Last Stand / 1d6-Wounded numbers get a documented-assumption `InfoTooltip`, not new
    mechanics** — B1's own "left open" note asks for exactly this ("surface it in the UI... rather
    than bury it in a constant"), since Ryan's own `!! UPDATE` marker on the Villain template means
    the Rank-read-as-Strain assumption may not be final. `Villain.Attacks`' freeform prose itself
    stays untouched — already established (item 38) as bespoke GM flavor text, not a formula.

    **A real, pre-existing accessibility bug — three raw `<input type="checkbox">` elements at
    13×13px — was found by this slice's own new test coverage, not introduced by it.**
    `CombatMoveModal.tsx` had never had an interaction-smoke state that actually opened it before
    this slice added one (`modal: Engage`), so its checkboxes (Cover, Rolled-12+, and this slice's
    own two new Boons/Banes pickers) had never been measured against the 44×44 touch-target floor.
    Fixed by switching all four to the shared `CheckboxRow` component, already `MoveRollHelper.tsx`'s
    own convention for the identical picker. A second, smaller near-miss came from the same new
    coverage once the Boons/Banes grid used real 44px rows: the `.advantageRow` InfoTooltip trigger
    directly below it collided by 5px at the old 8px `margin-top` — bumped to 24px, the same
    clearance value `VirtuesPanel.module.css`'s own identical class of bug already settled on, and
    re-verified against the smoke test rather than assumed to transfer.

47. **V0.6 slice 4 (Moves and Camp content) shipped as `0.45.0`, the largest single slice of the
    migration by lines touched.** All 22 seeded Moves re-authored against `Ruleset-V0.6.md`'s
    literal text, two Move renames (Level Up → Advance a Motif, Undertake a Journey → Set Out), the
    new five-way Consequence vocabulary, the Make Camp/Keep Watch/Set Out/Enjoy Downtime/End the
    Session flows rebuilt, the advance-at-next-Camp timing change, and a glossary sweep — see
    CLAUDE.md's new "Architecture: Moves and Camp content (V0.6 slice 4)" section for the full
    account. A handful of real judgment calls and findings, recorded here rather than left implicit:

    **The advance-at-next-Camp timing change needed no new stored field, only a different
    trigger.** V0.6's own text — a full Potential/Rapport track "advances the next time you Make
    Camp" — ruled out the shipped behaviour of auto-opening the advance picker the instant a track
    hit cap, which read as advancing immediately rather than at an actual Camp. Rather than invent
    a new "is the party at Camp right now" session concept to gate this properly, the fix is purely
    UI: stop auto-opening the picker, and show a persistent "Ready to advance" button instead that
    opens the same picker whenever the player actually taps it. This is the same track-and-display
    philosophy the rest of this app already applies to Combat and Clocks, extended here to
    Advancement for the first time.

    **Two shared helpers were extracted because two call sites genuinely needed the identical
    mutation, not preemptively.** `rewriteMotifTag()` (`logic.ts`) is the exact same "rewrite a
    Skill or Flaw Tag" operation both the new Camp Action and `EndSessionModal.tsx`'s new growth
    option need — real, load-bearing duplication removed, not a speculative abstraction.
    `applyRecuperateEffect()` (`engine.ts`) is `StatusesPanel.tsx`'s own Recuperate mutation pulled
    into a pure function taking a `takeStrain` flag, so Enjoy Downtime's Rest ("Recuperate without
    taking Strain") calls the identical logic with one flag flipped instead of drifting from it.

    **Two real bugs found by this slice's own research and new coverage, not introduced by it —
    both in `interaction-smoke.mjs`, not in application code.** The "modal: Give a Status"/"modal:
    Heal a Status" states had targeted button labels (`Give a Status…`/`Heal a Status…`) that slice
    1 renamed to `Take Strain…`/`Recuperate…` three releases ago, in `0.42.0`. The script's own
    "trigger not present, skipped"
    fallback — added so a viewport-conditional control doesn't fail the whole suite — silently
    swallowed the miss instead of failing, so this carried zero CI signal for three whole slices.
    Verified factually before assuming a bug: running the two stale states directly confirmed
    "trigger not present" at every viewport, not inferred from reading the diff. Renamed to match
    the real button text; both pass clean now, alongside the `modal: Set Out` rename this slice's
    own Move rename required.

48. **V0.6 slice 5 (Load and identity) shipped as `0.46.0`, building `WorkPlan-V0.6.md` Section
    A4's items 2 and 4 — decisions the repo owner confirmed in meetings but that never made it into
    `Ruleset-V0.6.md`'s own text.** Wildcard Load declarations, Light/Heavy Loadouts granting a
    matching Boon/Bane, and a freeform Pronouns field on `Character` — see CLAUDE.md's new
    "Architecture: Load and identity (V0.6 slice 5)" section for the full account. Three real
    judgment calls, recorded here rather than left implicit:

    **A wildcard declaration is its own list, `CharacterSheet.WildcardDeclarations`, not folded
    into the existing catalog `Items[]` list.** A wildcard has no `ItemId`/`Charges` (there's
    nothing in `library.items` to reference — it was invented at the table) and a catalog
    `CharacterItem` has no `Persistent` flag; giving one list both shapes would mean every catalog
    item carrying a meaningless `Persistent` field or every wildcard carrying a fake `ItemId`. Kept
    as two lists, summed together in `carriedLoad()` instead.

    **The doc's "+1 Movement"/"-1 Speed in Combat" clauses, in the same paragraph as the Boon/Bane
    grant, are deliberately not modeled — a scoping decision, not an oversight.**
    `WorkPlan-V0.6.md`'s own Slice 5 bullet only names the Boon/Bane grant, and this app has never
    had a numeric Combat movement/speed stat to attach a "+1"/"-1" to — Range has been
    theater-of-the-mind bands since Combat was first built, a standing design constraint (see
    CLAUDE.md's "Architecture: Combat"), not something this slice reopens. Only the Boon/Bane half
    of that paragraph shipped.

    **`Character` needed an actual Postgres migration for `Pronouns`, unlike every other field this
    migration has added so far.** Every prior V0.6 slice's new fields lived on a JSONB blob
    (`CharacterSheet`/`Party`/`Library`) and needed only a TypeScript type change plus a
    normalize-on-read backfill. `characters` is a real row-shaped table, so `Pronouns` needed
    migration `0014_character_pronouns.sql` (`pronouns text not null default ''`, backfilling every
    existing row in the same statement) — the first migration this eight-slice plan has actually
    required. No post-creation edit route was added for it, matching the fact that `Name` itself
    has never had one either — see "Working conventions"' existing Virtue-scores/Theme precedent
    (an edit affordance needs an explicit repo-owner ask, not an assumption).

## What's not built

Per the handoff's own "Known Gaps & Risks": Bond-proposal expiry is deliberately out of scope — the
design doc calls it out as future work, not an omission here. Skill modifiers, the list's other
original entry, is no longer on this list at all — see the correction under "Deliberate, permanent
omissions" below for why. Two more items from that original list are now built, and a third
partially.

The V0.5 adoption (item 29 above) adds a second kind of "not built" to this list — real, planned
work that simply hasn't shipped yet, as distinct from a permanent decision never to build
something. The two are now split into their own groups below rather than interleaved as before.

One entry sits in neither group, because it is mostly *built* and only its remainder is deferred:

- **Combat**, as of `0.14.0`–`0.16.0`, extended by V0.5 slice 5 (`0.32.0`): the core loop, all
  seven Combat/Reaction Moves (Resist joined the other five as of slice 5; Help was already built),
  Gambits including an automated Repel, enemy stat blocks with Toughness and per-Status Limits,
  per-unit turn order, a Cover Status picker, and minimal Boss-Enemy wiring — see items 15–17 and
  31–34 above for exactly what's built. The rendered grid stays deferred and Hero Moves are now cut
  outright — see "A rendered Combat grid" and "Hero Moves" below for each one's status.

### Deliberate, permanent omissions

- **Dice rolling**: the app still never rolls dice itself (see `packages/shared/src/engine.ts`'s
  doc comment) — that's a deliberate product decision, not a gap to close later. It computes and
  shows every roll's modifier breakdown, and once told which tier a physically-rolled roll landed
  in, applies the resulting mechanical effect. Extends to Combat rolls too, as of `0.14.0`.
  **Reaffirmed by the V0.5 adoption, and again by V0.6**: nothing in `Planning Docs/Ruleset-V0.6.md` or
  `WorkPlan-V0.5.md` touches this decision — even V0.5's newly mechanical Advantage/Disadvantage
  triggers (item 20 above) stay within "tell the app what you rolled," not "have the app roll."
- **Skill modifiers: built, as of the V0.6 migration's own slice 2 (`0.43.0`) — no longer belongs
  in this list, corrected here rather than silently removed.** This bullet stood unchanged from the
  original handoff's "Known Gaps & Risks" note through V0.5's entire freeform-Tags redesign (item
  20/`WorkPlan-V0.5.md` slice 2) on the reasoning "a Tag is exactly as un-numeric as the Skill it
  replaces" — true when V0.5 shipped Skill/Flaw Tags as narrative-only text, and still true right up
  until `Ruleset-V0.6.md` gave them a real mechanic: a relevant Skill Tag is **+1**, a relevant Flaw
  Tag is **−1** and marks Potential, and Push Yourself lets a second applicable Skill Tag add
  another +1 for a Condition. `MoveRollHelper.tsx` is a real roll builder now, not a static
  breakdown — see CLAUDE.md's "Architecture: Rolls (V0.6 slice 2)" for the full account. A reader
  who had this bullet memorized needs to know it flipped, the same treatment this file gives every
  other superseded claim rather than quietly deleting the line.
- **Bond-proposal expiry**: still out of scope, per the same handoff note above, and unaffected by
  the Kin → Bond rename (item 20/29 above) — a proposal still sits open indefinitely until it's
  accepted, rejected, or withdrawn.
- **A rendered Combat grid**: previously an open interpretation of an ambiguous handoff (item 15's
  original `0.14.0` note); now, per item 15's update above, a *documented deviation from an
  explicit written rule* instead — V0.5 specifies a real map with squares or hexes, and the repo
  owner re-affirmed keeping Range bands having actually read it. Not a gap to eventually close; a
  standing choice.
- **Statuses/Conditions as a real mechanical system** (give, heal, Resist Rolls, opposite-Status
  cancellation, the Subdued → Scar/Risk Death/Blaze of Glory chain) is built for a character's own
  sheet. **Targeting another character as a real reference**: still not a generalized feature —
  `CharacterStatus.LinkedToIds`/`AffectedByIds` remain the stubbed "not yet" placeholders they
  always were (the inert `StatusesPanel.tsx` "Link to…"/"Affected by…" row that used to surface
  them was removed in `0.22.0`; the fields themselves are untouched) — but Combat's
  `PendingStatusOffer` (item 15 above) is a first, narrowly-scoped instance of one character's
  action targeting another's Statuses, worth reusing the pattern from if this generalizes later.
  V0.5 doesn't add a general version either — nothing in its delta (item 12's update, item 29)
  proposes one, so this stays exactly where it was.
- **Advancement past a full track**: marking Potential, Rapport, or Bond when the track is already
  at its cap still silently drops the mark today. Recorded as `HANDOFF.md` open issue **14** —
  needs a rules answer before any code, and V0.5 is silent on it (the cascading-full-track
  question), so it stays open, now re-pointed at `Planning Docs/Ruleset-V0.6.md`.
- **The advancement kickoff flow** (open issue 15's UX half — filling a track pops its picker
  instantly rather than running a real "you've earned something" flow) was never a rules question
  and is unaffected by slice 4. **Its other half — issue 15's own citation of the Level/Tier-unlock
  formula — is resolved as of slice 4** (item 30 above, `0.31.0`): gating is DAG-only, no Tier or
  Level, closing `HANDOFF.md` open issue 12. The UX question itself (instant popup vs. a
  considered "you've earned something" moment) is untouched and stays open.
- **Hero Moves: cut, not deferred — confirmed directly by the repo owner, not inferred.** Blocked
  on Playbooks not existing as a concept since `0.14.0`; the *Party* half of that reason was
  resolved by slice 7 (`0.34.0`, item 37 above), which built real Party identity data (Motif,
  Quest, Skill/Weakness Tags, Path, Camp Assets) without needing a Playbook system at all. Then,
  in the same session, the repo owner confirmed Playbooks aren't part of the game's systems full
  stop — not merely unwritten yet, as `Ruleset-V0.5.md`'s own "Hero Moves and Playbooks... Coming
  Soon" text implied. Since Hero Moves had no other stated foundation in the doc, they're cut along
  with Playbooks rather than left waiting on a system that isn't coming. Improvement Trees (items
  8/20/29 above) were never confirmed as a replacement for them — that question is now moot rather
  than open.

### Known V0.5 scope — the nine-slice migration, now shipped

Confirmed by the repo owner as real, in-scope work (item 29's locked decisions above), staged
across the nine slices in `WorkPlan-V0.5.md`. **All nine slices are shipped as of `0.36.0`** — kept
as a per-slice list rather than collapsed into prose once complete, since each entry below still
names what shipped and what stayed deliberately out of that slice's own scope, which is exactly the
kind of detail a later session (or a future rules clarification) will want to find quickly.

> **V0.5:** all nine slices below are shipped, `0.29.0` through `0.36.0` (slice 1, the rules
> primitives, shipped earliest, in `0.28.0`, and is covered by this file's main body and judgment-
> call items rather than repeated as its own bullet here). See `WorkPlan-V0.5.md` for the slice
> each item belongs to.

- **Motifs and Skill/Flaw Tags** (slice 2) — **shipped `0.29.0`.** Three Motifs replace the single
  Theme, each with its own Potential track, Quest, Act Breaks and Forsakes; freeform Skill/Flaw
  Tags replace library-authored Skills and Abilities.
- **The new Move list** (slice 3) — **shipped `0.30.0`.** All 22 Moves (10 Basic, 12 Adventure)
  seeded with schema-validated result tables; Hold granted mechanically by the two Moves that name
  a number; Advantage/Disadvantage mechanised for the two triggers this slice's scope could reach
  (item 20 above has the full breakdown). Four Adventure Moves (Make Camp, Keep Watch, Undertake a
  Journey, Enjoy Downtime) shipped as reference text only — their guided flows shipped in slice 7
  (`0.34.0`, item 37 above).
- **Improvement Trees with prerequisites** (slice 4) — **shipped `0.31.0`.** The Advancement →
  Improvement rename; 11 Combat and 14 Narrative Hero Improvement Trees with a real prerequisite
  DAG (`improvementState()`, `packages/shared/src/logic.ts`); `Level`/`PartyLevel` fields that
  gate nothing. Gated purely on the DAG, not Tier/Level, per a repo-owner decision that resolved
  `HANDOFF.md` open issue 12 by treating V0.5's Tier-1..4-and-Level text as leftover draft
  language rather than the rule to implement (item 30 above has the full writeup). The 25 Hero
  trees carry only placeholder nodes — V0.5 names the trees but authors no content on any of
  them — and item 8 above's "tiered Bond Improvements keyed to Bond Level" prediction turned out
  to be wrong: that section of the doc has no content at all, not even tree names, and stays
  unbuilt with no slice assigned until the repo owner authors something to build against.
- **Combat update** (slice 5) — **shipped `0.32.0`.** Per-unit turn order
  (`Encounter.ActingParticipantId`/`PairedParticipantId`, `endTurn()`/`nextActor()` in
  `packages/shared/src/combat.ts`) replacing the single `ActingSide` toggle; Repel automated via
  `repelPushBands()`; Resist (the one remaining unbuilt Reaction Move) wired as a self-reported
  Mettle reduction on both the Repel Gambit and a standalone Reactions-section button; a Cover
  Status picker in `CombatMoveModal.tsx`; minimal Boss-Enemy wiring (`IsBoss`/`GambitCharges`, a
  derived Last-Stand badge, manual defeat); and Combat's start form asking V0.5's actual two-branch
  Rapport-modifier questions. See items 31–34 above for the four repo-owner decisions this slice
  needed. **Still not built**, confirmed out of scope for this slice specifically: the full
  side-alternating turn-order *algorithm* (this slice gives the GM the fields and a suggestion
  function, not an enforced sequence — consistent with Combat's track-and-display design), a
  rendered grid (item 15's standing decision), and real Boss-ability content (item 31's "minimal
  wiring" scope — the abilities themselves stay freeform GM narration).
- **Clocks** (slice 6) — **shipped `0.33.0`.** `Clock`/`ClockKind` (`packages/shared/src/types.ts`),
  a new `clocks` table (migration `0011`, same Realtime/RLS shape as `combat_encounters`), and a
  lazy-loaded `ClocksPanel.tsx` rendered inline on the Campaign Shell for both GM and Player views.
  Collapsed to three `Kind`s rather than the doc's six named variants — see items 35–36 above for
  the two repo-owner decisions (the Kind collapse, and keeping the losing-side spend menu freeform
  rather than building real Advantage/Disadvantage-Forward tracking).
- **Party Identity and Camp** (slice 7, named "Party Playbook & Camp" at the time it shipped —
  see item 37's follow-up note above for why that name stopped being used) — **shipped `0.34.0`.**
  Party Motif/Quest/Skill Tags/Weakness Tags/Path/Goal (`packages/shared/src/types.ts`'s `Party`) —
  freeform, since V0.5 named no catalog to pick from for any of these (and never will — Playbooks
  aren't part of the game's systems at all); `CampAssetTemplate`, a new ordinary schema-driven admin
  collection, plus a hybrid catalog-or-freeform `<datalist>` picker for holding one; and Make
  Camp/Keep Watch/Undertake a Journey/Enjoy Downtime as real guided flows built on this app's
  existing "report the tier, apply the mechanical change" pattern. This is also where item 20's
  `0.18.0` deferral of Undertake a Journey/Enjoy Downtime finally got built, closing the "not yet
  decided whether either needs a guided flow" question that deferral rested on. `PartyLevel`
  already existed from slice 4 — no separate party-scoped Level field was needed. See item 37
  above and CLAUDE.md's "Architecture: Party Identity & Camp" section for the three repo-owner
  decisions and what stayed deliberately narrower than the doc's own wording (Keep Watch/Journey's
  Status grants scoped to the viewer's own sheet only; no Forward/Ongoing cross-roll tracking).
- **GM stat blocks** (slice 8) — **shipped `0.35.0`.** Villains, NPCs, and Locations
  (`packages/shared/src/types.ts`) as three new, ordinary schema-driven Content Admin collections,
  extending the existing `library.enemies` pattern exactly as `WorkPlan-V0.5.md` names it — no new
  server route or admin-page code beyond three `schema.ts` entries. Authored content only: nothing
  wires a Villain into Combat as a spawnable Boss participant. A new `statusLimits` `FieldType`
  (a real, schema-validated `{StatusName, Limit}[]` editor) replaced `EnemyTemplate.StatusLimits`'s
  raw, unvalidated `json` field along the way — closing `WorkPlan-V0.5.md` Section B hazard 1 for
  Enemies, not just for the two new collections that needed it. See item 38 below and CLAUDE.md's
  "Architecture: GM stat blocks" section for the full scoping.
- **Adventures** (slice 9) — **shipped `0.36.0`.** The fourth app surface, a GM-only
  `/c/:campaignId/adventure` route (`AdventuresPage.tsx`/`AdventuresPanel.tsx`): Concept, Type
  (the doc's six named Adventure Types, each with its own "Elements to include" hint), Hook, a
  `VillainId`/`NpcIds`/`LocationIds` reference into slice 8's own collections, floating Secrets
  (`{Text, Revealed}`, no `LinkedToIds` — the doc is explicit these never tie to a specific NPC/
  Location), and a Countdown. Depends on slice 8 (an Adventure references Villains/NPCs/Locations,
  it doesn't redefine them) and slice 6 (`Adventure.CountdownMarks`/`CountdownSteps` reuse
  `Clock`'s tick-and-clamp mechanic, "a Countdown is a clock variant" per `WorkPlan-V0.5.md`'s own
  scope note) — see item 39 above for why the Countdown ended up an embedded field rather than a
  real linked `Clock` row, the one design this slice tried and deliberately reversed once its
  consequences became clear. **GM-only end to end, a first for this app**: `campaign.ts`'s
  bootstrap route only fetches `adventures` for a GM membership (mirroring `invites`), all three
  server routes require `Role === 'GM'`, and `AdventuresPage.tsx` redirects a Player who navigates
  there directly — see item 39 above for the full reasoning (an Adventure's own Secrets/Villain/
  Countdown are spoiler content, unlike everything else this app has ever synced live to the whole
  table). The doc's own "Countdown" chapter names five steps (Seed/Bloom/Wilt/Wither/Rot) under
  prose promising six (`WorkPlan-V0.5.md` Section D item 12) — `ADVENTURE_COUNTDOWN_STEP_NAMES`
  ships exactly five, the inconsistency carried forward unresolved rather than a sixth invented to
  close it.

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
