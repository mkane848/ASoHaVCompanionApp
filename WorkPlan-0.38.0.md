# Work plan — `0.38.0`: live campaign state

The first of two releases implementing `UIReviewRound_Handoff.md` — a full UI review round with the
repo owner across the Home page, the campaign state flow, the Character Sheet and the Appearance
system. This release takes the four items that are about **state**: where a campaign is in its setup,
who is waiting on what, and keeping all of it live. `WorkPlan-0.39.0.md` takes the four that are about
**layout and appearance**.

Nothing here is a rules change — `Planning Docs/Ruleset-V0.5.md` is untouched.

> **Status: APPROVED by the repo owner (2026-09-05), not yet implemented.** Every scope decision in
> `UIReviewRound_Handoff.md` was confirmed with the repo owner during the review round itself, and the
> four in "Decisions already locked" below were confirmed while this plan was written. Do not re-ask
> them. The corrections in "Corrections to the review handoff" were verified against the actual code
> and the live Supabase project — treat them as findings, not suggestions.

## Decisions already locked

1. **Two releases, not one.** The state-flow work (this file) needs a Supabase migration and server
   changes; the layout work (`WorkPlan-0.39.0.md`) is pure CSS needing the full both-appearance smoke
   matrix. They barely overlap, but both touch `CampaignPage.tsx`, so they run **sequentially** — do
   not start `0.39.0` on a parallel branch.
2. **The setup checklist owns the phase actions**, and slims to a one-line summary once the campaign
   reaches `Playing` rather than disappearing.
3. **Combat is hidden pre-`Playing` in the UI *and* rejected server-side** on `POST /combat/start`.
4. **Home splits into running / playing lanes**, live-updating without a refresh.

---

## Corrections to the review handoff

`UIReviewRound_Handoff.md` was written as a record of the review conversation, not against a codebase
audit. Several of its technical claims are wrong or incomplete in ways that would produce a broken
feature. These were checked directly.

### 1. "RLS verified Realtime-ready, no migration needed" is wrong — a migration IS required

The handoff says this twice (its §1 "Live home tiles" and §3 "Live state updates"). It is right that
the **RLS policies** need no change: `campaigns`, `memberships` and `characters` all have joinless
SELECT policies (`private.is_campaign_member(<own column>, (select auth.uid()))`, current definitions
in `supabase/migrations/0004_fix_id_types_to_text.sql:114-130`), which is exactly the condition
`0006_sheet_realtime_rls.sql` established for Realtime's authorization check to evaluate reliably.

But **none of the three tables is in the `supabase_realtime` publication.** Verified two ways:

- `grep -rn supabase_realtime supabase/migrations/` finds only `character_sheets`, `party`, `bonds`
  (0001, re-added in 0004), `library` (0001), `combat_encounters` (0010), `clocks` (0011).
- Querying the live project (`ihrtdbknhpgysgwaqnfj`) directly:
  `select tablename from pg_publication_tables where pubname = 'supabase_realtime'` returns exactly
  `bonds, character_sheets, clocks, combat_encounters, library, party`.

Without the migration in item 2 below, every subscription added in items 3 and 4 receives nothing at
all — silently. See item 2 for why this specifically must not be forgotten after merge.

### 2. Adding the Combat phase gate breaks 8 existing tests

`apps/server/src/routes/combat.test.ts:30`'s `makeCampaign` helper has no `Phase` field, so
`campaignPhase()` defaults it to `'PartyCreation'`. Every `POST /start` test in that file fails the
moment the gate lands, unless the fixture gains `Phase: 'Playing'`. Budget for it; don't debug it.

### 3. `listMembershipsWithCampaignForUser` also drops `Ready`

`apps/server/src/repo.ts:221-238` maps `Id/UserId/CampaignId/Role/CharacterId` but not `Ready`, which
the base `mapMembership` (`repo.ts:240`) does keep. The Home tile's "waiting on you" hint needs it, and
it is free to pick up in the same select widening.

### 4. Small stuff worth knowing before you start

- `apps/server/src/routes/auth.ts:111` returns `{ ...m, Overview: overview }` — the spread means
  anything added to the repo select flows to the client with **no route change**.
- `auth.test.ts` has five literal `listMembershipsWithCampaignForUser` stubs (L76, 93, 108, 121, 134),
  each shaped `{ ...myMembership, CampaignName, CampaignStatus }`. All five need the new field.
- `Campaign.Phase` is **optional** on the type (`packages/shared/src/types.ts:415-422`). Always read it
  through `campaignPhase()` (`logic.ts:372`), never directly.

---

## Item 1 — Server: `CampaignPhase` and `Ready` on `/me`

Home currently has no idea what phase any of its campaigns is in, so it can't tell a player they're
being waited on.

- **`packages/shared/src/api.ts:32`** — `MeResponse['memberships']` row gains
  `CampaignPhase: CampaignPhase`, alongside the existing `CampaignName`/`CampaignStatus`.
- **`apps/server/src/repo.ts:226`** — widen the select from `campaigns(name, status)` to
  `campaigns(name, status, phase)`, and add the `ready` column to the top-level field list. Map
  `CampaignPhase: m.campaigns?.phase ?? 'PartyCreation'` (matching `campaignPhase()`'s own default and
  `0009_campaign_phase.sql`'s backfill) and `Ready: m.ready ?? false`. Widen the declared return type
  to match.
- **`apps/server/src/routes/auth.ts`** — no change needed (see correction 4).
- **No migration** — `campaigns.phase` and `memberships.ready` both already exist
  (`0009_campaign_phase.sql`).
- **Tests** — update the five stubs in `auth.test.ts`.

---

## Item 2 — Migration `0013_realtime_campaign_state.sql`

New file, `supabase/migrations/0013_realtime_campaign_state.sql`:

```sql
alter publication supabase_realtime add table public.campaigns;
alter publication supabase_realtime add table public.memberships;
alter publication supabase_realtime add table public.characters;
```

The header comment should record three things, so the next person doesn't have to re-derive them:

1. Only publication membership was missing. The SELECT policies for all three are already the joinless
   `private.is_campaign_member()` shape (`0004:114-130`) that `0006_sheet_realtime_rls.sql` established
   as the requirement for Realtime authorization — no policy change is needed here.
2. `campaigns` is filtered on its own `id` column, not `campaign_id`, since it *is* the campaign row.
   Realtime's `postgres_changes` filter only supports equality on a column already on the row, which
   `id` satisfies.
3. With `REPLICA IDENTITY DEFAULT`, a DELETE carries only the primary key, so RLS cannot authorize it
   and delete events will not be delivered. This is accepted, not overlooked — nothing in the app
   removes a membership or a campaign during normal play (campaign delete is `requireAdmin`-only).
   Do **not** set `replica identity full` to fix it; that raises WAL volume for every write on three
   hot tables, to deliver an event nothing currently needs.

**This migration must be applied by hand after merge.** `render.yaml` builds and starts the Node
server; it has never run `supabase db push` or anything equivalent. This exact gap has now caused three
production incidents (`0010`; `0011`, unapplied for 8+ hours with repeating
`"Could not find the table 'public.clocks' in the schema cache"` errors in Render's logs; and `0012`,
which shipped unapplied in the very merge that fixed `0011`). See the release checklist at the end of
this file; `HANDOFF.md` open issue 20 and `CLAUDE.md`'s Deployment section carry the full history.

---

## Item 3 — Live state on the Campaign page

`apps/web/src/lib/useLiveCampaign.ts:30-62` currently subscribes to `party`, `bonds`,
`character_sheets`, `combat_encounters`, `clocks` (all `filter: campaign_id=eq.${campaignId}`,
all invalidating `['bootstrap', campaignId]`) plus an unfiltered `library`.

Add three more in the same shape, same invalidation:

| Table | Filter |
|---|---|
| `campaigns` | `id=eq.${campaignId}` — **`id`, not `campaign_id`** |
| `memberships` | `campaign_id=eq.${campaignId}` |
| `characters` | `campaign_id=eq.${campaignId}` |

Effect: phase changes, readiness, roster changes and character creation all appear without a refresh —
which is what makes the setup checklist in item 5 worth building.

**Do not subscribe `adventures`.** The doc comment at L16-25 explaining why (a `postgres_changes`
payload ships the whole `data` column to every subscriber at the wire level, which would leak
unrevealed Secret text) stays exactly as it is.

---

## Item 4 — Live Home tiles

New hook `apps/web/src/lib/useLiveHome.ts`, mirroring `useLiveCampaign.ts`'s structure. Called from
`HomePage`. Channel name `home:${userId}`.

Subscribe **unfiltered** to `campaigns`, `memberships`, `characters`, `party` and `bonds`, each
invalidating `['me']`.

**Unfiltered rather than the handoff's suggested `id=in.(<the user's campaign ids>)`**, for two
reasons: the joinless RLS policies already scope delivery per subscribing client (the same property the
existing unfiltered `library` subscription relies on), and an id list derived from the current `me`
response goes stale the instant the user joins a new campaign — which is one of the events Home most
needs to react to.

`character_sheets` is deliberately **excluded** despite being published: it fires on every sheet
commit, and the only thing Home reads from it is day-granularity `LastPlayedAt` (`auth.ts:57-68`).
Invalidating `['me']` on every keystroke-driven sheet save would be a lot of refetching for a date that
hasn't changed.

---

## Item 5 — `CampaignSetupChecklist`

The review's core ask: *"the whole 'where is the campaign in its setup' story feels disjointed; the GM
side and Player side each lack a sense of 'what am I waiting on.'"*

New `apps/web/src/features/campaign/CampaignSetupChecklist.tsx` + `.module.css`.

### Where it renders

**Once**, in `CampaignPage.tsx` inside `.page` (L115) and above the `isGM ? <GmView/> : <PlayerView/>`
split — not separately inside each view. It is a shared panel by design; rendering it in both branches
would duplicate the markup and let the two copies drift.

Not lazy-loaded — it is always visible. Run `npm run bundle-budget -w @asohav/web` after (cap is
220 kB gzip, last measured 208.74 kB).

### Shape

Three lanes, Signup → Party Creation → Playing, each marked done / current / upcoming, laid out with
`grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`. `auto-fit` over a hand-picked
breakpoint, per `CLAUDE.md`'s own "distributing peers" rule — the column count falls out of the real
width with nothing to get wrong.

Per lane:

- **Signup** — how many have joined; GM action *"Close signup & start party creation"*.
- **Party Creation** — one row per Player membership: name (resolved through `boot.users`), whether
  they have a character (`boot.characters`), whether they're `Ready`. GM action *"Start playing"* plus
  the `readiness.ready / readiness.total` tag. For a Player viewing their own row, this is where the
  **"Create your character" CTA** lives and must be unmissable — that discoverability problem is
  review item 2's other half.
- **Playing** — current/started state.

At `phase === 'Playing'` the whole thing collapses to a single summary line (roster count, character
count, all-ready) rather than unmounting, so the lanes stay legible mid-campaign.

### What moves into it

- `CampaignPage.tsx:78-95` — the `phase === 'Signup'` and `phase === 'PartyCreation'` buttons and the
  `.readyTag` move out of `.bannerActions`. The banner keeps the campaign name, phase badge, Glossary,
  Adventure Prep and Archive. (`0.25.0` ruled the app bar is account/navigation chrome; the same logic
  says a *campaign setup action* belongs with the campaign setup status, not in a title bar.)
- `GmView`'s `.gmNotice` phase-conditional paragraphs (`CampaignPage.tsx:197-204`) are removed as
  duplicates. The "GMs don't keep a character sheet / below is every player's sheet, live" paragraph
  stays — that's orientation, not status.
- `PlayerView`'s `.readyButton` (L283-287) and the `noCharacter` create-character link (L317-321): keep
  the ready toggle where it is (it sits with the player's own character card and reads naturally
  there), but the checklist must show the *same* state so the two can't disagree. The create-character
  CTA is duplicated deliberately — prominent in the checklist, still available in context.

### What it must not do

**No new game logic.** It reads `campaignPhase()` (`logic.ts:372`), `partyReadiness()` (`logic.ts:404`)
and `CAMPAIGN_PHASE_TRANSITIONS` (`logic.ts:388`), all of which already exist and are already unit
tested. The "Start playing anyway?" `ConfirmModal` stays in `CampaignPage` (L153-161); the checklist
calls up through a prop rather than owning a second confirm flow.

---

## Item 6 — Home page: running / playing lanes

`apps/web/src/pages/HomePage.tsx:49-54` renders one flat `.grid` of every membership, GM and Player
alike. The review's item 1: *"screen space is not well utilized; better distinguish campaigns you run
vs. campaigns you play in."*

- Split `me.memberships` by `Role` — `'GM'` → "Campaigns you run", `'Player'` → "Campaigns you play in"
  — each its own headed section wrapping the existing `.grid`
  (`repeat(auto-fill, minmax(300px, 1fr))`, unchanged).
- Wrap both sections in
  `.lanes { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; align-items: start; }`.
  `auto-fit` means a user who only plays, or only runs, gets **one full-width lane automatically** —
  no conditional CSS, no half-empty grid. Same reasoning as the checklist lanes above.
- Keep `PendingInvites`, `JoinByCode`, the create-campaign row and `.bottomRow`'s existing 768px
  behaviour untouched. The both-empty "No campaigns yet." state moves up to sit above the lanes.
- **`CampaignTile`** gains a phase badge, and — for a Player membership in `PartyCreation` with no
  `CharacterId`, or with one but `Ready === false` — a "waiting on you" hint. This is the Home-side
  half of "what am I waiting on".
- Lift `PHASE_LABEL` out of `CampaignPage.tsx:31` into a shared `apps/web/src/lib/phaseLabels.ts` and
  import it from both places, rather than writing a second copy. (`CLAUDE.md` already records what
  happens when a label map gets duplicated: `AdvancementPanel`/`CampaignBonds` each carry their own
  `TYPE_LABELS`, and a rename that touches one degrades the other to a raw enum value.)

---

## Item 7 — Combat: hidden and server-enforced until `Playing`

Review item 8: *"Combat shouldn't render when it can't happen."*

### Shared

`packages/shared/src/logic.ts` — add `PlayingRequiredError` and `assertPlayingPhase(campaign)` directly
alongside `assertPartyCreationPhase` (L376-386), same shape, same throw-and-let-the-route-map-it
pattern.

### Server

`apps/server/src/routes/combat.ts` `POST /start` — call `assertPlayingPhase(campaign)` immediately
after the existing `assertCampaignActive` try/catch (L18-23) and before the already-active-Encounter
check, mapping `PlayingRequiredError` → **409**, following `characters.ts:40-43`'s precedent exactly.

`PUT /:encounterId` and `POST /:encounterId/end` need **no** gate: `CAMPAIGN_PHASE_TRANSITIONS.Playing`
is `[]` (`logic.ts:388-392`), so a campaign can never leave `Playing`, and with `/start` gated an
Encounter can therefore only ever exist in a `Playing` campaign. Gating the other two would only be
able to strand a legitimately-running fight.

### Web

Guard the whole Combat block — `SectionHead` included, so no orphan heading — behind
`phase === 'Playing'` in both views: `GmView` (`CampaignPage.tsx:215-218`) and `PlayerView`
(`:255-262`). Pre-`Playing`, render nothing for Combat at all: no heading, no
"No Combat right now." `phase` is already derived at L50 and passed to both views.

Update the `React.lazy` comments while you're there — the existing "a GM always needs the
start-Encounter form regardless of whether one is running" reasoning is superseded by this gate, and a
stale comment explaining a decision that no longer holds is exactly the class of thing the `0.32.0`
audit had to go back and fix.

Clocks stay ungated — legal pre-`Playing`, unchanged.

### Tests

- `packages/shared/src/logic.test.ts` — mirror the three `assertPartyCreationPhase` cases at L180-192
  (allows `Playing`; rejects `Signup`; rejects `PartyCreation`).
- `apps/server/src/routes/combat.test.ts` — add `Phase: 'Playing'` to `makeCampaign` (L30) per
  correction 2, then add a case asserting 409 + `saveEncounter` not called for a non-`Playing`
  campaign.

---

## Item 8 — Test harness fixtures

Without these, the smoke test never renders the checklist or the Combat-hidden state at all.

- **`apps/web/src/harness.tsx`** — the `me.memberships` map (L262) gains `CampaignPhase` and `Ready`.
- New **`?phase=signup|partycreation|playing`** param overriding `cm-1`'s phase, following the existing
  `?archived=1` pattern (L56-74) exactly. `seedCampaign()` sets `cm-1` to `'Playing'`
  (`seedPlay.ts:24`), so the default path is unchanged.
- **`apps/web/scripts/harnessConfig.mjs`** `ROUTES` — add two entries:
  - `{ name: 'campaign (GM, signup)', qs: 'route=/c/cm-1&as=mike&phase=signup' }`
  - `{ name: 'campaign (player, party creation)', qs: 'route=/c/cm-1&as=ryan&phase=partycreation' }`

  Note this grows the matrix from 19 to 21 routes × 7 viewports × 2 appearances. The full run is
  already ~12-14 minutes; use `SMOKE_ROUTE=`/`SMOKE_VIEWPORT=` while iterating and reserve the full run
  for the final check.

---

## Files touched

- `packages/shared/src/api.ts` (`MeResponse` membership gains `CampaignPhase`),
  `packages/shared/src/logic.ts` (`assertPlayingPhase`, `PlayingRequiredError`), `logic.test.ts`.
- `apps/server/src/repo.ts` (select widening), `apps/server/src/routes/combat.ts` (phase gate),
  `auth.test.ts`, `combat.test.ts`.
- `supabase/migrations/0013_realtime_campaign_state.sql` (new).
- `apps/web/src/lib/useLiveCampaign.ts`, new `apps/web/src/lib/useLiveHome.ts`, new
  `apps/web/src/lib/phaseLabels.ts`.
- `apps/web/src/pages/HomePage.tsx` + `.module.css`, `apps/web/src/pages/CampaignPage.tsx` +
  `.module.css`, `apps/web/src/features/campaign/CampaignTile.tsx` + `.module.css`,
  new `apps/web/src/features/campaign/CampaignSetupChecklist.tsx` + `.module.css`.
- `apps/web/src/harness.tsx`, `apps/web/scripts/harnessConfig.mjs`.
- Docs: `CHANGELOG.md`, `README.md`, `HANDOFF.md`, `CLAUDE.md`, four `package.json` files.

---

## Verification

Local gate, all green before the PR:

- `npm run typecheck`, `npm run build`, `npm test`
- `npm run bundle-budget -w @asohav/web` — 220 kB gzip cap, 208.74 kB last measured. The checklist is
  new always-loaded content; if this pushes over, raise the budget **deliberately** with a recorded
  measurement per that script's own documented policy, don't silently bump it.
- `npm run test:responsive -w @asohav/web` — both appearances × 7 viewports × 21 routes.
  **No Chromium is installed on this machine** (`~/AppData/Local/ms-playwright` is empty); run
  `npx playwright install chromium` first. This machine has working egress, unlike the sandboxes
  `HANDOFF.md`'s open issue 5 describes — verified 2026-09-05, `https://asohav.onrender.com/api/health`
  → `200`. If you are in a locked-down sandbox instead, use `CHROMIUM_PATH=` against a pre-installed
  binary and don't re-run `playwright install` after a 403.

Post-merge, **mandatory, in this order** (this is the `release-reliability-checklist` skill's step 5):

1. Confirm the Render deploy reached `live` on service `srv-d9nqoqlaeets73ch25q0` and that the top
   entry matches the merge commit. `/api/health` answering `200` proves nothing — a failed deploy
   leaves the previous build serving and it answers just as happily.
2. **Apply `0013_realtime_campaign_state.sql`** via the Supabase MCP `apply_migration` tool, then
   confirm with `list_migrations` that it appears. See item 2 for why this is not optional.
3. Manual two-browser check, which is the only thing that actually proves the migration worked:
   - GM closes signup → the player's campaign page updates with no refresh.
   - The same change reflects on the player's Home tile with no refresh.
   - Combat renders no heading at all pre-`Playing`; `POST /combat/start` returns 409.

---

## Order of work

1. **Server + shared** (items 1, and 7's shared/server halves) — smallest, fully unit-testable, and
   settles the wire contract before any UI is built on it.
2. **Migration** (item 2) — write it early so it can't be forgotten at the end; apply it after merge.
3. **Live hooks** (items 3, 4) — nothing visible yet, but the checklist is much easier to build against
   a page that already updates itself.
4. **Checklist + banner refactor** (item 5), then **Home lanes** (item 6) — the two UI surfaces.
5. **Combat UI gate** (item 7's web half) + **harness fixtures** (item 8) together, since the fixture
   is what proves the gate.
6. Docs and version bump.
