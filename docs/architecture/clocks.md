# Clocks

The four Kinds — Opposition, Threat, Project, Tug-of-War — Developments, and the GM's Quest Board. Several Clocks can be open in a campaign at once.

_Part of `docs/architecture/`. Index: [`docs/architecture/README.md`](README.md). The invariants a session must not violate stay in `CLAUDE.md`; this file is the detail behind them._

---

## Architecture: Clocks (V0.6 slice 6, `0.47.0`)

**Closes out `WorkPlan-V0.6.md` Section C's Clocks bullet and A4 item 3.** V0.6 rewrote the Clocks
chapter against the V0.5-era three-`Kind` collapse the section above describes — this slice ships
that rewrite: `ClockKind` is now `'Opposition' | 'Threat' | 'Project' | 'TugOfWar'`
(`packages/shared/src/types.ts`), the New Clock form (`ClocksPanel.tsx`) offers all four, and a
GM-only Quest Board surfaces promoted Threats per A4 item 3.

**`'Basic'` → `'Opposition'` is a pure rename — same Success/Failure/Headway-risk mechanic,
`applyClockRoll()`/`clockOutcome()` both unchanged beyond their own doc comments.** Because it's a
pure rename, a legacy `'Basic'` value is translated forward on read, not dropped: `normalizeClock()`
(new, `logic.ts`) maps it to `'Opposition'`, called from `repo.ts`'s `listClocksForCampaign()`, the
same self-heal-on-read pattern `normalizeSheet()`/`normalizeParty()`/`normalizeLibrary()` already
use for every other JSONB-blob shape change this migration has made.

**`'Countdown'` splits into `'Threat'` and `'Project'` — a genuine one-to-two split, unlike the
Opposition rename, with no way to reconstruct which a given legacy Clock was meant to be.**
`normalizeClock()` defaults every legacy `'Countdown'` Clock to `'Threat'`, the closer semantic
match (GM-ticked, already the target of Camp Actions' "advance a Bad Guy Clock" flow before this
slice gave it a real name) rather than guessing per-clock or discarding data — a deliberate,
documented default, not a silent one. `Clock` gained four fields, present regardless of Kind (the
same "field always present, only sometimes meaningful" treatment `NPC.StatusLimits` already gets,
rather than a per-Kind union): `Goal: string` (Threat and Project both use it — "how will this
Threat change the Hero's world for the worse," or a Project's own stated aim), `SkillTags: string[]`
(Threat-only in the doc's own text — "1-3 words or phrases... anything to frame how it is ticking
toward its Goal"), `Developments: ClockDevelopment[]` (Threat-only — `{ Id, Text, Triggered }`, a
GM-toggled flag rather than tied mechanically to a specific segment, matching the doc's own "trigger
them based on what best serves the narrative and pacing"), and `PromotedToBoard: boolean` (see the
Quest Board paragraph below). All four backfill to their empty defaults on read, same as every other
new field this migration has added to a JSONB-blob type.

**A real, deliberate scoping call on Developments' visibility, not a silent assumption: they're
plain player-visible text, not GM-only spoiler content like an Adventure's Secrets.** The doc's own
"plan the consequences that will happen if the Heroes fail to intervene" phrasing could read either
way, but Threat Clocks are explicitly named as the doc's own example of a *player-facing* Countdown
("Threats are Countdown Clocks that are player facing, showing them how the world is moving"), and
this app has no per-field visibility mechanism on a Clock — building one to hide Developments until
triggered would mean reopening the exact Realtime-payload-leak problem "Architecture: Adventures" in `docs/architecture/gm-content.md`
above documents (a `postgres_changes` payload carries a subscribed row's entire `data` column
regardless of which fields the UI reads), which Clocks were never built to guard against the way
Adventures' GM-only surface was. `ClockCard`'s Goal/Skill-Tags/Developments editing is GM-only in
the UI (matching the existing `isGM` gate the old Countdown tick controls already had — no new
authorization precedent, the server still trusts the whole-document PUT the way it always has), but
the *display* of all three is unconditional for every viewer.

**Linked Clocks are deleted outright, per the doc's own restructure — `UnlocksClockId`/
`isClockLocked()` are gone, and `normalizeClock()` doesn't carry the field forward.** There's no
concept left for it to attach to; leaving a stray `UnlocksClockId` key sitting unread in an old
Clock's JSONB blob is harmless (nothing reads it), the same "leftover key, not actively stripped"
treatment a retired `CharacterSheet` field already gets elsewhere in this app. The "Locked" badge
and its gating in `readOnly` are both gone from `ClockCard.tsx` along with the `allClocks` prop that
existed only to support the lookup.

**The Quest Board (A4 item 3) is a curated, additional view of promoted Threats — it never hides a
Clock from the ordinary Open list, and it deliberately isn't built from the same interactive
`ClockCard`.** A4 item 3's own text: "Some GM Threats get promoted to visible party quests... the
accumulating stack of quest cards being the intended engine of mechanical pacing and dramatic
pressure" — a meeting-only decision V0.6's own text never describes a board or promotion step for.
`ClocksPanel.tsx` renders a `QuestBoardCard` per `Threat`-kind Clock with `PromotedToBoard: true`,
above the ordinary Open list — but `QuestBoardCard` is deliberately decorative (Title, Goal, a
segment-dot row, no buttons or inputs of its own), not a second copy of the full `ClockCard`: the
same Clock still renders fully, interactively, in the Open list right below, and giving the same
Clock's `id`-bearing controls (the risk-row `aria-labelledby` target, in particular) two DOM
instances at once would be a real accessibility bug, not just visual duplication. The GM toggles
promotion from the Threat's own card (`isGM`-gated, alongside its tick/Resolve row); a promoted
Threat also gets a "Quest Board" badge on that card so its status reads the same place its other
badges do.

**"The clocks of neglected Threats advancing as the party pursues others" is deliberately not
built — the same "track-and-display, no invented formula" treatment this migration gives every
open-ended consequence clause it can't pin down (Brace's timed reduction, Forward/Ongoing bonuses,
Surprise's GM discretion).** Neither the meeting note nor V0.6's own text says how much a neglected
Threat advances or on what trigger (per session? per Camp? per day?) — inventing a cron-like
auto-ticking mechanic here would be exactly the kind of guess this project's discipline forbids. The
doc's own, better-specified line — "Threats... advance automatically as an Adventure moves forward,
often when the Heroes Make Camp" — is already covered by the existing, GM-manual Camp Actions
"Advance a Threat" flow (renamed from "Advance a Bad Guy Clock" this slice, and now filtered to
`Kind === 'Threat'` instead of listing every open Clock), which predates this slice and needed no
new mechanic to satisfy that reading.

**`CampActionsModal.tsx`'s "progress a personal project Clock" action and `EnjoyDowntimeModal.tsx`'s
Advance activity both now filter their Clock picker to `Kind === 'Project'`**, instead of listing
every open (or every, period) Clock as they did when `'Countdown'` was the only GM-ticked Kind and
there was nothing to filter by. Neither flow's own mechanic changed — both still report a tier via
`TierChoiceRow` and tick 3/2/1 segments through the same `tickClock()` call as before.

**Testing**: `clocks.test.ts` (`packages/shared`) dropped its `isClockLocked` tests (the function is
gone) and its `Kind` literals moved to `'Opposition'`/`'Threat'`/`'Project'`/`'TugOfWar'`;
`logic.test.ts` gained a `normalizeClock` `describe` block pinning the Basic→Opposition translation,
the Countdown→Threat default, and the four-field backfill; `apps/server/src/routes/clocks.test.ts`'s
fixtures and request bodies moved to the new Kind names. `harness.tsx`'s `?clocks=1` fixture now
seeds one Clock of each of Opposition/Threat/Project (the Threat pre-promoted to the Quest Board,
with one triggered and one un-triggered Development), so the responsive smoke test's existing
"campaign (player/GM, open clocks)" routes exercise the whole rebuild — the Quest Board, Goal/
Skill-Tags/Developments editing, and the Kind-filtered Camp Actions/Enjoy Downtime pickers — without
a new route or a new interaction-smoke state; no click-gated layout was added that the at-rest pass
couldn't already reach.

**Bundle budget**: `ClocksPanel` is unaffected — it's the same lazy chunk from `CampaignPage.tsx`
this slice already was, so none of this slice's additions touch the always-loaded first-load
bundle. Measured at 213.02 kB gzip against the 220 kB cap, flat against slice 5's number.

**Deliberately not built this slice, real scope for later, not oversights**:
- A4 item 1 (Rapport overflow) — **correction**: this bullet originally claimed it shipped with item
  4 in Slice 5; it did not — item 4 (Pronouns) shipped in Slice 5 (`0.46.0`), but item 1 was still
  unbuilt at this slice and has since shipped in Slice 7 (`0.48.0`, "Architecture: Party and Bond
  (V0.6 slice 7)" in `docs/architecture/party-and-bond.md`). Left corrected here rather than silently fixed, the same "record the
  correction, don't erase the mistake" treatment this file gives every other stale claim.
- Any numeric or time-based auto-advance for a neglected Threat — see the scoping note above.
- A GM-only visibility mechanism for Developments — see the scoping note above; building one would
  be new, unscoped architecture, not something this slice's bullet asked for.
- `CampaignOverview.LastPlayedAt` still doesn't read Clocks — the same real, easy follow-up slice 6
  (`0.33.0`) already flagged and left undone, untouched by this restructure.
