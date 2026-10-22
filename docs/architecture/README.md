# Architecture

One document per subsystem, describing what the app ships today. Each file's section headings
carry the release or slice that added them, so a change can be traced to its history.

`CLAUDE.md` holds the short version and the invariants a session must not violate. Start with
[`data-and-access.md`](data-and-access.md): authorization is in the Express layer, not RLS.

| Document | What it covers |
|---|---|
| [`data-and-access.md`](data-and-access.md) | Authorization in Express, not RLS. Realtime's joinless-policy constraint. JSONB shapes and read-time defaults. |
| [`rules-engine.md`](rules-engine.md) | Roll-modifier transparency (the app never rolls dice), Strain, Statuses, Armor and Temporary Strain, Dying, Surrender and Resurrection, Skill/Flaw Tags. |
| [`combat.md`](combat.md) | Track-and-display Encounters with Range bands and no grid, Enemy Limits, Gambits, Reaction Moves, Team-Up Turns. |
| [`clocks.md`](clocks.md) | Opposition, Threat, Project and Tug-of-War Clocks, Developments, the Quest Board, Resurrection links. |
| [`party-and-bond.md`](party-and-bond.md) | The Bond handshake and its row lock, Rapport, Aid, Improvement Trees, Drama, the Party, Connections. |
| [`moves-and-camp.md`](moves-and-camp.md) | The 23 seeded Moves, guided Camp flows, party identity, Camp Assets, the GM reference drawer. |
| [`character-sheet.md`](character-sheet.md) | Load and wildcard declarations, Pronouns, Wealth, Treasure and Hold (spent per Move), Scars, Dying and the end of a Hero. |
| [`campaign-lifecycle.md`](campaign-lifecycle.md) | The archive freeze, the setup phases, and invites. |
| [`gm-content.md`](gm-content.md) | Adventures (GM-only), Villain/NPC/Location stat blocks, Creating the World. |
| [`content-admin.md`](content-admin.md) | The schema-driven designer panel: 18 collections, 11 field types, and the server-side rules a new route must not bypass. |
| [`frontend.md`](frontend.md) | State, type and spacing scales, touch targets, container queries, shared components, the Safety Tools page. |
| [`appearances.md`](appearances.md) | Parchment and Notice Board, the three token tiers. |
