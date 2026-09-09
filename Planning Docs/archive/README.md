# Archive — superseded rules files

Everything in this directory describes the game **before** the V0.6 ruleset was adopted on
2026-09-09. None of it is authoritative. It is kept because the shipped code was built against
it, so it explains why the app looks the way it does.

**The current ruleset is `Planning Docs/Ruleset-V0.6.md`.** The staged migration from V0.5 to
V0.6 is `WorkPlan-V0.6.md`.

The archive now has two generations in it. `Ruleset-V0.5.md` is the immediately-previous ruleset,
adopted 2026-09-01 and shipped across `0.28.0`-`0.36.0`; the six files below it are the pre-V0.5
generation the app was originally built from.

| File | Covered |
|---|---|
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
`Ruleset-V0.6.md` now succeeds V0.5 in turn.
