# Work plan — ruleset V0.6

A revised ruleset, **A Story of Heroes and Villains V0.6**, has been adopted and now lives at
`Planning Docs/Ruleset-V0.6.md`. It replaces `Ruleset-V0.5.md`, which moves to
`Planning Docs/archive/` carrying a SUPERSEDED banner — archived rather than deleted, deliberately:
the 2026-09-03 design meeting framed V0.6's harm model as *an experiment to compare against the
existing system*, not a settled replacement, and Ryan's own stated process was "preserve the
existing version 0.5 in the legacy material, create version 0.6." If testing favours ranked
Statuses, V0.5 is what the app falls back to.

V0.5 and V0.6 are structurally the same document (1,895 lines vs 1,890), so the delta is exactly
diffable rather than inferred. It is a much smaller delta than the V0.5 migration was — but it
lands on the app's single most load-bearing subsystem, and it touches almost every screen that
displays a number.

**The one-line summary: Statuses stop being ranked tracks.** Harm splits into **Strain** (a
short-term 5-box track that clears at the end of a scene) and **Statuses** (three severity slots —
Minor ×3, Major ×2, Severe ×1 — each a written injury carrying a fixed roll penalty), with
**Boons & Banes** replacing situational ranked modifiers and a **Healing Track** replacing Recovery
spending. Every screen that renders a Status changes meaning.

This document is named for the ruleset rather than for a version, following `WorkPlan-V0.5.md`:
the work is staged into eight slices (Section C), each its own branch, PR and release, `0.42.0`
through `0.49.0`. A version-named plan would describe an eighth of the work and go stale the
moment the first slice merged.

**This branch changes documentation only.** No source file is touched, nothing bumps a version,
`CHANGELOG.md` is not edited. Precedent: session 34 landed `WorkPlan-0.26.0.md` at `0.25.0`,
session 36 landed `TechStackAudit.md` at `0.26.0`, and session 39 landed `WorkPlan-V0.5.md` at
`0.27.0`. The current version is `0.41.0`, and it stays `0.41.0` when this branch merges. **None of
the eight slices below is built yet.**

## Sources

- `Planning Docs/Ruleset-V0.6.md` — the canonical ruleset, adopted 2026-09-09.
- `Planning Docs/archive/Ruleset-V0.5.md` — its predecessor, retained and recoverable.
- Five design-meeting summaries, 2026-07-24 through 2026-09-03. These supply the *reasoning* behind
  V0.6 and, importantly, carry several decisions agreed verbally that never reached the document's
  text. Section A4 lists those; per a repo-owner decision they are treated as real scope, not as
  unresolved questions.

## Decisions already locked

Confirmed with the repo owner before any of the eight slices begin. Do not reopen these.

| Decision | Choice |
|---|---|
| **Combat's unmigrated chapter** | **Extend Strain into Combat ourselves.** V0.6's Combat Basics chapter is byte-identical to V0.5's — it was never rewritten, and still deals ranked Statuses, spends Recoveries, and defines Unstable at Rank 4. Rather than run two harm systems or block the migration, the app reconciles it. The mapping is fixed once, in Section B1, and recorded as a `README.md` judgment call — it is not improvised per-slice. |
| **Subdued, Scars and death** | **Retire the flow, keep the data.** V0.6 deletes the entire "Limits, Scars, & Death" section — Scars, Risk Death, Blaze of Glory, Total Party Subdual and Resurrection all vanish with no replacement, and Subdued is redefined purely as "no Strain box free and no Status slot to absorb the rest." The Subdued modal's three-way choice retires from the trigger path; `CharacterSheet.Scars[]` and its display survive, so nothing is lost and a future Last Stand rule has somewhere to land. |
| **Meeting decisions absent from V0.6's text** | **All four in scope**: Rapport overflow, Load wildcard slots, Threats on a player-facing board, and pronouns on the Hero sheet. See Section A4. |
| **This document's own scope** | **Docs only, no bump.** See above. |
| **V0.6's authority** | **Canon, with V0.5 recoverable.** Where V0.6 is silent, the silence is recorded in Section D, never quietly filled from V0.5 or from somewhere else — except where Section B1 explicitly says otherwise for Combat. |

---

## A — What V0.6 changes

### A1 — Already correct: verify, do not touch

Confirmed by diffing V0.5 against V0.6 and both against the seed. These are the parts of the last
migration that survive intact, and re-deriving them would be wasted work and fresh risk.

- **Motifs.** All 13 (`mo-artisan` … `mo-virtuoso`, `seedLibrary.ts:98-110`) match V0.6 exactly,
  including `Exalted/Lowly`. The per-Motif Skill Tag and Flaw Tag example catalogs are unchanged
  between the two versions.
- **Virtues and Conditions.** Names, Essences, usage helper text, the five Conditions, their
  `RollPenalty: -2` and their Clear Actions all match (`seedLibrary.ts:66-77`).
- **`CharacterMotif`.** `SkillTags` / `FlawTags` / `Potential` / `Quest` / `ActBreaks` / `Forsakes`
  (`types.ts:532-541`) match V0.6's Hero Sheet Example field-for-field. `MotifPanel.tsx` already
  renders every one of them.
- **The Improvement DAG.** 25 trees (11 Combat + 14 Narrative), Starting-or-connected gating, no
  Tier and no Level — and V0.6 *deletes* the contradictory Tier/Level text that made this a judgment
  call in slice 4. The DAG reading is now simply what the document says.
- **Load tier bases.** 3 / 5 / 6, `+ Might` (`seedLibrary.ts:238-240`, `logic.ts:35-38`).
- **`resistRollReduction()`** (`engine.ts:86-90`) already computes V0.6's Resist formula exactly:
  negate 1 per point of the Virtue rolled, +1 on a 10+, nothing on a miss. Only the *unit* changes,
  from Status Ranks to Strain. The arithmetic is untouched.
- **`markRank()`** (`engine.ts:137-147`) already implements V0.6's Strain-box algorithm verbatim —
  "check off the box matching the value; if it's taken, check the next unmarked box to the right."
  The Strain track *is* this function over a 5-box row. `StatusBoxes.tsx` is already the widget for
  that geometry.
- **The 22 Moves' identities.** Same 10 Basic and 12 Adventure. Two rename; all need text rewrites,
  but none is added or removed.
- **Adventures, Villains, NPCs, Locations.** These chapters are unchanged apart from one flagged
  line (Section D). Slices 8 and 9 of the last migration stand.
- **Combat geometry.** Because the Combat chapter is unchanged, the theatre-of-the-mind Range-band
  deviation (`README.md` item 15) stands exactly as it did. Not reopened by this migration.
- **The Bond-5 lock.** `isBondLocked()` matches V0.6's "when you place your 5th Bond at Bond 5, your
  Bond Level locks and can not be moved down" unchanged.

### A2 — Changed by V0.6

#### The harm model (the core of the migration)

| Ships today | V0.6 |
|---|---|
| `CharacterStatus { Marks: boolean[6], Polarity }`, Rank 1-6, unlimited rows | **Strain**: one 5-box track. Mark the box equal to the incoming value, or the next unmarked box to its right. Clears completely at the end of the scene or Combat in which it was taken. **Statuses**: named lasting injuries in severity slots — Minor ×3, Major ×2, Severe ×1 |
| Positive Statuses add `+Rank`; Negative subtract `-Rank` (highest of each, reported separately as `StatusSources`) | Statuses only penalise, by severity, and **never stack** — only the highest applying Status counts: Minor **−1**, Major **Disadvantage**, Severe **roll 1d6 instead of 2d6** |
| Positive and Neutral Statuses carry buffs | **Boons & Banes** — unranked situational tags. More relevant Boons than Banes → Advantage; more Banes than Boons → Disadvantage; equal → neither. They clear the moment they stop being true |
| Resist reduces an incoming Status Rank | Resist reduces incoming **Strain** — *or* you choose to **take a Status**, which absorbs a flat **2 / 4 / 6** by severity. Both methods can reduce incoming Strain to 0 |
| `Recoveries` (max 6), spend 1 to clear `1d6 + Mettle` Ranks | **Healing Track**, 5 segments. Recuperate: take 2 Strain, remove one Minor Status, roll +Mettle for 3 / 2 / 1 segments. When it fills, **downgrade every Status by one severity** — renaming each to reflect the improvement ("Broken Arm" → "Arm in a Sling") — provided a slot is free at the lower severity; then clear the track and carry the remaining segments onto the fresh one |
| Armor negates a Status | Armor negates **Strain**, completely. Otherwise unchanged: three types, refresh at Make Camp, 1 AP to Defend in Combat |
| Subdued at Rank 6 → Take a Scar / Risk Death / Blaze of Glory | **Subdued** when no higher Strain box is free *and* no Status can absorb what's left. Nothing further is defined — see Section D |

#### Everything else that changed

- **Skill and Flaw Tags become mechanical.** A relevant Skill Tag is **+1** on the roll. A relevant
  Flaw Tag is **−1** *and* marks Potential on its Motif whether the roll hits or misses. **Push
  Yourself**: when a second Skill Tag also applies, mark a Condition for another +1. Today these
  tags are display-only text.
- **Two Adventure Move renames.** `m-levelup` "Level Up" → **"Advance a Motif"**; `m-journey`
  "Undertake a Journey" → **"Set Out"**. Set Out keeps Scout Ahead → Venture Forth intact but
  promotes Loadout to its first step.
- **Advancement timing.** A full Potential or Rapport track no longer advances on the spot — it
  advances **the next time you Make Camp**. Both `MotifAdvanceModal` and `PartyAdvanceModal`
  currently fire immediately on a full track.
- **Consequence vocabulary.** Invoke Expertise and Take a Risk now name **Burdened, Compromised,
  Delayed, Depleted, Exposed** (was Attrition / Detection / Danger / Delay / Sacrifice), and the
  consequences are no longer ranked Statuses.
- **Move results deal Strain and Boons, not ranked Statuses.** Stand Defiant's "take *Rattled 2*" →
  "take two Strain, no Resist". Follow a Lead's "*Fatigue 2*" → "two Strain … that carries into the
  next scene". Strike a Nerve's "*Scared of ___ 2*" → "gain an appropriate Boon". Offer Solace drops
  Status-shifting entirely and marks Bond instead. Every seeded Move's `Results` text needs a pass.
- **Make Camp.** Was "clear 1d6 Conditions, 2d6 Ranks of Negative Statuses, 1d6 Ranks of Positive".
  Now: **clear one Condition, Recuperate, refresh all Armor.** The GM's Countdown advance becomes
  explicit ("the Adventure's Countdown … or another Threat's Clock", and they may decline to say
  what changed). Camp Actions change too: "Change personal Drive/Want" becomes **"Rewrite or update
  any one of your Skill or Flaw Tags."**
- **Keep Watch.** Statuses become Boons and Banes (the Alert Boon, the Restless Bane). The GM's 6-
  now marks **Rapport for the party** where it used to have everyone mark Potential. The watcher's
  roll is fixed to **+Wit** rather than "an appropriate Virtue". The "two questions" option gains a
  limit: the GM answers only with what the Hero could feasibly find out.
- **Enjoy Downtime.** Rest becomes "**Recuperate without taking Strain**" (was "remove all Status
  Ranks"). Carouse costs **1 Wealth**, not 1 Treasure. Pivot becomes "change a Motif as if you had
  marked your third Forsake". Train specifies "in a Motif of your choice".
- **End the Session.** The per-player Hold economy is **gone**. Each player instead **chooses one of
  three ways to grow**: mark a Bond with a named Hero, rewrite a Skill or Flaw Tag, or mark
  Potential on a Motif whose Quest they progressed. The party Rapport question set changes slightly
  ("Did we move to accomplish our Party Quest?" replaces the Party Path question).
- **Clocks, restructured.** `Basic` → **Opposition Clock**. The six WIP variants collapse to three
  named kinds — **Opposition, Tug-of-War, Project**. **Linked Clocks, Mission Clocks, Progress
  Clocks and Long-Term Projects are deleted outright.** **Threat Clocks** become a real structured
  entity: Name, description, **Goal, Skill Tags, and Developments** (at least one per segment,
  triggered in whatever order serves the pacing), sized by scope — 2-4 segments for a nearby Threat,
  4-6 regional, 7+ realm. They are explicitly player-facing.
- **Bond spending is now an explicit five-option menu**: +1 to your roll against them, −1 to theirs
  against you, offer them an experience point, add an extra harm 1-for-1, or mark a Condition on
  them / give them a Rank 2 Status. The line "At 0 Bond, all characters have a SHOT IN THE DARK
  move" is deleted. **Forge a Bond's effect is now literally "TO BE DETERMINED"** — a regression in
  specificity from V0.5, which at least said "increase your Bond Level by 1 and take a move".
- **Combat Loop gains** an explicit surprise rule, a **2d6 initiative roll** (7+ Heroes act first),
  a GM-stated **Combat Goal**, **Defiant Goals** for a dissenting minority, Potential marked by
  everyone when the Goal is achieved, and **no Potential on a 6- inside Combat**. Several of these
  exist already (`firstToActFromInitiative()`, `Encounter.CombatGoal`, `DefiantGoal`); surprise and
  the Potential rules do not.
- **New chapter: Creating the World.** CATS (Concept / Aim / Tone / Subject Matter) plus a five-step
  collaborative map build adapted from *The Perilous Wilds* — starting place and its questions,
  surrounding regions, places of interest, personal places, connectors, opening rumors. No app
  surface exists for any of it.
- **Party Improvements** gains its first four authored examples (a new team move, a new team ally,
  two new asset selections, running into your antagonist next Adventure). This is the first authored
  Party Improvement content the document has ever carried.
- **Small text corrections.** Invoke Expertise now says "roll + an appropriate **Virtue**" where it
  used to say "Ability"; several "the GM makes a move" become "makes a **hard** move".

### A3 — New in V0.6: nothing exists today

Strain; the Healing Track; severity-slot Statuses; Boons & Banes; mechanical Skill and Flaw Tags;
Push Yourself as a roll modifier; structured Threat Clocks with Developments; the Creating the World
chapter; pronouns on a Hero.

### A4 — Agreed in meetings, absent from V0.6's text

Four decisions were reached verbally and never written into the ruleset. Per a repo-owner decision
these are **real scope**, not open questions — but the plan records that the document doesn't say
so, because a future reader diffing the app against `Ruleset-V0.6.md` will otherwise find four
behaviours with no textual basis.

1. **Rapport overflow** (2026-08-19). Rapport may exceed its cap of 5. Overflow is preserved until
   the party returns to camp, where it can fund multiple advancements — but spending *any* Rapport
   before camp forfeits the overflow and resolves the spend from the normal cap. The meeting's own
   worked example: a party at **10/5** that spends 1 before camp drops to **4/5**, not 9/5. This
   creates the intended tension between banking advancement and spending to survive. `Party.Rapport`
   is currently typed and treated as `0..5`.
2. **Load wildcard slots** (2026-08-19). Unused Load boxes are wildcards. During play a Hero declares
   they packed a reasonable ordinary item and assigns it to a free box. Ordinary wildcard items
   return to the ether when Load resets at camp; **named, magical or plot-relevant items persist**
   and permanently consume Load, so acquiring one costs future wildcard capacity. Running out should
   create problems, not just block. V0.6 describes the *declaration* half of this ("declare, at any
   time, that your character has any item … by checking a Load Box") but says nothing about the
   wildcard-versus-persistent distinction or about what happens when a Hero is out.
3. **Threats on a player-facing quest board** (2026-08-19). Some GM Threats get promoted to visible
   party quests ("Deal with the Red Hand Bandits"), with the clocks of neglected Threats advancing
   as the party pursues others — the accumulating stack of quest cards being the intended engine of
   mechanical pacing and dramatic pressure. V0.6 makes Threat Clocks player-facing but describes no
   board and no promotion step.
4. **Pronouns.** V0.6's Hero Creation opens "Choose your **Name, Pronouns**, and Physical
   Description" — so this one *is* in the text, but the app models Name and Looks and has no
   pronouns field anywhere in `packages/shared`.

---

## B — Migration hazards

### B1 — The Combat chapter was never rewritten, and this is how we reconcile it

`Ruleset-V0.6.md`'s Combat Basics chapter is **byte-identical** to `Ruleset-V0.5.md`'s — verified
by diffing the two ranges directly, not inferred. It still says "Apply *Status 5*", still spends
Recoveries, still defines Unstable at Rank 4, still treats Cover as a ranked Positive Status, and
still has Defend negate "a Status". None of that is compatible with the Strain chapter twelve pages
earlier. Ryan flagged the work himself — the Villain template in the same document carries a
literal `Set Status Limits. !! UPDATE` marker — and the 2026-09-03 meeting's own process note was
"update the rules throughout to use the new Strain and Status terminology," which has not happened.

Per the locked decision above, the app reconciles this rather than blocking or running two systems.
**The mapping is fixed here, once, so no slice invents its own.** It is a judgment call, recorded as
such in `README.md`, not a reading of the text.

| Combat rule as written (unchanged since V0.5) | Under Strain |
|---|---|
| Engage in Melee: apply *Status 5 / 4 / 3* | Deal **5 / 4 / 3 Strain** |
| Engage at Range: apply *Status 4 / 3 / 2* | Deal **4 / 3 / 2 Strain** |
| Toughness Medium: −2 to the Status Rank given, floor 1 | −2 Strain, floor 1. `applyToughness()` is unchanged; only the unit differs |
| Toughness Heavy: Rank as if one tier lower | Strain as if one tier lower. Unchanged |
| Defend (1 AP): mark Armor to negate a Status | Mark Armor to **negate the Strain entirely** — which is V0.6's own Armor rule verbatim, so this one is not an invention |
| Resist (reaction) | The Resist Roll: reduce Strain by the Virtue rolled (+1 on a 10+), **or** take a Status to absorb 2 / 4 / 6 |
| Interpose: take the Status instead, cannot Resist | Take the **Strain** instead, cannot Resist |
| Enemy Status Limits ("4 Hurt") | **Strain Limits.** An enemy accumulates Strain on each named track; reaching any one Limit removes it from the conflict. Enemies keep a counting track — they have no severity slots, and V0.6 never gives them any. **This is the single largest invention in the mapping**, and the one Ryan's own `!! UPDATE` marker sits on |
| Unstable: a Hero at Rank 4 of any Status | A Hero **holding any Major or Severe Status**. Enemies unchanged: half of any Limit |
| Cover / Hidden / Invisible: subtract the highest Rank | A **Boon** on the target, giving the attacker Disadvantage. This is strictly cleaner than the ranked version and matches the Boons & Banes chapter |
| Recuperate: spend 1 Recovery, clear `1d6 + Mettle` Ranks | 1 AP, take 2 Strain, remove a Minor Status, roll +Mettle on the Healing Track |
| Gambit **Bolster**: +1 Rank to the Status you deal | **+1 Strain** |
| Gambits **Halt / Impede**: give Rank 2 of a Status | Give an appropriate **Bane** |
| Gambit **Calculate** | +1 forward. Unchanged |
| Gambit **Brace**: reduce all Status Ranks against you by 1 | **−1 Strain** from everything until your next turn |
| Gambit **Repel**: push spaces equal to the Rank of its highest Negative Status | Push bands equal to the **severity of the target's highest Status** (Minor 1 / Major 2 / Severe 3) |
| `PendingStatusOffer` — an enemy cannot write a PC's sheet | **`PendingStrainOffer`.** Same ownership constraint (only the target's own player may fulfil it), same shape, new payload |

**Left open inside the mapping, to be flagged rather than guessed:** Boss "Last Stand" thresholds and
attacks written as `1D6 Wounded` are expressed in Ranks. `1d6` reads naturally as `1d6` Strain, but
given the `!! UPDATE` marker this is exactly the area Ryan intends to revisit, so slice 3 should
surface it in the UI as a documented assumption rather than bury it in a constant.

### B2 — Other hazards

- **There is no honest conversion for existing ranked Statuses.** A `Marks: boolean[6]` row carries a
  polarity and a rank; a V0.6 Status carries a severity and a written description. Mapping Rank 1-2 →
  Minor, 3-4 → Major, 5-6 → Severe would produce plausible-looking garbage, and Positive Statuses have
  nowhere to go at all. Slice 1 of the V0.5 migration took a **clean break** — pre-release test data
  wiped rather than translated — and the same applies here. Confirm before slice 1 runs; it is a
  one-line decision but an irreversible one.
- **`normalizeSheet()` must be extended, not trusted.** This is the rule the `0.17.0` audit already
  caught the project breaking once, for `Library`: new required fields on a JSONB blob deserialize as
  `undefined` on rows written before the field existed. `Strain`, `Statuses` (new shape),
  `HealingTrack`, `Boons`, `Banes` and `Pronouns` all need read-time defaults in
  `logic.ts:427-442`, and a missing `HealingTrack` must backfill to **0**, not to full — the
  mirror-image of the `Recoveries` trap, where backfilling empty would have inflicted Exhausted on
  every old sheet.
- **The bundle budget has essentially no headroom.** Slice 6 of the last migration left it at
  207.13 kB against a 208 kB cap; slice 7 raised the cap to 220 kB and measured 208.74 kB. Strain,
  the Healing Track and a Boons/Banes editor are all *always-visible* sheet content, not lazy
  modals. Check `apps/web/scripts/bundle-budget.mjs` **before** adding eagerly-loaded content in
  slices 1 and 2, not after.
- **`StatusesPanel.module.css` carries hard-won layout arithmetic.** The `@container status-col
  (min-width: 510px)` threshold, the `.pipsCell` negative margins, and the six-pip row geometry were
  each derived from real rendered measurements across the doubled appearance matrix, and each has
  regressed at least once. Slice 1 replaces the six-box row with severity slots and a 5-box Strain
  track, which invalidates that arithmetic wholesale rather than adjusting it. Re-derive from
  measurements; do not scale the existing numbers.
- **Two Statuses-adjacent components have separate copies of the same labels.** `AdvancementPanel`
  and `CampaignBonds` each carry their own `TYPE_LABELS`; a rename that touches one and not the
  other degrades silently to a raw enum. Assume the same class of duplication exists for Status
  polarity labels and grep before renaming.
- **Grep before rebuilding.** `0.34.0` nearly reimplemented Make Camp's already-shipped resource
  reset, and `0.40.0` shipped a duplicate of an iOS-zoom rule that had existed since PR #68. Several
  slices below touch flows that already partly exist (Combat Goal, Defiant Goals, initiative).
- **Realtime and RLS need no work.** Every affected shape is a JSONB blob on an already-published
  table. No migration file is expected in any of the eight slices — which is worth stating
  explicitly, because the *absence* of one is what makes this migration cheap on the ops side, and
  three prior incidents came from the opposite situation.

---

## C — The eight slices

Each slice is its own branch, PR and release. Slice 1 goes first for the same reason it did in the
last migration: the wire contract has to settle before any screen is rebuilt on top of it.

### Slice 1 — Harm primitives (`0.42.0`) ✅

**Shipped `0.42.0`.** The whole of Section A2's harm table, in `packages/shared` plus the Statuses
surface, exactly as scoped below — with one correction and one forced addition found during the
build, both recorded here rather than silently deviating from the plan:

- **Correction**: it isn't `CrumbleModal` that drops a Vulnerable-4 grant — that modal never
  granted one. The grant lived in `combat.ts`'s `applyCrumbleVulnerable()`, called from
  `EncounterView.tsx`'s Gambit-cost path; that function is the one deleted, per B1's "Legacy code
  left stranded" list. `CrumbleModal.tsx` itself needed no change at all.
- **Forced addition, not in this scope originally**: Combat's own files (`EncounterView.tsx`,
  `CombatMoveModal.tsx`, `ParticipantCard.tsx`) had to be updated to compile against the retyped
  `CharacterStatus`, since `PendingStatusOffer`/`CombatParticipant.Statuses` both depend on the old
  shape. Applied Section B1's mapping table at the primitive level only (new `EnemyStrainMark`
  type, `PendingStrainOffer` rename, flat-Strain Engage, Boon-pushing Calculate/Brace, a
  static-reminder Cover) — Slice 3's own real rebuild (surprise, Combat-Goal Potential, richer Boss
  content, a from-scratch reconsideration of the whole B1 mapping) is untouched. See CLAUDE.md's
  "Architecture: Strain & Statuses (V0.6 slice 1)" and `README.md` item 44 for the full account.
- Two Adventure Moves' own `giveStatus()` calls (Keep Watch, Undertake a Journey) also didn't
  compile once `giveStatus()` was retired; both now push onto `Boons`/`Banes` instead, matching
  A2's own wording for Keep Watch. Neither Move's guided flow was otherwise touched — still Slice
  4's to rebuild.
- Make Camp's own mechanic (clear one Condition, Recuperate, refresh Armor) was pulled forward from
  Slice 4's nominal scope, since `StatusesPanel.tsx`'s Make Camp button directly manipulated the
  now-retired `Recoveries` field and had to be rewritten regardless.

Original scope, all shipped as planned:

- `types.ts`: `CharacterSheet.Strain` (a `boolean[5]` row), `Statuses` re-typed to
  `{ Id, Severity: 'Minor'|'Major'|'Severe', Name, Description }`, `HealingTrack: number`,
  `Boons: string[]`, `Banes: string[]`. Retire `StatusPolarity`, `CharacterStatus.Marks`,
  `LinkedToIds`, `AffectedByIds`, `Recoveries`.
- `engine.ts`: new `markStrain` (wrapping the existing `markRank`), `strainExhausted`, `takeStatus`,
  `statusAbsorb` (2/4/6), `statusPenalty` (−1 / Disadvantage / 1d6), `advanceHealingTrack`,
  `downgradeStatuses`. Retire `giveStatus`, `healStatus`, `applyOpposingStatus`, `sortStatuses`,
  `negativeStatusRankTotal`, `healingSurgeAmount`, `resolveRiskDeath`, `makeScar`. Keep
  `statusRank`/`markRank`/`reduceRank` — they serve Strain and enemy tracks.
- `logic.ts`: `spendRecovery` retires; `normalizeSheet` extended per B2.
- Armor's meaning changes from Status-negation to Strain-negation.
- Subdued redefined; the three-way modal retires from the trigger path; `Scars[]` and its display stay.
- UI: `StatusesPanel.tsx` rebuilt (the largest single change in the migration), `StatusBoxes.tsx`
  repurposed as the Strain row, `GiveStatusModal` → `TakeStrainModal`, `HealStatusModal` →
  `RecuperateModal`.
- `GameSettings`: `StatusMaxRank` → `StrainTrackLength`, `RecoveriesMax` retires, add
  `HealingTrackLength` and the three slot counts.

### Slice 2 — Rolls (`0.43.0`) ✅

**Shipped `0.43.0`.** All four bullets below, plus two scoping calls found during the build —
recorded here rather than silently deviating, same discipline slice 1's own annotation used:

- **Scoping call, not in the original bullets**: `computeRollBreakdown()` takes its new tag/Boon/
  Bane inputs as a fourth, optional `RollExtras` parameter rather than a new function — every
  existing call site (`CombatMoveModal.tsx`'s Engage roll) keeps compiling and behaving unchanged
  with no tags supplied, and stays a pure display function: marking the Condition a Push Yourself
  tag costs, and the Potential a Flaw Tag marks, are the *caller's* job (`MoveRollHelper.tsx`),
  same "engine computes, UI applies via `commit()`" split this module already used for Hold grants.
- **Scoping call: the highest-severity Status penalty only folds into `Total` when it's Minor.**
  Major ("Disadvantage") and Severe ("roll 1d6 instead of 2d6") change the *shape* of the roll, not
  a value to add, and this slice deliberately didn't invent a rule for how a Status-driven
  Disadvantage combines with a Boon/Bane-driven one — the document doesn't say, and Section D below
  is explicit this app doesn't guess at questions like that. Both show, separately, and the table
  resolves it.
- `computeRollBreakdown` gains applicable Skill Tags (+1 each), Flaw Tags (−1 each, marking
  Potential), Push Yourself (+1, marking a Condition), the highest applying Status penalty, and
  Boon/Bane comparison producing Advantage or Disadvantage — shipped exactly as scoped, plus the
  two calls above.
- `MoveRollHelper.tsx` becomes a real roll builder rather than a static breakdown — shipped.
  `CombatMoveModal.tsx`'s own Engage roll is untouched; that's Slice 3's ("Combat on Strain,"
  below), not this one's — the bullet list here only ever named `MoveRollHelper.tsx`.
- `Move.AdvantageTrigger` retires — with Boons and Banes, Advantage is a general mechanic and the
  per-Move enum is the wrong shape. Follow a Lead's Wealth spend survives as a Boon grant — shipped
  as a universal Boons/Banes picker replacing both of the old field's hardcoded triggers; neither
  Move's `Description` text was rewritten (Slice 4's job, not this one's).
- Watch the modifier-bloat concern the 2026-07-24 meeting raised: this slice is where the app first
  displays Virtue + Skill + Push + Flaw + Status + Boon/Bane + Aid + Bond on one roll. Displaying
  the full stack is itself the design instrument — it is how the designers see whether the
  arithmetic is too much. Shipped as designed — `MoveRollHelper.tsx` now shows every one of those
  at once for a Move with a fixed Virtue and applicable tags.

### Slice 3 — Combat on Strain (`0.44.0`) ✅

**Shipped `0.44.0`.** Everything below, plus real findings from the build — recorded here rather
than silently deviating, same discipline slices 1-2's own annotations used:

- **The GM-stated Combat Goal and the 2d6 initiative roll already existed** (`Encounter.CombatGoal`,
  `firstToActFromInitiative()`) — this slice's own real additions were surprise
  (`firstToActFromSurprise()`, no stored field needed — a one-shot action mirroring "Roll
  Initiative," since step 4 is mutually exclusive with step 5's roll) and Combat-Goal-achievement
  Potential (`Encounter.CombatGoalAchieved`, a new boolean, plus a self-serve per-player "mark
  Potential" control — has to be self-serve, since only a sheet's own owner can write it).
- **"No Potential on a 6- in Combat" shipped as a documented no-op, not a suppression mechanic.**
  It's a carve-out from a general "rolls can award Potential on a miss" rule this app has never
  built (the only Potential-on-a-roll mechanic anywhere is Slice 2's Flaw Tags, unconditional and
  untiered) — there is nothing for the carve-out to actually suppress. Recorded in CLAUDE.md/
  README.md rather than silently doing nothing.
- **Boss Last Stand / 1d6-Wounded**: B1's own "left open" instruction ("surface it in the UI as a
  documented assumption") shipped as a literal `InfoTooltip` on the Boss badge row, not a new
  mechanic — exactly what the instruction asked for.
- **Cover, from B1's mapping table, is now real**: `CombatMoveModal.tsx`'s Engage roll calls
  `computeRollBreakdown()` with real `RollExtras` (Slice 2's own mechanism, applied to Combat's
  roll surface for the first time) — Cover counts as an extra Bane against the attacker, and the
  actor's own sheet Boons/Banes are selectable too. Deliberately narrower than full roll-builder
  parity with `MoveRollHelper.tsx`: no Skill/Flaw Tag picker here, since B1 only names Cover.
- **Correction found during the build, not in the original scope: Brace was mismapped.** Slice 1's
  code pushed a Boon for both Calculate *and* Brace — reasonable for Calculate ("+1 forward," which
  a Boon already models) but wrong for Brace ("−1 Strain from everything until your next turn," a
  numeric reduction this app has no timed-buff tracking for). Fixed to log-only, matching Seize/
  Other's own honest treatment, rather than inventing buff-duration tracking to keep the Boon
  mapping technically working.
- **Forced finding, not in the original scope: three raw `<input type="checkbox">` elements at
  13×13px.** `CombatMoveModal.tsx` had no interaction-smoke coverage before this slice added a
  state that actually opens it (`modal: Engage`) — Cover, Rolled-12+, and the two new Boons/Banes
  checkboxes were all under the touch-target floor. Fixed via the shared `CheckboxRow` component.
  A related 5px `.advantageRow` overlap, caught by the same new coverage once the Boons/Banes grid
  used real 44px rows, needed a margin bump (8px → 24px, the same value `VirtuesPanel.module.css`'s
  identical class of bug already settled on).

### Slice 4 — Moves and Camp content (`0.45.0`) ✅

**Shipped `0.45.0`.** All bullets below, plus real findings from the build — recorded here rather
than silently deviating, same discipline slices 1-3's own annotations used:

- All 22 seeded Moves re-authored against `Ruleset-V0.6.md`'s literal text — shipped exactly as
  scoped, plus the two renames (`m-levelup` "Level Up" → "Advance a Motif", `m-journey` "Undertake
  a Journey" → "Set Out", both keeping their existing `Id`) and the new Consequence vocabulary
  (Burdened/Compromised/Delayed/Depleted/Exposed) in Invoke Expertise and Take a Risk.
- Make Camp, Keep Watch, Set Out, Enjoy Downtime and End the Session flows rebuilt — shipped. Keep
  Watch's GM 6- now marks party Rapport (not Potential) and the volunteer roll is fixed to +Wit;
  Enjoy Downtime's Rest/Carouse/Pivot all changed mechanics, not just labels; End the Session's
  entire per-player Hold economy retired in favor of a three-way growth choice.
- **Scoping call, not in the original bullets: the advance-at-next-Camp timing change needed no new
  stored field.** A full track just stops auto-opening its advance picker and instead shows a
  persistent "Ready to advance" trigger, opened manually whenever the player reaches an actual Camp
  — the same track-and-display philosophy this app already applies to Combat and Clocks, rather
  than inventing a new "is the party at Camp right now" session concept.
- **Scoping call: two shared helpers extracted because two call sites needed the identical
  mutation, not speculatively.** `rewriteMotifTag()` backs both the new Camp Action and End the
  Session's new growth option; `applyRecuperateEffect()` (with a `takeStrain` flag) backs both the
  sheet's own Recuperate and Enjoy Downtime's Rest.
- Glossary sweep (add Strain, Boon, Bane, Healing Track, Opposition Clock, Threat Clock,
  Development, Headway, Push Yourself, Set Out; rewrite Status and Advantage; retire or reframe
  Recovery and Scar) — shipped exactly as scoped, plus three entries found stale during the build
  and fixed for the same reason (`g-crumble`, `g-subdued`, `g-unstable` — none in the original
  bullet list, all three still describing pre-slice-1 mechanics a full three releases later).
- **Forced finding, not in the original scope: two `interaction-smoke.mjs` states had gone silently
  stale since `0.42.0`.** "modal: Give a Status"/"modal: Heal a Status" targeted button labels
  slice 1 renamed three releases ago; the script's own "trigger not present, skipped" fallback
  swallowed the miss with zero CI signal the whole time. Renamed to match the real button text
  (`Take Strain…`/`Recuperate…`) after verifying the failure directly, not assuming it from the diff.

Note this slice changes `seedLibrary.ts`, so the live `library` row needs a reset on release —
`HANDOFF.md` open issue 19.

### Slice 5 — Load and identity (`0.46.0`) ✅

**Shipped `0.46.0`.** All bullets below, plus real findings from the build — recorded here rather
than silently deviating, same discipline slices 1-4's own annotations used:

- Wildcard Load boxes per A4 item 2 — shipped exactly as scoped. A new `WildcardDeclaration { Id,
  Text, Persistent }` list on `CharacterSheet.WildcardDeclarations`, each a flat 1 Load; ordinary
  ones return to the ether at Make Camp, Persistent ones (named/magical/plot-relevant) permanently
  consume the box. "Something interesting when a Hero runs out" shipped as a non-blocking reminder
  message, not an invented mechanic — see the scoping call below.
- **Scoping call, not fully specified by A4 item 2: "running out should create problems, not just
  block" ships as a non-blocking UI message, never a formula.** Neither the meeting note nor
  `Ruleset-V0.6.md`'s own text says what the "problem" actually is, and inventing one would be
  exactly the kind of guess this project's discipline forbids — the same treatment Brace's timed
  reduction and Forward/Ongoing bonuses already got. `LoadPanel.tsx` shows "No Load free. You can
  still declare one more item — running out should create a complication, not just a stop. The
  table decides what." once Load reads full, alongside the pre-existing over-capacity warning.
- Light and Heavy Loadouts grant the Inconspicuous Boon and Conspicuous Bane — shipped exactly as
  scoped, via a new `applyLoadTierBoonBane()` (`logic.ts`) synced on every tier switch by exact
  Boon/Bane name.
- **Scoping call: the doc's own "+1 Movement"/"-1 Speed in Combat" clauses, in the same Load
  paragraph as the Boon/Bane grant, are deliberately not modeled.** This slice's own bullet above
  only names the Boon/Bane grant, and this app has no numeric Combat movement/speed stat to attach
  a modifier to in the first place — Range has been theater-of-the-mind bands since Combat was
  first built, a standing design constraint this slice doesn't reopen.
- Pronouns on the sheet and in character creation — shipped exactly as scoped, `Character.
  Pronouns: string`, freeform (no option list in the doc to enumerate), required non-empty the same
  way Name already is.
- **Forced finding, not in the original scope: `Character` is a real Postgres table, not a JSONB
  blob, so `Pronouns` needed an actual migration — the first one this eight-slice plan has
  required.** Every prior slice's new fields lived on `CharacterSheet`/`Party`/`Library` (JSONB
  columns, a TypeScript type change plus a normalize-on-read backfill). `0014_character_pronouns.sql`
  adds `pronouns text not null default ''`, backfilling every existing row in the same statement;
  `repo.ts`'s `mapCharacter()` also falls back `r.pronouns ?? ''` for the window between merge and
  that migration actually running live.
- **Scoping call: no post-creation edit route was added for `Pronouns`.** There has never been one
  for `Name` either — `Character` fields have been write-once-at-creation since character creation
  shipped in `0.7.0` — so this follows the existing "Virtue scores and Theme are read-only, an edit
  affordance needs an explicit repo-owner ask" precedent rather than assuming one's obviously wanted.

Note this slice adds a real migration, `0014_character_pronouns.sql`, which needs applying to the
live Supabase project after merge (CLAUDE.md's "Deployment" section) — it does not touch
`seedLibrary.ts`, so no live-`library` reset is needed this time.

### Slice 6 — Clocks (`0.47.0`) ✅

**Shipped `0.47.0`.** All bullets below, plus real findings from the build — recorded here rather
than silently deviating, same discipline slices 1-5's own annotations used:

- `Basic` → `Opposition` — shipped exactly as scoped, a pure rename with the same mechanic
  unchanged. `Countdown` splits into `Threat` (Goal, Skill Tags, Developments, sized 2-4/4-6/7+ by
  scope) and `Project` (Goal, progressed via the existing 3/2/1-tier flow); `TugOfWar` unchanged;
  `UnlocksClockId`/`isClockLocked()` retire with Linked Clocks — shipped exactly as scoped.
- Threats surfaced on a player-facing board per A4 item 3 — shipped as a GM-only "Promote to Quest
  Board" toggle per Threat, and a Quest Board section on `ClocksPanel.tsx` listing promoted ones.
- **Scoping call, not fully specified by A4 item 3: the Quest Board renders decorative summary
  cards, never a second copy of the full interactive `ClockCard`.** The same Clock already renders
  fully in the ordinary Open list; a second interactive copy would duplicate that card's own
  element ids, a real accessibility bug, not just redundant markup.
- **Scoping call: "the clocks of neglected Threats advancing as the party pursues others" is not
  built.** Neither the meeting note nor `Ruleset-V0.6.md`'s own text specifies how much a neglected
  Threat advances or on what trigger — the doc's own better-specified line ("Threats... advance
  automatically... often when the Heroes Make Camp") was already covered by the existing GM-manual
  Camp Actions advance flow (renamed "Advance a Threat" this slice, now filtered to `Kind ===
  'Threat'`), which needed no new mechanic to satisfy that reading.
- **Scoping call: Developments are plain player-visible text, not GM-only spoiler content.** The
  doc's own "Threats are Countdown Clocks that are player facing" framing settled this — building a
  hidden-until-triggered mechanism would mean reopening the same Realtime-payload-leak problem
  Adventures' GM-only surface exists to avoid, a separate architecture decision this slice's scope
  didn't ask for.
- **Forced finding, not in the original scope: the legacy `'Countdown'`→`'Threat'`/`'Project'` split
  has no honest per-clock mapping, so `normalizeClock()` defaults every legacy Countdown to
  `'Threat'`** — the closer semantic match, rather than guessing per-clock or discarding data. The
  Basic→Opposition half of the rename needed no such default, since it's a lossless rename.

Note this slice touches `seedLibrary.ts`'s glossary array (updating `g-opposition-clock`/
`g-threat-clock`, adding `g-project-clock`), so the live `library` row needs a reset on release —
`HANDOFF.md` open issue 19. It adds no new migration — `Clock` is a JSONB blob field, not a
row-shaped table, so this slice's `ClockKind`/`Goal`/`SkillTags`/`Developments`/`PromotedToBoard`
changes need only the `normalizeClock()` backfill, not a schema change.

### Slice 7 — Party and Bond (`0.48.0`)

Rapport overflow with forfeit-on-early-spend per A4 item 1 — including the UI problem of showing
"10/5" legibly. Party Skill and Weakness Tags become mechanical (blocked on Section D's open
question about their economy — build the storage, fence the multiplier). The Bond spend menu's five
explicit options. Forge a Bond stays fenced at "TO BE DETERMINED".

### Slice 8 — Creating the World (`0.49.0`)

CATS plus the five-step collaborative map build, as a campaign Signup-phase surface. Genuinely new,
and deferrable without blocking anything else — take it last, or drop it if playtest feedback
redirects.

---

## D — What V0.6 does not settle

Do not guess at these in code. Filling one in is separate work that follows a repo-owner decision,
not something to do unprompted because a slice happens to touch the area. Several carry a literal
`??` in the document's own text.

**Closed by V0.6** (these were open under V0.5 and no longer are):

1. **The Level-vs-Tier gate.** V0.6 deletes the contradictory Tier/Level section outright. The DAG
   reading is now the only reading. Closed.
2. **"Shot in the Dark."** Deleted from the document. Closed by deletion.
3. **Recoveries: 6 or 8?** Moot — Recoveries is replaced by the Healing Track.
4. **Does the Status Rank cap of 6 scale with Level?** Moot for Heroes under severity slots. The
   design note survives verbatim only because the Combat chapter was never touched.
5. **"Roll + an appropriate Ability."** Half fixed: Invoke Expertise now says Virtue. **Take a Risk
   still says Ability.**

**Still open, carried forward unchanged:**

6. **Crumble / Fall / Dishonored.** V0.6 still says "you Fall / are Dishonored" in one section and
   "you Crumble" two sections later, with no stated relationship.
7. **The Countdown's five named steps under prose promising six.** Unchanged. `Adventure`
   ships exactly the five named steps and no invented sixth.
8. **The Party Skill Tag economy.** "Do Party Skill Tags only get used once between Camping? Maybe
   they are stronger than Hero? +2? Advantage? Do you start with one for each party member? What
   about weaknesses?" — verbatim, still unanswered, and now *more* pressing, because slice 2 makes
   Hero tags mechanical and party tags would sit right beside them.
9. **"Depleted: expend a resource."** Renamed from Attrition; "resource" is still undefined —
   Wealth, Hold, a Condition mark and an item Charge are all candidates.
10. **"Any rolls made with a Virtue marked with a Condition award 1 Potential (optional??)."** Still
    marked optional. The second of V0.5's two instances was dropped, so at least it now appears once.
11. **Tree Specializations versus Improvement Trees.** The 24-entry list is now labelled "Crows Tree
    Specialization" — an attribution, not a resolution. Still no stated relationship to the 25 trees.
12. **XP versus Potential.** Mostly cleaned up, except Bond spending's "Offer them an **experience
    point** to do what you want."
13. **Subdued's duration**, and whether a downed Hero can be finished off. Unanswered — and now the
    *only* defeat state, so it carries more weight than it did under V0.5.
14. **All 50 seeded Improvements are still placeholders.** V0.6 authors zero tree nodes across all
    25 trees. Party Improvements gains four examples; Bond Improvements is still an empty header.

**New fences V0.6 opens:**

15. **Strain track size.** The document asks itself: "is 5 the right number for these? Could be 3 +
    Mettle? Is there a Body and Mind Strain track, or just one? Depends on what other things will
    ask you to use Strain."
16. **Resist balance.** Nothing makes taking a Status worthwhile versus simply rolling to Resist
    again. Named as a concern in the 2026-09-03 meeting; a resource cost was suggested and not
    decided.
17. **Scene-boundary abuse.** Strain clears at the end of a scene and Recuperate costs Strain, so
    nothing stops a party ending scenes repeatedly to clear Strain and keep healing.
18. **"Need a name for *the* standard roll."** The document asks for a term it does not have. Worth
    an answer — the app has to label that control.
19. **"You typically take a Condition due to….?"** The sentence trails off mid-thought.
20. **Enemy Status Limits under Strain.** `Set Status Limits. !! UPDATE` — Ryan's own marker. Section
    B1 supplies the app's working answer; it is explicitly ours, not the document's.
21. **Recuperate's "Improvement on 12+??"** — an unresolved bracket in the Move text.
22. **"Is 5 the right number for these? Maybe 3 like Act Breaks?"** — asked of the Bond and Rapport
    track lengths.
23. **The "In Some Order" character-creation block** — Party Motif and Quest, a starting Party
    Improvement, starting Camp Assets, the Bond Track, starting Load. This is a TODO list in the
    document, not rules. Character creation cannot be extended to cover it yet.
24. **Forge a Bond's effect: "TO BE DETERMINED."** Literally.
25. **`GameSettings.ConditionFloor`.** V0.6 drops the "(with a floor of −3 total)" clause from the
    Conditions chapter. This reads more like an editing slip than a rules change — the clause simply
    isn't there any more — but it is a deliberate-looking deletion and the app has a live setting for
    it. Flagged, not acted on.

---

## E — The app/UI audit

What each change actually touches, so no slice discovers its own blast radius late.

### Largest rewrites

| Surface | Impact |
|---|---|
| `packages/shared/src/engine.ts` (314 lines) | Roughly half retired, half rewritten. `markRank` / `statusRank` / `reduceRank` survive, serving Strain and enemy tracks. `giveStatus`, `healStatus`, `applyOpposingStatus`, `sortStatuses`, `negativeStatusRankTotal`, `healingSurgeAmount`, `resolveRiskDeath`, `makeScar` retire. `computeRollBreakdown` gains tags, Push Yourself, Boons/Banes and severity penalties. Its `StatusSources` concept — the `0.20.0` fix that separated Status swings from the named Virtue's own modifier — is superseded: under V0.6 only one Status penalty ever applies, and Boons/Banes change the dice rather than the total |
| `features/sheet/StatusesPanel.tsx` (454 lines) | The single biggest UI rewrite in the migration. The three polarity groups become three severity slot rows; the resource row loses Recoveries (and probably Treasure) and gains a Strain track and a Healing Track; the quick-add row's Polarity and Rank inputs become a Severity picker with a required description; Make Camp changes; `ArmorSection`'s meaning changes from Status-negation to Strain-negation. Its container-query and hit-area arithmetic must be re-derived, not scaled |
| `features/combat/EncounterView.tsx` (887 lines) | Strain conversion throughout, plus surprise, the initiative roll, Potential on Goal, Boss Last Stand, Cover-as-Boon, and `PendingStatusOffer` → `PendingStrainOffer` |
| `features/sheet/MoveRollHelper.tsx` | Becomes a real roll builder: pick applicable Skill and Flaw Tags, Push Yourself, Boons and Banes, the highest Status penalty, Aid. `AdvantageTrigger` retires |
| `features/sheet/StatusBoxes.tsx` | Not deleted — its sparse-marking geometry contract *is* the Strain row. Repurpose |

### Moderate

`CombatMoveModal.tsx` (Strain output, Cover as Boon), `ParticipantCard.tsx` (Strain and slot display
for PCs, Strain Limits for enemies), `AddParticipantModal.tsx` (Strain Limits), `ClocksPanel.tsx`
(kind rename, Threat fields, Developments), `LoadPanel.tsx` (wildcard boxes), `AdvancementPanel.tsx`
(Rapport overflow display, the Bond spend menu), `MotifPanel.tsx` (Flaw-invoked Potential marking,
and the full quest-complete and third-Forsake procedures V0.6 spells out but the app only counts).

### Modals

`MakeCampModal` (rewrite), `CampActionsModal` (action list changes), `KeepWatchModal` (Boons; the 6-
marks Rapport), `UndertakeJourneyModal` → **`SetOutModal`**, `EnjoyDowntimeModal` (Rest, Carouse,
Pivot), `EndSessionModal` (three ways to grow replaces the Hold economy entirely), `GiveStatusModal`
→ **`TakeStrainModal`**, `HealStatusModal` → **`RecuperateModal`**, `CrumbleModal` (drop the
Vulnerable-4 grant), `SubduedModal` (retired from the trigger path, per the locked decision).

### Content, schema and admin

All 22 seeded Moves re-authored; two renamed. The 29-term glossary gains Strain, Boon, Bane, Healing
Track, Opposition Clock, Threat Clock, Development, Headway, Push Yourself and Set Out, rewrites
Status and Advantage, and retires or reframes Recovery and Scar. `schema.ts`'s `statusLimits` field
type becomes Strain Limits across `enemies`, `villains` and `npcs`. `SettingsView`'s knobs change as
listed in slice 1. Consider whether Statuses want an authored catalog for the first time — V0.6 gives
worked examples per severity, where V0.5 gave none.

### Data

No new table; every affected shape is a JSONB blob on an already-published table. `normalizeSheet()`
extension and the clean-break decision are covered in B2.

### Untouched

Adventures, Villain/NPC/Location authoring, invites and email delivery, campaign phases and the setup
checklist, the appearance system, the type and spacing scales, and both test harnesses. The
responsive and interaction smoke tests will need re-running heavily, but neither needs new cases
beyond the states slice 1 and 2 add.

---

## Legacy code left stranded

Distinct from Section D's rules questions: this is shipped code whose *doc support* V0.6 removes.
Each needs a decision during the slice that touches it, and each is listed so none goes missing.

- **`CharacterSheet.Level`.** Kept in `0.31.0` only because the vestigial "Level Up" section named
  it. That section is now "Advance a Motif" and names no Level at all. Recommend retiring.
  `Party.PartyLevel` is different: its *increment* also loses doc support, but its *use* survives —
  `campActionsAllowed = PartyLevel + 1` is still in Make Camp — so it stays.
- **`CharacterSheet.Treasure`.** V0.6 mentions Wealth only, and Carouse switched from Treasure to
  Wealth. Zero remaining references anywhere in the document.
- **`CharacterSheet.Hold`'s four spends** (refresh a Gear charge, clear a Condition, mark Bond, mark
  Potential). End the Session no longer grants Hold. Hold survives *only* as Assess the Situation's
  and Discern the Truth's Move Hold, which is spent on questions rather than on those four things.
- **`Clock.UnlocksClockId`** and `isClockLocked()` — Linked Clocks are deleted.
- **`applyCrumbleVulnerable()`** — V0.6 deletes the "you gain *Vulnerable 4*" clause from Crumble in
  Combat. Crumble now only restricts your actions.
- **`Move.AdvantageTrigger`** — the wrong shape once Advantage is general.
- The ranked-model engine functions listed in Section E.

## Verification and paperwork

Docs-only, so most of the release gate does not apply. What does:

1. `npm run typecheck` and `npm run test` still pass untouched — proof nothing was edited by accident.
2. `git diff --stat` confined to `Planning Docs/`, `CLAUDE.md`, `README.md`, `HANDOFF.md`.
3. `Planning Docs/Ruleset-V0.6.md` matches its source byte-for-byte apart from the added header.
4. No document cites `Planning Docs/Ruleset-V0.5.md` at its old top-level path except where
   deliberately framed as history — and then via the archive path.
5. No version bump, no `CHANGELOG.md` entry, no tag. The repo stays at `0.41.0`.

Each of the eight slices, when it runs, follows the normal gate: typecheck, build, test, responsive,
interaction, a version bump across all four `package.json` files, a `CHANGELOG.md` entry, a tag on
the merge commit, and the post-merge confirmation that the deploy reached `live`. Slice 4 changes
`seedLibrary.ts` and so additionally needs the live `library` row reset. No slice is expected to add
a migration file — if one does, it must be applied by hand after merge.
