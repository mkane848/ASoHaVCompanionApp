# GM content

Adventures (the one GM-only surface with no player-facing view at all), the authored Villain / NPC / Location stat blocks, and the collaborative Creating the World document.

_Part of `docs/architecture/`. Index: [`docs/architecture/README.md`](README.md). The invariants a session must not violate stay in `CLAUDE.md`; this file is the detail behind them._

---

## Architecture: Creating the World (V0.6 slice 8, `0.49.0`)

**Closes out `WorkPlan-V0.6.md` Section C's Slice 8 bullet — the eighth and last slice of the V0.6
migration.** `Ruleset-V0.6.md`'s brand-new "Creating the World" chapter: CATS (a short group
discussion — Concept/Aim/Tone/Subject Matter) plus a collaborative map build adapted from *The
Perilous Wilds*. Genuinely new content with nothing before it to migrate or reconcile — unlike
every prior slice, there's no ranked-model equivalent to translate and no legacy JSONB shape to
backfill.

**One new `World` document per campaign — the same single-row-per-campaign JSONB-blob shape `Party`
already established, not the many-rows-per-campaign shape `Clock`/`Adventure` use.** `World`
(`types.ts`) holds `Concept`/`Aim`/`Tone`/`SubjectMatter` (CATS, four freeform notes — captured as a
durable record of what the table agreed, not a mechanic the app enforces), a `StartingPlace` (one
per campaign: a name, one local-area `Details` entry per player, the doc's own seven fixed prompts
— famous for, infamous for, resource situation, resource consequence, notable organization, nearest
neighbor, neighbor relationship — and its own place-specific `Rumors`), and four growable lists —
`Regions`, `PlacesOfInterest`, `PersonalPlaces`, `Connectors` — plus a fifth flat list, `Rumors`,
for the chapter's separate "any place on the map" prompt. `newWorld()`/`normalizeWorld()`
(`logic.ts`) mirror `Party`'s own `pt-${campaignId}`-style stable id and self-heal-on-read pattern,
but as a single, shared function called from both `campaign.ts`'s campaign-creation route and its
bootstrap route's self-heal path — a real function, not the two independent inline object literals
`Party` has carried since `0.7.0` (kept there rather than retrofitted, since fixing that wart wasn't
this slice's job). A new `world` table (migration `0015_world.sql`) follows `party`'s own shape
exactly: `campaign_id` as the primary key itself, a joinless RLS SELECT policy, and — unlike
`adventures` — added to the `supabase_realtime` publication, since World has none of the GM-only
unrevealed-Secret leak concern that keeps Adventures off Realtime (see "Architecture: Adventures"
above); the whole table is meant to see every edit live, the same track-and-display treatment
Party/Clocks already get. `world.ts`'s `PUT` route is a trusted whole-document replace any campaign
member may call — no role gate, matching the doc's own "everyone is going to add a region to the
map... including the GM" framing — with only the existing archive-freeze check applied.

**The chapter's own headers name six sections, not five, and `WorkPlan-V0.6.md`'s own paraphrase
calls it "five-step" anyway — a real doc inconsistency, carried forward rather than silently
resolved, the same discipline already applied to the Adventure Countdown's "five steps, prose
promises six."** The source text's headers are "Step 1: Where the Adventure Begins," "Step 2: The
Surrounding Regions," "Step 2: Places of Interest" (reusing "Step 2" a second time — a numbering
slip, not a merged step: the second section's own instructions read as clearly sequential, "Now,
starting with the player whose character is the most traveled..."), "Step 3: Personal Places,"
"Step 4: Create Connectors," "Step 5: Start Rumors." This app ships all six sections exactly as
headed — `PlaceOfInterest`'s doc comment (`types.ts`) explains the mislabeling, and `World`'s own
doc comment spells out the five-vs-six count mismatch — rather than merging two sections to make
"five-step" literally true, or dropping one to make the header numbers add up.

**`PlaceOfInterest.Type` is a real, closed three-value enum (`'Area' | 'Settlement' | 'Landmark'`),
unlike a `WorldRegion`'s freeform `Description`** — the doc names exactly three categories for
Places of Interest ("The three categories for Places of Interest are:"), a genuine fixed list, not
an illustrative one; a Region's own "terrain type or political occupant" framing stays plain text
instead, since a region is often both at once ("an imperial kingdom" names an occupant but implies
terrain too) and forcing a two-way choice would misrepresent entries that are legitimately both —
the same "freeform text, no hidden bookkeeping" treatment every other Boon/Bane/Camp-Asset-style
field in this app already gets.

**Scoping call: World-building happens before character creation in this app, reversing the
chapter's own narrated order — a consequence of the Slice 8 scope bullet's own "Signup-phase
surface" framing, not a fresh guess made here.** The chapter's prose has World-building follow
Character Creation ("After you've done this, go ahead and create your characters... Now it is time
to place them in a setting"), but this app's `Campaign.Phase` model already reserves character
creation for `PartyCreation`, the phase *after* Signup, and `WorkPlan-V0.6.md`'s own Slice 8 bullet
calls this "a campaign Signup-phase surface." Rather than reopen that phase ordering (a change with
consequences well beyond this slice), `world.ts`'s `PUT` route stays reachable for the campaign's
whole life — not phase-gated at all — matching the doc's own "you don't need to know everything
right now... you can add more of any of them as your adventure plays out." This is also why
`PersonalPlace` (Step 4's "starting with the eldest character... except the GM," tied to "a place
they call home... for your character") carries no `CharacterId`: no character exists yet when this
content is most likely being written during Signup, so `Name`/`Event` stay plain freeform text a
contributor writes in their own words, the same authorship model every other section here already
uses. The doc's own turn-order suggestions ("starting with whoever wants to speak," "starting with
the eldest character") are left as table convention, not enforced — this app has never enforced
turn order anywhere else either (Combat's `nextActor()` is a GM-overridable suggestion, not a rule).

**Reachable from three places, matching how Adventure Prep is already surfaced, but explicitly not
GM-gated.** A persistent "Creating the World" link sits in `CampaignPage.tsx`'s banner for both
`GmView` and `PlayerView` (unlike the neighboring "Adventure Prep" link, which stays GM-only); a
"Build the world together" CTA lives in `CampaignSetupChecklist.tsx`'s Signup lane; and the
dedicated route itself, `/c/:campaignId/world` (`WorldPage.tsx`), is lazy-loaded from `App.tsx` the
same way `/adventure`/`/combat` already are — Creating the World is a working surface with real
content weight (CATS plus six list sections), not a small always-loaded panel, so it earns its own
route rather than living inline on the Campaign Shell the way Clocks does.

**`WorldPanel.tsx`'s per-list rows are plain edit-in-place cards (a name input, one or two
textareas, a remove button), not `TagList` chips** — Regions/Places/PersonalPlaces/Connectors each
carry 2-3 real fields, more than `TagList`'s single-string-per-chip shape fits, so they follow
`AdventuresPanel.tsx`'s own `SecretRow`/`AdventureCard` precedent (plain `onBlur`-committed inputs)
instead. The four genuinely flat string lists — `StartingPlace.Details`, `StartingPlace.Rumors`,
and `World.Rumors` — do use `TagList` directly, the same primitive Boons/Banes/Party Skill Tags
already share, since there's no reason to hand-rolled a second one-string-per-entry control.

**Bundle budget**: `WorldPage`/`WorldPanel` are their own lazy chunk from `App.tsx` (20.69 kB raw /
6.37 kB gzip), excluded from the first-load measurement the same way `/adventure`/`/combat` already
are. The two new banner/checklist links are this slice's only always-loaded addition — measured at
214.78 kB gzip against the 220 kB cap, up about 0.3 kB from slice 7's 214.48 kB. About 5.2 kB of
headroom remains.

**Deliberately not built this slice, real scope for later, not oversights**:
- Any numeric turn-order enforcement for who contributes next — the doc's own suggestions stay a
  table convention, the same treatment Combat's turn order already gets.
- A rendered/drawn map — the doc itself explicitly sanctions a list-based representation ("Grab a
  piece of paper or a shared document, you can do this as a big list, a spreadsheet, or a map you
  draw together! Do whatever works for the group."), so a list-based UI isn't a scoped-down
  compromise here the way Combat's Range bands are.
- Linking a `WorldRegion`/`PlaceOfInterest`/etc. to `library.villains`/`npcs`/`locations` or to an
  `Adventure` — nothing in this slice's scope asked for cross-referencing Creating the World's
  content into GM prep content; if that bridge is ever wanted, it's separate, later work.

**With Slice 8 shipped, all eight slices of `WorkPlan-V0.6.md`'s migration plan are complete.**
`Ruleset-V0.6.md` is fully implemented against this app's own architecture, with every judgment
call the migration required recorded in `WorkPlan-V0.6.md` Section A-E and in `README.md`'s
judgment-calls list. Section D's still-open rules questions (the Party Skill Tag economy, Forge a
Bond's effect, Subdued's duration, and the rest) remain exactly that — genuinely open, not this
app's to guess at — and stay a fence for future work, not a backlog this migration was ever meant
to close.

## Architecture: GM stat blocks (slice 8, `0.35.0`)

**Villains, NPCs, and Locations are now real Content Admin collections, extending the existing
`library.enemies` pattern exactly as `WorkPlan-V0.5.md`'s slice-8 scope names** — authored,
schema-driven GM content, not a new UI surface or a new server route. `library.villains`/`npcs`/
`locations` (`packages/shared/src/types.ts`) each ship with a real `FieldDef[]` in `schema.ts`, so
Content Admin's fully generic list/detail/create/delete/validation/nav machinery covers all three
for free — no server route code and no admin-page code beyond the three `schema.ts` entries, the
same "zero new plumbing" precedent `CampAssetTemplate` set in slice 7. A new "GM Content" nav group
holds all three, alphabetically, mirroring every other nav group's convention.

**This slice is authored content only — it does not wire a Villain into Combat.** A GM who wants a
Villain fighting as a Boss still creates a separate `EnemyTemplate` (or an ad-hoc Boss) the same way
as before; nothing here adds a `RefId`/spawn path from `library.villains` into a live
`CombatParticipant`. `Villain` deliberately reuses `ToughnessTier`/`EnemyStatusLimit` for its own
Combat-adjacent fields (`Toughness`, `StatusLimits`) so the *data shape* lines up with `EnemyTemplate`
if a later slice ever wants to bridge them, but building that bridge is out of this slice's scope —
see `WorkPlan-V0.5.md` slice 8's own "extending the `library.enemies` pattern" wording, which reads
as "reuse the same authoring shape," not "make a Villain literally combat-spawnable."

**`Villain`'s `Attacks`/`Powers`/`Resources` fields stay freeform prose, not structured data** —
this app has no Ability system to build a real "Enemy Ability Menu/Builder" against (V0.5's own text
for the Attacks field reads as uncertain that one exists either: "Give them Attacks... Enemy Ability
Menu/Builder"), and `Resources` (the doc's "short list of important NPCs, locations, items, secrets,
and ties to the Heroes") is a `taglist` of short phrases rather than `ref`s into the new `npcs`/
`locations` collections — a Resource is often named in prep before it exists as its own authored
entity, and Adventures (slice 9, `0.36.0`) are where a Villain actually gets *linked* to specific
NPCs/Locations (`Adventure.VillainId`/`NpcIds`/`LocationIds` — see "Architecture: Adventures"
below), not this slice — `Villain.Resources` itself stayed exactly this freeform taglist even once
slice 9 shipped, since the doc's own Resources concept is still "a short list of ties," not a set of
structural references.

**`NPC.StatusLimits` is present on every NPC, not gated behind `IsCombatant` at the type level** —
same "field always present, only sometimes meaningful" treatment `EnemyTemplate.GambitCharges`
already gets for a non-Boss Enemy. V0.5's own text ("If your NPC is capable in combat, define their
Status Limits... If they are not, their Status Limits are likely 1 or 2") treats even a
non-Combatant NPC as having *some* Status Limits, just small ones — reflected in the seeded Rosa the
Blacksmith example below (`IsCombatant: false`, a single `Overwhelmed 2` limit) rather than an empty
array.

**`Location.LocationType`, not `Location.Type`** — the field name is deliberately more specific than
the doc's own generic "A Type" heading, since `NPC.Type` is a *different* nine-value enum on the
same schema-driven admin surface and giving both fields the bare name `Type` would read as one
shared concept when they aren't.

**`EnemyTemplate.StatusLimits` was retrofitted from raw `json` to the same new `statusLimits`
FieldType this slice needed for `Villain`/`NPC` anyway — closing `WorkPlan-V0.5.md` Section B hazard
1 for Enemies too, not just for the two new collections.** The hazard named `EnemyTemplate.
StatusLimits` as unvalidated raw JSON and called slice 8 "the most likely place it bites," so once a
real structured editor (`StatusLimitsEditor` in `FieldEditor.tsx`, a repeatable {StatusName, Limit}
row list) and shape validation (`validateLibrary()`'s `statusLimits` branch in `adminLogic.ts`:
every entry needs a non-empty `StatusName` and a `Limit` greater than 0) existed for the new
collections, applying the same field type to the existing one was near-free and left no raw-`json`
StatusLimits field anywhere in the schema. `Move.Results`/`Ability.Effects`-shaped hazards elsewhere
in the codebase are unaffected — `Ability` no longer exists (retired slice 2) and `Move.Results`
already got its own dedicated validation in slice 3; nothing here touches either.

**Seed content is drawn from `Ruleset-V0.5.md`'s own worked example, not invented from scratch.**
The doc's "Villains and Enemies in Combat" section gives exactly one full Villain — Grizza the Tall,
complete with flavor text, a Goal, and a Toughness/Status-Limits stat block (Hurt 12, Scared 13,
Tricked 9) — seeded verbatim as `vil-grizza`. The two seeded NPCs and three seeded Locations draw on
the same worked material: Rosa the Blacksmith is the doc's own named Hook figure ("barges into
wherever the Heroes are, pleading for someone capable to travel into the woods and find where the
goblins dragged off her daughter"); the goblin-clan/ancient-tomb Concept text that introduces Grizza
supplies the seeded Locations (Hollow Bend the hamlet, the Sunken Tomb the goblins overtook, the
Whispering Wood where the daughter was taken). Skreel (a Combatant NPC, `Type: 'Minion'`) is the one
invented entry, added specifically to seed an `IsCombatant: true` example alongside Rosa's `false`
one. Every seeded Location's `CustomMoves` field is left empty — the doc's own "optionally, one or
more custom moves" is left unauthored rather than invented, the same discipline the 25 placeholder
Improvement Trees (slice 4) and the freeform Camp Assets (slice 7) already established for
doc-named-but-unauthored content.

## Architecture: Adventures (slice 9, `0.36.0`)

**The fourth surface, and the one that closes out the V0.5 migration.** `Adventure`
(`packages/shared/src/types.ts`) is campaign play-state, not library content — unlike `Villain`/
`NPC`/`Location` (slice 8), which are shared, reusable stat blocks any campaign could hold, an
Adventure is one GM's specific combination of those for one specific campaign's story, so it lives
alongside `Encounter`/`Clock` (a new `adventures` table, migration `0012`, same joinless-RLS shape)
rather than in `Library`. Its fields follow `Ruleset-V0.5.md`'s own "Adventures" chapter directly:
Concept, Type (`AdventureType` — the doc's six named types, Offensive/Stand/Race/Mission/Mystery/
Journey, each carrying its own "Elements to include" guidance in `ADVENTURE_TYPES`,
`packages/shared/src/adventures.ts`), Hook, a `VillainId`/`NpcIds`/`LocationIds` reference into
slice 8's own collections (an Adventure references them, it doesn't redefine them), floating
Secrets (`AdventureSecret[]` — `{Text, Revealed}`, deliberately no `LinkedToIds`, since the doc is
explicit a Secret never ties to one specific NPC or Location), and a Countdown.

**GM-only, end to end — the first content in this app with no player-facing view at all, not a
scoped-down one.** Every prior slice's play-state (Combat, Clocks, Party) is track-and-display: the
whole table sees the same state, by design. An Adventure's Concept, Villain, and especially its
Secrets (`Revealed` is GM bookkeeping — "has this come up in play yet" — not an access gate on its
own) are spoiler content by the doc's own framing ("never plan the explicit way the Heroes will
uncover" a Secret). `campaign.ts`'s bootstrap route only fetches `adventures` for a GM membership
(the same conditional-fetch shape `invites` already uses for Players); all three Express routes
(`apps/server/src/routes/adventures.ts`) require `Role === 'GM'` — unlike Clocks, where any campaign
member may act; `AdventuresPage.tsx` (`/c/:campaignId/adventure`, linked from `CampaignPage.tsx`'s
GM-only banner) redirects a Player who navigates there directly. `useLiveCampaign.ts` deliberately
does **not** subscribe to the `adventures` table over Realtime, unlike every other campaign table it
syncs — see its own doc comment for why: a `postgres_changes` payload carries a subscribed table
row's *entire* `data` column to the client regardless of whether the app's handler reads it
(this app's handlers just call `invalidateQueries` and ignore the payload — the leak would happen at
the wire level, before any of this app's code runs), so subscribing would leak unrevealed Secret
text to every campaign member's browser the instant the GM saved it. Since only the GM ever edits an
Adventure, a GM's own page just refetches normally and loses nothing by skipping live-push.

**The Countdown is the one place this slice's own first design got reversed mid-build.**
`WorkPlan-V0.5.md`'s scope note reads "a Countdown is a clock variant," and the first cut followed
that literally: a real linked `Clock` row (`Kind: 'Countdown'`), created alongside the Adventure in
one request (mirroring `combat.ts`'s Encounter+Rapport pattern). That fell apart on the same
Realtime fact above: every existing Clock is fully player-visible by design (`ClocksPanel.tsx`
renders for GM and Player alike), but the doc is explicit an Adventure's own Countdown is the GM's
*off-screen* reference — a real, stated distinction from a *Threat* (also Countdown-kind, but
"player facing," the doc's own word), which stays exactly what it always was: a real `Clock`,
created directly through `ClocksPanel`, untouched by any of this. Rather than build this app's first
field-level access-control mechanism to patch a leak in a subsystem built for a different trust
model, the whole design was backed out: `Adventure.CountdownMarks`/`CountdownSteps` embed the
Countdown directly on the Adventure document, and `tickAdventureCountdown()` (`adventures.ts`)
reuses `Clock`'s own clamped-delta tick math as a small standalone function rather than a shared call
into `clocks.ts` (the two operate on different, incompatible shapes). See `README.md` item 39 for
the full writeup — one decision (the Realtime-leak fact), two consequences (the Countdown's embedded
shape, and the surface's GM-only scope), not two independent calls.

**The doc's own "five steps, prose promises six" inconsistency ships unresolved, on purpose.**
`ADVENTURE_COUNTDOWN_STEP_NAMES` (`types.ts`) is exactly `['Seed', 'Bloom', 'Wilt', 'Wither',
'Rot']` — five named steps, matching what the doc actually lists, not the six its own prose
promises (`WorkPlan-V0.5.md` Section D item 12). No sixth step is invented to make the count work,
the same "carry the doc's own contradiction forward rather than guess at a fix" treatment this
migration has given every other unresolved rules question (Bond/Kin/Kith, Crumble/Fall/Dishonored,
and others — see `HANDOFF.md`'s "V0.5 ruleset gaps" list).

**A Concluded Adventure locks its own fields**, the same treatment a Resolved Clock already gets in
`ClocksPanel.tsx` — nothing about a finished story should keep mutating. Reopen and Remove stay
available regardless (gated on the campaign's own archive state alone), since those are the two
actions that make sense to take on a Concluded Adventure. Seed content for the responsive-smoke/
screenshot `?adventures=1` harness fixture reuses slice 8's own Grizza/Rosa/Skreel/Hollow Bend
material rather than inventing unrelated demo content — `Ruleset-V0.5.md`'s own "Sample Adventure"
section, at the very end of the doc, turned out to be entirely empty (bare headers, no content under
any of them), so there was no worked Adventure example to draw from the way Grizza the Tall served
slice 8.
