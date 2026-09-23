# Combat

Track-and-display, never enforcement. Range as theatre-of-the-mind bands with no rendered grid, per-Status Enemy Limits, Gambits, and the Strain mapping applied across two slices.

_Part of `docs/architecture/`. Index: [`docs/architecture/README.md`](README.md). The invariants a session must not violate stay in `CLAUDE.md`; this file is the detail behind them._

---

## Architecture: the revised Combat loop (revised V0.6 slice 6, `0.58.0`)

**The Combat chapter the 2026-09-15 revision rewrote, from the first turn to the last.** Source:
`Ruleset-V0.6.md`, "Combat" (Combat Loop, Action Points, Hero Rolls in Combat, Combat Moves,
Gambits, Repeated Attacks, Immobilized, Ending Combat) and `WorkPlan-V0.6-Revision.md` A2.8. The
enemy side — stat blocks, Guard, structured attacks, Legendary phases — is slice 7's, which
landed in this app; enemies now use the revised `EnemyStatBlock` carried on the `CombatParticipant`.

**Starting and turns.** The 2d6 initiative roll is gone: in round 1 the GM picks the side "best
positioned to act first in the fiction", stored as `Encounter.FirstSide`, and because "the same
side that began Combat acts first in every round", Next Round hands `ActingSide` back to it.
Surprise is per unit (`CombatParticipant.Surprised`), toggled by the GM in round 1 and cleared by
`startNewRound()`; `nextActor()` skips a surprised unit, and a surprised Hero's Reactions (Defend,
Interpose, Brace, Opportunity Attack) are disabled with a note. Team-Up is Heroes only; the header
notes that the enemy side then takes two turns, and that a Legendary enemy isn't limited to one.
Picking a unit as the actor, or as a Team-Up partner, calls `beginTurn()`, which ends Fortify.

**Action Points.** `maxActionPoints(p)` reads `ActionPointsMax` (3, or 4 on the turn after
Prepare); `endTurn()` refills to 4 when `PrepareNextTurn` is set, clears it, zeroes the Repeated
Attacks count and clears Halted. The card's AP readout and stepper use the maximum instead of a
literal 3. Every Reaction now spends 1 AP: Opportunity Attack (which used to be free), Interpose,
Defend and Brace.

**Engage.** A Hero's Engage builds its roll with the shared `HeroRollBuilder` in `Engage` mode,
with three props this slice added: `inCombat` (a Flaw Tag counts −1 but marks no Potential —
"during Combat, do *not* mark Potential each time a Skill or Flaw Tag is used"),
`priorStrainMoves` and `extraBanes` (Cover). `engageStrain()` deals 6/4/2 in Melee and 5/3/1 at
Range, and a reported 6- gives the GM a Misfortune. **Repeated Attacks:** each AP-spending Engage by
a Hero increments `StrainMovesSinceRefresh`, and the builder worsens the roll's shape by
`repeatedAttackShape()` after the Boon/Bane comparison — down to Double Disadvantage, "the only rule
that creates" it. An enemy doesn't roll: the GM types its attack's Strain (the ruleset's 1–6
pressure table is the hint) and the Hero Resists it; slice 7 picks the attack from the stat block.

**Gambits** (`GAMBITS`, same cost rule): Bolster +1; **Pierce** ignores the target's **Guard**
(`guardedStrain()` with `pierce: true`); Press; Repel, reduced by `braceForcedMovement()` only when the
target Braces; **Halt** sets the enemy's `Halted` and **Impede** adds a name to its `Banes` — both
used to add a Strain *track*, the live defect `WorkPlan-V0.6-Revision.md` B1 names; Calculate is
unchanged until slice 9 turns it into a Forward reminder; **Fortify** sets the actor's `Fortified`.
The old Brace *Gambit* is gone; Brace is a Reaction now.

**Incoming Strain** (`IncomingOffers.tsx`) follows "Resolving an Enemy Attack" in order: Fortify's
−1; then Resist — a Hero Roll through the builder (2/1/0, a 6- gains Misfortune) or a Status
(2/4/6) — unless the offer can't be Resisted; then, with Strain left, **Defend**: a 1-AP Reaction
that marks an Armor box and negates the rest (the card's standalone Defend, which marked Armor
without touching any Strain, is gone); then the rest is marked, with Subdued tested first as
before. **Interpose** costs 1 AP and no longer makes the offer un-Resistable ("You may Resist
normally"). `PendingStrainOffer.SourceParticipantId` records the attacker.

**Other Combat Moves.** Prepare (1 AP, doesn't stack). Immobilized is a participant flag the GM (or
the Hero, on their own card) toggles: the card shows Speed 0 and a warning, never blocks movement,
and Break (1 AP) clears it — for yourself, or an ally ("Break free"). Brace reduces a push by
Mettle, minimum 1. Surprised, Fortified, Halted, Immobilized, Prepared and each Bane show as badges.

**Ending Combat.** The GM's `POST /:encounterId/end` clears every Hero participant's Strain
server-side ("When Combat ends: … Clear all Strain"), writing only sheets with Strain marked;
`character_sheets` is Realtime-synced, so open sheets follow. Each Hero marks Potential on one Motif
they used, self-serve, when the Combat Goal is achieved or their own Defiant Goal is — leaving early
on a Defiant Goal also clears their own Strain — with a reminder about Conditions whose Clear Action
was completed. The GM can agree an achieved Defiant Goal supersedes the Combat Goal, which marks the
Combat Goal achieved.

**Encounter normalization.** `normalizeEncounter()` gained a participant backfill it never had
(`Surprised`, `PrepareNextTurn`, `ActionPointsMax`, `StrainMovesSinceRefresh`, `Fortified`,
`Immobilized`, `Halted`, `Banes`) and `FirstSide`. No migration.

**Retired:** `engageBaseRank()`, `firstToActFromInitiative()`, `firstToActFromSurprise()`,
`resistForcedMovementBands()` and the `'Brace'` Gambit key. `EncounterView.tsx` was split into one
component per section first (`EncounterHeader`, `IncomingOffers`, `ReactionsSection`,
`LegendarySection`, `DefiantGoals`, `EndCombatFlow`), verified byte-identical in rendered DOM before
any rule changed, so the slice's work packages could run in parallel. The judgment calls are
decision 57.

**Bundle budget:** 219.64 kB gzip against the 220 kB cap. Combat is a lazy route chunk, so its own
growth doesn't count; what did count is the sheet's eager share of the roll builder and
`RecuperateModal`, which `StatusesPanel` now lazy-loads (it measured 220.75 kB without that). The
headroom is under half a kilobyte, so the next slice that adds to the sheet's first load has to
lazy-load something first.

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

## Architecture: Combat — track-and-display, no grid

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
The stat-block fields (`Stats`, `Strain`, `StatusNotes`, `ConditionsMarked`) are Enemy-only — a PC
participant is a thin pointer (`RefId` = `CharacterId`) at data that already lives on their sheet. This
collides with the sheet's existing owner-only write rule (`sheet.ts`'s PUT: only
`membership.CharacterId === characterId` may save it — not even the GM), which matters a lot in
Combat: an Enemy's attack can't write a Status directly onto the PC it's hitting. The fix is
`Encounter.PendingStrainOffers` — anyone can create one (it's just an Encounter field), but only
the target's own player can fulfill it, from their own participant card, optionally Resisting
first (applying a Status instead or rolling + Virtue) before it lands on their sheet
via `useCommitSheet`. Don't try to have the GM write a PC's Statuses directly if you extend this;
route it through a `PendingStrainOffer` instead.

## Enemies in Combat (revised V0.6, slice 7, `0.60.0`)

Source: `Ruleset-V0.6.md`, "Enemies in Combat" through "Subdued Enemies"; the plan is
`WorkPlan-V0.6-Revision.md` slice 7 and its judgment calls are `../decisions.md` item 59. The
pre-revision model — Toughness, per-track Status Limits, named Strain tracks, `IsBoss` — was
retired in this slice, not converted (the repo owner chose a clean break).

**The stat block travels with the enemy.** `EnemyStatBlock` (`types.ts`) is one shape for an
`EnemyTemplate`, a `Villain` and a combatant `NPC`: `Profile` (Minion, Standard, Elite, Legendary),
`Threat`, `Size`, `Speed`, `Range`, `Guard`, `Virtues`, `StrainBoxes`, `StatusSlots`,
`ConditionSlots`, `Unshakable`, `LastStandBoxes`, `GambitCharges`, structured `Attacks`, and
`Abilities` as prose. `newEnemyParticipant()` (`enemies.ts`) copies it onto the participant, so the
library can change without changing a fight already under way, and an ad-hoc enemy needs no
library row. The enemy-only participant fields are `Stats`, `Strain` (one sparse box row, the same
primitives as a Hero's track — a Legendary's current phase's), `StatusNotes` (the GM's description
of each filled Status slot), `ConditionsMarked` (Virtue ids), `Crumbled`, `Phase` and
`PhaseLostSinceActivation` (Legendary), and `MinionCount` (a Minion group). New blocks start from
`defaultStatBlock(profile)`, which reads the Threat Levels table (`ENEMY_PROFILE_DEFAULTS`).

**Adding enemies (`AddParticipantModal.tsx`).** Tabs for the library's Enemies, Villains and NPCs —
an entry with no stat block yet is listed but can't be added — and an ad-hoc enemy built from a
profile, optionally saved to the library. A Minion group is added with its count. The dialog shows
the fight's difficulty as it stands (`encounterDifficulty()`: total Threat per Hero, read against
the ruleset's bands), which is "only the starting estimate", so it is shown and nothing more.

**A Hero's hit.** `CombatMoveModal` builds the Engage roll through `HeroRollBuilder`. The target's
effective Virtues (`effectiveEnemyVirtues()` — a marked Condition drops a Strong Virtue to Neutral
and a Neutral one to Weak) become checkboxes in `EnemyVirtueSection`: opposing a Strong Virtue adds
a Bane per +, exploiting a Weak one a Boon per − (`enemyVirtueRollHints()`), and relevance is the
table's call, so nothing is pre-ticked. The Strain is `guardedStrain()`: the Move's Strain plus
Bolster, less Guard to a minimum of 1, or all of it with Pierce. `applyToEnemy` in `EncounterView`
then follows "Inflicting Strain on an Enemy": if the enemy has a free Status slot
(`hasFreeStatusSlot()`), the hit waits as an `Encounter.PendingEnemyHits` entry for the GM, who
either fills a slot with a described wound to negate all of it (`negateWithStatus()`) or marks it;
with no free slot it lands at once. Landing is `inflictEnemyStrain()`, whose outcome drives the
Combat log:

- `None` — no Strain, or the enemy is already down.
- `MinionSubdued` / `Subdued` for a Minion group — any Strain Subdues one Minion; the last one
  Subdues the group.
- `Marked` — the box equal to the Strain, or the next open one to its right.
- `Subdued` — no legal box left, for anything but a Legendary (or a Legendary in Last Stand).
- `PhaseEnded` — a Legendary with no legal box moves Opening → Bloodied (every box and Condition
  cleared) or Bloodied → Last Stand (Conditions cleared, then the `LastStandBoxes` highest marked
  boxes cleared to form its last capacity). The rest of the Strain is discarded; Status notes stay.
- `Discarded` — "A Legendary Enemy can lose no more than one phase between its activations": until
  `beginTurn()` clears `PhaseLostSinceActivation`, further Strain that finds no box is thrown away.

**Conditions and Crumble.** The GM marks and clears an enemy's Conditions on its card
(`markEnemyCondition()`, `clearEnemyCondition()`). An Unshakable enemy can't mark one; a Minion
Crumbles on any mark; anything else Crumbles on marking its last `ConditionSlots` slot, and clearing
one lifts the Crumble. Crumbled is a badge — what a Crumbled enemy may still do is the GM's to play.

**An enemy's attack (`EnemyAttackModal.tsx`).** The GM opens it from the enemy's card or, for a
Legendary, from `LegendarySection`, picks one of the stat block's attacks or types another, and
picks the target. A Minion group's attack is combined into one, at most 5 Strain
(`groupMinionAttack()`). An attack with a Misfortune cost can't be used without that much Misfortune
and spends it on confirming. Enemies never roll: the attack becomes a `PendingStrainOffer` carrying
`AttackName`, `SuggestedVirtueIds`, `ConditionVirtueId`, `AdditionalEffect` and `EffectTrigger` —
everything "before they decide how to defend" — and the Hero resolves it in `IncomingOffers` like
any other incoming Strain (Resist or a Status, then Defend). The attack's Condition is marked on the
Hero's sheet, as step 4 says, "unless an effect says otherwise"; the Additional Effect is prose, so
the app tests its trigger (`OnStrain` by default, `Regardless`, `OnMissedResist`,
`InsteadOfStrain`) and tells the table it happens, rather than applying it. An `InsteadOfStrain`
attack arrives with 0 Strain and needs no Resist.

**Legendary enemies (`LegendarySection.tsx`).** Each living Legendary gets an Attack button, since
"a Legendary Enemy takes one turn after every Hero's turn". One surprised in round 1 can take its
first turn after the first Hero acts if the GM spends a Misfortune (`spendMisfortuneToAct` in
`EncounterView`, offered only while the GM has one).

**Repel against an enemy** pushes by `enemyStrainRank()`, its highest marked box.

**The clean break, read side.** `normalizeLibrary()` strips `IsBoss`, `Toughness` and
`StatusLimits` from enemies, Villains and NPCs, and an enemy template's top-level `GambitCharges`
(now `Stats.GambitCharges`). It returns the same array when there is nothing to strip, because
`repo.ts#getLibrary` compares each key by identity to decide whether to write the library back.
`normalizeEncounter()` runs `normalizeEnemyParticipant()`: an enemy that joined a fight before this
slice gets the profile defaults — Legendary if it was a Boss, otherwise Standard, keeping its
Gambit charges — and an empty Strain row, and loses whatever it had marked on the old tracks.

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

**Legendary Enemies get a multi-phase mechanic** (`ProfileDefaults` for Legendary, and `inflictEnemyStrain()`'s
PhaseEnded branch) — Opening, then Bloodied, then Last Stand (N). Each phase has its own `StrainBoxes`
and clears Conditions / Crumbled on transition. The text "when a Hero directly opposes one of the
Enemy's Strong Virtues..." / "when a Hero exploits a Weak Virtue..." is turned into Banes/Boons the
player ticks, driving Resistance rolls — there is no separate Boss-action system beyond normal turn
order and the ruleset's own Legendary turn frequency ("A turn after every Hero's turn"). The Legendary
abilities themselves (Grizza's "Fall to my Power!", "Fearsome Yell," and similar) stay freeform GM
content — the doc's own text is bespoke per-enemy flavor, not a generalizable system to extract a
formula from, the same reasoning that left the 25 Improvement Trees' nodes as placeholders in `0.31.0`.

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
component. The shell gained one optional `extraBadges?: ReactNode` slot in slice 5 (`0.32.0`), which since
slice 7 carries `EnemyCard`'s stat-block badges (profile or Minion count, Threat, Size, Guard,
Unshakable, a Legendary's phase), rendered in the shell's own badge row — a second, narrow extensibility point (badges can't be
expressed as `children`, which render in the actions area below) rather than a step back toward
per-card boolean props.
