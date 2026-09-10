# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ASoHaV Companion App — the player-facing digital toolset for *A Story of Heroes and Villains*, a
Powered-by-the-Apocalypse tabletop game.

**Start here, then read the rest of this section only if you need the history.** The app is at
`0.44.0`. Ruleset **V0.6** was adopted 2026-09-09 and is now canonical (`Planning Docs/
Ruleset-V0.6.md`); the migration is staged as eight slices in `Planning Docs/WorkPlan-V0.6.md`,
`0.42.0` through `0.49.0`. **Slice 1 — harm primitives — shipped in `0.42.0`**: Statuses stop being
ranked tracks, splitting into a Strain track and Minor/Major/Severe severity slots, with Boons &
Banes replacing situational ranked modifiers and a Healing Track replacing Recoveries. **Slice 2 —
rolls — shipped in `0.43.0`**: Skill and Flaw Tags become mechanical, Push Yourself is a real
roll-cost mechanic, and Boon/Bane comparison drives Advantage/Disadvantage as a general mechanic,
replacing the old per-Move `AdvantageTrigger`. **Slice 3 — Combat on Strain — shipped in `0.44.0`**:
Cover becomes a real Boon/Bane roll mechanic, Brace's own numeric effect replaced a mismapped Boon
push, and the Combat Loop's surprise rule and Combat-Goal-achievement Potential are now real
controls. **The other five slices are not built yet.** See "Architecture: the ruleset and where it
lives", "Architecture: Strain & Statuses (V0.6 slice 1)", "Architecture: Rolls (V0.6 slice 2)", and
"Architecture: Combat on Strain (V0.6 slice 3)" below. Everything else in this file describes V0.5
behaviour that still ships unchanged (Moves, Camp flows, Clocks, Party/Bond) — where a section and
V0.6 disagree, the section describes the code and the ruleset describes the target, until that
section's own slice lands.

**The rest of this section is accumulated release history**, kept because it explains why the app
looks the way it does, but it has grown long enough that it is no longer the fastest way in.
`HANDOFF.md`'s "Current state" is a better snapshot; the per-subsystem "Architecture:" sections
below are a better reference. Trimming this opener to a short feature list, with the version-by-
version narrative moved to `CHANGELOG.md` where it belongs, is worth a future session's time.

Four surfaces in one app: the player **Character
Sheet** (now backed by a real rules engine as of `0.13.0` — roll-modifier breakdowns, Status
give/heal/Resist, the Subdued chain — see "Architecture: the rules engine" below; extended in
`0.18.0` with Wealth/Treasure resources, an informational Advantage/Disadvantage roll flag, and
the End the Session Rapport/Hold flow — see "Architecture: Wealth, Treasure, Advantage, and End the
Session"), the designers' **Content Admin** panel (library CRUD, validation, changelog, user
account management, and cross-campaign Play Data deletion as of `0.8.0`), the **Campaign
Shell** (roster, invite send/accept/decline, a GM-controlled campaign-setup phase — Signup → Party
Creation → Playing, as of `0.12.0` — character creation, GM live-peek, the Bond handshake, GM-only
campaign archiving as of `0.11.0`, and a live **Combat** Encounter view as of `0.14.0`–`0.16.0` —
see "Architecture: Combat" below), and, as of `0.36.0`, a GM-only **Adventure Prep** surface
(`/c/:campaignId/adventure` — Concept, Type, Hook, a linked Villain, NPCs and Locations, floating
Secrets, and a working Countdown; see "Architecture: Adventures" below). A full codebase/rules/
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
for a tooltip-nesting bug — see "Architecture: the rules engine" below for the glossary depth-cap
details and `HANDOFF.md`'s corresponding session note. A switchable **appearance** system landed in
`0.26.0` — Parchment (the original look, the default through `0.38.0`; Notice Board became the
default in `0.39.0` — see "Architecture: appearances" below) and a second, dark **Notice Board**
appearance built on a papers-pinned-to-a-corkboard metaphor for the sheet's tag collections, with
its own self-hosted display/body typefaces — and the parchment-damage overlay was deleted entirely,
from both appearances, in the same pass. See "Architecture: appearances" below and
`AppThemeGuidelines.md` for the full reasoning, including two deliberate, dated reversals of that
document's own prior "no wood grain, no drop shadows pretending to be a physical object" principle,
scoped to Notice Board only. Built from a
static-prototype design handoff in `Planning Docs/` — when
in doubt about intended behavior, that's the source of truth, and judgment calls made where the
handoff was ambiguous or contradictory are documented in
`README.md#architecture-notes--judgment-calls`. A large, messier working design doc also exists in
`Planning Docs/` (see "Architecture: the rules engine" below for how it was reconciled) — parts of
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
CHANGELOG entry, no source file touched — see "Architecture: the ruleset and where it lives"
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
Rapport (party), and Bond (social)" below. **Slice 5 (`0.32.0`)** brought Combat up to date against
`Ruleset-V0.5.md`'s own Combat Basics text — per-unit turn order, an automated Repel Gambit, the
Resist Reaction Move, a Cover Status picker, minimal Boss-Enemy wiring, and the real two-branch
Combat-start Rapport modifier — see "Architecture: Combat" below for what shipped and what stayed
deliberately out of this slice's scope (a full grid, real Boss-ability content, and an enforced
turn-order algorithm rather than a GM-overridable suggestion). **Slice 6 (`0.33.0`)** added
Clocks — the first genuinely new play-state subsystem since Combat — collapsing the doc's six named
variants into three `Kind`s (`Basic`, `Countdown`, `TugOfWar`) after the doc's own "Clocks" chapter
turned out to be explicitly marked "WIP" and self-contradictory about whether two of its variants
are even the same thing; see "Architecture: Clocks" below for the two repo-owner decisions that
scoped it. **Slice 7 (`0.34.0`)** gave the party its own shared identity — Motif, Quest, Skill/
Weakness Tags, a Path — and Camp Assets, then turned four Adventure Moves (Make Camp, Keep Watch,
Undertake a Journey, Enjoy Downtime) that had shipped as reference-text-only in slice 3 into real
guided flows built on the same "player reports the tier, the engine applies the mechanical change"
pattern the rest of the app already uses; see "Architecture: Party Identity & Camp" below for what
shipped, what stayed deliberately narrower than the doc's own wording, and the three repo-owner
decisions (Camp Assets' hybrid catalog-or-freeform picker, wiring "Progress a Personal Project
Clock" to the real Clocks subsystem, and freeform Party identity fields) that scoped it. **Slice 8
(`0.35.0`)** gave the designers' Content Admin panel three new authored GM stat-block collections —
Villains, NPCs, and Locations — extending the existing `library.enemies` pattern rather than
inventing a new one, and along the way retrofitted `EnemyTemplate.StatusLimits` off raw, unvalidated
JSON onto the same real, schema-validated field type the two new collections needed anyway; see
"Architecture: GM stat blocks" below for what shipped and what deliberately stayed out (Villains
aren't wired into Combat as spawnable Boss participants — that bridge, if it's ever built, is later
work). **Slice 9 (`0.36.0`)** closed out the migration with Adventures — the fourth surface named
above — referencing slice 8's own Villains/NPCs/Locations rather than redefining them, plus a
Countdown mechanic that deliberately reuses `Clock`'s tick-and-clamp logic without ever creating a
real, player-visible `Clock` row (an Adventure's Concept/Villain/Secrets/Countdown are GM-only
spoiler content this app never sends a Player at all — see "Architecture: Adventures" below for
why that ruled out the otherwise-obvious "just create a linked Clock" design). All nine slices of
the V0.5 migration are shipped as of `0.36.0` — every `> **V0.5:** ... not built.` marker
elsewhere in this file and in `README.md` describing slice 1-9 content has been flipped to a real,
shipped description in the section it annotates; nothing in the ruleset's own nine-slice plan
remains unbuilt. Slices landed as `0.28.0`-`0.36.0`. **`0.37.0`**, a maintenance release against
three independent repo-owner requests rather than a `Ruleset-V0.5.md` slice, gave campaign invites
real (best-effort) email delivery alongside the existing code/link — see "Architecture: campaign
invites" below — reworked the Adventure Prep panel's responsive layout and accessibility (a
`page-shell-form`-to-`page-shell` width change, a named CSS container pairing NPCs/Locations, real
heading structure), and let `NPC.Type`/`Location.LocationType` take a write-in value alongside their
authored options. **`0.38.0`** is the first of two releases implementing a full UI review round
with the repo owner (`UIReviewRound_Handoff.md`, staged as `WorkPlan-0.38.0.md`/
`WorkPlan-0.39.0.md`) and takes the four review items about **state**: Realtime now covers
`campaigns`/`memberships`/`characters` (a new migration, `0013`), a shared `CampaignSetupChecklist`
gives both GM and Player a "what am I waiting on" view of Signup/Party Creation/Playing, Home
splits into "campaigns you run"/"campaigns you play in" lanes with a phase badge and waiting hint
per tile, and Combat is now hidden — in the UI and rejected server-side — until a campaign is
actually Playing. See "Architecture: campaign setup phases" below for the phase-gating pieces this
release builds on. **`0.39.0`** takes the review's remaining four items, about layout and
appearance, plus the cross-cutting decision that **Notice Board becomes the default appearance**
(a one-time forced reset via a storage-key rename, no migration code): the Motif card readability
bug that becomes the default first impression the moment that lands is fixed in the same release,
`PeekCard` gets both a literal Potential-label fix and a two-column restructure, `BackgroundPanel`
splits Motifs 66% / Looks 33% (an explicit repo-owner layout call), and Statuses' three polarity
groups become columns — the last of these closing the one piece of the `0.24.0` container-query
migration deliberately left as a viewport media query. See "Architecture: appearances" and the
"Frontend conventions" section below for the details of each.

Read `README.md` and `HANDOFF.md` before starting nontrivial work — `HANDOFF.md` in particular
lists open issues and in-flight threads from the last session; check it so you don't duplicate a
fix or lose track of something already flagged.

## Architecture: the ruleset and where it lives

**`Planning Docs/Ruleset-V0.6.md` is, as of 2026-09-09, the single source of truth for the game's
rules.** It was adopted in a docs-only pass — no version bump, no CHANGELOG entry, no source file
touched, the repo staying at `0.41.0` — with the code migration staged as an eight-slice plan in
`Planning Docs/WorkPlan-V0.6.md` (slices land as `0.42.0`-`0.49.0`). **Slice 1 — harm primitives —
shipped in `0.42.0`**, the same release that adopted the ruleset having been immediately followed
by the first slice against it; **slice 2 — rolls — shipped in `0.43.0`**; **slice 3 — Combat on
Strain — shipped in `0.44.0`**, right behind it; **the other five slices are not built yet**.
Everything every other section of this file describes (besides Strain/Statuses/Armor/Subdued, now
covered by "Architecture: Strain & Statuses (V0.6 slice 1)"; Skill/Flaw Tags, Push Yourself, and
Advantage/Disadvantage, now covered by "Architecture: Rolls (V0.6 slice 2)"; and Cover, Brace,
Surprise, and Combat-Goal Potential, now covered by "Architecture: Combat on Strain (V0.6 slice
3)") is still the *V0.5* behaviour the app ships for that surface. Read `WorkPlan-V0.6.md` Section
A before changing any rules code, and do not build ahead of the slice a change belongs to — slice 1
(harm primitives) was ordered first specifically so the wire contract settled before any screen got
rebuilt on it, and slices 2 onward now do exactly that.

**V0.6's central change, in one line: Statuses stop being ranked tracks.** Harm splits into
**Strain** (a 5-box short-term track that clears at the end of a scene) and **Statuses** (Minor ×3
/ Major ×2 / Severe ×1 slots, each a written injury carrying a fixed penalty — Minor −1, Major
Disadvantage, Severe roll 1d6 instead of 2d6, and only the highest ever applies). **Boons & Banes**,
unranked situational tags compared for Advantage/Disadvantage, replace positive and situational
ranked modifiers; a **Healing Track** replaces Recovery spending; and Skill and Flaw Tags become
mechanical (+1 / −1, a Flaw also marking Potential whether you hit or miss) — the Tag mechanic is
slice 2's, not slice 1's; only the harm model itself (Strain/Statuses/Boons/Banes/Healing Track)
shipped in `0.42.0`. Two calls in that migration are **ours, not the document's**, and are written
up in `README.md` item 43: extending Strain into a Combat chapter V0.6 never rewrote (slice 1
adapted Combat's existing primitives enough to compile and keep working against the new harm model;
slice 3, `0.44.0`, finished applying B1's own mapping table — Cover, Brace — plus the Combat Loop's
surprise/Combat-Goal-Potential rules, described in "Architecture: Combat on Strain" below — neither
slice is a from-scratch Combat rebuild, both apply the same locked mapping at different depths),
and retiring the Subdued/Scar/Risk-Death flow while keeping `CharacterSheet.Scars[]` as a
field.

**`Ruleset-V0.5.md` — canonical from 2026-09-01 and shipped across `0.28.0`-`0.36.0` — moved to
`Planning Docs/archive/`** with a SUPERSEDED banner. Archived rather than deleted, deliberately:
the 2026-09-03 design meeting framed V0.6's harm model as an experiment to compare against the
existing system, so if playtesting favours ranked Statuses, V0.5 is what the app falls back to.
The six rules files this app was originally built against (`TheBasics.md`,
`TheGear.md`, `Advancements.md`, `TheMoves.md`, `TheSkills.md`, `TheArc.md`) are archived under
`Planning Docs/archive/`, each carrying a SUPERSEDED banner; `Planning Docs/archive/README.md`
indexes what each one covered and why `Advancements.md` in particular stayed so load-bearing for
so long (README items 8, 17, and 18 all cite it directly). Their six byte-duplicates, which used
to live inside the extracted design handoff at
`Planning Docs/ASoHaVHandoff_extracted/design_handoff_asohav_character_sheet/rules/`, moved
alongside them to `Planning Docs/archive/handoff-rules/`; that path now holds only a `README.md`
stub pointing back at the archive. **No document in this repo should cite a rules file at its old
`Planning Docs/<name>.md` path any more**, except when deliberately framing it as history — and
then the citation should use the archive path.

**The "large, messier working design doc" this file mentions above, and the "14,000+ line working
design doc" `README.md` item 12 cites as the authority for Combat Basics V2.2, Gambits, Toughness,
enemy stat blocks, and the Crumble→Dishonored merge, was never actually committed to this
repository** — verified against `git ls-files`, deleted-file history, and disk; the largest rules
file ever actually present in `Planning Docs/` was `TheMoves.md` at 334 lines. Record this as
history and a closed gap, not an accusation: citing it was a reasonable call on the information
available at the time across `0.13.0`-`0.18.0`, it just pointed at something no later session
could ever open. For thirteen versions the shipped Combat implementation was unverifiable against
its own stated source — see "Architecture: Combat" below for what that means for the Range-band
decision specifically. `Ruleset-V0.5.md` was adopted as that missing document's successor and
closed the gap; `Ruleset-V0.6.md` now succeeds V0.5 in turn.

**All of V0.5 is implemented** — slices 1-9, shipped across `0.28.0`-`0.36.0` — **and three slices
of V0.6's own eight-slice migration are implemented on top of it**: slice 1 (harm primitives),
`0.42.0`; slice 2 (rolls), `0.43.0`; and slice 3 (Combat on Strain), `0.44.0`. Every architecture
section below describes what the app actually ships, which for most
surfaces is still V0.5 behaviour; where a section and `Ruleset-V0.6.md` disagree, the section
describes the code and the ruleset describes the target, until that section's own V0.6 slice
lands. This is not a contradiction to resolve — a migration in progress has both an implemented
base and a partially-implemented target at once, and the goal of this file is to say plainly,
section by section, which is which.

**This paragraph said the exact opposite until `0.41.0`**, and the correction is recorded rather
than quietly applied, because a reader who had internalised the old version needs to know it
changed. It read "None of V0.5 is implemented", claimed every section below still described the
pre-V0.5 ruleset, and closed by instructing: "Don't build ahead of the slice a change belongs to:
slice 1 (rules primitives) is ordered first specifically so the wire contract settles before any
screen gets rebuilt on it." All of that was true when written, before `0.28.0`. None of it has been
true since `0.36.0`, and the closing instruction had become actively misleading — there are no
slices left to build ahead of. It survived because the `0.36.0` pass that flipped the migration's
status did precisely what it recorded doing: it rewrote every `> **V0.5:** ... not built.` marker.
This is ordinary prose in this section, not one of those markers, so a search for the marker format
never touched it. Worth remembering next time a status flip is executed as a find-and-replace over
one syntax: the claims stated in prose are the ones that survive.

What *is* still current from the old wording: a V0.5 rule that changed, reversed, or newly
introduced something is described in the section it belongs to, with its slice reference, rather
than as a rewrite that erases what the app used to do.

V0.5 is not itself free of ambiguity, and this app is not going to paper over what it leaves open.
`HANDOFF.md` catalogues the rules questions the new doc raises but doesn't answer for itself — an
inconsistent Bond/Kin/Kith naming split across its own sections, a Level-vs-Tier gate that's
self-contradictory in the same way the old `Advancements.md` already was, a Recoveries starting
value literally written as "6 (or 8?)", and others. Treat that catalogue as a fence, not a TODO:
guessing an answer for a question V0.5 itself leaves open would reintroduce exactly the kind of
undocumented judgment call this project's audits keep finding and having to fix after the fact.

## Commands

```bash
npm install
npm run dev:server        # http://localhost:8787 — seeds Supabase Auth + Postgres on first run
npm run dev:web           # http://localhost:5173 — proxies /api, talks to Supabase directly
npm run typecheck         # builds @asohav/shared, then typechecks server + web
npm run build             # builds shared -> server -> web, in that order (server/web import shared's dist)
npm run start              # runs the built server (production entrypoint)
npm run test               # vitest: @asohav/shared then @asohav/server, see below
npm run test:responsive -w @asohav/web   # Playwright smoke test, see below
npm run test:interaction -w @asohav/web   # the same checks over interaction-gated states, see below
```

Unit tests (`vitest`, added `0.7.0`) live next to the code they cover (`*.test.ts`) in
`packages/shared` and `apps/server` — pure logic and route-level authorization only; there's no
live-database integration testing (see "Sandbox network constraints" below for why). `apps/web`
gained its own vitest suite in `0.27.0` — five files covering `lib/api`, `lib/appearances`,
`lib/useGlossaryMatcher`, and the `panelCollapseStore`/`appearanceStore` zustand stores — so the
Playwright responsive smoke test is no longer its only automated coverage, and the `0.26.0` note
below about `appearanceStore.ts` having no dedicated unit test is superseded: it has one now.
`npm run test` builds `@asohav/shared` first since `apps/server`'s tests import it from
`dist`. `apps/server`'s `vitest.config.ts` stubs `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` —
`src/supabase.ts` throws at import time without them, and `../auth.js` (unmocked in route tests,
for `requireAuth`) pulls it in regardless of whether a given test mocks `../repo.js`.

CI (`.github/workflows/ci.yml`) has **five jobs: `build`, `test`, `lint`, `responsive-matrix`, and
`responsive`** — and because `responsive-matrix` runs a two-entry appearance matrix, the **six
check-run names GitHub actually records** are `build`, `test`, `lint`, `responsive-matrix
(parchment)`, `responsive-matrix (noticeboard)` and `responsive`.

**`responsive` is a gate job, not a test job**: it runs nothing itself, `needs` the matrix, and
passes only when every matrix leg passed. It exists because **branch protection matches required
status checks by exact check-run name**, and a matrix job never reports under its bare name — it
reports one check run per entry. `responsive` is therefore the one to require: it keeps reporting
under that exact name however the matrix below is later reshaped. Its `if: always()` is
load-bearing — without it the job would be *skipped* when the matrix fails, and a skipped check
doesn't satisfy a required check, so the PR would block with no visible failure explaining why.

**There is no `typecheck` job and never has been** (verified with `git log -S` over the file's whole
history); `npm run typecheck` is a *step* inside `build`. This file asserted the four job names were
`typecheck`/`build`/`test`/`responsive` until `0.41.0`; two of those four were wrong, and the
correction is recorded rather than quietly applied because that list is exactly what someone
configuring branch protection would copy — and in this repo, someone did. See `HANDOFF.md` item 7
for the incident: a rule requiring the then-real name `responsive` kept working until `0.26.0` gave
that job a matrix, then blocked a PR fifteen versions later with green CI and no failure anywhere.

`@asohav/shared` must be built (`npm run build -w @asohav/shared`) before anything that imports it
from `dist` (the `build`, `test` and `lint` jobs handle this automatically; the `responsive-matrix`
job builds shared explicitly as a separate step since `npm ci` alone doesn't produce `dist`).

**Responsive smoke test** (`apps/web/scripts/responsive-smoke.mjs`): renders every real route
through `apps/web/harness.html` against seed fixtures (no server, no Supabase) at seven viewports
(360/390 phone, 768/1024 tablet, 1440/1920/2560 desktop — the 1920/2560 pair added `0.24.0` since
1440 was the widest tested and a real "1440p monitor" is 2560×1440) and asserts no horizontal
overflow, no touch target under 44×44, no overlapping hit areas, and no uncaught page errors. Run
it after any layout/CSS change. Needs a Chromium binary — normally `npx playwright install
--with-deps chromium` once per environment, but that download is blocked in some sandboxes
(confirmed in a Claude Code remote environment this project has been worked in: outbound HTTPS
only reaches an allowlist, and `cdn.playwright.dev` isn't on it — don't re-run `playwright install`
if it 403s, that's the sandbox's proxy, not a broken setup). If a Chromium binary is already on
disk (that same environment pre-installs one at `/opt/pw-browsers/chromium`), point the script at
it instead: it already reads `CHROMIUM_PATH` for exactly this —
`CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:responsive -w @asohav/web`. CI does the
equivalent via `npx playwright install chromium` in a normal (non-sandboxed) runner. The seven-
viewport × fifteen-route matrix runs ~12–14 minutes in this sandbox — `SMOKE_ROUTE=`/
`SMOKE_VIEWPORT=` env vars (substring match, case-insensitive) narrow it to one route/viewport
while iterating on a single risky change, e.g. `SMOKE_ROUTE="character sheet" SMOKE_VIEWPORT=768
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:responsive -w @asohav/web`. Both scripts share
their route/viewport list and Vite-harness bootstrap via `apps/web/scripts/harnessConfig.mjs`
rather than keeping two copies that could drift.

**Interaction-state test** (`apps/web/scripts/interaction-smoke.mjs`, added `0.41.0`): the smoke
test above never clicks, so any layout that only exists after a tap — an expander, a revealed
editor, a modal, a drawer — was entirely uncovered by it. This drives ~21 such states and reruns
the same assertions; both scripts import them from `apps/web/scripts/hitChecks.mjs` rather than
keeping two copies. Runs as a step in CI's existing `responsive` job (inheriting that job's
checkout, `npm ci`, shared build, Chromium install and appearance-matrix split) and takes the same
`CHROMIUM_PATH`, with its own `INTERACTION_STATE=`/`INTERACTION_VIEWPORT=`/`INTERACTION_APPEARANCE=`
filters. In CI it is a step inside `responsive-matrix`. See the `responsive-device-qa` skill for what it covers and the two things it does that a
naive version gets wrong (scoping to the reachable subtree; measuring from scroll 0).

**Screenshot script** (`apps/web/scripts/screenshot.mjs`, added `0.24.0`): the smoke test asserts
overflow/touch-target/overlap/errors, none of which catch "this panel is wasting a lot of
horizontal space" — a narrow content column on a huge monitor passes every check. Reuses the same
harness/viewport machinery to write a PNG per route per viewport to `apps/web/.screenshots/`
(gitignored, regenerated every run — not a fixture) — `npm run screenshot -w @asohav/web`, with the
same `SCREENSHOT_ROUTE=`/`SCREENSHOT_VIEWPORT=` filters. Needs no network of its own (local Vite
server, local Chromium, seed fixtures), so it works from a locked-down sandbox. The one thing it
does reach out for is `harness.html`'s Cormorant Garamond/Lora from Google Fonts — **reachable as
of the fortieth session**, where earlier sessions had it blocked and noted screenshots rendering in
fallback serif. Probe rather than assume (see "Sandbox network constraints" below): if those two
hosts are blocked in your environment the screenshots are still representative for layout and
spacing, just not for typography.

**Note:** `main` now has branch protection requiring status checks (see `HANDOFF.md` item 7, which
records how its own earlier advice named a check that stopped existing at `0.26.0` and blocked a PR
for it). Require `build`, `test`, `lint` and **`responsive`** — the gate job, never a bare
`responsive-matrix` and never one of its suffixed legs. Because required checks match by **exact
check-run name**, that indirection is the whole point: it's what lets a future matrix dimension be
added without silently breaking protection in a way nothing warns you about. The symptom of getting
it wrong is a check that never appears, not one that goes red.

## Workspace layout

npm workspaces monorepo: `apps/*` + `packages/*`, one synchronized version across all four
`package.json` files (root, `@asohav/server`, `@asohav/web`, `@asohav/shared`) — see the
versioning policy at the top of `CHANGELOG.md` for what counts as MAJOR/MINOR/PATCH pre-1.0.
Bump all four together, add a CHANGELOG entry, tag the merge commit `vX.Y.Z`.

- **`packages/shared`** — the reconciled data model (`src/types.ts`), pure business logic
  (`src/logic.ts`: load capacity, the Bond handshake resolution; `src/engine.ts`,
  added `0.13.0`: roll-modifier breakdowns, Resist Rolls, the Status give/heal/Subdued engine;
  `src/combat.ts`, added `0.14.0`–`0.16.0`: Range bands, Toughness, Enemy Limits, Gambits;
  `src/glossary.ts`: glossary term matching/linking, see "Frontend conventions" below), seeded
  library content and demo campaign (`src/seedLibrary.ts`, `src/seedPlay.ts`, ported from the
  handoff's `library.js`/`store.js`), admin schema (`src/schema.ts`), and the `api.ts`
  request/response shapes. **Both server and web import this from its built `dist`, not source**
  — rebuild it after editing (`npm run dev -w @asohav/shared` watches; `npm run build -w
  @asohav/shared` for a one-shot). `src/types.ts` is explicitly documented as the wire contract:
  keep shapes stable, add fields rather than renaming them, since JSONB columns in Postgres store
  these shapes verbatim.
- **`apps/server`** — Express + TypeScript. Route handlers in `src/routes/*.ts`, one file per
  resource (`auth`, `library`, `campaign`, `sheet`, `party`, `bond`, `characters`, `invites`,
  `admin`, `combat` — the last one added `0.14.0` for Encounter start/update/end), mounted in
  `src/index.ts`. `src/repo.ts` is the only place that talks to Postgres/Supabase; `src/auth.ts`
  attaches `req.user` from a Supabase Auth bearer token and provides `requireAuth`/`requireAdmin`
  middleware.
- **`apps/web`** — Vite + React 19 + TypeScript. Routed pages in `src/pages/`, feature panels
  grouped by surface in `src/features/{admin,campaign,sheet,combat}/` (`combat/` added `0.14.0`:
  `EncounterView.tsx` plus its modals), data-fetching hooks and the API client in `src/lib/`. No
  global app state store beyond two small zustand stores for pure UI state
  (`src/store/panelCollapseStore.ts`, `adminUiStore.ts`, `sheetUiStore.ts`) — all server state
  lives in TanStack Query's cache.
- **`supabase/migrations`** — numbered SQL migrations, applied in order to the Supabase Postgres
  project. `0001_init.sql` has the schema design notes (RLS strategy, JSONB shape rationale) at
  its top — read it before touching schema. `0010_combat_encounters.sql` (`0.14.0`) is the first
  new table since `0009` — everything between them was JSONB-field additions needing no migration.

## Architecture: authorization is in the Express layer, not RLS

This is the single most important thing to know before touching data access. Every table has RLS
enabled (Supabase auto-exposes tables over PostgREST to the anon key otherwise), but **only
`SELECT` policies exist** for the `authenticated` role. All INSERT/UPDATE/DELETE goes through
`apps/server/src/repo.ts`, which uses the Supabase **service-role key** (bypasses RLS entirely) —
business rules (membership checks, GM-only actions, admin-only library writes, Bond handshake
rules) are enforced in the Express route handlers, not in Postgres policies. Don't add new
mutating routes that assume RLS is doing authorization for you; check `req.user` /
`membershipFor()` explicitly, following the pattern in `apps/server/src/routes/bond.ts`.

The SELECT policies exist for a second reason beyond direct anon reads: they scope what
**Supabase Realtime** delivers. There is no server-side broadcast/WebSocket layer — the client's
`useLiveCampaign` hook (`apps/web/src/lib/useLiveCampaign.ts`) subscribes directly to
`postgres_changes` on `party`/`bonds`/`character_sheets` (filtered by `campaign_id`) and `library`
(global), and Realtime evaluates each table's SELECT policy per subscribing client — so a player
only receives events for campaigns/sheets they can already see, for free, using the same
authorization the REST routes enforce. If you add a new play-state table that should sync live,
give it a `campaign_id` column and a matching SELECT policy (see migration `0005` for why
`character_sheets` needed one retrofitted — Realtime's `filter` only supports equality on a
column, so the table needs the FK to filter on even if it's otherwise reached via
`character_id`).

A second, easy-to-miss Realtime constraint: **the SELECT policy itself also needs to be joinless**,
not just the subscription filter. Realtime's `postgres_changes` authorization check does not
reliably evaluate an RLS policy whose `USING` clause joins out to another table (an inline
`exists (select ... from other_table ...)`) — `party`/`bonds` never hit this because their policies
were always a single `private.is_campaign_member(campaign_id, uid)` call over a column already on
the row, but `character_sheets`' policy kept an inline join to `characters` even after `0005` added
`campaign_id` directly to the row, and this caused GM live-peek to intermittently miss a just-marked
Condition until some later sheet write happened to deliver (fixed in migration `0006` with
`private.can_view_sheet(campaign_id, character_id, user_id)`, a joinless function-call policy in
the same shape as `is_campaign_member`/`is_gm`). If you add a Realtime-synced table whose SELECT
policy needs to check anything beyond a plain campaign-membership match, wrap the check in a
`private.*` SECURITY DEFINER function called with columns already on the row — never write the
join inline in the policy body.

## Architecture: the Bond handshake and row locking

Bonds (`propose` → `accept`/`reject`) are the one place with real concurrency risk (two players
racing to accept/reject the same pending change). `withBondLock()` in `apps/server/src/repo.ts`
opens a **direct `pg` connection** (`apps/server/src/pgPool.ts`, via `DATABASE_URL`) and runs
`SELECT ... FOR UPDATE` inside a transaction — deliberately bypassing `supabase-js`/PostgREST,
which has no way to hold a lock across a read and a write. Everything else in the server goes
through `supabase-js`. When extending Bond logic, mutate inside the `withBondLock` callback and
throw (don't return an error value) to abort/rollback — see `apps/server/src/routes/bond.ts` for
the `HttpError`-vs-`BondHandshakeError` catch pattern each route handler uses.

**This code path has never been runtime-verified against live Postgres** (see `HANDOFF.md` item
2) — the dev sandboxes this project has been built in so far have no raw TCP egress, only
HTTPS-proxied. Keep that in mind if asked to "verify" Bond concurrency; you likely can't from
inside a similar sandbox (see "Sandbox network constraints" below).

**Mark Kin and Forge Bond are a proposal**, never a direct write — an explicit judgment call
reconciling a disagreement between the two design-handoff prototypes; see
`README.md#architecture-notes--judgment-calls` item 1 before changing this. **Spend Kin is the one
exception**, as of `0.5.0`: it applies immediately with no handshake (`applySpendKin()` in
`packages/shared/src/logic.ts`, called directly from `POST /:bondId/propose` in
`apps/server/src/routes/bond.ts` rather than being staged as a `PendingChange`), since the game's
own rules text draws a real distinction here ("either PC can spend Kin" vs. Forging needing mutual
agreement) that the original all-three-types-identical handshake didn't carry forward — see
`README.md#architecture-notes--judgment-calls` item 7. `withBondLock`'s row lock still serializes
concurrent writes to the same Bond regardless of type, so this doesn't reopen a race condition; it
only drops the *approval* step for this one action. Don't assume all three `BondChangeType`s behave
the same when touching this code.

**A Bond maxed at Level 5 with a full Kin Track locks** (`isBondLocked()`, `0.17.0`) — per
`Advancements.md`: "When you place your 5th Kin at Bond 5, your Bond Level locks and can not be
moved down. You can no longer spend Kin on that track." `applySpendKin()` throws
`BondHandshakeError` once locked instead of silently dropping the Bond back below Level 5; the
`ForgeBond` route guard also refuses a further Forge on an already-locked Bond (forging again would
otherwise reset `KinTrack` to 0 and unlock it). This went unenforced for the entire life of the
Bond handshake until a full-codebase audit caught it — worth remembering that a rule can be
correctly documented in `Advancements.md` and still never make it into the actual `Bond` state
machine if nobody checks the two against each other.

**The Kin vocabulary became Bond in `0.28.0`.** `BondChangeType` is `MarkBond`/`SpendBond`/
`ForgeBond`, the track on `Bond` is `BondTrack`, and `applySpendBond()` replaces `applySpendKin()`.
V0.5 names this track "Bond" in its Advancement chapter and "Kin"/"Kith" in two others; those two
are treated as the doc's own typos rather than three things to model (`HANDOFF.md`, "Known gaps in
V0.5", item 1). **The Bond UI lives in two places and both were renamed**: `AdvancementPanel.tsx`
(`apps/web/src/features/sheet/`) and `CampaignBonds.tsx` (`apps/web/src/features/campaign/`) each
carry their own `TYPE_LABELS`, independently — a rename that touches one and not the other
degrades silently to a raw enum value in the history list.

**The Bond-5 lock needs no change under V0.5.** `isBondLocked()`'s rule — a Bond maxed at Level 5
with a full Kin/Bond Track locks and can no longer be spent down — is already on the "matches
V0.5, no migration needed" side of the delta; the rename above touches its name, not its logic.

## Architecture: Hero Improvement Trees, Rapport (party), and Bond (social)

**Slice 4 (`0.31.0`) replaced the flat, Tier-gated `Advancement`/`AdvancementTrack` list with V0.5's
Improvement Tree model, but only for Hero Improvements — see the scoping note below for why Party
and Bond stayed as they were.** `library.advancements` is gone; `library.improvementTrees` (25 rows
— 11 Combat + 14 Narrative, named and themed directly from `Ruleset-V0.5.md`'s "Hero Improvements"
section) and `library.improvements` (each node's `TreeId`, `IsStarting`, and `PrerequisiteIds`)
replace it. Gating is **DAG-only, no Tier or Level**: `improvementState()` (`packages/shared/src/
logic.ts`) reports `held`/`available`/`locked` for a node against a holder's set of already-taken
Improvement Ids — a Starting Improvement is always available, anything else needs at least one
same-tree prerequisite already held. `apps/server/src/adminLogic.ts`'s `validateImprovementDag()`
checks the whole graph in Content Admin's Validation panel: no cross-tree prerequisites, no cycles,
and every non-Starting node reachable from a Starting Improvement on its own tree.

**Why DAG-only, dropping the doc's own Tier language — a repo-owner decision, not a guess.**
`Ruleset-V0.5.md` actually states the Hero Improvement gating rule twice, and the two versions
contradict each other. The current, unambiguous one ("Motif Advancement — Potential", the section
this app was already built against for slices 2-3): clear a full Motif Potential track and choose
Add a Skill Tag / Add-or-Remove a Flaw Tag / **Gain a Hero Improvement — a Starting Improvement on
any tree, or one connected to an Improvement you already hold on that same tree** — no Tier or
Level mentioned anywhere. A separate, older-reading "Level Up" section (under Make Camp) instead
describes a **Tier 1-4** system gated on a **Level** counter and a running count of Tier-1/2/3
picks — the exact "4 Tier-1 advancements *and* Level 5" contradiction the pre-V0.5 `Advancements.md`
already had (`HANDOFF.md` open issue 12), reproduced here as leftover, unreconciled draft text. The
repo owner confirmed treating that section as vestigial and gating purely on the DAG, the same kind
of call already locked for the Bond/Kin/Kith doc-typo (`README.md#architecture-notes--judgment-
calls` item — see the new slice-4 entry there for the full writeup).

**`CharacterSheet.Level`/`Party.PartyLevel` exist as fields but gate nothing.** Both are plain
running counters — Level increments once per Motif-Potential-track clear (any of the four options,
not only Gain a Hero Improvement), PartyLevel once per Rapport-track clear — kept because the
now-vestigial "Level Up"/"Progress the Party" doc sections still name them and a later slice or
rules clarification might give them a real role. Nothing in the app reads either to gate anything
today; don't add a Tier/Level check against them without a fresh repo-owner decision.

**Ruleset-V0.5.md names all 25 Hero Improvement Trees but authors zero nodes on any of them** —
found only once slice 4 actually went looking for the tree content the WorkPlan expected to seed.
No Starting Improvement, no prerequisite line, nothing under any of the 11 Combat or 14 Narrative
tree headers. Rather than invent real mechanical effects, `seedLibrary.ts` gives every tree exactly
two placeholder nodes (a Starting Improvement and one node chained to it, `Effect` text explicitly
labeled "Placeholder…") — enough to exercise the DAG gate and its validation end to end without
pretending unwritten content is real. Replace these with authored nodes once the repo owner writes
them; nothing else in the app depends on their `Effect` text being real.

**Party and Bond Improvements are out of scope for this slice, and not because of the DAG
question — the doc has no content for either at all.** `Ruleset-V0.5.md`'s "Party Motif +
Improvements" and "Bond Track + Improvements" sections are each one line: "Here that is!" with
nothing underneath — not even tree *names*, unlike Hero's 25. Building a picker for either would
mean inventing tree lists this doc names nowhere. At slice-4 time this was also blocked on a Party
Motif data model (Party Skill/Weakness Tags) that didn't exist yet in this app — that piece shipped
in slice 4's own follow-up, "Party Identity & Camp" (`0.34.0`; see that architecture section
below), which gave `Party` real `SkillTags`/`WeaknessTags` fields and a picker
(`applyPartyRapportAdvance()`, `logic.ts`) offering the doc's Add/Remove-a-tag options on a full
Rapport track. Gaining a Party Improvement itself is still blocked — the tree-content gap this
paragraph opened with is untouched by that later slice — but "clearing Rapport with no real choice
on offer" is no longer accurate as of `0.34.0`, only as of `0.31.0`. Bond stays exactly as before: Marking Bond and Forging are played out
live through the Bond handshake (see above), and Forging stays a freeform "write it together" move
on `Bond.BondMoves` rather than a pick from any list
(`README.md#architecture-notes--judgment-calls` item 8). Content Admin's nav still carries a
placeholder "Bond" entry under Improvements for the same reason it always has — nowhere for
Bond-specific content to live yet, not nothing to say about it.

**Rapport is also a spendable currency, Aid, as of `0.28.0`** — 1 Rapport for +1 on another Hero's
roll, usable after the dice are rolled, at double cost during Risk Death. It keeps its Rapport-track
role; spending is additive to that, not a replacement. **What the app does and doesn't enforce
matters here**: it moves the currency and records who spent it and on what (`Party.History` gained
`Action: 'spent'`), but it does *not* enforce V0.5's "once per teammate per roll" limit, because
this app has no concept of "a roll" to hang that on — the same honest limit that already governs
Advantage/Disadvantage. `MoveRollHelper.tsx` explains that in an `InfoTooltip` rather than implying
a rule is being tracked when it isn't. A real cross-player Aid offer flow (modelled on Combat's
`PendingStatusOffer`) was considered and deliberately deferred; see `WorkPlan-V0.5.md`.

## Architecture: the rules engine — modifier transparency, not dice simulation

> **V0.6 slice 1 (`0.42.0`) replaced everything below about Statuses, Recoveries, and Subdued —
> see "Architecture: Strain & Statuses (V0.6 slice 1)" right after this section for what ships
> now.** `CharacterStatus.Marks`/`Polarity`, `giveStatus()`/`healStatus()`/`applyOpposingStatus()`/
> `sortStatuses()`, `CharacterSheet.Recoveries`/`spendRecovery()`, and the three-way Subdued modal
> are all retired; `statusRank()`/`markRank()`/`reduceRank()` survive, now serving the Strain track
> and Combat's own Enemy Strain tracks instead of a ranked Status row. Left in place below as
> history — it explains why the app looks the way it does and documents the V0.5 reconciliation
> decisions (Crumble/Dishonored, `README.md` items 12-13) that are unaffected by the harm-model
> change — but don't write new code against `Marks`/`Polarity`/`Recoveries`/`giveStatus` described
> here; they no longer exist.

`packages/shared/src/engine.ts` (added `0.13.0`) is the start of the actual game engine: dice-roll
modifier breakdowns and mechanical-effect application for Moves, Statuses, and Conditions.
**This app never rolls dice for the player, by explicit product decision** (confirmed directly
with the repo owner, not assumed) — `computeRollBreakdown()` returns 2d6 + Virtue's `Total`, itemized
in `Sources` (base score, Condition penalty),
so the player knows what to roll and why. **As of `0.20.0`, the highest helpful/hindering Status is
deliberately *not* folded into `Total`** — it's returned separately as `StatusSources`. An earlier
version summed it into `Total`, which read as if a Status swing *were* the named Virtue's own
modifier (a real repo-owner-reported bug, not a style preference — "Roll 2d6 + Heart: +5" implied
Heart itself was +5 when it was actually +1, with the rest coming from a Status). UI call sites
render `Sources` as the headline total and `StatusSources` as a clearly separate "also affecting
this roll" list — see `MoveRollHelper.tsx`/`CombatMoveModal.tsx`. The Ability effect layer that
used to feed `Sources`/`conditionalRollBonuses` was removed in `0.29.0` with the Abilities catalog
itself — V0.5 has no Abilities. Once a roll happens at the table and the player reports which tier they hit (or, for a
formula like Healing a Status's "1d6 + Mettle," the d6 they rolled), the engine applies the
resulting mechanical change — that's the actual "engine" part. Don't add real randomness
(`Math.random()`, a dice library, anything non-deterministic) to this module or its callers
without checking this decision with the repo owner first; it's a settled call, not an oversight.

**The Condition-penalty formula already matches V0.5's rule, unchanged.** `effectiveVirtueScore()`
(`packages/shared/src/logic.ts:28`) applies `Condition.RollPenalty: -2` against the Virtue a
Condition is marked on and floors the running total at `GameSettings.ConditionFloor: -3` — that's
V0.5's own Condition rule ("-2 on that Virtue, floored at -3 total") verbatim. Worth calling out
explicitly since most of what follows in this section needs real migration work: this one piece
doesn't.

Statuses are the game's damage/HP system, not a separate stat — a Negative Status reaching
`GameSettings.StatusMaxRank` (default 6) triggers **Subdued** (`StatusesPanel.tsx`'s
`SubduedModal`) instead of just sitting at "Rank 6": the player chooses Take a Scar, Risk Death
(`resolveRiskDeath()`), or Blaze of Glory. `giveStatus()`/`healStatus()`/`applyOpposingStatus()`
are the three ways a `CharacterStatus[]` array changes; all are pure functions over the array, not
tied to `commit()` — see `StatusesPanel.tsx` for how they're wired into a sheet mutation.
`CharacterSheet.Recoveries` (refills to `GameSettings.RecoveriesMax` at Make Camp) is spent
1-for-1 to heal a Status; `CharacterSheet.Scars` is free-text, populated only through the Subdued
flow. See `README.md#architecture-notes--judgment-calls` items 12-13 for the reconciliation
decisions behind this (the doc's "Crumble" mechanic folded into the already-shipped "Dishonored,"
which Combat draft is canonical for whenever Combat gets its own slice) and `HANDOFF.md` for the
list of design questions the doc leaves unresolved that this slice deliberately didn't guess at.

**A Status is a row of marked boxes as of `0.28.0`, not an integer.** `CharacterStatus.Marks:
boolean[]` replaced `Rank: number`, and three primitives in `engine.ts` are the only code that
knows how a row works: `statusRank()` (the **highest marked box**, never a count — the row is
deliberately sparse, so `[_,X,_,X,_,_]` is Rank 4), `markRank()` (V0.5's actual rule: mark box N,
*or the next empty box to its right* if N is taken), and `reduceRank()` (clears from the highest
box down). Everything Status-shaped routes through them.

Two consequences worth internalising, because both differ from the old arithmetic in ways that
look like bugs if you don't expect them. **Giving is no longer additive**: Rank 2 twice is Rank 3
(boxes 2 and 3), not Rank 4. And **reducing clears marks, not Ranks**: a Status held as a lone
mark on box 2 is *removed* by a reduction of 1, rather than dropping to Rank 1. Both are pinned by
name in `engine.test.ts`.

**Crumble replaced Dishonored, and became an event rather than derived state.** This is the part
most likely to be got wrong by analogy with the old code. `isDishonored()` was a predicate — all
five Conditions marked — and the badge was the whole feature. Under V0.5 having all five marked is
a *legal state*; the consequence fires on the **next attempted mark**, and its effect is to leave
the scene and **clear one Condition**, which no boolean can express. So `markCondition()`
(`logic.ts`) is now the single funnel for every Condition mark and the only thing that decides a
Crumble; `allConditionsMarked()` is what's left of the old predicate, and drives a badge that says
what happens next rather than naming a state. `applyCrumbleVulnerable()` (`combat.ts`) grants the
Vulnerable 4 when a Crumble happens inside an Encounter, and no longer needs the before-state flag
its predecessor took, because there is no transition to detect.

**Crumble fires from three places, and the manual one is deliberate**: automatically wherever code
marks a Condition and finds all five marked (a Gambit's cost in `EncounterView.tsx`, and the
Recoveries rule below), plus an explicit "I Crumble" control in `VirtuesPanel.tsx` for a Crumble
the fiction demands. The app can only see the Conditions it marks itself, so without that control
a table-called Crumble would have no way in.

**`Unstable` is derived, never stored.** V0.5 gives a Hero Unstable at Rank 4 of any Status and an
enemy at half one of its Limits; `isUnstable()`/`isEnemyUnstable()` compute it. The old stored
`CombatParticipant.Unstable` field was deleted — it was written once as `false` by
`newParticipant()` and never set by anything, so its badge was unreachable and a stored flag could
only ever drift from the Statuses that determine it.

**Spending the last Recovery gives the Exhausted Condition, and that can itself Crumble you.**
`spendRecovery()` (`logic.ts`) is the single spend path for both sites (the sheet's heal flow and
Combat's Recuperate); it returns `{ Exhausted, Crumbled }` because the three-step cascade — last
Recovery → Exhausted → nothing left to mark → Crumble — is real and easy to miss. Note the related
`normalizeSheet()` change: a missing `Recoveries` now backfills to `RecoveriesMax` rather than 0,
because backfilling an empty pool would silently inflict Exhausted on an old sheet the moment it
was read.

**Adding a new required field to `CharacterSheet` needs a read-time default, not just a type
change.** `Recoveries`/`Scars` shipped in `0.13.0` with no backfill for sheets already saved to
Postgres — an old sheet's JSONB blob has no such keys, so they deserialize as `undefined`, and an
unguarded read (`sheet.Scars.length`, etc.) crashes on render. Fixed in `0.16.1` with
`normalizeSheet()` (`packages/shared/src/logic.ts`), called from `apps/server/src/repo.ts`'s
`getSheet()` on every read — the same self-heal-on-read pattern `campaign.ts`'s bootstrap route
already uses for a missing `Party` row. If you add another required field to `CharacterSheet` (or
any other JSONB-blob type with rows already live in Postgres — `Party`, `Bond`, `Library`), extend
`normalizeSheet()` (or add its equivalent) rather than trusting the TypeScript type to guarantee
the field is actually present on data written before the field existed.

**This rule wasn't actually followed for `Library` until a `0.17.0` audit caught it.** Every
`GameSettings` field added across `0.13.0`/`0.14.0` (`SkillsAtCreation`, `AdvancementTier2At`/
`3At`/`4At`, `RecoveriesMax`) plus `0.9.0`'s `glossary` and `0.14.0`'s `enemies` had no read-time
default, and the live project's `library` singleton predated all of them — silently breaking real
gameplay math (0 Recoveries on new characters, an unenforced Skill-count cap, Advancement Tiers
stuck at 1 forever) rather than crashing, which is *why* it went unnoticed for four versions: no
error ever pointed back to the cause. Fixed with `normalizeLibrary()` (`packages/shared/src/
logic.ts`, unit tested), called from `repo.ts`'s `getLibrary()`, same shape as `normalizeSheet()`.
`Party` and `Bond` haven't needed this yet, but the same audit is a good reminder to actually check
next time either of them gains a required field, rather than assuming the pattern was followed.

## Architecture: Strain & Statuses (V0.6 slice 1, `0.42.0`)

**Statuses stop being ranked tracks.** `CharacterSheet` gains `Strain: boolean[5]` (a short-term
box row, same sparse-marking rule as the old Status row — see `markRank()`/`statusRank()`/
`reduceRank()` in `engine.ts`, all three kept unchanged and now serving Strain instead) and
`HealingTrack: number` (a genuine cumulative clock, 0..`GameSettings.HealingTrackLength`).
`CharacterStatus` is re-typed from `{ Marks: boolean[], Polarity }` to `{ Severity: 'Minor' |
'Major' | 'Severe', Name, Description }` — a named lasting injury in one of three severity slots
(`GameSettings.MinorStatusSlots`/`MajorStatusSlots`/`SevereStatusSlots`, seeded 3/2/1), not a rank.
`Boons: string[]`/`Banes: string[]` are new, freeform situational-tag lists. `CharacterSheet.
Recoveries` and `GameSettings.RecoveriesMax`/`StatusMaxRank` are retired outright (the latter
renamed `StrainTrackLength`).

**New engine primitives (`engine.ts`), replacing the retired ranked-Status functions**:
`markStrain()`/`strainExhausted()` (Strain-specific wrappers over `markRank()`), `statusAbsorb()`
(2/4/6 by severity — how much incoming Strain taking a Status of that severity negates),
`statusPenalty()` (`-1` / `Disadvantage` / `roll 1d6 instead of 2d6` — the roll penalty a Status of
that severity carries, picked by `highestSeverityStatus()`; V0.6: penalties never stack, only the
highest-severity applicable Status counts), `takeStatus()` (the shared "gain a new Status" write
path), `downgradeStatuses()` (Healing-Track-full: every held Status drops one severity, checked
against *starting* slot occupancy so two Statuses can't double-book one freed slot in the same
pass — see its own doc comment), `advanceHealingTrack()`, and `isSubdued()` (derived, not stored —
true only when the Strain track is entirely full *and* every severity slot is full, so no future
incoming Strain at any amount could find a home; V0.6 leaves Subdued's *consequence* undefined, so
this is a badge the table narrates around, not a modal that fires). `isUnstable()` is redefined:
true while holding any Major or Severe Status, not "Rank 4 of any Status" — `UNSTABLE_AT_RANK` is
gone. `computeRollBreakdown()`'s old `StatusSources` (the highest helpful/hindering Status, a
concept slice 1 retires along with Positive/Negative Statuses) becomes `StatusPenalty: { Status,
Penalty } | null` — informational only this slice, not folded into `Total` (Major/Severe change
the shape of the roll, not a number to add); Slice 2 is where this becomes a real roll builder
alongside Skill/Flaw Tags and Boons/Banes, per `WorkPlan-V0.6.md`.

**`StatusesPanel.tsx` is rebuilt — the single biggest UI change in the migration.** Three polarity
groups (Positive/Neutral/Negative, each an unbounded list of ranked rows) become three severity
groups (Minor/Major/Severe, each a bounded number of slot cards — an empty slot shows a "+ Add"
affordance, opening straight into the new Status's own name editor via `InlineEdit`'s
`startEditing`, same one-tap convention `TagList` already established). The resource row loses
Recoveries; a new "Strain" row reuses `StatusBoxes` (repurposed — its sparse box-row geometry
already *is* the Strain track's shape) and a new "Healing Track" row uses `Pips` (a genuine
cumulative clock, the same primitive Potential/Rapport/Bond use — `StatusBoxes` was deliberately
NOT reused here, since Healing Track fills left-to-right rather than sparsely). Boons and Banes
are two `TagList`s, the same primitive Looks/Skill Tags/Flaw Tags already use — no new tag-editing
code needed. `GiveStatusModal`/`HealStatusModal` become `TakeStrainModal`/`RecuperateModal`;
`SubduedModal` is deleted outright (the old three-way Scar/Risk Death/Blaze of Glory choice
retires from the trigger path entirely, per the locked repo-owner decision in
`WorkPlan-V0.6.md` — V0.6 deletes the whole "Limits, Scars, & Death" section). `CrumbleModal`
needed no change (it never touched Statuses); `CharacterSheet.Scars[]` survives as a field with no
current writer, kept so nothing already written is lost and a future Last Stand rule has somewhere
to land.

**`TakeStrainModal`** records incoming Strain (a GM-told amount) and how it was Resisted — roll +
Virtue (reducing the amount), or take a Status instead (absorbing a flat `statusAbsorb()` amount,
severity limited to slots with room), or neither — with whatever's left marked onto the Strain
track. **`RecuperateModal`** replaces spending a Recovery: take 2 Strain to remove one Minor
Status, then report which tier a `+Mettle` roll hit to advance the Healing Track 3/2/1; filling it
runs `downgradeStatuses()` and carries remaining segments onto the fresh track, per V0.6's own
Recuperate text.

**Make Camp's mechanic changed to match V0.6's own new text** ("clear one Condition, Recuperate,
refresh all Armor" — replacing "2d6 Negative / 1d6 Positive Status Ranks, 1d6 Conditions").
`StatusesPanel.tsx`'s `makeCamp()` now only refreshes Armor and lifts the Load lock automatically,
then clears the single Condition `MakeCampModal.tsx` lets the player pick (no more d6-reported
count) — Recuperate stays a separate, always-available self-serve action rather than forced inline,
the same "reminder, not automated" shape `CampActionsModal`'s own Advancement note already uses.
This one mechanic was pulled forward from slice 4's "Moves and Camp content" scope only because
`StatusesPanel.tsx`'s own Make Camp button directly manipulated the now-retired `Recoveries`/
ranked-`Statuses` fields and had to be rewritten regardless; the rest of Make Camp's Move text
(the GM's Countdown-advance prompt, Camp Actions' tag-rewrite option) is untouched, still slice 4's.

**Armor's meaning changed from Status-negation to Strain-negation** — same controls
(`ArmorSection.tsx`), same refresh-at-Camp behaviour, just what marking a box negates.

**Combat was adapted to compile and keep working against the new harm model — not fully
rebuilt.** `WorkPlan-V0.6.md` Section B1's mapping table is the specification slice 3 (`0.44.0`,
"Combat on Strain") will build out in full (surprise, a 2d6 initiative *mechanic* — the roll
itself already existed via `firstToActFromInitiative()` — Potential on Combat Goal achievement,
richer Boss content); slice 1 only applies the primitive-level parts of that same table, because
`CharacterStatus`'s retype broke Combat's compilation regardless of which slice was supposed to
touch it next. What actually shipped here:
- **`EnemyStrainMark`** (`types.ts`) — an Enemy's own named Strain track, `{ Id, Name, Marks:
  boolean[] }`. B1: "Enemies keep a counting track — they have no severity slots." Structurally
  identical to the old per-Enemy ranked-Status row, just without `Polarity` (every track an Enemy
  holds is by construction something inflicted on it) — `CombatParticipant.Statuses` keeps its
  field name, now typed `EnemyStrainMark[]`. `combat.ts`'s new `markEnemyStrain()` is the
  Enemy-side `markStrain()`. `isEnemyDefeated()`/`isEnemyUnstable()` needed no change at all —
  they were always structurally typed over `{ Name, Marks }`, never over `CharacterStatus` itself.
- **`PendingStrainOffer`** (renamed from `PendingStatusOffer`) drops `StatusName`/`Polarity`/`Rank`
  for a plain `Amount` — an attack no longer names a Status at all, only the target's own choice to
  take one (with their own wording) ever does. `EncounterView.tsx`'s "Incoming" section now offers
  three resolutions per B1: apply the Amount directly, Resist first (roll + Virtue), or take a
  Status instead — the same three-way choice `TakeStrainModal` gives the sheet, inlined for Combat.
- **`CombatMoveModal.tsx`**: Engage in Melee/Ranged now deals a flat Strain `amount` (B1: "Apply
  Status N" → "Deal N Strain") rather than a named+ranked Status. Against an Enemy target it also
  asks *which* of the target's own Strain tracks (`EnemyStatusLimit.StatusName`) the amount marks —
  still necessary since an Enemy can hold several independent tracks and `isEnemyDefeated()` keys
  off the track name. The old "Cover" picker (a target's own Positive Statuses, no longer a
  concept) became a plain checkbox note — B1: Cover is now "a Boon on the target, giving the
  attacker Disadvantage," which is a real dice-mechanic change with nothing to auto-apply (this app
  doesn't roll dice) — full Boon/Bane roll integration is slice 2's.
- **Gambits**: `Bolster`/`Press`/`Brace` unchanged in shape (their doc text just says Strain now,
  not Status Rank). `Halt`/`Impede` mark an Enemy target's named Strain track via
  `markEnemyStrain()` (their PC-ally-target branch, unreachable in practice — Gambits only ever
  attach to a PC's Engage roll, which only ever targets the opposing side — logs a "no automated
  way yet" note rather than silently doing nothing, consistent with this app's existing "no
  generalized cross-character Status targeting" limitation). `Calculate`/`Brace` used to grant the
  actor a Rank-1 Positive Status ("Focused"/"Braced"); they now push onto the actor's own `Boons`.
  `Repel` gained a real severity-based push formula for a PC target — `repelPushBandsForStatuses()`
  (Minor 1 / Major 2 / Severe 3 bands, per B1) — alongside the unchanged `repelPushBandsForEnemy()`
  (highest value across an Enemy's own Strain tracks, same as before, just renamed and no longer
  Polarity-filtered).
- **`applyCrumbleVulnerable()` is deleted**, per B1's "Legacy code left stranded" list: V0.6 drops
  the "you gain Vulnerable 4" clause from Crumble in Combat entirely. `EncounterView.tsx`'s Crumble
  banner still tells the player to leave the scene and clear a Condition; it no longer claims a
  Vulnerable grant that no longer happens.
- **`ParticipantCard.tsx`**'s shared shell takes pre-rendered `statusBadges`/a pre-computed
  `unstable` flag from each of its three variants now, rather than interpreting raw Status data
  itself — a Hero's own Statuses (severity slots) and an Enemy's Strain marks (named counting
  tracks) are genuinely different shapes as of this slice, so there's no longer one shared
  rendering rule to hide in the shell.

**Two Adventure Moves (Keep Watch, Undertake a Journey) got the same forced-minimal treatment as
Combat** — their own `giveStatus()` calls (granting "Alert 2"/"Prepared 2"/a named Status) no
longer compile, so they now push the same names onto `Boons` instead, matching B1's own "Statuses
become Boons and Banes (the Alert Boon, the Restless Bane)" wording for Keep Watch. Everything else
about these two Moves' flows (the GM/volunteer roll structure, the options offered, the Rapport-
on-a-miss rule) is untouched — the fuller Move re-authoring A2 describes (Keep Watch's 6- marking
party Rapport instead of everyone's Potential, the Set Out rename, etc.) is slice 4's.

**`normalizeSheet()`/`normalizeLibrary()` extended per the locked plan.** A missing `Strain`
backfills to an empty row, `Statuses` to `[]`, `Boons`/`Banes` to `[]`, and — the one
deliberately-asymmetric default — a missing `HealingTrack` backfills to **0, not full**: the
mirror image of the old `Recoveries` trap, since backfilling a full Healing Track would falsely
downgrade an old sheet's Statuses the next time it advanced. **A legacy ranked-Status entry
(`Marks`/`Polarity`, no `Severity`) is dropped on read, not translated** — `WorkPlan-V0.6.md`
Section B2's "clean break" decision: there is no honest Rank-to-severity mapping, so pre-migration
Status data on any already-saved sheet is silently wiped the next time that sheet is read, the same
"pre-release test data, no migration path" treatment the V0.5 migration's own slice 1 already used
for the equivalent shape change. `normalizeLibrary()` backfills the five renamed/new `GameSettings`
fields (`StrainTrackLength`, `HealingTrackLength`, `Minor`/`Major`/`SevereStatusSlots`) the same way
it already did for `RecoveriesMax`/`StatusMaxRank`. `seedPlay.ts`'s four demo sheets were
hand-authored fresh (a Boon/Bane/Strain-mark/Status mix per character) rather than mechanically
converted, for the same reason.

**Bundle budget**: this slice's real, necessary first-load additions (Strain/Healing Track rows,
Boon/Bane `TagList`s, the rebuilt severity-group layout — all always-visible sheet content, not
lazy modals) measured at 210.41 kB gzip against the 220 kB cap slice 7 of the V0.5 migration left —
about 9.6 kB of headroom remains. Re-check `apps/web/scripts/bundle-budget.mjs` before slice 2 adds
its own always-visible roll-builder content.

**Deliberately not built this slice, real scope for later slices, not oversights**:
- Skill/Flaw Tags becoming mechanical, Push Yourself, and the rest of `computeRollBreakdown()`'s
  real roll-builder rework (Slice 2, `0.43.0`).
- Combat's own deeper rebuild — surprise, the 2d6 initiative *rule* (the roll primitive already
  existed), Potential on Combat Goal achievement, richer Boss content, and a from-scratch
  reconsideration of the whole B1 mapping rather than this slice's forced-minimal application of it
  (Slice 3, `0.44.0`).
- Re-authoring all 22 seeded Moves' `Results` text against V0.6 (Stand Defiant/Follow a Lead/Strike
  a Nerve/etc. still describe ranked Statuses in their prose even though the mechanics underneath
  changed), the Make Camp/Keep Watch/Set Out/Enjoy Downtime/End the Session flow rebuilds A2
  describes, and the glossary sweep (Slice 4, `0.45.0`).
- Any real Enemy-side Boons/Banes representation — B1 doesn't specify one, and this slice didn't
  invent one; Halt/Impede's Enemy-target path stays a Strain-track mark, unchanged from before.

## Architecture: Rolls (V0.6 slice 2, `0.43.0`)

**Skill and Flaw Tags become mechanical, and `MoveRollHelper.tsx` becomes a real roll builder
instead of a static breakdown.** `CharacterMotif.SkillTags`/`FlawTags` (already real fields, unchanged
since slice 2 of the V0.5 migration) were display-only text until this slice — the ruleset's own
"Skill Tags"/"Flaw Tags"/"Push Yourself" chapters name concrete mechanics this app had never
attached to them: a declared Skill Tag is **+1** on the roll; if a second Skill Tag also applies,
**Push Yourself** — mark one Condition, add another **+1**; each applicable Flaw Tag is **−1** *and*
marks Potential on its own Motif, whether the roll hits or misses.

**`computeRollBreakdown()` (`engine.ts`) takes a new, optional fourth parameter, `RollExtras`** —
`{ SkillTag, PushYourselfTag, FlawTags, BoonsSelected, BanesSelected }` — rather than a new
function, since every existing call site (`CombatMoveModal.tsx`'s Engage roll) still wants the same
Virtue/Condition math with no tags at all, and an optional param with an empty-object default keeps
that call compiling and behaving unchanged. `computeRollBreakdown()` stays a **pure display
function**: it folds a `SkillTag`/`PushYourselfTag`/`FlawTags` selection straight into `Sources`/
`Total` (+1 / +1 / −1 each), and returns a new `Advantage: AdvantageState` field
(`'Advantage'|'Disadvantage'|'Normal'`) from `compareBoonsAndBanes(BoonsSelected, BanesSelected)` —
V0.6's own rule, verbatim: more Boons than Banes relevant to the roll is Advantage, more Banes is
Disadvantage, a tie (including 0/0) is Normal. **Marking the Condition a Push Yourself tag costs,
and the Potential a Flaw Tag marks, are the caller's job, not this function's** — the same
"engine computes the breakdown, the UI applies the mutation via `commit()`" split this module has
always used for Hold grants and Wealth spends; `MoveRollHelper.tsx` calls `markCondition()`/
`addMotifPotential()` directly when the player taps Push Yourself or checks a Flaw Tag.

**A Minor Status now folds directly into `Sources`/`Total` as a real `-1`; Major/Severe stay a
separate, non-numeric `StatusPenalty` display, exactly as slice 1 left them.** Slice 1's own
`StatusPenalty` field was deliberately informational-only for every severity, flagged in its own
doc comment as "Slice 2 turns this into a real roll builder." This slice only did that for the
numeric case: `-1` composes cleanly with everything else in `Total` the way Major's "Disadvantage"
and Severe's "roll 1d6 instead of 2d6" cannot — those change the *shape* of the roll, not a value to
add. **This slice deliberately does not invent a rule for how a Status-driven Disadvantage combines
with a Boon/Bane-driven one** (e.g. does a Major Status plus one extra Bane still read as "just
Disadvantage," or something worse a 2d6 game has no term for?) — V0.6 doesn't say, and Section D of
`WorkPlan-V0.6.md` is explicit that this app doesn't guess at questions the ruleset itself leaves
open. Both are shown, clearly separated, and the table resolves how they combine — the same
transparency-not-simulation treatment this app has given every other roll judgment call since
`0.20.0`.

**`Move.AdvantageTrigger` is retired outright — Advantage is now a general Boon/Bane mechanic, not
a per-Move enum with two hardcoded triggers.** The old field only ever covered two Moves (Follow a
Lead's `'wealthSpend'`, Consult the Past's `'selfReport'`), each with its own hand-built UI branch
in `MoveRollHelper.tsx` that forced a fixed "roll 3d6, keep the best two" state. V0.6's own text for
both Moves already reads as the general mechanic: Consult the Past says "if you have access to a
book or similar record of this info, **add a relevant Boon**" and Follow a Lead says "you may spend
1 Wealth to roll with Advantage" — neither needs a dedicated code path once *any* Boon can tip the
comparison. `MoveRollHelper.tsx` now shows one universal Boons/Banes picker (checkboxes over
`sheet.Boons`/`Banes`, "relevant to this roll") on every Move, replacing the two old hardcoded
branches and the informational-only tooltip fallback that used to cover everything else. **This
slice does not rewrite either Move's `Description` text** — both still read close enough to their
old V0.5 wording to make sense under the new mechanic, and re-authoring all 22 seeded Moves' text
against V0.6 is explicitly Slice 4's job (`WorkPlan-V0.6.md` Section C), not this one's.

**Push Yourself's Condition choice is a free pick among all five Virtues, not tied to the rolled
Virtue** — a judgment call, not a guess: V0.6's text just says "mark one Condition" with no stated
connection to which Virtue is being rolled, and this app already treats "which Virtue's Condition"
as a real player choice everywhere else it comes up (`VirtuesPanel.tsx`'s own Condition buttons).
`MoveRollHelper.tsx` reuses the exact `markCondition()`/`CrumbleModal` pattern `VirtuesPanel.tsx`
already established: marking funnels through `markCondition()`, and a Crumble (all five already
marked) opens the same shared modal rather than inventing a second Crumble-handling path.

**Declaring a Skill Tag is capped at two — the one declared, plus one more via Push Yourself — not
unlimited stacking.** V0.6's own text reads as a binary choice ("declare *your* Skill Tag," singular,
then "if more than one... applies, you may Push Yourself," a single named action costing one
Condition), not "mark a Condition per additional tag." Flaw Tags are the opposite on purpose: V0.6
says "**each and any** Flaw Tag that is relevant... will give −1," which reads as automatic
stacking with no cap, so `MoveRollHelper.tsx` lets the player check as many applicable Flaw Tags as
they like, each an irreversible −1-and-mark-Potential action for that roll (matching the "declare
it, can't take it back" shape `spendWealthForAdvantage` used to have, now generalized to every Flaw
Tag row via a one-way `CheckboxRow`).

**Marking Potential from a Flaw Tag does not auto-open the Motif's own advance picker, even when it
fills the track.** `addMotifPotential()` already reports `{ ready: boolean }` for exactly this case,
and `MotifPanel.tsx`'s own `MotifAdvanceModal` is the dedicated UI for choosing what a full Potential
track becomes — wiring `MoveRollHelper.tsx` to reach into that flow mid-roll would mean importing a
second modal into an already reaction-heavy component for a state transition this slice's own scope
doesn't ask for. The track still fills and stays filled; the player advances it from the Motifs
panel afterward, same as if it had filled any other way. (Note also: V0.6 changes *when* a full
Potential/Rapport track advances — "the next time you Make Camp," not immediately — but that timing
change is `WorkPlan-V0.6.md` Section A2's own item, not assigned to this slice; `MotifAdvanceModal`/
`PartyAdvanceModal` still fire immediately, untouched.)

**Bundle budget**: this slice's real, necessary first-load additions (the Skill/Flaw Tag rows, the
Boons/Banes picker — all part of `MoveRollHelper.tsx`, which renders inline in the Moves drawer, not
behind a lazy boundary) measured at 211.80 kB gzip against the 220 kB cap, up about 1.4 kB from
slice 1's 210.41 kB — roughly 8.2 kB of headroom remains.

**Deliberately not built this slice, real scope for later slices, not oversights**:
- `CombatMoveModal.tsx`'s own Engage roll stays exactly as slice 1 left it — no Skill/Flaw Tag or
  Boon/Bane picker there. Cover-as-a-Boon and the rest of Combat's own B1-mapped roll mechanics are
  Slice 3's (`0.44.0`), which rebuilds Combat's roll surface as a whole rather than patching it here.
- Bond's own roll-affecting spend options (+1 to your roll against them, −1 to theirs against you)
  are Slice 7's five-option Bond spend menu (`0.48.0`) — the existing Aid tooltip in
  `MoveRollHelper.tsx` is untouched.
- Re-authoring `Move.Description`/`Results` text against V0.6's wording (Slice 4, `0.45.0`).

## Architecture: Combat on Strain (V0.6 slice 3, `0.44.0`)

**Closes out `WorkPlan-V0.6.md` Section B1's mapping table and the remaining Combat Loop
additions.** Slice 1 already applied B1 at the primitive level (Strain-dealing, `EnemyStrainMark`,
`PendingStrainOffer`) because retyping `CharacterStatus` broke Combat's compilation regardless of
which slice was "supposed" to own it — see "Architecture: Strain & Statuses" above. This slice
finishes the parts of B1 that didn't need to happen just to compile: Cover as a real Boon/Bane
mechanic, Brace's own numeric effect, and Combat Loop's surprise/Combat-Goal-Potential rules.

**Cover is now a real roll mechanic, not a static reminder.** B1: "A Boon on the target, giving the
attacker Disadvantage." `CombatMoveModal.tsx`'s Engage roll now calls `computeRollBreakdown()` with
real `RollExtras` — the same mechanism Slice 2 built for `MoveRollHelper.tsx`, applied to Combat's
own roll surface for the first time. The Cover checkbox contributes one Bane against the
*attacker's* own roll (matching B1's literal wording — Cover disadvantages the attacker, not the
target); the actor's own sheet Boons/Banes are also selectable as "relevant to this roll," same
picker shape as the sheet's roll builder. `breakdown.Advantage` drives the displayed roll guidance
("roll 3d6, keep the best/worst two") instead of a static InfoTooltip. Deliberately narrower than a
full port of Slice 2's roll builder: no Skill/Flaw Tag picker here — B1 only names Cover, and
Combat's own Skill/Flaw Tag integration wasn't asked for by this slice's scope.

**Brace's mechanical effect was fixed, not just relabeled — a real bug this slice's own research
found, not new scope.** B1: Brace is "−1 Strain from everything until your next turn," a genuinely
different shape from Calculate's "+1 forward." The code inherited from slice 1 mapped *both*
Calculate and Brace onto the same "push a Boon" primitive — reasonable for Calculate (a Boon is
exactly a temporary combat edge), wrong for Brace, which is a numeric damage reduction with a
duration this app has never tracked (the same "Forward"/"Ongoing" gap left freeform everywhere else
— Clocks' losing-side spend menu, Consult the Past's own +1 Ongoing). Silently mapping it to a Boon
would have made Brace *look* wired up while doing something the doc never described (giving
Advantage/Disadvantage instead of reducing incoming Strain). Fixed to match Seize/Other's own
honest treatment: logged only, with the table applying the reduction by hand.

**Surprise (Combat Loop step 4) skips initiative entirely, rather than being folded into it.**
`firstToActFromSurprise()` (`combat.ts`) mirrors `firstToActFromInitiative()`'s shape but needs no
roll: the GM picks which side (if any) was wholly caught off guard, and the *other* side goes
first, no stored field needed (a one-shot action, same as "Roll Initiative" itself — nothing about
"how ActingSide got set" needs to persist). The doc's further "at the GM's discretion" clause (a
head-start round, fewer actions, or Disadvantage for the surprised side) is deliberately not
modeled — open-ended GM narrative discretion, the same class of clause this app leaves to the
table rather than inventing a formula for (Seize/Other Gambits, Boss abilities, Interpose's own
freeform reach). `EncounterView.tsx`'s header carries a "Declare Surprise" control right above
"Roll Initiative," with a one-line note naming that discretion explicitly as a table call.

**Combat Goal achievement now grants real, self-serve Potential — Combat Loop step 3.**
`Encounter.CombatGoalAchieved: boolean` (new field, GM-toggled, mirrors `DefiantGoal.Achieved`'s
shape but Encounter-level since the Combat Goal itself isn't a list entry) drives a banner every PC
player sees once true: pick one of their own Motifs, mark Potential on it. This is self-serve by
necessity, not preference — only a sheet's own owner can write it (`sheet.ts`'s PUT authorization),
the same constraint every other Combat-to-sheet mutation in this app already works around via
`PendingStrainOffer`. `EncounterView.tsx` tracks a local `potentialClaimed` flag per viewer so the
control disappears once used, rather than persisting "who claimed it" on the Encounter — the same
self-report trust model as Aid, Defiant Goal declarations, and everything else a player reports
about their own action. The old "End Combat" confirm text ("everyone should mark Potential... not
automatic") is now backed by an actual control instead of only a reminder.

**"No Potential on a 6- in Combat" is a documented no-op, not built as a suppression rule.** The
doc's full sentence: "Moves in Combat do not award Potential on a 6-... Combat rolls cover smaller
actions than rolls outside Combat, so they occur more often." This is a carve-out from a *general*
"rolls can award Potential on a miss" rule — and this app has no such general rule to carve out of.
The only Potential-on-a-roll mechanic that exists anywhere in this app is Slice 2's Flaw Tags, which
mark Potential unconditionally (win or miss, by the doc's own design) and aren't gated by tier at
all; `CombatMoveModal.tsx`'s Engage roll doesn't touch Motifs or Potential in any way this carve-out
could apply to. Building a suppression mechanism here would mean inventing the very general rule
Section D item 10 ("Any rolls made with a Virtue marked with a Condition award 1 Potential
(optional??)") explicitly flags as still unresolved — exactly the kind of guess this project's own
discipline forbids. Recorded here so a future session doesn't rediscover the same dead end.

**Boss Last Stand and 1d6-Wounded-style attack text get a documented-assumption tooltip, not new
mechanics.** B1's own "left open" note: these numbers are expressed in Ranks in the source text,
read as Strain by this app's mapping, but Ryan's own `!! UPDATE` marker on the Villain template
means this is exactly the area he intends to revisit — "surface it in the UI... rather than bury it
in a constant." `ParticipantCard.tsx`'s `EnemyCard` now shows an `InfoTooltip` next to a Boss's own
badge row explaining this reading. `Villain.Attacks`' own freeform prose ("Fall to my Power! —
...dealing Wounded and Wobbly") is untouched — it was already established as bespoke GM flavor text,
not a formula to extract (`README.md` item 38), and this tooltip doesn't change that.

**`CombatMoveModal.tsx`'s three raw `<input type="checkbox">` elements — Cover, Rolled-12+, and
the two new Boons/Banes pickers — were switched to the shared `CheckboxRow` component, a real bug
this slice's own new interaction-smoke coverage found, not something introduced by it.** A native
checkbox paints at its browser-default size regardless of any wrapping `<label>`'s own
`min-height`; `apps/web/scripts/interaction-smoke.mjs` had no state that ever opened this modal
before this slice added one (`modal: Engage`), so these had never actually been measured — three
13×13px controls, none within the touch-target floor. `CheckboxRow` (`apps/web/src/components/
form/`) already exists for exactly this (a real 44px-tall button, not an overlay) and is what
`MoveRollHelper.tsx`'s own Boons/Banes/Flaw-Tag pickers already use; this file simply hadn't been
brought in line with that convention until this slice touched it. Fixed, `.checkboxRow`'s now-dead
CSS class removed. A second, smaller near-miss surfaced by the same new coverage: once the Boons/
Banes grid used real 44px rows, the InfoTooltip trigger in `.advantageRow` right below it — an
18px circle under a 44px `.tap` overlay, 13px overhang each side — collided by 5px at the old 8px
`margin-top`. Bumped to 24px, the same clearance value `VirtuesPanel.module.css`'s own identical
class of near-miss already settled on; re-verified against the interaction smoke test, not derived
on paper alone.

**Deliberately not built this slice, real scope for later, not oversights**:
- Full Skill/Flaw Tag integration into `CombatMoveModal.tsx`'s roll — B1 only names Cover; giving
  Combat's Engage roll the complete roll-builder parity `MoveRollHelper.tsx` has would be a real,
  separate scope decision, not implied by "Combat on Strain."
- A from-scratch reconsideration of the whole B1 mapping table, versus this slice's application of
  the already-locked version — B1 itself is treated as settled, not reopened here.
- Richer Boss-ability *content* (Grizza's own attacks, etc.) — still freeform GM prose, unchanged.

## Architecture: Combat — track-and-display, per-Status Enemy Limits, no grid

The live Encounter view was originally built against a "Combat Basics V2.2" draft (the most recent
of three competing drafts) cited from the 14,000+-line working design doc `README.md` item 12
describes — a doc that "Architecture: the ruleset and where it lives" above establishes was never
actually committed to this repository. **`Planning Docs/Ruleset-V0.6.md` is now the authoritative
source for Combat rules — with one large caveat: its Combat Basics chapter is byte-identical to
V0.5's.** It was never rewritten for Strain, so it still deals ranked Statuses ("Apply *Status 5*"),
still spends Recoveries, and still defines Unstable at Rank 4, none of which is compatible with
V0.6's own Strain chapter. Per a repo-owner decision the app reconciles this itself rather than
running two harm systems; the mapping is fixed once in `WorkPlan-V0.6.md` Section B1 and written up
as `README.md` item 43. **Slice 1 (`0.42.0`) and slice 3 (`0.44.0`) apply that mapping** — see
"Architecture: Strain & Statuses (V0.6 slice 1)" and "Architecture: Combat on Strain (V0.6 slice 3)"
above for exactly what each changed; this section otherwise still describes the shipped V0.5
behaviour underneath it. **`Ruleset-V0.5.md` was the authoritative source for Combat rules**, adopted as that missing document's successor; the Combat migration
itself, `WorkPlan-V0.5.md` slice 5 ("Combat update"), **shipped in `0.32.0`** — see "Architecture:
the Combat update (slice 5)" below for what it actually built, and the four repo-owner decisions
(`README.md` items 31-34) that scoped it. Everything in this section not called out there as slice
5 work still reflects the original, unverifiable V2.2-draft-derived design, now additionally
confirmed consistent with V0.5 wherever the two overlap. Confirmed with the repo owner before any
of this was built: **track-and-display, not enforcement** — the app shows whose turn it is, AP
remaining, Range, and Statuses live to everyone, but never blocks an action; the GM can always
override. `Encounter`/`CombatParticipant` (`packages/shared/src/types.ts`) are new
play-state, backed by a `combat_encounters` table (migration `0010`, same joinless-RLS-policy
shape as `party`/`bonds`/`character_sheets` — see the Realtime section above) — the first new
table since the campaign-setup work, everything before this was JSONB-field additions.

**Combat is no longer its own screen, as of `0.23.0`.** Repo-owner testing feedback was that
leaving Combat behind a separate `/combat` link cost a click and a full page transition mid-fight,
when the rest of a session lives on the Campaign Shell page. `CombatPanel.tsx`
(`apps/web/src/features/combat/`) holds the actual Encounter view — start-form, `EncounterView`,
all the modals — extracted from what used to be `CombatPage.tsx`'s entire body. `CampaignPage.tsx`
now renders `CombatPanel` inline in **both** `GmView` and `PlayerView` (players are the ones who
apply Status offers and Interpose, so a GM-only section would strand them — confirmed with the
repo owner rather than assumed), imported via `React.lazy` from both call sites to preserve the
`0.19.0` code-split: eagerly importing `EncounterView` and its modals from `CampaignPage`, which
every player loads, would have undone that bundle win. The GM's view always renders the lazy
panel, since a GM always needs the start-Encounter form regardless of whether one is running; a
player's view only triggers the lazy import once `boot.encounter` is non-null, otherwise a plain
`<p>No Combat right now.</p>` with no import at all. `CombatPage.tsx` still exists at
`/c/:campaignId/combat` — now a thin wrapper around the same lazy `CombatPanel` — kept alive
deliberately as a working deep link, not left over by accident.

**Range is theater-of-the-mind bands** (`CombatRange`: Melee/Close/Far/VeryFar/OutOfRange), not a
rendered grid — a real map is out of scope for this app (confirmed with the repo owner), not an
oversight. The doc's Maneuver ("up to 6 squares")/Shift ("up to 2 squares") distinction doesn't
translate cleanly to bands; `shiftRange()` in `packages/shared/src/combat.ts` is a deliberate
simplification (documented there, not silently invented) and the UI only exposes one generic
1-band-per-AP reposition control, not separate Maneuver/Shift buttons — revisit if that split
turns out to matter in play.

**V0.5 turns this from an unresolved reading into a confirmed standing deviation.** The old
"up to N squares" phrasing above came from the same doc "Architecture: the ruleset and where it
lives" establishes was never actually in this repo; V0.5, by contrast, states an explicit grid —
squares or hexes, Melee = Range 1, Engage at Range = Range 10, Maneuver 6 spaces, Shift 2, enemies
move 6 spaces, Repel pushes a stated number of spaces. Given that explicit spec, the repo owner
re-affirmed keeping the 5-band ladder anyway rather than building real grid/hex geometry — the
grid stays a tabletop-only concept, and V0.5's space counts are mapped onto the existing bands
instead (`README.md#architecture-notes--judgment-calls` item 15 stands unchanged). The collapsed
single Reposition control above is the same call continued, not something V0.5 reopens. That
space-to-band mapping is now worked out explicitly, as of slice 5 (`0.32.0`): see `shiftRange()`'s
doc comment in `packages/shared/src/combat.ts` for the actual ratio derived from V0.5's numbers —
this didn't change the band model itself, only documented the conversion the existing constants
already approximated.

**PCs keep one source of truth for their own Statuses: their own `CharacterSheet`.**
`CombatParticipant.Statuses`/`Toughness`/`StatusLimits` are Enemy-only fields — a PC participant
is a thin pointer (`RefId` = `CharacterId`) at data that already lives on their sheet. This
collides with the sheet's existing owner-only write rule (`sheet.ts`'s PUT: only
`membership.CharacterId === characterId` may save it — not even the GM), which matters a lot in
Combat: an Enemy's attack can't write a Status directly onto the PC it's hitting. The fix is
`Encounter.PendingStatusOffers` — anyone can create one (it's just an Encounter field), but only
the target's own player can fulfill it, from their own participant card, optionally Resisting
first (`resistRollReduction()`, same formula as everywhere else) before it lands on their sheet
via `useCommitSheet`. Don't try to have the GM write a PC's Statuses directly if you extend this;
route it through a `PendingStatusOffer` instead.

**Enemies are defeated per-Status, not by one shared pool**: `isEnemyDefeated()` checks each of an
Enemy's `StatusLimits` independently — reaching *any one* Limit (e.g. `Hurt 4`) defeats it, even if
every other tracked Status is still low. `Toughness` (`applyToughness()`) blunts what an Enemy
takes: Medium is a flat −2 to the incoming Rank (floored at 1), Heavy re-derives the Rank as if
the roll had landed one tier lower — both per the doc's own wording.

**Enemy authoring is ad-hoc-first with an optional save to a reusable library** (confirmed with
the repo owner over the "ad-hoc only" vs "full library" fork): `AddParticipantModal.tsx` lets a
GM spawn an Enemy purely ad-hoc (nothing persists) or from `library.enemies`
(`EnemyTemplate`, real Content Admin CRUD, generic schema-driven like every other collection) —
and an ad-hoc one can be checked to save itself to the library on the way in, so the GM never has
to author monsters in a separate screen mid-session if they don't want to.

**Gambits (`0.15.0`) attach to an Engage roll, PC actor only** — their cost is marking a
Condition, which only PCs have, so the `CombatMoveModal`'s Gambit picker only appears when
`actorSheet` is non-null (i.e. the viewer is the acting PC; an Enemy's Engage never offers them).
`gambitConditionCost()` (`packages/shared/src/combat.ts`) encodes the doc's cost rule: 1 Condition
per Gambit on a 10+ (the first free if the roll was exactly 12+, reported via a checkbox — this
app doesn't simulate dice, see the engine note above), one Gambit only on a 7-9, costing 2
Conditions. Of the nine Gambits (`GAMBITS`), **seven reduce cleanly to the existing Status/Range
primitives and are fully automated** (Bolster: +1 to the Rank the roll already gives; Press: shift
2 Range bands free; Halt/Impede: a second Rank-2 hindering Status on the target; Calculate/Brace:
a Rank-1 helpful Status — Focused/Braced — on the actor, which then naturally shows up as the
"highest helpful Status" in future roll breakdowns, no separate buff-tracking system needed; and,
as of slice 5 (`0.32.0`), **Repel**: `repelPushBands()` pushes the target back a number of Range
bands equal to its highest Negative Status Rank, optionally reduced by a target Mettle typed into
the Gambit row if they Resist — see "Architecture: the Combat update (slice 5)" below for why this
reverses the original `0.15.0` decision rather than being new scope). **Seize and Other are still
logged to `Encounter.History` only** — their effects ("take something," anything freeform) stay
genuinely open-ended in the doc, not something to invent a formula for; see `EncounterView.tsx`'s
`applyGambits()` before changing this.

**Dishonored's Combat effect (Vulnerable 4) is real as of `0.17.0`**, not the "once it's built"
placeholder its own glossary text promised for four versions. `applyDishonoredVulnerable()`
(`packages/shared/src/combat.ts`) grants a flat Rank-4 negative "Vulnerable" Status the moment a
PC's Condition mark inside `EncounterView.tsx`'s `applyGambits()` — the only place Combat currently
marks a Condition — pushes them into Dishonored (all five Conditions marked), reusing `giveStatus()`
rather than a new mechanic, same pattern as Calculate/Brace. It only fires once, at the
false-to-true transition, so it doesn't re-stack on every later Gambit paid for while already
Dishonored. **Deliberately scoped narrower than "whenever a PC is Dishonored in Combat," and
flagged here as a judgment call worth revisiting, not a settled edge case**: a PC who enters an
Encounter already Dishonored, or who becomes Dishonored some other way while an Encounter is merely
open in the background, does not get this applied retroactively — there's currently no other
in-Combat path that marks a Condition to hook into. Revisit this scoping if a wider set of
in-Combat Condition-marking triggers gets built later (e.g. a Combat Move that costs a Condition
outside the Gambit system).

**All seven Reaction Moves are now wired up.** Five shipped in `0.16.0`, the last two with a shared
theme: neither needed a new mechanic, just reuse of existing ones off-turn. **Opportunity Attack** is literally
`CombatMoveModal`'s Engage-in-Melee flow (roll breakdown, tier, even Gambits) triggered from a
standalone "Reactions" button rather than from the acting participant's own card, with a `free`
flag on the `engaging` state that skips the AP deduction both `applyToEnemy`/`offerToPC` normally
do. It's manually triggered, not auto-detected — this app already collapsed Maneuver/Shift into
one generic Reposition (no distinct "which move did the enemy use to leave" signal to react to),
so whether the fictional trigger happened is a table judgment call, same as everywhere else in
Combat. **Interpose** redirects an existing `PendingStatusOffer` to the interposer instead of
creating a new one — sets `Resistable: false` (the doc is explicit interposing can't be Resisted)
and does a real Range swap between the two participants ("swap into their space"). Both are
PC-only, same reasoning as Gambits: their trigger conditions (an ally in `PendingStatusOffers`, an
Enemy at Melee range) only make sense from a PC's-eye view of the fight.

**Help and Resist are the other two, and one of them was already built before slice 5 started.**
Help (spend 1 Rapport for +1 on another Hero's roll, even after it's rolled) shipped in `0.18.0` as
part of Rapport-as-Aid — `EncounterView.tsx`'s `help()` — and already matched V0.5's wording almost
verbatim; the CLAUDE.md text once claiming it as "not built" was simply never corrected once V0.5
made it official, found only when slice 5's pre-code Explore pass re-verified every claim against
the actual shipped code (`README.md` item 34). **Resist** (reduce forced-movement distance by up to
your Mettle) was the one genuinely unbuilt Reaction Move, and shipped in slice 5 (`0.32.0`) as a
self-reported, manually-triggered action — same pattern as Opportunity Attack, not a new persisted
offer type, since `resistForcedMovementBands()` just needs a "how many bands were you pushed"
number and the resister's own Mettle. See "Architecture: the Combat update (slice 5)" below and
`README.md` item 31 for why a persisted async pending-push type (mirroring `PendingStatusOffer`)
was considered and deliberately not built — Range isn't ownership-gated the way Statuses are, so
there was no correctness reason to add one.

**Armor already costs 1 AP in Combat, and always has since `0.16.0`.** `EncounterView.tsx`'s
`defend()` deducts `ActionPointsRemaining` when Armor is marked Used mid-fight — the CLAUDE.md text
that used to claim this was "not built" was describing `ArmorSection.tsx`'s separate sheet-side
toggle (used *outside* Combat, with no AP cost, since there's no AP outside an Encounter), not this
route. Same class of stale-doc gap as Help above, corrected in the same slice-5 pass.

## Architecture: the Combat update (slice 5, `0.32.0`)

**Per-unit turn order replaces the single `ActingSide` toggle, as a GM-overridable suggestion, not
an enforced algorithm** — consistent with Combat's whole track-and-display design. `Encounter`
gained `ActingParticipantId` (whose turn it is) and `PairedParticipantId` (for "two Heroes act
together as one pick"); `endTurn()` (`packages/shared/src/combat.ts`) recharges AP and sets
`HasActedThisRound` only for the acting participant (and partner, if paired) — the actual "AP
recharges at the end of that Hero's own turn" rule, replacing the all-at-once reset
`startNewRound()` used to also do. `startNewRound()` now only clears everyone's acted flag at a
round boundary. `nextActor()` suggests which *side* goes next under V0.5's alternating-with-
leftovers-act-consecutively rule; which specific unit on that side goes is left to the table, same
as the doc's own wording ("Heroes should choose the order each round that best fits their current
strategy") — `EncounterView.tsx`'s header exposes two selects (current actor, paired-with) the GM
can set to anyone, at any time, regardless of what `nextActor()` suggested. See `README.md` item 31
for why this shape was confirmed with the repo owner before building, rather than assumed from
WorkPlan's own paraphrase.

**Cover (V0.5, superseded by V0.6 slice 3 — see "Architecture: Combat on Strain" above for the
shipped mechanic)**: originally, `CombatMoveModal.tsx` accepted the target's own Statuses and
offered a "Target's Cover" picker — any of the target's Positive Statuses, or None — whose Rank
subtracted from both the displayed and applied roll total, the same transparency pattern
`StatusSources` used for the actor's own Statuses. Positive Statuses no longer exist (V0.6 slice 1
retired the whole ranked-Status model); Cover is now a Boon-driven Disadvantage on the *attacker's*
roll instead. Left here as history rather than deleted — deliberately not a hardcoded match against
"Cover"/"Hidden"/"Invisible" was, and still is, the right call either way: V0.5's own examples were
illustrative, not exhaustive, and every Status/Boon/Bane in this app has always been author-defined
free text — see `README.md` item 32.

**Boss Enemies get minimal wiring, not a full mechanism** (`README.md` item 31): `CombatParticipant.
IsBoss`/`GambitCharges` (also on `EnemyTemplate`, both flowing through `newParticipant()` and
Content Admin's `enemies` schema) give a Boss its own numbered Gambit-charge pool — a plain stepper
on `EnemyCard`, not simulated Gambit content. Reaching a Status Limit no longer auto-sets `Defeated`
for a Boss the way it does an ordinary enemy (`!t.IsBoss` guards in `EncounterView.tsx`'s
`applyToEnemy`/`applyGambits`); instead a derived "Last Stand" badge appears (reusing the existing
`isEnemyDefeated` check — no new stored flag, same principle as `isUnstable`/`isEnemyUnstable`
already being derived rather than stored), and the GM marks the Boss defeated manually once the
fiction says so. A "Boss Acts" button pair (Melee/Ranged, `free: true`, no AP cost — same flag
Opportunity Attack uses) reminds the GM a Boss gets an action after every Hero's turn; it's a
reminder and a trigger for the *existing* Engage flow, not a new action type. The Boss abilities
themselves (Grizza's "Fall to my Power!", "Fearsome Yell," and similar) stay freeform GM content —
the doc's Boss text is bespoke per-boss flavor, not a generalizable system to extract a formula
from, the same reasoning that left the 25 Improvement Trees' nodes as placeholders in `0.31.0`.

**Combat's start form now asks V0.5's actual Combat-Loop-step-1 questions and computes a real
two-branch Rapport delta**, closing `HANDOFF.md` open issue 13 for good rather than just surfacing
it. `combatStartRapportDelta()` (`packages/shared/src/combat.ts`): initiating grants +1 (+2 if
every Hero shares the fight's goal); not initiating grants −1 only if the party is also
ill-prepared or off-balance; a fair fight the Heroes didn't start and aren't unready for gets no
change — see `README.md` item 33 for why this needed no repo-owner call (the doc's own two branches
read as clearly mutually exclusive, unlike most of the ambiguities this migration has hit).
`apps/server/src/routes/combat.ts`'s `/start` route computes this server-side from three booleans
the GM answers on `CombatPanel.tsx`'s start form (`CheckboxRow`), and writes the Rapport change in
the same request that creates the Encounter so a failure on either side can't leave one half done.

**Deliberately not built this slice, real scope for later, not oversights** — see `HANDOFF.md`
for the fuller list:
- Hero Moves — blocked on Playbooks not existing as a concept at the time. The repo owner has
  since confirmed Playbooks aren't part of the game's systems at all, so this is now cut rather
  than deferred — see "Working conventions" below.
- A rendered grid, and the Maneuver/Shift distinction noted above.

**`ParticipantCard.tsx` is three explicit variants, not one component with a boolean matrix
(`0.19.0`).** It used to take 6 boolean props (`canControl`, `canEngage`, `isOwnPC`,
`canRecuperate`, `canDefend`, `canHelp`) to render what were always one of three fixed
combinations — the tell was `EncounterView.tsx`'s enemy call site passing three literal no-op
handlers (`onRecuperate`/`onDefend`/`onHelp={() => {}}`) purely to satisfy the shared prop type.
Only `canControl` turned out to be a genuinely orthogonal permission (true for both an own-PC card
and an enemy card, varying per viewer for both); the other five collapsed into exactly which of
`OwnPCCard`/`AllyPCCard`/`EnemyCard` a card is — a shared, unexported `ParticipantCardShell` in the
same file holds the actually-common chrome (name/badges, Range/AP stepper, Statuses, the
remove-confirm flow), and each variant supplies its own action buttons as plain children rather
than a render prop, since none of them need anything from the shell beyond what they already have
via `participant`. `EncounterView.tsx`'s Party section picks `OwnPCCard` vs `AllyPCCard` per
participant based on `p.RefId === myCharacterId`; Enemies always render `EnemyCard`, with Engage
gated on the same `canControl` flag rather than a separate `canEngage` prop (they were always the
same value, `isGM`). If Combat ever needs a fourth kind of card, extend this pattern — a new
variant plus whatever the shell needs to expose — rather than reintroducing a boolean-matrix
component. The shell gained one optional `extraBadges?: ReactNode` slot in slice 5 (`0.32.0`) for
`EnemyCard`'s Boss-only "Last Stand" badge, rendered in the shell's own badge row alongside
Toughness/Unstable/Defeated — a second, narrow extensibility point (badges can't be expressed as
`children`, which render in the actions area below) rather than a step back toward per-card
boolean props.

## Architecture: Clocks (slice 6, `0.33.0`)

**The first genuinely new play-state subsystem since Combat**, and the doc it's built from is
messier than any other slice has worked with so far. `Planning Docs/archive/Ruleset-V0.5.md`'s "Clocks"
chapter is explicitly marked "WIP" in the source text and names six variants — Basic, Threat/Quest,
Long-Term Project, Progress, Linked, Mission, Tug-of-War — but only gives Basic a complete
mechanic; the doc even asks itself "\[Threat/Quest\] are these the same thing?" without answering.
Two repo-owner decisions via `AskUserQuestion`, not assumptions, scoped this before any code — see
`README.md` items 35-36 for the full writeup.

> **V0.6 restructures this chapter and slice 6 (`0.47.0`) will rebuild against it — not built yet.**
> `Basic` becomes **Opposition**; `Countdown` splits into **Threat** (gaining a Goal, Skill Tags and
> per-segment Developments, sized 2-4 / 4-6 / 7+ by scope) and **Project**; `TugOfWar` is unchanged;
> and **Linked, Mission, Progress and Long-Term-Project Clocks are deleted outright**, which strands
> `Clock.UnlocksClockId` and `isClockLocked()`. Everything below describes the shipped V0.5 model.

**Three `Kind`s, not six shapes.** `Clock.Kind: 'Basic' | 'Countdown' | 'TugOfWar'`
(`packages/shared/src/types.ts`). `'Basic'` is the only Kind with the doc's actual mechanic:
`SuccessMarks`/`FailureMarks` tracks, a Hero risking 1-3 Headway before rolling, then
`applyClockRoll()` (`packages/shared/src/clocks.ts`) applying the doc's own table — 10+ gains only
Success, 7-9 gains both (the antagonist gains ground too), 6- gains only Failure — clamped at
`Segments` either way. `clockOutcome()` auto-resolves the Clock the instant either track fills
(`'Both'` is a real return value for the rare roll that fills both tracks at once — the doc gives
no precedence between them, so this app doesn't invent one; the UI tie-breaks toward `'Success'`
rather than silently picking a side without saying so). `'Countdown'` collapses
Threat/Quest/Mission/Progress/Long-Term-Project into one GM-ticked single track (`SuccessMarks`
doubles as "the" track for both non-Basic Kinds) — the doc gives none of the five any mechanical
difference from the others beyond flavor text, and Threat/Quest specifically are treated as one
concept, the same "doc contradicts itself, pick the usable reading" call already made for
Bond/Kin/Kith. `'TugOfWar'` is Countdown's same single track, just also allowed to move down
(`tickClock()` accepts a negative delta). Neither Countdown nor TugOfWar auto-resolves — a GM's
manual Resolve action is the only way one of those Kinds ends, since the doc gives no completion
semantics to key off (the same "minimal wiring, GM narrates" shape slice 5 used for Boss enemies).

**Linked Clocks are a reference field, not a fourth Kind.** `Clock.UnlocksClockId` names the Id of
the Clock a *prerequisite* Clock's own Success resolution unlocks — `isClockLocked()` checks
whether anything points at a given Clock via this field and hasn't yet resolved as Success. A
locked Clock still *displays*, just badged Locked, rather than being hidden: the doc's own example
("a linked clock called 'Trapped' after 'Alert' fills") reads as the GM pre-announcing what's
coming, not concealing it, and this app already has a "still shows, just marked unavailable" shape
for exactly this kind of gating (`improvementState()`'s locked Improvement nodes, slice 4).

**The losing-side spend menu stays freeform and logged, not mechanically enforced.** On a Basic
Clock's Failure, the doc lets the Heroes spend up to 4 of the Headway they *did* make (1-for-1) on
four listed effects — two of which grant "Advantage/Disadvantage Forward," V0.5's term (also seen
in Discern the Truth's "+1 Forward") for a bonus scoped to the very next roll. This app has never
tracked a bonus across rolls — Advantage/Disadvantage itself stays purely informational except for
two already-built, narrowly-scoped triggers (see the Wealth/Treasure/Advantage section below).
Building real Forward tracking would mean a new persisted per-character pending-roll-modifier
concept consumed by whichever roll comes next — a real cross-cutting mechanic well beyond what a
Clocks slice should take on. Clicking a spend option just logs the choice to the Clock's own
`History`; the table enacts it, same treatment Combat's own Seize/Other Gambits already get.

**New table, not a JSONB-field bolt-on**, following the exact pattern `combat_encounters`
established (migration `0010`): a `clocks` table (migration `0011`) with `campaign_id`/`data`
columns, a joinless RLS SELECT policy via `private.is_campaign_member()`, and Realtime publication
membership — see the Realtime section above for why the policy has to stay joinless. **Unlike an
Encounter, several Clocks can be open in a campaign at once** (layered obstacles, a Threat running
alongside a Basic Clock) — there's no "the active one" concept, so `CampaignBootstrap.clocks` is
the full list (Open and Resolved alike), and `apps/server/src/repo.ts`'s `listClocksForCampaign()`
has no `getActive`-style single-row sibling the way Combat's `getActiveEncounter()` does.
`useClockActions()` (`apps/web/src/lib/mutations.ts`) applies the server's authoritative result
into that list on every write, the same shape `useBondActions()` already established for `bonds`
(another list-within-`CampaignBootstrap` field) — not `useOptimisticCommit`'s single-field
get/set shape, which doesn't fit a list.

**`ClocksPanel.tsx` (`apps/web/src/features/clocks/`) renders inline on the Campaign Shell for
both GM and Player views, independent of Combat** — the doc's own examples (a chase, an
infiltration, "violent skirmishes that don't require Combat") are explicitly non-Combat scenarios.
Lazy-loaded from `CampaignPage.tsx` exactly like `CombatPanel` (a GM's view always renders it, to
expose the New Clock form regardless of whether one exists yet; a player's view only triggers the
import once `boot.clocks.length > 0`) — bundle protection matters more here than usual: this slice
left the budget at 207.13 kB gzip against a 208 kB cap, under 1 kB of headroom. **Whichever slice
touches the main bundle next needs to check the budget before adding anything eagerly loaded, not
after** — there is essentially no room left to absorb a surprise.

**Deliberately out of scope this slice**: Clocks don't feed `CampaignOverview.LastPlayedAt`'s
max-timestamp derivation (`auth.ts`) the way sheets/party/bonds/encounters do — a real, easy
follow-up, just not done here since nothing depends on it yet. Project Clocks (the `'Countdown'`
Kind, when used for V0.5's "Long-Term Project" case) have no automatic hookup to Enjoy Downtime's
"Advance" activity — that Move stayed reference-text-only until slice 7 built Enjoy Downtime for
real (below), so a Project Clock is now ticked through that guided flow rather than the generic
GM-stepper.

## Architecture: Party Identity & Camp (slice 7, `0.34.0`)

**Playbooks are not part of this game's systems, confirmed directly by the repo owner — a real
ruleset decision, not an inference from `Ruleset-V0.5.md`'s own "Coming Soon" text.** The doc's
"Hero Moves and Playbooks" section (Section D item 15 of `WorkPlan-V0.5.md`) reads as though
Playbooks were simply unwritten yet; they're cut outright. This closed a standing open question:
**Hero Moves are cut too**, not deferred — they were the one thing in the doc that named Playbooks
as their own foundation, so with no Playbook system to hang them off, there's nothing left to build
toward. See "Working conventions" below for where this now lives in the maintained "not built" list.
This slice's own name is affected only in wording, not in what it built: nothing here ever
implemented a Playbook mechanic (a full character-class template with authored moves/abilities) —
it's freeform party identity data, so the rename below is a correction to how this was described,
not a change to what shipped.

**The party gets its own shared identity, mirroring a Hero's Motif at party scope.**
`Party.Motif`/`Quest`/`SkillTags`/`WeaknessTags`/`Path`/`Goal` (`packages/shared/src/types.ts`) are
plain freeform fields any campaign member can edit — the doc gives no structured catalog to pick
from for any of these (and, per the above, never will), so this is the same "write it yourselves"
treatment Quests and Bond Moves got before any catalog existed for those either, not a guess at an
unwritten one. `Motif`/`Quest`/`Path` are standing identity text; `Goal` is the party's current,
changeable objective, set or changed as a Camp Action (below) — kept as a separate field from
`Path` since the doc treats them as two different things (`Path` backs the unique "did we follow
our PARTY PATH" End the Session question; `Goal` is "what are we hoping to accomplish right now").
`WeaknessTags` uses the doc's own word for this section rather than being forced to match a Hero
Motif's `FlawTags` naming. **`PartyPlaybookPanel.tsx` (`apps/web/src/features/sheet/`) lives on the
Character Sheet, not the Campaign Shell** — the same home Rapport and Bonds already have in
`AdvancementPanel.tsx` despite being party-shared data too, so this follows existing precedent
rather than starting a second convention for where shared-but-per-sheet-editable state lives. The
component and file kept their `0.34.0` name (`PartyPlaybookPanel`) rather than being renamed for
this correction — see the note at the end of this section.

**Progressing the party's Rapport now offers a real choice, closing a gap `AdvancementPanel.tsx`'s
own placeholder text used to name explicitly.** Ruleset-V0.5.md's "Party Advancement — Rapport"
lists three options on a full Rapport track: add a Skill Tag, add or remove a Weakness Tag, or
gain a Party Improvement. The third stays unavailable — the doc's own "Party Motif + Improvements"
section names no trees at all, unlike Hero's 25 (see `Improvement`'s doc comment) — but the first
two are real now that `Party` has somewhere to hold the tags. `applyPartyRapportAdvance()`
(`packages/shared/src/logic.ts`) replaces the old `clearRapportForPartyLevel()`, taking the chosen
`PartyAdvanceOption` and an optional tag; `PartyAdvanceModal.tsx` (its own file, lazy-loaded — see
the bundle-budget note below) is the shared "clear it, choose one" dialog both `AdvancementPanel.tsx`
and `EndSessionModal.tsx` open once Rapport fills, the same shape `MotifPanel.tsx`'s
`MotifAdvanceModal` already established for a Hero's own Potential track.

**Camp Assets are a hybrid catalog-or-freeform pick, a repo-owner call rather than a choice between
the two existing patterns this app had for authored content.** The doc describes a single starting
"magic camp item" that levels up through Tiers, with no named examples. Neither of this app's two
existing patterns fit outright: `library.motifs`/`library.moves` (pure library, no per-holder
customization) don't allow a table writing their own, while Combat's `AddParticipantModal.tsx`
tabbed Library-or-Ad-hoc UI adds real complexity (tabs, an RHF form, an optional admin-only
"save to library" write) that a Camp flow open to every player, not just a GM who may also hold an
admin account, shouldn't inherit. The repo owner asked for a genuine third shape instead: a single
text input backed by a native `<datalist>` of `library.campAssets` names (`CampAssetTemplate` — a
new, ordinary schema-driven admin collection, `Name`/`Description`/`Tier`/`Effect`) — typing a name
that matches the catalog autofills the rest and links `RefId`; typing anything else stays a fully
custom, ad-hoc entry (`RefId: ''`). `AddCampAssetModal.tsx` implements this with zero new
dependencies (no combobox library), the accessible native-HTML equivalent of a "freeSolo
autocomplete." Deliberately doesn't offer Combat's "save this ad-hoc one back to the library"
option — that write goes through `requireAdmin`, and this flow is a player action, not a GM one.

**Four Adventure Moves that shipped as reference-text-only in slice 3 (Make Camp, Keep Watch,
Undertake a Journey, Enjoy Downtime) are now real guided flows**, built on the same "player reports
the tier or the number they rolled, the engine applies the mechanical change" pattern every other
roll-driven mechanic in this app already uses (`MoveRollHelper.tsx`'s Hold grants, the Subdued
flow, Resist Rolls) — this app still never rolls dice itself. `TierChoiceRow.tsx`
(`apps/web/src/features/sheet/`) factors out the repeated "report which tier you hit" button row
(10+ / 7-9 / 6-) shared across all four flows' several rolls, rather than copying it four times the
way `MoveRollHelper.tsx`'s own informational tooltip is deliberately left duplicated at its two
render sites (there was no single shared roll-breakdown component to hook a shared version into
there; here there was a small, genuinely identical piece of UI worth extracting instead).

- **Make Camp's personal-resource reset (Statuses, Conditions, Armor, Recoveries, Load) already
  existed** — `StatusesPanel.tsx`'s own "Make Camp" header button (`MakeCampModal.tsx`, predating
  this slice) already reduces Negative Statuses by a flat 2 Ranks and Positive by 1, refreshes
  Armor, refills Recoveries, and lifts the Load lock automatically, then lets the player pick which
  d6-reported number of marked Conditions to clear. This slice found that gap only by nearly
  recreating it with a dice-reported Status-reduction budget of its own before discovering the
  existing button — a reminder to grep for a feature's name before assuming it's unbuilt just
  because a section here doesn't mention it. What slice 7 actually adds is `CampActionsModal.tsx`
  (opened from a **separate "Camp Actions" button**, deliberately not reusing the "Make Camp" label
  a second time for a different modal): advancing a Bad Guy Clock ("once immediately, then again
  per full day at Camp," a days-count input times `tickClock()`), a plain reminder to check
  Advancement for a full Motif/Bond/Rapport track, and the actual Camp Actions the doc names — each
  player gets `campActionsAllowed()` (Party Level + 1) of them per Camp, spent on: setting/changing
  the Party Goal, changing a personal Motif's Quest text, using a Camp Asset (logged to
  `Party.History`), or progressing a personal project Clock (report a tier, tick 3/2/1 segments —
  the same table Enjoy Downtime's own Advance activity uses, since the doc names no separate one
  for this Camp Action).
- **Keep Watch** (`KeepWatchModal.tsx`): the GM's "roll + Nothing" (no Virtue) first, then a
  volunteer's Virtue roll. Both a GM-Tier2 result ("one party member wakes with Restless 2") and a
  volunteer-Tier3 choice ("you're alert — gain Alert 2") name a Status landed on someone other than
  the roller — this app has no `PendingStatusOffer`-style mechanism outside Combat, so per a
  repo-owner call these narrow scope to the viewer's own sheet only (any Status grant here lands on
  whoever is running the flow), with the narrative-only options logged to `Party.History` instead
  of invented as mechanical effects on a teammate this app can't safely target.
- **Undertake a Journey** (`UndertakeJourneyModal.tsx`): Loadout (reuses the existing
  `CharacterSheet.Load.Tier` field/selector rather than duplicating it), then Scout Ahead
  (+Wit, choose up to 2 on a 10+ / 1 on a 7-9 from Alert 2 / a named Status at Rank 2 / Prepared 2 /
  a logged discovery), then Venture Forth (+Guile, a Tier3 choice from four narrative outcomes, a
  Tier2 GM-chosen complication typed in and logged, or a Tier1 miss that marks Potential). Venture
  Forth's 10+ result names "+1 Ongoing to future rolls on this Journey" — this app has never tracked
  a cross-roll bonus (the same "Forward" gap Clocks' own losing-side spend menu already left
  freeform in slice 6), so that stays an informational note rather than new tracked state.
  Self-contained to the acting player's own sheet; no Party/Clock plumbing needed, since nothing
  either phase names is a shared resource this app tracks beyond Rapport-as-Aid, already covered by
  Advancement's existing Aid controls.
- **Enjoy Downtime** (`EnjoyDowntimeModal.tsx`): all seven named activities are real —
  Rest (spend 1 Wealth, clear every Status), Recover (clear every Condition, no cost), Carouse
  (spend 1 Treasure, routes through the existing Bond-propose handshake rather than marking Bond
  directly — Carouse doesn't bypass the handshake any more than Hold-spent Bond marks do),
  Acquire (spend a chosen amount of Wealth, logged with a freeform note), Train (spend 1 Wealth,
  mark Potential on a chosen Motif), Pivot (edit either a personal Motif's Quest or the Party Goal
  — the doc's "change your personal Drive/Want, or as a party change the Party Goal" read as the
  same two targets Camp Actions' own Party-Goal/Quest options already model, so Pivot reuses them
  rather than inventing a third field), and Advance (report a tier, tick 3/2/1 segments on a chosen
  Clock via `tickClock()` — a repo-owner call to wire this to the real Clocks subsystem rather than
  leave it a freeform logged note, since Clocks aren't ownership-gated and `tickClock()` already
  does exactly what "progress a project" needs).

**Bundle budget**: `PartyPlaybookPanel` is always-rendered sheet content (like `AdvancementPanel`),
but is still lazy-loaded with no render condition at all — `CombatPanel`'s existing "GM's view
always renders the lazy panel" shape, applied here because the bundle-budget check
(`apps/web/scripts/bundle-budget.mjs`) excludes any `React.lazy()` chunk from its first-load
measurement regardless of whether it's conditionally rendered. The four guided-flow modals and the
shared `PartyAdvanceModal`/`AddCampAssetModal` are lazy for the more usual reason (rarely opened).
Even after lazy-loading everything deferrable, this slice's real, necessary new sheet content
(`PartyPlaybookPanel`'s always-visible fields) raised the measured first-load gzip from 207.13 kB
to 208.74 kB — over the 208 kB cap slice 6 left under 1 kB of headroom under. Per that check's own
documented policy ("raise it deliberately, with a new measurement recorded, if a legitimate
first-load dependency is ever added"), the budget moved to 220 kB (208.74 kB × 1.05, the same
headroom formula every prior raise used) rather than treating this as a regression to chase down.

**On the naming correction itself**: this section, and every other living doc (`README.md`,
future `WorkPlan-V0.5.md` references), stop calling this feature "Party Playbook" now that
Playbooks are confirmed cut from the game entirely — "Party Identity & Camp" is used instead.
`CHANGELOG.md`'s `0.34.0` entry and `HANDOFF.md`'s forty-sixth-session note keep their original
"Party Playbook & Camp" wording as shipped history, the same way this project never edits a past
`CHANGELOG.md` entry to fix a since-superseded claim (see `README.md` item 7's identical treatment
of the pre-V0.5 "14,000+ line working design doc" citations). The source itself
(`PartyPlaybookPanel.tsx`, `PANEL_IDS`'s `'party'` collapse key, `#p-party`) was not renamed in this
pass — purely a naming/prose correction, not a code change, and renaming a just-shipped file for a
wording fix alone wasn't judged worth the diff noise; revisit if a future slice touches this file
anyway.

## Architecture: GM stat blocks (slice 8, `0.35.0`)

**Villains, NPCs, and Locations are now real Content Admin collections, extending the existing
`library.enemies` pattern exactly as `WorkPlan-V0.5.md`'s slice-8 scope names** — authored,
schema-driven GM content, not a new UI surface or a new server route. `library.villains`/`npcs`/
`locations` (`packages/shared/src/types.ts`) each ship with a real `FieldDef[]` in `schema.ts`, so
Content Admin's fully generic list/detail/create/delete/validation/nav machinery covers all three
for free — no server route code and no admin-page code beyond the three `schema.ts` entries, the
same "zero new plumbing" precedent `CampAssetTemplate` set in slice 7. A new "GM Content" nav group
holds all three, alphabetically, mirroring every other nav group's convention.

**This slice is authored content only — it does not wire a Villain into Combat.** A GM who wants a
Villain fighting as a Boss still creates a separate `EnemyTemplate` (or an ad-hoc Boss) the same way
as before; nothing here adds a `RefId`/spawn path from `library.villains` into a live
`CombatParticipant`. `Villain` deliberately reuses `ToughnessTier`/`EnemyStatusLimit` for its own
Combat-adjacent fields (`Toughness`, `StatusLimits`) so the *data shape* lines up with `EnemyTemplate`
if a later slice ever wants to bridge them, but building that bridge is out of this slice's scope —
see `WorkPlan-V0.5.md` slice 8's own "extending the `library.enemies` pattern" wording, which reads
as "reuse the same authoring shape," not "make a Villain literally combat-spawnable."

**`Villain`'s `Attacks`/`Powers`/`Resources` fields stay freeform prose, not structured data** —
this app has no Ability system to build a real "Enemy Ability Menu/Builder" against (V0.5's own text
for the Attacks field reads as uncertain that one exists either: "Give them Attacks... Enemy Ability
Menu/Builder"), and `Resources` (the doc's "short list of important NPCs, locations, items, secrets,
and ties to the Heroes") is a `taglist` of short phrases rather than `ref`s into the new `npcs`/
`locations` collections — a Resource is often named in prep before it exists as its own authored
entity, and Adventures (slice 9, `0.36.0`) are where a Villain actually gets *linked* to specific
NPCs/Locations (`Adventure.VillainId`/`NpcIds`/`LocationIds` — see "Architecture: Adventures"
below), not this slice — `Villain.Resources` itself stayed exactly this freeform taglist even once
slice 9 shipped, since the doc's own Resources concept is still "a short list of ties," not a set of
structural references.

**`NPC.StatusLimits` is present on every NPC, not gated behind `IsCombatant` at the type level** —
same "field always present, only sometimes meaningful" treatment `EnemyTemplate.GambitCharges`
already gets for a non-Boss Enemy. V0.5's own text ("If your NPC is capable in combat, define their
Status Limits... If they are not, their Status Limits are likely 1 or 2") treats even a
non-Combatant NPC as having *some* Status Limits, just small ones — reflected in the seeded Rosa the
Blacksmith example below (`IsCombatant: false`, a single `Overwhelmed 2` limit) rather than an empty
array.

**`Location.LocationType`, not `Location.Type`** — the field name is deliberately more specific than
the doc's own generic "A Type" heading, since `NPC.Type` is a *different* nine-value enum on the
same schema-driven admin surface and giving both fields the bare name `Type` would read as one
shared concept when they aren't.

**`EnemyTemplate.StatusLimits` was retrofitted from raw `json` to the same new `statusLimits`
FieldType this slice needed for `Villain`/`NPC` anyway — closing `WorkPlan-V0.5.md` Section B hazard
1 for Enemies too, not just for the two new collections.** The hazard named `EnemyTemplate.
StatusLimits` as unvalidated raw JSON and called slice 8 "the most likely place it bites," so once a
real structured editor (`StatusLimitsEditor` in `FieldEditor.tsx`, a repeatable {StatusName, Limit}
row list) and shape validation (`validateLibrary()`'s `statusLimits` branch in `adminLogic.ts`:
every entry needs a non-empty `StatusName` and a `Limit` greater than 0) existed for the new
collections, applying the same field type to the existing one was near-free and left no raw-`json`
StatusLimits field anywhere in the schema. `Move.Results`/`Ability.Effects`-shaped hazards elsewhere
in the codebase are unaffected — `Ability` no longer exists (retired slice 2) and `Move.Results`
already got its own dedicated validation in slice 3; nothing here touches either.

**Seed content is drawn from `Ruleset-V0.5.md`'s own worked example, not invented from scratch.**
The doc's "Villains and Enemies in Combat" section gives exactly one full Villain — Grizza the Tall,
complete with flavor text, a Goal, and a Toughness/Status-Limits stat block (Hurt 12, Scared 13,
Tricked 9) — seeded verbatim as `vil-grizza`. The two seeded NPCs and three seeded Locations draw on
the same worked material: Rosa the Blacksmith is the doc's own named Hook figure ("barges into
wherever the Heroes are, pleading for someone capable to travel into the woods and find where the
goblins dragged off her daughter"); the goblin-clan/ancient-tomb Concept text that introduces Grizza
supplies the seeded Locations (Hollow Bend the hamlet, the Sunken Tomb the goblins overtook, the
Whispering Wood where the daughter was taken). Skreel (a Combatant NPC, `Type: 'Minion'`) is the one
invented entry, added specifically to seed an `IsCombatant: true` example alongside Rosa's `false`
one. Every seeded Location's `CustomMoves` field is left empty — the doc's own "optionally, one or
more custom moves" is left unauthored rather than invented, the same discipline the 25 placeholder
Improvement Trees (slice 4) and the freeform Camp Assets (slice 7) already established for
doc-named-but-unauthored content.

## Architecture: Adventures (slice 9, `0.36.0`)

**The fourth surface, and the one that closes out the V0.5 migration.** `Adventure`
(`packages/shared/src/types.ts`) is campaign play-state, not library content — unlike `Villain`/
`NPC`/`Location` (slice 8), which are shared, reusable stat blocks any campaign could hold, an
Adventure is one GM's specific combination of those for one specific campaign's story, so it lives
alongside `Encounter`/`Clock` (a new `adventures` table, migration `0012`, same joinless-RLS shape)
rather than in `Library`. Its fields follow `Ruleset-V0.5.md`'s own "Adventures" chapter directly:
Concept, Type (`AdventureType` — the doc's six named types, Offensive/Stand/Race/Mission/Mystery/
Journey, each carrying its own "Elements to include" guidance in `ADVENTURE_TYPES`,
`packages/shared/src/adventures.ts`), Hook, a `VillainId`/`NpcIds`/`LocationIds` reference into
slice 8's own collections (an Adventure references them, it doesn't redefine them), floating
Secrets (`AdventureSecret[]` — `{Text, Revealed}`, deliberately no `LinkedToIds`, since the doc is
explicit a Secret never ties to one specific NPC or Location), and a Countdown.

**GM-only, end to end — the first content in this app with no player-facing view at all, not a
scoped-down one.** Every prior slice's play-state (Combat, Clocks, Party) is track-and-display: the
whole table sees the same state, by design. An Adventure's Concept, Villain, and especially its
Secrets (`Revealed` is GM bookkeeping — "has this come up in play yet" — not an access gate on its
own) are spoiler content by the doc's own framing ("never plan the explicit way the Heroes will
uncover" a Secret). `campaign.ts`'s bootstrap route only fetches `adventures` for a GM membership
(the same conditional-fetch shape `invites` already uses for Players); all three Express routes
(`apps/server/src/routes/adventures.ts`) require `Role === 'GM'` — unlike Clocks, where any campaign
member may act; `AdventuresPage.tsx` (`/c/:campaignId/adventure`, linked from `CampaignPage.tsx`'s
GM-only banner) redirects a Player who navigates there directly. `useLiveCampaign.ts` deliberately
does **not** subscribe to the `adventures` table over Realtime, unlike every other campaign table it
syncs — see its own doc comment for why: a `postgres_changes` payload carries a subscribed table
row's *entire* `data` column to the client regardless of whether the app's handler reads it
(this app's handlers just call `invalidateQueries` and ignore the payload — the leak would happen at
the wire level, before any of this app's code runs), so subscribing would leak unrevealed Secret
text to every campaign member's browser the instant the GM saved it. Since only the GM ever edits an
Adventure, a GM's own page just refetches normally and loses nothing by skipping live-push.

**The Countdown is the one place this slice's own first design got reversed mid-build.**
`WorkPlan-V0.5.md`'s scope note reads "a Countdown is a clock variant," and the first cut followed
that literally: a real linked `Clock` row (`Kind: 'Countdown'`), created alongside the Adventure in
one request (mirroring `combat.ts`'s Encounter+Rapport pattern). That fell apart on the same
Realtime fact above: every existing Clock is fully player-visible by design (`ClocksPanel.tsx`
renders for GM and Player alike), but the doc is explicit an Adventure's own Countdown is the GM's
*off-screen* reference — a real, stated distinction from a *Threat* (also Countdown-kind, but
"player facing," the doc's own word), which stays exactly what it always was: a real `Clock`,
created directly through `ClocksPanel`, untouched by any of this. Rather than build this app's first
field-level access-control mechanism to patch a leak in a subsystem built for a different trust
model, the whole design was backed out: `Adventure.CountdownMarks`/`CountdownSteps` embed the
Countdown directly on the Adventure document, and `tickAdventureCountdown()` (`adventures.ts`)
reuses `Clock`'s own clamped-delta tick math as a small standalone function rather than a shared call
into `clocks.ts` (the two operate on different, incompatible shapes). See `README.md` item 39 for
the full writeup — one decision (the Realtime-leak fact), two consequences (the Countdown's embedded
shape, and the surface's GM-only scope), not two independent calls.

**The doc's own "five steps, prose promises six" inconsistency ships unresolved, on purpose.**
`ADVENTURE_COUNTDOWN_STEP_NAMES` (`types.ts`) is exactly `['Seed', 'Bloom', 'Wilt', 'Wither',
'Rot']` — five named steps, matching what the doc actually lists, not the six its own prose
promises (`WorkPlan-V0.5.md` Section D item 12). No sixth step is invented to make the count work,
the same "carry the doc's own contradiction forward rather than guess at a fix" treatment this
migration has given every other unresolved rules question (Bond/Kin/Kith, Crumble/Fall/Dishonored,
and others — see `HANDOFF.md`'s "V0.5 ruleset gaps" list).

**A Concluded Adventure locks its own fields**, the same treatment a Resolved Clock already gets in
`ClocksPanel.tsx` — nothing about a finished story should keep mutating. Reopen and Remove stay
available regardless (gated on the campaign's own archive state alone), since those are the two
actions that make sense to take on a Concluded Adventure. Seed content for the responsive-smoke/
screenshot `?adventures=1` harness fixture reuses slice 8's own Grizza/Rosa/Skreel/Hollow Bend
material rather than inventing unrelated demo content — `Ruleset-V0.5.md`'s own "Sample Adventure"
section, at the very end of the doc, turned out to be entirely empty (bare headers, no content under
any of them), so there was no worked Adventure example to draw from the way Grizza the Tall served
slice 8.

## Architecture: Wealth, Treasure, Advantage, and End the Session (`0.18.0`)

`0.17.0`'s full-codebase audit found several doc-described mechanics with zero representation in
code (see `HANDOFF.md` Open issue 12's "Track B" list). `0.18.0` built the ones that were
unambiguous once scoped with the repo owner; a couple of related pieces are still deliberately
deferred — see below.

**`CharacterSheet.Wealth`/`Treasure` are per-character numbers, not a shared party pool.** Every
doc mention of either (Follow a Lead, Enjoy Downtime's Rest/Acquire/Train/Carouse, refreshing Gear
Charges "at a Merchant") reads as a personal spend ("you may spend 1 Wealth..."), unlike Rapport,
which is explicitly the party's shared track. The doc never describes how a player *gains* either
— per the repo owner, that's deliberately unresolved for now ("we'll decide if we want to reward it
as a GM-side action later"), so both are just a freely player/GM-adjusted `+`/`−` stepper on the
sheet (`StatusesPanel.tsx`), with no automated earn or spend hook anywhere else.

> **V0.5 slice 3 (`0.30.0`) built the one exception this paragraph used to warn against.** Follow a
> Lead now has a real "spend 1 Wealth for Advantage" button in `MoveRollHelper.tsx` — no longer new
> scope once `Move.AdvantageTrigger` existed as a real, typed per-Move mechanic (see below) rather
> than a one-off invented for a single Move. Every other named Wealth/Treasure sink (Enjoy
> Downtime's Rest/Acquire/Train/Carouse) still has no dedicated button — those stay reference text
> until slice 7 builds Enjoy Downtime's own guided flow.

**Advantage/Disadvantage were purely informational from `0.20.0` through `0.29.0`, and are now
partly mechanical again as of V0.5 slice 3 (`0.30.0`) — for the two triggers this app can actually
detect.** `0.18.0` shipped this as `AdvantageToggle.tsx`, an interactive Normal/Advantage/
Disadvantage segmented control repeated at both render sites. The repo owner reported this as
over-built for what was then a per-roll table judgment call the app had no way to track — there was
nothing to "toggle," only something to explain — so `0.20.0` replaced it with a static
`InfoTooltip`/`TooltipSection` and deleted `AdvantageToggle.tsx`/`AdvantageState` entirely. V0.5
named concrete triggers the app *can* detect from state it already has: a new `Move.AdvantageTrigger`
(`'wealthSpend' | 'selfReport'`) drives real, roll-scoped state in `MoveRollHelper.tsx` for exactly
two Moves — Follow a Lead (spending 1 Wealth) and Consult the Past (a self-reported "I have a
written record" checkbox) — switching the roll guidance to "Roll 3d6, keep the best two" once
active. V0.5's third named trigger, Venture Forth without Scouting Ahead, has **no roll UI to
attach to yet** (Undertake a Journey ships as reference text only this slice — see "Architecture:
the ruleset and where it lives" below); it's deferred to slice 7 alongside that Move's guided flow.
Every other Move — and `CombatMoveModal.tsx`'s own Engage-roll render site, which has no V0.5-named
trigger to hook into at all — keeps the informational-only tooltip unchanged, still duplicated
between the two sites for the same reason as before (no single shared roll-breakdown-rendering
component to hook a shared version into).

**`EndSessionModal.tsx` doesn't author or count Playbook-specific questions** — this app has no
Playbook system, since Playbooks aren't part of the game's systems at all (confirmed by the repo
owner, superseding `Ruleset-V0.5.md`'s own "Coming Soon" text — see "Working conventions" below),
so the doc's example "did we uncover something new" / "did you have a notable moment" questions
aren't modeled as data. The table answers them out loud; the modal only asks how many hit (0 / 1–2
/ 3+ for the party's Rapport delta, a free-form count for a player's own Hold grant).
`Party.Path` (slice 7, `0.34.0`) now holds the doc's own unique "PARTY PATH" End-the-Session
question as freeform text, but `EndSessionModal.tsx` doesn't yet surface it as its own listed
question — it stays folded into the generic "how many hit" count, a real gap worth closing later
rather than something this paragraph should imply is solved. `CharacterSheet.Hold` is persisted (not
resolved in one sitting) and spent 1-for-1 through four actions: refresh a Gear item's Charges,
clear a Condition, mark Bond (reuses the existing `MarkBondModal`/Bond-propose flow — Hold spending
doesn't bypass the handshake, it just gates *offering* the proposal), or mark Potential (reuses the
existing tier-picker-at-5 pattern from `AdvancementPanel.tsx`).

> **V0.5 slice 3 (`0.30.0`) made Hold a first-class per-Move mechanic on top of this End-the-Session
> role, and gave it its first sheet-visible readout outside `EndSessionModal`.** Two Moves name a
> literal Hold grant on a reported roll tier — Assess the Situation (10+: 3, 7-9: 1) and Discern the
> Truth (10+: 2, 7-9: 1) — carried on a new typed `Move.HoldGrant` field and applied via
> `holdGrantForTier()` (`engine.ts`) from a "report which tier you hit" control in
> `MoveRollHelper.tsx`, the same "player reports the tier, the engine applies the mechanical change"
> pattern already used for Statuses and Conditions. Every other Move's Tier results stay freeform
> reference text with no mechanical hook. Since Hold can now change mid-session rather than only at
> End the Session, `StatusesPanel.tsx`'s resource row gained a read-only Hold readout alongside
> Wealth/Treasure/Recoveries.

**Deliberately deferred, not guessed at:**
- **The Level Up/Progress the Party Tier-unlock formula.** The doc gates Tier 2 on "4 Tier-1
  advancements *and* Level 5" — but if Level is (as every other reading implies) just the count of
  Potential/Rapport-funded Advancement picks taken, the two clauses can't both be true at once: a
  4th pick puts you at Level 4, and a 5th pick (still Tier 1, since Tier 2 isn't unlocked yet) makes
  it 5 Tier-1 picks, not 4. This compounds the already-flagged `Advancements.md` Potential-tier
  contradiction (item 12/README item 20). No `Level`/`PartyLevel` field exists; `unlockedTier()`
  still gates purely on count, exactly as it has since `0.13.0`. The Move entries for Level Up and
  Progress the Party were still added (their core "spend 5 Potential/Rapport → advance" mechanic
  isn't in question, it's identical to what already ships) — their text just omits the contested
  compound formula rather than asserting an unresolved rule as settled.
- **RESOLVED, slice 7 (`0.34.0`): Undertake a Journey and Enjoy Downtime got real guided flows.**
  Both shipped as `UndertakeJourneyModal.tsx`/`EnjoyDowntimeModal.tsx` — see "Architecture: Party
  Playbook & Camp" above for what each actually covers.

## Architecture: campaign archive freeze

A GM can archive their own campaign (`Campaign.Status: 'Active' | 'Archived'`, migration
`0008_campaign_status.sql`, toggled via GM-only `PATCH /api/campaigns/:id/status` in
`apps/server/src/routes/campaign.ts`). Archiving isn't just a label — it also freezes further
play-state mutations on that campaign. `assertCampaignActive()`
(`packages/shared/src/logic.ts`, throws `CampaignArchivedError` → the route catches it and
responds `409`) is called from every mutating route that touches an archived campaign's state:
sending an invite (`campaign.ts`), Bond propose/accept/reject (`bond.ts`'s shared
`requireCampaignPlayer` helper, so all three get it for free), sheet edits (`sheet.ts`), party
edits (`party.ts`), character creation (`characters.ts`), and redeeming an invite to join
(`invites.ts`). Declining an invite is the one deliberate exception — it doesn't commit anything
new to the archived campaign, so it stays allowed. **If you add a new mutating route under
`/api/campaigns/:id/...`, call `assertCampaignActive(campaign)` after loading the campaign and
before writing anything**, following the try/catch-`CampaignArchivedError` pattern already in
every route above — it's easy to add a new mutation and forget this, since (unlike the
Express-layer-authorization pattern above) there's no RLS or middleware layer that would catch
the omission for you.

On the client, `CampaignBonds.tsx` and `AdvancementPanel.tsx` — the two places with Bond
propose/accept/decline/withdraw controls — hide those controls when `campaign.Status ===
'Archived'` rather than leaving them to fail against the server's `409`. Deliberately **not**
extended to every other sheet field (Virtues, Statuses, Load, etc.): those stay visually editable
on an archived campaign and rely on the server-side freeze alone, since a failed save there
already gets the same minimal `console.error`-only handling as any other failed save in this app
— see `CHANGELOG.md` 0.11.0 for the full scoping rationale if extending this further.

## Architecture: campaign setup phases (Signup → Party Creation → Playing)

`Campaign.Phase: 'Signup' | 'PartyCreation' | 'Playing'` (`packages/shared/src/types.ts`,
migration `0009_campaign_phase.sql`, added `0.12.0`) is a **separate field from `Status`**, not an
expanded archive enum — `Status` stays purely the archive/freeze toggle above; a campaign can be
`Archived` at any `Phase`. See `README.md#architecture-notes--judgment-calls` item 10 before
folding these back into one field. `Phase` is optional on the type: always read it through
`campaignPhase(campaign)` (`packages/shared/src/logic.ts`), which defaults a missing value to
`'PartyCreation'` — matching the migration's backfill default for pre-existing rows, so an
already-running campaign keeps letting a newly-invited player create a character rather than being
retroactively locked out by this feature. New campaigns explicitly start at `'Signup'`
(`POST /api/campaigns`).

GM-only `PATCH /api/campaigns/:id/phase` (`apps/server/src/routes/campaign.ts`) moves between
phases; `CAMPAIGN_PHASE_TRANSITIONS` in `logic.ts` only allows Signup→PartyCreation,
PartyCreation→Playing, and PartyCreation→Signup (the GM reopening signup). Nothing auto-advances
`Phase` to `'Playing'` — `partyReadiness(members)` computes a live "N / M ready" readout (Player
memberships only) purely for the GM to look at; starting play is always the GM's own
`PATCH .../phase` call, `ConfirmModal`-gated on the client if not everyone's ready yet, mirroring
the Archive button's existing pattern. `Membership.Ready` (also optional, defaults to `false`) is
set by the player themselves via `PATCH /api/campaigns/:id/ready` and isn't validated against any
real per-player confirmation yet — see the character-creation note below.

Character creation (`POST /api/campaigns/:id/characters`) is the one route actually gated on
`Phase`: `assertPartyCreationPhase(campaign)` 409s outside `'PartyCreation'`. **Invite-sending is
deliberately not phase-gated** — gating it would retroactively block existing/legacy campaigns
(which default to `Phase: 'PartyCreation'`) from inviting new players at all, a real regression;
closing signup only changes what the client shows (the phase button, the chargen route's redirect
guard), not what the invite API accepts. If you add a new phase-aware mutating route, decide
deliberately whether blocking it on old/legacy campaigns (implicit `'PartyCreation'`) is actually
wanted before gating it — it usually isn't, character creation is the one clear exception.

**Combat joined the phase-gated set in `0.38.0`.** `assertPlayingPhase(campaign)`/
`PlayingRequiredError` (`logic.ts`, same shape as `assertPartyCreationPhase`) 409s
`POST /combat/start` outside `'Playing'`. `PUT /:encounterId` and `POST /:encounterId/end` need no
equivalent gate — `CAMPAIGN_PHASE_TRANSITIONS.Playing` is `[]`, so once `/start` is gated an
Encounter can only ever exist in a Playing campaign, and gating the other two could only strand a
legitimately-running fight. `CampaignPage.tsx` mirrors this: the whole Combat section (heading
included) renders nothing pre-`Playing`, for both GM and Player — no more "No Combat right now."
placeholder before there's any prospect of Combat happening.

**`CampaignSetupChecklist.tsx` (`apps/web/src/features/campaign/`, `0.38.0`) is the shared "where is
the campaign in its setup, and what am I waiting on" panel** the phase model above only ever exposed
piecemeal before this — a phase badge here, a ready toggle there, no single view tying them
together. It renders once on `CampaignPage.tsx`, above the GM/Player split (rendering it inside both
branches would let two copies of the same markup drift), as three lanes — Signup / Party Creation /
Playing, each marked done/current/upcoming — and collapses to a one-line summary once
`phase === 'Playing'` rather than unmounting, so the lanes stay legible as a record of how the
campaign got there. It calls no new game logic: `campaignPhase()`/`partyReadiness()`/
`CAMPAIGN_PHASE_TRANSITIONS` are the same already-tested functions the page used before; the
"Start playing anyway?" `ConfirmModal` stays owned by `CampaignPage`, reached through an
`onStartPlaying` prop. The GM's phase-advance buttons and the ready-tag moved out of the banner
into this panel; the per-player Ready toggle stays on the player's own character card in
`PlayerView` (it reads naturally there), with the checklist showing the same state read from
`boot.members` so the two can't disagree.

**Realtime now actually covers campaign/membership/character state, closing a gap the review round
surfaced.** Migration `0013_realtime_campaign_state.sql` adds `campaigns`/`memberships`/
`characters` to the `supabase_realtime` publication — their SELECT policies were already the
joinless shape Realtime authorization needs (see the Realtime section above), but none of the three
had ever been added to the publication itself, so a subscription to any of them would have received
nothing at all. `useLiveCampaign.ts` gained three subscriptions in the same shape as its existing
ones (`campaigns` filtered on `id`, since the row *is* the campaign; `memberships`/`characters`
filtered on `campaign_id`), and a new `useLiveHome.ts` hook — unfiltered across those three plus
`party`/`bonds`, invalidating `['me']` — makes Home react to a GM closing signup or a new member
joining with no refresh. Unfiltered rather than an id-list filter derived from the current `me`
response, deliberately: the joinless RLS policies already scope delivery per client, and an id list
goes stale the instant the user joins a new campaign — one of the events Home most needs to react
to. `character_sheets` is excluded from `useLiveHome` even though it's published: the only thing
Home reads from it is day-granularity `LastPlayedAt`, and invalidating `['me']` on every sheet
keystroke-driven save would be a lot of refetching for a date that rarely changes. **This migration
needed applying by hand after merge** — see "Deployment" below for why Render never runs one
automatically, and the three prior incidents (`0011`, `0012`, and this one) this exact gap has
already caused.

**Home's tiles gained a phase badge and a "waiting on you" hint (`CampaignTile.tsx`, `0.38.0`)** —
the Home-side half of "what am I waiting on," for a Player membership still in `PartyCreation` with
no `CharacterId` yet, or with one but not yet `Ready`. `PHASE_LABEL` moved out of
`CampaignPage.tsx` into a shared `apps/web/src/lib/phaseLabels.ts` so this tile and the campaign
banner's own badge can't independently drift, the same class of bug `AdvancementPanel`/
`CampaignBonds`'s two separate `TYPE_LABELS` maps already demonstrates. `HomePage.tsx` also split
its one flat tile grid into "Campaigns you run"/"Campaigns you play in" lanes
(`grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))`), so a user who only plays or only
runs gets one full-width lane automatically rather than a half-empty grid.

## Architecture: campaign invites — a dual email send path, code/link stays authoritative (`0.37.0`)

Sending a campaign invite (`POST /api/campaigns/:id/invites`) has always written an `invites` row
and shown the GM a code to relay by hand — through `0.36.0`, that was the entire feature: nothing
was emailed, and there was no copy button or shareable link. `0.37.0` adds best-effort email
delivery on top of the same unchanged foundation — **the invite code/link is still what actually
works; email is a convenience, never a requirement.**

**The send path has to branch, because no single provider covers both cases.** Supabase Auth's
`inviteUserByEmail` *creates an auth user*, so it only works for an address with no account yet;
Resend (a third-party HTTPS email API) can mail anyone but can't get a brand-new user through
signup. `apps/server/src/email.ts`'s `sendInviteEmail()` is the only place that talks to either
provider: it looks the address up first (via `listAuthUsers()` — the same auth+profiles join
`admin.ts`'s own user list already relies on, reused rather than a second, separate paginated
`supabaseAdmin.auth.admin.listUsers()` call) to pick a leg — existing account → Resend, no account
yet → `inviteUserByEmail`. **It never throws**: a provider failure returns `{ delivered: false, via,
error }` rather than propagating, since sending an invite must not fail just because email is down.
With `RESEND_API_KEY` unset, the Resend leg no-ops (`via: 'none'`) — local dev and CI need no mail
provider configured. The Resend leg is a plain HTTPS POST via native `fetch`, not SMTP — raw TCP is
blocked in the sandboxes this project is developed in (see "Sandbox network constraints" below), so
an SMTP client could never even be smoke-tested here, and `fetch` is native on Node 22 so this adds
no npm dependency.

**Supabase's own built-in email service is documented as testing-only** (best-effort delivery, a low
hourly rate limit, and in current projects restricted to project-team addresses) — the
`inviteUserByEmail` leg needs **custom SMTP configured in the Supabase dashboard** before it
actually delivers to a real player's inbox. That's a one-time, config-only step in the Supabase
project settings, not code, but the feature is not actually working end-to-end until it's done —
don't assume it "just works" in production without checking.

**The invite code got wider at the same time, since it's now going out in an emailed URL.** The old
code (`'ROAD-' + Math.floor(1000 + Math.random() * 8999)`, ~9,000 possibilities, looked up globally
by `getInviteByCode` with no uniqueness check) was already thin; putting it in a link makes a
collision concretely reachable. `campaign.ts`'s `generateUniqueInviteCode()` mints an 8-character
code over a 32-symbol alphabet (no `0`/`O`/`1`/`I`, to avoid ambiguity when read aloud or typed by
hand) and retries on an existing hit. Old-format codes already in the database keep working —
`getInviteByCode` is an exact, format-agnostic match.

**The GM invite UI gains a copyable link and a Resend button, both per-invite** — `InvitesPanel.tsx`.
Persisted per-invite delivery status was offered to the repo owner and *not* selected (so this
release needed no migration); the send/resend response instead carries a transient `delivery`
result (`{ delivered, via, error? }`, mirrored on the client as `InviteDelivery` in `apps/web/src/
lib/api.ts`) that the panel surfaces as a dismissing `Toast`. Copy link and Resend are peers of
equal weight, so they're wrapped in `.action-grid` per this app's own documented convention, not
`flex-wrap`.

**There's no dedicated invite route — the emailed/copied link just points at `/?invite=<code>`,**
reusing `HomePage`'s existing `JoinByCode` control rather than adding a second entry point:
`JoinByCode.tsx` prefills its code input from `?invite=` via `useSearchParams`, then redeems through
the exact same `POST /invites/redeem-by-code` path (including `assertInviteActionable`'s email
match) any hand-typed code already used. `App.tsx` additionally stashes `?invite=` into
`sessionStorage` the moment it's seen and restores it once the user is signed in and back at `/`
with no `invite` param — a first-time player invited via Supabase's own `inviteUserByEmail` may have
to confirm their email address in between landing here and actually being signed in, and that
confirmation redirect goes to whatever Site URL is configured for the Supabase project, which
doesn't necessarily carry the query string they first arrived with.

**Three new env vars, all server-side only**: `RESEND_API_KEY`, `INVITE_FROM_EMAIL` (a From address
verified in the Resend dashboard), and `APP_BASE_URL` — a deliberately separate variable from the
existing `WEB_ORIGIN` (`index.ts`'s CORS allow-origin, which defaults to `http://localhost:5173` and
is wrong in production) used to build the link an invite email points at. Declared in `render.yaml`
and `apps/server/.env.example`; none of the three are required for local dev or CI — see the
no-`RESEND_API_KEY` no-op above.

## Data shapes: JSONB blobs keyed by TypeScript

Play-state aggregates — a character's `CharacterSheet`, the campaign's `Party`, each `Bond` — are
stored as single JSONB columns matching `packages/shared/src/types.ts` exactly, not normalized
into columns. The library (game content: virtues, moves, items, abilities, etc.) is one JSONB
singleton row (`library` table, `id='singleton'`). This means most repo functions are thin
`select ... .data` / `upsert({ data: obj })` wrappers — when adding a field, add it to the
TypeScript interface in `packages/shared/src/types.ts` and it flows through without a migration,
*except* when the field needs to be independently queried/filtered (e.g. `campaign_id` on
`character_sheets`, added in migration `0005` specifically so Realtime could filter on it) —
those need a real column plus a migration.

Field naming is PascalCase in TypeScript (`CharacterId`, `UpdatedAt`) but snake_case in Postgres
columns (`character_id`, `updated_at`); the `repo.ts` `map*()` functions do this translation by
hand for row-shaped tables. JSONB blob fields keep their TypeScript PascalCase as-is inside the
JSON.

## Architecture: appearances — a switchable UI look, not a game concept (`0.26.0`)

`WorkPlan-0.26.0.md`, approved by the repo owner before implementation: the app has two
switchable **appearances** — Parchment (the only look before `0.26.0`, and the default through
`0.38.0`) and Notice Board (a dark corkboard-and-pinned-paper metaphor). **Notice Board became the
default in `0.39.0`** (`WorkPlan-0.39.0.md` item 1) — see the "Default flip" note near the end of
this section for how. **Always "Appearance," never "Theme"**
in code or UI copy — `CharacterSheet.Theme`/`ThemePanel.tsx`/`library.themes` are an existing game
concept (a character's narrative Theme), and naming the UI concept the same word would make
`grep -rn theme` useless in a repo whose working convention is "read the code before changing it."
See `README.md#architecture-notes--judgment-calls` item 27 for the full naming writeup.

**Three tiers of token**, all defined in both `apps/web/src/styles/tokens.css` (Parchment) and
`apps/web/src/styles/appearances.css` (`:root[data-appearance='noticeboard']`, same `tokens`
cascade layer — its higher selector specificity outranks plain `:root` on the same element with no
separate cascade layer needed):
- **Tier 1** — the existing palette (colors, `--font-display`/`--font-body`). Notice Board's own
  values live entirely in `appearances.css`; `tokens.css` itself only gained an explicit
  `color-scheme` and the new `--ink-on-ground` token (below).
- **Tier 2** — `--ground-texture`/`--panel-texture`, so `base.css` no longer hardcodes the
  parchment gradients directly.
- **Tier 3** — `--board-*`/`--posting-*`/`--pin-*`, consumed by `.board`/`.posting`
  (`apps/web/src/styles/surfaces.css`, `@layer utilities` — the same layer as `.action-grid`/
  `.tap`, so the decoration reliably outranks a component's own rules without `!important`).

**The rule this establishes: a new token is defined in every appearance, never only in the one
being worked on.** A token defined in just one appearance is the new version of the hardcoded
literal `theme-tokens`'s skill already exists to prevent — Notice Board's Tier-3 values are
neutralised (`transparent`/`none`/`0deg`/`0`) under Parchment specifically so a `.board`/`.posting`
element renders exactly as it did before either class existed.

**`.posting`'s background/border/padding are *not* plain unconditional tokens, unlike everything
else here** — see `surfaces.css`'s own comment for the full reasoning. The items it decorates (a
Looks chip, a Load item row, a Status row, …) already have their own component-authored
background/border/padding, and the `utilities` layer already outranks `components` by design — a
naive `.posting { background: var(--posting-bg); }` with Parchment's value neutralised to
`transparent` would still *win* the cascade and silently erase the item's real background instead
of leaving it alone. The fix: only the properties genuinely inert at their neutral value (tilt,
drop shadow, a new pin pseudo-element) live in an unconditional `.posting` rule; background/
border/padding are scoped to `:root[data-appearance='noticeboard'] .posting`, so that rule simply
doesn't exist for Parchment's cascade to contend with. `.board` doesn't need this split — every
container it's applied to (a bare flex/grid wrapper like `.chips`) has no background/border/
padding of its own to lose.

**Tilt is a per-call-site opt-in** (a `.tilt` class alongside `.posting`), varied deterministically
via `:nth-child(4n+1…4)` — never `Math.random()`, so `npm run screenshot`'s before/after comparison
stays reliable — and capped at 1.5°. On for chip-shaped items (Looks, quest chips, Load items,
Abilities & Skills entries, Armor entries); **off** for `StatusesPanel`'s full-width interactive
rows, per the plan's own carve-out — `getBoundingClientRect()` reports the *transformed* box, and a
tilted row is worse to actually use, not just riskier to lay out.

**`--ink-on-ground`** (`tokens.css`) is the one ink token that genuinely flips polarity per
appearance (`--ink` under Parchment, `--ink-on-dark` under Notice Board) — every other `--ink-*`
opacity stop stays meaningful unchanged, because `.panel`/`.dialog`/`.drawer` all stay a light
surface in both appearances (Notice Board's ground goes dark; its panels don't). Apply it
explicitly wherever text renders straight on the bare page background instead of inside a
`.panel`/`.dialog`/`.drawer` — a real, previously invisible class of UI (`HomePage`'s greeting,
every top-level page's own title, `SectionHead`'s "The party"/"Combat", `CharacterSheetPage`'s
sticky-bar identity, `App.tsx`'s loading screens) that Parchment's near-identical `--ground`/
`--panel` values had been silently papering over the whole time, long before this appearance
system existed to expose it.

**Two more real, previously invisible bugs surfaced by Notice Board's genuinely dark ground, both
fixed for both appearances rather than patched only for Notice Board:**
- `layout.css`'s `.admin-pane` (Content Admin's list/detail panes) never had its own background —
  always relied on the page ground showing through, indistinguishable from real panel chrome only
  because Parchment's `--ground`/`--panel` happen to be nearly the same pale cream. Now explicit
  `--panel`.
- Any unstyled `<button>` fell back to the UA stylesheet's `color: buttontext`, which is
  `color-scheme`-aware — under Notice Board's `color-scheme: dark` (needed for native `<select>`
  chrome, below) that silently resolved to a light default, so a button that forgot its own color
  rendered light-on-light against a `--panel` background. `base.css`'s `button` rule now has
  `color: inherit`, matching `input`/`select`/`textarea`, which already had it.

**`color-scheme: dark` is set on Notice Board's `:root` block** (`color-scheme: light`, newly
explicit, on Parchment's) — needed so native form-control chrome (a `<select>`'s own dropdown/
scrollbar rendering, including the appearance picker itself) doesn't default to whatever the OS/
browser guesses regardless of the page's own painted colors.

**Persistence and no-flash** (`apps/web/src/store/appearanceStore.ts`, `apps/web/src/lib/
appearances.ts`): `localStorage`, mirroring `panelCollapseStore.ts`'s try/catch-with-fallback shape
exactly — read/write live in their own `loadAppearance()`/`saveAppearance()` functions so a
server-backed source can replace them later without touching a call site. The store does not own
the *initial* paint: `index.html`/`harness.html` each carry a small inline `<head>` script that
sets `document.documentElement.dataset.appearance` from the same `localStorage` key before any CSS
paints (has to be inline — a module import runs too late to help). `loadAppearance()` also checks a
`?appearance=` query param before `localStorage` (harmless in the real app, where nothing ever sets
this param) — the test harness navigates with it to force an appearance deterministically for
`responsive-smoke.mjs`/`screenshot.mjs`, and without this check the picker's own displayed value
would silently disagree with what the query param actually rendered — a real mismatch a human
reviewing `screenshot.mjs`'s output would see.

**The picker** is a labelled `<select>` in the app bar (`AppShell.tsx`), alongside About and Sign
out — `0.25.0` ruled the app bar is account/navigation chrome and game-rules controls don't belong
in it; an appearance picker *is* account chrome, so this follows that rule rather than bending it.
Verified against the bar's own documented tightness (see `AppShell.module.css`'s `.adminShort`
comment) at 320/360/390px before landing — it fit; the plan's fallback (move the picker into
`AboutModal`) wasn't needed.

**Testing**: the responsive-smoke/screenshot matrix gained an appearance dimension —
`harnessConfig.mjs`'s `APPEARANCES` list, `harness.html`'s `?appearance=`, and
`SMOKE_APPEARANCE=`/`SCREENSHOT_APPEARANCE=` filters matching the existing route/viewport
convention. CI's `responsive` job is a two-entry matrix over appearance so wall-clock stays flat
rather than doubling. **`appearanceStore.ts` has no dedicated unit test** — `apps/web` has no
vitest suite at all (see "Commands" above), and standing one up (plus a DOM environment for
`localStorage`) just to cover one small store was judged disproportionate to this pass; flagged in
`HANDOFF.md` rather than silently skipped. It's exercised the same way every other web-side store
in this app is (the responsive smoke test, manual QA) — consistent with `panelCollapseStore.ts`
having no dedicated test either.

**The doubled matrix earned its cost immediately**: the first full both-appearance run caught a
real regression the Parchment-only-era hand arithmetic had no way to see — at 360px under Notice
Board, `.board`+`.posting`'s combined horizontal padding squeezed `StatusesPanel`'s dedicated
six-pip Status-rank row (see its own file for the exact number) below what six pips need, so
`Pips` wrapped internally and its touch overlays collided, reproducing the exact overlap bug that
row's whole layout exists to prevent. Fixed with a negative `margin-inline` on `.pipsCell`, driven
by two new tokens (`--posting-pad-x`/`-y`, decomposed out of `--posting-pad` so the fix could
target the horizontal axis alone) — verified with a real rendered measurement after the first
attempt (bleeding only the row's own padding) came in one pixel short in an actual browser, not
just close on paper. That fix then regressed the desktop widths (1024/1440/1920px) in turn, caught
by re-running the full matrix a second time: the negative margin needed resetting inside the
existing `@media (min-width: 1024px)` block (which already resets a different `.pipsCell` property
for the same width switch) and wasn't. Two regressions, two full-matrix runs, both caught before
either shipped — see `StatusesPanel.module.css`'s `.pipsCell` comment for the full numbers. (That
`@media (min-width: 1024px)` block itself became `@container status-col (min-width: 510px)` in
`0.39.0`, when Statuses' polarity groups became columns — see the "Frontend conventions" section's
Statuses-columns note below and the file's own rewritten comment; this paragraph is left as-is,
describing 0.26.0's own history, rather than rewritten to match.)

**Default flip (`0.39.0`)**: `DEFAULT_APPEARANCE` is now `'noticeboard'`, and the storage key
renamed from `asohav.appearance` to `asohav.appearance.v2` (`appearanceStore.ts`, `index.html`,
`harness.html`) — a key rename delivers the one-time forced reset with no marker/migration logic
at all: nobody has the new key yet, so everyone falls through to the new default on first load
after this shipped, and anyone who then picks Parchment writes the new key and keeps it. The old
key is simply never read again (left in place rather than deleted — an inline `<head>` script that
deletes storage is more risk than a few dead bytes). The Motif card readability bug (dark ink on
dark cork, `MotifPanel.tsx` giving its cards `board` instead of wrapping them in one `board` with
each card `posting`, mirroring `LooksPanel`) shipped in the same release, since it becomes the
default first impression the moment this flip lands.

## Frontend conventions

- **Server state only in TanStack Query.** No Redux/Context-based server-state store. Hooks in
  `apps/web/src/lib/` (`useBootstrap`, `useLibrary`, `useMe`) wrap `useQuery`; `lib/mutations.ts`
  wraps `useMutation`. `useLiveCampaign` invalidates query keys on Realtime events rather than
  patching cache data directly — treat Realtime as a signal to refetch, not a data source.
- **There is a type scale and a spacing scale, as of `0.40.0` — use them.** `tokens.css` defines
  `--fs-label` (11px) / `--fs-meta` (12) / `--fs-body` (13) / `--fs-lead` (15) / `--fs-title` (18)
  / `--fs-display` (23), plus `--fs-input` (16, see below), `--track-label`/`--track-tight`, and
  `--sp-1`…`--sp-6` (4/8/12/16/20/28). Before this the app had colour and font-family tokens and
  nothing dimensional, and the sheet feature alone had drifted to **19 distinct px font sizes**, a
  third of them half-pixel, with 11 letter-spacing values across ~44 uppercase micro-labels. Size
  was the one axis `theme-tokens` had nothing to enforce — which is why that skill now covers it
  too. A new literal px font-size or gap in a `.module.css` should be a deliberate, commented
  exception, not the default.
  **The scale is universal as of `0.41.0` — there are zero literal px font-sizes left in any
  `.module.css` under `apps/web/src`.** `0.40.0` adopted it in four panels and this file then
  claimed "~140 literal font-sizes" remained in "the ~19 sheet files it didn't touch"; both halves
  were wrong. The real figure was **405 declarations across 67 files**, and the four panels
  `0.40.0` called converted were only partly converted (`StatusesPanel` still had 19 literals,
  `MotifPanel` 7, `PartyPlaybookPanel` 6) — `tokens.css`'s own "19 distinct px font sizes in the
  sheet feature" comment, written to describe the *pre*-`0.40.0` state, was still an accurate
  description of the state after it. `0.41.0` swept all of them, and 119 `letter-spacing` literals
  with them.
  Per an explicit repo-owner decision, the large display sizes map onto the existing six steps
  rather than extending the scale, so this was not a no-op repaint: `VirtuesPanel`'s Virtue score
  went 26px → 23px, `LoadPanel`'s carried value 22px → 18px, and 17/19/20/21px collapsed to 18px.
  **Three declarations are deliberately still literals**, each load-bearing for a measured budget
  documented in its own file: `AppShell`'s appearance-picker tracking (the app bar needs 357px of a
  360px viewport — 3px of headroom), `MotifPanel`'s `.tagHint` tracking reset, and the two
  lowercase-prose classes where a label tracking would be wrong. Hit-area arithmetic derived from
  `--tap-min`, and container-query thresholds themselves, also stay literal — both are measured
  properties of real content, not scale steps.
- **A repeated text role lives in `apps/web/src/styles/typography.module.css`**, composed in
  (`composes: label from '../../styles/typography.module.css'`), not restated per panel: `.label`
  (uppercase micro-label), `.sectionLabel` (the same at section scope, `--gold-dark`), `.hint`,
  `.leadText`. Same rule as the shared `modal.module.css`/`buttons.module.css` — only extract where
  every consumer's properties match exactly.
- **Short player-authored text is tap-to-edit, never a permanently-live input** — `InlineEdit`
  (`apps/web/src/components/`), and `TagList` for a list of them. This is not only a visual
  preference: the responsive smoke test requires every `button, a, input, select, textarea` to hold
  its own 44×44 non-overlapping hit area on a touch viewport, so a chip built as "live input + its
  own remove button" carries two 44px floors and can never be narrower than ~100px. One control per
  value instead of two is what lets tags flow several to a row and what made a one-line Status row
  possible at 360px. Note the floor doesn't go away — a read-only pill is still a `<button>` — the
  saving is in the *count*. `TagList` also puts its "+ Add" inside the wrap flow; every
  implementation it replaced put it on a row of its own, which is why three Looks used to occupy
  four rows.
- **Any text control the user types into must be at least 16px (`--fs-input`) on a coarse
  pointer.** iOS Safari zooms the entire page when a focused input is under 16px, and the only way
  to suppress that is to disable pinch-zoom, which is a real accessibility regression. The rule is
  global in `layout.css`'s `utilities` layer (not `base.css`) precisely so it outranks a
  component's own `font-size`, and scoped to `(pointer: coarse)` like every other growth rule
  there.
  **This rule is not new and was never broken — read the next sentence before "fixing" it again.**
  It has been in `layout.css` since PR #68. `0.40.0` shipped a *second* copy of it higher up the
  same file and described it in the CHANGELOG, that release's PR, and this bullet as a
  newly-discovered iOS bug it had just fixed; it was not, and tapping a sheet field was not
  actually zooming anything. `0.41.0` removed the duplicate and folded its only two real
  contributions (the `--fs-input` token in place of a hardcoded `16px`, and excluding
  checkbox/radio/range/color) into the original. The lesson is the one this app keeps relearning:
  grep for a rule before concluding it doesn't exist — `0.34.0` nearly rebuilt Make Camp's
  already-shipped resource reset the same way.
- **An `auto-fit` grid of content (as opposed to peer buttons) needs both bounds thought about.**
  `minmax(min(FLOOR, 100%), CAP)`: the `min(…, 100%)` matters because a bare `minmax()` floor is a
  floor the *track* cannot go below, so a 290px floor in a 274px panel overflows (a real latent bug
  `.statusGroups` shipped from `0.39.0` until `0.40.0`); and the CAP matters on full-width panels,
  because at 2560px `.sheet-stack` gives a band 1514px and an uncapped `1fr` hands back six
  absurdly wide columns — worse than the single column it replaced. `.action-grid`'s peer buttons
  are the exception that genuinely wants `1fr`.
- **CSS Modules everywhere**, one `.module.css` per component (the whole UI was migrated off
  inline styles for this — see `CHANGELOG.md` 0.4.0). Design tokens (`apps/web/src/styles/tokens.css`)
  are CSS custom properties ported verbatim from the design handoff — reuse them (`--ink`,
  `--gold`, `--panel`, etc.) rather than hardcoding colors/fonts; if a value repeats and none of
  the existing tokens match, add one rather than writing another literal (`CHANGELOG.md` 0.4.2 did
  a pass consolidating these — read its entry before adding a new `--ink-*` stop, in case one
  already covers it). CSS that's genuinely byte-identical across components lives in a shared
  stylesheet and gets pulled in via CSS Modules `composes: ... from` rather than redefined per
  component — `apps/web/src/styles/modal.module.css` (modal shell) and
  `apps/web/src/styles/buttons.module.css` (the primary-button treatment) are the two so far. Only
  extract a class this way when every consumer's properties match exactly; near-duplicates that
  differ in size/color/spacing are usually real per-context variation, not copy-paste drift —
  forcing them into one class is a design decision (a type scale, a button-variant system), not a
  mechanical dedup. See `CHANGELOG.md` 0.4.2 for what was judged safe to unify and what wasn't.
- **44×44px minimum touch targets**, deliberate 768px/1024px breakpoints (not accidental ones
  from flex-wrap arithmetic) — both are enforced by the responsive smoke test, so a regression
  fails CI rather than getting noticed visually.
- **A row of peer actions of equal weight uses `.action-grid` (`layout.css`, `0.25.0`), not
  `flex-wrap`.** `flex-wrap: wrap` on content-sized buttons isn't a layout, it's an overflow
  fallback — each button is exactly as wide as its own label, so a row breaks wherever labels
  happen to run out of room, `justify-content`'s `flex-start` default leaves every wrapped row
  ragged-right, and leftover space collects at the right edge of the last line rather than being
  distributed. `.action-grid` is `display: grid; grid-template-columns: repeat(auto-fit,
  minmax(var(--action-min, 150px), 1fr))` — every child gets an equal share, the column count
  falls out of the available width, and `--action-min` is set per call site (a row of two long
  labels wants a higher floor than four short ones). Used for the sheet footer row, Statuses'
  Wealth/Treasure/Recoveries and Give/Heal Status rows, Bond actions (`AdvancementPanel`,
  `CampaignBonds`, `EndSessionModal`), and Combat's round-action row. **`auto-fit` over a container
  query on purpose**: a container query still needs someone to derive the right px threshold from
  the widest label plus gaps plus padding (see `StatusesPanel.module.css`'s 1024px comment for how
  much arithmetic that takes and how often it's been re-derived) — `auto-fit` computes the right
  column count from the real content every time, with nothing to get wrong. Container queries stay
  the right tool for *rearranging* a layout (Abilities & Skills going two-column, Load splitting
  tiers from items); `auto-fit` is the right tool for *distributing peers*. **Does not apply to**:
  mixed rows (a flexible text input beside a button — Home's create-campaign row, Statuses' quick-add
  row, Combat's initiative input — these keep the `display: contents` regroup technique from
  `0.18.3`'s `.addRow` instead, since the input should take the slack, not share an equal-width
  cell), chip/tag rows where ragged is genuinely correct (`CampaignTile` roster names, `MovesDrawer`
  filter chips, `ThemePanel`'s available-quest chips — these stay `flex-wrap` for their own layout;
  `ThemePanel`'s chips separately gained `.board`/`.posting` in `0.26.0`, an unrelated appearance-
  system decoration layered on top, not a `flex-wrap`-vs-`.action-grid` call — see "Architecture:
  appearances" above), and multi-pip rows (`Pips` has
  its own hit-area tiling math from the bullet below — don't put one in an `.action-grid` cell
  without redoing that arithmetic). A lone trailing item on the last row is deliberately left as an
  empty half-cell rather than stretched to fill it: there's no CSS-only way to detect "alone on the
  last row" once the column count itself varies with `auto-fit`, and a trailing empty cell reads as
  grid rhythm, not raggedness — an explicit `.span-all` utility (`grid-column: 1 / -1`) is available
  for the rare case a full-width action is a deliberate emphasis choice at every width, applied
  per-child at the call site, never automatically.
- **A tag-collection container/item (a Looks chip, a Load item row, a Status row, …) uses
  `.board`/`.posting` (`surfaces.css`, `0.26.0`) for the pinned-paper-on-a-corkboard look under
  Notice Board** — see "Architecture: appearances" above for the full primitive, the tilt
  constraint, and why `.posting`'s background/border/padding specifically can't be plain
  neutralised tokens the way the rest of this app's token system works. Scoped to the character
  sheet's tag collections per the plan's decision 3 (Looks, Theme's quest chips, Load items,
  Abilities & Skills entries, Armor entries, Statuses rows); everything else in the app gets the
  token repaint only. **Each Motif card joined this list in `0.39.0`** — `MotifPanel.tsx` wraps its
  three cards in one `board`, each card `posting`, no `tilt` (a full-width row of text inputs, the
  same carve-out `StatusesPanel`'s own rows already have) — fixing a real readability bug (dark
  ink on dark cork) that predated this convention being applied there at all; see "Architecture:
  appearances" above's "Default flip" note for why this shipped in the same release as the
  appearance default changing.
- **A repeated-control row (like `Pips`) sharing a line with a flexible text input needs a real
  breakpoint, not a wrapping flex row, once the repeated controls get wide enough.** `Pips` grows
  each dot's *tap* area to 44px on a coarse pointer while keeping the painted dot small (see
  `layout.css`'s `.pip-row` comment) — six pips alone claim ~239px, which the comment there assumes
  will have a line to itself. `StatusesPanel.tsx`'s per-status row (name input + 6 Pips + rank +
  remove, `0.18.2`) used to put all four in one `flex-wrap: wrap` row; on a real iPhone the name
  input rendered narrower than its own value (`"Chubby"` displayed as `"Chubb"`) and the rank digit
  got stranded on its own line next to the remove button, because `flex: 1`'s `flex-basis: 0%`
  doesn't cleanly bump a whole sibling group to the next line the way a stated breakpoint does. Fixed
  by switching `.rowHead` to a `display: grid` with two named-area templates: one row (`name pips
  rank remove`) — today's original layout, unchanged — reflowing below 1024px to `name rank remove`
  on one row and `pips` alone on the next. **`pips` needs a row entirely to itself, not shared with
  `rank` in a split column** — the first cut of the two-row template split "pips | rank" across the
  two mobile columns, which left `pips` only the `1fr` share (~222px at 360px, still short of the
  ~239px six pips need), so `Pips`' own internal `flex-wrap` kicked in and its 44px-tall touch
  overlays (sized for `--tap-min`, not the ~19px painted dot — see `layout.css`'s `.pip::after`,
  unconditional on every pointer type) overlapped between the two wrapped lines, caught by the
  responsive smoke test's hit-area-overlap check. `rank` moved up next to `name`/`remove` instead,
  since it's just a small number badge with room to spare there — and even with a row fully to
  itself, `pips`' 44px-tall overlay still reaches ~12.5px past the painted dot, which very nearly
  overlapped the `Link to…`/`Affected by…` row directly underneath (`.links`, `margin-top: 7px`);
  `.pipsCell` carries an extra `margin-bottom: 14px` below 1024px to cover that.
  **The single-row template only turns on at 1024px, not the phone/tablet 600px break used
  elsewhere in this file** — the first cut used 600px and the responsive smoke test caught it
  overflowing at 768px. This panel doesn't sit at full viewport width: `.sheet-grid` goes
  two-column at 768px, and `StatusesPanel` is in the second (wider) `.sheet-col`, but that column
  is only `minmax(0, 1.5fr)` there — ~382px of content at a 768px viewport, short of the ~470px
  the single-row template needs. It isn't comfortably wide enough until 1024px, where the ratio
  becomes `1.7fr` (~564px of content). The general lesson: a panel inside `.sheet-col` cannot
  assume viewport width is its own width once 768px is crossed — check the actual column math (or
  just run the responsive smoke test) rather than picking a breakpoint from the viewport alone.
  Chosen over the alternative of always stacking those two rows regardless of viewport (simpler —
  one layout rule instead of two — at the cost of extra vertical space on desktop where it isn't
  needed); revisit that trade if the two-template grid proves annoying to maintain. If another panel
  ever puts a multi-pip `Pips` row next to a flexible-width input on the same line, check whether it
  needs the same treatment rather than assuming `flex-wrap` will degrade gracefully — it doesn't
  once the pip count is high enough.
  **This viewport-keyed threshold became a container query in `0.39.0`, and the reason it had to
  wait until then is worth internalizing**: `0.24.0`'s own migration deliberately left this one
  breakpoint unconverted (flagged as a follow-up in both `Panel.module.css` and this file), but a
  container query keyed to the *panel's* width couldn't have told a wide single polarity column
  from a narrow one of three — `0.39.0`'s Statuses-columns feature is what made the conversion a
  hard prerequisite rather than an optional cleanup, since three columns now share one viewport
  width. The container (`container-name: status-col`) lives on the polarity group's own `board`
  element, not the group wrapper around label+board — putting it one level up would fold
  `--board-pad` into the measured width, making the threshold silently different per appearance,
  exactly the class of bug the doubled smoke matrix exists to catch. New threshold:
  `@container status-col (min-width: 510px)`, derived to reproduce the old 1024px-viewport
  behavior at 768px/1024px in both appearances and correctly refuse the single-row template at
  every multi-column width — see `StatusesPanel.module.css`'s rewritten comment for the full table.
  The three groups themselves sit in `.statusGroups`, an `auto-fit` grid
  (`minmax(290px, 1fr)`, per this file's own "distributing peers" rule below) rather than a
  hand-picked column count — 1-up through most tested widths, 2-up at 1440px, 3-up at the sheet's
  own `>=1800px` wide step. An empty group still renders its `board` with a muted "None" line
  rather than being omitted, so a column never collapses to just a label mid-grid.
  **The quick-add row's four controls (`.addRow`, `0.18.3`) hit the same too-narrow-below-1024px
  problem and reuse the same threshold, but not the grid technique** — Polarity/Rank/Add are all
  modest, well-behaved widths (nothing like Pips' 239px), so there's no flex-basis:0 wrapping trap
  to design around. A plain `display: flex; flex-direction: column` on `.addRow` puts the name input
  on its own full-width row with a nested `.addControls` flex row (Polarity, Rank, Add) below it;
  at 1024px, `.addRow` flips to `flex-direction: row` and `.addControls` switches to
  `display: contents`, dissolving the wrapper so its children rejoin `.addRow`'s single-row layout
  directly — reproducing the original one-line order with no extra nesting affecting layout. Prefer
  this simpler `display: contents` approach over `.rowHead`'s named-grid-area trick when a
  breakpoint-gated regroup doesn't involve an item wide enough to trigger the flex-wrap trap in the
  first place.
- **The character sheet's two-column layout is `.sheet-stack` (full-width bands) wrapping
  `.sheet-grid` (a two-column grid), not one element doing both jobs (`0.22.0`)** — a Figma-workshopped
  fix for every panel being forced into one of two columns regardless of fit (3 panels on the left, 5
  on the right, which read as arbitrary rather than deliberate). `.sheet-stack` (`layout.css`) is now
  the outer container — `max-width`/centering/padding/vertical `gap` live here, as direct children in
  render order: `.sheet-grid`, `.sheet-pair`, Abilities & Skills, Load, Advancement, the footer row
  (reordered in `0.23.0` — see below). `.sheet-grid` itself keeps only the grid-column behavior (the
  same `minmax(280px,1fr)
  minmax(0,1.5fr)` at 768px / `minmax(320px,1fr) minmax(0,1.7fr)` at 1024px ratio as before — see the
  `.sheet-grid` comment for why that ratio wasn't rebalanced to an even split just because there are
  only two panels in it now: Statuses' rows still need more width than Virtues', so the width each of
  them gets is unchanged from before this pass, and `StatusesPanel.module.css`'s 1024px breakpoint
  math didn't need re-deriving as a result — confirmed by re-running the responsive smoke test, not
  just by the arithmetic. **Prose text in the newly full-width panels needed a separate fix**: Theme/
  Abilities & Skills/Load render authored rules text and descriptions that would otherwise stretch to
  150+ characters per line at desktop widths now that their panel isn't capped at half the sheet's
  width. A new `.prose` utility (`layout.css`, `max-width: 68ch`) is applied at each affected `<p>`/
  text-block call site individually (not blanket-applied, and not applied to `AdvancementPanel`,
  whose own prose sits inside already-bounded row/badge layouts rather than running the panel's full
  width) rather than capping the panels themselves, so structured content (chip rows, pip trackers)
  still gets to use the full band width.
- **`.sheet-grid` (Virtues \| Statuses) moved to the top of `.sheet-stack`, and Theme/Looks now
  pair up in their own row instead of stacking as two separate full-width bands (`0.23.0`)** —
  direct repo-owner testing feedback: Virtues and Statuses are what a player checks most during
  play and were previously buried below Theme/Looks/Abilities & Skills/Load. `CharacterSheetPage.tsx`
  reorders its `PANEL_IDS`/render order accordingly; a new `.sheet-pair` class (`layout.css`) gives
  Theme and Looks an even 1fr/1fr split, reusing the same `.sheet-col` styling `.sheet-grid`'s
  columns already use rather than inventing a second column treatment. `.sheet-grid`'s own
  Virtues:Statuses ratio was deliberately left unchanged by this move (still `1fr`/`1.5fr`/`1.7fr` at
  the breakpoints described above) — reordering which row comes first doesn't change how wide either
  column needs to be, and `StatusesPanel.module.css`'s breakpoint math was reconfirmed against the
  responsive smoke test rather than assumed to still hold.
- **`.sheet-stack`'s render order changed again in `0.24.0`, and every panel is now a container-
  query container for its own measured width, not just a `.sheet-col` grid item.** Current order:
  `.sheet-grid` (Virtues | Statuses, unchanged since `0.23.0`) → `BackgroundPanel` (full width) →
  `.sheet-pair` (now Abilities & Skills | Load, not `0.23.0`'s Theme | Looks) → Advancement →
  footer row. **Theme and Looks merged into one "Background" section** (`BackgroundPanel.tsx`,
  new), Looks first per the repo owner's markup — `ThemePanel.tsx`/`LooksPanel.tsx` are demoted to
  plain sections inside it (a `.sectionLabel`-style heading, no `Panel`/`PanelHeader`), same
  "integrated sub-section" shape `ArmorSection` established inside `StatusesPanel` in `0.22.0`.
  Freeing `.sheet-pair` is what let it take Abilities & Skills | Load instead — see `layout.css`'s
  `.sheet-pair` comment for why that pairing kept the existing even `1fr`/`1fr` split rather than
  inventing an asymmetric one. `PANEL_IDS`'s old separate `theme`/`looks` collapse keys collapsed
  into one `background` key; a client with either old key already persisted in its zustand store
  just carries it as a harmless unused entry, no migration needed.
  **Every `Panel` (`Panel.module.css`'s `.panel` class) is now a named container-query container**
  (`container-type: inline-size; container-name: sheet-panel`) — the real fix for the footgun
  CLAUDE.md had already documented ("a panel inside `.sheet-col` cannot assume viewport width is
  its own width once 768px is crossed"), chosen over containing at `.sheet-col` so a full-width
  band (Advancement) and a half-width paired panel (Abilities & Skills, Load) share one mechanism.
  Three panels now query their own width via `@container sheet-panel (min-width: …)` rather than a
  hand-derived viewport breakpoint: `AbilitiesSkillsPanel` goes two columns at 560px (one combined
  `.list` grid, abilities then skills, not two separate `.map()`s restarting the flow); `LoadPanel`
  splits into a 1fr tiers column / 2fr items column at 700px (deliberately conservative — see
  `LoadPanel.module.css`'s `.body` comment for the arithmetic showing this rarely activates while
  paired with Abilities & Skills at ordinary desktop widths, only reliably at the sheet's own
  `>=1800px` wide step); `AdvancementPanel`'s two `.subBox`es (Potential, Rapport) pair at 850px
  (worked out from a 5-pip `Pips` row's own coarse-pointer width, per `AdvancementPanel.module.css`'s
  `.tracksRow` comment). `StatusesPanel.module.css`'s own existing 1024px media-query math was
  **deliberately not converted** in this pass — flagged as a follow-up, not bundled into a feature
  PR, per the lesson in the `.tap`-overlay bullet below — **and was converted in `0.39.0`**, once
  Statuses' own polarity-columns feature made a viewport-keyed threshold actually wrong rather than
  merely inconsistent (see this file's Statuses-columns note above for why three columns sharing
  one viewport broke the old assumption). See `README.md#architecture-notes--
  judgment-calls` item 24 for the full container-query adoption writeup.
  **Two more containers joined in `0.39.0`**: `BackgroundPanel` reuses `Panel`'s own `sheet-panel`
  container for its new Motifs `2fr` / Looks `1fr` split at 760px (an explicit repo-owner layout
  call, `WorkPlan-0.39.0.md` item 4), and each `MotifPanel` card gets its *own* `motif-card`
  container (not `sheet-panel`, which after that same split measures the whole panel — a different,
  wider number than one card actually has to lay out into) for its name/Potential head (380px) and
  Skill/Flaw Tag pairing (520px). `PeekCard.tsx` (Campaign Shell, not the sheet — a different
  `Panel` component entirely) also gained its own `peek-card` container for its identity+virtues /
  statuses+stats split, independent of `.peekGrid`'s existing 768px viewport switch one level up.
  **`VirtuesPanel`'s score box moved from leading to trailing the row, and the Condition checkbox
  is gone.** This reverses `0.22.0`'s Figma "Option A" pick on a newer, more specific markup from
  the repo owner: `.naming` (name + tagline, in that order — tagline moved back under the name,
  where it lived before `0.22.0`) leads the row; `.trailing` (the score box above the Condition
  button) trails it. The Condition button itself now carries the "press me" affordance instead of
  a separate checkmark glyph — unmarked uses the `--gold-tint`/`--gold-line` "interactive chip"
  pair already used for `ThemePanel`/`LooksPanel`'s own chips, rather than the old near-invisible
  neutral border. `VirtuesPanel.module.css`'s comment blocks were rewritten, not just deleted, to
  describe the new arrangement and note the reversal — see the file itself for the full tap-overlay
  arithmetic redone for the new layout (the old `.conditionRow`'s 24px margin-top doesn't carry
  over: `.naming`'s tooltip trigger and the Condition button are no longer vertically adjacent in
  this layout, but the Condition button and its own tooltip trigger, now side by side in
  `.trailing`, are a new pair that needed its own clearance worked out).
  **Explicit glossary tags** (`packages/shared/src/glossary.ts`, `0.24.0`) — CommonMark reference-
  link syntax (`[Term]`, `[display][id-or-name]`, `\[`/`\]` to escape a literal bracket) lets an
  author opt a specific occurrence out of auto-linking, or link a display word that isn't a term's
  own `Name`/`Alias`, without a new global `Alias`. A field with at least one explicit tag disables
  the regex auto-linker for that whole field — see `linkifyText()`'s doc comment. New
  `GameSettings.GlossaryAutoLink` (default `true`) is a separate, library-wide kill switch for the
  regex pass; explicit tags resolve independently of it either way. Content Admin's Validation
  panel now also surfaces an unresolved tag (`findUnresolvedGlossaryTags()`, wired into
  `validateLibrary()` in `apps/server/src/adminLogic.ts`) across every `text`/`textarea` field, the
  same way it already surfaces a dangling ref. See `README.md#architecture-notes--judgment-calls`
  item 23 for the full syntax-choice writeup.
  **Game history moved into a shared modal** (`apps/web/src/components/HistoryModal.tsx`) at all
  three places `AdvancementPanel.tsx` used to render it inline at all times (Potential, party
  Rapport, per-Bond) — a "History (N)" trigger opens it instead. Built on `modal.module.css` and
  `useModalA11y.ts` like every other dialog (see the modal-count note below); per-Bond history also
  dropped its `.slice(0, 8)` truncation, which only existed to fit inline on the sheet.
- **Armor lives inside StatusesPanel now, not its own Panel (`0.22.0`)** — `ArmorPanel.tsx` is gone;
  `ArmorSection.tsx` renders the same controls (per-Armor Used toggle, Refresh all with the same
  `ConfirmModal`) as a plain `<div>` section inline inside `StatusesPanel.tsx`, ahead of the Positive/
  Neutral/Negative groups, with its own small `.groupLabel`-style heading instead of a `PanelHeader`.
  Prompted by a direct repo-owner request: marking Armor Used is an alternative to taking a Status, so
  the controls should feel integrated rather than living in a separate collapsible section below.
  `StatusesPanel.tsx` also dropped its inert "Link to…/Affected by…" row (a `LinkedToIds`/
  `AffectedByIds` future-feature stub that was never wired to anything — the underlying
  `CharacterStatus` fields are untouched, only the dead UI row is gone) and tightened `.row`'s padding,
  both in the same space-optimization pass.
- **A `.tap` element's overlay only overhangs the axis where the element itself is under 44px** — worth
  internalizing exactly, not just approximately, because a near-miss here doesn't fail loudly, it fails
  as a CI-only overlapping-hit-area error. `.tap::after`'s `width`/`height` are each `max(100%,
  var(--tap-min))` independently: a button already ≥44px wide gets zero *horizontal* overhang even if
  it's short, and vice versa. `VirtuesPanel.module.css`'s `0.22.0` VirtuesPanel rework shipped a real
  instance of getting this wrong: merging `.tagline` into `.conditionRow` (so Condition could move to
  the row's trailing edge, per the same Figma pick above) removed a tagline-only spacer line that used
  to separate a Virtue's own InfoTooltip trigger from the Condition row below it, and the `margin-top`
  separating them was left at the old layout's 7px instead of being re-derived for the new one — its
  own comment even claimed a responsive-smoke-test check that had never actually been run. CI caught
  real overlaps at 360px and 768px (the two narrowest widths this panel renders at, not necessarily
  the two narrowest viewports overall — see the `.sheet-grid` note above for why 768px, right at the
  single-to-two-column transition, is tighter than 360px here). Fixed by bumping the margin to 24px
  with the overlay arithmetic worked through in the CSS comment, rather than by trial-and-error. If you
  change spacing between two `.tap`-classed elements that both fall under 44px in the same dimension,
  redo this math rather than assuming a value that worked in a different layout still applies.
- Auth (sign up/in/out) calls `@supabase/supabase-js` directly from the browser
  (`apps/web/src/lib/supabaseClient.ts`) — it does not proxy through the Express server. The
  Express API client (`apps/web/src/lib/api.ts`) attaches the Supabase session's access token as
  a Bearer header to every `/api/...` call.
- Small shared components — reuse rather than re-inventing:
  `apps/web/src/components/ConfirmModal.tsx` (`0.5.0`, yes/no confirmation dialog, built on
  `modal.module.css`) for any button that bulk-resets/refreshes sheet state or destroys a single
  record — Make Camp/Refresh-all/import-overwrite since `0.5.0`, extended in `0.19.0` to revoking
  an invite, removing a Combat participant, deleting a Status, and dropping a Quest, all of which
  used to fire immediately with no way back;
  `apps/web/src/components/InfoTooltip.tsx` (`0.5.0`, tap-to-reveal "i" trigger, not a native
  `title` — those never show on touch) for description/flavor text that's authored in the library
  but not otherwise rendered on the sheet (a Virtue's `Essence`/`UsageHelperText`, an Armor Type's
  `Description`, ...); and `apps/web/src/components/GlossaryText.tsx` (`0.9.0`) for any authored
  or player-authored prose rendered anywhere in the app — not just the Character Sheet (a
  Move/Skill/Ability's description/effect/rules text, an Item/Theme/Quest's description, a Bond
  proposal/history `Note`, ...) but the Campaign Shell too (`CampaignBonds.tsx`'s Bond move text
  and notes; `0.10.1` closed a gap where this duplicate render path had been missed) — it
  auto-links every glossary term the text contains into its own tap-to-reveal definition, so
  don't hand-roll term-specific tooltips, and don't add a new free-text render site without it.
  Pass it
  the matcher from `apps/web/src/lib/useGlossaryMatcher.ts` (memoized off `library.glossary`, one
  matcher shared across the tree). `InfoTooltip` and `GlossaryText`'s bubbles share their
  open/dismiss-on-outside-click-or-Escape behavior via `apps/web/src/lib/useTapReveal.ts` rather
  than each reimplementing it — extend that hook, don't fork it, if a third tap-to-reveal surface
  shows up. See `README.md#architecture-notes--judgment-calls` item 9 for why a linked term is a
  `<span role="button">` rather than a real `<button>` (44×44 touch targets on words packed
  together mid-sentence would overlap) before changing how `GlossaryTermLink` renders.
  `apps/web/src/components/HistoryModal.tsx` (`0.24.0`) is the newest addition to this list — a
  shared "game history" display (title + a scrollable list of timestamped entries, each optionally
  carrying `GlossaryText`-rendered detail) for any place this app shows a retrospective record
  rather than live reference; reuse it rather than rendering history inline the way
  `AdvancementPanel.tsx` used to before this version. Combat's `Encounter.History` log stayed a
  collapsible in-page section rather than moving to this modal — it's live reference read *during*
  a fight, not a retrospective record, and a modal would cover the board mid-turn; flagged as an
  open question in `WorkPlan-0.24.0.md` rather than silently decided either way, in case that
  judgment call gets revisited.
- **Every modal shares focus-trap/initial-focus/Escape-to-close/focus-restore behavior via
  `apps/web/src/lib/useModalA11y.ts` (`0.19.0`)** — attach its returned ref to the `modal.dialog`
  element alongside `role="dialog"` `aria-modal="true"` `aria-labelledby={titleId}` `tabIndex={-1}`
  (those stay in each consumer's own JSX since they don't vary at runtime the way the hook's
  behavior does). It's a **callback ref, not `useRef` + a mount effect** — most modals unmount
  when closed, but `AdvancementPicker` is rendered unconditionally by its caller and internally
  `return null`s when there's no active picker, so it never unmounts; only the dialog's own
  subtree appears/disappears, and only a callback ref fires correctly on both patterns. It also
  tracks a small open-dialog stack so Escape only closes the topmost dialog — `EndSessionModal`
  nests `MarkKinModal` (Mark Kin, spent from Hold), the one place two of this app's modals are open
  at once, and a bare per-dialog Escape listener would otherwise close both in one keypress.
  Applied to all 13 modals in the app (`HistoryModal.tsx`, `0.24.0`, is the newest). Extend this
  hook, don't fork it, for any new modal.
- **Form fields: a shared `Field`/`TextInput`/`Select`/`NumberInput`/`CheckboxRow` set
  (`apps/web/src/components/form/`, `0.23.0`), and react-hook-form + zod scoped to where they
  replace real duplicated logic, not adopted everywhere.** `Field` is a label+control pair (a
  `Fragment`, not a wrapping `<div>` — matches the plain sibling `<label>`/`<input>` markup it
  replaces exactly, so it carries zero layout risk); `TextInput`/`Select`/`NumberInput` are thin
  styled wrappers taking `ref` as a plain React 19 prop so `register()`'s returned `ref` spreads
  straight through for an uncontrolled RHF field. `characterCreationSchema(library)`
  (`packages/shared/src/characterCreationSchema.ts`) is a zod schema factory — `zod` is
  `@asohav/shared`'s first-ever runtime dependency — bound to a `Library` snapshot since character
  creation is the one form in this app that validates against real content, not just field shapes;
  `apps/server/src/routes/characters.ts` (`safeParse`) and `CreateCharacterPage.tsx`
  (`zodResolver` via `useForm`) both call it, replacing what used to be two independently
  hand-maintained copies of the same rules. `AddParticipantModal.tsx`/`CombatMoveModal.tsx` only
  `register()` their simple, independent fields — no zod schema, since there was no duplicated
  validation to unify there, just repeated markup the new primitives replace. Both modals'
  genuinely dynamic per-row arrays (Status Limits, Gambits) deliberately stayed local `useState`
  rather than `useFieldArray`, to avoid rebuilding already-working Combat state management with no
  live-QA path in this sandbox to catch a regression. See `README.md#architecture-notes--
  judgment-calls` item 22 for the full scoping rationale, including which of the five modals
  sharing this CSS actually migrated (two) versus were deliberately left alone (three, plus
  `CreateCharacterPage`'s own differently-styled fields) and the bundle-size cost of not
  lazy-loading `CreateCharacterPage` the way `/admin`/`/combat` are (below).
- **`/admin` and `/combat` are behind `React.lazy`/`Suspense` (`0.19.0`)** in `App.tsx` — Content
  Admin is designer/admin-only (~960 lines of schema-driven CRUD) and Combat is only relevant
  mid-session, so neither belongs in the bundle every player downloads just to open their
  character sheet. One `<Suspense fallback={...}>` wraps the whole `<Routes>` block rather than
  each lazy route individually, since only one route ever renders at a time anyway; the fallback
  reuses the in-shell "Loading…" convention (`padding: 20px`, `App.module.css`'s `.routeLoading`)
  rather than the full-viewport pre-auth `.loading` class, since it renders inside `AppShell`. If
  another route grows large and is similarly rare in a typical session, split it the same way.

## Deployment

Single Render Web Service (`render.yaml`, a Render Blueprint) — `apps/server/src/index.ts` serves
the built `apps/web/dist` client itself in production and falls back to `index.html` for
client-side routes, so there's no separate static site and no CORS to configure (client only
calls relative `/api/...`). Two non-obvious build gotchas already hit (full context in
`render.yaml` and `CHANGELOG.md` 0.3.0):

- `NODE_ENV=production` also makes `npm ci` skip devDependencies by default, which broke the
  server's `tsc` build (`@types/node` missing) — fixed with `NPM_CONFIG_PRODUCTION=false`.
- First boot seeds eight dev accounts into Supabase Auth + Postgres if the database is empty
  (`apps/server/src/seed.ts`) — expected on a fresh project, not a bug if seen in deploy logs.

**A merged PR with green CI is not a shipped change — verify the deploy reached `live`.** Render
auto-deploys every commit to `main`, which starts a deploy but doesn't make it succeed, and **a
failed deploy leaves the previous build serving**. So the site answers `200`, the PR is merged, CI
is green, and the new code isn't running anywhere — nothing reports a problem. This is not
hypothetical: the `0.28.0` slice-1 merge built fine, crashed on boot (a transient Supabase 521
thrown out of the unguarded `await runSeedIfEmpty()` at `apps/server/src/index.ts:23` — see
`HANDOFF.md` open issue 18 for that bug), and served a two-week-old build for about four hours
before anyone looked. Check `list_deploys` on service `srv-d9nqoqlaeets73ch25q0` and confirm the
top entry matches the merge commit with `status: live`; `/api/health` alone can't tell you, since
the old build answers it just as happily. This is step 5 of the `release-reliability-checklist`
skill.

**A release that changes `packages/shared/src/seedLibrary.ts` also needs the live `library` row
reset** (Content Admin → Data → "Reset to seed"). `runSeedIfEmpty()` skips a library that already
exists, so seed content changes never reach production on their own — and per the `0.17.0` audit a
stale library degrades *silently* into wrong gameplay math rather than erroring. `HANDOFF.md` open
issue 19.

**A merged PR that adds a `supabase/migrations/*.sql` file has not shipped that migration —
applying it to the live Supabase project is a separate, manual action Render never performs.**
`render.yaml`'s `buildCommand`/`startCommand` build and start the Node server; neither runs
`supabase db push` or anything equivalent, and never has. This is not a one-off gap: it has now
caused three real incidents — `0010_combat_encounters.sql` (`0.14.0`), caught and fixed by a
dedicated live-ops session; `0011_clocks.sql` (`0.33.0`), which shipped unapplied and stayed that
way for **8+ hours in production**, with Render's own logs showing the concrete cost (repeating
`"Could not find the table 'public.clocks' in the schema cache"` errors on every read of a
campaign's Clocks); and `0012_adventures.sql` (`0.36.0`), which shipped unapplied in the very same
merge that fixed the `0011` gap, because that session's own release verification never included
this check either. All three are the same failure shape: CI is green (it never touches the live
database), the deploy reaches `live`, and the feature still breaks — silently for a JSONB-blob
staleness case like the library, loudly (but unnoticed until someone reads the logs) for a missing
table. After merging any PR that adds a migration file, apply it via the Supabase MCP
`apply_migration` tool and confirm with `list_migrations` that it now appears — do this as
routinely as checking the deploy reached `live`, not as an optional aside. `HANDOFF.md` open issue
20; this is now a mandatory step 5 item in the `release-reliability-checklist` skill, not just a
step 3 mention, since a conditional pre-merge aside was apparently easy enough to miss twice.

## Sandbox network constraints (relevant if you're in a similarly locked-down environment)

Some development sandboxes used on this project have outbound HTTPS restricted to an allowlist
and no raw TCP at all. **Don't assume a specific host is blocked — the allowlist varies by
environment and has changed at least once. Probe it.** A one-liner (`curl -sS -m 12 -o /dev/null
-w '%{http_code}' https://host/`) settles in seconds what an out-of-date note here would only
guess at; a `403`/`000` is the sandbox's own egress proxy denying `CONNECT`, and
`curl -sS "$HTTPS_PROXY/__agentproxy/status"` names the host and reason under
`recentRelayFailures`.

Measured in the forty-second session (2026-09-02), which is the current picture but explicitly a
snapshot, not a guarantee — **and, as of this session, `curl` reachability and headless-Chromium
reachability through this proxy are two different questions that can disagree**, so probe both
rather than assuming one implies the other:

| Host | Reachable via `curl` | Reachable via headless Chromium (Playwright) | What it gates |
|---|---|---|---|
| `asohav.onrender.com` | **yes** (`/api/health` → `200`) | **no** (`ERR_CONNECTION_RESET`, forty-second session) | Live app QA, the REST API |
| `fonts.googleapis.com` / `fonts.gstatic.com` | **yes** | untested via Chromium | Real typography in `npm run screenshot` |
| `api.github.com` | yes | untested via Chromium | GitHub MCP |
| `ihrtdbknhpgysgwaqnfj.supabase.co` | **yes** as of the forty-second session (was `403` through the thirty-ninth) | **no** (`ERR_CONNECTION_RESET`, forty-second session) | Browser sign-in, any API call needing a bearer token |
| `cdn.playwright.dev` | no | n/a | `playwright install` (use `CHROMIUM_PATH` instead) |

The `asohav.onrender.com`/Google Fonts rows first flipped reachable in the fortieth session
(reversing what this section claimed through the thirty-ninth), and `ihrtdbknhpgysgwaqnfj.supabase.co`
joined them via `curl` in the forty-second — each time confirmed with a real response (a genuine
Supabase `401`/`200` JSON body and Cloudflare headers, not a proxy stub), not just an absence of
`403`. **But the forty-second session also found the opposite kind of surprise**: a
Playwright-driven headless Chromium navigation fails identically
(`net::ERR_CONNECTION_RESET`, logged by the proxy as `ws_closed_mid_exchange`) on *every* external
host tried — `asohav.onrender.com` included, not just the once-blocked Supabase host — while `curl`
against the exact same URLs succeeds every time. Reproduced against a warm, already-responding
origin (ruling out a Render free-tier cold start) and against a trivial JSON endpoint on each host
(ruling out anything specific to the full SPA's asset loading). This looks like a proxy/tooling
limitation specific to how headless Chromium negotiates a connection through this relay, not a
destination-host policy gap — so **live browser QA of the deployed app is not currently possible
from this sandbox at all**, a strictly worse position than the fortieth session's "reach it but
can't sign in," even though the Supabase-specific block that session flagged is itself resolved.
Don't assume either direction carries forward — re-probe with both `curl` and an actual
`page.goto()` next time, since the shape of the blocker has already changed twice.

Raw TCP remains blocked everywhere regardless of the allowlist, so direct `pg`/Postgres
connections to Supabase fail outright (not proxied HTTP) — that's why `withBondLock`'s row locking
still has never been runtime-verified (`HANDOFF.md` open issue 2). The Supabase MCP tool works
regardless of any of this, since it runs outside the sandbox's network entirely.

If you do hit a block, say explicitly that the check wasn't possible from the current environment
rather than reporting a false negative — and don't route around it: an egress denial is the
organization's policy, not a broken setup. Widening it is a change to the environment's network
policy, made by the repo owner where the environment was created, not something to work around
from inside.

## Working conventions

- **Author docs, not just code.** This project keeps `README.md` (architecture + judgment calls),
  `CHANGELOG.md` (versioned history), and `HANDOFF.md` (session-to-session status/open issues)
  actively maintained. When you make a nontrivial change or a judgment call on ambiguous handoff
  content, add a line to the relevant doc rather than leaving it implicit in a commit message.
- **`.claude/skills/` has four project-authored skills that automate conventions documented
  above**, each pointing back to the relevant section here as its source of truth: `theme-tokens`
  (design-token reuse — "Frontend conventions"), `responsive-device-qa` (the responsive smoke test
  plus a manual breakpoint-math review — "Commands" and the Pips/quick-add-row notes under
  "Frontend conventions"), `perf-budget` (latency-risk patterns in route handlers, `repo.ts`,
  TanStack Query, and `useLiveCampaign`), and `release-reliability-checklist` (the
  typecheck/build/test/responsive gate plus the version-sync/CHANGELOG/tag policy, the exact
  check-run names branch protection matches on — see "Commands" — and, as of the fortieth session,
  a **post-merge** step 5
  confirming the deploy actually reached `live`; see "Deployment" below for why that isn't
  redundant with the pre-merge gate). If you change one of those sections in a way that
  invalidates what its skill says, update the skill too — they're meant to stay in sync, not fork.
  The repo also has generic (not project-authored) skills installed for Supabase and Vercel's
  React/Next.js, component-composition, and Web Interface Guidelines best practices — those carry
  their own external conventions and don't reference this file.
- **What's deliberately not built** — dice rolling (a permanent product decision, not a gap),
  Bond-proposal expiry, generalized cross-character Status targeting, Hero Moves (cut, not deferred
  — Playbooks were the concept Hero Moves were meant to hang off, and the repo owner has confirmed
  Playbooks aren't part of the game's systems at all, superseding `Ruleset-V0.5.md`'s own "Coming
  Soon" text), and a rendered Combat grid — see `README.md#whats-not-built` for the current,
  maintained list. Don't treat these as bugs or TODOs unless asked to actually build them. **Skill
  modifiers are no longer on this list** — V0.6 slice 2 (`0.43.0`) made Skill/Flaw Tags mechanical;
  see "Architecture: Rolls (V0.6 slice 2)" above.
- **Virtue scores and Theme are read-only on the sheet, as of `0.5.0`.** As of `0.7.0` there is
  one in-app character-creation flow (`apps/web/src/pages/CreateCharacterPage.tsx`, reached from
  a Player membership with no `CharacterId` yet, gated to the campaign's Party Creation phase as of
  `0.12.0` — see `README.md#architecture-notes--judgment-calls` item 2), where a Virtue's starting
  value and a character's initial Theme are chosen once. Once a sheet exists, a Virtue only changes
  by taking the "Raise a Virtue by 1" Potential Advancement (`ad-p-virtue1`), and Theme only
  changes by taking "Change your Theme" (`ad-p-theme`) — both wired up in
  `apps/web/src/features/sheet/AdvancementPicker.tsx`, which is also the only place that should
  ever mutate `sheet.Virtues[].Score` or `sheet.Theme` outside a raw import. Don't add a stepper/
  `<select>` back onto `VirtuesPanel`/`ThemePanel` without checking this was actually asked for —
  it was a direct one-line request from the repo owner, not an oversight.
- **Character creation is no longer "deliberately narrow," as of `0.12.0`.** The `0.7.0`-era scope
  note (name + standard-array Virtues + Theme only, everything else starts empty) is superseded:
  `CreateCharacterPage.tsx` now also collects Looks (a repeatable list, joined with `\n` into the
  existing `CharacterSheet.Looks: string` field — the wire shape didn't change, only the
  creation-time input did), optional Quests from the chosen Theme, and starting Skills/Abilities
  (checkboxes capped at `GameSettings.SkillsAtCreation`/`AbilitiesAtCreation`, Abilities filtered
  to `Acquisition: 'Starting'`). Rapport and Kin are still a static placeholder card — see
  `README.md#architecture-notes--judgment-calls` item 12 — not real fields on the creation payload.
  If you extend chargen further, validate new fields server-side in
  `apps/server/src/routes/characters.ts` the same way the existing fields are (against the
  library, not just client-side) — this route has no other authorization layer to catch a missing
  check.
