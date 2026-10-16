# Work plan — 2026-10-06 design meeting

Sources: the October 6 summary (PDF `Copy of Design Meeting Summaries`, final section) and the raw transcript
`20261006_Transcript.txt`. The PDF's July–September 15 sections match `Meeting Notes/Design Meeting Summaries.md`
apart from layout, so October 6 is the only new material. Repo state checked: app `0.67.0`, ruleset V0.6 (2026-09-15 revision).

**Status labels are the meeting's own.** Nothing in the October 6 summary is marked "decided"; its strongest wording is
"landed on" and "preferred". Per `CLAUDE.md`, open rules questions are a fence: this plan does not implement them.
Only the transcript was read for what was agreed aloud, and where it disagrees with the summary that is called out in Part 3.

## Part 1 — Implementation plan

Everything that changes rules behaviour is **blocked on Ryan's updated ruleset text**. Ryan said in the transcript that
Temporary Strain and the Armor change are already drafted in the working document, but neither is in `Ruleset-V0.6.md`.
The app should follow the ruleset, not the meeting, so slice 0 comes first.

| Slice | What | Gate | App impact |
|---|---|---|---|
| 0 | Record the meeting: add the Oct 6 summary and transcript to `Meeting Notes/`, add judgment calls to `docs/decisions.md`, add the open questions to `DecisionBacklog-V0.6.md`, fix `HANDOFF.md` line 7 (still "2026-09-13 … 0.52.0", app is 0.67.0) and the two mislabelled meeting headings (`08 26` holds Aug 25, `09 01` holds Aug 27). | None | Docs only |
| 1 | **Drama rename** (Misfortune → Drama). Display label only; never rename the `Misfortune` wire field in `types.ts` (JSONB shapes are stored verbatim). Route every user-facing string through one constant. | Ryan confirms the name (summary: "not formally finalized") | Labels, seed text, glossary |
| 2 | **Hero Roll presentation.** Move the ±3 floor/ceiling wording to a tooltip (agreed in passing, transcript L50). Do **not** change engine order of operations. | Order of Push Yourself vs Advantage settled (Part 3, G1) | UI copy only |
| 3 | **Boons/Banes freeform.** Moves say "gain a Boon/Bane"; the player names it; tracked as a count/slot like items, not a list. Needs a read of how the current Library and sheet model Boons before sizing (not done yet). | Ruleset text rewritten; persistence rule stays a table judgment ("while fictionally relevant"), so nothing auto-clears | Possible `normalizeSheet` default plus UI |
| 4 | **Temporary Strain** — extra boxes marked first, vanish when marked, cleared on camp. | Ruleset text in repo; resolve "make camp" vs "long rest" (G3) | Engine, sheet, `normalizeSheet` default |
| 5 | **Armor revision** — Armor stops Strain from any source; Heavy for tanky builds; Special Armor becomes a generic limited-use resource. Today's ruleset (L1108-1110) says Special Armor stops "attacks of the mind". | Ruleset text in repo; Heavy Armor wording is garbled in the transcript | Engine (`combat.ts`), sheet, seed library |
| 6 | **Brace push-back** (reduce forced movement below zero → push the attacker) as an Improvement. | First playable Improvement set exists | Improvement library entry |
| 7 | **GM-initiated Team-Up Turn** by spending Drama. | Joint decision: may heroes answer immediately? | Combat engine, held until decided |
| 8 | **"Heroes initiated combat"** — ambush ≠ initiated; confronting and knowingly escalating = initiated. The engine already takes `initiatedByHeroes`; only help text could change. | Terminology; Ryan owns the rewrite | Help text at most |
| 9 | **Clocks** — rules unchanged, formatting only (Mike rewriting). | None | None |
| — | **Not for the app yet:** Hero's Journey map, Improvement Drafts, magic (verb/noun pools), abstract Wealth. All proposal-only; Hero's Journey branch count and connection rules are undecided. Wealth stays the per-character number in `HANDOFF.md` until the proposal is tested. | Playtests | Candidates for `docs/not-built.md` |

Each shipped slice follows the usual release path (shared types rebuilt, `normalize*` defaults, version bump across four
`package.json` files, CHANGELOG, `release-reliability-checklist`). Slices 3–5 touch the engine and must keep it deterministic.

## Part 2 — Items nothing in the work docs records

No October meeting exists anywhere in the repo, so all of Part 3's inputs are unrecorded. Specific unrecorded items,
confirmed by grep (not found in ruleset, backlog, work plans, HANDOFF, decisions, or shared source):

1. Misfortune → Drama.
2. Boons/Banes as player-named, count-tracked, move-granted ("gain a Boon").
3. Temporary Strain.
4. Armor: any-source / Heavy / generic Special Armor.
5. Brace push-back improvement.
6. GM spends Drama to start an enemy Team-Up Turn, and whether heroes answer.
7. Definition of heroes "initiating" combat.
8. Hero's Journey (ex-Hero's Path) radial improvement map and its rules (no prerequisites, branch from any connected node).
9. Improvement Drafts / "From Other Games" research method.
10. Magic as verb + noun pools; no divine/arcane split.
11. Abstract Wealth rating.
12. "GM as editor" guidance; "no reskinning, only skinning"; hard moves announced aloud.

**In the transcript but not in the summary:** missed-roll guidance under basic moves; a hard-move section saying what Drama is
spent on (Ryan owns it); a bane-like bullet for effects such as Immobilize; healing and grappling clarity questions;
Headway vs Opposition Clock "when to use which" ambiguity; Load and Charges explicitly unchanged; Mike to prototype the
tree mechanics before writing skills; Ryan wants a second designer writing abilities; Mike keeps raw transcripts in his repos.

## Part 3 — Conflicts to settle (do not guess)

- **G1 Push Yourself vs the roll.** Mike (L44) says Push Yourself is decided *after* the roll; the ruleset (L1412) says
  declare the second Skill Tag *before* rolling. Separately, Mike argues Advantage changes the dice so it should be known
  *before* rolling (L74) while the summary's three-stage order puts it last. The engine itemizes modifiers, so this order matters.
- **G2 Drama.** Summary says the rename was not finalized; in the transcript both say they like it and Mike says "I'll write that",
  yet both keep saying "Misfortune or Drama" afterwards.
- **G3 Temporary Strain clearing.** "Make camp" (L1225) vs "until you long rest" (L1244, Mike's example).
- **G4 Is Temporary Strain core rule or Improvement?** Ryan: written as a core rule under Strain and Statuses, granted by Improvements.
- **G5 Heavy Armor.** One transcript passage is cut off ("and then for stuff specifically dealing with your body").
- **G6 Subdued duration.** `CLAUDE.md` lists it as open. The transcript only praises "subdued, ending combat"; it answers nothing.

## How this was produced

Five Haiku agents read the PDF summary, the two transcript halves, the repo docs, and diffed the PDF against the repo notes.
I checked their output against the source: the summary pages directly, the key transcript lines (Push/Advantage order, Drama,
Boons as a count, GM Team-Up, Brace, Temporary Strain, Armor), the repo greps against `Ruleset-V0.6.md`, and the diff result.
I did not re-verify every one of the roughly 170 extracted items. The transcript is speech-to-text, so several quotes are garbled.
