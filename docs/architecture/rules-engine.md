# The rules engine — rolls, Strain and Statuses

Modifier transparency rather than dice simulation: what the engine computes, what it refuses to compute, and the V0.6 harm model (Strain, severity Statuses, Boons/Banes, the Healing Track) that replaced ranked Status tracks.

_Part of `docs/architecture/`. Index: [`docs/architecture/README.md`](README.md). The invariants a session must not violate stay in `CLAUDE.md`; this file is the detail behind them._

---

## Architecture: the rules engine — modifier transparency, not dice simulation

> **V0.6 slice 1 (`0.42.0`) replaced everything below about Statuses, Recoveries, and Subdued —
> see "Architecture: Strain & Statuses (V0.6 slice 1)" right after this section for what ships
> now.** `CharacterStatus.Marks`/`Polarity`, `giveStatus()`/`healStatus()`/`applyOpposingStatus()`/
> `sortStatuses()`, `CharacterSheet.Recoveries`/`spendRecovery()`, and the three-way Subdued modal
> are all retired; `statusRank()`/`markRank()`/`reduceRank()` survive, now serving the Strain track
> and Combat's own Enemy Strain tracks instead of a ranked Status row. Left in place below as
> history — it explains why the app looks the way it does and documents the V0.5 reconciliation
> decisions (Crumble/Dishonored, `README.md` items 12-13) that are unaffected by the harm-model
> change — but don't write new code against `Marks`/`Polarity`/`Recoveries`/`giveStatus` described
> here; they no longer exist.

`packages/shared/src/engine.ts` (added `0.13.0`) is the start of the actual game engine: dice-roll
modifier breakdowns and mechanical-effect application for Moves, Statuses, and Conditions.
**This app never rolls dice for the player, by explicit product decision** (confirmed directly
with the repo owner, not assumed) — `computeRollBreakdown()` returns 2d6 + Virtue's `Total`, itemized
in `Sources` (base score, Condition penalty),
so the player knows what to roll and why. **As of `0.20.0`, the highest helpful/hindering Status is
deliberately *not* folded into `Total`** — it's returned separately as `StatusSources`. An earlier
version summed it into `Total`, which read as if a Status swing *were* the named Virtue's own
modifier (a real repo-owner-reported bug, not a style preference — "Roll 2d6 + Heart: +5" implied
Heart itself was +5 when it was actually +1, with the rest coming from a Status). UI call sites
render `Sources` as the headline total and `StatusSources` as a clearly separate "also affecting
this roll" list — see `MoveRollHelper.tsx`/`CombatMoveModal.tsx`. The Ability effect layer that
used to feed `Sources`/`conditionalRollBonuses` was removed in `0.29.0` with the Abilities catalog
itself — V0.5 has no Abilities. Once a roll happens at the table and the player reports which tier they hit (or, for a
formula like Healing a Status's "1d6 + Mettle," the d6 they rolled), the engine applies the
resulting mechanical change — that's the actual "engine" part. Don't add real randomness
(`Math.random()`, a dice library, anything non-deterministic) to this module or its callers
without checking this decision with the repo owner first; it's a settled call, not an oversight.

**The Condition-penalty formula already matches V0.5's rule, unchanged.** `effectiveVirtueScore()`
(`packages/shared/src/logic.ts:28`) applies `Condition.RollPenalty: -2` against the Virtue a
Condition is marked on and floors the running total at `GameSettings.ConditionFloor: -3` — that's
V0.5's own Condition rule ("-2 on that Virtue, floored at -3 total") verbatim. Worth calling out
explicitly since most of what follows in this section needs real migration work: this one piece
doesn't.

Statuses are the game's damage/HP system, not a separate stat — a Negative Status reaching
`GameSettings.StatusMaxRank` (default 6) triggers **Subdued** (`StatusesPanel.tsx`'s
`SubduedModal`) instead of just sitting at "Rank 6": the player chooses Take a Scar, Risk Death
(`resolveRiskDeath()`), or Blaze of Glory. `giveStatus()`/`healStatus()`/`applyOpposingStatus()`
are the three ways a `CharacterStatus[]` array changes; all are pure functions over the array, not
tied to `commit()` — see `StatusesPanel.tsx` for how they're wired into a sheet mutation.
`CharacterSheet.Recoveries` (refills to `GameSettings.RecoveriesMax` at Make Camp) is spent
1-for-1 to heal a Status; `CharacterSheet.Scars` is free-text, populated only through the Subdued
flow. See `../decisions.md` items 12-13 for the reconciliation
decisions behind this (the doc's "Crumble" mechanic folded into the already-shipped "Dishonored,"
which Combat draft is canonical for whenever Combat gets its own slice) and `HANDOFF.md` for the
list of design questions the doc leaves unresolved that this slice deliberately didn't guess at.

**A Status is a row of marked boxes as of `0.28.0`, not an integer.** `CharacterStatus.Marks:
boolean[]` replaced `Rank: number`, and three primitives in `engine.ts` are the only code that
knows how a row works: `statusRank()` (the **highest marked box**, never a count — the row is
deliberately sparse, so `[_,X,_,X,_,_]` is Rank 4), `markRank()` (V0.5's actual rule: mark box N,
*or the next empty box to its right* if N is taken), and `reduceRank()` (clears from the highest
box down). Everything Status-shaped routes through them.

Two consequences worth internalising, because both differ from the old arithmetic in ways that
look like bugs if you don't expect them. **Giving is no longer additive**: Rank 2 twice is Rank 3
(boxes 2 and 3), not Rank 4. And **reducing clears marks, not Ranks**: a Status held as a lone
mark on box 2 is *removed* by a reduction of 1, rather than dropping to Rank 1. Both are pinned by
name in `engine.test.ts`.

**Crumble replaced Dishonored, and became an event rather than derived state.** This is the part
most likely to be got wrong by analogy with the old code. `isDishonored()` was a predicate — all
five Conditions marked — and the badge was the whole feature. Under V0.5 having all five marked is
a *legal state*; the consequence fires on the **next attempted mark**, and its effect is to leave
the scene and **clear one Condition**, which no boolean can express. So `markCondition()`
(`logic.ts`) is now the single funnel for every Condition mark and the only thing that decides a
Crumble; `allConditionsMarked()` is what's left of the old predicate, and drives a badge that says
what happens next rather than naming a state. `applyCrumbleVulnerable()` (`combat.ts`) grants the
Vulnerable 4 when a Crumble happens inside an Encounter, and no longer needs the before-state flag
its predecessor took, because there is no transition to detect.

**Crumble fires from three places, and the manual one is deliberate**: automatically wherever code
marks a Condition and finds all five marked (a Gambit's cost in `EncounterView.tsx`, and the
Recoveries rule below), plus an explicit "I Crumble" control in `VirtuesPanel.tsx` for a Crumble
the fiction demands. The app can only see the Conditions it marks itself, so without that control
a table-called Crumble would have no way in.

**`Unstable` is derived, never stored.** V0.5 gives a Hero Unstable at Rank 4 of any Status and an
enemy at half one of its Limits; `isUnstable()`/`isEnemyUnstable()` compute it. The old stored
`CombatParticipant.Unstable` field was deleted — it was written once as `false` by
`newParticipant()` and never set by anything, so its badge was unreachable and a stored flag could
only ever drift from the Statuses that determine it.

**Spending the last Recovery gives the Exhausted Condition, and that can itself Crumble you.**
`spendRecovery()` (`logic.ts`) is the single spend path for both sites (the sheet's heal flow and
Combat's Recuperate); it returns `{ Exhausted, Crumbled }` because the three-step cascade — last
Recovery → Exhausted → nothing left to mark → Crumble — is real and easy to miss. Note the related
`normalizeSheet()` change: a missing `Recoveries` now backfills to `RecoveriesMax` rather than 0,
because backfilling an empty pool would silently inflict Exhausted on an old sheet the moment it
was read.

## Architecture: Strain & Statuses (V0.6 slice 1, `0.42.0`)

**Statuses stop being ranked tracks.** `CharacterSheet` gains `Strain: boolean[5]` (a short-term
box row, same sparse-marking rule as the old Status row — see `markRank()`/`statusRank()`/
`reduceRank()` in `engine.ts`, all three kept unchanged and now serving Strain instead) and
`HealingTrack: number` (a genuine cumulative clock, 0..`GameSettings.HealingTrackLength`).
`CharacterStatus` is re-typed from `{ Marks: boolean[], Polarity }` to `{ Severity: 'Minor' |
'Major' | 'Severe', Name, Description }` — a named lasting injury in one of three severity slots
(`GameSettings.MinorStatusSlots`/`MajorStatusSlots`/`SevereStatusSlots`, seeded 3/2/1), not a rank.
`Boons: string[]`/`Banes: string[]` are new, freeform situational-tag lists. `CharacterSheet.
Recoveries` and `GameSettings.RecoveriesMax`/`StatusMaxRank` are retired outright (the latter
renamed `StrainTrackLength`).

**New engine primitives (`engine.ts`), replacing the retired ranked-Status functions**:
`markStrain()`/`strainExhausted()` (Strain-specific wrappers over `markRank()`), `statusAbsorb()`
(2/4/6 by severity — how much incoming Strain taking a Status of that severity negates),
`statusPenalty()` (`-1` / `Disadvantage` / `roll 1d6 instead of 2d6` — the roll penalty a Status of
that severity carries, picked by `highestSeverityStatus()`; V0.6: penalties never stack, only the
highest-severity applicable Status counts), `takeStatus()` (the shared "gain a new Status" write
path), `downgradeStatuses()` (Healing-Track-full: every held Status drops one severity, checked
against *starting* slot occupancy so two Statuses can't double-book one freed slot in the same
pass — see its own doc comment), `advanceHealingTrack()`, and `isSubdued()` (derived, not stored —
true only when the Strain track is entirely full *and* every severity slot is full, so no future
incoming Strain at any amount could find a home; V0.6 leaves Subdued's *consequence* undefined, so
this is a badge the table narrates around, not a modal that fires). `isUnstable()` is redefined:
true while holding any Major or Severe Status, not "Rank 4 of any Status" — `UNSTABLE_AT_RANK` is
gone. `computeRollBreakdown()`'s old `StatusSources` (the highest helpful/hindering Status, a
concept slice 1 retires along with Positive/Negative Statuses) becomes `StatusPenalty: { Status,
Penalty } | null` — informational only this slice, not folded into `Total` (Major/Severe change
the shape of the roll, not a number to add); Slice 2 is where this becomes a real roll builder
alongside Skill/Flaw Tags and Boons/Banes, per `WorkPlan-V0.6.md`.

**`StatusesPanel.tsx` is rebuilt — the single biggest UI change in the migration.** Three polarity
groups (Positive/Neutral/Negative, each an unbounded list of ranked rows) become three severity
groups (Minor/Major/Severe, each a bounded number of slot cards — an empty slot shows a "+ Add"
affordance, opening straight into the new Status's own name editor via `InlineEdit`'s
`startEditing`, same one-tap convention `TagList` already established). The resource row loses
Recoveries; a new "Strain" row reuses `StatusBoxes` (repurposed — its sparse box-row geometry
already *is* the Strain track's shape) and a new "Healing Track" row uses `Pips` (a genuine
cumulative clock, the same primitive Potential/Rapport/Bond use — `StatusBoxes` was deliberately
NOT reused here, since Healing Track fills left-to-right rather than sparsely). Boons and Banes
are two `TagList`s, the same primitive Looks/Skill Tags/Flaw Tags already use — no new tag-editing
code needed. `GiveStatusModal`/`HealStatusModal` become `TakeStrainModal`/`RecuperateModal`;
`SubduedModal` is deleted outright (the old three-way Scar/Risk Death/Blaze of Glory choice
retires from the trigger path entirely, per the locked repo-owner decision in
`WorkPlan-V0.6.md` — V0.6 deletes the whole "Limits, Scars, & Death" section). `CrumbleModal`
needed no change (it never touched Statuses); `CharacterSheet.Scars[]` survives as a field with no
current writer, kept so nothing already written is lost and a future Last Stand rule has somewhere
to land.

**`TakeStrainModal`** records incoming Strain (a GM-told amount) and how it was Resisted — roll +
Virtue (reducing the amount), or take a Status instead (absorbing a flat `statusAbsorb()` amount,
severity limited to slots with room), or neither — with whatever's left marked onto the Strain
track. **`RecuperateModal`** replaces spending a Recovery: take 2 Strain to remove one Minor
Status, then report which tier a `+Mettle` roll hit to advance the Healing Track 3/2/1; filling it
runs `downgradeStatuses()` and carries remaining segments onto the fresh track, per V0.6's own
Recuperate text.

**Make Camp's mechanic changed to match V0.6's own new text** ("clear one Condition, Recuperate,
refresh all Armor" — replacing "2d6 Negative / 1d6 Positive Status Ranks, 1d6 Conditions").
`StatusesPanel.tsx`'s `makeCamp()` now only refreshes Armor and lifts the Load lock automatically,
then clears the single Condition `MakeCampModal.tsx` lets the player pick (no more d6-reported
count) — Recuperate stays a separate, always-available self-serve action rather than forced inline,
the same "reminder, not automated" shape `CampActionsModal`'s own Advancement note already uses.
This one mechanic was pulled forward from slice 4's "Moves and Camp content" scope only because
`StatusesPanel.tsx`'s own Make Camp button directly manipulated the now-retired `Recoveries`/
ranked-`Statuses` fields and had to be rewritten regardless; the rest of Make Camp's Move text
(the GM's Countdown-advance prompt, Camp Actions' tag-rewrite option) is untouched, still slice 4's.

**Armor's meaning changed from Status-negation to Strain-negation** — same controls
(`ArmorSection.tsx`), same refresh-at-Camp behaviour, just what marking a box negates.

**Combat was adapted to compile and keep working against the new harm model — not fully
rebuilt.** `WorkPlan-V0.6.md` Section B1's mapping table is the specification slice 3 (`0.44.0`,
"Combat on Strain") will build out in full (surprise, a 2d6 initiative *mechanic* — the roll
itself already existed via `firstToActFromInitiative()` — Potential on Combat Goal achievement,
richer Boss content); slice 1 only applies the primitive-level parts of that same table, because
`CharacterStatus`'s retype broke Combat's compilation regardless of which slice was supposed to
touch it next. What actually shipped here:
- **`EnemyStrainMark`** (`types.ts`) — an Enemy's own named Strain track, `{ Id, Name, Marks:
  boolean[] }`. B1: "Enemies keep a counting track — they have no severity slots." Structurally
  identical to the old per-Enemy ranked-Status row, just without `Polarity` (every track an Enemy
  holds is by construction something inflicted on it) — `CombatParticipant.Statuses` keeps its
  field name, now typed `EnemyStrainMark[]`. `combat.ts`'s new `markEnemyStrain()` is the
  Enemy-side `markStrain()`. `isEnemyDefeated()`/`isEnemyUnstable()` needed no change at all —
  they were always structurally typed over `{ Name, Marks }`, never over `CharacterStatus` itself.
- **`PendingStrainOffer`** (renamed from `PendingStatusOffer`) drops `StatusName`/`Polarity`/`Rank`
  for a plain `Amount` — an attack no longer names a Status at all, only the target's own choice to
  take one (with their own wording) ever does. `EncounterView.tsx`'s "Incoming" section now offers
  three resolutions per B1: apply the Amount directly, Resist first (roll + Virtue), or take a
  Status instead — the same three-way choice `TakeStrainModal` gives the sheet, inlined for Combat.
- **`CombatMoveModal.tsx`**: Engage in Melee/Ranged now deals a flat Strain `amount` (B1: "Apply
  Status N" → "Deal N Strain") rather than a named+ranked Status. Against an Enemy target it also
  asks *which* of the target's own Strain tracks (`EnemyStatusLimit.StatusName`) the amount marks —
  still necessary since an Enemy can hold several independent tracks and `isEnemyDefeated()` keys
  off the track name. The old "Cover" picker (a target's own Positive Statuses, no longer a
  concept) became a plain checkbox note — B1: Cover is now "a Boon on the target, giving the
  attacker Disadvantage," which is a real dice-mechanic change with nothing to auto-apply (this app
  doesn't roll dice) — full Boon/Bane roll integration is slice 2's.
- **Gambits**: `Bolster`/`Press`/`Brace` unchanged in shape (their doc text just says Strain now,
  not Status Rank). `Halt`/`Impede` mark an Enemy target's named Strain track via
  `markEnemyStrain()` (their PC-ally-target branch, unreachable in practice — Gambits only ever
  attach to a PC's Engage roll, which only ever targets the opposing side — logs a "no automated
  way yet" note rather than silently doing nothing, consistent with this app's existing "no
  generalized cross-character Status targeting" limitation). `Calculate`/`Brace` used to grant the
  actor a Rank-1 Positive Status ("Focused"/"Braced"); they now push onto the actor's own `Boons`.
  `Repel` gained a real severity-based push formula for a PC target — `repelPushBandsForStatuses()`
  (Minor 1 / Major 2 / Severe 3 bands, per B1) — alongside the unchanged `repelPushBandsForEnemy()`
  (highest value across an Enemy's own Strain tracks, same as before, just renamed and no longer
  Polarity-filtered).
- **`applyCrumbleVulnerable()` is deleted**, per B1's "Legacy code left stranded" list: V0.6 drops
  the "you gain Vulnerable 4" clause from Crumble in Combat entirely. `EncounterView.tsx`'s Crumble
  banner still tells the player to leave the scene and clear a Condition; it no longer claims a
  Vulnerable grant that no longer happens.
- **`ParticipantCard.tsx`**'s shared shell takes pre-rendered `statusBadges`/a pre-computed
  `unstable` flag from each of its three variants now, rather than interpreting raw Status data
  itself — a Hero's own Statuses (severity slots) and an Enemy's Strain marks (named counting
  tracks) are genuinely different shapes as of this slice, so there's no longer one shared
  rendering rule to hide in the shell.

**Two Adventure Moves (Keep Watch, Undertake a Journey) got the same forced-minimal treatment as
Combat** — their own `giveStatus()` calls (granting "Alert 2"/"Prepared 2"/a named Status) no
longer compile, so they now push the same names onto `Boons` instead, matching B1's own "Statuses
become Boons and Banes (the Alert Boon, the Restless Bane)" wording for Keep Watch. Everything else
about these two Moves' flows (the GM/volunteer roll structure, the options offered, the Rapport-
on-a-miss rule) is untouched — the fuller Move re-authoring A2 describes (Keep Watch's 6- marking
party Rapport instead of everyone's Potential, the Set Out rename, etc.) is slice 4's.

**`normalizeSheet()`/`normalizeLibrary()` extended per the locked plan.** A missing `Strain`
backfills to an empty row, `Statuses` to `[]`, `Boons`/`Banes` to `[]`, and — the one
deliberately-asymmetric default — a missing `HealingTrack` backfills to **0, not full**: the
mirror image of the old `Recoveries` trap, since backfilling a full Healing Track would falsely
downgrade an old sheet's Statuses the next time it advanced. **A legacy ranked-Status entry
(`Marks`/`Polarity`, no `Severity`) is dropped on read, not translated** — `WorkPlan-V0.6.md`
Section B2's "clean break" decision: there is no honest Rank-to-severity mapping, so pre-migration
Status data on any already-saved sheet is silently wiped the next time that sheet is read, the same
"pre-release test data, no migration path" treatment the V0.5 migration's own slice 1 already used
for the equivalent shape change. `normalizeLibrary()` backfills the five renamed/new `GameSettings`
fields (`StrainTrackLength`, `HealingTrackLength`, `Minor`/`Major`/`SevereStatusSlots`) the same way
it already did for `RecoveriesMax`/`StatusMaxRank`. `seedPlay.ts`'s four demo sheets were
hand-authored fresh (a Boon/Bane/Strain-mark/Status mix per character) rather than mechanically
converted, for the same reason.

**Bundle budget**: this slice's real, necessary first-load additions (Strain/Healing Track rows,
Boon/Bane `TagList`s, the rebuilt severity-group layout — all always-visible sheet content, not
lazy modals) measured at 210.41 kB gzip against the 220 kB cap slice 7 of the V0.5 migration left —
about 9.6 kB of headroom remains. Re-check `apps/web/scripts/bundle-budget.mjs` before slice 2 adds
its own always-visible roll-builder content.

**Deliberately not built this slice, real scope for later slices, not oversights**:
- Skill/Flaw Tags becoming mechanical, Push Yourself, and the rest of `computeRollBreakdown()`'s
  real roll-builder rework (Slice 2, `0.43.0`).
- Combat's own deeper rebuild — surprise, the 2d6 initiative *rule* (the roll primitive already
  existed), Potential on Combat Goal achievement, richer Boss content, and a from-scratch
  reconsideration of the whole B1 mapping rather than this slice's forced-minimal application of it
  (Slice 3, `0.44.0`).
- Re-authoring all 22 seeded Moves' `Results` text against V0.6 (Stand Defiant/Follow a Lead/Strike
  a Nerve/etc. still describe ranked Statuses in their prose even though the mechanics underneath
  changed), the Make Camp/Keep Watch/Set Out/Enjoy Downtime/End the Session flow rebuilds A2
  describes, and the glossary sweep (Slice 4, `0.45.0`).
- Any real Enemy-side Boons/Banes representation — B1 doesn't specify one, and this slice didn't
  invent one; Halt/Impede's Enemy-target path stays a Strain-track mark, unchanged from before.

## Architecture: Rolls (V0.6 slice 2, `0.43.0`)

**Skill and Flaw Tags become mechanical, and `MoveRollHelper.tsx` becomes a real roll builder
instead of a static breakdown.** `CharacterMotif.SkillTags`/`FlawTags` (already real fields, unchanged
since slice 2 of the V0.5 migration) were display-only text until this slice — the ruleset's own
"Skill Tags"/"Flaw Tags"/"Push Yourself" chapters name concrete mechanics this app had never
attached to them: a declared Skill Tag is **+1** on the roll; if a second Skill Tag also applies,
**Push Yourself** — mark one Condition, add another **+1**; each applicable Flaw Tag is **−1** *and*
marks Potential on its own Motif, whether the roll hits or misses.

**`computeRollBreakdown()` (`engine.ts`) takes a new, optional fourth parameter, `RollExtras`** —
`{ SkillTag, PushYourselfTag, FlawTags, BoonsSelected, BanesSelected }` — rather than a new
function, since every existing call site (`CombatMoveModal.tsx`'s Engage roll) still wants the same
Virtue/Condition math with no tags at all, and an optional param with an empty-object default keeps
that call compiling and behaving unchanged. `computeRollBreakdown()` stays a **pure display
function**: it folds a `SkillTag`/`PushYourselfTag`/`FlawTags` selection straight into `Sources`/
`Total` (+1 / +1 / −1 each), and returns a new `Advantage: AdvantageState` field
(`'Advantage'|'Disadvantage'|'Normal'`) from `compareBoonsAndBanes(BoonsSelected, BanesSelected)` —
V0.6's own rule, verbatim: more Boons than Banes relevant to the roll is Advantage, more Banes is
Disadvantage, a tie (including 0/0) is Normal. **Marking the Condition a Push Yourself tag costs,
and the Potential a Flaw Tag marks, are the caller's job, not this function's** — the same
"engine computes the breakdown, the UI applies the mutation via `commit()`" split this module has
always used for Hold grants and Wealth spends; `MoveRollHelper.tsx` calls `markCondition()`/
`addMotifPotential()` directly when the player taps Push Yourself or checks a Flaw Tag.

**A Minor Status now folds directly into `Sources`/`Total` as a real `-1`; Major/Severe stay a
separate, non-numeric `StatusPenalty` display, exactly as slice 1 left them.** Slice 1's own
`StatusPenalty` field was deliberately informational-only for every severity, flagged in its own
doc comment as "Slice 2 turns this into a real roll builder." This slice only did that for the
numeric case: `-1` composes cleanly with everything else in `Total` the way Major's "Disadvantage"
and Severe's "roll 1d6 instead of 2d6" cannot — those change the *shape* of the roll, not a value to
add. **This slice deliberately does not invent a rule for how a Status-driven Disadvantage combines
with a Boon/Bane-driven one** (e.g. does a Major Status plus one extra Bane still read as "just
Disadvantage," or something worse a 2d6 game has no term for?) — V0.6 doesn't say, and Section D of
`WorkPlan-V0.6.md` is explicit that this app doesn't guess at questions the ruleset itself leaves
open. Both are shown, clearly separated, and the table resolves how they combine — the same
transparency-not-simulation treatment this app has given every other roll judgment call since
`0.20.0`.

**`Move.AdvantageTrigger` is retired outright — Advantage is now a general Boon/Bane mechanic, not
a per-Move enum with two hardcoded triggers.** The old field only ever covered two Moves (Follow a
Lead's `'wealthSpend'`, Consult the Past's `'selfReport'`), each with its own hand-built UI branch
in `MoveRollHelper.tsx` that forced a fixed "roll 3d6, keep the best two" state. V0.6's own text for
both Moves already reads as the general mechanic: Consult the Past says "if you have access to a
book or similar record of this info, **add a relevant Boon**" and Follow a Lead says "you may spend
1 Wealth to roll with Advantage" — neither needs a dedicated code path once *any* Boon can tip the
comparison. `MoveRollHelper.tsx` now shows one universal Boons/Banes picker (checkboxes over
`sheet.Boons`/`Banes`, "relevant to this roll") on every Move, replacing the two old hardcoded
branches and the informational-only tooltip fallback that used to cover everything else. **This
slice does not rewrite either Move's `Description` text** — both still read close enough to their
old V0.5 wording to make sense under the new mechanic, and re-authoring all 22 seeded Moves' text
against V0.6 is explicitly Slice 4's job (`WorkPlan-V0.6.md` Section C), not this one's.

**Push Yourself's Condition choice is a free pick among all five Virtues, not tied to the rolled
Virtue** — a judgment call, not a guess: V0.6's text just says "mark one Condition" with no stated
connection to which Virtue is being rolled, and this app already treats "which Virtue's Condition"
as a real player choice everywhere else it comes up (`VirtuesPanel.tsx`'s own Condition buttons).
`MoveRollHelper.tsx` reuses the exact `markCondition()`/`CrumbleModal` pattern `VirtuesPanel.tsx`
already established: marking funnels through `markCondition()`, and a Crumble (all five already
marked) opens the same shared modal rather than inventing a second Crumble-handling path.

**Declaring a Skill Tag is capped at two — the one declared, plus one more via Push Yourself — not
unlimited stacking.** V0.6's own text reads as a binary choice ("declare *your* Skill Tag," singular,
then "if more than one... applies, you may Push Yourself," a single named action costing one
Condition), not "mark a Condition per additional tag." Flaw Tags are the opposite on purpose: V0.6
says "**each and any** Flaw Tag that is relevant... will give −1," which reads as automatic
stacking with no cap, so `MoveRollHelper.tsx` lets the player check as many applicable Flaw Tags as
they like, each an irreversible −1-and-mark-Potential action for that roll (matching the "declare
it, can't take it back" shape `spendWealthForAdvantage` used to have, now generalized to every Flaw
Tag row via a one-way `CheckboxRow`).

**Marking Potential from a Flaw Tag does not auto-open the Motif's own advance picker, even when it
fills the track.** `addMotifPotential()` already reports `{ ready: boolean }` for exactly this case,
and `MotifPanel.tsx`'s own `MotifAdvanceModal` is the dedicated UI for choosing what a full Potential
track becomes — wiring `MoveRollHelper.tsx` to reach into that flow mid-roll would mean importing a
second modal into an already reaction-heavy component for a state transition this slice's own scope
doesn't ask for. The track still fills and stays filled; the player advances it from the Motifs
panel afterward, same as if it had filled any other way. (Note also: V0.6 changes *when* a full
Potential/Rapport track advances — "the next time you Make Camp," not immediately — but that timing
change is `WorkPlan-V0.6.md` Section A2's own item, not assigned to this slice; `MotifAdvanceModal`/
`PartyAdvanceModal` still fire immediately, untouched.)

**Bundle budget**: this slice's real, necessary first-load additions (the Skill/Flaw Tag rows, the
Boons/Banes picker — all part of `MoveRollHelper.tsx`, which renders inline in the Moves drawer, not
behind a lazy boundary) measured at 211.80 kB gzip against the 220 kB cap, up about 1.4 kB from
slice 1's 210.41 kB — roughly 8.2 kB of headroom remains.

**Deliberately not built this slice, real scope for later slices, not oversights**:
- `CombatMoveModal.tsx`'s own Engage roll stays exactly as slice 1 left it — no Skill/Flaw Tag or
  Boon/Bane picker there. Cover-as-a-Boon and the rest of Combat's own B1-mapped roll mechanics are
  Slice 3's (`0.44.0`), which rebuilds Combat's roll surface as a whole rather than patching it here.
- Bond's own roll-affecting spend options (+1 to your roll against them, −1 to theirs against you)
  are Slice 7's five-option Bond spend menu (`0.48.0`) — the existing Aid tooltip in
  `MoveRollHelper.tsx` is untouched.
- Re-authoring `Move.Description`/`Results` text against V0.6's wording (Slice 4, `0.45.0`).
