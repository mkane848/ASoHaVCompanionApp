# Combat

Track-and-display, never enforcement. Range as theatre-of-the-mind bands with no rendered grid, per-Status Enemy Limits, Gambits, and the Strain mapping applied across two slices.

_Part of `docs/architecture/`. Index: [`docs/architecture/README.md`](README.md). The invariants a session must not violate stay in `CLAUDE.md`; this file is the detail behind them._

---

## Architecture: Combat on Strain (V0.6 slice 3, `0.44.0`)

**Closes out `WorkPlan-V0.6.md` Section B1's mapping table and the remaining Combat Loop
additions.** Slice 1 already applied B1 at the primitive level (Strain-dealing, `EnemyStrainMark`,
`PendingStrainOffer`) because retyping `CharacterStatus` broke Combat's compilation regardless of
which slice was "supposed" to own it — see "Architecture: Strain & Statuses" in `docs/architecture/rules-engine.md`. This slice
finishes the parts of B1 that didn't need to happen just to compile: Cover as a real Boon/Bane
mechanic, Brace's own numeric effect, and Combat Loop's surprise/Combat-Goal-Potential rules.

**Cover is now a real roll mechanic, not a static reminder.** B1: "A Boon on the target, giving the
attacker Disadvantage." `CombatMoveModal.tsx`'s Engage roll now calls `computeRollBreakdown()` with
real `RollExtras` — the same mechanism Slice 2 built for `MoveRollHelper.tsx`, applied to Combat's
own roll surface for the first time. The Cover checkbox contributes one Bane against the
*attacker's* own roll (matching B1's literal wording — Cover disadvantages the attacker, not the
target); the actor's own sheet Boons/Banes are also selectable as "relevant to this roll," same
picker shape as the sheet's roll builder. `breakdown.Advantage` drives the displayed roll guidance
("roll 3d6, keep the best/worst two") instead of a static InfoTooltip. Deliberately narrower than a
full port of Slice 2's roll builder: no Skill/Flaw Tag picker here — B1 only names Cover, and
Combat's own Skill/Flaw Tag integration wasn't asked for by this slice's scope.

**Brace's mechanical effect was fixed, not just relabeled — a real bug this slice's own research
found, not new scope.** B1: Brace is "−1 Strain from everything until your next turn," a genuinely
different shape from Calculate's "+1 forward." The code inherited from slice 1 mapped *both*
Calculate and Brace onto the same "push a Boon" primitive — reasonable for Calculate (a Boon is
exactly a temporary combat edge), wrong for Brace, which is a numeric damage reduction with a
duration this app has never tracked (the same "Forward"/"Ongoing" gap left freeform everywhere else
— Clocks' losing-side spend menu, Consult the Past's own +1 Ongoing). Silently mapping it to a Boon
would have made Brace *look* wired up while doing something the doc never described (giving
Advantage/Disadvantage instead of reducing incoming Strain). Fixed to match Seize/Other's own
honest treatment: logged only, with the table applying the reduction by hand.

**Surprise (Combat Loop step 4) skips initiative entirely, rather than being folded into it.**
`firstToActFromSurprise()` (`combat.ts`) mirrors `firstToActFromInitiative()`'s shape but needs no
roll: the GM picks which side (if any) was wholly caught off guard, and the *other* side goes
first, no stored field needed (a one-shot action, same as "Roll Initiative" itself — nothing about
"how ActingSide got set" needs to persist). The doc's further "at the GM's discretion" clause (a
head-start round, fewer actions, or Disadvantage for the surprised side) is deliberately not
modeled — open-ended GM narrative discretion, the same class of clause this app leaves to the
table rather than inventing a formula for (Seize/Other Gambits, Boss abilities, Interpose's own
freeform reach). `EncounterView.tsx`'s header carries a "Declare Surprise" control right above
"Roll Initiative," with a one-line note naming that discretion explicitly as a table call.

**Combat Goal achievement now grants real, self-serve Potential — Combat Loop step 3.**
`Encounter.CombatGoalAchieved: boolean` (new field, GM-toggled, mirrors `DefiantGoal.Achieved`'s
shape but Encounter-level since the Combat Goal itself isn't a list entry) drives a banner every PC
player sees once true: pick one of their own Motifs, mark Potential on it. This is self-serve by
necessity, not preference — only a sheet's own owner can write it (`sheet.ts`'s PUT authorization),
the same constraint every other Combat-to-sheet mutation in this app already works around via
`PendingStrainOffer`. `EncounterView.tsx` tracks a local `potentialClaimed` flag per viewer so the
control disappears once used, rather than persisting "who claimed it" on the Encounter — the same
self-report trust model as Aid, Defiant Goal declarations, and everything else a player reports
about their own action. The old "End Combat" confirm text ("everyone should mark Potential... not
automatic") is now backed by an actual control instead of only a reminder.

**"No Potential on a 6- in Combat" is a documented no-op, not built as a suppression rule.** The
doc's full sentence: "Moves in Combat do not award Potential on a 6-... Combat rolls cover smaller
actions than rolls outside Combat, so they occur more often." This is a carve-out from a *general*
"rolls can award Potential on a miss" rule — and this app has no such general rule to carve out of.
The only Potential-on-a-roll mechanic that exists anywhere in this app is Slice 2's Flaw Tags, which
mark Potential unconditionally (win or miss, by the doc's own design) and aren't gated by tier at
all; `CombatMoveModal.tsx`'s Engage roll doesn't touch Motifs or Potential in any way this carve-out
could apply to. Building a suppression mechanism here would mean inventing the very general rule
Section D item 10 ("Any rolls made with a Virtue marked with a Condition award 1 Potential
(optional??)") explicitly flags as still unresolved — exactly the kind of guess this project's own
discipline forbids. Recorded here so a future session doesn't rediscover the same dead end.

**Boss Last Stand and 1d6-Wounded-style attack text get a documented-assumption tooltip, not new
mechanics.** B1's own "left open" note: these numbers are expressed in Ranks in the source text,
read as Strain by this app's mapping, but Ryan's own `!! UPDATE` marker on the Villain template
means this is exactly the area he intends to revisit — "surface it in the UI... rather than bury it
in a constant." `ParticipantCard.tsx`'s `EnemyCard` now shows an `InfoTooltip` next to a Boss's own
badge row explaining this reading. `Villain.Attacks`' own freeform prose ("Fall to my Power! —
...dealing Wounded and Wobbly") is untouched — it was already established as bespoke GM flavor text,
not a formula to extract (`README.md` item 38), and this tooltip doesn't change that.

**`CombatMoveModal.tsx`'s three raw `<input type="checkbox">` elements — Cover, Rolled-12+, and
the two new Boons/Banes pickers — were switched to the shared `CheckboxRow` component, a real bug
this slice's own new interaction-smoke coverage found, not something introduced by it.** A native
checkbox paints at its browser-default size regardless of any wrapping `<label>`'s own
`min-height`; `apps/web/scripts/interaction-smoke.mjs` had no state that ever opened this modal
before this slice added one (`modal: Engage`), so these had never actually been measured — three
13×13px controls, none within the touch-target floor. `CheckboxRow` (`apps/web/src/components/
form/`) already exists for exactly this (a real 44px-tall button, not an overlay) and is what
`MoveRollHelper.tsx`'s own Boons/Banes/Flaw-Tag pickers already use; this file simply hadn't been
brought in line with that convention until this slice touched it. Fixed, `.checkboxRow`'s now-dead
CSS class removed. A second, smaller near-miss surfaced by the same new coverage: once the Boons/
Banes grid used real 44px rows, the InfoTooltip trigger in `.advantageRow` right below it — an
18px circle under a 44px `.tap` overlay, 13px overhang each side — collided by 5px at the old 8px
`margin-top`. Bumped to 24px, the same clearance value `VirtuesPanel.module.css`'s own identical
class of near-miss already settled on; re-verified against the interaction smoke test, not derived
on paper alone.

**Deliberately not built this slice, real scope for later, not oversights**:
- Full Skill/Flaw Tag integration into `CombatMoveModal.tsx`'s roll — B1 only names Cover; giving
  Combat's Engage roll the complete roll-builder parity `MoveRollHelper.tsx` has would be a real,
  separate scope decision, not implied by "Combat on Strain."
- A from-scratch reconsideration of the whole B1 mapping table, versus this slice's application of
  the already-locked version — B1 itself is treated as settled, not reopened here.
- Richer Boss-ability *content* (Grizza's own attacks, etc.) — still freeform GM prose, unchanged.

## Architecture: Combat — track-and-display, per-Status Enemy Limits, no grid

The live Encounter view was originally built against a "Combat Basics V2.2" draft (the most recent
of three competing drafts) cited from the 14,000+-line working design doc `README.md` item 12
describes — a doc that "Architecture: the ruleset and where it lives" in `docs/history/ruleset-migrations.md` establishes was never
actually committed to this repository. **`Planning Docs/Ruleset-V0.6.md` is now the authoritative
source for Combat rules — with one large caveat: its Combat Basics chapter is byte-identical to
V0.5's.** It was never rewritten for Strain, so it still deals ranked Statuses ("Apply *Status 5*"),
still spends Recoveries, and still defines Unstable at Rank 4, none of which is compatible with
V0.6's own Strain chapter. Per a repo-owner decision the app reconciles this itself rather than
running two harm systems; the mapping is fixed once in `WorkPlan-V0.6.md` Section B1 and written up
as `README.md` item 43. **Slice 1 (`0.42.0`) and slice 3 (`0.44.0`) apply that mapping** — see
"Architecture: Strain & Statuses (V0.6 slice 1)" in `docs/architecture/rules-engine.md` and "Architecture: Combat on Strain (V0.6 slice 3)"
above for exactly what each changed; this section otherwise still describes the shipped V0.5
behaviour underneath it. **`Ruleset-V0.5.md` was the authoritative source for Combat rules**, adopted as that missing document's successor; the Combat migration
itself, `WorkPlan-V0.5.md` slice 5 ("Combat update"), **shipped in `0.32.0`** — see "Architecture:
the Combat update (slice 5)" below for what it actually built, and the four repo-owner decisions
(`README.md` items 31-34) that scoped it. Everything in this section not called out there as slice
5 work still reflects the original, unverifiable V2.2-draft-derived design, now additionally
confirmed consistent with V0.5 wherever the two overlap. Confirmed with the repo owner before any
of this was built: **track-and-display, not enforcement** — the app shows whose turn it is, AP
remaining, Range, and Statuses live to everyone, but never blocks an action; the GM can always
override. `Encounter`/`CombatParticipant` (`packages/shared/src/types.ts`) are new
play-state, backed by a `combat_encounters` table (migration `0010`, same joinless-RLS-policy
shape as `party`/`bonds`/`character_sheets` — see the Realtime section above) — the first new
table since the campaign-setup work, everything before this was JSONB-field additions.

**Combat is no longer its own screen, as of `0.23.0`.** Repo-owner testing feedback was that
leaving Combat behind a separate `/combat` link cost a click and a full page transition mid-fight,
when the rest of a session lives on the Campaign Shell page. `CombatPanel.tsx`
(`apps/web/src/features/combat/`) holds the actual Encounter view — start-form, `EncounterView`,
all the modals — extracted from what used to be `CombatPage.tsx`'s entire body. `CampaignPage.tsx`
now renders `CombatPanel` inline in **both** `GmView` and `PlayerView` (players are the ones who
apply Status offers and Interpose, so a GM-only section would strand them — confirmed with the
repo owner rather than assumed), imported via `React.lazy` from both call sites to preserve the
`0.19.0` code-split: eagerly importing `EncounterView` and its modals from `CampaignPage`, which
every player loads, would have undone that bundle win. The GM's view always renders the lazy
panel, since a GM always needs the start-Encounter form regardless of whether one is running; a
player's view only triggers the lazy import once `boot.encounter` is non-null, otherwise a plain
`<p>No Combat right now.</p>` with no import at all. `CombatPage.tsx` still exists at
`/c/:campaignId/combat` — now a thin wrapper around the same lazy `CombatPanel` — kept alive
deliberately as a working deep link, not left over by accident.

**Range is theater-of-the-mind bands** (`CombatRange`: Melee/Close/Far/VeryFar/OutOfRange), not a
rendered grid — a real map is out of scope for this app (confirmed with the repo owner), not an
oversight. The doc's Maneuver ("up to 6 squares")/Shift ("up to 2 squares") distinction doesn't
translate cleanly to bands; `shiftRange()` in `packages/shared/src/combat.ts` is a deliberate
simplification (documented there, not silently invented) and the UI only exposes one generic
1-band-per-AP reposition control, not separate Maneuver/Shift buttons — revisit if that split
turns out to matter in play.

**V0.5 turns this from an unresolved reading into a confirmed standing deviation.** The old
"up to N squares" phrasing above came from the same doc "Architecture: the ruleset and where it
lives" in `docs/history/ruleset-migrations.md` establishes was never actually in this repo; V0.5, by contrast, states an explicit grid —
squares or hexes, Melee = Range 1, Engage at Range = Range 10, Maneuver 6 spaces, Shift 2, enemies
move 6 spaces, Repel pushes a stated number of spaces. Given that explicit spec, the repo owner
re-affirmed keeping the 5-band ladder anyway rather than building real grid/hex geometry — the
grid stays a tabletop-only concept, and V0.5's space counts are mapped onto the existing bands
instead (`../decisions.md` item 15 stands unchanged). The collapsed
single Reposition control above is the same call continued, not something V0.5 reopens. That
space-to-band mapping is now worked out explicitly, as of slice 5 (`0.32.0`): see `shiftRange()`'s
doc comment in `packages/shared/src/combat.ts` for the actual ratio derived from V0.5's numbers —
this didn't change the band model itself, only documented the conversion the existing constants
already approximated.

**PCs keep one source of truth for their own Statuses: their own `CharacterSheet`.**
`CombatParticipant.Statuses`/`Toughness`/`StatusLimits` are Enemy-only fields — a PC participant
is a thin pointer (`RefId` = `CharacterId`) at data that already lives on their sheet. This
collides with the sheet's existing owner-only write rule (`sheet.ts`'s PUT: only
`membership.CharacterId === characterId` may save it — not even the GM), which matters a lot in
Combat: an Enemy's attack can't write a Status directly onto the PC it's hitting. The fix is
`Encounter.PendingStatusOffers` — anyone can create one (it's just an Encounter field), but only
the target's own player can fulfill it, from their own participant card, optionally Resisting
first (`resistRollReduction()`, same formula as everywhere else) before it lands on their sheet
via `useCommitSheet`. Don't try to have the GM write a PC's Statuses directly if you extend this;
route it through a `PendingStatusOffer` instead.

**Enemies are defeated per-Status, not by one shared pool**: `isEnemyDefeated()` checks each of an
Enemy's `StatusLimits` independently — reaching *any one* Limit (e.g. `Hurt 4`) defeats it, even if
every other tracked Status is still low. `Toughness` (`applyToughness()`) blunts what an Enemy
takes: Medium is a flat −2 to the incoming Rank (floored at 1), Heavy re-derives the Rank as if
the roll had landed one tier lower — both per the doc's own wording.

**Enemy authoring is ad-hoc-first with an optional save to a reusable library** (confirmed with
the repo owner over the "ad-hoc only" vs "full library" fork): `AddParticipantModal.tsx` lets a
GM spawn an Enemy purely ad-hoc (nothing persists) or from `library.enemies`
(`EnemyTemplate`, real Content Admin CRUD, generic schema-driven like every other collection) —
and an ad-hoc one can be checked to save itself to the library on the way in, so the GM never has
to author monsters in a separate screen mid-session if they don't want to.

**Gambits (`0.15.0`) attach to an Engage roll, PC actor only** — their cost is marking a
Condition, which only PCs have, so the `CombatMoveModal`'s Gambit picker only appears when
`actorSheet` is non-null (i.e. the viewer is the acting PC; an Enemy's Engage never offers them).
`gambitConditionCost()` (`packages/shared/src/combat.ts`) encodes the doc's cost rule: 1 Condition
per Gambit on a 10+ (the first free if the roll was exactly 12+, reported via a checkbox — this
app doesn't simulate dice, see the engine note above), one Gambit only on a 7-9, costing 2
Conditions. Of the nine Gambits (`GAMBITS`), **seven reduce cleanly to the existing Status/Range
primitives and are fully automated** (Bolster: +1 to the Rank the roll already gives; Press: shift
2 Range bands free; Halt/Impede: a second Rank-2 hindering Status on the target; Calculate/Brace:
a Rank-1 helpful Status — Focused/Braced — on the actor, which then naturally shows up as the
"highest helpful Status" in future roll breakdowns, no separate buff-tracking system needed; and,
as of slice 5 (`0.32.0`), **Repel**: `repelPushBands()` pushes the target back a number of Range
bands equal to its highest Negative Status Rank, optionally reduced by a target Mettle typed into
the Gambit row if they Resist — see "Architecture: the Combat update (slice 5)" below for why this
reverses the original `0.15.0` decision rather than being new scope). **Seize and Other are still
logged to `Encounter.History` only** — their effects ("take something," anything freeform) stay
genuinely open-ended in the doc, not something to invent a formula for; see `EncounterView.tsx`'s
`applyGambits()` before changing this.

**Dishonored's Combat effect (Vulnerable 4) is real as of `0.17.0`**, not the "once it's built"
placeholder its own glossary text promised for four versions. `applyDishonoredVulnerable()`
(`packages/shared/src/combat.ts`) grants a flat Rank-4 negative "Vulnerable" Status the moment a
PC's Condition mark inside `EncounterView.tsx`'s `applyGambits()` — the only place Combat currently
marks a Condition — pushes them into Dishonored (all five Conditions marked), reusing `giveStatus()`
rather than a new mechanic, same pattern as Calculate/Brace. It only fires once, at the
false-to-true transition, so it doesn't re-stack on every later Gambit paid for while already
Dishonored. **Deliberately scoped narrower than "whenever a PC is Dishonored in Combat," and
flagged here as a judgment call worth revisiting, not a settled edge case**: a PC who enters an
Encounter already Dishonored, or who becomes Dishonored some other way while an Encounter is merely
open in the background, does not get this applied retroactively — there's currently no other
in-Combat path that marks a Condition to hook into. Revisit this scoping if a wider set of
in-Combat Condition-marking triggers gets built later (e.g. a Combat Move that costs a Condition
outside the Gambit system).

**All seven Reaction Moves are now wired up.** Five shipped in `0.16.0`, the last two with a shared
theme: neither needed a new mechanic, just reuse of existing ones off-turn. **Opportunity Attack** is literally
`CombatMoveModal`'s Engage-in-Melee flow (roll breakdown, tier, even Gambits) triggered from a
standalone "Reactions" button rather than from the acting participant's own card, with a `free`
flag on the `engaging` state that skips the AP deduction both `applyToEnemy`/`offerToPC` normally
do. It's manually triggered, not auto-detected — this app already collapsed Maneuver/Shift into
one generic Reposition (no distinct "which move did the enemy use to leave" signal to react to),
so whether the fictional trigger happened is a table judgment call, same as everywhere else in
Combat. **Interpose** redirects an existing `PendingStatusOffer` to the interposer instead of
creating a new one — sets `Resistable: false` (the doc is explicit interposing can't be Resisted)
and does a real Range swap between the two participants ("swap into their space"). Both are
PC-only, same reasoning as Gambits: their trigger conditions (an ally in `PendingStatusOffers`, an
Enemy at Melee range) only make sense from a PC's-eye view of the fight.

**Help and Resist are the other two, and one of them was already built before slice 5 started.**
Help (spend 1 Rapport for +1 on another Hero's roll, even after it's rolled) shipped in `0.18.0` as
part of Rapport-as-Aid — `EncounterView.tsx`'s `help()` — and already matched V0.5's wording almost
verbatim; the CLAUDE.md text once claiming it as "not built" was simply never corrected once V0.5
made it official, found only when slice 5's pre-code Explore pass re-verified every claim against
the actual shipped code (`README.md` item 34). **Resist** (reduce forced-movement distance by up to
your Mettle) was the one genuinely unbuilt Reaction Move, and shipped in slice 5 (`0.32.0`) as a
self-reported, manually-triggered action — same pattern as Opportunity Attack, not a new persisted
offer type, since `resistForcedMovementBands()` just needs a "how many bands were you pushed"
number and the resister's own Mettle. See "Architecture: the Combat update (slice 5)" below and
`README.md` item 31 for why a persisted async pending-push type (mirroring `PendingStatusOffer`)
was considered and deliberately not built — Range isn't ownership-gated the way Statuses are, so
there was no correctness reason to add one.

**Armor already costs 1 AP in Combat, and always has since `0.16.0`.** `EncounterView.tsx`'s
`defend()` deducts `ActionPointsRemaining` when Armor is marked Used mid-fight — the CLAUDE.md text
that used to claim this was "not built" was describing `ArmorSection.tsx`'s separate sheet-side
toggle (used *outside* Combat, with no AP cost, since there's no AP outside an Encounter), not this
route. Same class of stale-doc gap as Help above, corrected in the same slice-5 pass.

## Architecture: the Combat update (slice 5, `0.32.0`)

**Per-unit turn order replaces the single `ActingSide` toggle, as a GM-overridable suggestion, not
an enforced algorithm** — consistent with Combat's whole track-and-display design. `Encounter`
gained `ActingParticipantId` (whose turn it is) and `PairedParticipantId` (for "two Heroes act
together as one pick"); `endTurn()` (`packages/shared/src/combat.ts`) recharges AP and sets
`HasActedThisRound` only for the acting participant (and partner, if paired) — the actual "AP
recharges at the end of that Hero's own turn" rule, replacing the all-at-once reset
`startNewRound()` used to also do. `startNewRound()` now only clears everyone's acted flag at a
round boundary. `nextActor()` suggests which *side* goes next under V0.5's alternating-with-
leftovers-act-consecutively rule; which specific unit on that side goes is left to the table, same
as the doc's own wording ("Heroes should choose the order each round that best fits their current
strategy") — `EncounterView.tsx`'s header exposes two selects (current actor, paired-with) the GM
can set to anyone, at any time, regardless of what `nextActor()` suggested. See `README.md` item 31
for why this shape was confirmed with the repo owner before building, rather than assumed from
WorkPlan's own paraphrase.

**Cover (V0.5, superseded by V0.6 slice 3 — see "Architecture: Combat on Strain" above for the
shipped mechanic)**: originally, `CombatMoveModal.tsx` accepted the target's own Statuses and
offered a "Target's Cover" picker — any of the target's Positive Statuses, or None — whose Rank
subtracted from both the displayed and applied roll total, the same transparency pattern
`StatusSources` used for the actor's own Statuses. Positive Statuses no longer exist (V0.6 slice 1
retired the whole ranked-Status model); Cover is now a Boon-driven Disadvantage on the *attacker's*
roll instead. Left here as history rather than deleted — deliberately not a hardcoded match against
"Cover"/"Hidden"/"Invisible" was, and still is, the right call either way: V0.5's own examples were
illustrative, not exhaustive, and every Status/Boon/Bane in this app has always been author-defined
free text — see `README.md` item 32.

**Boss Enemies get minimal wiring, not a full mechanism** (`README.md` item 31): `CombatParticipant.
IsBoss`/`GambitCharges` (also on `EnemyTemplate`, both flowing through `newParticipant()` and
Content Admin's `enemies` schema) give a Boss its own numbered Gambit-charge pool — a plain stepper
on `EnemyCard`, not simulated Gambit content. Reaching a Status Limit no longer auto-sets `Defeated`
for a Boss the way it does an ordinary enemy (`!t.IsBoss` guards in `EncounterView.tsx`'s
`applyToEnemy`/`applyGambits`); instead a derived "Last Stand" badge appears (reusing the existing
`isEnemyDefeated` check — no new stored flag, same principle as `isUnstable`/`isEnemyUnstable`
already being derived rather than stored), and the GM marks the Boss defeated manually once the
fiction says so. A "Boss Acts" button pair (Melee/Ranged, `free: true`, no AP cost — same flag
Opportunity Attack uses) reminds the GM a Boss gets an action after every Hero's turn; it's a
reminder and a trigger for the *existing* Engage flow, not a new action type. The Boss abilities
themselves (Grizza's "Fall to my Power!", "Fearsome Yell," and similar) stay freeform GM content —
the doc's Boss text is bespoke per-boss flavor, not a generalizable system to extract a formula
from, the same reasoning that left the 25 Improvement Trees' nodes as placeholders in `0.31.0`.

**Combat's start form now asks V0.5's actual Combat-Loop-step-1 questions and computes a real
two-branch Rapport delta**, closing `HANDOFF.md` open issue 13 for good rather than just surfacing
it. `combatStartRapportDelta()` (`packages/shared/src/combat.ts`): initiating grants +1 (+2 if
every Hero shares the fight's goal); not initiating grants −1 only if the party is also
ill-prepared or off-balance; a fair fight the Heroes didn't start and aren't unready for gets no
change — see `README.md` item 33 for why this needed no repo-owner call (the doc's own two branches
read as clearly mutually exclusive, unlike most of the ambiguities this migration has hit).
`apps/server/src/routes/combat.ts`'s `/start` route computes this server-side from three booleans
the GM answers on `CombatPanel.tsx`'s start form (`CheckboxRow`), and writes the Rapport change in
the same request that creates the Encounter so a failure on either side can't leave one half done.

**Deliberately not built this slice, real scope for later, not oversights** — see `HANDOFF.md`
for the fuller list:
- Hero Moves — blocked on Playbooks not existing as a concept at the time. The repo owner has
  since confirmed Playbooks aren't part of the game's systems at all, so this is now cut rather
  than deferred — see "Working conventions" below.
- A rendered grid, and the Maneuver/Shift distinction noted above.

**`ParticipantCard.tsx` is three explicit variants, not one component with a boolean matrix
(`0.19.0`).** It used to take 6 boolean props (`canControl`, `canEngage`, `isOwnPC`,
`canRecuperate`, `canDefend`, `canHelp`) to render what were always one of three fixed
combinations — the tell was `EncounterView.tsx`'s enemy call site passing three literal no-op
handlers (`onRecuperate`/`onDefend`/`onHelp={() => {}}`) purely to satisfy the shared prop type.
Only `canControl` turned out to be a genuinely orthogonal permission (true for both an own-PC card
and an enemy card, varying per viewer for both); the other five collapsed into exactly which of
`OwnPCCard`/`AllyPCCard`/`EnemyCard` a card is — a shared, unexported `ParticipantCardShell` in the
same file holds the actually-common chrome (name/badges, Range/AP stepper, Statuses, the
remove-confirm flow), and each variant supplies its own action buttons as plain children rather
than a render prop, since none of them need anything from the shell beyond what they already have
via `participant`. `EncounterView.tsx`'s Party section picks `OwnPCCard` vs `AllyPCCard` per
participant based on `p.RefId === myCharacterId`; Enemies always render `EnemyCard`, with Engage
gated on the same `canControl` flag rather than a separate `canEngage` prop (they were always the
same value, `isGM`). If Combat ever needs a fourth kind of card, extend this pattern — a new
variant plus whatever the shell needs to expose — rather than reintroducing a boolean-matrix
component. The shell gained one optional `extraBadges?: ReactNode` slot in slice 5 (`0.32.0`) for
`EnemyCard`'s Boss-only "Last Stand" badge, rendered in the shell's own badge row alongside
Toughness/Unstable/Defeated — a second, narrow extensibility point (badges can't be expressed as
`children`, which render in the actions area below) rather than a step back toward per-card
boolean props.
