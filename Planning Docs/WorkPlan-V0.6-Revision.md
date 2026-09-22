# Work plan — ruleset V0.6, 2026-09-15 revision

`Planning Docs/Ruleset-V0.6.md` is now Ryan's **2026-09-15 consistency pass** of V0.6. It keeps
the name "V0.6" but rewrites a large part of the text the app was built against. That earlier
text, adopted 2026-09-09 and migrated across `0.42.0`–`0.49.0` by `WorkPlan-V0.6.md`, is archived
at `Planning Docs/archive/Ruleset-V0.6-2026-09-09.md`.

The revision is not a patch. It is the first version of the rules where the Combat chapter was
actually rewritten for Strain, so it replaces the largest judgment call the first migration had
to make (`WorkPlan-V0.6.md` Section B1). It also:

- names and caps the universal roll;
- turns Conditions into Banes;
- gives the GM a currency;
- makes the Party a character with its own Motif, tags, Quest and Improvements;
- gives every pair of Heroes a Connection with a tag;
- replaces Toughness and named Status Limits with a complete enemy stat-block system.

**This branch changes documentation only.** No source file is touched, no version is bumped, and
`CHANGELOG.md` is not edited. The repo stays at `0.54.1`. This follows the same precedent as
`WorkPlan-V0.5.md` (landed at `0.27.0`) and `WorkPlan-V0.6.md` (landed at `0.41.0`). **None of the
slices below is built yet.**

This plan differs from its two predecessors in one respect, at the repo owner's request: Section
C is written as an **orchestration playbook**. An orchestrator lands each slice's contract first,
then dispatches **parallel Haiku implementer subagents** on work packages with disjoint file
ownership, and reviews every result against a fixed gate before accepting it.

## Sources

- **`Planning Docs/Ruleset-V0.6.md`:** the canonical ruleset, this revision, adopted 2026-09-22.
  The body is byte-identical to the file Mike committed as `214c650`; only a header comment is
  added.
- **`Planning Docs/archive/Ruleset-V0.6-2026-09-09.md`:** the text it replaces. It is kept because
  the shipped code quotes it.
- **`Planning Docs/Meeting Notes/Design Meeting Summaries.md`:** seven meetings, 2026-07-24
  through 2026-09-15. These carry the reasoning behind the revision and several action items the
  text never absorbed; Section A4 lists the ones in scope.
- **`Planning Docs/WorkPlan-V0.6.md`:** the first migration. Its Section A still records the
  judgment calls this plan inherits, **except B1**, which the revision supersedes.

## Decisions already locked

Confirmed with the repo owner on 2026-09-22. Do not reopen these.

| Decision | Choice |
|---|---|
| **This document's own scope** | **Docs only, no bump.** Adoption plus this plan; the slices below are built later. |
| **Misfortune** | **Shared and self-reported.** Everyone sees the count. A 6- a player reports in the app adds 1 automatically. Only the GM spends or resets it. Marking an Adventure `Concluded` resets it to 1. |
| **Existing enemy, Villain and NPC combat stats** | **Clean break.** `Toughness` and named Status Limits are dropped on read, not translated. Seeded enemies are rebuilt from the rulebook's own Goblin and Grizza. Same treatment as ranked Statuses in `0.42.0` (`docs/decisions.md` item 44). |
| **Meeting-note extras** | **All four in scope:** Forward/Ongoing reminders, a dice-odds readout, a GM reference panel, and Villains/NPCs in Combat. **The odds readout is admin-only**, behind a "Debug mode" toggle in the admin panel; regular accounts never see it. |
| **How it's built** | **Orchestrated, parallel.** The orchestrator owns contracts and review; Haiku implementers own work packages. See Section C. |
| **The revision's authority** | **Canon.** Where the revision is silent, the silence is recorded in Section D, never filled quietly. The rest of Section A5 lists our readings of the text, each recorded as a reading. |

---

## A — What the revision changes

### A1 — Unchanged: verify, do not touch

- **Strain and severity-slot Statuses:**
  - `markStrain`, `markRank`, `statusAbsorb` (2/4/6), `statusPenalty` (−1 / Disadvantage / 1d6)
    and the "penalties never stack" rule are all unchanged.
  - The 3/2/1 slot counts are unchanged.
- **The Healing Track and Recuperate**, including `applyRecuperateEffect`. The one exception is
  Combat's new alternative to Recuperate (A2.8).
- **Boons and Banes** and `compareBoonsAndBanes`.
- **Load:**
  - The bases stay 3/5/6 plus Might, and the Inconspicuous and Conspicuous Boon/Bane are unchanged.
  - The wildcard declarations from `0.46.0` are unchanged.
  - The note text changes "+1 Movement" to "+1 Speed". The app's Load notes already say Speed.
- **Clocks:** Opposition, Tug-of-War, Project and Threat are all structurally unchanged.
  - Wording only: Threat Clocks gain "faction disputes, NPCs reaching their goals" and "for a hard
    move, a significant amount of time passes… or simply when it makes sense", and Developments
    can be revised between sessions.
  - Project Clocks now say "appropriate Virtue" instead of "ability", and gain a Goal. The app's
    Project Clocks already have one.
- **Creating the World, Motifs and their tag catalogs, the Virtue arrays** (the "+2, +1, +1, 0,
  −1" typo is fixed in one place and `STANDARD_VIRTUE_ARRAYS` already matches), **Adventures**,
  **Locations** and **Secrets**.
- **The Adventure Countdown's five steps.** The prose now says "five", matching
  `ADVENTURE_COUNTDOWN_STEP_NAMES`.

### A2 — Changed by the revision

#### A2.1 The Hero Roll (Core Rules → "The Hero Roll")

Every Move is now a named **Hero Roll**:

1. Roll 2d6 and add the Virtue.
2. Add +1 for *one* relevant Skill Tag.
3. Add −1 for *every* relevant Flaw Tag.
4. Push Yourself **once per roll**: mark a Condition and add +1 for a second Skill Tag.
5. **"The final modifier cannot be beyond +3 or fall below −3."**
6. *Then* apply Advantage or Disadvantage from Boons, Banes and other rules. Advantage is 3d6
   keep the best two; Disadvantage is 3d6 keep the worst two. Extra net Boons or Banes change
   nothing further.

`computeRollBreakdown` has no cap today. The only floor it has is the Condition floor, which
applies to Virtue + Condition only, so tags and a Minor Status can already push the displayed
Total below −3.

**The results table now differs by context:**

- **Outside Combat:**
  - 10+ gets the full intended result, sometimes with extra.
  - 7–9 succeeds with a cost, complication or hard choice.
  - 6- fails to get what you intended or gets it with a serious cost. The GM gains **1
    Misfortune** and may make a Hard Move, **and you mark Potential on one Motif.**
- **In Combat:**
  - 10+ is maximum impact, 7–9 is moderate impact, and 6- is limited impact (the Move's minimum
    effect) plus 1 Misfortune for the GM.
  - No Potential is marked on a 6-.
  - 12+ means a modified 12 or more, and has no effect unless an Improvement says otherwise.

**Marking Potential on a missed non-Combat roll is new mechanically for the app.** Slice 3 of the
first migration recorded "no Potential on a 6- in Combat" as a no-op because there was no general
rule to carve out of. Now there is one.

#### A2.2 Conditions (Core Rules → "Mark a Condition")

- **"Each Condition you mark gives you an associated Bane that applies to any relevant rolls."**
  The −2 penalty, the −3 floor, `Condition.RollPenalty`, `GameSettings.ConditionFloor` and
  `effectiveVirtueScore` all go.
- The Crumble text is unchanged. The stale "Fall / are Dishonored" passage is deleted, which closes
  HANDOFF gap 5.
- **The Condition names are Exhausted, Afraid, Guilty, Angry and Insecure** — in both V0.6 texts,
  and in the revision's own Enemies chapter. **The seed says Hopeless, Irrational and Distracted
  for the last three.** Those are pre-V0.5 names, and `WorkPlan-V0.6.md` Section A1 listed them as
  matching when they did not. This is a real rename, not a reading.
- Timing is now explicit:
  - A Move or effect that says to mark or clear a Condition does so immediately.
  - A Clear Action clears its Condition at the end of the scene.
  - After Combat, a Hero may clear a Condition whose behaviour warranted it.

#### A2.3 Resist, Armor, Subdued (Core Rules → "Resistance", "Armor", "Strain")

- **Resist is a Hero Roll with a fixed reduction:** 10+ reduces the Strain by **2**, 7–9 by
  **1**, and a 6- by **0**, and the GM gains 1 Misfortune.
  - The Virtue score no longer sets the amount. `resistRollReduction(score, tier)` becomes a
    function of tier alone.
  - The GM offers one or two Virtues; the player may pitch another, and the GM may attach a Bane
    if it's a stretch.
- **Armor:**
  - Core rules: "Instead of Resisting, a Hero may mark Armor."
  - Combat: Defend happens "after Resistance is resolved but before Strain is marked" and costs
    1 AP.
  - Each context follows its own text (A5).
- **A Hero marks no more than one Strain box per attack.** The app already enforces this.
- **Subdued** happens when a Hero must mark Strain, has no legal box for it, and doesn't prevent
  it with a Status or Armor.
  - This is an *event*. With sparse marking, a Hero can be Subdued while lower boxes are still
    free. `isSubdued` today tests "every box and every slot full"; `strainExhausted` already
    computes the event correctly.
  - The new "Subdued Heroes" section says the player and GM describe how the Hero leaves the
    immediate danger, and the Hero is not killed unless the player agrees. The core "Subdued"
    heading still reads "TBD" (Section D).
- **Strain Rank** is defined as the number of the farthest-right marked box.

#### A2.4 Misfortune (new — Core Rules → "Misfortune")

- At the start of a Session, the GM gains 1 if they have none.
- Every 6-, in Combat or out, gives the GM +1.
- The GM spends Misfortune 1-for-1 on a Hard Move at any time. Some enemy abilities also cost
  Misfortune.
- It persists between Sessions and **resets to 1 after the conclusion of an Adventure**. The app
  already has `Adventure.Status: 'Concluded'` to hook this to.
- The GM chapter's "Soft & Hard Moves" makes it the price of any Hard Move.

#### A2.5 The Party (Hero & Party Creation → "The Party"; Advancement → Party sections)

- **The Party Motif:**
  - Chosen from **13 listed Party Motifs** — Banished, Bulwark, Company, Covenant, Crew,
    Entangled, Fellowship, Misfits, Retinue, Seekers, Unbroken, Vengeful, Wanderers — or renamed
    or written custom.
  - It has **two Skill Tags and two Flaw Tags.**
- **Party tags:**
  - Any Hero may invoke a Party Skill Tag for **+1 on top of their own tags without Pushing**.
  - The GM may invoke a Party Flaw Tag on any Hero Roll.
  - **Each Party tag works for a single Hero Roll, is then marked used, and refreshes at Make
    Camp.**
  - Invoking either kind **marks Rapport.**
- **The Party Quest** takes one of four forms (Vision, Covenant, Shield, Expedition). It has
  **three Act Breaks and three Forsakes**, with the same completion and abandonment procedures as a
  Hero's Quest, except that it marks Rapport.
- **The party chooses one Party Improvement at creation.** Progress the Party can now actually
  "Gain a Party Improvement".
  - The only content is the four examples under "Party Improvements". The 2026-09-15 meeting
    wanted a flat, simpler list, possibly with repeatable entries.
- **Camp Actions per Hero = the number of Party Improvements**, replacing `PartyLevel + 1`.
- **Combat-start Rapport changes** (Combat Loop step 2, and again under Party Advancement):
  - **+1** if the Heroes initiated **and** all share the Goal.
  - **−1** if they did not initiate, **or** are ill-prepared or off-balance.
  - **0** otherwise.
  - Rapport never goes below 0.
  - Today's `combatStartRapportDelta` gives +2 for initiated-and-shared, and +1 for initiated
    alone.
- **Aid** gains "Adding +1 this way can not exceed +3 total on the roll", and an open NOTE (D1).

#### A2.6 Connections and Bond (Creation → "Establish Connections"; Advancement → "Connection Advancement — Bond")

- **Each unique pair of Heroes has one Connection with a Connection Tag.**
  - The tag comes from 19 examples or is written custom. The text suggests a tag "that gives
    their pair room to grow".
  - All Connections start at 0 Bond.
- **Marking Bond:** mark it when the Connection Tag meaningfully influences an important choice,
  creates a significant complication, or helps the pair overcome a great obstacle — **at most
  once per Connection per scene** — or when a Move says so.
- **Forge a Bond:** at 5 Bond, at the next Make Camp, reduce the track by 5 and gain a Connection
  Improvement (the "Bond Improvements" heading is still empty). You may then rewrite the Connection
  Tag.
- **Gone from the text:** the Bond-5 lock ("your Bond Level locks") and the spend-below-0 Level
  drop. Bond Level survives only in one line of flavour text.
- **Spending Bond** is reworded:
  - +1 to your roll against them;
  - −1 to their roll against you;
  - offer them **Potential** on a Motif of their choice;
  - add extra **Strain** 1-for-1;
  - mark a Condition on them, or give them **a relevant Bane**.
- **A new Camp Action:** if both Heroes agree their Connection Tag no longer fits, they rewrite it
  and mark a Bond.
- **Carouse** loses its Wealth cost.

#### A2.7 Hero creation and Quests (Creation; Advancement → "Hero Motif Advancement")

- **Choose two Hero Improvements.** The first must be a Starting Improvement. The second is either
  another Starting Improvement or one connected to the first on the same tree.
- **Choose your Hero's starting Load.**
- **Completing a Quest** (third Act Break), choose any of:
  - mark Potential up to 5, **then advance instantly** without waiting for Camp;
  - retitle the Motif;
  - revise its tags;
  - revise or replace the Quest.
- **Abandoning a Quest** (third Forsake), do all of:
  - retitle the Motif;
  - remove all its tags;
  - write one new Skill Tag and one new Flaw Tag;
  - write a new Quest;
  - add Potential equal to its total Act Breaks plus Forsakes, and advance if that reaches 5.
- **After Advance a Motif**, you may rewrite one tag. The same applies after Progress the Party and
  Forge a Bond.
- Flaw Tags still mark Potential on any roll where they apply. The sentence moved from the Flaw
  Tags section to the Potential section.

#### A2.8 Combat (fully rewritten — "Combat", "Heroes in Combat")

**Starting Combat:**
1. The GM and the Heroes agree the Combat Goal.
2. Adjust Rapport (A2.5).
3. **Whichever side is best positioned in the fiction acts first.** The 2d6 initiative roll is
   gone.
4. **"A surprised unit cannot take a turn or use a Reaction during the first round"** — surprise
   is per unit, not per side.

**Turns:**
- A **unit** is one Hero, one non-Minion Enemy, or **one group of Minions**.
- The two sides alternate. Each non-Legendary unit takes one turn per round. Leftover units act
  consecutively, and the side that started acts first every round.
- **Team-Up Turns:** two Heroes act back to back, then the Enemy side takes two consecutive turns.
  A Legendary enemy takes two turns in a row.

**Action Points:**
- Heroes have 3 AP, restored to maximum at the **end** of their turn. Reactions draw on the same
  pool.
- A Free Action can't need a Hero Roll, deal Strain or replace a Move.

**Combat Moves (1 AP each):**
- Move and Maneuver: up to your Speed, which is 6 for a Hero; Load changes it by ±1.
- Shift: 2 spaces.
- **Engage in Melee: 10+ deals 6 Strain, 7–9 deals 4, 6- deals 2** and the GM gains 1
  Misfortune. (Was 5/4/3.)
- **Engage at Range: 5, 3, 1** and Misfortune on a 6-. (Was 4/3/2.) Both Engage moves are
  "+ Might" (D).
- Recuperate, which **may instead take 2 Strain to clear one Condition.**
- **Break:** clear the Immobilized Bane from yourself or an ally.
- **Prepare:** your maximum AP becomes 4 during your next turn. It doesn't stack.

**Reactions (cost AP):**
- **Defend:** after Resist, negate the remaining Strain with Armor.
- **Brace:** reduce forced movement by your Mettle, minimum 1. This is the old reaction "Resist",
  renamed and given a floor.
- Opportunity Attack.
- **Interpose:** you become the target — "**You may Resist normally**". Today this is
  `Resistable: false`.
- The old "Help" reaction is not listed. Aid remains an Adventure Move.

**Gambits:**
- The costs are unchanged: the first Gambit is free on a 12+, each costs one Condition on a 10+,
  a 7–9 allows one Gambit for two Conditions, and a 6- allows none.
- **Pierce** is added: ignore the enemy's Guard.
- **Fortify** replaces the Brace Gambit: reduce each instance of Strain inflicted on you by 1
  until the start of your next turn.
- **Repel** pushes the enemy a number of spaces equal to its *Strain Rank*.
- **Halt:** the enemy cannot move voluntarily on its next turn.
- **Impede** gives a Bane, such as Grappled, Distracted or Provoked, that lasts while its cause
  does.
- **Calculate:** +1 Forward for you, or for an ally who can use the opening.
- Gambits now target "the Enemy".

**Repeated Attacks:** each earlier AP-spending, Strain-inflicting move since your AP refreshed
steps the roll one worse.

| Starting roll | First move | Second move | Third or later |
|---|---|---|---|
| Advantage | Advantage | Normal | Disadvantage |
| Normal | Normal | Disadvantage | Double Disadvantage |
| Disadvantage | Disadvantage | Double Disadvantage | Double Disadvantage |

- **Double Disadvantage** is 4d6, keeping the worst two. This is its only source.
- A Move counts once no matter how many targets it has. A Reaction counts if it costs AP and can
  deal Strain.

**Other rules:**
- **Additional Effects** trigger only if the target marks at least 1 Strain.
- **Immobilized** is a special Bane: Speed 0, no voluntary movement, other actions allowed, forced
  movement still works. It ends when its cause does, or on Break.

**Ending Combat:**
- Combat ends when the Goal is achieved.
- A minority may declare a **Defiant Goal**. Achieving it frees only those Heroes, unless the table
  agrees it supersedes the main Goal.
- When Combat ends:
  - the Heroes narrate the rest;
  - **each marks Potential on one Motif used during the Combat;**
  - **all Strain clears;**
  - Conditions whose Clear Actions were completed clear;
  - Statuses remain.

#### A2.9 Enemies (new — "Enemies in Combat")

- **Standard enemy rules:** Speed 6, Range 1, Guard 0, and one movement plus the actions of its
  profile. It may trade its attack for a move or its move for an attack, or trade its attack to
  clear a Condition.
- **Profiles** (from the Threat Levels table):

  | Profile | Threat | Strain | Status slots | Conditions | Typical attack | Turn |
  |---|---|---|---|---|---|---|
  | Minion | ½ | — (any 1 Strain Subdues) | 0 | 1 (any mark → Crumble) | 1–2 | as a group, one unit; one combined attack per target, max 5 |
  | Standard | 1 | 1–3 boxes | 1 | 2 | 2–3 | move + 1 action |
  | Elite | 2 | 4–5 boxes | 2 | 3 | 2–4 | move + 2 actions |
  | Legendary | 4 | 2–3 phases of 5 | 3 | 5 | 2–5 | a turn after every Hero's turn |

- **Size:** ½, 1×1, 2×2, 3×3 or 4×4.
- **Guard:**
  - Reduces incoming Strain by its value, never below 1. It doesn't reduce Conditions or effects
    that replace Strain.
  - Pierce ignores it.
  - **It replaces Toughness.**
- **Enemy Virtues** (Mi, Me, H, W, G):
  - A **+** is Strong and a **−** is Weak; one symbol per step.
  - Directly opposing a Strong Virtue gives the Hero **one Bane per +**. Exploiting a Weak Virtue
    gives **one Boon per −**.
  - A marked Condition on that Virtue steps Strong to Neutral, and Neutral to Weak.
- **Enemy attacks** list their target or area, range, Strain, suggested Resist Virtues, any
  Additional Effect and its trigger, and any Misfortune cost.
  - The GM tells the player all of it before they choose how to defend.
  - Trigger labels include "regardless of Resistance", "on a 6- Resistance Roll" and "instead of
    Strain".
- **Inflicting Strain on an enemy:**
  1. Subtract Guard, to a minimum of 1.
  2. The GM may fill a free Status slot to **negate the whole attack**, describing a lasting wound.
  3. Otherwise mark the box equal to the amount, or the next box to the right if it is taken.
  4. If there is no legal box, the enemy is **Subdued**.
- **Enemy Conditions:**
  - Enemies use the same five. Marking the final one **Crumbles** the enemy: it flees,
    surrenders, hides or falls unconscious.
  - An enemy may spend an action to clear one.
  - **Unshakable** enemies can't mark Conditions.
- **Legendary phases** — Opening, then Bloodied, then Last Stand (N), each a five-box track unless
  stated otherwise:
  - When a phase can't mark incoming Strain, discard the rest of that Strain.
  - Opening → Bloodied clears every Strain box and every Condition.
  - Bloodied → Last Stand clears Conditions, and **Last Stand (N) clears the N highest-numbered
    marked boxes**, which become the enemy's final capacity.
  - **An enemy loses at most one phase between its own activations**, and cannot lose Last Stand
    until after its next activation.
  - Statuses never refresh.
  - If a Legendary enemy is surprised, the GM may spend a Misfortune to let it act after the first
    Hero instead.
- **Encounter building:**
  - Sum the Threat and divide by the number of Heroes: Easy 0.5, Medium 0.75, Hard 1, Deadly 1.25,
    Very Deadly 1.5 or more.
  - Keep active non-Minion enemies at or below the number of Heroes unless that is deliberate.
- **Worked examples:** the Goblin (Minion) and Grizza the Tall (Legendary, in the Villain section).

#### A2.10 Moves and Camp

- **Every Basic Move's 6- reads "The GM gains 1 Misfortune and may take a Hard Move
  immediately."**
- Invoke Expertise and Take a Risk: "overcome an obstacle or **Subdue** enemies not worth Combat",
  and both now say "make a Hero Roll".
- Assess the Situation: "If no risk or conflict are present, say what you do and continue the
  game's conversation."
- Follow a Lead: spending Wealth **gains a Boon** instead of rolling with Advantage.
- **Work Together (a new Adventure Move):**
  - The GM may call for one Hero Roll for the whole Party.
  - Each Hero may contribute one relevant Skill Tag, any relevant Party tags apply, and all
    Heroes' Flaw Tags may apply.
  - The result affects everyone.
- **Make Camp:**
  1. The Countdown advances.
  2. Take any available advancement: Advance a Motif, Progress the Party, Forge a Bond.
  3. Clear one Condition, Recuperate and refresh Armor.
  4. **Camp Actions, one per Party Improvement.** The choices are:
     - rewrite one Party tag;
     - rewrite one Hero tag;
     - rewrite a Connection Tag and mark Bond;
     - use a Party Improvement;
     - progress a Project Clock.
  5. Keep Watch.
  - "Set or change the Party Quest" and "Use a Party Asset" are gone.
  - While at Camp, every Heart roll gets +1 Ongoing.
- **Enjoy Downtime:**
  - Carouse is free.
  - Pivot: "Change a Motif as if you had marked your third Forsake. Or, as a party, decide to
    change or update the **Party Motif**."
  - Advance is renamed **Pursue**.
- **End the Session:** five reworded questions.
  - "Did we uncover something new about the world? / save someone or something from certain doom?
    / learn something new about each other, or were we particularly cooperative? / defeat a
    Villain or important Enemy? / take strides to accomplish our Party Quest?"
  - Rapport is 1 for one or two yeses and 2 for three or more. The three ways to grow are
    unchanged.
- Set Out uses "Normal", not "Medium", and its misses still say "the GM makes a hard move" (D).

#### A2.11 The GM chapter

New reference prose: **Running the Game**, **GM Principles** (22 bullets), **GM Moves** (28
suggestions) and **Soft & Hard Moves**. The last one ties Hard Moves to Misfortune.

"Consider your Heroes" now names the Party Quest, Bonds, Conditions and Threats.

"In Game Time" (Moment → Campaign) and "Dungeons / Sites" hold only a list, images and links. There
is nothing in them to build.

### A3 — New: nothing exists today

- The ±3 cap.
- Conditions as Banes.
- Misfortune.
- The Party Motif catalog, per-tag used state, the Party Quest's Act Breaks and Forsakes, and Party
  Improvements.
- Connection Tags. Bond rows themselves are never created for a real campaign (B1).
- Creation-time Improvements and Load.
- The Quest completion and abandonment procedures in a UI. `markActBreak` and `markForsake` exist
  with no callers.
- Work Together.
- Combat: per-unit surprise, Prepare, Break, Repeated Attacks, Double Disadvantage, Pierce,
  Fortify, Immobilized and Additional Effects.
- The enemy stat block, profiles, Guard, Enemy Virtues, enemy Conditions, Legendary phases and
  encounter difficulty.
- Every item in A4.

### A4 — Meeting-note scope the text doesn't carry

The four `WorkPlan-V0.6.md` A4 items all stand and need no new work:
- Rapport overflow, although B1's defect currently defeats it;
- wildcard Load;
- the Threat Quest Board;
- pronouns.

These four are new, all confirmed in scope:

1. **Forward/Ongoing reminders** (2026-09-03: "help players remember forward and ongoing
   benefits… without automating fictional judgment").
   - `CharacterSheet.Reminders`, each one ±N, Forward or Ongoing, with a source.
   - Offered as optional modifiers in the Hero Roll, inside the cap. A Forward is consumed when the
     tier is reported.
   - Quick-add from the Moves and Gambits that grant one: Calculate, Assess the Situation, Consult
     the Past, Sway the Spirit (either sign), Strike a Nerve, Stand Defiant, Venture Forth, Make
     Camp's +1 to Heart, and Fortify as a timed note.
   - This also fixes Calculate, which today grants a "Focused" Boon. A Boon means Advantage, not
     +1.
2. **Dice-odds readout** (2026-08-27: "simulate roll probabilities… evaluate how much modifier
   stacking the dice math can support").
   - An exact enumeration: `rollOdds(modifier, shape)` → P(6-), P(7–9), P(10+), P(12+) for 1d6,
     2d6, Advantage, Disadvantage and Double Disadvantage.
   - **Shown only to admin accounts, and only while a "Debug mode" toggle in the admin panel is
     on.**
   - It is deterministic arithmetic and rolls nothing — see `docs/decisions.md` item 53 on why that
     does not conflict with item 13.
3. **A GM reference panel.** The rulebook's GM chapter becomes an admin-editable, seeded
   collection, shown in a lazy, GM-only drawer.
4. **Villains and NPCs in Combat.** Once they share the enemy stat block, `AddParticipantModal`
   gains Villain and NPC tabs. Today this is impossible.

### A5 — Our readings of the text

Each of these is recorded in `docs/decisions.md` item 53. None is a guess at an open question.

- The seeded Condition names are corrected to Guilty, Angry and Insecure (A2.2).
- The rolled Virtue's own marked Condition is **pre-checked** as a relevant Bane. This is a UI
  default the player can uncheck, not a rule.
- The ±3 cap applies to every numeric modifier: Virtue, tags, Push, a Minor Status, Party tags,
  Aid, Bond and reminders. It is the plain reading of "final modifier".
- **Armor follows each chapter's own timing:** instead of Resisting outside Combat, and after it
  inside Combat.
- A GM-invoked Party Flaw Tag is **−1**, and each Skill Tag contributed to Work Together is
  **+1**. Both are by analogy with the Hero Roll's own tag values, and both sit inside the cap.
- **"Weakness Tag"** in the Progress the Party Move reads as Flaw Tag, which is what every other
  passage and the creation text say.
- **Villains and NPCs take the Enemies chapter's stat block.** Their templates still say "Status
  Limits !! UPDATE", but the revision's own Grizza is written in the new format.
- The Bond-5 lock and the Level drop retire along with their text. `BondLevel` becomes a count of
  Forges.
- **Engage at Range rolls +Might**, as written, and the UI flags it (D).

---

## B — Hazards

### B1 — Live defects found while planning, unrelated to the rules

| Defect | Evidence | Fixed in |
|---|---|---|
| **The party route clamps Rapport to the cap**, so every client save throws away the overflow `0.48.0` shipped | `apps/server/src/routes/party.ts:38`, pinned by `party.test.ts:69-75`; `KeepWatchModal.tsx:67` caps client-side too | **Slice 0** |
| **No Bond row is ever created** outside the seed | `insertBond` (`repo.ts`) is called only by `seed.ts` | Slice 5 (5A) |
| Enemy Limits above 5 are unreachable | `markEnemyStrain` caps at `StrainTrackLength`; the seeded Iron Warden has Hurt 6 | Superseded by slice 7 |
| Halt and Impede add a Strain *track* instead of a Bane | `EncounterView.tsx` `applyGambits` | Slice 6 |
| End Combat never clears Strain | `routes/combat.ts` `/end` only sets `Status` | Slice 6 (6F) |
| Defend marks Armor but is not attached to any incoming Strain | `EncounterView.tsx` `defend()` | Slice 6 (6C) |
| A Party tag's "used" state, and the Camp Action count, live only in component state | `MoveRollHelper.tsx` `declaredPartyTagKeys`; `CampActionsModal.tsx` local counter | Slices 4 and 8 |
| ~~`takeMotifAdvance` zeroes Potential instead of subtracting the cap~~ **Not a defect:** Potential is clamped at the cap on every write, so at an advance zeroing and subtracting the cap are the same operation | `logic.ts` | None needed (found in slice 3) |
| Enjoy Downtime's Pivot is labelled "Party Motif" but writes `Goal` | `EnjoyDowntimeModal.tsx` | Slice 8 |
| The AP max of 3 is hardcoded in the UI | `ParticipantCard.tsx:79,85` | Slice 6 |
| The Resist UIs use the raw Virtue score and ignore a marked Condition | `TakeStrainModal.tsx`, `EncounterView.tsx` | Moot after slice 1 (fixed 2/1/0) |

### B2 — Traps

- **Read-time defaults for every new JSONB field.** Rows already in Postgres will not have them.
  - `Party.Misfortune` defaults to **1**, not 0, to match "at the beginning of a Session…".
  - `Party.FlawTags` is migrated from `WeaknessTags` on read.
  - `Party.UsedTags` defaults to `[]`, and `Party.ActBreaks`/`Forsakes` to 0.
  - `Bond.ConnectionTag` defaults to `''`.
  - `CharacterSheet.Reminders` defaults to `[]`.
  - Each new library collection is added to `normalizeLibrary`.
  - **`normalizeEncounter` has no participant-level backfill at all today.** Slices 6 and 7 add
    one.
- **Misfortune is a GM resource on a member-writable document.**
  - The whole-document party `PUT` must keep the *stored* value.
  - Dedicated routes do the changes: +1 is open to any member and needs a reason; spend and reset
    are GM-only.
  - Every one calls `assertCampaignActive`.
  - The reset on `Concluded` is done server-side, in the adventures `PUT`, when the status goes
    from Active to Concluded.
- **The live library must be reset after merge** in slices 1, 2, 4, 5, 7 and 8, because each
  changes `seedLibrary.ts` (HANDOFF open issue 19). Slice 7's clean break relies on that reset.
- **Bundle budget.** Headroom was about 5.5 kB at `0.48.0`. Re-measure before each slice.
  - The Party page, the GM reference drawer, the odds readout and the admin Dice-math table must
    all be lazy.
  - `HeroRollBuilder` sections are always visible, so measure them.
- **No migration file is expected** in any slice. Every new shape is JSONB on a table already in
  the Realtime publication, and Bond rows are inserted into the existing `bonds` table. If one does
  appear, it must be applied by hand after merge (HANDOFF open issue 20).
- **The randomness invariant.** `rollOdds` enumerates outcomes. Slice 9 adds a sentence to
  `engine.ts`'s header and to CLAUDE.md's invariant saying exact probability arithmetic is allowed
  and randomness is not.
- **Grep before building.** Aid, Help, Crumble, the Quest Board and wildcard Load already exist in
  some form. Every WP brief names the existing code to extend.
- **Two files are shared by several slices:** `seedLibrary.ts` (one array per slice, so the hunks
  don't overlap) and `types.ts` (edited only in the orchestrator's contract commits).

---

## C — Implementation: the orchestration playbook

### C1 — Roles

- **The orchestrator** (the session's main model):
  - Owns every contract: `packages/shared/src/types.ts`, exported signatures in `engine.ts`,
    `logic.ts` and `combat.ts`, `api.ts` shapes, `normalize*` defaults and new library keys.
  - Writes the truth-table tests for any rule with explicit numbers.
  - Writes each work package (WP) brief, dispatches, reviews, integrates and commits.
  - Runs the full gate, and owns the CHANGELOG, the version bump, the PR, CI and the post-merge
    checks.
- **Implementers** (Haiku):
  - Launched via the `Agent` tool with `subagent_type: "general-purpose"`, `model: "haiku"` and
    `run_in_background: true`; one WP each.
  - **At most four run at once**; the rest queue.
  - Fixes go back to the same agent through `SendMessage`, so it keeps its context.
  - Implementers never commit.

### C2 — Per-slice pipeline

1. **Contract commit** — orchestrator, serial.
   - Types, exported signatures, `normalize*` defaults and library keys.
   - Non-trivial bodies are stubbed as `throw new Error('not implemented: WP-xx')`.
   - Truth-table tests, written from the rule text, are expected to fail until their WP lands.
   - Then `npm run build -w @asohav/shared`, and `npm run typecheck` must pass with the stubs in
     place.
2. **Dispatch WPs in parallel**, in the single checkout, on **disjoint file sets**.
   - Worktree isolation is not used, because each worktree would need its own `npm ci`, and one
     checkout with strict ownership is enough.
3. **Review each WP** against C4.
   - Commit each accepted WP separately on the slice branch: `slice N / WP NX: <summary>`.
   - Return rejected WPs with specific findings. After two rounds the orchestrator fixes it
     directly.
4. **Integrate, then run the full gate**:
   - `npm run typecheck`, `npm test`, `npm run lint`, `node scripts/check-docs.mjs`.
   - `npm run build` and `apps/web/scripts/bundle-budget.mjs`.
   - The responsive and interaction smoke tests (Chromium at `/opt/pw-browsers`).
   - `grep -rn "not implemented: WP"` must be empty.
   - Plus the skills: `theme-tokens` and `responsive-device-qa` for UI, and `perf-budget` for routes
     and hooks.
5. **Paperwork WP** — a Haiku worker, from an orchestrator spec:
   - A new section in the relevant `docs/architecture/*.md`.
   - A `docs/decisions.md` item for the calls made during the build.
   - HANDOFF updates, and mark the slice ✅ here with a findings annotation (as `WorkPlan-V0.6.md`
     did).
6. **Release** — orchestrator:
   - A CHANGELOG entry and the four-way version bump.
   - Push, draft PR, and drive it to green following the `steward` skill.
   - Post-merge: confirm the deploy is `live`, remind the repo owner to reset the library where
     marked, and list the tag to push. The sandbox cannot push tags.

### C3 — The WP brief (every implementer gets all of it)

- **Goal**, with the rule quoted verbatim from `Planning Docs/Ruleset-V0.6.md` and its section
  heading.
- **Owned files**, as an exhaustive list. Everything else is read-only.
- **The contract to consume:** exact signatures, already on the branch.
- **Patterns to copy**, as `file:line` references to existing code that does the same kind of
  thing.
- **Acceptance criteria**, including the test file and `describe` names to add. A test must fail
  without the change.
- **The CLAUDE.md invariants that apply** (see C4.3).
- **Commands:** workspace-scoped only — `npm run typecheck -w @asohav/<ws>`, which does not rebuild
  shared, and `npx vitest run <file>`. A type error in a file you don't own is reported, never
  fixed.
- **Forbidden:**
  - git writes, `npm install`, and edits to `package.json` or the lockfile;
  - rebuilding shared, or editing files you don't own;
  - `Math.random` or any randomness;
  - literal colours, px font sizes or spacing in CSS;
  - a route without authorization and `assertCampaignActive`;
  - renaming a wire-contract field.
- **Report:** the files changed with a per-file summary, tests and their output, commands run and
  their output, and any deviations or open questions.
- **Size:** at most about 4 files and about 400 changed lines, one concern. State machines —
  Legendary phases, Repeated Attacks, quest procedures — always get orchestrator-written tests
  first.

### C4 — The review gate (the orchestrator, before accepting any WP)

1. The diff is a subset of the owned files, with no stray files or debug leftovers.
2. It matches the quoted rule and the contract. Nothing is invented from Section D.
3. Invariants:
   - authorization in the Express layer (`req.user`, `membershipFor`, a GM check where needed);
   - `assertCampaignActive` on every mutating route;
   - a `normalize*` default for every new field;
   - no randomness;
   - Bond mutations only inside `withBondLock`, aborting by throwing;
   - the wire contract only grows, never renames;
   - tokens only in CSS;
   - 44×44 hit areas and 16px text inputs;
   - authored prose through `GlossaryText`;
   - new heavy surfaces behind `React.lazy`.
4. The orchestrator runs the WP's tests and checks they are meaningful.
5. It reads like the code around it: comment density, naming, idiom.

### C5 — The slices

Versions are assigned at merge time.

**Default sequencing:** one slice at a time on the session's designated branch, with parallelism
inside each slice. The cross-slice waves in C6 need the repo owner's permission to use more than
one branch at once.

Each slice needs its full gate (C2.4). "Reset" means the live library needs a reset after merge.

#### Slice 0 — Rapport clamp hotfix (patch release)

- **Contract:** none.
- **0A** · owns `apps/server/src/routes/party.ts`, `apps/server/src/routes/party.test.ts` and
  `apps/web/src/features/sheet/KeepWatchModal.tsx`.
  - Drop the ceiling and keep the floor at 0.
  - Rewrite the test to assert that overflow survives a save.
  - Remove the client cap in Keep Watch.

#### Slice 1 — The Hero Roll · reset

**Contract:**
- `RollExtras.ExtraModifiers?: RollModifierSource[]`, with `RollModifierKind` extended **now** by
  `PartyTag | Reminder | Aid | Bond | WorkTogether | Cap`. This way later slices add sections, not
  signature changes.
- `AdvantageState` gains `'DoubleDisadvantage'`.
- `RollBreakdown` gains `Uncapped: number` and a `Cap` source line when clamped.
- `GameSettings.HeroRollModifierCap`, backfilled to 3.
- `resistRollReduction(tier)`.
- `conditionBaneCandidates(sheet, library)`.
- `Condition.RollPenalty` and `ConditionFloor` removed; `effectiveVirtueScore` deleted.
- A skeleton `apps/web/src/features/roll/HeroRollBuilder.tsx`, with its state, the section
  registry, and the props for Move, Resist and Engage modes.
- Tests: the cap at ±3 on both sides, including tags plus a Minor Status; the Resist table 2/1/0;
  the Condition Bane candidate list.

| WP | Owns | Work |
|---|---|---|
| 1A | `engine.ts` (bodies only), `logic.ts` (the `effectiveVirtueScore` removal), `engine.test.ts`, `logic.test.ts` | Make the contract tests pass; remove the −2/floor branch |
| 1B | `seedLibrary.ts` (conditions and glossary), `schema.ts` | Rename the Conditions (Ids `c-guilty`/`c-angry`/`c-insecure`, after grepping for stored references); drop the two schema fields and add the cap; rewrite `g-condition`; add `g-hero-roll` |
| 1C | `MoveRollHelper.tsx`/`.css`, new `features/roll/{Virtue,SkillTag,FlawTag,Status,BoonBane,ConditionBane}Section.tsx` | Move the existing sections into the builder, add Conditions-as-Banes and the cap line; `MoveRollHelper` becomes a thin Move wrapper |
| 1D | new `features/roll/TierReport.tsx` | A general 10+/7–9/6- report; a 6- **outside Combat** opens the Motif picker to mark Potential (`addMotifPotential`); it keeps the existing Hold grant |
| 1E | `TakeStrainModal.tsx`/`.css`, `EncounterView.tsx` (`resolveOffer` resist math only) | Resist through `HeroRollBuilder` in Resist mode; the 2/1/0 reduction; **Armor as the out-of-Combat alternative**; Subdued fired by `strainExhausted` |
| 1F | `VirtuesPanel.tsx`/`.css`, `PeekCard.tsx` if it shows the penalty | Replace the "−2 Ongoing, floored at −3" copy and badge with the Bane |

#### Slice 2 — Misfortune · reset

**Contract:**
- `Party.Misfortune`, backfilled to 1.
- `applyMisfortune(party, delta, reason, by)`, floored at 0.
- `api.ts`: `MisfortuneChangeRequest { Delta: 1 | -1; Reason: string }` and a reset request.
- `apps/web/src/lib/useMisfortune.ts`, exposing `gain(reason)`, `spend(note)` and `reset()`.
- Tests for the floor and for the History entries.

| WP | Owns | Work |
|---|---|---|
| 2A | `routes/party.ts`, `party.test.ts`, `routes/adventures.ts`, `adventures.test.ts` | `POST …/party/misfortune` (+1 for any member; −1 or a reset for the GM only; `assertCampaignActive`); the `PUT` keeps the stored `Misfortune`; the adventures `PUT` resets to 1 when the status goes Active → Concluded |
| 2B | `logic.ts` (the Misfortune helpers), `logic.test.ts` | The bodies and tests |
| 2C | new `features/campaign/MisfortuneCounter.tsx`/`.css`, `CampaignPage.tsx` | A read-only counter for everyone; GM buttons to spend on a Hard Move, reset, and "begin session", which raises 0 to 1 |
| 2D | `features/roll/TierReport.tsx`, `TakeStrainModal.tsx` | A reported 6- calls `gain()`, once per roll (guard against double taps) |
| 2E | `seedLibrary.ts` (glossary) | Add `g-misfortune`, `g-hard-move`, `g-soft-move` |

The Combat-side hooks (the header counter, and Misfortune on an Engage or Resist 6-) land in slice
6, which owns those files.

#### Slice 3 — Hero creation and Quests

**Contract:**
- `characterCreationSchema(library)` gains `improvementIds` (exactly 2) and `loadTier`.
- `validateStartingImprovements(ids, library)` (first is a Starting Improvement; second is a
  Starting Improvement or connected on the same tree; no duplicates).
- `completeQuest(motif, choices, cap)` and `abandonQuest(motif, input)`.
- Tests for each rule in A2.7.

| WP | Owns | Work |
|---|---|---|
| 3A | `characterCreationSchema.ts`, `logic.ts` (the quest and advance functions), their tests | The bodies |
| 3B | `routes/characters.ts`, `characters.test.ts` | Validate server-side against the library, and write both `Improvements` and `Load.Tier` onto the new sheet |
| 3C | `CreateCharacterPage.tsx`/`.css`, `ImprovementTreePicker.tsx` (a pick-two mode) | The Improvements card and the Load card, and correct the "Bonds form once everyone's playing" copy |
| 3D | new `features/sheet/QuestProgress.tsx`/`.css`, `MotifPanel.tsx`/`.css` | Act Break and Forsake steps with the completion and abandonment procedures (the instant advance included); the "rewrite one tag" step after an advance. **`QuestProgress` is generic, so slice 4 reuses it for the Party Quest** |

#### Slice 4 — The Party · reset

**Contract:**
- `PartyMotifTemplate` and `PartyImprovementTemplate` (`Repeatable: boolean`), with the
  `library.partyMotifs` and `library.partyImprovements` keys.
- New `Party` fields: `MotifId`, `FlawTags` (migrated from `WeaknessTags`), `UsedTags`,
  `ActBreaks` and `Forsakes`. Improvements reuse `RapportImprovementsTaken`.
- `PARTY_ADVANCE_OPTIONS` gains `GainImprovement`, and Weakness becomes Flaw.
- `campActionsAllowed(improvementCount)`.
- `invokePartyTag(party, tag, kind)`: marks the tag used, marks Rapport, and returns the modifier.
- `refreshPartyTags(party)`.
- The new `combatStartRapportDelta` truth table.

| WP | Owns | Work |
|---|---|---|
| 4A | `logic.ts` (party functions), `combat.ts` (`combatStartRapportDelta`), their tests | The bodies |
| 4B | `seedLibrary.ts` (`partyMotifs`: the 13 verbatim; `partyImprovements`: the four examples), `schema.ts` | The new admin collections |
| 4C | `routes/combat.ts`, `combat.test.ts` | The start route computes the new delta; rewrite its tests |
| 4D | new `pages/PartyPage.tsx`/`.css` (lazy, `/c/:campaignId/party`), `App.tsx`, `CampaignSetupChecklist.tsx`, `CampaignPage.tsx` (banner and GM summary) | Party creation: the Motif picker, two plus two tags, the Quest (four prompts, `QuestProgress`), one Improvement. Linked from the setup checklist's PartyCreation lane. **Not a gate on Start Playing** |
| 4E | new `features/roll/PartyTagSection.tsx` | Real +1 / −1 modifiers into `ExtraModifiers`; a used tag is disabled; commits `invokePartyTag` through `commitParty` |
| 4F | `PartyAdvanceModal.tsx`, `CampActionsModal.tsx` (count only), `CombatPanel.tsx`, `PartyPlaybookPanel.tsx` | Gain an Improvement and then the optional rewrite; the Camp Action count; the start form's questions for the new formula; slim the sheet panel down to a summary and a link |

#### Slice 5 — Connections and Bond · reset

**Contract:**
- `Bond.ConnectionTag`.
- A new `BondChangeType` value: `'SetConnectionTag'`.
- `ConnectionTagTemplate` and `library.connectionTags`.
- The new `BOND_SPEND_OPTIONS` text.
- `resolveAcceptedBond`: Forge subtracts the cap, `BondLevel` counts Forges, and the lock is gone.
- `repo.ensureBondsForCampaign(campaignId)`.
- Tests for Forge and tag rewrite.

| WP | Owns | Work |
|---|---|---|
| 5A | `repo.ts` (`ensureBondsForCampaign`), `routes/characters.ts`, `routes/campaign.ts`, their tests | Insert a Bond per new pair when a character is created; repair missing pairs on the campaign bootstrap read (same pattern as Party's repair-on-read) |
| 5B | `routes/bond.ts`, `bond.test.ts`, `logic.ts` (Bond functions), `logic.test.ts` | A `SetConnectionTag` propose/accept inside `withBondLock` (the accept also marks Bond, for the Camp Action); the Forge change; retire `isBondLocked` and the Level drop |
| 5C | `seedLibrary.ts` (`connectionTags`: the 19 verbatim; `g-connection`), `schema.ts` | Content and schema |
| 5D | `PartyPage.tsx` (the Establish Connections step), new `features/sheet/ConnectionsPanel.tsx`/`.css`, `AdvancementPanel.tsx` (remove its Bond section) | One card per Connection: the other Hero, the tag, the Bond pips, Spend and Forge |
| 5E | `ForgeBondModal.tsx` and `ForgeBondPicker.tsx` (merged into one), `CampaignBonds.tsx`, `EnjoyDowntimeModal.tsx` (Carouse only) | Remove the duplicate; spend text; free Carouse |

#### Slice 6 — The Combat loop

**Prep commit (orchestrator):** split the 1,044-line `EncounterView.tsx`, **with no change in
behaviour**, into:
- `EncounterHeader.tsx`
- `IncomingOffers.tsx`
- `ReactionsSection.tsx`
- `LegendarySection.tsx` (today's Boss section)
- `DefiantGoals.tsx`
- `EndCombatFlow.tsx`

Run the full gate before any WP starts, so that later WPs don't collide in one 1,044-line file.

**Contract:**
- `CombatParticipant.Surprised`, `PrepareNextTurn` and `StrainMovesSinceRefresh`.
- `PendingStrainOffer` gains `SuggestedVirtueIds`, `ConditionVirtueId`, `AdditionalEffect`,
  `EffectTrigger` and `SourceParticipantId`.
- The new `GAMBITS`: `Pierce` and `Fortify` in, the Brace Gambit out.
- `engageStrain(kind, tier)`, `repeatedAttackShape(base, priorCount)`,
  `braceForcedMovement(push, mettle)`, and `endTurn` honouring Prepare.
- Remove `firstToActFromInitiative`.
- Participant backfill in `normalizeEncounter`.
- Tests: the Engage 6/4/2 and 5/3/1 table; the Repeated Attacks table (A2.8) row by row; Brace's
  minimum of 1; Prepare's 4 AP lasting one turn.

| WP | Owns | Work |
|---|---|---|
| 6A | `combat.ts`, `combat.test.ts` | The bodies |
| 6B | `EncounterHeader.tsx` | The first side decided by the fiction (a GM pick); per-unit surprise, marked at the start and cleared after round 1; hints for Team-Up and Legendary double turns; mount `MisfortuneCounter` |
| 6C | `IncomingOffers.tsx` | Resist via `HeroRollBuilder`; **Defend attached to the offer**, after the Resist; Interpose can be Resisted; Additional Effects applied by trigger; Misfortune on a Resist 6- |
| 6D | `CombatMoveModal.tsx`/`.css` | The full `HeroRollBuilder` in Engage mode; the new Engage values; the Repeated Attacks shape; the new Gambits, with Halt and Impede giving Banes; Misfortune on a 6- |
| 6E | `ParticipantCard.tsx`/`.css`, `ReactionsSection.tsx` | Prepare, Break, and Recuperate's "or clear a Condition"; max AP read from the participant; Speed display and an Immobilized warning (displayed, never blocking); Brace |
| 6F | `EndCombatFlow.tsx`, `DefiantGoals.tsx`, `routes/combat.ts` and its test (`/end` only) | Self-serve per Hero: mark Potential on one Motif used, and **clear all Strain**; a Condition-clear reminder; Defiant Goal semantics |

#### Slice 7 — Enemies · reset

**Contract:**
- `EnemyStatBlock`: `Profile`, `Threat`, `Size`, `Speed`, `Range`, `Guard`, `Virtues`
  (−2..+2 per Virtue), `StrainBoxes`, `StatusSlots`, `ConditionSlots`, `Unshakable`,
  `LastStandBoxes`, `GambitCharges`, `Attacks: EnemyAttack[]` and `Abilities`.
- `EnemyAttack`: `Name`, `Target`, `Range`, `Strain`, `ResistVirtueIds`, `ConditionVirtueId`,
  `AdditionalEffect`, `EffectTrigger` and `MisfortuneCost`.
- `ENEMY_PROFILE_DEFAULTS`, taken straight from A2.9's table.
- `Stats` on `EnemyTemplate`, `Villain` and `NPC`.
- Enemy participant state: `Strain`, `StatusNotes`, `ConditionsMarked`, `Banes`, `Phase`,
  `PhaseLostSinceActivation`, `MinionCount`, `Subdued` and `Crumbled`.
- Signatures: `inflictEnemyStrain`, `markEnemyCondition`, `clearEnemyCondition`,
  `effectiveEnemyVirtues`, `enemyVirtueRollHints`, `advanceLegendaryPhase`, `groupMinionAttack`
  and `encounterDifficulty`.
- **Orchestrator truth-table tests** for: Guard's floor of 1 and Pierce; the slot negate; sparse
  marking onto no legal box leading to Subdued; a Minion Subdued by 1 Strain and Crumbling on any
  Condition; Unshakable; the Virtue degrade steps; every Legendary transition, including
  Last Stand (N) and the one-phase-per-activation rule; the difficulty bands.
- Normalize drops `Toughness`, `StatusLimits` and `IsBoss` (the clean break).

| WP | Owns | Work |
|---|---|---|
| 7A | `combat.ts`, `combat.test.ts` | The bodies; retire `applyToughness`, `markEnemyStrain`, `isEnemyDefeated` and `isEnemyUnstable` |
| 7B | `seedLibrary.ts` (enemies, villains, NPCs; retire `g-toughness`; add `g-guard`, `g-threat`, profiles, `g-last-stand`), `schema.ts` | Goblin and Grizza verbatim; Brigand and Iron Warden rebuilt and **labelled as demo content**; the NPC and Villain combat blocks |
| 7C | `FieldEditor.tsx`/`.css` (an `enemyStatBlock` field type), `apps/server/src/adminLogic.ts` and its test | The editor, with profile defaults applied on pick, and validation |
| 7D | `AddParticipantModal.tsx`/`.css` | A profile-based ad-hoc form; **Villain and NPC tabs**; an encounter-difficulty readout |
| 7E | `ParticipantCard.tsx` (`EnemyCard` only)/`.css`, `LegendarySection.tsx` | The Strain row, the "negate with a Status slot" control, Conditions and Crumble, Phase, Banes, and a Guard, Size and Threat display; retire the "!! UPDATE" tooltip and the Hero Unstable badge |
| 7F | new `features/roll/EnemyVirtueSection.tsx`, `IncomingOffers.tsx` (creating offers from `EnemyAttack`), `CombatMoveModal.tsx` (Guard and Pierce into the amount) | Boon/Bane hints for the attacker; attack → offer carrying the full attack info; Minion grouping capped at 5; the Misfortune cost debited through `useMisfortune` |

**Waves inside the slice:** 7B, 7C and 7D (authoring) can run alongside 7A, since they don't touch
the same files. 7E and 7F start once 7A is accepted.

#### Slice 8 — Moves, Camp, glossary, GM reference · reset

**Contract:**
- `GmReferenceSection { Id, Title, Body, Order }` and `library.gmReference`.
- The `m-together` Move.
- Camp Action kinds, and `Party.CampActionsUsed` (reset at Make Camp).

| WP | Owns | Work |
|---|---|---|
| 8A | `seedLibrary.ts` (the `moves` array only) | Re-author all 22 Moves against A2.10's text and add Work Together. **Runs first.** 8B edits the same file and waits for it |
| 8B | `seedLibrary.ts` (`glossary` and `gmReference`), `schema.ts` | The glossary sweep (see below); seed the GM chapter verbatim as sections |
| 8C | `MakeCampModal.tsx`, `CampActionsModal.tsx`, `EnjoyDowntimeModal.tsx` (Pivot and Pursue), `EndSessionModal.tsx`, `KeepWatchModal.tsx`, `SetOutModal.tsx` | Make Camp refreshes the Party tags; the new Camp Action list with a persisted count; Pivot fixed to target the Party Motif; the five End the Session questions shown one at a time; wording |
| 8D | new `features/gm/GmReferenceDrawer.tsx`/`.css` (lazy), `CampaignPage.tsx` (GM view), `AdventuresPage.tsx` | A GM-only drawer rendering the sections through `GlossaryText` |
| 8E | new `features/roll/WorkTogetherSection.tsx` | Contributed Skill Tags (+1 each), all Flaw Tags, Party tags, inside the cap |

The glossary sweep in 8B:
- **Add:** Hero Roll (if slice 1 didn't), Work Together, Party Motif, Party Quest, Connection
  Tag, Pierce, Immobilized, Prepare, Repeated Attacks, Double Disadvantage, Minion, Standard,
  Elite, Legendary, Combat Goal and Defiant Goal.
- **Rewrite:** Aid, Bond, Crumble, Subdued, Advantage and Camp Action.
- **Retire:** Unstable.

#### Slice 9 — Table aids

**Contract:**
- `CharacterSheet.Reminders: { Id, Text, Value, Kind: 'Forward' | 'Ongoing', Source }[]`,
  backfilled to `[]`.
- `rollOdds(modifier, shape)` in a new `packages/shared/src/odds.ts`.
- `useDebugMode()`, backed by `adminUiStore`, persisted per browser with try/catch and only true
  when `me.user.IsAdmin`.
- **Orchestrator tests of exact values:** P(10+) on 2d6 = 6/36; P(6-) on 2d6 = 15/36; the keep-2
  enumerations of 3d6 and 4d6; the 1d6 shape; modifiers from −3 to +3.

| WP | Owns | Work |
|---|---|---|
| 9A | `odds.ts`, `odds.test.ts` | Exact enumeration and nothing else; no randomness |
| 9B | `adminUiStore.ts` and its test, `AdminNav.tsx`, new `features/admin/DiceMathView.tsx`/`.css` (lazy), new `features/roll/OddsPanel.tsx` | A Debug mode toggle in the admin panel; an admin "Dice math" table covering −3..+3 by shape; `OddsPanel` inside `HeroRollBuilder`, rendered only when `IsAdmin && debug`. **Regular accounts never see any of it** |
| 9C | new `features/sheet/RemindersPanel.tsx`/`.css`, new `features/roll/ReminderSection.tsx` | Add and remove reminders on the sheet; offered as ± modifiers inside the cap; a Forward is consumed when the tier is reported |
| 9D | `MovesDrawer.tsx`, `CombatMoveModal.tsx` (Calculate and Fortify) | Quick-add chips for the Moves in A4.1; Calculate creates a +1 Forward (retiring the "Focused" Boon); Fortify becomes a timed note |

After slice 9, the orchestrator adds the randomness-invariant sentence to `engine.ts` and CLAUDE.md
(B2).

### C6 — Cross-slice waves (optional; needs permission for several branches)

These slices share no files apart from `types.ts` (contract commits only) and `seedLibrary.ts`,
where each slice edits a different array. The orchestrator resolves those merges.

| Wave | Runs together | Why these can overlap |
|---|---|---|
| W1 | 0 ∥ 1 ∥ 3 | Server party route vs roll builder vs creation and Quests |
| W2 | 2 ∥ (6-prep → 6) ∥ 7 authoring (7B/7C/7D) | Party and adventures routes vs Encounter vs admin and seeds |
| W3 | 4 ∥ 7 in-fight (7A/7E/7F) | Party page and routes vs enemy mechanics |
| W4 | 5 ∥ 9 | Bonds vs reminders and odds |
| W5 | 8 | Needs every concept for the glossary and Moves |

Each slice still merges on its own, after a merge from `main`, and gets its version at merge
time.

---

## D — What the revision does not settle

Do not guess at these in code. `HANDOFF.md` "Known gaps in V0.6" carries the numbered list; this
is the implementation-facing summary. A slice that touches one of these shows the text as written
and implements nothing beyond it.

1. **Aid vs Party Skill Tags.**
   - The text's own "NOTE: Does Aid provide the same resource as invoking a Party Tag?"
   - The 2026-09-15 meeting said Aid must be removed, combined or redesigned, and chose none.
   - Aid stays as written, with the +3 cap.
2. **Subdued.** "TBD", and "BLAZE OF GLORY???". Only the new "Subdued Heroes" paragraph is built.
3. **Improvement content.**
   - The 25 Hero trees are still names only.
   - Party Improvements has four examples.
   - Bond (Connection) Improvements is an empty heading.
   - The creation and advancement *mechanisms* are built against placeholders and freeform entries,
     as slice 4 of V0.5 did.
4. **What failing the Combat Goal costs:** "NOTE: Consequences of 'losing' a fight are???"
5. "Depleted: expend a resource… (need to define what those could be)."
6. Follow a Lead: "(DEFINE more clearly)".
7. Recuperate: "Improvement on 12+??"
8. "NOTE: Bond for Interpose?"
9. Villain Skill Tags: "How do these work mechanically?? Same as Heroes?" Enemies make no Hero
   Rolls, so nothing is built.
10. Grizza's rank-era "Unstable." ability and its "1D6+1 Deafened". Kept verbatim as prose.
11. **The Repeated Attacks window** — "(at the beginning of their last turn)" — against AP
    restoring at the *end* of the turn. The app counts from the last AP restore, the rule's own
    primary wording, and flags the parenthetical.
12. **Engage at Range rolls +Might.** Followed as written and flagged.
13. How a Major Status's Disadvantage combines with a Boon/Bane Disadvantage. Both are still shown
    separately (slice 2 of V0.6's treatment).
14. Scene-boundary abuse and Resist balance (carried).
15. Camp Assets. There is no support in the revision; the meeting said they "may be folded into
    Party Improvements", undecided. The data is kept and new UI prominence is not added.
16. Whether selfish play costs Rapport or damages Bond (meeting, undecided).
17. **Naming:** Motif vs Aspect, Act Break vs Act, Mystic vs Mythic (meeting, undecided).
18. **Misfortune's "at the beginning of a Session".** The app has no session concept, so the GM's
    "begin session" control is the implementation.
19. "Define 'the conversation'" and "make a branch for initializing Combat" — GM-chapter drafting
    notes with no app surface.

## E — App/UI audit

- **The largest rewrites:**
  - `EncounterView.tsx` (1,044 lines; split in 6-prep), `CombatMoveModal.tsx`,
    `ParticipantCard.tsx` and `AddParticipantModal.tsx`.
  - The new enemy model: types, `combat.ts`, the admin editor.
  - `MoveRollHelper.tsx`, becoming `HeroRollBuilder` and its sections.
- **New surfaces:**
  - `PartyPage.tsx`, `ConnectionsPanel.tsx`, `QuestProgress.tsx`, `MisfortuneCounter.tsx`,
    `RemindersPanel.tsx`, `GmReferenceDrawer.tsx` and `DiceMathView.tsx`.
  - The `features/roll/*` sections.
- **Modals changed:** `TakeStrainModal`, `PartyAdvanceModal`, `CampActionsModal`, `MakeCampModal`,
  `EnjoyDowntimeModal`, `EndSessionModal`, `KeepWatchModal`, `SetOutModal`, and
  `ForgeBondModal`/`ForgeBondPicker` (merged).
- **Content:**
  - All 22 Moves re-authored, plus Work Together.
  - Three Conditions renamed.
  - New collections: `partyMotifs`, `partyImprovements`, `connectionTags` and `gmReference`.
  - Enemies, Villains and NPCs re-seeded.
  - About 20 glossary terms added, several rewritten, and two retired.
- **Server:**
  - `party.ts`: the clamp fix and the Misfortune routes.
  - `adventures.ts`: the Concluded reset.
  - `characters.ts`: creation validation and Bond rows.
  - `campaign.ts`: Bond repair.
  - `bond.ts`: the tag handshake and Forge.
  - `combat.ts`: start and end.
  - `adminLogic.ts`: stat-block validation.
- **Untouched:** Clocks and the Quest Board, Creating the World, Adventure Prep's structure,
  invites, phases (apart from checklist links), appearances, and the token scales.

## Legacy code left stranded

Shipped code whose support in the text the revision removes. Each is decided by the slice that
touches it.

- **Retire as part of the slices that replace them:**
  - `Condition.RollPenalty`, `GameSettings.ConditionFloor`, `effectiveVirtueScore` (slice 1).
  - `firstToActFromInitiative`, the Brace Gambit, and the "Help" reaction wording — Aid stays
    (slice 6).
  - `Toughness`, `applyToughness`, `EnemyStatusLimit`, `markEnemyStrain`, `isEnemyDefeated`,
    `isEnemyUnstable`, `IsBoss`, `EnemyStrainMark`, and **`WorkPlan-V0.6.md` Section B1's mapping
    table** (slice 7).
  - Hero `isUnstable` and `g-unstable` (slices 7 and 8).
  - `isBondLocked` and the Bond Level drop (slice 5).
- **Stranded data, kept:**
  - `Party.PartyLevel`: its only use is replaced by the Party Improvement count in slice 4. The
    field and its display are kept as history, and nothing reads it.
  - `Party.Path` and `Party.Goal`: End the Session asks about the Party Quest, Pivot targets the
    Motif, and the "Set Party Goal" Camp Action is gone. Kept as data, dropped from the UI in
    slices 4 and 8.
  - `Party.CampAssets` and `CampAssetTemplate` (D15).
  - `CharacterSheet.Treasure` and `Scars` — unchanged from the first migration's call.
  - `Hold` stays live for Assess the Situation and Discern the Truth.

## Verification and paperwork (this branch)

1. `node scripts/check-docs.mjs` passes.
2. `npm run typecheck` and `npm test` pass with no source changes — proof that nothing outside the
   docs was edited.
3. `git diff --stat main` is confined to `Planning Docs/`, `docs/decisions.md`, `CLAUDE.md` and
   `HANDOFF.md`, plus the two files Mike committed under `docs/`, which are moved out of it
   rather than edited.
4. `Planning Docs/Ruleset-V0.6.md` matches `214c650`'s file byte for byte after its header comment,
   and the archived 2026-09-09 body matches the previous `Ruleset-V0.6.md` byte for byte after its
   banner.
5. No version bump, no `CHANGELOG.md` entry, no tag. The repo stays at `0.54.1`.
