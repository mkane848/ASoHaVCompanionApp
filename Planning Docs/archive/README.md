# Archive — superseded rules files

Everything in this directory describes the game **before** the current ruleset text was adopted on
2026-09-22. None of it is authoritative. It is kept because the shipped code was built against
it, so it explains why the app looks the way it does.

**The current ruleset is `Planning Docs/Ruleset-V0.6.md`** — Ryan's 2026-09-15 revision of V0.6,
adopted 2026-09-22. The migration onto V0.6's first text is `WorkPlan-V0.6.md` (complete); the
migration onto the revision is `WorkPlan-V0.6-Revision.md` (planned).

The archive now has three generations in it. `Ruleset-V0.6-2026-09-09.md` is the
immediately-previous text (adopted 2026-09-09, shipped across `0.42.0`-`0.49.0`);
`Ruleset-V0.5.md` came before it (adopted 2026-09-01, shipped across `0.28.0`-`0.36.0`); and the
six pre-V0.5 files below them are the generation the app was originally built from.

| File | Covered |
|---|---|
| `Ruleset-V0.6-2026-09-09.md` | The whole game, 2026-09-09 to 2026-09-22 — V0.6 as first adopted. Strain, severity Statuses, Boons/Banes, the Healing Track; Conditions at −2 floored at −3; a Combat chapter still byte-identical to V0.5's, reconciled in code by `WorkPlan-V0.6.md` Section B1. Retained because `0.42.0`-`0.54.x` were built against it and code comments quote it. |
| `Ruleset-V0.5.md` | The whole game, 2026-09-01 to 2026-09-09. Ranked Statuses (1-6), Recoveries, Scars/Risk Death/Blaze of Glory, six WIP Clock variants. Retained deliberately: V0.6's Strain model is an experiment (2026-09-03 meeting) and this is what testing would fall back to. |
| `TheBasics.md` | Virtues, Conditions, Statuses. Ended mid-sentence; the Statuses section was one line. |
| `TheGear.md` | Armor (Physical/Heavy/Special), Load bands, item Charges. |
| `Advancements.md` | The three tracks (Potential/Kin/Rapport), Bond mechanics, Tier gating. The most load-bearing of the six — README items 8, 17 and 18 cite it. |
| `TheMoves.md` | Basic and Adventure Moves. Contained two overlapping drafts in one file. |
| `TheSkills.md` | Skills brainstorm — alternatives, never a spec. |
| `TheArc.md` | Arcs and Quests authoring guidance. |

`handoff-rules/` holds the byte-duplicates that used to sit inside the extracted design handoff.

## What was never here

README.md item 12 and `CHANGELOG.md` 0.13.0-0.18.0 cite a "14,000+ line working design doc" as
the authority for Combat Basics V2.2, Gambits, Toughness, enemy stat blocks and the
Crumble/Dishonored merge. **That document was never committed to this repository** — it is absent
from `git ls-files`, from deleted-file history, and from disk. The Combat system shipped in
0.14.0-0.16.0 could not be checked against its own stated source for thirteen versions.
`Ruleset-V0.5.md` (now in this directory) was that document's adopted successor and closed the gap;
V0.6 succeeded V0.5 in turn, and the 2026-09-15 revision of V0.6 succeeded its first text.
