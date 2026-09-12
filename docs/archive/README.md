# Archive — completed work plans and audits

Everything here is **done**, not wrong. These are the plans and audits that drove past releases,
kept because they record *why* a thing was built the way it was — including the judgment calls made
where a source document was ambiguous or contradictory. None of them describe current behaviour.

**For current behaviour, read `docs/architecture/`.** For the release history, `CHANGELOG.md`.

This directory is deliberately separate from `Planning Docs/archive/`, which holds **superseded
rules files** — documents that are no longer true. The distinction is the point: a completed work
plan was executed, while a superseded ruleset was replaced.

| File | What it covers | Shipped as |
|---|---|---|
| `WorkPlan-V0.5.md` | The nine-slice migration onto ruleset V0.5, and the judgment calls made where V0.5 was ambiguous. Its target ruleset has itself since been superseded by V0.6. | `0.28.0`–`0.36.0` |
| `WorkPlan-0.23.0.md` | Sheet reorder — Virtues\|Statuses to the top, Theme/Looks paired. Combat moved inline onto the Campaign Shell. | `0.23.0` |
| `WorkPlan-0.24.0.md` | Container queries per panel, the Background panel merge, explicit glossary tags, `HistoryModal`. | `0.24.0` |
| `WorkPlan-0.25.0.md` | Mobile-device cleanup from direct repo-owner testing: `.action-grid`, the Glossary drawer, the tooltip-nesting fix. | `0.25.0` |
| `WorkPlan-0.26.0.md` | The switchable appearance system (Parchment + Notice Board) and the three token tiers. | `0.26.0` |
| `WorkPlan-0.37.0.md` | Invite email delivery, the Adventure Prep layout rework, write-in NPC/Location types. | `0.37.0` |
| `WorkPlan-0.38.0.md` | The UI review round's four **state** items: Realtime coverage, the setup checklist, Home's lanes, phase-gated Combat. | `0.38.0` |
| `WorkPlan-0.39.0.md` | The review's four **layout/appearance** items, plus the Notice Board default flip. | `0.39.0` |
| `ResponsiveAudit.md` | The 2026-08-02 UI responsiveness audit — every number measured in a real browser, not estimated. Phase 6 turned it into the `test:responsive` suite that guards the findings now. | six phases, `d268fa3`…`0471275` |
| `UIReviewRound_Handoff.md` | The repo owner's UI review round as received, before it was staged into the two work plans above. | `0.38.0`–`0.39.0` |

## Two documents that are *not* here, on purpose

`docs/AppThemeGuidelines.md` and `docs/TechStackAudit.md` sit one level up, un-bannered, because
they are still live reference rather than history: the first describes the appearance system the app
currently ships, and the second still has open items (`HANDOFF.md` item 16 — local JWT verification
and compression middleware, both deliberately unbuilt).

## Why the filenames were not tidied

These kept their original names through the move. Roughly 30 source-code comments cite
`TechStackAudit.md` by bare filename, and the living docs cite the work plans the same way;
renaming to a `kebab-case` convention would have made every one of those citations wrong as a
*name*, not merely as a path, for purely cosmetic gain. Bare-filename citations elsewhere in the
repo therefore still resolve — via this table.
