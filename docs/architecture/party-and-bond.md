# Party and Bond

The Bond handshake and the one place in this app with real concurrency risk (row locking), plus Rapport, Aid, and the Hero Improvement Trees.

_Part of `docs/architecture/`. Index: [`docs/architecture/README.md`](README.md). The invariants a session must not violate stay in `CLAUDE.md`; this file is the detail behind them._

---

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
`../decisions.md` item 1 before changing this. **Spend Kin is the one
exception**, as of `0.5.0`: it applies immediately with no handshake (`applySpendKin()` in
`packages/shared/src/logic.ts`, called directly from `POST /:bondId/propose` in
`apps/server/src/routes/bond.ts` rather than being staged as a `PendingChange`), since the game's
own rules text draws a real distinction here ("either PC can spend Kin" vs. Forging needing mutual
agreement) that the original all-three-types-identical handshake didn't carry forward — see
`../decisions.md` item 7. `withBondLock`'s row lock still serializes
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
of call already locked for the Bond/Kin/Kith doc-typo (`../decisions.md` item — see the new slice-4 entry there for the full writeup).

**`CharacterSheet.Level` was removed in `0.50.0`; `Party.PartyLevel` stays and is genuinely
read.** This paragraph claimed both were plain counters that "gate nothing" and that "nothing in
the app reads either" — half wrong, in both directions. `Level` really was write-only (incremented
twice in `MotifPanel.tsx`, read nowhere, displayed nowhere), which is why `WorkPlan-V0.6.md`'s
"Legacy code left stranded" recommended retiring it and `0.50.0` did. `PartyLevel` is the opposite:
`campActionsAllowed(party.PartyLevel)` in `CampActionsModal.tsx` gates how many Camp Actions each
player gets per Camp, so it has had a real mechanical role since slice 7 (`0.34.0`) — don't retire
it by analogy with `Level`, and don't add a *Tier* check against it without a repo-owner decision,
which is the part of the original warning that still stands.

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
(`../decisions.md` item 8). Content Admin's nav still carries a
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

## Architecture: Party and Bond (V0.6 slice 7, `0.48.0`)

**Closes out `WorkPlan-V0.6.md` Section A4 item 1 and Section C's Bond-spend-menu bullet.** Three
independent pieces, none touching the same code: Rapport can now exceed its cap and banks the
overflow until Camp; a Party Skill/Weakness Tag can be declared as relevant to a roll, logged but
mechanically inert; and both places this app has a Bond UI gained V0.6's real five-option spend
menu in place of one hardcoded button.

**Rapport overflow, per A4 item 1's own worked example: "a party at 10/5 that spends 1 before camp
drops to 4/5, not 9/5."** `Party.Rapport` was previously clamped `0..GameSettings.RapportTrackLength`
everywhere it was written; that clamp is now gone from every write site, and the field's own doc
comment in `types.ts` says so explicitly rather than leaving a plain `number` to imply nothing
changed. `applyPartyRapportAdvance()` (`logic.ts`) — which used to zero `Rapport` on every advance —
now subtracts `cap` (a new required parameter, `GameSettings.RapportTrackLength`, threaded from
every call site) instead: a Rapport of 8 against a cap of 5 advances to 3, not 0, so a banked
overflow can fund a second advance in the same sitting if what's left after the first is still at or
above the cap. A new `spendRapportForAid(party, cost, cap)` is the one function that actually
implements the forfeit rule: it computes `capped = min(party.Rapport, cap)` first, *then* subtracts
the cost from that — so spending before Camp resolves from the capped value and throws away
anything banked above it, exactly the worked example's 10/5 → 4/5 (not 9/5). Both Rapport-spend call
sites route through it now: `AdvancementPanel.tsx`'s own Aid button (previously an inline `Math.max(0,
d.Rapport - cost)`), and `EncounterView.tsx`'s Combat Help reaction (previously an inline `Math.max(0,
d.Rapport - 1)`) — the same "two independent copies of the same mutation, fix both together" pattern
CLAUDE.md's Kin→Bond rename note already flags for this exact class of bug. The two remaining
clamp-at-write sites — `EndSessionModal.tsx`'s party-Rapport-mark (`Math.min(cap, d.Rapport + n)`)
and Combat's own start-of-fight Rapport delta in `apps/server/src/routes/combat.ts`
(`Math.max(0, Math.min(5, party.Rapport + rapportDelta))`) — had only their ceiling removed, keeping
the floor at 0 in both places (Rapport can bank above the cap, but it was never meant to go negative).

**The "10/5" legibility problem, A4 item 1's own explicit UI concern.** `Pips` (`apps/web/src/
features/sheet/Pips.tsx`) renders exactly `count` dots, marking dot `i` "on" if `i <= filled` — with
`filled` now potentially exceeding `count`, every dot in a 5-dot row reads identically "on" whether
Rapport is 5 or 15, with nothing distinguishing an exactly-full track from a heavily-overflowing one.
`AdvancementPanel.tsx`'s Rapport `Pips` now clamps its `filled` prop to `Math.min(party.Rapport,
rapportLen)`, and a new `.rapportOverflow` text line appears beneath it only once `party.Rapport >
rapportLen`, stating the true total and how much is banked beyond the track ("13 Rapport — 8 banked
beyond the track, saved for your next Make Camp"). No other Rapport display in the app needed this
fix: `CampaignTile.tsx` and both render sites in `CampaignPage.tsx` already show plain "N / M" text,
and `EncounterView.tsx`'s Combat header does too — none of them use `Pips`, so none of them had the
ambiguity `Pips`' identical-dots rendering created.

**Party Skill and Weakness Tags get a declare-and-log roll affordance, deliberately with no numeric
effect — `WorkPlan-V0.6.md` Section D item 8's own economy question stays open.** The doc's own
words, still unanswered: "Do Party Skill Tags only get used once between Camping? Maybe they are
stronger than Hero? +2? Advantage? Do you start with one for each party member? What about
weaknesses?" This app's discipline forbids guessing at a question flagged this explicitly, so
`MoveRollHelper.tsx` gained a "Party Tags relevant to this roll" section — the same declare-and-log
shape the Flaw Tag / Boon-Bane sections beside it already use, a row of tap targets over
`party.SkillTags`/`party.WeaknessTags` — but tapping one only calls a new `declarePartyTag()`
(local to the component) that logs `{ Action: 'declared', Name: 'Party Skill Tag' | 'Party Weakness
Tag', Effect: tag, By: myName }` onto `Party.History` via a new `commitParty` prop; it does not touch
`computeRollBreakdown()`'s `Total`, `Sources`, or `Advantage` in any way. This mirrors the exact
"this app can't see a roll, so it doesn't enforce the limit or add the bonus — that stays with the
table" framing the neighboring Aid tooltip already gives Rapport spending, applied here to a
mechanic this app doesn't even know the *shape* of yet, not just one it can't detect the timing of.
**Threading `party`/`commitParty` down to `MoveRollHelper.tsx` needed three files touched, not
one**: `CharacterSheetPage.tsx` (where `party`/`wrappedCommitParty`/`character.Name` were already in
scope, reused rather than re-derived) now passes them to `MovesDrawer.tsx`, which threads them one
level further to `MoveRollHelper.tsx` at its single call site — `CombatMoveModal.tsx`'s own Engage
roll builds its breakdown independently and was untouched, consistent with slice 2's own note that
Combat's roll surface stays deliberately narrower than the sheet's.

**The Bond spend menu's five explicit options, in the two places this app independently has a Bond
UI.** `Ruleset-V0.6.md`'s "Spending Bond" list is verbatim, offered as a picker (`BOND_SPEND_OPTIONS`,
a new exported `as const` array in `logic.ts`) everywhere the app used to have a single hardcoded
"Spend a Bond" button that always sent the same generic note ("I need this from you.") —
`AdvancementPanel.tsx`'s own Bond section, and `CampaignBonds.tsx`'s entirely independent copy of
the same UI. Both needed the identical treatment: a toggle button that reveals a stacked list of the
five option strings, each one committing the exact same `SpendBond` propose call the old single
button did (`applySpendBond()` still applies it immediately, no handshake — unchanged), just with
that option's text as the note instead of the generic placeholder — the same "lives in two places,
both need the same fix" precedent CLAUDE.md's Kin→Bond rename note already established for this
exact pair of files, applied proactively here rather than fixing one and letting the other drift.
This needed **zero new server-side plumbing**: `POST /:bondId/propose`'s existing `SpendBond` branch
already accepted and stored a freeform `req.body?.note` before this slice touched anything — the
work was entirely the picker UI and the shared options constant.

**Scoping call: the doc's fifth spend option uses stale pre-Strain wording, mapped rather than
copied verbatim.** "Mark a Condition on them, or give them a Rank 2 Status" — the Bond chapter, like
Combat's own Combat Basics chapter (see "Architecture: Combat" in `docs/architecture/combat.md`), was never rewritten for
V0.6's Strain/severity-slot harm model, so "Rank 2" names a mechanic that no longer exists.
`BOND_SPEND_OPTIONS`' own doc comment maps it to "a Minor Status" — the closest severity-slot
equivalent — the same kind of documented B1-style reading this app already gives every other stale
"Rank N" reference it finds in un-rewritten chapters, rather than either copying the broken wording
verbatim or silently picking a number with no note explaining why.

**Forge a Bond stays exactly where the doc leaves it: "TO BE DETERMINED."** This slice touched
neither `ForgeBondModal.tsx` nor `applySpendBond()`'s `ForgeBond` branch — Forging is still a
freeform "write it together" move on `Bond.BondMoves`, per the existing judgment call
(`../decisions.md` item 8), unaffected by anything V0.6 names for
spending.

**Testing**: `logic.test.ts` gained a `spendRapportForAid` `describe` block (the 10/5 worked example,
an ordinary below-cap subtraction, and the floor-at-0 case), a length-pin test for
`BOND_SPEND_OPTIONS`, and an `applyPartyRapportAdvance` case confirming overflow banks rather than
resets to 0; every existing `applyPartyRapportAdvance` call in that file picked up the new required
`cap` argument. `apps/server/src/routes/combat.test.ts`'s "caps the Rapport bump at 5" test is
rewritten to assert the opposite (`Rapport: 6`, not clamped), confirming the ceiling is actually
gone server-side and not just in the shared logic layer.

**Bundle budget**: measured at 214.48 kB gzip against the 220 kB cap, up from slice 6's 213.02 kB.
The increase is real, not incidental — the Bond spend menu and Rapport overflow readout are
always-visible `AdvancementPanel` content, and `MovesDrawer.tsx` (which now imports the Party Tags
section along with everything else in `MoveRollHelper.tsx`) has never been behind `React.lazy`, so
that section counts toward first load too. About 5.5 kB of headroom remains.

**Deliberately not built this slice, real scope for later, not oversights**:
- What a Party Skill/Weakness Tag actually does mechanically — Section D item 8 is still open;
  this slice built the storage and declaration UI a future answer needs, not a guess at one.
- Forge a Bond's own mechanical effect — still "TO BE DETERMINED" in the ruleset itself.
- Slice 8 ("Creating the World," `0.49.0`) — the last remaining slice of the eight-slice plan.
