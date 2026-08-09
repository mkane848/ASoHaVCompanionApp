# Handoff

Status snapshot and open threads for whoever (human or Claude) picks this project up next. If
you're starting new work here, read this first — especially "Open issues" below, so you don't
duplicate a fix or lose track of something already in flight.

Last updated: 2026-08-03, end of the session that took the app from `0.3.0` to `0.4.0`: a full
responsive-UI audit and fix pass, then a follow-on migration of the entire UI from inline styles
to CSS Modules. See [CHANGELOG.md](CHANGELOG.md) for the version-by-version detail and
[README.md](README.md#architecture-notes--judgment-calls) for design decisions and rationale.

A follow-up session the same day added [CLAUDE.md](CLAUDE.md), no other changes — codebase
architecture and conventions written down for future Claude Code sessions to load automatically.
No version bump for this; it's documentation-only.

A third session the same day (`0.4.2`) did a CSS Modules follow-up cleanup pass, requested
explicitly to settle the styling foundation before the next round of work moves on to cosmetic/UX
feedback (colors, tooltips, controls). See `CHANGELOG.md` 0.4.2 for the full list. In short: fixed
the `AboutModal` padding inconsistency (item 8 below, now resolved), consolidated most of the
hardcoded ink-opacity `rgba()` literals into `--ink-*` tokens, added the 44px touch target to four
elements the responsive audit had missed, and extracted two small shared stylesheets
(`styles/buttons.module.css`, `adminShared.module.css`'s new `.backLink`) for CSS that was
byte-identical across components. Deliberately did *not* try to unify the "eyebrow" uppercase-label
pattern (40+ near-duplicate instances), the outlined "ghost" button, or the card/panel wrapper —
audited each and found real per-context variation in font-size/letter-spacing/color, not copy-paste
drift, so collapsing them would be a type-scale decision, not a mechanical dedup. Worth revisiting
deliberately if/when a formal type scale comes up during the upcoming UX pass.

A fourth session (2026-08-04, `0.5.0`) implemented the first round of post-audit UX/product
feedback — the "cosmetic/UX feedback (colors, tooltips, controls)" flagged as upcoming above. See
`CHANGELOG.md` 0.5.0 for the full list (Virtue/Theme locking tied to Advancements, unilateral Spend
Kin, collapsible/sorted Load items, confirmation modals on destructive sheet buttons, Bond
accept/reject from the sheet, a Moves Virtue filter with collapsible grouping, a checkbox affordance
on Conditions, new Virtue/Armor-Type tooltips, a Create Campaign flow, an evenly-spread GM party
grid, the Admin nav reorg into Core/Narrative/Advancements/Tools, and the navbar's full game-title
text above tablet width) and `README.md#architecture-notes--judgment-calls` items 7 for the Spend
Kin rationale. Two feedback items from that pass are explicitly **not** done yet:
- Item 10 below (inconsistent on-click behavior on Statuses) — investigation deferred on purpose.
- The Admin nav's exact grouping of Skills/Abilities and whether Advancements needed a "Kin" entry
  weren't specified by the feedback; implemented with a stated best guess (see `CHANGELOG.md`
  0.5.0's "Judgment calls") rather than left half-done, but worth a quick confirm from the repo
  owner that the guess landed right.

A fifth session (2026-08-04, `0.5.1`) tracked down the repo owner's report of "latency with live
updates when marking a Condition" plus fresh testing that found the GM live-peek view sometimes
missing a marked Condition until a later, unrelated sheet change. Root-caused as a single bug:
`character_sheets`' RLS SELECT policy was the one Realtime-subscribed table whose policy still did
an inline join out to `characters` (left over from before `0005` added `campaign_id` directly to
the row — `0005` fixed the Realtime *filter* but never updated this policy to match), and
Realtime's `postgres_changes` authorization check doesn't reliably evaluate a joined policy. Fixed
in migration `0006_sheet_realtime_rls.sql` (applied directly to the live Supabase project via the
Supabase MCP tool and confirmed via `pg_policy`) — see `CHANGELOG.md` 0.5.1 for the full writeup
and `CLAUDE.md`'s Realtime section for the general rule this establishes. Also investigated item 10
below (inconsistent on-click behavior) as a possible second contributor: built a Playwright repro
against `harness.html` using real touch `tap()` events at the specific scenarios item 10 flagged
(Condition toggle, Status rename-input racing a sibling Pip click) and found no double-fire or
missed-tap in any case — so item 10 stays open and unconfirmed, not folded into this fix.

A sixth session (2026-08-04, `0.6.0`) closes out the open question from the fourth session's note
above ("whether Advancements needed a 'Kin' entry ... worth a quick confirm from the repo owner").
The repo owner raised it themselves: Kin wasn't being classified as an Advancement track at all,
and `Planning Docs/.../Advancements.md` backs that up — confirmed with the repo owner and fixed.
See `README.md#architecture-notes--judgment-calls` item 8 and `CHANGELOG.md` 0.6.0 for the detail.
Short version: `AdvancementTrack` now includes `'Kin'`, and Content Admin's Advancements nav group
has a third **Kin** entry explaining it's handled live through the Bond handshake rather than
authored content. Forging a Bond deliberately stays freeform (confirmed with the repo owner, not
changed to a library-content pick) — this was a classification/nav fix, not a new mechanic.

A seventh session (2026-08-04, `0.7.0`) is the first of a four-PR batch of campaign-management
features requested by the repo owner: user account admin, an invite join flow + character
creation, Bond pending-confirmation badges + player-authored Kin reasons, and campaign
archive/admin-delete, each its own PR held for approval before the next starts. This PR is the
invite join flow, character creation, and the "Seelie" seed campaign — see `CHANGELOG.md` 0.7.0
for the full list and `README.md#architecture-notes--judgment-calls` item 2 for the
character-creation scoping rationale. Also added `vitest` to the monorepo for the first time (see
`CLAUDE.md`'s Commands section) — CI now has four jobs (`build`, `typecheck`, `test`,
`responsive`) instead of three. Landed as `0.7.0` rather than `0.6.0` (as originally drafted)
because the sixth session's Kin-Advancement-track PR merged to `main` first and claimed `0.6.0` —
this branch was rebased on top of it and renumbered rather than colliding. **Not yet applied to
the live Supabase project**: migration `0007_invite_declined_status.sql` is committed but unrun
against the live database — same sandbox networking constraint as always (see "Sandbox network
constraints" below), so it needs to be applied (directly via the Supabase MCP tool, or via the
Supabase dashboard) before this reaches production, the same way `0006` was in the fifth session.

An eighth session (2026-08-04, `0.8.0`) is the second of the four-PR campaign-management batch
(see the seventh session above): admin user account management and admin-only deletion of
Campaigns/Character Sheets, both new "Accounts"/"Play Data" groups in the Content Admin nav. Users
are listed by joining Supabase Auth's identity with `profiles`; password reset generates a
one-time recovery link for the admin to relay (no outbound email is configured for this app, so it
can't send it itself), never a settable password field. Campaign/character delete rely on the FK
cascades already in `supabase/migrations/0001_init.sql` — no new migration needed this session.
See `CHANGELOG.md` 0.8.0 for the full list.

A ninth session (2026-08-04, `0.9.0` — renumbered from a `0.8.0` draft that collided with the
eighth session's PR merging first, same as the seventh session's renumbering before it) adds the
Glossary feature requested by the repo owner: tap-to-reveal inline definitions for rules
terms/phrases, auto-linked into authored sheet text (move/skill/ability descriptions, etc.) as the
glossary is filled out, rather than hand-annotated per field. New `glossary` library collection
(`packages/shared/src/types.ts`, `schema.ts`, seeded with 8 starting terms), a pure matching/
linking engine (`packages/shared/src/glossary.ts`, unit tested), and a `GlossaryText` component
wired into every authored description/effect/rules-text field on the sheet plus the
character-creation Theme preview. See `README.md#architecture-notes--judgment-calls` item 9 for
the full rationale, including why the glossary is its own collection rather than reusing existing
entities' `Description` fields, and why a linked term is a `<span role="button">` rather than a
real `<button>`. No new migration — this is a JSONB-blob field addition (`Library.glossary`), same
pattern as every other library field. **One catch for a live project seeded before this version**:
the `library` singleton row's JSON won't have a `glossary` key until it's re-seeded (Content Admin
→ Import/export → Reset to seed) or re-imported — `useGlossaryMatcher` defaults a missing
`glossary` to `[]` rather than crashing, so this fails soft (no links render, nothing else breaks)
rather than needing a migration before deploy, but the live Render/Supabase project won't actually
show any glossary links until that reseed happens.

A tenth session (2026-08-04, `0.10.0` — renumbered from a `0.9.0` draft that collided with the
ninth session's Glossary PR merging first, same pattern again) is the third of the four-PR
campaign-management batch: a pending-confirmation Bond badge (next to the sheet's Advancement
panel header, visible even collapsed, and the Campaign Shell's Bonds heading — backed by a new
pure `pendingBondCountFor()` in `packages/shared`), and a player-authored reason for Mark Kin
proposals (a new `MarkKinModal`, replacing the hardcoded `'Something between us changed.'` note)
in both `CampaignBonds.tsx` and `AdvancementPanel.tsx`. Spend Kin and Forge Bond's canned notes
are untouched. No new migration. See `CHANGELOG.md` 0.10.0.

An eleventh session (2026-08-04, `0.10.1`) closes a gap the tenth session exposed in the ninth's
Glossary feature: `CampaignBonds.tsx` never got glossary wiring at all (an oversight in the
original `0.9.0` rollout, which only touched `apps/web/src/features/sheet/*`, missing this
Campaign Shell duplicate of Bond move-text rendering), and the pending-proposal/history `Note`
text in both `CampaignBonds.tsx` and `AdvancementPanel.tsx` was never linked — no practical gap
while Mark Kin's note was the tenth session's old hardcoded string, but a real one now that it's
freeform player prose. See `CHANGELOG.md` 0.10.1. Patch bump, not minor — this completes an
already-shipped feature's rollout rather than adding new capability.

A twelfth session (2026-08-04, `0.11.0` — renumbered from a `0.10.0` draft that collided with the
eleventh session's PR merging first mid-session, same renumbering pattern as every PR in this
batch) is the fourth and last of the four-PR campaign-management batch: a GM can now archive
their own campaign (`Campaign.Status`, migration `0008`), which both labels it "Archived"
wherever it's shown (HomePage, Campaign Shell banner, Character Sheet header) and freezes further
play-state mutations — invites, Bond propose/accept/reject, sheet/party edits, character
creation, and joining via invite redemption — via a new `assertCampaignActive()` check called
from every one of those routes. Declining an invite still works even when the target campaign is
archived, since it doesn't commit anything new. `CampaignBonds.tsx` and `AdvancementPanel.tsx`
hide their Bond action buttons when archived rather than leaving them to fail against the
server's `409`; other sheet fields stay editable in the UI and rely on the server-side freeze
alone (consistent with how little error feedback a failed sheet save already surfaces elsewhere
in this app — see `CHANGELOG.md` 0.11.0 for the full writeup of that scoping call). This session
also had to merge past the eleventh session's PR landing mid-session, in `CampaignBonds.tsx`
specifically (both PRs touched the same pending-proposal note block; resolved by keeping both the
archived-gating and the `GlossaryText` wrapping together).

A thirteenth session (2026-08-04, no version bump — live-ops only, no code changed) closed out
the batch's live-database gaps, using the Supabase MCP tool (which reaches the live project
regardless of this sandbox's usual network restrictions, per item 5 below):

- Applied migrations `0007_invite_declined_status` and `0008_campaign_status` to the live
  project — both were committed since the seventh/twelfth sessions but never run live. Verified
  the resulting `invites_status_check`/`campaigns_status_check` constraints match the migration
  files exactly, and re-ran the security advisor (one pre-existing, unrelated `WARN` — leaked
  password protection disabled — nothing new from either migration).
- Found and fixed a real gap: the "Seelie" seed campaign and mike@asohav.dev's pending invite
  (added in the seventh session) were never actually inserted live, because `runSeedIfEmpty()`
  only seeds a database with an empty `profiles` table, and this project's `profiles` was already
  populated (with an older account set, missing `rob`/`dave`/`tyler` — seeded before those were
  added to `seed.ts`) before the Seelie code existed. The live project instead had a second,
  *real* campaign called "Seele" (note: not "Seelie") that mike@asohav.dev created himself via
  the app's own Create Campaign flow, plus a real personal account (`danajedz@gmail.com`, "Dana
  Kane") — neither of which are seed data. With the repo owner's confirmation, manually inserted
  the missing rows (`cm-2` "Seelie", GM membership for ryan, a `Pending` invite to
  mike@asohav.dev, and a `party` row) via direct SQL, matching
  `seedSeelieCampaign()`/`seedSeelieMemberships()`/`seedSeelieInvites()` exactly — verified after
  insert. The pre-existing "Seele" campaign and Dana's account were left untouched.
- Still not done, and still blocked by this sandbox's lack of raw browser/HTTP access to the live
  Render URL (see item 5): actually clicking through the invite-accept → character-creation flow
  as mike@asohav.dev in a real browser. The data is in place for whoever does that next.

A fourteenth session (2026-08-05, `0.12.0`) implemented the campaign-setup workflow requested by
the repo owner: GM-controlled campaign phases (Signup → Party Creation → Playing) and a much
fuller character-creation flow. See `CHANGELOG.md` 0.12.0 for the full list and
`README.md#architecture-notes--judgment-calls` items 10-12 for the design decisions (Phase as a
separate field from Status, manual "Start playing" confirmation, background-connection confirm/deny
deferred). Flagged here explicitly so it isn't lost:

- **Not built yet, on purpose**: the pairwise "confirm/deny" flow for character background
  connections the outline asked for. The Bond propose/accept/reject pattern
  (`packages/shared/src/logic.ts`, `withBondLock` in `apps/server/src/repo.ts`) is a close
  template, but it needs its own record type and row-lock helper rather than reusing `Bond`
  itself — real scope for a follow-up session, not an oversight. The character-creation screen
  ships a static "Rapport & Kin" placeholder card in the meantime.
- **Migration `0009_campaign_phase.sql` has not been applied to the live Supabase project.** Same
  sandbox network constraint as always (no raw `pg` connection) — this session couldn't run it
  live even via the Supabase MCP tool being unavailable here; check whether a future session with
  that tool applies it before assuming the live database has the `phase`/`ready` columns. Until
  it's applied, the live app's campaigns/memberships don't have these columns at all — the code
  requires them (no defensive fallback for a missing column, only a missing *value* on an
  in-memory object), so **don't deploy `0.12.0` to Render before this migration runs live**.
- The invite-send route (`POST /api/campaigns/:id/invites`) was deliberately **not** gated to the
  Signup phase — see README item 10's neighboring reasoning: gating it would have retroactively
  blocked existing campaigns (which default to `Phase: 'PartyCreation'`, not `'Signup'`) from
  inviting new players at all, a real regression. Closing signup only changes what the *client*
  shows the GM (the phase button, the chargen route's gate) — the invite API itself stays open at
  any phase except Archived, same as before this session.
- No live QA of the new chargen screen or phase controls in a real browser — same sandbox
  constraint as the thirteenth session; worth a pass once Render access is available.
- `npm run test:responsive -w @asohav/web` (with `CHROMIUM_PATH=/opt/pw-browsers/chromium`) is
  **green — all 50 route/viewport combinations, including the new "create character" route at
  every breakpoint.** It ran slowly the first time (10+ minutes, likely `harness.html`'s Google
  Fonts `preconnect` links hitting this sandbox's HTTPS allowlist) and was killed and re-run
  rather than trusted as hung; the second run finished cleanly in a few minutes. Confirms the new
  chargen controls (Virtue picker, Looks add/remove, Quest/Skill/Ability checkboxes) — built as
  real `<button>` elements with genuine `min-width`/`min-height: 44px` rather than native
  `<input type="checkbox"/"radio">` (this app has never used those; see `VirtuesPanel.tsx`'s
  Condition toggle for the precedent followed) — pass the touch-target and overlap checks.

A fifteenth session (2026-08-08, `0.12.1`) root-caused and fixed a production crash loop, found
while investigating a repo-owner report that accepting a campaign invite (both the Accept button
and "join by code") produced no error, just a hanging load, on the live Render deployment. Traced
via Render deploy logs the repo owner pasted in (crash dated `2026-08-05`, right after `0.12.0`
shipped) plus a full read of the invite-accept code path:

- **Immediate trigger**: `0.12.0` shipped with migration `0009_campaign_phase.sql` committed but
  **not applied to the live Supabase project** (flagged as a blocker in the fourteenth session's
  note below, but `0.12.0` reached Render anyway before it was run). `insertMembership()` and
  `insertCampaign()` in `apps/server/src/repo.ts` unconditionally write the `ready`/`phase`
  columns that migration adds — every call failed with a Postgres "column does not exist" error
  against the live (unmigrated) database. `redeem()` in `apps/server/src/routes/invites.ts` calls
  `insertMembership()` as its last step, so **accepting an invite failed 100% of the time**, not
  intermittently.
- **Why it looked like a silent hang instead of an error**: every route handler in every router
  (`apps/server/src/routes/*.ts`) was a bare `async (req, res) => {...}` with no try/catch, relying
  on Express to route a thrown error to the error-handling middleware. This app runs **Express 4**,
  which — unlike Express 5 — does *not* forward a rejected promise from an async handler to error
  middleware; it becomes an unhandled rejection, and Node's default `--unhandled-rejections=throw`
  crashes the entire process. So the Postgres error above didn't produce a 500 response — it took
  the whole server down mid-request, Render restarted it (~30-45s crash-loop, confirmed in the
  pasted logs), and any request in flight during that window got nothing back. This bug wasn't
  specific to invites: *any* endpoint hitting a Supabase error of any kind (not just the missing
  columns) would have crashed the server the same way.
- **Fix, two layers**:
  1. Applied `0009_campaign_phase.sql` to the live Supabase project via the Supabase MCP tool
     (`list_migrations` now shows all 9 applied) — removes the actual trigger.
  2. Added `apps/server/src/asyncHandler.ts`'s `wrap()` and applied it to all 36 route handlers
     across every router — converts any future thrown/rejected error into `next(err)` instead of a
     process crash, verified with a standalone repro script (unwrapped handler throwing = crash;
     wrapped = clean 500) since there's no live-DB integration test to exercise this path.
  3. Also added client-side resilience regardless of server-side cause: `apps/web/src/lib/api.ts`'s
     `request()` now times out after 20s instead of hanging the fetch promise forever, and
     `apps/web/src/components/Toast.tsx` (new, auto-dismissing error banner) replaced the inline
     error paragraph in `InviteInbox.tsx` — requested explicitly by the repo owner ("consider
     implementing better user-facing errors... as part of this scope of work").
- **Not done**: did not upgrade to Express 5, which handles async-handler rejection forwarding
  natively and would make `wrap()` unnecessary going forward — considered and explicitly deferred
  (discussed with the repo owner) since it has its own breaking changes (route-matching syntax,
  `req.query` mutability) this app has no live-DB integration coverage to catch; worth a deliberate
  follow-up session, not bundled into an urgent crash fix.
- Confirmed clean: `typecheck`, `build`, and all 94 unit tests (`vitest`) pass with the `wrap()`
  change — the existing route tests (which mock `repo.js`) exercise the happy path through each
  wrapped handler unchanged, though none of them specifically assert the unhandled-rejection fix
  itself (covered instead by the standalone repro script above, not committed to the repo).
- Same sandbox network constraint as always: could not click through the live Render app to
  confirm the fix end-to-end (no raw HTTPS to the deployed URL from this environment) — the repo
  owner will need to re-test invite acceptance live.

A sixteenth session (2026-08-08, `0.13.0`) started the actual game engine, requested by the repo
owner from a large, messy working design doc (`Planning Docs/` — 14,000+ lines of rulebook draft,
GM brainstorming, other-game inspiration notes, and at least one wholesale abandoned earlier
exploration). See `README.md#architecture-notes--judgment-calls` items 12-13 and `CLAUDE.md`'s new
"Architecture: the rules engine" section for the full writeup. Short version:

- New `packages/shared/src/engine.ts`: roll-modifier breakdowns (2d6 + Virtue, itemized by
  source — Condition penalty, highest Status, Ability bonuses), the Resist Roll formula, and a
  Status engine (give/heal/opposite-cancel, Subdued trigger at Rank 6). **This app still never
  rolls dice for the player** — confirmed directly with the repo owner as a real product decision,
  not a gap. It shows the modifier breakdown and, once told which tier a roll landed in, applies
  the mechanical result.
- Statuses are now built out as the game's actual damage/HP system (no separate HP stat, matching
  the doc) — Give/Resist/Heal a Status flows on the sheet, Subdued → Scar/Risk Death/Blaze of
  Glory. New `CharacterSheet.Recoveries`/`Scars` fields.
- The doc's "Crumble" mechanic (a renamed exploration of marking a 6th Condition) was folded into
  the already-shipped **Dishonored** name and given an actual defined consequence, rather than
  adding a second name for the same trigger.
- Advancement Tier-unlock thresholds (previously hardcoded 4/7/10) are now `GameSettings` fields,
  editable in Content Admin.
- Combat is **deliberately deferred** to its own future slice — real scope (AP-based turns,
  Gambits, enemy stat blocks, three competing drafts in the doc to reconcile), not something to
  rush into this pass. A `/c/:campaignId/combat` Coming Soon placeholder exists so the Campaign
  Shell's nav stays click-through-able in the meantime. **When Combat gets built, use Combat
  Basics V2.2 from the doc as the baseline** — it's the most recent of the three drafts (only it
  has enemy stat blocks + Toughness) and resolves an open question V1 leaves unanswered (the
  "Defiant Goal" mechanic for a party member with a different Combat Goal).
- **Design questions the doc leaves unresolved in its own text, deliberately not guessed at** —
  flagged here so a future session doesn't have to re-derive them from the source doc:
  - Whether "do harm"/"do magic" need their own Basic Move at all (none currently exists).
  - Whether Armor should be modeled as a Status rather than its current separate mechanic.
  - "Find Your Need" and "Finish a Minion" — stub headers in the doc with no defined mechanic.
  - Whether marking an already-marked Condition should award Potential (the doc flags this
    "(optional??)" in both places it's mentioned).
  - Per-playbook Status Limits (should a "Barbarian" have a higher physical Status cap than a
    "Wizard"?) — moot until Playbooks themselves exist.
- Not done this session: any UI/live-DB QA (same sandbox networking constraint as always — see
  item 5 below), and Skill modifiers still don't exist as a numeric concept (Skills stay narrative
  text only, same as before this session).

A seventeenth session (2026-08-09, `0.14.0`) built the first Combat slice, scoped in a dedicated
conversation with the repo owner before writing any code (see `README.md#architecture-notes--
judgment-calls` item 15 and `CLAUDE.md`'s new "Architecture: Combat" section for the full
writeup). Replaces the `/combat` Coming Soon placeholder from `0.13.0` with a real live Encounter
view.

- **New migration `0010_combat_encounters.sql`** — the first new table since the campaign-setup
  work (`0009`); everything in the `0.13.0` engine slice was JSONB-field-only. **Not yet applied
  to the live Supabase project** — same "committed but unrun" pattern flagged in nearly every
  prior session (see items 2/3 in this doc's history); apply via the Supabase MCP tool or
  dashboard before this reaches production, the same way `0006`–`0009` were.
- **Core loop**: start/end an Encounter, Combat Goal, Defiant Goals, reported (not rolled) 2d6
  initiative, a manual Acting-Side toggle for the "zipper" turn order, Round/AP tracking — all
  track-and-display, confirmed with the repo owner: nothing here blocks an action, it's a shared
  reference the GM operates.
- **Combat Moves**: Engage in Melee/at Range (roll breakdown for a PC actor, tier-reported same as
  everywhere else, Toughness-adjusted Rank), Reposition (a simplified stand-in for
  Maneuver/Shift — see the range-band note below), Recuperate (reuses `HealStatusModal` from
  `0.13.0` directly).
- **Reaction Moves**: Defend (marks Armor) and Help (spends Party Rapport) are wired up with real
  effect. **Opportunity Attack and Interpose are not** — flagged as a real gap, not silently
  dropped.
- **`Encounter.PendingStatusOffers`** solves a real architecture collision: a PC's Statuses live
  on their own `CharacterSheet` (kept as the single source of truth, matching how the rest of the
  app treats sheets), but `sheet.ts`'s PUT route is owner-only — not even the GM can write another
  player's sheet. So an Enemy's attack can't apply a Status to a PC directly; it offers one
  instead, and the target's own player applies it (optionally Resisting first) from their own
  card. Worth reusing this pattern if `CharacterStatus.LinkedToIds`/`AffectedByIds` (still stubbed
  "not yet") ever get built out into a general cross-character-targeting feature.
- **Enemies**: `library.enemies` (`EnemyTemplate`) is real Content Admin CRUD content, generic
  schema-driven like every other collection — but authoring is ad-hoc-first: a GM can spawn a
  one-off Enemy with nothing persisting, or check a box to save it to the library on the way in.
  Defeated per-Status (any one `StatusLimit` reached), not a shared HP pool. `Toughness` blunts
  incoming Ranks (Medium −2, Heavy one tier lower).
- **Deliberately not built this slice** (real scope, not oversights — see `CLAUDE.md`'s Combat
  section for the same list with more context):
  - Gambits (the 10+/12+/7-9 extra-effect system).
  - Hero Moves — blocked on Playbooks not existing as a concept yet.
  - Opportunity Attack, Interpose.
  - A rendered grid; the Maneuver-vs-Shift distinction (collapsed into one generic "Reposition"
    for v1 — see `combat.ts`'s `shiftRange()` doc comment).
- Not done this session: any live browser QA (same sandbox networking constraint as always — see
  item 5 below) and live-DB verification of the new table/RLS policy (same reason).

An eighteenth session (2026-08-09, no version bump — live-ops only, no code changed) applied
`0010_combat_encounters.sql` to the live Supabase project via the Supabase MCP tool, closing the
gap flagged in the seventeenth session's note and in `README.md`/PR #39: **all 10 migrations are
now applied live.** Verified via `list_migrations` (`0010_combat_encounters` now present) and the
security advisor (only the same pre-existing `WARN` — leaked password protection — plus an
expected `INFO`-level "unused index" note for the brand-new, still-empty `combat_encounters`
table, not a real issue). Combat is now unblocked against production, modulo the live `library`
re-seed/re-import still needed to pick up `library.enemies` and the `0.13.0` `GameSettings`
defaults (same standing caveat as the Glossary feature back in `0.9.0`).

A nineteenth session (2026-08-09, `0.15.0`) added Gambits, following straight on from the
seventeenth session's Combat slice (which had explicitly deferred them as "a real sub-system on
its own"). See `CLAUDE.md`'s Gambits note and `README.md#architecture-notes--judgment-calls` item
16 for the full writeup.

- `gambitConditionCost()` (`packages/shared/src/combat.ts`, unit tested) encodes the doc's cost
  rule; `CombatMoveModal.tsx` gates the Gambit picker to a PC's own Engage roll (Gambits cost a
  Condition, which only PCs have — an Enemy's Engage never offers them).
- **Six of nine Gambits are mechanically automated** (Bolster, Press, Halt, Impede, Calculate,
  Brace) because they reduce cleanly to a Status/Range change the engine already does. Notably,
  Calculate and Brace reuse the Status system itself as their buff mechanism (a Rank-1 "Focused"/
  "Braced" Positive Status) rather than inventing a separate temporary-effect tracker — worth
  remembering as a reusable pattern if a real buff/debuff-duration system ever gets scoped.
- **Repel, Seize, and Other are logged only** — not a gap, a deliberate line: Repel's "push back a
  Range band per their highest Negative Status Rank" mixes two different units (a Rank number, a
  spatial band count) with no clean conversion, and Seize/Other are explicitly open-ended in the
  doc. Forcing a formula would be guessing; logging it for the table to resolve isn't.
- No new migration, no new live-ops step — `Encounter`/`CombatParticipant` didn't gain new fields,
  Gambits just add a modal flow on top of them.
- Not done this session: live browser QA (same sandbox constraint as always).

A twentieth session (2026-08-09, `0.16.0`) added Opportunity Attack and Interpose, the last two
of Combat's five Reaction Moves. See `CLAUDE.md`'s Combat note and `README.md#architecture-notes
--judgment-calls` item 17 for the full writeup.

- Both reuse mechanics already built rather than inventing new ones: Opportunity Attack is the
  same `CombatMoveModal` Engage-in-Melee flow, just triggered off-turn with a `free` flag that
  skips the AP cost; Interpose redirects a `PendingStatusOffer` (new `Resistable` field, `false`
  here) and swaps Range with the original target instead of creating a second offer.
- **Opportunity Attack is manually triggered, not auto-detected** — worth remembering if this
  comes up again: the app's Range model already collapsed Maneuver/Shift into one generic
  Reposition (the seventeenth session's simplification), so there's no signal left to distinguish
  "the enemy Maneuvered away" (should trigger it) from "the enemy Shifted away" (shouldn't). The
  table judges whether the trigger happened, same as everywhere else in Combat.
  Auto-detecting this properly would mean reintroducing the Maneuver/Shift split — real scope, not
  done here.
- `rangeBandDistance()` (`packages/shared/src/combat.ts`, unit tested) backs Interpose's "within 2
  Range bands" check.
- No new migration. Not done this session: live browser QA (same sandbox constraint as always).
- **All five Reaction Moves are now built.** What's left from the original Combat scoping list:
  Hero Moves (blocked on Playbooks not existing) and a rendered grid — both real future scope, not
  oversights.

## Current state

- **Live at:** https://asohav.onrender.com (Render, single Web Service — see
  [README.md#deployment](README.md#deployment)). The *app* (browser QA, clicking through screens)
  is still not re-verified live — this sandbox has no raw HTTP access to the Render URL (see item
  5). The *database* was directly verified and updated this session via the Supabase MCP tool,
  which isn't subject to that restriction — see the thirteenth-session note above.
- **Version:** `0.16.0` (all four `package.json` files, synchronized — see CHANGELOG.md). Not
  git-tagged — see item 3 above. `0.14.0` added a real migration (`0010_combat_encounters.sql`, a
  new table), applied live in the eighteenth session; `0.15.0` (Gambits) and `0.16.0` (the last two
  Reaction Moves) needed no new migration. A live project's `library` singleton still needs a
  re-seed or re-import to pick up `0.13.0`'s new `GameSettings` defaults/glossary terms and
  `0.14.0`'s seeded `library.enemies`, same caveat as the Glossary feature in `0.9.0`.
- **Database:** live Supabase project (`ihrtdbknhpgysgwaqnfj`), **all 10 migrations applied** —
  `0010_combat_encounters.sql` was applied live in the eighteenth session, closing the last gap
  (see its note above). Security advisor otherwise clean (one pre-existing `WARN`, leaked password
  protection, unrelated to any of this app's migrations; one expected `INFO` "unused index" note
  for the brand-new `combat_encounters` table). The Glossary's `library.glossary` field (ninth
  session) — and now `0.13.0`/`0.14.0`'s new `GameSettings` fields and `library.enemies` — still
  need the live library row re-seeded or re-imported to actually show up; that's a data gap, not a
  migration. The "Seelie" campaign and mike@asohav.dev's pending invite (seventh session's seed
  data) are now present live too — see the thirteenth-session note above for why they weren't
  already and what was inserted.
- CI (`.github/workflows/ci.yml`) has four jobs as of this session: `build`, `typecheck`, `test`
  (new — `vitest`, see above), and `responsive`
  (`apps/web/scripts/responsive-smoke.mjs`, driven by `apps/web/harness.html`). Green on `main` as
  of this writing, but **`main` has no branch protection requiring any of them to pass before
  merge** — see item 7 below. That gap is exactly how a red `responsive` job merged to `main` once
  already in an earlier session (fixed immediately after, in a follow-up PR).

## Open issues

Ordered roughly by how much they matter.

### 1. RESOLVED: "loading error" after login was a seed-order FK bug crashing the campaign page

Root-caused and fixed this session: `apps/server/src/seed.ts` inserted `memberships` before
`characters`, but `seedMemberships()` (`packages/shared/src/seedPlay.ts`) assigns player
memberships a `CharacterId` that doesn't exist yet at that point in the loop — the
`memberships_character_id_fkey` constraint rejected the first player membership insert, throwing
and aborting the seed run right after the GM's own membership (the only one with `CharacterId:
null`). Everything after that in the seed — characters, sheets, party, bonds — never got written.

Confirmed directly against the live Supabase project (`ihrtdbknhpgysgwaqnfj`) via the Supabase MCP
tool: `cm-1` had exactly 1 campaign row, 1 membership (GM only), 0 characters, 0 sheets, 0 party,
0 bonds. `apps/server/src/routes/campaign.ts` then shipped `party: null` to the client via a
`party!` non-null assertion (the wire type `CampaignBootstrap.party` is non-nullable), and
`apps/web/src/pages/CampaignPage.tsx` dereferenced `boot.party.Rapport` unguarded — crashing the
page for anyone loading the seeded campaign.

Fixes applied:
- `seed.ts`: characters are now inserted before memberships, matching the FK direction.
- `campaign.ts`: `getParty` returning `null` no longer gets force-cast; the route now self-heals by
  creating a default `Party` row rather than shipping a null the client isn't guarded against.
- Live data repaired directly via SQL against the production project: inserted the missing 4
  characters, 4 remaining memberships, 4 sheets, 1 party, and 6 bonds for `cm-1` so the demo
  campaign now matches `packages/shared/src/seedPlay.ts` exactly.

Not yet done: no automated test covers the seed insert order, so a future edit to `seed.ts` could
reintroduce an ordering bug silently — worth a lightweight integration test if this recurs.

### 2. Bond handshake row-locking (PR #5) is merged but never runtime-verified

`withBondLock()` (`apps/server/src/repo.ts`) opens a direct `pg` connection and runs
`SELECT ... FOR UPDATE` inside a transaction for propose/accept/reject. The logic was written and
reviewed carefully, and the *build* was verified end-to-end locally, but the actual live
transaction/locking behavior against Supabase's Postgres was never smoke-tested — same sandbox
networking blocker as above. Worth a real test once someone has network access to the live app:
in particular, two concurrent requests against the same Bond (e.g. two accepts, or an
accept + reject race) should serialize correctly rather than one silently overwriting the other.

### 3. `v0.3.0` git tag exists locally only — never pushed

Per the versioning policy in CHANGELOG.md ("tag the merge commit vX.Y.Z"), a `v0.3.0` annotated
tag was created locally on the PR #8 merge commit. Pushing it failed with a `403` — this
session's git credentials were scoped to push the `main-2coxec` branch only, not arbitrary refs
like tags. Someone with full push access needs to run:

```bash
git fetch origin main
git tag -a v0.3.0 bb91dba23252d5ec27427f1991a8822676703199 -m "v0.3.0"
git push origin v0.3.0
```

(`bb91dba` is the PR #8 merge commit — where the `0.3.0` CHANGELOG entry landed.) Future releases
should keep tagging their merge commit; check `git tag -l` isn't falling behind `CHANGELOG.md`
again.

Confirmed still broken as of the `0.5.0` merge (PR #21, commit `5c9163a`): tagging and pushing
`v0.5.0` from a Claude Code session hit the identical `403`. So `git tag -l` is now missing
`v0.3.0` through `v0.5.0` entirely (`0.4.0`/`0.4.1`/`0.4.2` were never tagged either, same root
cause) — someone with full push access should batch all of them:

```bash
git fetch origin main
git tag -a v0.3.0 bb91dba23252d5ec27427f1991a8822676703199 -m "v0.3.0"
# find the 0.4.0/0.4.1/0.4.2/0.5.0 merge commits (git log --oneline --grep, or the PR list) and repeat
git push origin v0.3.0 v0.4.0 v0.4.1 v0.4.2 v0.5.0
```

### 4. Commits from this session are unsigned

The container's commit-signing key was empty/misconfigured partway through the session. The repo
owner explicitly authorized pushing unsigned commits to keep moving ("we'll figure out git auth
issue after we finish the work plan") — but the underlying signing setup itself was never fixed.
GitHub shows these commits as "Unverified." Worth sorting out the signing key/environment config
if verified commits matter going forward.

### 5. Sandbox network constraints (context for future sessions, not a bug to fix)

The Claude Code environment this work was done in has a locked-down egress policy: outbound HTTPS
only reaches a small allowlist (GitHub, npm registry, Anthropic, a few others), and raw TCP
(anything that isn't proxied HTTP/HTTPS) is blocked entirely. Confirmed concretely during this
session:

- Direct `pg` connections to Supabase (both the IPv6-only direct-connection hostname *and* the
  IPv4 pooler) hang/fail — raw Postgres wire protocol isn't proxied HTTP.
- Plain `curl`/browser (Playwright) requests to `asohav.onrender.com` and to
  `ihrtdbknhpgysgwaqnfj.supabase.co` both get a `403` from the sandbox's own proxy — these hosts
  simply aren't on the allowlist.
- The Supabase MCP tool still works fine for schema/migration/query work, since that tool runs
  outside this sandbox's network entirely.

Net effect: **this kind of environment cannot do live browser QA or live database smoke-testing of
this app.** A future session working on "does X actually work" tasks either needs a different
environment/network policy, or needs the repo owner to run it themselves and relay results
(console errors, screenshots, network tab, `psql` output, etc.).

### 6. Render MCP connector never worked in this session

The repo owner tried connecting Render's official MCP connector (for driving deploys/env vars
directly) but hit a "failed to connect MCP" error, and a later attempt showed it installed at the
account level but not enabled for the chat. Deployment was done manually instead: writing
`render.yaml` as a Blueprint and having the repo owner paste env vars into Render's dashboard by
hand. If the connector gets working in a future session, Render changes could go through it
directly instead of this git-based Blueprint flow (though `render.yaml` should stay either way —
it's the actual source of truth Render reads).

### 7. `main` has no branch protection on required status checks

The `responsive` job (added this session) went red on a PR's head commit and the PR was merged
anyway — CI ran, caught a real bug (an app-bar touch-target overlap at 360px), and nobody was
forced to act on it before it reached `main`. It was fixed immediately after in a follow-up PR,
but the gap that let it merge red is still open. Needs an account admin — the session token used
for this work has `admin: false` on the repo and gets a `403` from the branch-protection API, so
this can't be done from inside a Claude Code session:

Settings → Branches → add a ruleset (or classic branch protection) on `main`, requiring the
`build` and `responsive` status checks. Leave "require branches to be up to date" off unless you
want every merge to force a rebase first.

### 8. RESOLVED: `AboutModal`'s header padding now matches the other two dialogs

Fixed in the `0.4.2` cleanup pass: `AboutModal.module.css`'s `.head` override (`24px 24px 4px`) was
dropped entirely, and the component now uses the shared `modal.head` from
`apps/web/src/styles/modal.module.css` (`20px 24px 12px`) directly, same as `ForgeBondModal` and
the Advancement picker.

### 9. Worth a read before ASoHaV's content schema hardens further: the Datasworn project

Not a task — a recommendation to read something, made during a conversation about styling
strategy and not yet acted on. [Datasworn](https://github.com/rsek/datasworn) is a JSON Schema
for Ironsworn/Starforged (Moves, Assets, Oracles, Meters, Stats) explicitly designed as an
interchange format that accommodates homebrew and third-party content, with generated TypeScript
(and five other languages') typings. ASoHaV's content shape is close enough — both are
PbtA-lineage, and ASoHaV's `Moves` with `Tier3`/`Tier2`/`Tier1` results maps onto Datasworn's
move-outcome structure fairly directly (`packages/shared/src/schema.ts`,
`packages/shared/src/seedLibrary.ts`).

This is not a recommendation to adopt Datasworn — ASoHaV's content is original and its schema is
already reconciled from the design handoff, so wholesale adoption would be a real migration for
little gain right now. But if community tools or homebrew content ever end up on the roadmap,
borrowing Datasworn's *conventions* — how it models a move's outcomes, how it namespaces
homebrew — is far cheaper to do now, before other tooling or data depends on the current shape,
than after.

### 10. Reported: inconsistent on-click behavior on Statuses (and possibly other tap targets)

Flagged during a UX feedback pass. The repo owner noticed clicking/tapping things on the character
sheet — Statuses specifically called out — doesn't reliably register on the first interaction. Not
yet root-caused. Three candidates were on the list:

- ~~Optimistic-update latency / live-update propagation.~~ **Investigated and ruled out as the
  cause of the GM-view symptom** in the `0.5.1` session — that turned out to be a separate,
  confirmed bug (a joined RLS policy silently dropping Realtime events for `character_sheets`; see
  the `0.5.1` session note above and `CHANGELOG.md` 0.5.1) — now fixed. The player's *own* toggle
  is optimistic-local and doesn't touch the network before rendering, so it was never a strong
  candidate for "my own click didn't register" specifically.
- A double-click/double-tap requirement somewhere in `StatusesPanel.tsx` (e.g. an `onBlur` rename
  input racing a sibling `onClick`, or a stale closure in one of the `commit()` callbacks), or an
  event-handling issue specific to `.tap`'s `::after` overlay technique (`layout.css`) disagreeing
  with the real element about which one receives the click. **Tested and not reproduced** in the
  `0.5.1` session: a Playwright script drove real touch `tap()` events (not synthetic `.click()`)
  against `harness.html` — one tap on the Virtues Condition toggle, and a Status rename-input edit
  immediately followed by a same-row Pip click with no intervening blur — and every case produced
  exactly one state change with no double-fire or drop. This doesn't rule out a device/browser-
  specific quirk Playwright's touch emulation doesn't reproduce (real iOS Safari being the most
  likely gap), just that it isn't a straightforward bug in the click-handling code itself.

Still needs the repo owner to reproduce and describe: which control, which browser/device, single
vs. double click, and whether it's Statuses only or wider now that the live-update angle is closed
off. Not fixed in this session because nothing reproduced to fix — noted here so it isn't lost.

## Everything else

- What's deliberately *not* built (combat, dice rolling, Bond-proposal expiry, etc.) is listed in
  [README.md#whats-not-built](README.md#whats-not-built) — those are scoped out by the original
  design handoff, not gaps from this work.
- Design decisions and judgment calls (why Realtime instead of WebSockets, why no
  character-creation flow, etc.) are in
  [README.md#architecture-notes--judgment-calls](README.md#architecture-notes--judgment-calls).
- Full version-by-version history: [CHANGELOG.md](CHANGELOG.md).
