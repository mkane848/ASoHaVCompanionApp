# V0.6 Decision Backlog

Action items from the design meeting notes ([`Meeting Notes/Design Meeting Summaries.md`](Meeting%20Notes/Design%20Meeting%20Summaries.md), 2026-07-24 → 2026-09-15) that still need a decision from Mike and Ryan, cross-referenced against [`WorkPlan-V0.6-Revision.md`](WorkPlan-V0.6-Revision.md) and [`WorkPlan-V0.6.md`](WorkPlan-V0.6.md).

Status legend: **open** = no decision made · **settled** = the revision closed it · **flagged** = implemented per the revision's own unclear text and marked, awaiting confirmation.

---

## A. Rules the revision deliberately leaves open (WorkPlan section D — "do not guess in code")

These are the "TBD / ???" markers the V0.6 revision explicitly refuses to invent in code. Each blocks or constrains the slice that touches it until both designers answer.

| # | Item | Status | Where it bites | Notes |
|---|---|---|---|---|
| 1 | **Aid vs Party Skill Tags overlap** | open | Slices 2, 8 | Rules text has its own NOTE: *"Does Aid provide the same resource as invoking a Party Tag?"* 09-15 meeting: Aid must be *removed, combined, or redesigned* — no choice made. Plan keeps Aid as-written with the +3 cap and flags it (D1). |
| 2 | **Subdued outcome** | open | Slice 1 (1E) | Core text still says "TBD" and "BLAZE OF GLORY???"; only the new "Subdued Heroes" paragraph is built (D2, A2.3). 09-03 meeting left "what happens when no eligible Strain box remains" unresolved (Subdued / Last Stand / capture / surrender). |
| 3 | **Improvement content** | open | Building block for Hero, Party, Bond advancement | 25 Hero trees are *names only*; Party Improvements are 4 examples; Bond Improvements are an empty heading (D3). Slices build mechanisms against placeholders/freeform. **The largest authorship debt — Ryan writes the actual improvements, or you both accept placeholders as the shipped state.** 08-27 meeting asked how large these menus should be. |
| 4 | **Consequences of losing a Combat Goal** | open | Slice 6 | "Consequences of 'losing' a fight are???" (D4); 09-15 meeting treated explicit failure-stakes (GM states what happens if the Goal fails) as a "proposed addition," not adopted. |
| 5 | **"Depleted" resource definition** | open | — | "need to define what those could be" (D5). |
| 6 | **Follow a Lead — "DEFINE more clearly"** | open | — | (D6). |
| 7 | **Recuperate — "Improvement on 12+??"** | open | — | (D7). |
| 8 | **"Bond for Interpose?"** | open | Slice 6 (6C) | (D8). |
| 9 | **Villain Skill Tags mechanics** | open | Slice 7 | "*How do these work mechanically?? Same as Heroes?*" (D9). Enemies make no Hero Rolls so nothing is built; 08-26 meeting wanted villain tags to echo player tags. |
| 10 | **Repeated Attacks "window"** | flagged | Slice 6 (6D) | Rule's parenthetical ("at the beginning of their last turn") clashes with AP restoring at turn end; app follows primary wording and flags it (D11). |
| 11 | **Engage at Range rolls +Might** | flagged | Slice 6 (6D) | Followed as written, flagged in UI (D12) — a confirmation, not a real question. |
| 12 | **Major-Status Disadvantage + Boon/Bane stacking** | open | — | Shown separately, uncleared (D13). |
| 13 | **Scene-boundary abuse / Resist balance** | open | — | Carried from 09-03; no anti-spam rule for Strain-clearing at scene ends (D14). |
| 14 | **Camp Assets** | open | — | Separate system vs folded into Party Improvements — 09-15 called it undecided; data kept, no new UI (D15). |
| 15 | **Selfish play** | open | — | Does it cost Rapport or damage Bond — 09-15 unresolved ("Can Rapport decrease?") (D16). |
| 16 | **Naming** | open | — | Motif vs Aspect, Act Break vs Act, Mystic vs Mythic (D17; 08-27 + 09-15). The app already ships "Motif." |
| 17 | **Misfortune "at the beginning of a Session"** | flagged | Slice 2 (2C) | App has no session concept; the GM's "begin session" control *is* the implementation (D18). Confirm that's acceptable. |

---

## B. Meeting action items that never landed in any workplan

- **Two-character playtest party** — 08-19's core directive: build a *complete 2-PC party* (themes + quests) as the next major design test. Never built or run; the informal Dana exercise (09-15) was creation-only. Decide scope / who authors it.
- **Sample / tutorial adventure** — repeatedly requested (08-19, 08-26, 09-03): an adventure in the game's own framework to stress-test the rules. No workplan slice produces one.
- **Character retirement / NPC conversion / unretirement** — 08-26 and 09-15 design directions (retire into the world, become an NPC/connection, start fresh). Nothing in either workplan models it.
- **Public-domain visual direction** — 09-15: Ryan researching public-domain fantasy art (Hildebrandt style); Mike to help. Still open, no deliverable slot.

### Closed by the revision

- **GM hard/soft moves guidance** — 09-15 flagged as missing; `A2.11` now authors it (running rules, 22 principles, 28 moves, Misfortune pricing).
- **Countdown's "sixth stage"** — 08-26 flagged; the revision confirms "five," matching the app (A1).
- **Kin term** — 09-01 removed it (Bond only); `A2.6` builds Connections.

---

## C. Process / sequencing decisions

1. **Which slice next, and in what order?** Completed: Slice 0 (`0.54.2`), Slice 1 (`0.56.0`), Slice 3 (`0.55.0`). Remaining unbuilt: **2 (Misfortune), 4 (Party page), 5 (Connections/Bond), 6 (Combat loop), 7 (Enemies), 8 (Moves/Camp/GM reference), 9 (table aids)**. Default sequencing is one slice at a time; the cross-slice **Waves (C6)** need permission to run several branches at once.
2. **Live library resets required** after slices 1, 2, 4, 5, 7, 8 (B2) — each changes `seedLibrary.ts`. Confirm the Content Admin reset entries that already assume — slice 1 (✅) was confirmed done.
3. **Planning-docs hygiene:** `Planning Docs/_Design Meeting Summaries.md` (root) is a byte-duplicate of `Planning Docs/Meeting Notes/Design Meeting Summaries.md` (the one the workplan cites). Decide which is canonical to avoid future drift.

---

## Priority callouts

- **#3 (Improvement content)** is the single most consequential open item — it gates Hero, Party, and Bond advancement depth and is the largest authorship task.
- **#1 (Aid vs Party tags), #2 (Subdued), #4 (Combat Goal failure)** are the mechanical decisions you'll likely feel in the next playtest.