# Work plan — ruleset V0.5

A new ruleset draft, **A Story of Heroes and Villains V0.5**, has been adopted and now lives at
`Planning Docs/Ruleset-V0.5.md` (1,880 lines plus a repo header). It replaces most of the game the
app currently implements — Statuses, Bonds, Advancement, and Combat all change in some real way,
character identity is rebuilt around a new concept that does not exist today, and four entire
subsystems (Clocks, Party Playbook and Camp, GM-authored Villains/NPCs/Locations, and Adventure
prep) have zero representation in the app at all.

This document is named for the ruleset rather than for a version because no single version covers
the migration the way `WorkPlan-0.24.0.md` and `WorkPlan-0.26.0.md` each covered one release. The
work is staged into nine slices (Section C), each its own version — `0.28.0` through `0.36.0` —
each landing as its own branch, PR, and release. A version-named plan would describe a ninth of the
work and go stale the moment the first slice merged; this plan is the document all nine branches
read before they start, and it stays the shared reference until the last one ships.

**This branch changes documentation only.** No source file is touched, nothing here bumps a
version, and `CHANGELOG.md` is not edited — precedent for a docs-only pass landing at the current
version already exists twice: session 34 landed `WorkPlan-0.26.0.md` while the repo stayed at
`0.25.0`, and session 36 landed `TechStackAudit.md` while it stayed at `0.26.0`. The current version
is `0.27.0`, and it stays `0.27.0` when this branch merges. **None of the nine slices below is built
yet.** This is the plan for work that has not started, not a record of work that has.

V0.5 is adopted as the successor to a document that, on inspection, was never actually in this
repository. `README.md`, `CLAUDE.md`, `HANDOFF.md`, and `CHANGELOG.md` have cited a "14,000+ line
working design doc" in `Planning Docs/` as the authority behind Combat Basics V2.2, Gambits,
Toughness, enemy stat blocks, and the Crumble-into-Dishonored merge, across thirteen versions of
shipped work — and that file has never been committed, verified against `git ls-files`,
deleted-file history, and disk. The largest rules file actually present in the repo before V0.5
landed was `Planning Docs/TheMoves.md`, at 334 lines. That is recorded here as history, not as an
accusation: the decisions made against the missing doc were reasonable calls made in good faith at
the time, they just cited something no later reader could ever open to check them against. V0.5
closes that gap outright by being the one rules document that actually exists in the repository and
that the app can be checked against going forward.

## Decisions already locked

Confirmed with the repo owner before any of the nine slices begin. Do not reopen or re-litigate
these — they are answers, not defaults picked for convenience.

| Decision | Choice |
|---|---|
| Combat geometry | **Keep theater-of-the-mind Range bands.** V0.5 specifies a real map with squares/hexes (Melee = Range 1, Engage at Range = Range 10, Maneuver 6 spaces, Shift 2, enemies move 6, Repel pushes N spaces). The repo owner re-affirmed bands anyway; the grid stays a tabletop concept and slice 5 maps V0.5's space counts onto the existing 5-band ladder in `combat.ts`. `README.md` item 15 stands. |
| Bond track naming | **`Bond` track + `Bond Level`.** Rename `Kin` -> `Bond` throughout the app. V0.5 itself uses "Bond", "Kin", and "Kith" for the same track in three different places; "Kin"/"Kith" there are treated as doc typos (Section D item 1), not as three real names that need reconciling in code. |
| Existing play data | **Clean break.** No JSONB translation logic gets written. Every sheet, party, and Bond currently in Postgres is pre-release test data, wiped as part of slice 1 (Section C). *Done 2026-09-02, after slice 1 merged and deployed rather than as its first act — see the note under Section C.* |
| V0.5's authority | **Canon.** It supersedes the missing external working design doc outright (see above) — where V0.5 is silent, that silence is recorded (Section D), never quietly filled in from somewhere else. |
| Doc layout | **V0.5 canonical; the six old rules files archived, not deleted.** Already done in Wave 0 (see "Sources" below); nothing left for the nine slices to do here beyond not citing a stale path. |
| GM tooling | **All in scope** — Clocks, Villains/NPCs/Locations, and full Adventure prep all get built, just in later slices (6, 8, and 9 respectively). Nothing here is deferred as out of scope for the app; it is deferred as out of scope for *this* slice. |
| First code slice | **Rules primitives** (slice 1), so the wire contract — the shapes every later screen reads — settles before any screen gets rebuilt on top of it. |
| This document's own scope | **Docs only, no bump.** No source file changes, no version bump, no `CHANGELOG.md` entry. Precedent: session 34's `WorkPlan-0.26.0.md` landed while the repo stayed at `0.25.0`; session 36's `TechStackAudit.md` landed while it stayed at `0.26.0`. This plan lands at `0.27.0` and stays there. |

### Sources

Wave 0 — file moves already done, before this plan was written:

- **NEW** `Planning Docs/Ruleset-V0.5.md` — the canonical ruleset, 1,880 lines plus a repo header.
- **NEW** `Planning Docs/archive/README.md` — an archive index explaining what is superseded and
  why.
- **MOVED** `Planning Docs/{TheBasics,TheGear,Advancements,TheMoves,TheSkills,TheArc}.md` to
  `Planning Docs/archive/`, each now carrying a SUPERSEDED banner.
- **MOVED** their six byte-duplicates from
  `Planning Docs/ASoHaVHandoff_extracted/design_handoff_asohav_character_sheet/rules/` to
  `Planning Docs/archive/handoff-rules/`, with a `rules/README.md` stub left behind pointing at the
  archive.
- **MOVED** `Planning Docs/ResponsiveAudit.md` to `ResponsiveAudit.md` at the repo root — it was a
  completed UI engineering audit that had been misfiled among the rules docs, unrelated to this
  migration.

No document written for any of the nine slices below may cite a rules file at its old
`Planning Docs/<name>.md` path, except where deliberately framed as history — and then it must use
the archive path, never the old one.

---

## A — What V0.5 changes

The rules delta falls into three groups: things the app already gets right and must not be
touched, things V0.5 changes from what ships today, and things V0.5 introduces that have no
representation in the app at all. Read this section before writing code for any slice — it is the
actual scope boundary. Section C's slice table only says *when* something lands, not *what kind of
change* it is.

### A1 — Already correct: verify, do not touch

Spot-check every item below during slice 1 and move on. None of them needs a code change, and
"improving" one of these while a slice is working in the area is exactly how a function that is
already rules-correct gets accidentally regressed for no reason at all.

- **Condition penalty: -2 on that Virtue, floored at -3 total.** `effectiveVirtueScore()`
  (`packages/shared/src/logic.ts:28`) computes `score + (conditionMarked ? rollPenalty : 0)`,
  floored at `ConditionFloor` (default `-3`), with `Condition.RollPenalty: -2`. This already
  matches V0.5's wording exactly. Worth stating this plainly and in one place, since it is the kind
  of quiet correctness that is easy to overlook while a dozen other things in the same subsystem
  are changing underneath it — see the Status-Rank change directly below, which touches the same
  file's neighborhood.
- **Bond locks at Level 5 with a full Kin Track.** `isBondLocked()` (`0.17.0`) already enforces
  "once you place your 5th Kin at Bond 5, your Bond Level locks and can not be moved down." The
  Kin -> Bond rename (slice 1) touches this function's *name* and the field it reads, not its
  *behavior* — do not conflate the rename with a logic change while editing it.
- **Toughness: Medium is a flat -2 to the incoming Rank (floored at 1), Heavy re-derives the Rank
  as if the roll had landed one tier lower.** `applyToughness()` already matches both clauses.
- **Enemies are defeated per-Status, not by a shared pool.** `isEnemyDefeated()` checks each of an
  Enemy's `StatusLimits` independently — reaching any single Limit defeats it, even if every other
  tracked Status is still low. This already matches V0.5.
- **Opposite/inverse Status cancellation.** `applyOpposingStatus()` already implements this.
- **Resist reduction: -1 Rank per point of Virtue, +1 more on a 10+.** `resistRollReduction()`
  already matches both parts of the formula.
- **The five standard Virtue arrays.** `STANDARD_VIRTUE_ARRAYS` already matches V0.5's five arrays.
- **Load bands 3/5/6 plus Might.** `loadCapacityFor()`'s `Base + mightScore` formula (confirmed
  addition, not multiplication) already matches.
- **Three Armor types, marking negates a Status outright.** `ArmorSection`'s existing Used-toggle
  behavior already matches this rule as written.

### A2 — Changed by V0.5

Every item below is a real behavior change, not a rename with no consequence — even the ones that
read as small still touch a data shape, a UI, or both, and none of them can be done as a pure find-
and-replace.

- **Status Rank: integer -> a row of marked boxes (slice 1).** Today `CharacterStatus.Rank` is a
  single integer — "magnitude, not a clock," in the app's own prior framing. V0.5 makes Rank the
  highest marked box in a row of boxes: gaining Rank N marks box N *or* the next empty box to the
  right of whatever is already marked, and reducing clears from the top down. The cap is 5; a 6th
  box marked is Subdued. This is a genuine data-shape change (an array of booleans, or an
  equivalent bitset, replacing a plain number) that every renderer and every `giveStatus()`/
  `healStatus()` call site has to be rewritten against, not just relabeled.
- **Dishonored -> Crumble, and it now clears one Condition on trigger (slice 1).** The app's own
  Combat effect for this trigger — a flat Rank-4 negative Vulnerable Status, applied once at the
  false-to-true transition — is already implemented and does not need rebuilding; only the
  trigger's name and its non-Combat side effect (clearing a Condition, which the app does not do
  today) change. `README.md` item 19's narrow scoping of the Vulnerable grant is untouched by this
  rename.
- **Kin -> Bond, everywhere (slice 1).** Not just the field name: `BondChangeType`, both Bond UIs'
  `TYPE_LABELS`, the glossary term, the seed content, and every route and doc that says "Kin" for
  the track (as opposed to the game's `AdvancementTrack` value, which V0.5 does not rename — see
  Section B for exactly where this rename can be missed).
- **Rapport becomes a spendable currency, on top of its existing Advancement role (slice 1).**
  *Aid*: 1 Rapport buys +1 to any roll, spent **after** the dice are rolled, once per teammate,
  stackable across multiple teammates aiding the same roll; the cost doubles to 2 Rapport per +1
  during a Risk Death roll. This is new spend logic layered onto a track that today only ever goes
  up via `EndSessionModal`/Combat-start and down via nothing at all.
- **Advancement -> Improvement, restructured into a prerequisite DAG (slice 4).** 11 Combat trees
  plus 14 Narrative trees (25 total), each entry takeable once, gated on holding either that tree's
  Starting Improvement or another Improvement already held on the same tree. This replaces the
  current flat, tier-gated pick list entirely — not an additive change, a structural one.
- **Advantage/Disadvantage become mechanical again (slice 3) — this reverses `0.20.0`.** `0.20.0`
  deliberately removed `AdvantageToggle.tsx` and its `AdvantageState` because there was nothing for
  the app to actually toggle — Advantage/Disadvantage were a pure table judgment call with no
  detectable trigger, so the app was left with a static `InfoTooltip` explaining the concept
  instead of a control pretending to track it. V0.5 gives it concrete triggers the app *can* detect
  from state it already has or can ask for: Consult the Past with a written record, Follow a Lead
  for 1 Wealth, Venture Forth without having Scouted Ahead. Slice 3 has to decide how those triggers
  surface in the UI — this is new design work, not a revert of the deleted component, since the
  deleted component had no trigger wiring to revert to.
- **Recoveries at 0: take the Exhausted Condition (slice 1).** Today Recoveries just floor at 0
  with no consequence. This adds a real side effect to the sheet's Recoveries stepper.
- **Combat turn order is side-alternating (slice 5).** Roll 2d6; 7+ means Heroes act first; sides
  then alternate picking one unit to act; whichever side is larger acts out its leftover units
  consecutively once the smaller side is exhausted; two Heroes may act together as one pick. Today
  Combat has a single `ActingSide` toggle plus a Round counter and no per-unit ordering at all —
  this is new state, not an adjustment to existing state.
- **AP recharges at the end of that Hero's own turn, not on `startNewRound` (slice 5).** A timing
  change to when Action Points refill, which interacts with the side-alternating order above: AP
  can no longer be reasoned about per-round, only per-unit-turn.
- **Armor in Combat costs 1 AP as a reaction (slice 5).** Today marking Armor Used is free and
  instantaneous; V0.5 gives it an AP cost, which means it now competes with everything else a
  participant can do with their AP on someone else's turn.
- **Combat rolls award no Potential on a miss; all Heroes mark Potential when the Combat Goal is
  achieved (slice 5, tentatively — see Section C).** This is a new Potential-earning trigger tied
  to Combat outcomes rather than to `EndSessionModal`, which is the only place Potential is
  currently earned from anything other than the Advancement picker itself.

### A3 — New in V0.5: nothing exists today

Grouped by the slice each lands in (Section C has the full slice table; this groups the delta list
by destination so it reads as one coherent set per landing rather than one long undifferentiated
list).

**Slice 2 — character identity.** Motifs, three of them per character, replacing Theme entirely:
each Motif carries Skill Tags, Flaw Tags, its own Potential track, a Quest, three Act Breaks, and
three Forsakes. Freeform Skill/Flaw Tags replace today's library-authored Skills and Abilities
lists — a real shift from "pick from an authored catalog" to "write your own," which changes what
Content Admin needs to validate. Unstable at Rank 4 is a new Status-adjacent concept, delivered
here alongside the Status box model even though the rules text groups it with character-facing
Statuses rather than with the box-model mechanics themselves; Behavioral Statuses are also new,
though the brief for this migration does not say which slice they land in — flagged in Open items.

**Slice 3 — Moves, Hold, and Wealth/Treasure.** Hold becomes a first-class mechanic rather than the
narrower "spend Hold on four fixed actions" shape it has today (`EndSessionModal.tsx`'s Hold
spend): specific Moves grant specific Hold amounts (Assess the Situation holds 3, Discern the Truth
holds 2), which is new — today Hold is granted only through End the Session. Ten Basic Moves and
twelve Adventure Moves, most of them new, ship with real result tables rather than reference text
alone. Wealth and Treasure — today a freely adjusted `+`/`-` stepper with no defined earn or spend
mechanic, by explicit `0.18.0` design deferral — gain defined sinks.

**Slice 5 — Combat additions.** Cover is a wholly new Combat concept. Boss enemies are a new Enemy
variant: they act after each Hero's turn (not on the normal side-alternating cadence), draw from
their own Gambit pool, unlock an Unstable-linked ability, and have a Last Stand mechanic at low
Statuses. Two Reaction Moves are new: *Help* and *Resist forced movement* — a genuinely new pair,
distinct from the five Reaction Moves already wired up in `0.16.0` (Opportunity Attack, Interpose,
and three others already shipped).

**Slice 6 — Clocks.** A wholly new subsystem with no prior art in the shipped app: Success/Failure
tracks, Headway measured 1-3, a losing-side spend menu, and layered clocks as the base shape, then
six named variants built on that base — Threat, Project, Progress, Linked, Mission, and
Tug-of-War.

**Slice 7 — Party Playbook and Camp.** A party-level analog to slice 2's per-character identity
work: Party Motif, Party Quest, Party Skill Tags, a Path, and a `PartyLevel`-scoped Level field;
Camp Assets and Camp Actions as authored/trackable entities. Keep Watch, Undertake a Journey (a
two-step Scout Ahead -> Venture Forth flow with GM-chosen complication lists), and Enjoy Downtime
(now seven activities — Rest, Recover, Carouse, Acquire, Train, Pivot, and Advance, two more than
the five named in the app's prior deferral note) all become real guided flows rather than
reference-only Move text.

**Slice 8 — GM stat blocks.** Villains, NPCs, and Locations become authored Content Admin
collections, extending the existing `library.enemies` pattern rather than inventing a new one.

**Slice 9 — Adventures.** The fourth surface in the app (alongside the Character Sheet, Content
Admin, and the Campaign Shell): Adventure prep with a Concept, a Type, a Hook, a linked Villain,
linked NPCs and Locations, floating Secrets, and a Countdown. This is the slice that actually
*uses* slice 8's Villains/NPCs/Locations rather than the slice that defines them — see Open items
for why that split is worth confirming rather than assuming.

---

## B — Migration hazards

Six specific, already-located risks. Each names what breaks and where, so a slice implementer can
grep for the exact thing rather than rediscovering it mid-PR.

1. **`Move.Results`, `Ability.Effects`, and `EnemyTemplate.StatusLimits` are stored as unvalidated
   raw `json` in the admin schema**, not as a real `FieldDef[]`-described shape like every other
   collection field. A tier-structure or result-table change to any of these touches a blob with no
   schema guard at all — a malformed edit in Content Admin saves cleanly and only surfaces as a
   broken render somewhere else, possibly in a different slice's PR. This bites hardest in slice 3
   (new Move result tables replacing the existing ones) and slice 8 (new `EnemyTemplate`-adjacent
   Villain/NPC stat blocks built on the same unvalidated pattern) — worth a deliberate look at
   whether either of those two slices is the moment to give these fields real schema validation,
   without treating that as automatically in scope just because it is convenient timing.
2. **Three declarations must move together for any content-shape change**: the interface in
   `packages/shared/src/types.ts`, the matching `FieldDef[]` in `schema.ts`, and the seed data in
   `seedLibrary.ts`. Forgetting one does not fail loudly — `Quest.StaleAfter` is the live example:
   typed in `types.ts`, never exposed in `schema.ts`, so it has silently had no admin screen since
   it was added. Slice 2 (Quests gain Act Breaks and Forsakes) and slice 3 (Move result tables) are
   the two places this migration is most likely to reproduce that exact drift, since both reshape
   existing content types rather than adding a clean new one.
3. **Hard-coded rule IDs and magic numbers live outside `GameSettings`, and a rename does not fail
   loudly against them.** Specifically: `'ad-p-virtue1'` and `'ad-p-theme'` in
   `AdvancementPicker.tsx`; `'v-might'` in `logic.ts:84`, `LoadPanel`, and `CombatMoveModal`;
   `'v-mettle'` in `StatusesPanel` and `EncounterView`; `isDishonored`'s hardcoded `>= 5`;
   `DEFAULT_ACTION_POINTS` and the engage `5/4/3` · `4/3/2` tables in `combat.ts`; the literal
   string template `AP {ap}/3`; `Rapport {n} / 5` strings; and `Pips count={6}`. None of these
   throws when the thing it names changes — a Virtue rename, a track-length change, or (per slice
   4) a Level/PartyLevel-driven cap all risk silently stopping a comparison from matching rather
   than erroring. Grep this exact list before renaming anything these touch.
4. **The Bond UI exists twice**, in `features/sheet/AdvancementPanel.tsx` and
   `features/campaign/CampaignBonds.tsx`, each with its own separate `TYPE_LABELS`. The Kin -> Bond
   rename (slice 1) has to hit both — a rename applied to only one leaves the other screen showing
   "Kin" in every label and history entry it renders, which is exactly the kind of half-done rename
   that is easy to miss because both screens work fine in isolation; only a side-by-side check
   catches it.
5. **`apps/web/src/harness.tsx` hard-codes bootstrap fixtures.** Every slice below changes at least
   one of `CharacterSheet`, `Party`, `Bond`, or `Library` — which is nearly all of them — and any
   such change breaks the screenshot script and the responsive smoke test's harness until the
   fixtures are updated in the same commit. `npm run typecheck` catches a shape mismatch loudly and
   immediately, which is the good case; the bad case is a fixture that still typechecks but no
   longer represents realistic V0.5 data, which nothing catches automatically. Update the harness
   fixtures in the same commit as the type change, not as a follow-up.
6. **`loadTiers` is consumed by `LoadPanel` but is absent from `schema.ts`'s `collections` array**,
   so it has no admin screen today. This predates V0.5 and is not one of the nine slices' jobs to
   fix on its own — but any slice that touches Load content (none of the nine are currently scoped
   to do so, but Section E flags this same gap as an undocumented one) inherits a collection with
   no way to edit it through Content Admin, only through a raw seed or migration edit.

---

## C — The nine slices

These slice numbers, versions, and contents are fixed — reference them freely from other documents
and don't renumber them here.

**Status: slices 1-8 are done.** Only slice 9 is unbuilt. Keep this line current as
slices land — a future session's first question about this document is which slices it still
describes as future work, and a plan that answers that wrongly is worse than one that doesn't
answer it at all.

| Slice | Version | Contents |
|---|---|---|
| **1. Rules primitives** ✅ | `0.28.0` | **Shipped 2026-09-02.** Status box model; Crumble rename + clear-a-Condition; Unstable at Rank 4; Recoveries-0 -> Exhausted; Kin->Bond rename (types, routes, both Bond UIs, glossary, seed); Rapport as Aid currency. Settles the wire contract. Clean-break data wipe done. |
| **2. Character identity** ✅ | `0.29.0` | **Shipped 2026-09-02.** Motifs x3, Skill/Flaw Tags, per-Motif Potential, Quests with Act Breaks/Forsakes. Retired Theme/Quest/Skill/Ability catalog; rewrote Background and `CreateCharacterPage.tsx`; shipped the 13 Motifs and their tag example lists. |
| **3. Moves & glossary** ✅ | `0.30.0` | **Shipped 2026-09-02.** All 22 V0.5 Moves seeded with schema-validated result tables; Hold granted mechanically by the two Moves that name a number (Assess the Situation, Discern the Truth); Advantage/Disadvantage re-mechanised for the two triggers reachable from this slice's own scope (Follow a Lead's Wealth spend, Consult the Past's self-report); Wealth/Treasure named per Move text. Four Adventure Moves (Make Camp, Keep Watch, Undertake a Journey, Enjoy Downtime) ship as reference text only — their guided flows are slice 7's — see the slice-3 note below. |
| **4. Improvements** ✅ | `0.31.0` | **Shipped 2026-09-02.** Advancement->Improvement rename; 25 Hero Improvement Trees (11 Combat + 14 Narrative) with a real prerequisite DAG; `Level`/`PartyLevel` fields. Gating is DAG-only, no tier/Level — see the slice-4 note below for why. Trees carry placeholder nodes only (V0.5 names them, authors none); Party/Bond Improvements stayed out of scope (no tree names in the source at all). |
| **5. Combat update** ✅ | `0.32.0` | **Shipped 2026-09-03.** Per-unit turn order (`ActingParticipantId`/`PairedParticipantId`, `endTurn()`/`nextActor()` — a GM-overridable suggestion, not an enforced sequence); Repel automated, Resist wired as the last unbuilt Reaction Move; Cover Status picker; minimal Boss-Enemy wiring (`IsBoss`/`GambitCharges`, derived Last-Stand badge); the two-branch entering-Combat Rapport modifier; band-mapping of V0.5's space counts documented in `combat.ts`. Armor-costs-AP and Help turned out to already be shipped — see the slice-5 note below. |
| **6. Clocks** ✅ | `0.33.0` | **Shipped 2026-09-03.** Collapsed to three `Kind`s (`Basic`/`Countdown`/`TugOfWar`) rather than six shapes — see the slice-6 note below. Success/Failure tracks and Headway 1-3 for Basic; a GM-ticked single track for Countdown/TugOfWar (covering Threat/Quest/Mission/Progress/Long-Term-Project); Linked Clocks as an `UnlocksClockId` reference, not a fourth Kind; the losing-side spend menu freeform/logged. New `clocks` table (migration `0011`), same Realtime/RLS shape as `combat_encounters`. |
| **7. Party Playbook & Camp** ✅ | `0.34.0` | **Shipped 2026-09-03.** Party Motif/Quest/Skill Tags/Weakness Tags/Path/Goal (freeform — no Party Playbook catalog exists); Camp Assets as a hybrid catalog-or-freeform pick (`CampAssetTemplate` + `<datalist>`-backed `AddCampAssetModal.tsx`); Make Camp, Keep Watch, Undertake a Journey, Enjoy Downtime as real guided flows. `PartyLevel` already existed (slice 4); no separate party-scoped Level field was needed. |
| **8. GM stat blocks** ✅ | `0.35.0` | **Shipped 2026-09-03.** Villains, NPCs and Locations as three new, ordinary schema-driven Content Admin collections, extending `library.enemies`. `EnemyTemplate.StatusLimits` retrofitted off raw `json` onto the same new `statusLimits` field type, closing Section B hazard 1 for Enemies too. Authored content only — no Combat-spawn bridge for Villains. |
| **9. Adventures** | `0.36.0` | The fourth surface: Adventure prep with Concept/Type/Hook, floating Secrets, Countdowns. |

**Slice 4 was the only hard dependency in this list, and it's resolved now.** Everything else is
sequential — each slice builds on the wire contract the previous ones settled. Slice 4 was blocked
until the repo owner answered the Level-vs-Tier question (Section D item 3, HANDOFF open issue 12);
see the slice-4 note below for how that landed. **Slice 1 is where the clean-break data wipe
happens** — it is the slice that changes `CharacterSheet`/`Bond`/`Party` shapes in ways with no
translation path, so it is also the one moment in this whole migration where existing Postgres rows
are deliberately destroyed rather than migrated forward.

**Slice 1 — Rules primitives.** Delivers the Status box model, the Crumble rename with its new
Condition-clear side effect, Unstable at Rank 4, the Recoveries-0-grants-Exhausted rule, the full
Kin -> Bond rename (Section B hazard 4 names exactly where this is easy to half-finish), and
Rapport-as-Aid. Depends on nothing upstream — it is the slice that *creates* the dependency every
later slice reads from. Done looks like: every sheet, party, and Bond row in Postgres wiped; a
fresh campaign exercising the box-model Status UI end to end; every hard-coded `'Kin'`/`Kin`-labeled
string found via the Section B hazard list gone or deliberately left with a documented reason;
`harness.tsx` fixtures updated in the same commit; and the `> **V0.5:** ... not built.` markers in
`CLAUDE.md`/`README.md` for everything this slice ships flipped to a real, shipped description.

> **How slice 1 actually landed (2026-09-02), for the eight slices that follow it.** The code all
> shipped as `0.28.0`, and the wipe ran. **The one "done looks like" item above that did *not*
> happen is the end-to-end UI exercise** — no campaign or character has been created against the
> box-model Status UI yet, so nothing in this slice has run in a real browser (HANDOFF open issue
> 11). Treat that as outstanding, not as quietly satisfied. Three further things went differently
> than planned, and each generalises:
>
> - **The wipe ran after the merge and deploy, not as the slice's first act.** Wiping first would
>   have left the running app reading rows in a shape it couldn't parse; wiping last meant the new
>   shapes were live before anything wrote data in them again. Do it in that order for any later
>   slice that breaks stored shapes. The mechanism was a single campaign-level `delete` — every
>   play-state table cascades from `campaigns` — not the Content Admin path this plan originally
>   named.
> - **The merge's auto-deploy failed silently.** It built, then crashed on boot, and Render kept the
>   previous build live while `main`, CI and the PR all looked green. **Verify every slice's deploy
>   actually reaches `live`** — the `release-reliability-checklist` skill now carries this as an
>   explicit post-merge step. See HANDOFF open issue 18 for the underlying bug.
> - **The live `library` row went stale and nothing warned about it.** `runSeedIfEmpty()` skips a
>   library that already exists, so slice 1's seed changes never reached the live row — leaving the
>   app's headline new mechanic with no glossary definition. **Every later slice that touches
>   `seedLibrary()` needs "reset the live library" as an explicit step** (Content Admin -> Data ->
>   "Reset to seed"). HANDOFF open issue 19.

**Slice 2 — Character identity.** Delivers the three Motifs replacing Theme, freeform Skill/Flaw
Tags replacing library-authored Skills and Abilities, per-Motif Potential, and Quests with Act
Breaks and Forsakes; rewrites the Background and Abilities panels and `CreateCharacterPage.tsx`.
Depends on slice 1's settled `CharacterSheet`/Bond shapes, since Background and character creation
both already read Bond-adjacent fields. Done looks like: the 13 Motifs and their tag example lists
seeded in the library; a new character created end to end through `CreateCharacterPage.tsx`
picking a Motif, its Tags, and a starting Quest with Act Breaks/Forsakes attached; and the fate of
`ThemePanel.tsx`/`LooksPanel.tsx` (folded into a Motif-shaped replacement, or removed outright)
decided and recorded rather than left ambiguous — this plan does not prescribe which, see Open
items.

**Slice 3 — Moves & glossary.** Delivers the 10 Basic and 12 Adventure Moves with real result
tables, Hold as a first-class per-Move mechanic, a re-mechanised Advantage/Disadvantage with real
triggers, defined Wealth/Treasure sinks, and a glossary rebuilt against V0.5's vocabulary. Depends
on slice 1 (Bond naming, Rapport-as-Aid, since Move text references both) and slice 2 (Motif Skill/
Flaw Tags, which some Move triggers plausibly reference) — sequentially, not as a hard block. Done
looks like: 22 Move entries seeded with schema-validated result tables (Section B hazard 1 flags
exactly why "validated" is worth stating rather than assuming); a working Advantage/Disadvantage
trigger surfaced in the UI at both existing render sites (`MoveRollHelper.tsx`,
`CombatMoveModal.tsx`); and every glossary term tied to a retired V0.4-era concept (the standalone
"Kin" term, "Theme," the old flat Advancement track) either updated or retired, with no dangling
term left resolving to pre-V0.5 text.

> **How slice 3 actually landed (2026-09-02).** Scope was narrowed against four repo-owner
> decisions locked before code, the same "decide, don't guess" pattern slice 1 used:
>
> - **Four of the 12 Adventure Moves (Make Camp, Keep Watch, Undertake a Journey, Enjoy Downtime)
>   ship as reference-text library entries only** — real result tables, schema-validated like every
>   other Move, but no new guided-flow UI. That's explicitly slice 7's job (Party Playbook & Camp).
>   Keep Watch and Undertake a Journey are each genuinely two rolls (a GM roll then a player roll;
>   Scout Ahead then Venture Forth) that don't fit one Move's single `Results` slot — their second
>   roll's outcomes are written into `Description` as prose rather than invented as a second Move
>   not named in V0.5's own 22.
> - **`Move.Results`/`PlayerVariantResults` gained real schema validation**, closing Section B
>   hazard 1 for Moves specifically (not for `Ability.Effects`/`EnemyTemplate.StatusLimits`, which
>   stay raw `json` — Abilities are retired, and `EnemyTemplate` wasn't touched this slice). A new
>   `moveResults` `FieldType` replaces the old raw-`json` field in `schema.ts`, with a structured
>   Tier3/Tier2/Tier1 editor in `FieldEditor.tsx` and shape validation (`Description` required,
>   `ChooseCount` can't exceed the listed `Options`) in `adminLogic.ts`'s `validateLibrary()`.
> - **Hold is granted mechanically only for the two Moves whose grant is a literal number**
>   (Assess the Situation, Discern the Truth) — a new typed `Move.HoldGrant` field plus
>   `holdGrantForTier()` (`engine.ts`), wired into `MoveRollHelper.tsx` as a "report which tier you
>   hit" control that adds directly to `CharacterSheet.Hold`. A tier that offers a *choice* of how
>   much Hold to take (Assess the Situation's 7-9: "hold 1, or hold 2 and choose one complication")
>   is represented by its guaranteed minimum — the extra Hold from taking the complication stays
>   the player's own call, same as every other optional consequence this app leaves as reference
>   text. `CharacterSheet.Hold` also became visible outside `EndSessionModal` for the first time —
>   a read-only readout in `StatusesPanel.tsx`'s resource row, since it can now change mid-session.
> - **Advantage/Disadvantage got real state only where this slice's own scope gives the app
>   something to detect.** A new `Move.AdvantageTrigger` (`'wealthSpend' | 'selfReport'`) drives
>   `MoveRollHelper.tsx`: Follow a Lead spends 1 Wealth for a real Advantage flag; Consult the Past
>   sets it from a self-reported "I have a written record" checkbox. V0.5's third named trigger
>   (Venture Forth without Scouting Ahead) has **no roll UI to attach to yet**, since Undertake a
>   Journey ships as reference text this slice — deferred to slice 7 alongside that Move's guided
>   flow, not silently dropped. Every other Move keeps the informational-only tooltip from `0.20.0`.
>
> As with slice 1, this has **not been live-verified in a real browser** (open issue 11) — the
> responsive smoke test and unit suites are the automated coverage this session could run.

**Slice 4 — Improvements.** Delivers the Advancement -> Improvement rename, the 11 Combat + 14
Narrative tree structure with a real prerequisite DAG, and `Level`/`PartyLevel` fields.

> **How slice 4 actually landed (2026-09-02).** Two decisions were put to the repo owner before any
> code, the same "decide, don't guess" pattern slices 1 and 3 used:
>
> - **The Level-vs-Tier gate (Section D item 3) resolved to DAG-only — no Tier, no Level.**
>   `Ruleset-V0.5.md` states the gating rule twice and the two contradict each other: "Motif
>   Advancement — Potential" (the section this app was already built against since slice 2) gates
>   purely on the prerequisite chain, no Tier or Level mentioned; a separate "Level Up"/"Progress
>   the Party" section (under Make Camp) states the old `Advancements.md` Tier-1..4-and-Level
>   formula verbatim, contradiction included. Put both readings to the repo owner directly rather
>   than guessing: the Tier/Level section is leftover, unreconciled draft text, and gating is
>   DAG-only via `improvementState()` (`packages/shared/src/logic.ts`) — a Starting Improvement on
>   any tree, or one connected to an Improvement already held on that same tree. `Level`/
>   `PartyLevel` still exist as plain running counters (both doc sections agree something called
>   Level should go up) but gate nothing — a deliberate half-adoption of a self-contradictory rule,
>   recorded in `README.md` item 30 and `HANDOFF.md` open issue 12, not a placeholder to revisit.
> - **A second, deeper gap surfaced while trying to seed the 25 trees to test the DAG against:**
>   `Ruleset-V0.5.md` names all 25 Hero Improvement Trees with a one-line theme each but authors
>   **zero actual nodes** on any of them — no Starting Improvement, no prerequisite line, nothing.
>   Also put to the repo owner rather than invented: **build the real mechanism now against
>   clearly-labeled placeholder nodes** — every tree gets a Starting Improvement plus one node
>   chained to it, `Effect` text reading "Placeholder…", enough to exercise the DAG gate and its
>   admin validation end to end without pretending unwritten game design is real.
> - **Party and Bond Improvements stayed out of scope entirely — not a Tier/DAG question, a content
>   one.** "Party Motif + Improvements" and "Bond Track + Improvements" are each one line ("Here
>   that is!") with no tree names at all, unlike Hero's 25 — there's nothing to even placeholder.
>   Party's other two "Party Advancement — Rapport" options (Skill/Weakness Tags) also need a Party
>   Motif data model this app doesn't have (that's slice 7's "Party Playbook"). So a full Rapport
>   track now just clears via a plain `ConfirmModal` and raises `PartyLevel` by one
>   (`clearRapportForPartyLevel()`, `logic.ts`) instead of opening a picker with nothing real to
>   offer. This corrects a prior assumption (`README.md` item 8, from the `0.28.0`-era session) that
>   V0.5 would add "tiered Bond Improvements keyed to Bond Level" — that was an inference from the
>   section header, and the section's actual content doesn't support it.
>
> Done looks like: 25 trees (11 + 14) seeded, each with a Starting Improvement and one chained
> placeholder node, validated by `validateImprovementDag()` (`apps/server/src/adminLogic.ts` — no
> cross-tree prerequisites, no cycles, every non-Starting Improvement reachable from a Starting
> Improvement on its own tree); `Level`/`PartyLevel` present on `CharacterSheet`/`Party` with a
> read-time default for existing rows (`normalizeSheet()`/`normalizeParty()`, the latter new this
> slice); the Motif "Gain a Hero Improvement" option wired to a real `ImprovementTreePicker.tsx`
> instead of a disabled stub; Content Admin's nav/list/validation panels covering both new
> collections generically, the same schema-driven pattern every other collection uses. As with
> slices 1-3, this has **not been live-verified in a real browser** (open issue 11) — the
> responsive smoke test and unit suites are the automated coverage this session could run.

**Slice 5 — Combat update.** Delivers side-alternating turn order, AP recharge moved to the end of
each Hero's own turn, the Help and Resist-forced-movement reactions, Cover, Boss enemies, Armor
costing 1 AP as a reaction, the two entering-Combat Rapport modifiers V0.5 confirms (HANDOFF open
issue 13: +1 more if all Heroes share the same goal for the fight, -1 if the party is ill-prepared
or off-balance), and a documented mapping of V0.5's space-count rules onto the existing 5-band
Range ladder, per the locked "keep bands" decision. Depends on slice 1's Status box model, since
Cover and Boss mechanics both interact with Statuses directly. Done looks like: every item in
Section A2's Combat-changed list reflected in `combat.ts`/`EncounterView.tsx`; the two Rapport
modifiers wired into `POST /combat/start` (already the location of the existing +1-Rapport bump per
HANDOFF issue 13); and the band-mapping arithmetic written as an explicit comment in `combat.ts`,
not left implicit the way `shiftRange()`'s existing simplification already is.

> **How slice 5 actually landed (2026-09-03), for the four slices that follow it.** Two items in
> Section A2's Combat-changed list turned out to already be shipped by the time an Explore agent
> went looking for them before writing any code: **Armor already costs 1 AP in Combat** (`defend()`,
> since `0.16.0`) and **Help was already fully wired** (`0.18.0`) — both of `CLAUDE.md`'s "not
> built" claims for these were stale text, not accurate gaps. That correction, plus three real scope
> decisions, all went to the repo owner via `AskUserQuestion` before any code (same discipline
> slice 4's own note below used):
>
> 1. **Boss Enemies get minimal wiring, not a full mechanism.** The doc's Boss abilities are bespoke
>    per-boss flavor text with no shared formula to extract — the same "author real content later,
>    build the plumbing now" call slice 4 made for its 25 placeholder Improvement Trees.
>    `IsBoss`/`GambitCharges` on `CombatParticipant`/`EnemyTemplate`, a derived Last-Stand badge
>    reusing `isEnemyDefeated` (no new stored flag), and a manual "Boss Acts" button — the abilities
>    themselves stay freeform GM narration.
> 2. **Turn order is a GM-overridable suggestion (`nextActor()`), not an enforced side-alternating
>    algorithm.** `Encounter.ActingParticipantId`/`PairedParticipantId` hold the actual state; the
>    GM can set either to anyone at any time via two selects in `EncounterView.tsx`'s header,
>    consistent with Combat's whole track-and-display design rather than a new exception to it.
> 3. **Repel is automated, reversing the `0.15.0` decision** (`README.md` item 16) to leave it
>    freeform — that decision's own stated reason no longer held once this slice needed a real
>    space-to-band ratio anyway (see `shiftRange()`'s expanded doc comment). Resist — the one
>    Reaction Move genuinely missing — was built as a standalone, self-reported Reactions-section
>    button rather than a new `PendingStatusOffer`-shaped async type: Range isn't ownership-gated
>    the way Statuses are, so a second async round trip would have been scope with no correctness
>    benefit. See `README.md` item 31 for the one place this deviated from the plan drafted for it.
>
> Cover shipped as planned (`CombatMoveModal.tsx`'s Positive-Status picker, deliberately not
> name-matched against "Cover"/"Hidden"/"Invisible" — `README.md` item 32). **As with slices 1-4,
> this has not been live-verified in a real browser** (open issue 11) — the responsive smoke test
> and unit suites are the automated coverage this session could run.

**Slice 6 — Clocks.** Delivers Success/Failure tracks, Headway 1-3, the losing-side spend menu, and
layered clocks as the base shape, then the six named variants (Threat, Project, Progress, Linked,
Mission, Tug-of-War) built on it. This is the first genuinely new play-state subsystem since Combat
shipped in `0.14.0`-`0.16.0`, and deserves the same care Combat got: a real `types.ts` shape, a
migration if it needs Realtime sync of its own (following the "give it a `campaign_id` column and a
matching, joinless SELECT policy" pattern `CLAUDE.md` documents), not a JSONB-field bolt-on. Depends
sequentially on slices 1-5; no stated hard block. Done looks like: a base Clock type that covers
Success/Failure, Headway, and the spend menu; each of the six variants either sharing that base type
behind a variant flag, or documented with a specific reason it needs its own shape instead.

> **How slice 6 actually landed (2026-09-03).** The "done looks like" bar above already sanctioned
> collapsing the six named variants behind a flag — what it didn't settle was *how many* flags, or
> whether Threat and Quest (which `Ruleset-V0.5.md` explicitly asks itself "are these the same
> thing?" about, unanswered) should be one Kind or two. Put to the repo owner as a concrete
> proposal via `AskUserQuestion` rather than assumed: **three `Kind`s** — `Basic` (the only variant
> with a complete mechanic: Success/Failure tracks, Headway 1-3, the 10+/7-9/6- table), `Countdown`
> (Threat/Quest/Mission/Progress/Long-Term-Project collapsed into one GM-ticked single track, since
> the doc gives none of the five any mechanical difference from the others), and `TugOfWar`
> (Countdown's track, allowed to also move down). Confirmed as the recommended option. Linked
> Clocks stayed a reference field (`UnlocksClockId`) rather than a fourth Kind, exactly as
> "done looks like" anticipated.
>
> A second decision, not anticipated by this plan's own text: the losing-side spend menu names
> "Advantage/Disadvantage Forward" as two of its four options, and V0.5 uses "Forward" elsewhere
> (Discern the Truth) to mean a bonus scoped to the very next roll — a concept this app has never
> tracked across rolls. Building it for real would need a new persisted per-character
> pending-roll-modifier mechanic, well beyond what a Clocks slice should be taking on. Put to the
> repo owner rather than assumed: keep the whole spend menu freeform and logged, same treatment as
> Combat's own Seize/Other Gambits. See `README.md` items 35-36 for the full writeup of both calls.
>
> **What shipped**: `Clock`/`ClockKind`/`ClockHistoryEntry` (`packages/shared/src/types.ts`);
> `applyClockRoll()`/`tickClock()`/`clockOutcome()`/`isClockFull()`/`isClockLocked()`
> (`packages/shared/src/clocks.ts`, unit-tested); a new `clocks` table (migration `0011`, same
> Realtime/RLS shape `combat_encounters` established); `ClocksPanel.tsx`
> (`apps/web/src/features/clocks/`), lazy-loaded from `CampaignPage.tsx` exactly like `CombatPanel`
> to protect the bundle budget — which is now down to under 1 kB of headroom (207.13 kB gzip vs.
> the 208 kB cap) and needs active attention from whichever slice touches the main bundle next.
> **As with slices 1-5, this has not been live-verified in a real browser** (open issue 11) — the
> responsive smoke test and unit suites are the automated coverage this session could run.

**Slice 7 — Party Playbook & Camp.** Delivers Party Motif, Party Quest, Party Skill Tags, a Path,
and the party's own `Level`; Camp Assets and Camp Actions; and turns Make Camp, Keep Watch,
Undertake a Journey, and Enjoy Downtime into real guided flows instead of reference-only Move text.
Depends on slice 4's `PartyLevel` field (Party Playbook's own Level is presumably the same field,
though this plan has not confirmed that reading with the repo owner — see Open items) and on
slice 2's per-character Motif pattern, which this generalizes to the party level. Done looks like:
`CLAUDE.md`'s current framing of Undertake a Journey and Enjoy Downtime as "deliberately deferred,
no dedicated UI" replaced outright with a description of the shipped flow, not left standing
alongside it — the `0.18.0`-era reason for deferring both (whether either needs guided UI beyond
Move-text reference) no longer holds once V0.5 fully specifies them (Section D item 16).

> **How slice 7 actually landed (2026-09-03).** `PartyLevel` turned out to already exist (slice 4)
> and needed no separate party-scoped field — this plan's own "presumably the same field, not
> confirmed" note above resolved itself once code was actually checked, the same lesson slice 5
> learned about Armor/Help. Three real scope decisions went to the repo owner via
> `AskUserQuestion` before any code, the same "decide, don't guess" discipline every slice since 1
> has used:
>
> - **Camp Assets are a hybrid catalog-or-freeform pick**, not a straight choice between this
>   app's two existing authored-content shapes. A pure library pick (`library.motifs`-style) can't
>   let a table write their own on the spot; Combat's ad-hoc-or-library `AddParticipantModal.tsx`
>   pattern carries an admin-only "save to library" option this flow shouldn't inherit, since any
>   player (not just a GM who may also hold an admin account) can run Make Camp. The repo owner's
>   own suggestion — an autocomplete-style field, freeSolo — became a plain text input backed by a
>   native `<datalist>` of `library.campAssets` names: matching a catalog name autofills and links
>   `RefId`; anything else stays a fully custom, ad-hoc entry. No new dependency, no combobox
>   library.
> - **"Progress a Personal Project Clock" wires to the real Clocks subsystem** (`tickClock()`),
>   confirmed rather than left a freeform logged note — Clocks aren't ownership-gated the way
>   Statuses are, so there was no correctness reason to invent a separate "personal" Clock concept.
> - **Party Motif/Quest/SkillTags/Path/Goal are freeform text**, not picked from any catalog — the
>   doc gives no structured content for these (unlike Hero Motifs' 13 canonical options), so
>   inventing a catalog would be exactly the kind of guessed-at resolution this migration's whole
>   discipline exists to avoid.
>
> A fourth thing surfaced after this slice shipped, from the repo owner directly rather than from
> code: **Playbooks are cut from the game's systems entirely**, not merely unwritten yet as the
> doc's own "Hero Moves and Playbooks... Coming Soon" text implied. This slice's own name stopped
> using "Party Playbook" in every living doc as a result — nothing it built ever implemented an
> actual Playbook mechanic, it's freeform party identity data that happened to ship under that name
> — and Hero Moves, which had no other stated foundation in the doc, are now cut alongside
> Playbooks rather than left blocked on a system that was never coming. See "Known gaps in V0.5"
> item 15 below and `HANDOFF.md`'s matching correction note for the full writeup.
>
> A fifth thing surfaced mid-build, not from a decision but from nearly making a mistake: this
> slice's first pass toward Make Camp started re-implementing personal-resource clearing (Status
> Rank reduction, Armor refresh, Recoveries refill) before discovering `StatusesPanel.tsx` already
> had a working "Make Camp" button (`MakeCampModal.tsx`) doing exactly that, predating this slice
> entirely. What actually shipped as new — Bad Guy Clock advancement, an eligibility reminder, and
> the doc's Camp Actions — lives in a separately-named `CampActionsModal.tsx` behind its own "Camp
> Actions" button, deliberately not reusing the "Make Camp" label for a second, different modal.
> **Two Keep Watch/Combat-adjacent results name a Status landed on a party member other than the
> roller** ("one party member wakes with Restless 2," "you're alert" for a volunteer) — this app
> has no `PendingStatusOffer`-style mechanism outside Combat, so per the same "don't build a second
> async offer type without a correctness reason" judgment slice 5 used for Resist, these narrow to
> the viewer's own sheet only; the narrative-only options are logged instead. **As with slices 1-6,
> this has not been live-verified in a real browser** (open issue 11) — the responsive smoke test
> and unit suites are the automated coverage this session could run. Lazy-loading `PartyPlaybookPanel`
> (always-rendered, no render condition) alongside the four rarely-opened guided-flow modals kept
> the bundle under budget after a real, necessary content increase — see `CLAUDE.md`'s Party
> Playbook & Camp section for the exact numbers and the budget-policy citation that justified
> raising the cap rather than treating it as a regression.

**Slice 8 — GM stat blocks.** Delivers Villains, NPCs, and Locations as real Content Admin
collections, extending the existing `library.enemies` pattern. Depends on slice 1's
`EnemyTemplate.StatusLimits` shape, which Section B hazard 1 already flags as unvalidated raw
`json` — this slice is the most likely place that hazard actually bites, since it adds three new
authored-entity types on the same pattern rather than reshaping an existing one. Done looks like:
three new entries in `schema.ts`'s `collections` array, each with a real `FieldDef[]` (not raw
`json`) for at least the new fields this slice introduces, even if fully resolving hazard 1 for
`Move.Results`/`Ability.Effects` elsewhere stays out of scope for this slice specifically.

> **How slice 8 actually landed (2026-09-03).** Unlike every slice since 4, this one needed no
> `AskUserQuestion` round with the repo owner — `Ruleset-V0.5.md`'s own "Villain"/"NPCs"/"Locations"
> subsections and this plan's own "extending the existing `library.enemies` pattern" scope statement
> were specific enough to build against directly, with no rules ambiguity or content gap to resolve
> first (contrast slice 4's Level-vs-Tier question, or slice 6's six-variants-to-three-Kinds call).
>
> **What shipped**: `Villain`, `NPC` (+ `NPCType`), `Location` (+ `LocationType`)
> (`packages/shared/src/types.ts`), each with a real `FieldDef[]` in `schema.ts` — three ordinary
> schema-driven collections riding Content Admin's existing generic CRUD/validation/nav machinery
> for free, the same "zero new plumbing beyond a `schema.ts` entry" precedent `CampAssetTemplate`
> set in slice 7. This slice's one real engineering decision, beyond exactly what "done looks like"
> above asked for: a new `statusLimits` `FieldType` (`StatusLimitsEditor` in `FieldEditor.tsx`, a
> repeatable `{StatusName, Limit}` row editor, plus shape validation in `adminLogic.ts`) was built
> once for `Villain`/`NPC`'s own Status Limits fields and then also applied to the pre-existing
> `EnemyTemplate.StatusLimits` — fully resolving Section B hazard 1's Enemy half (`Move.Results` was
> already resolved in slice 3; `Ability.Effects` is moot, Abilities were retired in slice 2), not
> just the two new collections' share of it. **Deliberately not built**: any bridge from
> `library.villains` into a live Combat Encounter — `Villain` reuses `ToughnessTier`/
> `EnemyStatusLimit` so the data shape would line up if a later slice wants one, but spawning a
> Villain as a Boss `CombatParticipant` is new scope this slice's own "authored Content Admin
> collections" framing doesn't ask for. Seed content (one Villain, two NPCs, three Locations) is
> drawn from `Ruleset-V0.5.md`'s own worked Grizza-the-Tall example and the Concept/Hook text
> introducing her, not invented from scratch. As with slices 1-7, **this has not been live-verified
> in a real browser** (open issue 11) — the responsive smoke test (scoped to the `content admin`
> route) and unit suites are the automated coverage this session could run.

**Slice 9 — Adventures.** Delivers the fourth surface: Adventure prep with Concept, Type, Hook, a
linked Villain, linked NPCs and Locations, floating Secrets, and a Countdown. Depends on slice 8's
Villain/NPC/Location collections (an Adventure references them, it does not redefine them) and
slice 6's Clocks (a Countdown is a clock variant — Section D item 12's "five steps, prose promises
six" inconsistency should be carried into this slice's content unresolved, not silently fixed by
picking one). Done looks like: a GM authoring one Adventure end to end that references existing
Villains/NPCs/Locations and includes a working Countdown; and `CLAUDE.md`'s "What this is" opening
section updated to describe four surfaces instead of three, since that section is explicitly
maintained as the app's own self-description.

---

## D — What V0.5 does not settle

The ruleset draft itself is not internally consistent everywhere. These sixteen items are gaps,
contradictions, or open design questions **in the source document**, not in this app's
implementation of it. The job for every slice above is to record these, not to guess at an answer
and quietly bake a resolution into code — a resolution invented by an implementing session would
be indistinguishable from an actual rule six months later, and wrong just as often as right.

1. **Bond / Kin / Kith** name one track in three places in the ruleset text. Resolved for code —
   `Bond` — by the locked decision above; the ruleset document itself still needs a sweep, which is
   not this app's job to perform.
2. **Crumble / Fall / Dishonored** all name the same trigger, in adjacent sections of the doc.
3. **RESOLVED for code, slice 4 (`0.31.0`).** "4 Tier-1 advancements *and* reach Level 5" is
   self-inconsistent if Level is the count of picks taken, carried forward unchanged from the prior
   design doc's identical contradiction — because it's the *same* rule the doc's own "Motif
   Advancement — Potential" section (Section A of this plan's canonical source for slices 2-4)
   states a second, unambiguous way: gate purely on the prerequisite DAG, no Tier or Level. Resolved
   for code by treating the Tier/Level section as leftover draft text and gating on the DAG (repo
   owner confirmed, not guessed) — see slice 4's own note above and HANDOFF open issue 12. The
   ruleset document's own internal contradiction is unchanged; only this app's implementation of it
   is settled.
4. **Recoveries start at 6 or 8** — the doc literally reads "6 (or 8?)".
5. **"+1 Potential for rolling a Condition-marked Virtue"** is marked "optional??" twice in the
   source text.
6. **Hero Status Rank cap** — the doc's own design note asks whether the cap of 6 should scale with
   Level, given that enemy Limits range well above it.
7. **Subdued's duration** — whether it removes a Hero from the scene permanently, and whether a
   downed Hero can be finished off, are both questions the doc asks of itself rather than answers.
8. **Tree Specializations vs. Improvement Trees** — a 24-entry specialization list sits beside the
   25 Improvement trees (11 + 14) with no stated relationship between the two lists.
9. **Party Skill Tag economy** — the doc asks itself whether Party Skill Tags are once-per-Camp,
   stronger than an individual Hero's tags, or granted one per member.
10. **"Roll + an appropriate Ability"** appears in both Invoke Expertise and Take a Risk. The game
    has Virtues, not Abilities, as the roll-modifying stat — this reads as leftover vocabulary from
    an earlier draft rather than a real new mechanic.
11. **"Attrition: expend a resource"** — which resource is never defined anywhere in the text.
12. **The Countdown lists five named steps** (Seed / Bloom / Wilt / Wither / Rot) under prose that
    promises six. Slice 9 (Adventures) is where this surfaces first in code — carry it forward
    unresolved rather than picking a sixth step to make the count work.
13. **XP and Potential** are used interchangeably across several Move texts, with no stated
    equivalence or distinction between the two terms.
14. **"Shot in the Dark"** — named as the Bond-0 move, but never actually defined anywhere in the
    document.
15. **RESOLVED for code, slice 7 (`0.34.0`), same session.** Hero Moves and Playbooks remain
    "Coming Soon" in the source text — but the repo owner confirmed directly that Playbooks aren't
    part of the game's systems at all, not merely unwritten yet as that text implies. Hero Moves,
    which named no other foundation in the doc, are cut alongside Playbooks rather than left
    blocked; the "does Improvement Trees replace them" question this item used to leave open is now
    moot. This resolves the item for this app's implementation; the source document's own "Coming
    Soon" text is unchanged, per this project's standing rule of never silently editing
    `Ruleset-V0.5.md` to fix its own gaps.
16. **Undertake a Journey and Enjoy Downtime are now fully specified**, unlike the prior design
    doc's version of both. The `0.18.0`-era reason this app deferred building either ("not decided
    whether either needs a guided flow beyond generic Move-text reference") no longer holds now
    that V0.5 spells both out in full — this is why slice 7 builds real flows for both rather than
    continuing to defer them.

---

## E — Documentation gaps

Eight gaps in this project's *own* documentation, surfaced while researching this migration.
**These are identified here and deliberately not filled in this pass** — recording them is what
this section is for; fixing any of them is separate work for whichever future session picks it up,
possibly but not necessarily tied to one of the nine slices above.

1. **No rules-to-code traceability map exists.** Nothing in the repo states, in one place, which
   rule lives in which function — a reader has to already know, or go find out the hard way, that
   the Condition penalty lives in `effectiveVirtueScore()` rather than somewhere else.
2. **No content-authoring guide exists for Content Admin**, despite the repo owner being the one
   who actually authors game content, and despite three collections (`Move.Results`,
   `Ability.Effects`, `EnemyTemplate.StatusLimits` — the same three named in Section B hazard 1)
   requiring hand-written raw JSON with no schema to guide the author.
3. **`loadTiers` has no admin screen, and that gap itself is undocumented** — distinct from Section
   B hazard 6, which is about the practical migration risk; this is about the fact that nowhere in
   the repo's own docs does anyone record that the gap exists at all.
4. **No record exists of what the unit test suite actually pins as a rules decision.**
   `logic.test.ts` and `engine.test.ts` encode real, deliberate rules choices — that a roll's
   `Total` excludes the highest Status, the Condition floor's exact value, how a Bond's Kin Track
   rolls over — that read, to an unfamiliar reader, as ordinary implementation detail rather than
   as pinned rules behavior worth protecting from an "obvious" refactor.
5. **Deliberate-omission records are scattered**, with no single list. They currently live spread
   across `README.md`'s "What's not built," `HANDOFF.md`'s open issues, and assorted `CLAUDE.md`
   prose, and cross-referencing all three to answer "was this actually decided, or just never
   built?" takes real effort.
6. **No doc explains the seed/demo data's relationship to the live database.** `seedPlay.ts` uses a
   retired Virtue array that the app's own current validation would reject if a player submitted
   it today — nothing states whether that is a known, acceptable staleness or an oversight.
7. **`CHANGELOG.md` entries from `0.13.0` through `0.18.0` cite a source document that was never in
   the repository** (see the intro above). Per the locked decision, `CHANGELOG.md` is history and
   is not edited to fix this — but a reader following one of those citations today finds nothing at
   the far end of it, and no doc currently says so.
8. **No version of this project has ever been git-tagged** — an existing, previously recorded
   `HANDOFF.md` open issue (item 3), unrelated to V0.5 specifically but still true as of this plan
   and worth carrying forward given how many new version numbers this migration is about to mint.

---

## Order of work

This branch is docs-only, so there is no PR sequence to check off here the way `WorkPlan-0.24.0.md`
and `WorkPlan-0.26.0.md` track one. **The ordering that matters is the slice sequence in Section C**
— nine numbers, `0.28.0` through `0.36.0`, each landing sequentially. Each slice is its own branch,
its own PR, and its own version bump, gated through the `release-reliability-checklist` skill
before it merges — exactly the same discipline this repo already applies to every other release,
just repeated nine times in a row rather than once.

Slice 4 is the one place the numeric sequence and the dependency sequence might actually diverge:
it is blocked on a rules answer that has nothing to do with slices 1-3 being finished, so in
principle slices 5 and 6 do not obviously need `Level`/`PartyLevel` to exist and could be built
while slice 4 waits. This plan does not resolve whether that reordering is worth doing — see Open
items — and defaults to building in numeric order unless a future session gets an explicit answer
that changes that.

## Verification and paperwork

For **this** docs-only branch specifically:

- `npm run typecheck`, `npm run build`, and `npm run test` all stay green — nothing in this change
  touches a source file, so this is a sanity check that nothing else broke underneath it, not a
  meaningful test of this branch's own content.
- `node scripts/check-versions.mjs` confirms all four `package.json` files still agree at
  `0.27.0` — this branch must not be the one that silently drifts the version-sync check it exists
  to catch.
- No `npm run test:responsive` and no `npm run screenshot` run — neither CSS nor any component
  changed, so both would only burn sandbox time confirming nothing that could have changed didn't.
- No version bump. No `CHANGELOG.md` entry. Both are explicit, locked decisions above, not
  omissions.

For **each of the nine slices** once work on them begins, the full existing release discipline
applies without exception, per `release-reliability-checklist` and (for anything touching layout)
`responsive-device-qa`: `npm run typecheck` / `npm run build` / `npm run test` on every PR; the full
`npm run test:responsive` (both appearances) on anything touching layout or component structure,
which given the scope of slices 1-3 and 5-9 is nearly all of them; `npm run screenshot` before and
after any visually-affecting PR; all four `package.json` files bumped together to that slice's
version; a `CHANGELOG.md` entry with a full UTC timestamp; and the merge commit tagged `v0.2N.0`.
`CLAUDE.md` and `README.md`'s `> **V0.5:** ... not built.` markers for whatever that slice ships get
replaced with real, shipped descriptions in the same PR that ships them — not left standing next to
working code, which would make the docs lie in the opposite direction from the one this migration
started by fixing.

## Open items

Raise these with the repo owner, or resolve them with real evidence, rather than guessing:

- **RESOLVED, slice 4 (`0.31.0`): the Level-vs-Tier gate** (Section D item 3, HANDOFF open issue
  12) gates on the DAG only, confirmed with the repo owner directly — see slice 4's own note above
  for the full reasoning. Don't re-litigate this from the ruleset text alone; the doc still
  contradicts itself, the app's own behavior is what's settled.
- **The Party/Bond Improvement content gap still has no owner and no slice, confirmed after slice 7
  shipped rather than just flagged beforehand.** Neither "Party Motif + Improvements" nor "Bond
  Track + Improvements" names a single tree in the source document — not a Tier/DAG question, a raw
  content one. Slice 7 (`0.34.0`) did build the Party Motif data model these would need
  (`Party.SkillTags`/`WeaknessTags`), exactly as this item anticipated, but building the actual
  Party Improvement trees themselves stayed out of slice 7's scope, as expected — "Gain a Party
  Improvement" is still an unavailable option in `PartyAdvanceModal.tsx`. No slice is assigned to
  this gap; it needs the repo owner to author real tree content before any slice can build against
  it.
- **Whether slices 5 through 9 can proceed ahead of slice 4 while it waits on that answer.** The
  brief this plan was written from states slice 4 as the only hard dependency and everything else
  as "sequential but unblocked," which could be read either as "the numeric order is a
  recommendation, not a requirement" or as "nothing else is blocked *on slice 4 specifically*, but
  the intended order is still 1 through 9." Slice 7's own contents (Party Playbook's `Level` field)
  read as plausibly dependent on slice 4's `PartyLevel` work specifically, which is a real
  dependency this plan's own slice-table summary line does not call out — worth confirming rather
  than assuming slice 7 is safe to build early even if slices 5-6 turn out to be.
- **Which slice Behavioral Statuses belong to.** They appear in the "New in V0.5" list of rules
  content but are not named in any of the nine slices' stated contents. Section A3 places them
  provisionally alongside slice 2's Status-adjacent work on the reasoning that Unstable — named in
  the same breath in the source material — lands in slice 1, but this is this plan's own inference,
  not something stated outright.
- **Whether the Villains/NPCs/Locations split between slice 8 (the data) and slice 9 (the Adventure
  surface that consumes it) is the intended reading**, or whether some part of that authoring
  experience was meant to ship together. Section A3 and Section C both assume the split; it has not
  been separately confirmed.
- **What happens to `ThemePanel.tsx` and `LooksPanel.tsx` structurally in slice 2** — folded into a
  new Motif-shaped component the way `BackgroundPanel.tsx` already folded them once in `0.24.0`, or
  removed outright since Theme itself is retired. Not specified in the source material this plan
  was written from; a real implementation decision for whoever builds slice 2, not a rules question
  for the repo owner.
- **Section D and Section E remain genuinely open by design, except items 3 and 15** (the
  Level-vs-Tier gate, resolved slice 4; Hero Moves and Playbooks, resolved slice 7 — both marked
  RESOLVED in place above). Neither resolution is this plan guessing at the draft's own text: both
  came from a direct repo-owner decision confirmed via `AskUserQuestion`, not from a later slice
  happening to land on a convenient interpretation. Every other item in both sections stays open.
