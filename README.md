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
   reasoning "there's no Kin library content to administer." `Planning Docs/.../Advancements.md`
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
    Opportunity Attack and Interpose shipped in `0.16.0` — see item 17. Hero Moves and the grid are
    still deferred.
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
    - **"Kith" (Make Camp's gate condition, `Planning Docs/TheMoves.md`) is the same thing as
      "Kin"** everywhere else in the doc and all shipped code — consolidated under Kin, no new
      concept, no code changes needed (the app never used "Kith").
    - **Advantage/Disadvantage are purely informational** (`AdvantageToggle.tsx`) — consistent
      with item 13's "this app never rolls dice" decision, flagging Advantage doesn't change the
      roll-breakdown total; it just notes "roll 3d6, keep the best/worst two" for the table.
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
    - **Undertake a Journey and Enjoy Downtime are deferred entirely** — both are full multi-step
      Move flows (Scout Ahead → Venture Forth with GM-chosen complication lists; five distinct
      Downtime activities) where it wasn't yet decided whether they need dedicated guided UI or can
      just be generic library-text Move references like everything else. Not seeded this pass.
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

## What's not built

Per the handoff's own "Known Gaps & Risks": Skill modifiers (Skills are narrative text only — no
numeric bonus a roll can consume) and Bond-proposal expiry are deliberately out of scope — the
design doc calls these out as future work, not omissions here. Two more items from that original
list are now built, and a third partially:

- **Dice rolling**: the app still never rolls dice itself (see `packages/shared/src/engine.ts`'s
  doc comment) — that's a deliberate product decision, not a gap to close later. It computes and
  shows every roll's modifier breakdown, and once told which tier a physically-rolled roll landed
  in, applies the resulting mechanical effect. Extends to Combat rolls too, as of `0.14.0`.
- **Statuses/Conditions as a real mechanical system** (give, heal, Resist Rolls, opposite-Status
  cancellation, the Subdued → Scar/Risk Death/Blaze of Glory chain) is built for a character's own
  sheet. **Targeting another character as a real reference**: still not a generalized feature —
  `CharacterStatus.LinkedToIds`/`AffectedByIds` remain the stubbed "not yet" placeholders they
  always were (the inert `StatusesPanel.tsx` "Link to…"/"Affected by…" row that used to surface them
  was removed in `0.22.0`; the fields themselves are untouched) — but Combat's
  `PendingStatusOffer` (item 15 above) is a first, narrowly-scoped instance of one character's
  action targeting another's Statuses, worth reusing the pattern from if this generalizes later.
- **Combat**, as of `0.14.0`–`0.16.0`: the core loop, all five Combat/Reaction Moves, Gambits, and
  enemy stat blocks with Toughness and per-Status Limits — see items 15–17 above for exactly what's
  built. Still deliberately deferred: Hero Moves (blocked on Playbooks not existing) and a
  rendered grid.
- **Advancement past a full track**, and the advancement kickoff flow: marking Potential, Rapport or
  Kin when the track is already at its cap silently drops the mark today, and filling a track pops
  the picker instantly rather than running a real "you've earned something" flow. Both are recorded
  as `HANDOFF.md` open issues **14** and **15** — the first needs a rules answer before any code, the
  second is entangled with the still-unresolved Level/Tier-unlock formula (open issue 12).

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
