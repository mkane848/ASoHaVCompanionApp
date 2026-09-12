# The character sheet's own resources

Load and its wildcard declarations, Pronouns and identity, and the Wealth / Treasure / Hold economies that sit on the sheet rather than in a subsystem.

_Part of `docs/architecture/`. Index: [`docs/architecture/README.md`](README.md). The invariants a session must not violate stay in `CLAUDE.md`; this file is the detail behind them._

---

## Architecture: Load and identity (V0.6 slice 5, `0.46.0`)

**Two of `WorkPlan-V0.6.md` Section A4's four "agreed in meetings, absent from V0.6's text" items —
this slice built exactly items 2 and 4, leaving items 1 (Rapport overflow) and 3 (the Threat board)
to Slices 7 and 6.** Item 2 (2026-08-19): "Unused Load boxes are wildcards. During play a Hero
declares they packed a reasonable ordinary item and assigns it to a free box. Ordinary wildcard
items return to the ether when Load resets at camp; named, magical or plot-relevant items persist
and permanently consume Load, so acquiring one costs future wildcard capacity. Running out should
create problems, not just block." V0.6's own Load text only describes the *declaration* half of
this ("declare, at any time, that your character has any item ... by checking a Load Box") — the
wildcard-versus-persistent distinction and the "running out" clause are both meeting-only content
this slice is the first to actually build. Item 4: Hero Creation's own opener, "Choose your Name,
Pronouns, and Physical Description," names Pronouns as a real creation-time field alongside Name —
the app modeled Name and Looks (Physical Description) already, but had nowhere to put Pronouns.

**`WildcardDeclaration` (`types.ts`) is a new list on `CharacterSheet.WildcardDeclarations`** — each
entry is `{ Id, Text, Persistent }`, a flat 1 Load regardless of what's declared (there's no catalog
`LoadCost` for something invented at the table, unlike a pre-authored `library.items` entry).
`carriedLoad()` (`logic.ts`) now sums `sheet.WildcardDeclarations.length` alongside the existing
catalog-item total — the two live side by side, not merged into one list, since a wildcard has no
`ItemId`/`Charges` and a catalog `CharacterItem` has no `Persistent` flag; forcing them into one
shape would mean giving every catalog item a meaningless `Persistent` field or every wildcard a
fake `ItemId`. `LoadPanel.tsx` renders a "Wildcard items" section (its own `posting` rows, no
`tilt` — same carve-out `StatusesPanel`'s full-width interactive rows already get, since these rows
carry real controls a tilt transform would throw off hit-testing for) above the existing catalog
list: `InlineEdit` for the declared text (same tap-to-edit convention every other short authored
string in this app uses), a `Persistent`/`Ordinary` toggle button, and an always-visible remove
button — the same "separate remove control, not InlineEdit's own `onRemove`" shape `StatusesPanel`'s
own Status rows use, since a wildcard (like a Status) should be removable without first entering
its own text editor. `Persistent: true` and `false` are equally player-controlled at any time, not
just at declaration — a table can decide an item they declared casually turned out to matter later,
or vice versa, and nothing in the doc says that choice locks in.

**Make Camp clears non-persistent wildcards, and does nothing else new.** `StatusesPanel.tsx`'s
`makeCamp()` gained one line — `d.WildcardDeclarations = d.WildcardDeclarations.filter((w) =>
w.Persistent)` — right alongside the existing Armor-refresh/Load-unlatch reset it already performs.
A `Persistent` entry survives untouched, permanently occupying that Load box exactly as A4 item 2
describes ("acquiring one costs future wildcard capacity").

**"Running out should create problems, not just block" is a non-blocking message, not an invented
mechanic — the same "track-and-display, the table narrates the rest" treatment this app gives every
open-ended consequence clause (Brace's timed reduction, Forward/Ongoing bonuses, Surprise's GM
discretion).** `LoadPanel.tsx` already had a non-blocking "over capacity" warning from before this
slice (over Load doesn't stop the sheet, only checking your last box does); this slice adds a
sibling message for the *at-capacity-but-not-over* case — "No Load free. You can still declare one
more item — running out should create a complication, not just a stop. The table decides what." —
rather than inventing a formula for what that complication actually is, which neither the meeting
note nor V0.6's own text specifies.

**Light/Heavy Loadouts grant a matching Boon/Bane, and only that — the doc's own "+1 Movement"/"-1
Speed in Combat" clauses in the same paragraph are deliberately not modeled.** V0.6: "3 Load is
Light. You have +1 Movement in Combat, gain *Inconspicuous* Boon... 6 Load is Heavy. You have -1
Speed in Combat, and gain *Conspicuous* Bane." `WorkPlan-V0.6.md`'s own Slice 5 bullet only names
the Boon/Bane grant, and this app has no numeric Combat movement/speed stat to hang "+1"/"-1" off
of in the first place — Range has been theater-of-the-mind bands since Combat was first built (see
"Architecture: Combat" in `docs/architecture/combat.md`), a standing, repo-owner-confirmed design constraint, not a gap this
slice reopens. `applyLoadTierBoonBane(sheet, newTier)` (`logic.ts`) is a small, deterministic sync:
it removes "Inconspicuous" from `Boons` and "Conspicuous" from `Banes` by exact name, then adds
whichever one the new Tier calls for (neither, for Normal). Called from `LoadPanel.tsx`'s existing
tier-switch button handler, alongside the existing `d.Load.Tier = t.Key` write. Exact-name matching
only, the same "freeform text, no hidden bookkeeping" treatment every other Boon/Bane in this app
gets — a player who's already renamed, duplicated, or manually removed one of these two tags keeps
full control of it afterward; the sync only ever adds/removes the literal strings "Inconspicuous"/
"Conspicuous", nothing fuzzier.

**`Character.Pronouns: string` is freeform, mirroring `Name`'s own "no catalog to pick from"
treatment** — V0.6 gives no option list, so this isn't an enum. Captured in a new "Pronouns" field
in `CreateCharacterPage.tsx`, immediately after Character name, required non-empty the same way
Name already is (`characterCreationSchema.ts`'s zod schema, both client- and server-validated,
following the existing pattern). Displayed on `CharacterSheetPage.tsx`'s sticky header, next to the
character name — a new `.pronouns` class, deliberately *not* uppercased/letter-spaced the way
`.themeName`'s micro-label treatment is, since "SHE/HER" in small-caps reads as shouting in a way a
Motif name doesn't.

**`Character` moved from a JSONB blob field to a real Postgres column for this, and that needed a
migration `CharacterSheet` fields never do.** Unlike `CharacterSheet`/`Party`/`Bond` (single JSONB
columns, a new field just needs the TypeScript type updated — see "Data shapes" above),
`characters` is a real row-shaped table (`repo.ts`'s `mapCharacter()`/`insertCharacter()`, PascalCase
TypeScript ↔ snake_case Postgres). Migration `0014_character_pronouns.sql` adds `pronouns text not
null default ''` — the empty-string default backfills every existing row in the same statement, no
separate UPDATE needed, and `mapCharacter()` still defensively falls back to `''` on read (`r.pronouns
?? ''`) for the moment between merge and this migration actually being applied live — see
"Deployment" below for why that gap is real and not hypothetical. **No post-creation edit route was
added, for `Pronouns` or for `Name`.** There has never been a `PATCH`/update route for any
`Character` field — `Name` itself has been write-once-at-creation since character creation shipped
in `0.7.0` — and this slice didn't add one, following the same precedent "Working conventions"
already states for Virtue scores and Theme (a post-creation edit affordance needs an explicit
repo-owner ask, not an assumption that one's obviously wanted). Revisit if that ask ever comes.

**Deliberately out of scope for `Pronouns`**: `PeekCard.tsx` (the GM's live-peek summary) reads a
server-computed `CharacterSummary`, not the raw `Character`, and wasn't extended to surface
Pronouns — the slice bullet says "on the sheet and in character creation," and wiring a third
surface would mean touching the summary-computation route for a field neither `WorkPlan-V0.6.md`
nor A4 item 4 asks to appear there.

**Testing**: `logic.test.ts` gained `describe` blocks for `carriedLoad`'s wildcard counting and
`applyLoadTierBoonBane`'s exact-name add/remove/no-op behavior, plus a `normalizeSheet` case for
`WildcardDeclarations` backfilling to `[]` on a pre-slice-5 sheet; `characterCreationSchema.test.ts`
gained a "trims and requires non-empty Pronouns" case mirroring the existing Name one.
`interaction-smoke.mjs` gained one new state, `wildcard item editor` — a wildcard row's `InlineEdit`
sits beside two siblings a plain `TagList` chip doesn't have (the Persistent toggle, an
always-visible remove button), geometrically distinct enough from the existing "tag editor (Look)"
state to warrant its own check rather than assuming coverage. `seedPlay.ts`'s four demo characters
each got a Pronouns value and one (Ember) a `Persistent` wildcard declaration, another (Frostbite)
an ordinary one — enough to exercise both branches in manual QA and the smoke suite without every
seeded sheet needing one.

**Deliberately not built this slice, real scope for later, not oversights**:
- A4 item 1 (Rapport overflow, the 10/5 mechanic) — Slice 7's (`0.48.0`).
- A4 item 3 (the Threat board) — Slice 6's (`0.47.0`).
- Any numeric Combat movement/speed effect from Load Tier — see the Boon/Bane-only note above; this
  app has no stat that clause could attach to.
- A formula for what "running out" actually does beyond the non-blocking reminder — neither the
  meeting note nor V0.6's own text specifies one, and inventing one would be exactly the kind of
  guess this project's discipline forbids.

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
the ruleset and where it lives" in `docs/history/ruleset-migrations.md`); it's deferred to slice 7 alongside that Move's guided flow.
Every other Move — and `CombatMoveModal.tsx`'s own Engage-roll render site, which has no V0.5-named
trigger to hook into at all — keeps the informational-only tooltip unchanged, still duplicated
between the two sites for the same reason as before (no single shared roll-breakdown-rendering
component to hook a shared version into).

**This paragraph and the two after it describe `EndSessionModal.tsx`'s pre-V0.6 Hold economy —
superseded by V0.6 slice 4 (`0.45.0`): see "Architecture: Moves and Camp content" in `docs/architecture/moves-and-camp.md`.** The
per-player Hold-grant-and-spend flow described below is gone from this modal entirely, replaced by
each player choosing one of three ways to grow (mark a Bond, rewrite a Skill/Flaw Tag, or mark
Potential). `CharacterSheet.Hold` itself and the Move-level grants described in the blockquote just
below survive untouched — only this modal's own use of the pool changed. Left in place as history,
same as every other superseded description in this file.

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
doesn't bypass the handshake, it just gates *offering* the proposal), or mark Potential.

**Those four spends live in `SpendHoldModal.tsx` as of `0.50.0`, not in this modal.** Slice 4
(`0.45.0`) retired End the Session's Hold economy and deleted the spends along with it, but left
the two Move-level grants (Assess the Situation, Discern the Truth, via `holdGrantForTier()`) in
place — so for five releases Hold was a counter that only went up, with no decrement anywhere in
the codebase. That is a broken shipped mechanic rather than dead data, which is why `0.50.0`
restored the spends rather than retiring the field. They are now reachable whenever the player has
Hold, from the readout in `StatusesPanel.tsx`'s resource row, instead of only at End the Session.
The modal is owned by `CharacterSheetPage.tsx` (it needs the Bond list and the propose callback,
which `StatusesPanel` doesn't have) and lazy-loaded like every other sheet modal.

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
  Playbook & Camp" in `docs/architecture/moves-and-camp.md` for what each actually covers.
