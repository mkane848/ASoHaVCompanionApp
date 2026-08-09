# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## Versioning policy

This is a private, unpublished monorepo (every package in `apps/*` and `packages/*` is
`"private": true`) — nothing here is installed as a dependency by anyone outside this repo, so
there's no external consumer whose builds break on a version bump. We still follow
[Semantic Versioning](https://semver.org/), synchronized across all four `package.json` files
(root, `@asohav/server`, `@asohav/web`, `@asohav/shared`) rather than versioned independently,
since they only ever ship together:

- **MAJOR** (`1.0.0` and up): reserved for once the app is in real use — a change that breaks
  existing data or existing users' sessions/accounts.
- **MINOR**: new functionality or a notable internal architecture change (a new feature, a swapped
  transport layer, a schema change).
- **PATCH**: backward-compatible fixes — a bug fix, a config/deploy fix, no behavior change a user
  would notice.
- Per [SemVer §4](https://semver.org/#spec-item-4), `0.y.z` means initial development: the surface
  is not yet considered stable, so a MINOR bump (not MAJOR) is used for breaking internal changes
  pre-1.0 — this is why `0.1.0 → 0.2.0` below covers a full auth/data-layer rewrite.

Bump all four `package.json` files together when cutting a version, add a entry below, and tag the
merge commit `vX.Y.Z`.

Entries carry a full UTC timestamp (`YYYY-MM-DDTHH:MM:SSZ`) as of `0.4.0`, not just a date —
the About modal displays it converted to the viewer's own local time. Entries before `0.4.0`
stay date-only; that's what shipped, and rewriting history to add a fabricated time would be
worse than leaving it alone.

## [0.15.0] — 2026-08-09T14:30:00Z

Gambits — the last piece of Combat's core loop scoped so far (Hero Moves, Opportunity Attack,
Interpose, and a rendered grid stay deferred, see `HANDOFF.md`).

- **`packages/shared/src/combat.ts`**: `GAMBITS` (all nine, with description text) and
  `gambitConditionCost()` — 1 Condition per Gambit on a 10+ (first free on an exactly-reported
  12+), one Gambit only on a 7-9 costing 2 Conditions, none on a miss. Unit tested.
- **Only a PC's Engage roll can take a Gambit** — the cost is marking a Condition, which only PCs
  have, so `CombatMoveModal`'s Gambit picker is gated on the acting player viewing their own turn.
- **Six of nine Gambits are fully automated**, each reducing to a call the engine already knows how
  to make: Bolster (+1 to the Rank the roll gives), Press (shift 2 Range bands, free),
  Halt/Impede (a second Rank-2 hindering Status on the target), Calculate/Brace (a Rank-1 helpful
  Status — Focused/Braced — on the actor, reusing the Status system itself as the buff mechanism
  rather than a new temporary-effect tracker).
- **Repel, Seize, and Other are logged to `Encounter.History` only** — deliberately not forced into
  an invented formula; see `CLAUDE.md`'s Gambits note and `README.md#architecture-notes--
  judgment-calls` item 16 for the reasoning.

## [0.14.0] — 2026-08-09T02:00:00Z

First Combat slice, replacing the `0.13.0` Coming Soon placeholder with a live Encounter view.
Scoped in a dedicated conversation with the repo owner before any code — see `HANDOFF.md`'s
seventeenth-session note and `README.md#architecture-notes--judgment-calls` item 15 for the full
writeup of what got decided and why.

- **New migration `0010_combat_encounters.sql`**: a `combat_encounters` table (the first new table
  since `0009` — everything in `0.13.0` was JSONB-field-only), same joinless-RLS-policy shape as
  `party`/`bonds`. Not yet applied to the live Supabase project.
- **Core Combat loop**: start/end an Encounter, Combat Goal, Defiant Goals, reported (not rolled)
  2d6 initiative, a manual Acting-Side toggle for the "zipper" turn order, Round/AP tracking — all
  track-and-display, never enforced (confirmed with the repo owner).
- **Combat Moves**: Engage in Melee/at Range (roll breakdown + tier-report, same pattern as
  everything else, Toughness-adjusted Rank), a simplified Reposition control (see the range-band
  note below), Recuperate (reuses `HealStatusModal`).
- **Reaction Moves**: Defend (marks Armor) and Help (spends Party Rapport) have real mechanical
  effect; Opportunity Attack and Interpose are not built this slice.
- **Range is theater-of-the-mind bands** (Melee/Close/Far/Very Far/Out of Range), not a rendered
  grid — confirmed out of scope with the repo owner. `packages/shared/src/combat.ts`'s
  `shiftRange()` collapses the doc's Maneuver/Shift square-count distinction into one generic
  1-band reposition, documented as a simplification rather than guessed at silently.
  `packages/shared/src/engine.ts` gained a matching pure-logic module for Toughness, per-Status
  Enemy Limits, and Range shifting.
- **`Encounter.PendingStatusOffers`**: solves the collision between "a PC's Statuses live on their
  own sheet" and "sheet writes are owner-only, not even the GM" — an Enemy's attack offers a
  Status instead of writing it directly; the target's own player applies it (optionally Resisting
  first) from their own participant card.
- **`library.enemies`** (`EnemyTemplate`): real Content Admin CRUD content, but authoring is
  ad-hoc-first — a GM can spawn a one-off Enemy with nothing persisting, or save it to the library
  on the way in. Enemies are defeated per-Status (any one `StatusLimit` reached), not a shared HP
  pool.
- **Deliberately deferred**: Gambits, Hero Moves (blocked on Playbooks), Opportunity Attack,
  Interpose, and a rendered grid — see `HANDOFF.md`/`CLAUDE.md` for the full list.

## [0.13.0] — 2026-08-08T23:30:00Z

First slice of the game engine: modifier-transparency and mechanical-effect application for
Moves, Statuses, and Conditions, reconciled from `Planning Docs/`'s working design doc (many
sections of which are outdated drafts or unrelated brainstorming — see the new "Reconciling the
working design doc" note in `HANDOFF.md` for what was treated as current vs. superseded, and the
list of design questions the doc itself leaves unresolved). By explicit product decision, this
app still never rolls dice — it computes and shows every roll modifier with its source, and once
told which tier a physically-rolled roll landed in, applies the resulting mechanical change.
Combat is deliberately deferred to its own future slice (see `HANDOFF.md`); a placeholder page
now exists so the Campaign Shell's nav is fully click-through-able in the meantime.

- **New `packages/shared/src/engine.ts`** (unit tested, `engine.test.ts`): `computeRollBreakdown`
  (2d6 + Virtue, itemized by Condition penalty / highest helpful+hindering Status / applicable
  Ability `RollBonus` effects, each labeled with its source), `conditionalRollBonuses` (Ability
  bonuses whose trigger can't be evaluated automatically, surfaced separately for the player's own
  judgment call), `resistRollReduction` (the Resist Roll formula: reduce by the Virtue score used,
  +1 more on a 10+, nothing on a miss), and the Status engine — `giveStatus` (stacks or creates,
  capped at `StatusMaxRank`), `healStatus`, `applyOpposingStatus` (opposite Statuses cancel
  Rank-for-Rank), plus `resolveRiskDeath`/`makeScar`/`healingSurgeAmount` for the
  Subdued → Scar/Risk Death/Blaze of Glory chain.
- **Statuses are now the game's damage/HP system**, matching the doc: a Negative Status reaching
  Rank 6 (`StatusMaxRank`) triggers **Subdued** instead of just sitting at "Rank 6" — the sheet's
  Statuses panel now has a "Give a Status" flow (with an optional Resist Roll and optional
  opposite-Status cancellation) and a "Heal a Status" flow (spends a Recovery, clears
  1d6 + Mettle Ranks — you report the d6, same no-dice-rolled-by-the-app rule as everywhere else),
  and a Subdued trigger opens a three-way Scar / Risk Death / Blaze of Glory resolution modal.
  `CharacterSheet` gained `Recoveries` (refills to the new `GameSettings.RecoveriesMax` at Make
  Camp) and `Scars` (free-text, shown on the sheet).
- **"Dishonored" absorbs what an earlier doc draft called "Crumble."** The doc tried two different
  names/effects for marking a 6th Condition (all five already marked) in two different places —
  reconciled onto the original, already-shipped **Dishonored** name (confirmed with the repo
  owner), now with an actual defined consequence (leave the scene / go unconscious; a
  Combat-only "+Vulnerable 4" is noted but can't be wired up until Combat exists) as a glossary
  entry, tap-to-reveal from the badge on both the Character Sheet and GM live-peek.
- **Advancement Tier-unlock thresholds are now admin-configurable** (`GameSettings.
  AdvancementTier2At/Tier3At/Tier4At`, Content Admin → Settings) instead of hardcoded — still
  default to the shipped 4/7/10, `unlockedTier()` just takes them as a parameter now.
- **Roll helper in the Moves drawer**: every Basic Move now shows "Roll 2d6 + Virtue: total,"
  broken down by source, computed live off the open sheet. Moves with no fixed Virtue ("Invoke
  Expertise," "Take a Risk") let you pick which one fits the action first.
- **Combat placeholder**: a new `/c/:campaignId/combat` route and a "Combat" link on the Campaign
  Shell banner, showing a Coming Soon notice — real scope, deferred (see `HANDOFF.md`), not an
  oversight.

## [0.12.1] — 2026-08-08T20:47:00Z

Fixes a production crash loop that caused intermittent "hangs" across the whole app (surfaced
during invite-accept testing, but not specific to it) — see `HANDOFF.md` for the full
investigation writeup.

- **Root cause**: every route handler in `apps/server/src/routes/*.ts` was an unwrapped async
  Express 4 handler. Express 4 (unlike 5) does not forward a rejected promise from an async
  handler to error-handling middleware — it becomes an unhandled rejection, and Node's default
  `--unhandled-rejections=throw` crashes the whole process. Since every handler calls into
  `repo.ts` functions that `throw` on any Supabase error, a single transient Supabase hiccup on
  *any* endpoint took the entire server down; Render's Render logs from `2026-08-05` show it
  crash-looping (`UnhandledPromiseRejection`, restart, crash again ~8s later, repeat). A request
  landing mid-restart would hang with no response and no error surfaced to the user.
- Added `apps/server/src/asyncHandler.ts`'s `wrap()` and applied it to all 36 route handlers
  across every router (`auth`, `library`, `campaign`, `sheet`, `party`, `bond`, `characters`,
  `invites`, `admin`) — a thrown/rejected error now becomes `next(err)`, handled by the existing
  global error middleware in `index.ts`, instead of crashing the process. Chose this over
  upgrading to Express 5 (which does this automatically) to keep the fix small and low-risk;
  Express 5 has its own breaking changes elsewhere (route-matching syntax, `req.query`) this app
  has no live-DB integration coverage to catch — worth doing deliberately later, not bundled here.
- Applied migration `0009_campaign_phase.sql` to the live Supabase project — committed in
  `0.12.0` but never run against production (same "committed but unrun" gap as `0006`/`0007` in
  earlier sessions; see `HANDOFF.md`).
- `apps/web/src/lib/api.ts`'s `request()` now times out after 20s (`AbortSignal.timeout`) instead
  of hanging forever on a stalled request, and throws a catchable, user-facing `ApiError` instead.
- Added `apps/web/src/components/Toast.tsx`, a small auto-dismissing error banner, and used it in
  `InviteInbox.tsx` (accept/decline/join-by-code) in place of the inline error paragraph — a
  silently-hung request is no longer indistinguishable from nothing having happened.

## [0.12.0] — 2026-08-05T00:00:00Z

New campaign-setup workflow: a GM-controlled lifecycle (Signup → Party Creation → Playing) and a
much fuller character-creation flow, replacing the old "just Virtues, Theme, and two names" chargen.

- **`Campaign.Phase: 'Signup' | 'PartyCreation' | 'Playing'`** (`packages/shared/src/types.ts`),
  migration `0009_campaign_phase.sql`, orthogonal to the existing `Status` archive flag (0.11.0).
  Optional on the type — `campaignPhase()`/`assertPartyCreationPhase()`
  (`packages/shared/src/logic.ts`) treat a missing value as `'PartyCreation'`, matching the
  migration's backfill default for pre-existing rows, so an already-running campaign keeps
  letting a newly-invited player create a character instead of the new gate retroactively locking
  it out. New campaigns explicitly start at `'Signup'`. GM-only `PATCH /api/campaigns/:id/phase`
  moves between phases; only Signup→PartyCreation, PartyCreation→Playing, and
  PartyCreation→Signup (reopening) are valid — see `CAMPAIGN_PHASE_TRANSITIONS`. Character
  creation (`POST /api/campaigns/:id/characters`) now 409s outside the Party Creation phase.
- **`Membership.Ready`** — a player marks themselves ready via `PATCH /api/campaigns/:id/ready`
  once their character is set up; `partyReadiness()` computes the GM's "N / M ready" readout
  (Player memberships only — GMs don't have characters). Deliberately not itself gated on any
  real per-player confirmation yet — see below.
- **Character creation is a real chargen flow now**, not just Virtues/Theme/two names:
  - **Looks**: a repeatable list of short phrases, joined with `\n` into the existing
    `CharacterSheet.Looks: string` field on submit — the wire shape stays a string (nothing else
    that reads it needed to change), only the creation-time *input* is list-shaped.
  - **Virtues**: the standard-array assignment UI is now radio buttons per Virtue instead of a
    `<select>`, same underlying `availableValuesFor()` logic.
  - **Theme**: picking a Theme now shows its starting Quest and a checkbox list of the Theme's
    other Quests, accepted alongside the starting one.
  - **Starting Skills/Abilities**: checkbox pickers, capped at the library's new
    `GameSettings.SkillsAtCreation` / existing `AbilitiesAtCreation` (Abilities filtered to
    `Acquisition: 'Starting'`) — the first place either setting is actually enforced.
  - **Rapport & Kin**: a read-only placeholder card. Real per-player background-connection
    confirm/deny (the outline's "similar confirm/deny menus" alongside Bond's handshake pattern)
    is intentionally deferred — see `HANDOFF.md`.
- **UI**: the Campaign Shell banner gained a phase badge and GM controls ("Close signup & start
  party creation", a live "N / M ready" tag, "Start playing" with a `ConfirmModal` if not everyone
  is ready yet). Players see a "Create your character" link only during Party Creation, and an
  "I'm ready" toggle once they have a character.
- **Tests**: vitest for the new logic helpers (`campaignPhase`, `assertPartyCreationPhase`,
  `assertValidPhaseTransition`, `partyReadiness`), the `PATCH /:id/phase` and `PATCH /:id/ready`
  routes, and the Party-Creation-phase gate plus new field validation on character creation.

## [0.11.0] — 2026-08-04T12:49:34Z

Fourth and last of the four-PR campaign-management batch (see `0.7.0`, `0.8.0`, `0.10.0`) — lets
a GM archive their own campaign: a visible label plus a freeze on further play-state mutations,
per the repo owner's choice between the two when this batch was scoped.

- **`Campaign.Status: 'Active' | 'Archived'`** (`packages/shared/src/types.ts`), migration `0008
  _campaign_status.sql` (a plain column + check constraint, no RLS changes — see the migration's
  own note on why this stays in the Express-layer authorization pattern rather than becoming a
  policy). GM-only `PATCH /api/campaigns/:id/status` (`apps/server/src/routes/campaign.ts`)
  toggles it; a GM cannot delete their own campaign through this route (that's still admin-only,
  see `0.8.0`).
- **The freeze**: `assertCampaignActive()` (`packages/shared/src/logic.ts`) is called from every
  mutating route that touches an archived campaign's play state — sending an invite
  (`campaign.ts`), Bond propose/accept/reject (`bond.ts`'s shared `requireCampaignPlayer`), sheet
  edits (`sheet.ts`), party edits (`party.ts`), character creation (`characters.ts`), and
  redeeming an invite to join one (`invites.ts` — declining stays allowed, since it doesn't
  commit anything new). All reject with `409` and a `CampaignArchivedError` message.
- **UI**: a GM-only "Archive campaign" / "Unarchive campaign" button on the Campaign Shell banner
  (`ConfirmModal`-gated for archiving, not for reversing it), an "Archived" badge wherever the
  campaign shows up (`HomePage`'s campaign list, the Campaign Shell banner, the Character Sheet's
  header). `CampaignBonds.tsx` and `AdvancementPanel.tsx` — the two places with Bond
  propose/accept/decline/withdraw controls — hide them when archived rather than leaving them to
  fail silently against the server's `409`; every other sheet field (Virtues, Statuses, Load,
  etc.) stays visually editable and relies on the server-side freeze alone, consistent with how
  little error feedback any other failed sheet save already surfaces in this app.
- **Tests**: vitest for `assertCampaignActive`, the new `PATCH /:id/status` route (GM-only,
  rejects an invalid status value), and the freeze check on every mutating route it touches
  (`campaign.test.ts`, `characters.test.ts`, new `sheet.test.ts`/`party.test.ts`/`bond.test.ts`).

## [0.10.1] — 2026-08-04T12:41:40Z

Closes a gap the `0.10.0` Bond-badge/Kin-reason PR exposed in the `0.9.0` Glossary feature:
Mark Kin proposals now carry real player-authored prose (previously a hardcoded note), and two
render sites for that prose — plus a Bond-move-text render site that predates both PRs — were
never wired into `GlossaryText`.

- **`apps/web/src/features/campaign/CampaignBonds.tsx`** (the Campaign Shell's Bond view) had no
  glossary wiring at all — an oversight from the original `0.9.0` rollout, which only touched
  `apps/web/src/features/sheet/*`. It renders the same `Bond.BondMoves[].Text` as
  `AdvancementPanel.tsx`'s sheet-side view, just un-linked; now wraps that, the pending proposal's
  `Note`, and each history row's `Note` in `<GlossaryText>`, matching its sheet-side counterpart.
- **`apps/web/src/features/sheet/AdvancementPanel.tsx`** already had `GlossaryText` wired in from
  `0.9.0`, but not on the pending-proposal `Note` or `HistoryList`'s `detail` (Bond history's
  `Note`) — no practical gap when Mark Kin's note was a fixed string, but `0.10.0` made it real
  freeform text. `HistoryList` now takes the shared matcher as a prop.

## [0.10.0] — 2026-08-04T10:13:19Z

Third of the four-PR campaign-management batch (see `0.7.0`, `0.8.0`) — a pending-confirmation
Bond badge, and a player-authored reason for Mark Kin proposals in place of a canned note. Landed
as `0.10.0` rather than `0.9.0` (as originally drafted) because the Glossary feature merged to
`main` first and claimed `0.9.0` — same renumbering pattern as `0.7.0` and `0.9.0` itself before
it (see that entry's own note below).

- **Pending Bond badge** (`apps/web/src/components/PendingBondBadge.tsx`, backed by a new pure
  `pendingBondCountFor(bonds, myCharacterId)` in `packages/shared/src/logic.ts`). Counts Bonds
  with a `PendingChange` proposed by the *other* party — i.e. awaiting the viewer's own
  confirmation — and shows a small gold count badge next to the "Advancement" panel header on the
  Character Sheet (via `PanelHeader`'s existing `extra` slot, so it's visible even while that
  panel is collapsed) and next to the "Bonds" heading in the Campaign Shell
  (`CampaignBonds.tsx`). Previously the only cue was the highlighted box inside each individual
  Bond's own card — easy to miss without opening/scrolling to it.
- **Player-authored Kin reason** (`apps/web/src/components/MarkKinModal.tsx`, mirroring the
  existing `ForgeBondModal.tsx` pattern). "Propose +1 Kin" in both `CampaignBonds.tsx` and
  `AdvancementPanel.tsx` previously sent the same hardcoded `'Something between us changed.'`
  note on every proposal; it now opens a small modal where the player writes their own reason,
  which becomes the proposal's `Note` the partner reads when confirming. Spend Kin and Forge
  Bond's canned notes are unchanged — this only touches Mark Kin, per the ask.
- **Tests**: vitest coverage for `pendingBondCountFor` (both seats of a Bond, multiple Bonds,
  Bonds the character isn't part of, self-proposed vs. partner-proposed).

## [0.9.0] — 2026-08-04T04:24:45Z

Landed as `0.9.0` rather than `0.8.0` (as originally drafted) because the admin-user-management PR
merged to `main` first and claimed `0.8.0` — this branch was rebased on top of it and renumbered
rather than colliding, same as `0.7.0` before it.

Adds a Glossary: a new content-library collection for rules terms and phrases ("Condition",
"Kin", "Rapport", ...), and an automatic inline-linking mechanism that turns any occurrence of a
glossary term inside authored sheet text into a tap-to-reveal definition — requested by the repo
owner so player-facing move/skill/ability text (e.g. Offer Solace's "mark a Condition") links to
its definition without hand-annotating every field, and keeps linking automatically as the
glossary is filled out.

- **`GlossaryTerm`** (`packages/shared/src/types.ts`): `{ Id, Name, Aliases, Definition }`, added
  as `Library.glossary` and a new `LibraryCollectionKey`. Deliberately its own collection rather
  than reusing `Description`-shaped fields on existing entities — general mechanics referenced in
  prose ("Condition", "Kin", "Hold") often have no matching entity at all (`conditions` holds five
  specific per-Virtue Conditions, not the mechanic itself). Full admin CRUD comes for free from
  the existing schema-driven admin panel (`packages/shared/src/schema.ts`'s `collections`); seeded
  with eight starting terms.
- **The linking engine** (`packages/shared/src/glossary.ts`, unit-tested in `glossary.test.ts`):
  `buildGlossaryMatcher` compiles every term's Name/Aliases into one longest-match-first,
  word-bounded regex; `linkifyText` splits a string into plain/matched segments. Matching is
  case-sensitive on purpose — this game's rules text always capitalizes its proper nouns ("mark a
  Condition," never "mark a condition") — so it links the real mechanic without also catching
  ordinary English words that happen to share a term's spelling ("the road was in poor
  condition..."). Capped at one level of recursion into a term's own Definition, so a definition
  that itself uses jargon still helps without one tap ever spiraling into more than one nested
  bubble; a term never links to itself inside its own Definition.
- **`GlossaryText`** (`apps/web/src/components/GlossaryText.tsx`) renders a matched term as a
  `<span role="button">`, not a `<button>` — deliberately: sentences routinely carry two or three
  terms close together (Offer Solace's "mark Potential, clear a Condition, or shift a Status"),
  and this app's `responsive-smoke.mjs` 44×44 touch-target rule would force adjacent inline links
  to overlap each other if satisfied literally, the exact failure `.tap-inline` (`layout.css`) was
  built to avoid for chip rows. Inline text targets are WCAG's own documented exception to minimum
  target size (2.5.8) for the same reason. Extracted the tap-to-reveal-and-dismiss behavior
  `InfoTooltip` already had into a shared `useTapReveal` hook (`apps/web/src/lib/useTapReveal.ts`)
  rather than duplicating it.
- **Rollout**: every authored description/effect/rules-text field rendered on the sheet now wraps
  its text in `<GlossaryText>` — Moves (description, tier text, options), Abilities, Skills,
  Armor Types, Items, Themes, Quests, Virtue Essence/usage text, Condition clear actions,
  Advancement effects, and Bond move text, plus the Theme preview on the new character-creation
  screen.
- **Note for any environment with a live Supabase project seeded before this version**: the
  `library` singleton row won't have a `glossary` key until it's re-seeded or re-imported —
  `useGlossaryMatcher` defaults a missing `glossary` to empty rather than crashing, so this fails
  soft (no links render) rather than breaking the sheet.

## [0.8.0] — 2026-08-04T04:32:12Z

Second of the four-PR campaign-management batch (see `0.7.0`) — admin user account management
and admin-only deletion of Campaigns/Character Sheets.

- **Admin user management** (`apps/web/src/features/admin/UsersView.tsx`, new Admin nav group
  "Accounts"). Lists every account, joining Supabase Auth's identity (email, last sign-in) with
  `profiles` (display name, content-admin flag) — neither table alone has the full picture
  (`listAuthUsers()` in `apps/server/src/repo.ts`). **No way to set or type a password here** —
  "Reset password" (`POST /api/admin/users/:id/reset-password`) generates a one-time Supabase Auth
  recovery link (`generatePasswordResetLink()`) that the admin copies and relays to the account
  holder out of band; there's no outbound email configured for this app to send it automatically.
- **Admin delete: Campaigns & Character Sheets** (new Admin nav group "Play Data"). `DELETE
  /api/campaigns/:id` and `DELETE /api/campaigns/:campaignId/characters/:id`, both gated by the
  existing `requireAdmin` middleware — distinct from a GM's own self-service actions, a GM cannot
  delete their own campaign through these routes. Both rely on the FK cascades already in place
  (`supabase/migrations/0001_init.sql`): deleting a campaign cascades every character, sheet,
  membership, party, Bond, and invite in it; deleting a character cascades its sheet and any
  Bonds it's part of, while the owning membership survives with `CharacterId` set back to null.
  Both list views (`apps/server/src/routes/admin.ts`'s `GET /campaigns`/`GET /characters`) are
  read-only aggregates across every campaign, joined with GM name / member count / campaign name
  respectively — the delete actions themselves live on `campaign.ts`/`characters.ts`, alongside
  the rest of each resource's routes.
- **Tests**: vitest coverage for every new/changed route's admin-only gating and join logic
  (`admin.test.ts`, `campaign.test.ts` — new, covers only the added delete route — and the
  extended `characters.test.ts`).

## [0.7.0] — 2026-08-04T03:58:14Z

First of a four-PR batch of campaign-management features requested by the repo owner (user
account admin, invite join flow, Bond pending badges, player-authored Kin reasons, campaign
archive, admin delete) — this PR covers the invite join flow, the app's first character-creation
screen, and a second demo campaign ("Seelie") that exercises both end to end.

- **Invite accept/decline/redeem-by-code.** Previously an invite could only be sent or revoked by
  the GM (`apps/server/src/routes/campaign.ts`) — there was no way for the invited player to see,
  accept, or decline it, and no join-by-code flow at all. Added:
  - A `'Declined'` `InviteStatus` (migration `0007_invite_declined_status.sql`), distinct from a
    GM's `'Revoked'`.
  - `GET /api/invites/mine`, `POST /api/invites/:id/redeem`, `POST /api/invites/redeem-by-code`,
    `POST /api/invites/:id/decline` (`apps/server/src/routes/invites.ts`), all gated by a shared
    `assertInviteActionable` check (`packages/shared/src/logic.ts`) — an invite must still be
    Pending and addressed to the acting user's own email, case-insensitively.
  - A "Pending invites" + "Join a campaign" panel on the home page
    (`apps/web/src/features/invites/InviteInbox.tsx`).
- **Character creation** (`apps/web/src/pages/CreateCharacterPage.tsx`, `POST
  /api/campaigns/:id/characters`) — the one screen in the app that creates a fresh `Character` +
  `CharacterSheet`, reached when a Player membership has no `CharacterId` yet. Deliberately
  narrow: name, assign the standard Virtue array (`2, 1, 0, 0, -1`, validated server-side by
  `isStandardVirtueArray`), pick a starting Theme. See
  `README.md#architecture-notes--judgment-calls` item 2 for why this didn't exist before and how
  narrowly it's scoped now.
- **Seed data**: a second demo campaign, "Seelie" (`packages/shared/src/seedPlay.ts`'s
  `seedSeelieCampaign`/`seedSeelieMemberships`/`seedSeelieInvites`), with ryan as GM and a Pending
  invite to mike — landing mike on the pending-invite and character-creation flow on first login,
  unlike "The Long Road South," which is fully populated from the start.
- **Tests**: added `vitest` to the monorepo (none existed before — see CLAUDE.md's Commands
  section) with unit coverage for the new pure logic (`isStandardVirtueArray`,
  `assertInviteActionable`) and route-level authorization (`invites.test.ts`,
  `characters.test.ts`, mocking `repo.js`). Extended the Playwright responsive smoke test with the
  new home-with-pending-invite and character-creation screens.

## [0.6.0] — 2026-08-04T03:30:00Z

Fixes a misclassification flagged by the repo owner: Kin wasn't being treated as an Advancement
track at all, even though `Planning Docs/.../Advancements.md` frames Potential/Kin/Rapport as the
three parallel Advancement categories (Personal/Social/Party) and describes Forging a Bond as
picking from "the list of Bond Moves available to your Bond Level" — the same shape as
Potential/Rapport's tiered advancement-list pattern, just scoped to a Bond pair instead of one
character or the whole party. See `README.md#architecture-notes--judgment-calls` item 8 for the
full writeup, and `HANDOFF.md` for the confirmation this closes out.

- `packages/shared/src/types.ts`: `AdvancementTrack` now includes `'Kin'` (was `'Potential' |
  'Rapport'` only), plus a new `ADVANCEMENT_TRACK_SCOPE` lookup documenting what each track is
  scoped to (Character / Bond / Party).
- **Content Admin**: the Advancements nav group gained a third **Kin** entry (alongside
  Potential/Rapport), rendering a new `KinAdvancementView` that explains Kin is played out live
  through the Bond handshake rather than authored library content, and surfaces the
  `KinTrackLength` setting for reference. Confirmed with the repo owner that Forging a Bond should
  stay the freeform "write it together" move rather than becoming a pick from library content, so
  `schema.ts`'s `advancements` collection Track enum is unchanged (still `Potential`/`Rapport`
  only) and `AdvancementPicker.tsx`'s Forge flow is unchanged — this is a classification and
  navigation fix, not a new mechanic. The nav entry gives Kin a permanent home for whatever
  Kin-specific content or rules land later.

## [0.5.1] — 2026-08-04T01:18:55Z

Bug fix, prompted by the repo owner's own testing: the GM live-peek view (Campaign Shell) would
sometimes fail to reflect a player marking a Condition (or any other sheet change) until some
later, unrelated write to that same sheet went through — the change was always saved correctly,
it just didn't show up live.

- **Root cause**: `character_sheets`' RLS SELECT policy ("owner or gm can view sheet") was the one
  Realtime-subscribed table whose policy still did an inline join out to `characters`
  (`exists (select ... from characters c where c.id = character_sheets.character_id ...)`), left
  over from before migration `0005` added a `campaign_id` column directly to `character_sheets`.
  `0005` updated the Realtime subscription *filter* (`useLiveCampaign.ts`) to use the new column,
  but never updated this SELECT policy to match — it kept the join. `party`/`bonds`, whose
  policies were always a single joinless `private.is_campaign_member(campaign_id, uid)` call, never
  had this problem. Realtime's `postgres_changes` authorization check does not reliably evaluate an
  RLS policy that joins out to another table, so the GM's live-peek subscription could silently
  miss a `character_sheets` change; the next `GET /bootstrap` — triggered by literally any other
  Realtime event — would always pick up the true (already-saved) state, which is exactly the
  "shows up on the next change" symptom reported.
- **Fix**: migration `0006_sheet_realtime_rls.sql` adds `private.can_view_sheet(campaign_id,
  character_id, user_id)`, a joinless SECURITY DEFINER function in the same shape as
  `is_campaign_member`/`is_gm`, and repoints the `character_sheets` SELECT policy at it. Applied
  directly to the live Supabase project and confirmed against `pg_policy` that the new policy body
  is join-free; the security advisor shows no new findings. See `CLAUDE.md`'s Realtime section for
  the general rule this establishes (SELECT policies backing a Realtime subscription must be
  joinless, not just the subscription filter).
- Investigated `HANDOFF.md` item 10 (inconsistent on-click behavior, Statuses specifically) at the
  same time, since it was flagged as a plausible contributor to "latency with live updates." Built
  a Playwright repro against `harness.html` driving real touch `tap()` events (not synthetic
  `.click()`) at the Virtues Condition toggle and at a Status's rename-input-then-Pip sequence
  (the specific "onBlur races onClick" scenario item 10 called out) — every case produced exactly
  one state change per physical tap, with no double-fire or missed-tap behavior reproduced. Not
  fixed here because nothing reproduced to fix; still needs the repo owner to reproduce and
  describe (device/browser, single vs. double tap) if it recurs — see `HANDOFF.md` item 10.

## [0.5.0] — 2026-08-04T00:03:43Z

First round of post-audit UX/product feedback, across all three surfaces:

- **Character Sheet**
  - Virtue scores are now read-only on the sheet — the `VirtuesPanel` +/- steppers are gone.
    Raising a Virtue only happens by taking the "Raise a Virtue by 1" Potential Advancement, which
    now actually applies (previously it just recorded that you'd taken it and left `sheet.Virtues`
    untouched — the player had to separately use the stepper, with nothing stopping them from
    stepping up a Virtue without ever taking the Advancement).
  - Theme is likewise locked — no more free `<select>`. Changing Theme only happens by taking the
    "Change your Theme" Advancement, which now opens a Theme picker and preserves completed Quests
    (previously the free-editing dropdown wiped `AcceptedQuests` entirely, contradicting the
    Advancement's own text).
  - Spending a Kin is now unilateral: it applies immediately with no handshake, while Mark Kin and
    Forge Bond still require the other player's Accept. See "Judgment calls" below.
  - Load & Item Charges: each item is now individually collapsible (plus a "Collapse/Expand all
    items" toggle), and the list sorts carried items first, alphabetically within each group.
  - Any button on the sheet that bulk-resets state — Make Camp, Refresh all Armor, Import JSON —
    now confirms first via a new shared `ConfirmModal` component.
  - The sheet's Kin & Bonds box can now Accept/Decline an incoming proposal or Withdraw an
    outgoing one directly — previously it only showed "answer it in the Campaign view."
  - The Moves drawer gained a Virtue filter row and groups moves by Virtue in collapsible sections
    (was a flat, search-only list).
  - Conditions got an explicit checkbox glyph on the tap target — it was a plain uppercase pill
    with no visual cue that it was clickable.
  - New `InfoTooltip` component surfaces description text that was already in the data model but
    never rendered: a Virtue's Essence and "use it when..." text, and an Armor Type's Description.
- **Campaign Shell**
  - The home screen can now create a new campaign (`POST /api/campaigns`, previously only wired
    up for the dev seed script) — a name field and a button, landing GM-side in the new campaign.
  - The GM's party roster is a capped 2-column grid above the tablet breakpoint instead of
    flex-wrap with a fixed 330px basis, which packed a 4-person party as 3-then-1; an odd leftover
    card centers instead of stretching full-width.
- **Content Admin**
  - Reorganized the nav from "Game objects" / "Tools" into **Core** (Abilities, Armor Types,
    Conditions, Items, Moves, Skills, Virtues), **Narrative** (Quests, Themes), **Advancements**
    (Potential, Rapport), and **Tools** (History, Import / export, Settings, Validation) — each
    group alphabetical. Advancements are still one `advancements` collection under the hood, split
    into two nav entries by `Track`; see "Judgment calls" below.
- **Navbar**: "ASoHaV" is now "A Story of Heroes and Villains" at tablet width and up. Below that
  it stays "ASoHaV" — the full name doesn't fit the phone-width budget documented in `layout.css`
  (the same constraint the "Content Admin"/"Admin" label swap already works around).
- Filed, not fixed: reported inconsistent on-click behavior on Statuses (and possibly other tap
  targets) — see `HANDOFF.md` item 10.

### Judgment calls

- **Spending Kin no longer goes through the Bond handshake.** `README.md`'s architecture notes
  (judgment call 1) previously treated Mark Kin, Spend Kin, and Forge Bond identically — every
  Bond change was a propose/accept/reject handshake, justified purely as a data-integrity measure
  ("two people can write one record"). The game's own rules text (`Planning Docs/.../Advancements.md`)
  draws a real distinction the software design didn't: "either PC on the Bond Track can spend Kin,"
  versus Forging, which needs both to agree. `SpendKin` now applies immediately
  (`applySpendKin()` in `packages/shared/src/logic.ts`, called directly from the `/propose` route
  in `apps/server/src/routes/bond.ts` rather than going through `PendingChange`) and is logged to
  `Bond.History` with a new `'spent'` action. Mark Kin and Forge Bond are unchanged. The row lock
  (`withBondLock`) still serializes concurrent writes to the same Bond, so this doesn't reopen the
  original race-condition concern — it just removes the *approval* requirement for this one action.
- **Admin nav grouping is presentation-only.** `packages/shared/src/schema.ts`'s `collections`
  array (and its order) is untouched — `DataView`'s library-contents summary and anything else
  that iterates it still sees the original dependency-ordered list. The Core/Narrative grouping and
  alphabetization live entirely in `AdminNav.tsx`.
- **Skills and Abilities went under Core**, and **Advancements split into Potential/Rapport only**
  (no separate "Kin" nav item — there's no Kin library content to administer; `KinTrackLength`
  stays where it already was, under Tools → Settings). The feedback that requested this reorg
  didn't place Skills/Abilities or say what to do about Kin explicitly; these were flagged back to
  the repo owner as open questions, but implemented with the choices above (rather than blocking)
  when the session was told to keep moving — worth a quick confirm that this is what was wanted.

## [0.4.2] — 2026-08-03T21:00:00Z

- CSS Modules follow-up cleanup pass, in four parts (no visual changes intended except where
  noted):
  - `AboutModal`'s header padding now matches the shared `modal.module.css` `.head` (`20px 24px
    12px`) instead of its own `24px 24px 4px` override — the inconsistency flagged in `HANDOFF.md`
    item 8.
  - Consolidated 30 of the 36 hardcoded `rgba(42, 32, 26, …)` ink-opacity literals across
    `apps/web/src` into `--ink-*` tokens: seven new stops added to `tokens.css` (`--ink-75` through
    `--ink-50`) for values that repeated 2+ times, plus two exact matches of pre-existing tokens
    fixed in place. The remaining 6 are genuine one-off decorative values (texture gradients, a
    couple of single-use tints) and were left as literals rather than forced into tokens they don't
    share with anything. `LoginPage.module.css`'s stray `background: #fff` (the only hex color
    outside `tokens.css`) now reads `var(--panel)`, matching the app's parchment palette instead of
    pure white.
  - Added the missing 44px coarse-pointer touch-target sizing to four interactive elements that had
    fallen through the responsive audit: `AdminListPane`'s clickable record row, `FieldEditor`'s
    multiref chip buttons, `LoadPanel`'s load-tier selector, and `adminShared`'s `.primaryButton`
    (used by both the admin export and settings-save buttons).
  - Extracted the CSS that was byte-identical across multiple components into two new shared
    stylesheets, composed in via CSS Modules `composes: ... from`: `apps/web/src/styles/buttons.module.css`
    (the solid dark "primary action" button treatment, used by 10 components) and a `.backLink`
    class added to `apps/web/src/features/admin/adminShared.module.css` (the admin back-navigation
    link, previously duplicated verbatim between `AdminPanelPage` and `AdminListPane`). Only
    properties that matched exactly across every consumer were extracted — near-duplicates that
    differed in font-size, letter-spacing, or color (an "eyebrow" uppercase label pattern used 40+
    times, an outlined "ghost" button pattern, and a card/panel wrapper pattern) were deliberately
    left alone; audited and found to encode real per-context variation rather than copy-paste drift,
    so unifying them would be a type-scale/design decision, not a mechanical dedup.

## [0.4.1] — 2026-08-03T19:23:10Z

- Fixed the seeded demo campaign (`cm-1`) crashing the Campaign page on load. `apps/server/src/seed.ts`
  inserted `memberships` before `characters`, but player memberships reference a `CharacterId` that
  doesn't exist yet at that point in the loop, tripping the `memberships_character_id_fkey`
  constraint and aborting the seed run right after the GM's own membership — characters, sheets,
  party, and bonds never got written. `apps/server/src/routes/campaign.ts` then force-cast the
  resulting `null` party with `party!` and shipped it to the client, which crashed reading
  `boot.party.Rapport` unguarded. This was the issue tracked as unresolved in `HANDOFF.md` item 1
  ("loading error" after login). Characters now insert before memberships, and `campaign.ts`
  self-heals a missing party row instead of lying about non-null. The live Supabase project's
  partially-seeded `cm-1` campaign was also repaired directly.

## [0.4.0] — 2026-08-03T17:51:25Z

- Full responsive audit and fixes across the Character Sheet, Campaign Shell, and Content Admin:
  44px touch targets everywhere without changing the design's visual density, a deliberate
  768px/1024px breakpoint set (replacing accidental ones that fell out of flex-wrap arithmetic),
  collapsible sheet panels with persisted state, and a nav → list → detail drill-down for Content
  Admin below 1024px. Added `apps/web/harness.html` (renders the real app against seed fixtures,
  no server) and a `test:responsive` check wired into CI so this can't silently regress.
- Fixed an app-bar bug the new check caught on `main` before this release: at 360px the bar wrapped
  onto two lines, and the brand's and Sign out's touch targets overlapped by 7px — a tap near the
  logo could sign a player out.
- Migrated the entire UI from inline `style={{...}}` objects to CSS Modules in cascade layers
  (`tokens → base → components → utilities`), removing every `!important` from the shared
  stylesheet in the process — all fourteen existed only to out-rank inline styles that no longer
  exist. Along the way: non-primary sheet panels regained a top border they'd silently lost to a
  React quirk (`borderTop: undefined` clears the property rather than no-op'ing), and the
  sign-in screen — never previously covered by the responsive check — turned out to overflow its
  viewport at 360px and had two sub-44px inputs; both fixed.
- The About modal's release date is now a full timestamp rather than a bare date (this entry).

## [0.3.0] — 2026-08-02

- Bond handshake (`propose`/`accept`/`reject`) now takes a real Postgres row lock
  (`SELECT ... FOR UPDATE` in a transaction via a direct `pg` connection) instead of a
  check-then-write through `supabase-js`/PostgREST, closing a race where two concurrent requests
  against the same Bond could silently clobber each other.
- Real-time transport switched to Supabase Realtime; the hand-rolled server-side WebSocket layer
  is retired entirely. `character_sheets` gained a `campaign_id` column
  (`supabase/migrations/0005_sheet_campaign_id.sql`) so Realtime's equality-only filters can scope
  it by campaign.
- Added Render deployment config (`render.yaml`): a single Web Service (the server already serves
  the built client from the same origin, so no separate static site is needed), plus a build-step
  fix (`NPM_CONFIG_PRODUCTION=false`) for `NODE_ENV=production` silently stripping devDependencies
  npm needs to compile the server's TypeScript.
- `packages/shared` was still at `0.1.0` (missed in the 0.2.0 bump below, despite carrying real
  changes since) — synchronized to `0.3.0` along with the other three packages here.

## [0.2.0] — 2026-08-02

- Migrated auth from a hand-rolled scrypt+cookie system to Supabase Auth (`supabase-js` on the
  client; the Express server verifies the resulting JWT and still enforces all authorization
  itself).
- Migrated the data layer from `node:sqlite` to Postgres via Supabase (`repo.ts` rewritten against
  `supabase-js`, service-role client).
- WebSocket auth moved from a session cookie to a `?token=` query param, with message buffering for
  the now-async auth handshake.
- Seeding rewritten to create the five dev accounts through the Supabase Auth admin API.

## [0.1.0] — 2026-08-02

- Initial build: player Character Sheet, Content Admin panel, and Campaign Shell (roster, invites,
  GM live-peek, Bond handshake), against a `node:sqlite` + hand-rolled cookie-auth backend.
