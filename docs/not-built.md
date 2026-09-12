# What's not built

Deliberately absent, not a backlog. Do not treat anything here as a bug or a TODO unless asked to
actually build it — several of these are settled product decisions, and one (dice rolling) is
load-bearing for how the whole rules engine is designed.

_Linked from `CLAUDE.md`. Current behaviour lives in [`architecture/`](architecture/README.md)._

---

## What's not built

Per the handoff's own "Known Gaps & Risks": Bond-proposal expiry is deliberately out of scope — the
design doc calls it out as future work, not an omission here. Skill modifiers, the list's other
original entry, is no longer on this list at all — see the correction under "Deliberate, permanent
omissions" below for why. Two more items from that original list are now built, and a third
partially.

The V0.5 adoption (item 29 above) adds a second kind of "not built" to this list — real, planned
work that simply hasn't shipped yet, as distinct from a permanent decision never to build
something. The two are now split into their own groups below rather than interleaved as before.

One entry sits in neither group, because it is mostly *built* and only its remainder is deferred:

- **Combat**, as of `0.14.0`–`0.16.0`, extended by V0.5 slice 5 (`0.32.0`): the core loop, all
  seven Combat/Reaction Moves (Resist joined the other five as of slice 5; Help was already built),
  Gambits including an automated Repel, enemy stat blocks with Toughness and per-Status Limits,
  per-unit turn order, a Cover Status picker, and minimal Boss-Enemy wiring — see items 15–17 and
  31–34 above for exactly what's built. The rendered grid stays deferred and Hero Moves are now cut
  outright — see "A rendered Combat grid" and "Hero Moves" below for each one's status.

### Deliberate, permanent omissions

- **Dice rolling**: the app still never rolls dice itself (see `packages/shared/src/engine.ts`'s
  doc comment) — that's a deliberate product decision, not a gap to close later. It computes and
  shows every roll's modifier breakdown, and once told which tier a physically-rolled roll landed
  in, applies the resulting mechanical effect. Extends to Combat rolls too, as of `0.14.0`.
  **Reaffirmed by the V0.5 adoption, and again by V0.6**: nothing in `Planning Docs/Ruleset-V0.6.md` or
  `WorkPlan-V0.5.md` touches this decision — even V0.5's newly mechanical Advantage/Disadvantage
  triggers (item 20 above) stay within "tell the app what you rolled," not "have the app roll."
- **Skill modifiers: built, as of the V0.6 migration's own slice 2 (`0.43.0`) — no longer belongs
  in this list, corrected here rather than silently removed.** This bullet stood unchanged from the
  original handoff's "Known Gaps & Risks" note through V0.5's entire freeform-Tags redesign (item
  20/`WorkPlan-V0.5.md` slice 2) on the reasoning "a Tag is exactly as un-numeric as the Skill it
  replaces" — true when V0.5 shipped Skill/Flaw Tags as narrative-only text, and still true right up
  until `Ruleset-V0.6.md` gave them a real mechanic: a relevant Skill Tag is **+1**, a relevant Flaw
  Tag is **−1** and marks Potential, and Push Yourself lets a second applicable Skill Tag add
  another +1 for a Condition. `MoveRollHelper.tsx` is a real roll builder now, not a static
  breakdown — see CLAUDE.md's "Architecture: Rolls (V0.6 slice 2)" for the full account. A reader
  who had this bullet memorized needs to know it flipped, the same treatment this file gives every
  other superseded claim rather than quietly deleting the line.
- **Bond-proposal expiry**: still out of scope, per the same handoff note above, and unaffected by
  the Kin → Bond rename (item 20/29 above) — a proposal still sits open indefinitely until it's
  accepted, rejected, or withdrawn.
- **A rendered Combat grid**: previously an open interpretation of an ambiguous handoff (item 15's
  original `0.14.0` note); now, per item 15's update above, a *documented deviation from an
  explicit written rule* instead — V0.5 specifies a real map with squares or hexes, and the repo
  owner re-affirmed keeping Range bands having actually read it. Not a gap to eventually close; a
  standing choice.
- **Statuses/Conditions as a real mechanical system** (give, heal, Resist Rolls, opposite-Status
  cancellation, the Subdued → Scar/Risk Death/Blaze of Glory chain) is built for a character's own
  sheet. **Targeting another character as a real reference**: still not a generalized feature —
  `CharacterStatus.LinkedToIds`/`AffectedByIds` remain the stubbed "not yet" placeholders they
  always were (the inert `StatusesPanel.tsx` "Link to…"/"Affected by…" row that used to surface
  them was removed in `0.22.0`; the fields themselves are untouched) — but Combat's
  `PendingStatusOffer` (item 15 above) is a first, narrowly-scoped instance of one character's
  action targeting another's Statuses, worth reusing the pattern from if this generalizes later.
  V0.5 doesn't add a general version either — nothing in its delta (item 12's update, item 29)
  proposes one, so this stays exactly where it was.
- **Advancement past a full track**: marking Potential, Rapport, or Bond when the track is already
  at its cap still silently drops the mark today. Recorded as `HANDOFF.md` open issue **14** —
  needs a rules answer before any code, and V0.5 is silent on it (the cascading-full-track
  question), so it stays open, now re-pointed at `Planning Docs/Ruleset-V0.6.md`.
- **The advancement kickoff flow** (open issue 15's UX half — filling a track pops its picker
  instantly rather than running a real "you've earned something" flow) was never a rules question
  and is unaffected by slice 4. **Its other half — issue 15's own citation of the Level/Tier-unlock
  formula — is resolved as of slice 4** (item 30 above, `0.31.0`): gating is DAG-only, no Tier or
  Level, closing `HANDOFF.md` open issue 12. The UX question itself (instant popup vs. a
  considered "you've earned something" moment) is untouched and stays open.
- **Hero Moves: cut, not deferred — confirmed directly by the repo owner, not inferred.** Blocked
  on Playbooks not existing as a concept since `0.14.0`; the *Party* half of that reason was
  resolved by slice 7 (`0.34.0`, item 37 above), which built real Party identity data (Motif,
  Quest, Skill/Weakness Tags, Path, Camp Assets) without needing a Playbook system at all. Then,
  in the same session, the repo owner confirmed Playbooks aren't part of the game's systems full
  stop — not merely unwritten yet, as `Ruleset-V0.5.md`'s own "Hero Moves and Playbooks... Coming
  Soon" text implied. Since Hero Moves had no other stated foundation in the doc, they're cut along
  with Playbooks rather than left waiting on a system that isn't coming. Improvement Trees (items
  8/20/29 above) were never confirmed as a replacement for them — that question is now moot rather
  than open.

### Known V0.5 scope — the nine-slice migration, now shipped

Confirmed by the repo owner as real, in-scope work (item 29's locked decisions above), staged
across the nine slices in `WorkPlan-V0.5.md`. **All nine slices are shipped as of `0.36.0`** — kept
as a per-slice list rather than collapsed into prose once complete, since each entry below still
names what shipped and what stayed deliberately out of that slice's own scope, which is exactly the
kind of detail a later session (or a future rules clarification) will want to find quickly.

> **V0.5:** all nine slices below are shipped, `0.29.0` through `0.36.0` (slice 1, the rules
> primitives, shipped earliest, in `0.28.0`, and is covered by this file's main body and judgment-
> call items rather than repeated as its own bullet here). See `WorkPlan-V0.5.md` for the slice
> each item belongs to.

- **Motifs and Skill/Flaw Tags** (slice 2) — **shipped `0.29.0`.** Three Motifs replace the single
  Theme, each with its own Potential track, Quest, Act Breaks and Forsakes; freeform Skill/Flaw
  Tags replace library-authored Skills and Abilities.
- **The new Move list** (slice 3) — **shipped `0.30.0`.** All 22 Moves (10 Basic, 12 Adventure)
  seeded with schema-validated result tables; Hold granted mechanically by the two Moves that name
  a number; Advantage/Disadvantage mechanised for the two triggers this slice's scope could reach
  (item 20 above has the full breakdown). Four Adventure Moves (Make Camp, Keep Watch, Undertake a
  Journey, Enjoy Downtime) shipped as reference text only — their guided flows shipped in slice 7
  (`0.34.0`, item 37 above).
- **Improvement Trees with prerequisites** (slice 4) — **shipped `0.31.0`.** The Advancement →
  Improvement rename; 11 Combat and 14 Narrative Hero Improvement Trees with a real prerequisite
  DAG (`improvementState()`, `packages/shared/src/logic.ts`); `Level`/`PartyLevel` fields that
  gate nothing. Gated purely on the DAG, not Tier/Level, per a repo-owner decision that resolved
  `HANDOFF.md` open issue 12 by treating V0.5's Tier-1..4-and-Level text as leftover draft
  language rather than the rule to implement (item 30 above has the full writeup). The 25 Hero
  trees carry only placeholder nodes — V0.5 names the trees but authors no content on any of
  them — and item 8 above's "tiered Bond Improvements keyed to Bond Level" prediction turned out
  to be wrong: that section of the doc has no content at all, not even tree names, and stays
  unbuilt with no slice assigned until the repo owner authors something to build against.
- **Combat update** (slice 5) — **shipped `0.32.0`.** Per-unit turn order
  (`Encounter.ActingParticipantId`/`PairedParticipantId`, `endTurn()`/`nextActor()` in
  `packages/shared/src/combat.ts`) replacing the single `ActingSide` toggle; Repel automated via
  `repelPushBands()` (split in `0.42.0` into `repelPushBandsForStatuses()`/`repelPushBandsForEnemy()`); Resist (the one remaining unbuilt Reaction Move) wired as a self-reported
  Mettle reduction on both the Repel Gambit and a standalone Reactions-section button; a Cover
  Status picker in `CombatMoveModal.tsx`; minimal Boss-Enemy wiring (`IsBoss`/`GambitCharges`, a
  derived Last-Stand badge, manual defeat); and Combat's start form asking V0.5's actual two-branch
  Rapport-modifier questions. See items 31–34 above for the four repo-owner decisions this slice
  needed. **Still not built**, confirmed out of scope for this slice specifically: the full
  side-alternating turn-order *algorithm* (this slice gives the GM the fields and a suggestion
  function, not an enforced sequence — consistent with Combat's track-and-display design), a
  rendered grid (item 15's standing decision), and real Boss-ability content (item 31's "minimal
  wiring" scope — the abilities themselves stay freeform GM narration).
- **Clocks** (slice 6) — **shipped `0.33.0`.** `Clock`/`ClockKind` (`packages/shared/src/types.ts`),
  a new `clocks` table (migration `0011`, same Realtime/RLS shape as `combat_encounters`), and a
  lazy-loaded `ClocksPanel.tsx` rendered inline on the Campaign Shell for both GM and Player views.
  Collapsed to three `Kind`s rather than the doc's six named variants — see items 35–36 above for
  the two repo-owner decisions (the Kind collapse, and keeping the losing-side spend menu freeform
  rather than building real Advantage/Disadvantage-Forward tracking).
- **Party Identity and Camp** (slice 7, named "Party Playbook & Camp" at the time it shipped —
  see item 37's follow-up note above for why that name stopped being used) — **shipped `0.34.0`.**
  Party Motif/Quest/Skill Tags/Weakness Tags/Path/Goal (`packages/shared/src/types.ts`'s `Party`) —
  freeform, since V0.5 named no catalog to pick from for any of these (and never will — Playbooks
  aren't part of the game's systems at all); `CampAssetTemplate`, a new ordinary schema-driven admin
  collection, plus a hybrid catalog-or-freeform `<datalist>` picker for holding one; and Make
  Camp/Keep Watch/Undertake a Journey/Enjoy Downtime as real guided flows built on this app's
  existing "report the tier, apply the mechanical change" pattern. This is also where item 20's
  `0.18.0` deferral of Undertake a Journey/Enjoy Downtime finally got built, closing the "not yet
  decided whether either needs a guided flow" question that deferral rested on. `PartyLevel`
  already existed from slice 4 — no separate party-scoped Level field was needed. See item 37
  above and CLAUDE.md's "Architecture: Party Identity & Camp" section for the three repo-owner
  decisions and what stayed deliberately narrower than the doc's own wording (Keep Watch/Journey's
  Status grants scoped to the viewer's own sheet only; no Forward/Ongoing cross-roll tracking).
- **GM stat blocks** (slice 8) — **shipped `0.35.0`.** Villains, NPCs, and Locations
  (`packages/shared/src/types.ts`) as three new, ordinary schema-driven Content Admin collections,
  extending the existing `library.enemies` pattern exactly as `WorkPlan-V0.5.md` names it — no new
  server route or admin-page code beyond three `schema.ts` entries. Authored content only: nothing
  wires a Villain into Combat as a spawnable Boss participant. A new `statusLimits` `FieldType`
  (a real, schema-validated `{StatusName, Limit}[]` editor) replaced `EnemyTemplate.StatusLimits`'s
  raw, unvalidated `json` field along the way — closing `WorkPlan-V0.5.md` Section B hazard 1 for
  Enemies, not just for the two new collections that needed it. See item 38 below and CLAUDE.md's
  "Architecture: GM stat blocks" section for the full scoping.
- **Adventures** (slice 9) — **shipped `0.36.0`.** The fourth app surface, a GM-only
  `/c/:campaignId/adventure` route (`AdventuresPage.tsx`/`AdventuresPanel.tsx`): Concept, Type
  (the doc's six named Adventure Types, each with its own "Elements to include" hint), Hook, a
  `VillainId`/`NpcIds`/`LocationIds` reference into slice 8's own collections, floating Secrets
  (`{Text, Revealed}`, no `LinkedToIds` — the doc is explicit these never tie to a specific NPC/
  Location), and a Countdown. Depends on slice 8 (an Adventure references Villains/NPCs/Locations,
  it doesn't redefine them) and slice 6 (`Adventure.CountdownMarks`/`CountdownSteps` reuse
  `Clock`'s tick-and-clamp mechanic, "a Countdown is a clock variant" per `WorkPlan-V0.5.md`'s own
  scope note) — see item 39 above for why the Countdown ended up an embedded field rather than a
  real linked `Clock` row, the one design this slice tried and deliberately reversed once its
  consequences became clear. **GM-only end to end, a first for this app**: `campaign.ts`'s
  bootstrap route only fetches `adventures` for a GM membership (mirroring `invites`), all three
  server routes require `Role === 'GM'`, and `AdventuresPage.tsx` redirects a Player who navigates
  there directly — see item 39 above for the full reasoning (an Adventure's own Secrets/Villain/
  Countdown are spoiler content, unlike everything else this app has ever synced live to the whole
  table). The doc's own "Countdown" chapter names five steps (Seed/Bloom/Wilt/Wither/Rot) under
  prose promising six (`WorkPlan-V0.5.md` Section D item 12) — `ADVENTURE_COUNTDOWN_STEP_NAMES`
  ships exactly five, the inconsistency carried forward unresolved rather than a sixth invented to
  close it.
