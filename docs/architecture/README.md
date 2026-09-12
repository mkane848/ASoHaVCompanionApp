# Architecture

One document per subsystem, each describing **what the app actually ships today**. The per-slice
framing these were written in — "slice 4 of the V0.6 migration did X" — is preserved inside them
where it carries a warning worth keeping, but the organising question here is *what does this
subsystem do*, not *which release built it*.

`CLAUDE.md` holds the short version plus the invariants a session must not violate. This is the
detail behind it. For how the app got here, see [`../history/`](../history/README.md).

| Document | What it covers |
|---|---|
| [`data-and-access.md`](data-and-access.md) | **Read this first.** Authorization lives in the Express layer, not in RLS. Realtime's joinless-policy constraint. JSONB blob shapes and the read-time-default rule. |
| [`rules-engine.md`](rules-engine.md) | Roll-modifier transparency (the app never rolls dice), Strain, severity Statuses, Boons and Banes, the Healing Track, Skill/Flaw Tags. |
| [`combat.md`](combat.md) | Track-and-display Encounters, Range bands with no rendered grid, per-Status Enemy Limits, Gambits, Reaction Moves. |
| [`clocks.md`](clocks.md) | Opposition / Threat / Project / Tug-of-War, Developments, the Quest Board. |
| [`party-and-bond.md`](party-and-bond.md) | The Bond handshake and its row locking — the one real concurrency risk in the app — plus Rapport, Aid, and Hero Improvement Trees. |
| [`moves-and-camp.md`](moves-and-camp.md) | The 22 seeded Moves, the guided Camp flows, party identity and Camp Assets. |
| [`character-sheet.md`](character-sheet.md) | Load and wildcard declarations, Pronouns, and the Wealth / Treasure / Hold economies. |
| [`campaign-lifecycle.md`](campaign-lifecycle.md) | The archive freeze, the three setup phases, and invites. |
| [`gm-content.md`](gm-content.md) | Adventures (GM-only end to end), Villain/NPC/Location stat blocks, Creating the World. |
| [`content-admin.md`](content-admin.md) | The schema-driven designer panel: 14 collections, 11 field types, and the server-side rules a new route must not route around. |
| [`frontend.md`](frontend.md) | The largest single body of convention here — state, type and spacing scales, touch targets, container queries, shared components. |
| [`appearances.md`](appearances.md) | Parchment and Notice Board, the three token tiers, and why it is never called "Theme". |

## Where the subsystem boundaries came from

These twelve files were split out of `CLAUDE.md`'s 33 sections by subsystem rather than by release.
Two of them — `moves-and-camp.md` and `character-sheet.md` — were not in the original plan's ten-file
tree; they exist because Moves/Camp came to 321 lines and the sheet's own resource economies to 215,
and folding either into `rules-engine.md` would have produced a file with no single subject.
