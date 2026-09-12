# Moves and Camp

The 22 seeded Moves and the guided Camp flows — Make Camp, Keep Watch, Set Out, Enjoy Downtime, End the Session — plus the party's own shared identity and Camp Assets.

_Part of `docs/architecture/`. Index: [`docs/architecture/README.md`](README.md). The invariants a session must not violate stay in `CLAUDE.md`; this file is the detail behind them._

---

## Architecture: Moves and Camp content (V0.6 slice 4, `0.45.0`)

**The largest single slice of the V0.6 migration by lines touched — not a new mechanic, a content
and flow rewrite against text slices 1-3 had already made mechanically true.** `WorkPlan-V0.6.md`
Section A2 lists what changed; this slice built all of it in one pass rather than splitting further,
since almost every item is the same kind of edit (re-author a Move's `Results` text, rebuild a
guided-flow modal to match) and none of it needed new primitives beyond two small shared helpers.

**All 22 seeded Moves in `seedLibrary.ts` are re-authored against `Ruleset-V0.6.md`'s literal
text** — `Description`/`Results`/`Options` for every Basic and Adventure Move, replacing prose that
still named ranked Status Ranks, the old five-Consequence vocabulary, and pre-Strain mechanics
that had drifted since slice 1 only patched the primitives underneath, not the words on top (per
that slice's own "Deliberately not built" list: "Re-authoring all 22 seeded Moves' `Results` text
against V0.6... Slice 4's job"). Two Moves are renamed to match the doc: `m-levelup`'s `Name`
changes from "Level Up" to **"Advance a Motif"**, and `m-journey`'s from "Undertake a Journey" to
**"Set Out"** — both keep their existing `Id`, only `Name`/`Description`/`Results` changed, so
nothing referencing a Move by Id anywhere else in the codebase needed touching. The new
**Consequence vocabulary** — Burdened / Compromised / Delayed / Depleted / Exposed, replacing
Attrition / Detection / Danger / Delay / Sacrifice — appears in Invoke Expertise's and Take a
Risk's `Results.Options`, and a new `g-consequence` glossary entry (aliased to all five names)
explains them as one concept rather than five separate entries, reframing the old `g-attrition`
entry rather than deleting it outright (V0.6 dropped "Attrition" as a name; nothing in this app's
code ever keyed off the string itself, only glossary auto-linking, so this was a pure content
change).

**The advance-at-next-Camp timing change needed no new stored field — only a different trigger.**
V0.6's own text: a full Potential/Rapport track "advances the next time you Make Camp," not the
instant it fills. The shipped V0.5 behaviour auto-opened `MotifAdvanceModal`/`PartyAdvanceModal`
the moment `setPotential`/the Rapport `Pips` handler reached cap (`MotifPanel.tsx`,
`AdvancementPanel.tsx`, and `EndSessionModal.tsx`'s own Rapport-marking path) — which reads as
advancing immediately, off-camera from any actual Camp, exactly what the new wording rules out.
Rather than invent a new "is the party currently at Camp" session concept to gate this properly,
all three call sites stopped auto-opening the picker; `MotifPanel.tsx`/`AdvancementPanel.tsx` each
render a persistent "Ready to advance — at your next Make Camp" button once the track reads full
(the same `.readyBadge` gold-tint/gold-line "interactive chip" treatment `ThemePanel`/`LooksPanel`'s
own chips use), which opens the exact same picker manually whenever the player actually gets there.
`EndSessionModal.tsx` still marks Rapport toward the cap; it no longer auto-opens
`PartyAdvanceModal` for it at all, since the whole `advancingParty`/`applyPartyAdvance` plumbing
that modal used had no other trigger left once the auto-open was removed and was deleted as dead
code rather than left unreachable. The picker components themselves
(`MotifAdvanceModal`/`PartyAdvanceModal`) and the mechanics they apply
(`takeMotifAdvance()`/`applyPartyRapportAdvance()`) are untouched — only *when* they can be opened
changed. This is the same track-and-display philosophy the rest of this app already applies
(Combat never blocks an action, Clocks never auto-resolve a Countdown) — a full track is a fact the
app displays, not a state machine it enforces.

**`CampActionsModal.tsx`'s "Change Quest" Camp Action is replaced by "Rewrite a Skill/Flaw Tag,"**
per V0.6's own line: "Camp Actions change too: 'Change personal Drive/Want' becomes 'Rewrite or
update any one of your Skill or Flaw Tags.'" A Motif's Quest is still freely editable on the sheet
itself (`MotifPanel.tsx`'s own quest input); it's just no longer spent as a Camp Action in its own
right. The new action (Motif picker, Skill/Flaw toggle, an "add a new tag" vs. "replace an existing
one" select, and a text field) calls a new shared `rewriteMotifTag()` (`logic.ts`) — the same
mutation `EndSessionModal.tsx`'s own "grow into your changes" option needs (see below), so it's a
real, non-duplicated helper rather than two copies of the same three-line mutation. The "Eligible
for advancement?" reminder in the same modal was reworded to point at the new "Ready to advance"
buttons rather than the old "clear it from Advancement above" phrasing that assumed an immediate
clear.

**`KeepWatchModal.tsx`'s GM 6- now marks party Rapport, and the volunteer's roll is fixed to +Wit**,
both per A2's literal wording ("The GM's 6- now marks Rapport for the party where it used to have
everyone mark Potential. The watcher's roll is fixed to +Wit rather than 'an appropriate Virtue'").
The volunteer's own 6- result no longer marks Potential either — V0.6's text for that branch is
just "the GM takes or holds a hard move," with no Potential mention, unlike the V0.5 wording this
modal originally shipped against — so the `motifIndex`/`MotifPicker` plumbing that existed only to
support that mark (on both the GM's and the volunteer's miss branches) was removed entirely rather
than left half-wired. Fixing the roll to +Wit removed the virtue-picker step this modal used to
show between the GM's roll and the volunteer's — one less click, and it matches the doc's own
"aided by Rapport as normal" framing of a single, specific roll rather than a free Virtue choice.

**`UndertakeJourneyModal.tsx` is renamed to `SetOutModal.tsx`**, matching the Move rename above —
a real, permanent identity change (not the wording-only correction `PartyPlaybookPanel.tsx` stayed
under in slice 7), so the file itself moved rather than just its exported name. Loadout was already
this modal's first section before the rename (A2: "Set Out keeps Scout Ahead → Venture Forth intact
but promotes Loadout to its first step") — slice 7's own build already got this right, so the only
real changes here are the rename itself and tightening a few option strings to match the doc's
current wording (e.g. Venture Forth's "+1 Ongoing to any future rolls while you travel," not the
older "on this Journey" phrasing).

**`EnjoyDowntimeModal.tsx`: Rest, Carouse, and Pivot all changed mechanics, not just labels.** Rest
was "spend 1 Wealth to remove all Status Ranks" (a full `d.Statuses = []` wipe); V0.6's own text is
"spend 1 Wealth to Recuperate without taking Strain" — a materially different effect (advance the
Healing Track, optionally remove one Minor Status, no full wipe). Rather than duplicate
`StatusesPanel.tsx`'s own Recuperate mutation a second time, that logic moved into a new shared
`applyRecuperateEffect()` (`engine.ts`) taking a `takeStrain` flag — `StatusesPanel.tsx`'s own
Recuperate action calls it with the default (`true`, the normal 2-Strain cost) and Rest calls it
with `false` for the one place V0.6 waives that cost. Carouse changed from spending 1 Treasure to
spending 1 Wealth (A2: "Carouse costs 1 Wealth, not 1 Treasure") — `Treasure` itself survives as a
field with no remaining named sink anywhere in this app, same "field stays, the sink retired" shape
`Scars[]` got in slice 1. Pivot's personal branch now reaches V0.6's own "change a Motif as if you
had marked your third Forsake" via a new `pivotMotifQuest()` (`logic.ts`) — resets that Motif's
`ActBreaks`/`Forsakes` to 0 and sets a fresh Quest — rather than the old direct
`d.Motifs[i].Quest = text` overwrite, which never touched the Act Break/Forsake tracking those
fields carry (`markForsake()`/`questAbandoned()` in `logic.ts` are the doc's actual Forsake
mechanic; this app still has no UI for stepping through Forsakes one at a time in play, only this
one Pivot-driven path that reaches the same end state directly — a real, narrower scope than a full
Forsake-tracking UI would be, flagged here rather than silently assumed complete).

**`EndSessionModal.tsx`'s entire per-player Hold economy is retired, replaced by a three-way growth
choice** — V0.6's own text: "the per-player Hold economy is gone... each player chooses one of
three ways to grow: mark a Bond with a named Hero, rewrite a Skill or Flaw Tag, or mark Potential on
a Motif whose Quest they progressed." The old "how many of your own questions hit → grant that much
Hold → spend it 1-for-1 on refresh Gear / clear a Condition / mark Bond / mark Potential" flow is
gone from this modal entirely — `CharacterSheet.Hold` itself is untouched and still fully live for
the Moves that grant it directly (Assess the Situation, Discern the Truth, via `MoveRollHelper.tsx`
and `holdGrantForTier()`), this modal just no longer taps into it. The three growth options are
mutually exclusive per player (matching "chooses **one**"): Grow closer with a Hero opens the
existing `MarkBondModal`/propose flow, unchanged; Grow into your changes reuses the same
`rewriteMotifTag()` the new Camp Action calls; Grow toward your goal calls `addMotifPotential()`
directly. The party Rapport question-count section (0 / 1-2 / 3+ hits → 0/1/2 Rapport) is
unchanged, other than no longer auto-opening `PartyAdvanceModal` on a full track (see the
advance-at-next-Camp note above).

**Glossary sweep** (`seedLibrary.ts`'s `glossary` array), per A2's own list — add: `g-strain`,
`g-boon`, `g-bane`, `g-healing-track`, `g-opposition-clock`, `g-threat-clock`, `g-development`,
`g-headway`, `g-push-yourself`, `g-set-out`. `g-opposition-clock`/`g-threat-clock`/`g-development`/
`g-headway` describe Slice 6's own not-yet-built Clock rename (`Basic`→Opposition, the new
Threat-Clock shape) — added now because A2 explicitly names them as this slice's glossary content,
each flagged in its own definition as "not yet a distinct Kind in this app — Slice 6's job," the
same "describes the target, not the code" framing this file already uses at the section level,
applied here at the glossary-entry level for the first time. Rewrite: `g-status` (severity slots,
not ranked boxes) and `g-advantage` (Boon/Bane comparison, not the old two-Move trigger list).
Retire/reframe: `g-recovery` (Recoveries themselves are retired; the entry now explains that and
points at the Healing Track instead of describing a mechanic that no longer exists) and `g-scar`
(the Subdued-triggered three-way choice that used to grant one is gone with no replacement; Scars
survive as a field, so the entry now describes what's still true rather than the retired trigger).
**Found stale during the build, not in A2's own list, and fixed for the same reason the rewrites
above were**: `g-crumble` (still claimed a Combat Vulnerable-4 grant slice 1 already deleted),
`g-subdued` (still described the old Rank-6/three-way-choice model slice 1 replaced with a derived
badge), and `g-unstable` (still said "Rank 4" a full slice after `isUnstable()` was redefined to
Major/Severe Statuses) — all three had been left stale since `0.42.0` because slice 1's own
glossary-sweep work was explicitly deferred to this slice, and nothing had re-checked them since.

**Two real bugs found and fixed, both by `interaction-smoke.mjs` states that had gone silently
stale for three releases, not by anything new this slice built.** The suite's "modal: Give a
Status"/"modal: Heal a Status" states targeted `Give a Status…`/`Heal a Status…` button labels that
slice 1 renamed to `Take Strain…`/`Recuperate…` back in `0.42.0` — `getByRole('button', {
name }).first()` found no match, and the script's own "trigger not present, skipped" fallback
(added so a viewport-conditional control doesn't fail the whole suite) swallowed the miss silently
rather than failing, so this carried zero CI signal for three whole slices. Verified factually
before assuming a bug: running the two stale states directly confirmed "trigger not present" at
every viewport, not just a guess from reading the diff. Renamed the states to match the real
button text (`modal: Take Strain`/`modal: Recuperate`); both pass clean now. The `modal: Undertake
a Journey` state was renamed to `modal: Set Out` in the same pass, matching this slice's own Move
rename, and `TierChoiceRow.tsx`'s doc comment (which named its own call sites) was corrected to
list Set Out and Enjoy Downtime's new Rest flow rather than the old names.

**Bundle budget**: this slice's real, necessary first-load additions (the two `.readyBadge` buttons
in `MotifPanel`/`AdvancementPanel`, both always-visible sheet content) measured at 211.77 kB gzip
against the 220 kB cap — essentially flat versus slice 3's 211.81 kB, since almost everything else
this slice touched is either lazy-loaded modal content (`CampActionsModal`, `KeepWatchModal`,
`SetOutModal`, `EnjoyDowntimeModal`, `EndSessionModal` are all already behind `React.lazy` from
`CharacterSheetPage.tsx`) or pure content/text changes with no new markup.

**Deliberately not built this slice, real scope for later slices, not oversights**:
- Any new `CharacterSheet`/`Party`/`Move` fields — this slice re-authored existing text and rebuilt
  existing flows against the same data shapes slices 1-3 already shipped; nothing here needed a new
  wire-contract field.
- The Bond spend menu's five explicit options and Forge a Bond's own effect (still "TO BE
  DETERMINED" in the ruleset itself) — Slice 7's (`0.48.0`).
- Threat Clocks becoming a real, distinct Kind with Developments, and the Basic→Opposition rename —
  Slice 6's (`0.47.0`); this slice only added the glossary entries A2 named ahead of that build.
- A UI for stepping through a Quest's Act Breaks/Forsakes one at a time in play — `markActBreak()`/
  `markForsake()` exist in `logic.ts` with no call site beyond this slice's own `pivotMotifQuest()`
  reaching the Forsake-3 end state directly; a real Quest-progress UI is separate scope no slice has
  asked for yet.

## Architecture: Party Identity & Camp (slice 7, `0.34.0`)

**Playbooks are not part of this game's systems, confirmed directly by the repo owner — a real
ruleset decision, not an inference from `Ruleset-V0.5.md`'s own "Coming Soon" text.** The doc's
"Hero Moves and Playbooks" section (Section D item 15 of `WorkPlan-V0.5.md`) reads as though
Playbooks were simply unwritten yet; they're cut outright. This closed a standing open question:
**Hero Moves are cut too**, not deferred — they were the one thing in the doc that named Playbooks
as their own foundation, so with no Playbook system to hang them off, there's nothing left to build
toward. See "Working conventions" below for where this now lives in the maintained "not built" list.
This slice's own name is affected only in wording, not in what it built: nothing here ever
implemented a Playbook mechanic (a full character-class template with authored moves/abilities) —
it's freeform party identity data, so the rename below is a correction to how this was described,
not a change to what shipped.

**The party gets its own shared identity, mirroring a Hero's Motif at party scope.**
`Party.Motif`/`Quest`/`SkillTags`/`WeaknessTags`/`Path`/`Goal` (`packages/shared/src/types.ts`) are
plain freeform fields any campaign member can edit — the doc gives no structured catalog to pick
from for any of these (and, per the above, never will), so this is the same "write it yourselves"
treatment Quests and Bond Moves got before any catalog existed for those either, not a guess at an
unwritten one. `Motif`/`Quest`/`Path` are standing identity text; `Goal` is the party's current,
changeable objective, set or changed as a Camp Action (below) — kept as a separate field from
`Path` since the doc treats them as two different things (`Path` backs the unique "did we follow
our PARTY PATH" End the Session question; `Goal` is "what are we hoping to accomplish right now").
`WeaknessTags` uses the doc's own word for this section rather than being forced to match a Hero
Motif's `FlawTags` naming. **`PartyPlaybookPanel.tsx` (`apps/web/src/features/sheet/`) lives on the
Character Sheet, not the Campaign Shell** — the same home Rapport and Bonds already have in
`AdvancementPanel.tsx` despite being party-shared data too, so this follows existing precedent
rather than starting a second convention for where shared-but-per-sheet-editable state lives. The
component and file kept their `0.34.0` name (`PartyPlaybookPanel`) rather than being renamed for
this correction — see the note at the end of this section.

**Progressing the party's Rapport now offers a real choice, closing a gap `AdvancementPanel.tsx`'s
own placeholder text used to name explicitly.** Ruleset-V0.5.md's "Party Advancement — Rapport"
lists three options on a full Rapport track: add a Skill Tag, add or remove a Weakness Tag, or
gain a Party Improvement. The third stays unavailable — the doc's own "Party Motif + Improvements"
section names no trees at all, unlike Hero's 25 (see `Improvement`'s doc comment) — but the first
two are real now that `Party` has somewhere to hold the tags. `applyPartyRapportAdvance()`
(`packages/shared/src/logic.ts`) replaces the old `clearRapportForPartyLevel()`, taking the chosen
`PartyAdvanceOption` and an optional tag; `PartyAdvanceModal.tsx` (its own file, lazy-loaded — see
the bundle-budget note below) is the shared "clear it, choose one" dialog both `AdvancementPanel.tsx`
and `EndSessionModal.tsx` open once Rapport fills, the same shape `MotifPanel.tsx`'s
`MotifAdvanceModal` already established for a Hero's own Potential track.

**Camp Assets are a hybrid catalog-or-freeform pick, a repo-owner call rather than a choice between
the two existing patterns this app had for authored content.** The doc describes a single starting
"magic camp item" that levels up through Tiers, with no named examples. Neither of this app's two
existing patterns fit outright: `library.motifs`/`library.moves` (pure library, no per-holder
customization) don't allow a table writing their own, while Combat's `AddParticipantModal.tsx`
tabbed Library-or-Ad-hoc UI adds real complexity (tabs, an RHF form, an optional admin-only
"save to library" write) that a Camp flow open to every player, not just a GM who may also hold an
admin account, shouldn't inherit. The repo owner asked for a genuine third shape instead: a single
text input backed by a native `<datalist>` of `library.campAssets` names (`CampAssetTemplate` — a
new, ordinary schema-driven admin collection, `Name`/`Description`/`Tier`/`Effect`) — typing a name
that matches the catalog autofills the rest and links `RefId`; typing anything else stays a fully
custom, ad-hoc entry (`RefId: ''`). `AddCampAssetModal.tsx` implements this with zero new
dependencies (no combobox library), the accessible native-HTML equivalent of a "freeSolo
autocomplete." Deliberately doesn't offer Combat's "save this ad-hoc one back to the library"
option — that write goes through `requireAdmin`, and this flow is a player action, not a GM one.

**Four Adventure Moves that shipped as reference-text-only in slice 3 (Make Camp, Keep Watch,
Undertake a Journey, Enjoy Downtime) are now real guided flows**, built on the same "player reports
the tier or the number they rolled, the engine applies the mechanical change" pattern every other
roll-driven mechanic in this app already uses (`MoveRollHelper.tsx`'s Hold grants, the Subdued
flow, Resist Rolls) — this app still never rolls dice itself. `TierChoiceRow.tsx`
(`apps/web/src/features/sheet/`) factors out the repeated "report which tier you hit" button row
(10+ / 7-9 / 6-) shared across all four flows' several rolls, rather than copying it four times the
way `MoveRollHelper.tsx`'s own informational tooltip is deliberately left duplicated at its two
render sites (there was no single shared roll-breakdown component to hook a shared version into
there; here there was a small, genuinely identical piece of UI worth extracting instead).

- **Make Camp's personal-resource reset (Statuses, Conditions, Armor, Recoveries, Load) already
  existed** — `StatusesPanel.tsx`'s own "Make Camp" header button (`MakeCampModal.tsx`, predating
  this slice) already reduces Negative Statuses by a flat 2 Ranks and Positive by 1, refreshes
  Armor, refills Recoveries, and lifts the Load lock automatically, then lets the player pick which
  d6-reported number of marked Conditions to clear. This slice found that gap only by nearly
  recreating it with a dice-reported Status-reduction budget of its own before discovering the
  existing button — a reminder to grep for a feature's name before assuming it's unbuilt just
  because a section here doesn't mention it. What slice 7 actually adds is `CampActionsModal.tsx`
  (opened from a **separate "Camp Actions" button**, deliberately not reusing the "Make Camp" label
  a second time for a different modal): advancing a Bad Guy Clock ("once immediately, then again
  per full day at Camp," a days-count input times `tickClock()`), a plain reminder to check
  Advancement for a full Motif/Bond/Rapport track, and the actual Camp Actions the doc names — each
  player gets `campActionsAllowed()` (Party Level + 1) of them per Camp, spent on: setting/changing
  the Party Goal, changing a personal Motif's Quest text, using a Camp Asset (logged to
  `Party.History`), or progressing a personal project Clock (report a tier, tick 3/2/1 segments —
  the same table Enjoy Downtime's own Advance activity uses, since the doc names no separate one
  for this Camp Action). **"Changing a personal Motif's Quest text" as its own Camp Action is
  superseded by V0.6 slice 4 (`0.45.0`)** — see "Architecture: Moves and Camp content" above; that
  slot is now "Rewrite a Skill or Flaw Tag" instead, per the doc's own "Change personal Drive/Want"
  → "Rewrite or update any one of your Skill or Flaw Tags" text. A Motif's Quest itself is still
  freely editable directly on the sheet, just no longer spent as a Camp Action.
- **Keep Watch** (`KeepWatchModal.tsx`): the GM's "roll + Nothing" (no Virtue) first, then a
  volunteer's Virtue roll. Both a GM-Tier2 result ("one party member wakes with Restless 2") and a
  volunteer-Tier3 choice ("you're alert — gain Alert 2") name a Status landed on someone other than
  the roller — this app has no `PendingStatusOffer`-style mechanism outside Combat, so per a
  repo-owner call these narrow scope to the viewer's own sheet only (any Status grant here lands on
  whoever is running the flow), with the narrative-only options logged to `Party.History` instead
  of invented as mechanical effects on a teammate this app can't safely target.
- **Undertake a Journey** (`UndertakeJourneyModal.tsx`): Loadout (reuses the existing
  `CharacterSheet.Load.Tier` field/selector rather than duplicating it), then Scout Ahead
  (+Wit, choose up to 2 on a 10+ / 1 on a 7-9 from Alert 2 / a named Status at Rank 2 / Prepared 2 /
  a logged discovery), then Venture Forth (+Guile, a Tier3 choice from four narrative outcomes, a
  Tier2 GM-chosen complication typed in and logged, or a Tier1 miss that marks Potential). Venture
  Forth's 10+ result names "+1 Ongoing to future rolls on this Journey" — this app has never tracked
  a cross-roll bonus (the same "Forward" gap Clocks' own losing-side spend menu already left
  freeform in slice 6), so that stays an informational note rather than new tracked state.
  Self-contained to the acting player's own sheet; no Party/Clock plumbing needed, since nothing
  either phase names is a shared resource this app tracks beyond Rapport-as-Aid, already covered by
  Advancement's existing Aid controls.
- **Enjoy Downtime** (`EnjoyDowntimeModal.tsx`): all seven named activities are real —
  Rest (spend 1 Wealth, clear every Status), Recover (clear every Condition, no cost), Carouse
  (spend 1 Treasure, routes through the existing Bond-propose handshake rather than marking Bond
  directly — Carouse doesn't bypass the handshake any more than Hold-spent Bond marks do),
  Acquire (spend a chosen amount of Wealth, logged with a freeform note), Train (spend 1 Wealth,
  mark Potential on a chosen Motif), Pivot (edit either a personal Motif's Quest or the Party Goal
  — the doc's "change your personal Drive/Want, or as a party change the Party Goal" read as the
  same two targets Camp Actions' own Party-Goal/Quest options already model, so Pivot reuses them
  rather than inventing a third field), and Advance (report a tier, tick 3/2/1 segments on a chosen
  Clock via `tickClock()` — a repo-owner call to wire this to the real Clocks subsystem rather than
  leave it a freeform logged note, since Clocks aren't ownership-gated and `tickClock()` already
  does exactly what "progress a project" needs).

**Keep Watch, Undertake a Journey, and Enjoy Downtime as described in the three bullets above are
V0.5-era history — see "Architecture: Moves and Camp content (V0.6 slice 4)" above for what each
ships now.** In outline: Keep Watch's GM 6- marks party Rapport instead of Potential and the
volunteer's roll is fixed to +Wit; the modal itself is renamed `SetOutModal.tsx` and the Move
"Set Out" (Loadout already led, unchanged); Enjoy Downtime's Rest recuperates without taking Strain
instead of wiping every Status, Carouse spends Wealth instead of Treasure, and Pivot's personal
branch resets a Motif's Act Break/Forsake tracking rather than only overwriting the Quest text.

**Bundle budget**: `PartyPlaybookPanel` is always-rendered sheet content (like `AdvancementPanel`),
but is still lazy-loaded with no render condition at all — `CombatPanel`'s existing "GM's view
always renders the lazy panel" shape, applied here because the bundle-budget check
(`apps/web/scripts/bundle-budget.mjs`) excludes any `React.lazy()` chunk from its first-load
measurement regardless of whether it's conditionally rendered. The four guided-flow modals and the
shared `PartyAdvanceModal`/`AddCampAssetModal` are lazy for the more usual reason (rarely opened).
Even after lazy-loading everything deferrable, this slice's real, necessary new sheet content
(`PartyPlaybookPanel`'s always-visible fields) raised the measured first-load gzip from 207.13 kB
to 208.74 kB — over the 208 kB cap slice 6 left under 1 kB of headroom under. Per that check's own
documented policy ("raise it deliberately, with a new measurement recorded, if a legitimate
first-load dependency is ever added"), the budget moved to 220 kB (208.74 kB × 1.05, the same
headroom formula every prior raise used) rather than treating this as a regression to chase down.

**On the naming correction itself**: this section, and every other living doc (`README.md`,
future `WorkPlan-V0.5.md` references), stop calling this feature "Party Playbook" now that
Playbooks are confirmed cut from the game entirely — "Party Identity & Camp" is used instead.
`CHANGELOG.md`'s `0.34.0` entry and `HANDOFF.md`'s forty-sixth-session note keep their original
"Party Playbook & Camp" wording as shipped history, the same way this project never edits a past
`CHANGELOG.md` entry to fix a since-superseded claim (see `README.md` item 7's identical treatment
of the pre-V0.5 "14,000+ line working design doc" citations). The source itself
(`PartyPlaybookPanel.tsx`, `PANEL_IDS`'s `'party'` collapse key, `#p-party`) was not renamed in this
pass — purely a naming/prose correction, not a code change, and renaming a just-shipped file for a
wording fix alone wasn't judged worth the diff noise; revisit if a future slice touches this file
anyway.
