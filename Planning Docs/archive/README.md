# Archive — pre-V0.5 rules files

Everything in this directory describes the game **before** the V0.5 ruleset was adopted on
2026-09-01. None of it is authoritative. It is kept because the shipped code was built against
it, so it explains why the app looks the way it does.

**The current ruleset is `Planning Docs/Ruleset-V0.5.md`.** The staged migration from what these
files describe to what V0.5 requires is `WorkPlan-V0.5.md`.

| File | Covered |
|---|---|
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
`Planning Docs/Ruleset-V0.5.md` is that document's adopted successor and closes the gap.
