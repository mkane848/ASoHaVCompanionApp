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

---

## Part 4 — Reconciliation with Ruleset V0.7 (added after the file arrived)

`Ruleset-V0.7.md` (committed unchanged, 7,092 lines) was compared with the repo's `Ruleset-V0.6.md` by Haiku agents, and I
re-read the core chapter (Hero Roll through Charges) and spot-checked every claim below in the file. It is a **restructure**, not
a patch: a Safety Tools chapter, a rebuilt core-rules chapter, and about 3,500 lines of other-game research and unfinished drafts
in the same file. The app is built on V0.6, so adopting V0.7 is a migration on the scale of the 2026-09-15 revision, and it needs
its own work plan. **First ask Ryan which parts of V0.7 are adopted.** Research dumps, forum quotes, "Possible idea" blocks and
placeholders ("Insert cool prose…", `[image]` stubs) share the file with real rules.

### October 6 items, now answered or not by V0.7

| Item | V0.7 status |
|---|---|
| Misfortune → Drama | **Done everywhere** (0 uses of "Misfortune"; 51 of "Drama"). G2 resolved in the text. |
| Freeform, player-named Boons/Banes | **Done** (L482: rules "won't generally assign them a name"; clear when they stop making fictional sense, L484). Example lists remain. Not written as a count/slot. |
| Temporary Strain | **Done** (L561-563), cleared on Make Camp. G3 resolved in the text; "long rest" from the meeting is not used. |
| Armor categories | **Changed again, differs from the meeting**: Armor stops all Strain from one source; Heavy stops Strain on your body; Special is variable and defined per ability (L552-554). G5 resolved by text, but "Armor from any source" is not what the meeting described. |
| Narrative permissions / follow the fiction | **Done** — new chapter at L714. |
| Hero Roll order | **Unchanged and still ambiguous** (L357-360: tags, Push Yourself, cap, then Advantage, with no statement of what happens before the dice). **G1 still open.** |
| Wealth | **Partly in**: scale of 10 and "freely buy at or below Wealth, pay the exact difference above" (L849-866). L881-886 then pastes a forum-style alternative (cost above Wealth "you can't afford"), which contradicts L851. Unclear which is adopted. |
| Hero's Journey | **Partly in**: L5059 describes the web and names paths (Vanguard, Sentinel, Beacon, Sage, Mystic, Wildheart, Hunter…). Node contents, costs, and connections are not defined. |
| Magic | **Research only** (L895-1167: Use Magic, nouns/verbs, rituals, mixed with attributed Blades/DW2/MOTW text). Rolls `+Weird` and `+INT`, neither of which is a Virtue. Not a rule yet. |
| GM-started Team-Up with Drama | **Not in V0.7.** Still open. V0.7 also contradicts itself on Legendary enemies: two turns after a Team-Up (L5821) vs one turn after every Hero turn (L6030). |
| "Heroes initiated combat" definition | **Not in V0.7**; the file's own note at L6312 says it still needs writing. |
| Brace push-back improvement | **Not in V0.7.** |
| Improvement Drafts / From Other Games | Present only as the raw research and "– Done" blocks (L2197-5058), not a method statement. |

### New in V0.7, not discussed on October 6 (each needs a decision before the app changes)

- **Dying / Scars / Risk Death / Blaze of Glory / Surrender / Resurrection** (L609-656) — a whole new death subsystem, including a second Strain mark per box and a four-Scar retirement.
- **Hold** as a move result (L506).
- **Failing a Combat Goal** now has text (L5981-5983: concede, table decides, or GM spends Drama). `CLAUDE.md` and `HANDOFF.md` list this as an open question; that fence moved, record it in `docs/decisions.md` once Ryan confirms.
- **Potential, Rapport, Bond caps of 5 and full clear** on advancing, replacing "reduce by 5" (L1999-2088).
- **Advance a Motif** can add 1 to a Virtue (max 3) or give a permanent Strain box (L2111-2112); the designer's own question about "after five Motifs" sits right below.
- **Aid** is now Party Skill Tag invocation, usable after the roll, capped at +3, and the tag is spent until Make Camp (L1343-1351). This answers `HANDOFF.md`'s Aid/Party-Tag overlap question, but L2053 still describes the old Rapport-spend Aid.
- **Load** unchanged (3/5/6), Might still modifies it.
- Hero Roll formula adds 3D6/1D6 wording; Invoke Expertise's trigger narrowed.

### V0.7 inconsistencies to send Ryan

1. Bond "−1" bullet (L2098) now penalises the spender's own roll; V0.6 penalised the other character's roll.
2. Aid defined two ways (L1345 vs L2053).
3. Wealth: L851 vs L883.
4. Legendary enemy turns: L5821 vs L6030.
5. Action Points: L5828 ("replaces remaining AP") vs L5860 (restored at end of next turn); the AP block is duplicated.
6. "Example Party Advancement" bullets reference a "CHA" stat that does not exist (L2193).
7. No Subdued duration; L6190 still defines Subdued only for Enemies.

### Revised plan

- **Slice 0 grows**: also add `Ruleset-V0.7.md` to the doc index, record V0.7 as *received, adoption pending*, and carry the seven inconsistencies above into `DecisionBacklog`.
- **Slices 1, 4 and 5 (Drama, Temporary Strain, Armor) are no longer gated on "ruleset text in repo"** — the text is there. They are gated on Ryan confirming V0.7 is canonical.
- **Slice 3 (Boons/Banes)** needs the count/slot model clarified: V0.7 text is freeform but does not say count or slot.
- **New slices once V0.7 is adopted**: Dying and Scars, Hold, advancement caps and Virtue/Strain-box advancement, Aid-by-Party-Tag, Wealth scale. Draft a V0.7 migration plan in the style of `WorkPlan-V0.6-Revision.md` rather than adding these here.
- Gaps G1 (Push/Advantage order) and the Team-Up and "initiated combat" questions remain unresolved and stay fenced.

---

## Part 5 — Rulings received 2026-10-17

Recorded as `docs/decisions.md` item 66. Summary: V0.7 is canonical; magic and the death system are out of scope until
they have concrete rules; V0.7 Armor stands; failing a Combat Goal is a table decision the GM may override by spending Drama;
the Aid Rapport-spend text is a leftover.

**G1 is resolved:** Advantage/Disadvantage is determined before the dice; Push Yourself is an optional post-roll choice; the ±3
cap applies to the final modifier including the Push bonus (provisional, revisit if the cap is hit often); Aid is decided at the
same point as Push Yourself. V0.7's text still reads the old way, so slice 2 (Hero Roll presentation) waits for Ryan's text to match.

Still open: Bond "−1" (owner checking with Ryan), plus the remaining items listed in decisions item 66.

**Bond "−1" resolved (2026-10-17):** option B. The bullet becomes "−1 to a Hero Roll they are making against you or an action
against your direct wishes"; the widened +1 bullet and the "selfish or detrimental" intro are intended; spending Bond costs
nothing else. Recorded in `docs/decisions.md` item 66. `BOND_SPEND_OPTIONS` (`packages/shared/src/logic.ts`) is updated in the
V0.7 migration. Still to remove: the V0.7 typo `..` in that bullet, and Ryan should confirm the final wording in the ruleset.
