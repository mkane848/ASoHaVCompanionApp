# Release history — how the app got its shape

This was `CLAUDE.md`'s opening section, which had grown into a version-by-version narrative of every release. It is kept because it explains why the app looks the way it does, and moved because it was the first thing every session read and almost never the thing it needed.

_History. For current behaviour see [`docs/architecture/`](../architecture/README.md)._

---

Four surfaces in one app: the player **Character
Sheet** (now backed by a real rules engine as of `0.13.0` — roll-modifier breakdowns, Status
give/heal/Resist, the Subdued chain — see "Architecture: the rules engine" in `docs/architecture/rules-engine.md`; extended in
`0.18.0` with Wealth/Treasure resources, an informational Advantage/Disadvantage roll flag, and
the End the Session Rapport/Hold flow — see "Architecture: Wealth, Treasure, Advantage, and End the
Session" in `docs/architecture/character-sheet.md`), the designers' **Content Admin** panel (library CRUD, validation, changelog, user
account management, and cross-campaign Play Data deletion as of `0.8.0`), the **Campaign
Shell** (roster, invite send/accept/decline, a GM-controlled campaign-setup phase — Signup → Party
Creation → Playing, as of `0.12.0` — character creation, GM live-peek, the Bond handshake, GM-only
campaign archiving as of `0.11.0`, and a live **Combat** Encounter view as of `0.14.0`–`0.16.0` —
see "Architecture: Combat" in `docs/architecture/combat.md`), and, as of `0.36.0`, a GM-only **Adventure Prep** surface
(`/c/:campaignId/adventure` — Concept, Type, Hook, a linked Villain, NPCs and Locations, floating
Secrets, and a working Countdown; see "Architecture: Adventures" in `docs/architecture/gm-content.md`). A full codebase/rules/
schema audit in `0.17.0`–`0.18.0` fixed
several gaps between the shipped code and `Planning Docs/` that had gone unnoticed for multiple
versions — see `HANDOFF.md`'s twenty-second/twenty-third session notes before assuming a stale
rules doc mismatch is new. A separate engineering-quality audit in `0.19.0`, run against all six
Claude Code skills installed in the repo at the time (nine now — four project-authored, five
vendored, see "Working conventions" below) rather than against `Planning Docs/`, fixed a different
class of gap — design-token drift, an N+1-shaped hot route, missing modal/heading/label
accessibility, an unsplit bundle, and a boolean-prop-matrix component — see `HANDOFF.md`'s
twenty-fifth session notes and the `0.19.0` `CHANGELOG.md` entry for the full list. A mobile-
device UI cleanup pass in `0.25.0`, driven by direct repo-owner testing feedback rather than an
audit, added the `.action-grid` layout primitive (see "Frontend conventions" below), a player-
facing **Glossary drawer** reachable from both the sheet and the Campaign Shell, and a real fix
for a tooltip-nesting bug — see "Architecture: the rules engine" in `docs/architecture/rules-engine.md` for the glossary depth-cap
details and `HANDOFF.md`'s corresponding session note. A switchable **appearance** system landed in
`0.26.0` — Parchment (the original look, the default through `0.38.0`; Notice Board became the
default in `0.39.0` — see "Architecture: appearances" in `docs/architecture/appearances.md`) and a second, dark **Notice Board**
appearance built on a papers-pinned-to-a-corkboard metaphor for the sheet's tag collections, with
its own self-hosted display/body typefaces — and the parchment-damage overlay was deleted entirely,
from both appearances, in the same pass. See "Architecture: appearances" in `docs/architecture/appearances.md` and
`AppThemeGuidelines.md` for the full reasoning, including two deliberate, dated reversals of that
document's own prior "no wood grain, no drop shadows pretending to be a physical object" principle,
scoped to Notice Board only. Built from a
static-prototype design handoff in `Planning Docs/` — when
in doubt about intended behavior, that's the source of truth, and judgment calls made where the
handoff was ambiguous or contradictory are documented in
`README.md#architecture-notes--judgment-calls`. A large, messier working design doc also exists in
`Planning Docs/` (see "Architecture: the rules engine" in `docs/architecture/rules-engine.md` for how it was reconciled) — parts of
it are outdated drafts or unrelated
brainstorming, not all of it is current design. A `0.27.0` audit-driven perf/tooling/dependency
pass — executing `TechStackAudit.md`'s section G "Order of work" in full except one deliberately-
skipped item (see `HANDOFF.md`) — adopted React Compiler, Vite 7, and react-router 7 (renamed from
`react-router-dom` 6), alongside a real bundle budget, a `/bootstrap` server round-trip reduction,
cache headers, and `apps/web`'s first vitest coverage; see
`README.md#architecture-notes--judgment-calls` item 28 for the RSC/TanStack Start question the
audit was actually asked to answer (verdict: adopt neither) and the `0.27.0` `CHANGELOG.md` entry
for the full list. A new ruleset draft, *A Story of Heroes and Villains V0.5*, was adopted as the
game's single source of truth immediately after, in a docs-only pass — no version bump, no
CHANGELOG entry, no source file touched — see "Architecture: the ruleset and where it lives" in `docs/history/ruleset-migrations.md`
below. **Slice 1 of that migration shipped in `0.28.0`** — the rules primitives: the Status box model,
Crumble replacing Dishonored, Unstable at Rank 4, Recoveries-0 forcing Exhausted, the Kin → Bond
rename, and Rapport becoming spendable as Aid. **Slice 2 (`0.29.0`)** rebuilt character identity
around three Motifs, replacing Theme and the old authored Skills/Abilities catalog with freeform
Skill/Flaw Tags and per-Motif Potential. **Slice 3 (`0.30.0`)** seeded all 22 V0.5 Moves with
schema-validated result tables and re-mechanised Hold and Advantage/Disadvantage for the triggers
that slice's own scope could reach. **Slice 4 (`0.31.0`)** replaced the flat, Tier-gated
Advancement pick list with V0.5's Improvement Tree model — DAG-gated, not Tier-gated, a repo-owner
call made after finding the doc states the gating rule two contradictory ways — but only for Hero
Improvements: Party and Bond Improvements have no authored tree content in the doc at all (not
even names, let alone nodes) and stayed out of scope; see "Architecture: Hero Improvement Trees,
Rapport (party), and Bond (social)" in `docs/architecture/party-and-bond.md`. **Slice 5 (`0.32.0`)** brought Combat up to date against
`Ruleset-V0.5.md`'s own Combat Basics text — per-unit turn order, an automated Repel Gambit, the
Resist Reaction Move, a Cover Status picker, minimal Boss-Enemy wiring, and the real two-branch
Combat-start Rapport modifier — see "Architecture: Combat" in `docs/architecture/combat.md` for what shipped and what stayed
deliberately out of this slice's scope (a full grid, real Boss-ability content, and an enforced
turn-order algorithm rather than a GM-overridable suggestion). **Slice 6 (`0.33.0`)** added
Clocks — the first genuinely new play-state subsystem since Combat — collapsing the doc's six named
variants into three `Kind`s (`Basic`, `Countdown`, `TugOfWar`) after the doc's own "Clocks" chapter
turned out to be explicitly marked "WIP" and self-contradictory about whether two of its variants
are even the same thing; see "Architecture: Clocks" in `docs/architecture/clocks.md` for the two repo-owner decisions that
scoped it. **Slice 7 (`0.34.0`)** gave the party its own shared identity — Motif, Quest, Skill/
Weakness Tags, a Path — and Camp Assets, then turned four Adventure Moves (Make Camp, Keep Watch,
Undertake a Journey, Enjoy Downtime) that had shipped as reference-text-only in slice 3 into real
guided flows built on the same "player reports the tier, the engine applies the mechanical change"
pattern the rest of the app already uses; see "Architecture: Party Identity & Camp" in `docs/architecture/moves-and-camp.md` for what
shipped, what stayed deliberately narrower than the doc's own wording, and the three repo-owner
decisions (Camp Assets' hybrid catalog-or-freeform picker, wiring "Progress a Personal Project
Clock" to the real Clocks subsystem, and freeform Party identity fields) that scoped it. **Slice 8
(`0.35.0`)** gave the designers' Content Admin panel three new authored GM stat-block collections —
Villains, NPCs, and Locations — extending the existing `library.enemies` pattern rather than
inventing a new one, and along the way retrofitted `EnemyTemplate.StatusLimits` off raw, unvalidated
JSON onto the same real, schema-validated field type the two new collections needed anyway; see
"Architecture: GM stat blocks" in `docs/architecture/gm-content.md` for what shipped and what deliberately stayed out (Villains
aren't wired into Combat as spawnable Boss participants — that bridge, if it's ever built, is later
work). **Slice 9 (`0.36.0`)** closed out the migration with Adventures — the fourth surface named
above — referencing slice 8's own Villains/NPCs/Locations rather than redefining them, plus a
Countdown mechanic that deliberately reuses `Clock`'s tick-and-clamp logic without ever creating a
real, player-visible `Clock` row (an Adventure's Concept/Villain/Secrets/Countdown are GM-only
spoiler content this app never sends a Player at all — see "Architecture: Adventures" in `docs/architecture/gm-content.md` for
why that ruled out the otherwise-obvious "just create a linked Clock" design). All nine slices of
the V0.5 migration are shipped as of `0.36.0` — every `> **V0.5:** ... not built.` marker
elsewhere in this file and in `README.md` describing slice 1-9 content has been flipped to a real,
shipped description in the section it annotates; nothing in the ruleset's own nine-slice plan
remains unbuilt. Slices landed as `0.28.0`-`0.36.0`. **`0.37.0`**, a maintenance release against
three independent repo-owner requests rather than a `Ruleset-V0.5.md` slice, gave campaign invites
real (best-effort) email delivery alongside the existing code/link — see "Architecture: campaign
invites" in `docs/architecture/campaign-lifecycle.md` — reworked the Adventure Prep panel's responsive layout and accessibility (a
`page-shell-form`-to-`page-shell` width change, a named CSS container pairing NPCs/Locations, real
heading structure), and let `NPC.Type`/`Location.LocationType` take a write-in value alongside their
authored options. **`0.38.0`** is the first of two releases implementing a full UI review round
with the repo owner (`UIReviewRound_Handoff.md`, staged as `WorkPlan-0.38.0.md`/
`WorkPlan-0.39.0.md`) and takes the four review items about **state**: Realtime now covers
`campaigns`/`memberships`/`characters` (a new migration, `0013`), a shared `CampaignSetupChecklist`
gives both GM and Player a "what am I waiting on" view of Signup/Party Creation/Playing, Home
splits into "campaigns you run"/"campaigns you play in" lanes with a phase badge and waiting hint
per tile, and Combat is now hidden — in the UI and rejected server-side — until a campaign is
actually Playing. See "Architecture: campaign setup phases" in `docs/architecture/campaign-lifecycle.md` for the phase-gating pieces this
release builds on. **`0.39.0`** takes the review's remaining four items, about layout and
appearance, plus the cross-cutting decision that **Notice Board becomes the default appearance**
(a one-time forced reset via a storage-key rename, no migration code): the Motif card readability
bug that becomes the default first impression the moment that lands is fixed in the same release,
`PeekCard` gets both a literal Potential-label fix and a two-column restructure, `BackgroundPanel`
splits Motifs 66% / Looks 33% (an explicit repo-owner layout call), and Statuses' three polarity
groups become columns — the last of these closing the one piece of the `0.24.0` container-query
migration deliberately left as a viewport media query. See "Architecture: appearances" in `docs/architecture/appearances.md` and the
"Frontend conventions" section below for the details of each.
