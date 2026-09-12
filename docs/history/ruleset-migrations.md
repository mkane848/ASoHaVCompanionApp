# Ruleset migrations — V0.5 and V0.6

Which ruleset is canonical and how the app was migrated onto it, plus the superseded per-slice narration. Several notes here are load-bearing warnings about corrections already made once ("this paragraph said the exact opposite until `0.41.0`") and are kept verbatim for that reason.

_History. For current behaviour see [`docs/architecture/`](../architecture/README.md)._

---

## Architecture: the ruleset and where it lives

**`Planning Docs/Ruleset-V0.6.md` is, as of 2026-09-09, the single source of truth for the game's
rules.** It was adopted in a docs-only pass — no version bump, no CHANGELOG entry, no source file
touched, the repo staying at `0.41.0` — with the code migration staged as an eight-slice plan in
`Planning Docs/WorkPlan-V0.6.md` (slices land as `0.42.0`-`0.49.0`). **Slice 1 — harm primitives —
shipped in `0.42.0`**, the same release that adopted the ruleset having been immediately followed
by the first slice against it; **slice 2 — rolls — shipped in `0.43.0`**; **slice 3 — Combat on
Strain — shipped in `0.44.0`**, right behind it; **slice 4 — Moves and Camp content — shipped in
`0.45.0`**, right behind that; **slice 5 — Load and identity — shipped in `0.46.0`**, right behind
that; **slice 6 — Clocks — shipped in `0.47.0`**, right behind that; **slice 7 — Party and Bond —
shipped in `0.48.0`**, right behind that; **slice 8 — Creating the World — shipped in `0.49.0`**,
right behind that. **All eight slices of the migration are now shipped.**
Everything every other section of this file describes (besides Strain/Statuses/Armor/Subdued, now
covered by "Architecture: Strain & Statuses (V0.6 slice 1)" in `docs/architecture/rules-engine.md`; Skill/Flaw Tags, Push Yourself, and
Advantage/Disadvantage, now covered by "Architecture: Rolls (V0.6 slice 2)" in `docs/architecture/rules-engine.md`; Cover, Brace, Surprise,
and Combat-Goal Potential, now covered by "Architecture: Combat on Strain (V0.6 slice 3)" in `docs/architecture/combat.md`; the
22 seeded Moves, Make Camp, Keep Watch, Set Out, Enjoy Downtime, End the Session, and the glossary,
now covered by "Architecture: Moves and Camp content (V0.6 slice 4)" in `docs/architecture/moves-and-camp.md`; Load's wildcard boxes,
Light/Heavy Boons/Banes, and Pronouns, now covered by "Architecture: Load and identity (V0.6 slice
5)" in `docs/architecture/character-sheet.md`; Clocks' Kind rename/split and the Quest Board, now covered by "Architecture: Clocks (V0.6
slice 6)" in `docs/architecture/clocks.md`; Rapport overflow, the Party Tag declare-and-log affordance, and the Bond spend menu,
now covered by "Architecture: Party and Bond (V0.6 slice 7)" in `docs/architecture/party-and-bond.md`; and CATS plus the collaborative map
build, now covered by "Architecture: Creating the World (V0.6 slice 8)" in `docs/architecture/gm-content.md`) is still the *V0.5*
behaviour the app ships for that surface. Read `WorkPlan-V0.6.md` Section
A before changing any rules code — even with the migration itself complete, that section remains
the record of every judgment call this app made along the way.

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
surprise/Combat-Goal-Potential rules, described in "Architecture: Combat on Strain" in `docs/architecture/combat.md` — neither
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
its own stated source — see "Architecture: Combat" in `docs/architecture/combat.md` for what that means for the Range-band
decision specifically. `Ruleset-V0.5.md` was adopted as that missing document's successor and
closed the gap; `Ruleset-V0.6.md` now succeeds V0.5 in turn.

**All of V0.5 is implemented** — slices 1-9, shipped across `0.28.0`-`0.36.0` — **and all eight
slices of V0.6's own migration are implemented on top of it**: slice 1 (harm primitives),
`0.42.0`; slice 2 (rolls), `0.43.0`; slice 3 (Combat on Strain), `0.44.0`; slice 4 (Moves and
Camp content), `0.45.0`; slice 5 (Load and identity), `0.46.0`; slice 6 (Clocks), `0.47.0`;
slice 7 (Party and Bond), `0.48.0`; and slice 8 (Creating the World), `0.49.0`.
Every architecture section below describes what the app actually ships, which for most
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

## Architecture: Clocks (slice 6, `0.33.0`)

**The first genuinely new play-state subsystem since Combat**, and the doc it's built from is
messier than any other slice has worked with so far. `Planning Docs/archive/Ruleset-V0.5.md`'s "Clocks"
chapter is explicitly marked "WIP" in the source text and names six variants — Basic, Threat/Quest,
Long-Term Project, Progress, Linked, Mission, Tug-of-War — but only gives Basic a complete
mechanic; the doc even asks itself "\[Threat/Quest\] are these the same thing?" without answering.
Two repo-owner decisions via `AskUserQuestion`, not assumptions, scoped this before any code — see
`README.md` items 35-36 for the full writeup.

> **V0.6 restructured this chapter, and slice 6 (`0.47.0`) shipped that restructure** — see
> "Architecture: Clocks (V0.6 slice 6)" in `docs/architecture/clocks.md` for what actually changed. `Basic` became
> **Opposition**; `Countdown` split into **Threat** (gaining a Goal, Skill Tags and per-segment
> Developments, sized 2-4 / 4-6 / 7+ by scope) and **Project**; `TugOfWar` is unchanged; and
> **Linked, Mission, Progress and Long-Term-Project Clocks are deleted outright**, which stranded
> `Clock.UnlocksClockId` and `isClockLocked()`. Everything below this blockquote describes the
> superseded V0.5 model, left in place as history rather than rewritten.

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
