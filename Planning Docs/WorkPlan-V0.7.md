# Work plan — ruleset V0.7 migration

Status: **draft for owner review. Nothing here is built.** App is at `0.67.0` on V0.6 (2026-09-15 revision).
Ruleset: `Planning Docs/Ruleset-V0.7.md`, adopted as canonical on 2026-10-17 (`docs/decisions.md` item 66).
Companion: `WorkPlan-2026-10-06-Meeting.md` (the meeting review that led here). Style follows `WorkPlan-V0.6-Revision.md`.

Method: four Haiku agents mapped the current code against V0.7 (Misfortune→Drama, Strain/Armor/Status, advancement/Aid/Bond,
combat/moves/seed). I re-checked the load-bearing claims against the source (cited below). Rows marked *unverified* rest on the
agents' greps alone.

## Decisions already locked

From item 66 plus the Bond ruling. These are not re-opened here.

- V0.7 is canonical. Its research dumps, forum quotes, "Possible idea" blocks and placeholders are WIP, not rules.
- **Drama replaces Misfortune** (V0.7 uses "Misfortune" zero times).
- Armor follows V0.7 (Armor stops all Strain from one source; Heavy stops Strain on the body; Special is defined per ability).
- Hero Roll order: Advantage/Disadvantage is known before the dice; roll; Push Yourself last and optional; ±3 cap applies to the
  final modifier including Push (provisional, revisit if the cap is hit often); Aid is decided at the same point as Push Yourself.
  **Gated on Ryan's text matching** — V0.7 L357-360 still puts Push Yourself before the dice.
- Failing a Combat Goal: the table decides, and the GM may spend Drama to decide alone.
- Aid is the V0.7 Party Skill Tag form; the Rapport-spend text at V0.7 L2053 is a leftover.
- Bond spend: the −1 bullet is "−1 to a Hero Roll they are making against you or an action against your direct wishes"; the widened
  +1 bullet and the "selfish or detrimental" intro stand; spending costs nothing else.
- Team-Up Turns may be started by either side. Combat begins by table agreement.
- Magic is not built. The death system is in scope (V0.7 states concrete rules, L609-656).

## A — What changes in the app

Status key: MATCHES (verify, do not touch) · DIFFERS · ABSENT.

### A1 — Already matches (leave alone)

Strain box marking (`engine.ts:284-329`); Resist 10+/7-9 reduce 2/1 (`engine.ts:238-247`); Status absorb 2/4/6 and highest-only
penalty (`engine.ts:122-137, 354-356`); Recuperate and the Healing Track (`engine.ts:430-458`); Crumble (`logic.ts:91-104`);
Potential cap 5 and clear-on-advance (`logic.ts:140-145, 328-331`); Bond cap 5 and the propose/accept handshake; Party Skill Tag
used-flag and Make Camp refresh (`logic.ts:452-466`); combat-start Rapport adjustment (`combat.ts:170-178`); Engage values and
Repeated Attacks; Surprise; Legendary phases (`enemies.ts:271-320`); AP count and restore at end of own turn (`combat.ts:98-112`);
Subdued for enemies; Load values 3/5/6 plus Might (`logic.ts:31-62`); Hero Roll cap ±3 (`engine.ts:181`).

### A2 — Differs

| # | Area | Code today | V0.7 |
|---|---|---|---|
| 1 | GM resource name | `Misfortune` in 56 files / ~430 uses (`types.ts:963`, `logic.ts:689-728`, UI, seed, docs) | `Drama` |
| 2 | 6− results | Every 6− says "GM gains 1 Misfortune", including Recuperate (`RecuperateModal.tsx:14`, `seedLibrary.ts:125-138`) | Drama; Recuperate's 6− only "mark 1 segment" (V0.7 L600) |
| 3 | Invoke Expertise | Trigger includes "or Subdue enemies not worth Combat" (`seedLibrary.ts:132`) | Trigger is "and have a relevant Skill Tag" only; adds "if a more specific Basic Move exists, use that" (L1170-1184) |
| 4 | Party advancement | `Rapport = max(0, Rapport − cap)`, overflow banked (`logic.ts:366-374`) | Clear the track (L2041); Rapport capped at 5 (L2034) |
| 5 | Bond Forge | `BondTrack − cap` (`logic.ts:587-589`) | Clear the track (L2088) |
| 6 | Aid | Spend 1 Rapport (`logic.ts:398-401`) | Invoke a Party Skill Tag after the roll, +3 total cap, one tag per teammate per action, tag spent until Make Camp, the roller marks Rapport (L1343-1351) |
| 7 | Party Flaw Tags | Any Hero can invoke (`HeroRollBuilder.tsx:214-217`) | The GM invokes them (L1827) |
| 8 | Bond spend text | V0.6 wording (`logic.ts:495-501`) | Ruling above |
| 9 | Hold spend | Fixed four-item menu (`SpendHoldModal.tsx:20`) | Effects listed on the granting Move (L508) |
| 10 | Armor | All three types behave identically; Coat of mail costs 2 Load (`seedLibrary.ts:97`) | Armor 1 Load, Heavy 1 Load, Special variable per ability (L552-554) |
| 11 | Taking Strain | One method per hit (`TakeStrainModal.tsx:42`) | Several Status slots at once (L539) |
| 12 | Strain clearing | On Combat end only; no scene tracking (`routes/combat.ts:122-130`, `types.ts:866`) | After any Scene or Combat (L525); on Combat success only (L5975) |
| 13 | Team-Up Turn | UI Heroes-only (`EncounterHeader.tsx:167-183`); enemy double turn is a display note | Either side may start one (ruling) |
| 14 | Ending Combat | Only `CombatGoalAchieved`; no failure branch | Concede; table decides or GM spends Drama (L5979-5983) |
| 15 | Motif advance | Four options in one list (`logic.ts:323`) | "Always" list plus "Then" list (L2105-2114) |

### A3 — Absent

Temporary Strain; Dying; Scar creation (`types.ts:845-851` says Scars are display-only since V0.6 and "nothing currently writes
a new one"); Risk Death; Blaze of Glory; second Strain mark per box; Surrender; Resurrection; Fortune Roll; Load Speed ±1
(deliberately not modelled, `logic.ts:53-56`); Legendary "additional Status slot" (L6056); 12+ Resist reduces 3 (Improvement-gated).

### A4 — Safety defaults missing today (fix first, independent of V0.7)

`normalizeSheet` does not default `Armor` (`logic.ts:861-879`; `ArmorSection.tsx:38` and `StatusesPanel.tsx:96` call `.map`/`.forEach`
unguarded); `normalizeParty` does not default `Rapport`; `normalizeLibrary` does not backfill `PotentialTrackLength` or
`RapportTrackLength`. All three are the failure `CLAUDE.md` warns about under "read-time default". Ship them as a patch.

## B — Fenced: do not build, do not guess

Marked open by the owner or by V0.7 itself. Each stays in `docs/decisions.md` item 66 until answered.

- Whether Heroes may answer a GM-started Team-Up; Legendary turns after a Team-Up (L5821 two in a row vs L6030 one after each Hero).
- Action Point restore (L5828 replaces vs L5860 end of next turn).
- Prepare duration (L5906 "next turn returns to normal" vs the glossary "during your next turn").
- Potential on Combat end: L5854 unconditional vs L5974 success only.
- Wealth rule (L851 vs L883).
- Advance a Motif: +1 Virtue (max 3) and a permanent Strain box. `CLAUDE.md` records that Virtue scores change only through the
  Advancement picker; V0.7's Virtue grant needs an explicit owner call before anything writes a Virtue.
- Brace: "up to" Mettle as a chosen amount, and the push-back Improvement.
- Subdued duration; Hero's Journey nodes; magic; Hold effects per Move (only if owner wants it).

## C — Slices

Each slice is its own PR and release (minor, from `0.68.0`; the patch is `0.67.1`). Every slice that edits `seedLibrary.ts` bumps
`SEED_VERSION` (currently `0.64.4`, `seedLibrary.ts:17`); the live library does not refresh from the seed, so each such release
needs the Content Admin "Reset to seed" step noted in its CHANGELOG entry. Each slice follows `release-reliability-checklist`
(typecheck, build, test, responsive; version sync across four `package.json`; CHANGELOG; post-merge deploy and migration check).

| Slice | Scope | Gate |
|---|---|---|
| 0 | **Docs and hygiene.** Index V0.7; fix `HANDOFF.md` line 7 (still "2026-09-13 … 0.52.0"); carry the V0.7 inconsistencies into `DecisionBacklog`; fix the two mislabelled meeting headings. | none |
| 1 | **Patch `0.67.1`: the three missing defaults** (A4), with tests. | none |
| 2 | **Drama.** Visible text, glossary `g-drama`, move text, GM reference, log entries, docs. Keep stored `Party.Misfortune`, enemy `MisfortuneCost`, and the `/party/misfortune` route (see D1). Rename TS helpers and components. | owner confirms D1 |
| 3 | **Core text alignment.** Invoke Expertise trigger; Recuperate 6−; remaining 6− clauses; Fortune Roll move (optional). Seed bump. | none |
| 4 | **Advancement.** Party and Bond advance clear the track; update the tests that lock the old behaviour (`logic.test.ts:855`, `:1247`, `:1361`); Rapport and Potential caps; "Always" Motif options only. | D3 (Rapport clamp history) |
| 5 | **Aid and Party tags.** Aid = Party Skill Tag; GM-only Flaw tags; +3 cap; one tag per teammate per action; roller marks Rapport; remove Rapport-spend Aid from `AdvancementPanel`, `EncounterView`, `AidSection` and the seed. | none |
| 6 | **Bond spend text** and the once-per-scene note. `BOND_SPEND_OPTIONS` text change only. | none |
| 7 | **Strain, Armor, Resist.** Temporary Strain (new `TempStrain` count, marked first, cleared at Make Camp, `normalizeSheet` default 0); multi-Status absorption; Armor Load and descriptions; Strain-clear timing. | D2, D5 |
| 8 | **Death system.** 8a Dying detection (Strain exhausted and nothing to absorb), speed 0, no Recuperate; 8b Take a Scar / Risk Death / Blaze of Glory, second Strain mark per box, four-Scar retirement; 8c Surrender (GM Drama Hard Move) and Resurrection (GM clock). Heroes' Subdued is replaced by Dying; enemies keep Subdued. | owner reviews 8a design |
| 9 | **Combat.** Either side starts a Team-Up (UI, pairing, enemy-side two turns); Combat failure branch (concede, table or Drama); Strain-clear on success only if D2 says so. | D2 |
| 10 | **Hero Roll order presentation** (Advantage known first, Push last, Aid at Push). | Ryan's text updated |
| 11 | **Hold effects per Move**, **GM reference text**, **Safety Tools chapter** (book content; app change only if the owner wants a link). | owner |

Order: 0 and 1 first (no dependencies), then 2 and 3, then 4–6, then 7–9, with 10 and 11 as the owner decides. Slices 4 and 5 both touch
`logic.ts` advancement and Aid code, so do not run them in parallel.

## D — Decisions needed from the owner

- **D1 — Keep stored names?** Recommended: change visible wording to Drama and keep `Party.Misfortune`, `MisfortuneCost`, and the
  route, because renaming needs a legacy-key fallback in `normalizeParty` (same pattern as `RapportAdvancementsTaken`,
  `logic.ts:892-895`), a backfill for `MisfortuneCost` (the admin validator rejects a missing number, `adminLogic.ts:114`), and a
  coordinated API change. Cost: code and UI use different names; record it in `docs/decisions.md`.
- **D2 — Strain on a failed Combat Goal.** V0.7 places "Clear all Strain" under achieving the Goal (L5975); the app clears it on any
  end. Does Strain stay on a failure?
- **D3 — Rapport overflow.** V0.6 slice 7 made banked overflow a deliberate rule: Rapport may exceed the cap and "can fund more than
  one advance in the same sitting" (`types.ts:950-955`, `WorkPlan-V0.6.md` Section A4 item 1), and `logic.test.ts:855` pins it. V0.7
  says the Party "can hold up to 5" and that advancing clears the track (L2034, L2041). Adopting V0.7 reverses that locked decision.
  Confirm the reversal (and the same for Bond, `logic.test.ts:1247`, `:1361`) before slice 4.
- **D4 — Make Camp gating.** V0.7 says advance "the next time you Make Camp"; the app lets a player advance at any time.
- **D5 — Armor in the app.** The app has no concept of "one source" or "body". Keep "any Armor box negates the hit" and only update
  Load costs and descriptions?

## E — Hazards

- Tests that lock the old behaviour must change with their slice; do not weaken them elsewhere.
- Archive freeze: any new mutating route (death system, Surrender) calls `assertCampaignActive`.
- Authorization stays in Express, not RLS.
- No randomness in the engine: Risk Death rolls `+Nothing` at the table; the app records the tier, it does not roll.
- Scars were retired from code deliberately in V0.6 (`types.ts:845-851`); slice 8 revives the field, so say so in `docs/decisions.md`.
- `AdvancementPicker.tsx` does not exist; the advancement UI is `MotifPanel.tsx`, `PartyAdvanceModal.tsx`, `AdvancementPanel.tsx`,
  `ConnectionsPanel.tsx`, `CampaignBonds.tsx`.
- Web has almost no component tests for the touched screens (Strain, Armor, Recuperate, Team-Up, Legendary); each slice adds some or
  states why not.
