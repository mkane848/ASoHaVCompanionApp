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

## [0.52.0] — 2026-09-12T20:00:00Z

**Documentation split and trim.** The third and last release out of the post-V0.6 project audit,
after `0.50.0` (correctness) and `0.51.0` (Content Admin). No source behaviour changes, no
migration, no seed content change — the only non-documentation files touched are
`scripts/check-docs.mjs` (new), a step added to CI's existing `lint` job, three source comments
whose doc citations moved, and the version bump.

**Why this was a release and not a chore.** `CLAUDE.md` loads into every session, so its 3,386
lines were paid per session, forever, by every future piece of work on this repo. `HANDOFF.md` was
71% a sixty-two-session narrative sitting *above* "Current state". `README.md` was 83% judgment-call
list. Across the three, the last dozen releases added 6,427 lines and removed 1,078 — a 6:1
append-to-delete ratio. `CLAUDE.md` had said so about itself since `0.34.0`: "Trimming this opener…
is worth a future session's time."

### Four false claims corrected

Landed as their own commit so they stayed reviewable rather than buried in a file move.

- **`HANDOFF.md` open issue 3** asserted "No version has ever been git-tagged" and told future
  sessions not to re-attempt, because the push always `403`s. Ten tags exist, `v0.28.0`–`v0.37.0`.
  It survived 25 releases because this clone's fetch refspec is heads-only, so `git tag` returns
  empty and quietly confirms the wrong answer to anyone who checks the obvious way. Rewritten to
  record that trap and to point at `git ls-remote --tags origin`. Re-tested: a tag push from the
  Claude cloud environment still `403`s, so that is recorded as an environment limit rather than as
  "broken" — the ten existing tags were pushed from the repo owner's own machine. The item now also
  carries the bump commit for each of the 14 untagged releases, with a warning not to derive them
  from branch names: PR #116's branch is named for 0.38.0/0.39.0 and contains neither bump (both
  shipped via #117), and those two releases share one merge commit, so "tag the merge commit" is
  underdetermined for the pair.
- **Open issues 18, 19 and 20** were cited from `CLAUDE.md` and from `apps/server/src/index.ts` but
  never existed; the list stopped at 17. Written up: the `0.28.0` boot crash (resolved in `0.50.0`),
  the stale live `library` row, and the never-auto-applied migrations.
- **Eight symbols cited in the decision record are defined nowhere in the codebase** —
  `applySpendKin`, `giveStatus`, `isClockLocked`, `isDishonored`, `makeScar`, `repelPushBands`,
  `resolveRiskDeath`, `unlockedTier`. Those items are historical by design, so each is annotated
  with its retirement or rename rather than rewritten.
- **`DOCS_REVIEW_COMPLETION.md` deleted.** It declared the docs "consistent, accurate, and free of
  stale information" on 2026-09-05, while `README.md` was already citing retired V0.5 symbols.
  Nothing referenced it.

### Two more found by the new tooling, during this release

`scripts/check-docs.mjs` immediately found a fresh instance of the same bug that motivated it:
**`0.37.0`'s entry in this file cites `HANDOFF.md` open issues 21 and 22, which were never
written** — exactly as 18/19/20 had been. Both describe real, still-open gaps, now recorded:
`GlossaryText` cannot wrap Adventure prose because every candidate field is a live,
`onBlur`-committing `<textarea>` (item 21), and invite email delivery has never been verified live
and cannot be from this sandbox, with two specific config steps to confirm (item 22). This file was
not edited to match — shipped history is append-only here; the missing items were written instead.

### The new shape

The repo root goes from 16 markdown files to 4.

| File | Before | After |
|---|---|---|
| `CLAUDE.md` | 3,386 | 249 |
| `README.md` | 1,681 | 125 |
| `HANDOFF.md` | 3,446 | 1,255 |
| `CHANGELOG.md` | 3,074 | unchanged, append-only by design |

`CLAUDE.md` is now an index plus the invariants a session must not violate — authorization in the
Express layer rather than RLS, the Realtime joinless-policy constraint, the JSONB read-time-default
rule, never add dice randomness, don't guess at an open rules question, the archive freeze and
phase gates, the Bond row lock, the 44px floor and 16px inputs, token reuse, the wire contract, and
the three ways a release silently fails to ship. Each links to its detail.

- **`docs/architecture/`** — twelve per-subsystem documents describing what the app currently does,
  split by subsystem rather than by release. Two of them (`moves-and-camp.md`, `character-sheet.md`)
  were not in the original plan's ten-file tree; Moves/Camp came to 321 lines and the sheet's own
  resource economies to 215, and folding either into `rules-engine.md` would have produced a file
  with no single subject.
- **`docs/operations.md`** — commands, CI job and check-run names, deployment, sandbox constraints.
- **`docs/decisions.md`** — the judgment-call record, item numbering unchanged so every existing
  citation still resolves. **Do not renumber.**
- **`docs/not-built.md`** — what is deliberately absent.
- **`docs/history/`** — the release narrative, the ruleset migrations, and the session log, all
  verbatim. Kept because the corrections in them are load-bearing: one records that `CLAUDE.md`
  "said the exact opposite until `0.41.0`", a claim that survived a sweep because that sweep matched
  one marker syntax while the false claim was ordinary prose.
- **`docs/archive/`** — ten completed work plans and audits under a **COMPLETED** banner,
  deliberately not SUPERSEDED: `Planning Docs/archive/` uses that word for documents that are no
  longer *true*, and a completed plan was executed rather than replaced.
- **`docs/AppThemeGuidelines.md`** and **`docs/TechStackAudit.md`** move up one level, un-bannered,
  because they are still live reference rather than history — the first describes the appearance
  system the app currently ships, and the second still has open items (`HANDOFF.md` item 16).

**Filenames were not tidied to a kebab-case convention** through the move, against the original
plan. Roughly 30 source comments cite `TechStackAudit.md` by bare filename and the living docs cite
the work plans the same way; renaming would have made every one of those wrong as a *name*, not
merely as a path, for purely cosmetic gain. The two archive indexes map name to path instead.

### What was deleted, in full

The split's own rule was that every line either moves verbatim to a named destination, is rewritten
with the rewrite noted, or is deleted only because it is demonstrably false — and then recorded
here. Coverage was asserted mechanically: all 3,386 lines of `CLAUDE.md`, 1,681 of `README.md` and
3,446 of `HANDOFF.md` were each assigned to exactly one destination before anything was written.

**Six lines were deleted.** `CLAUDE.md`'s own note beginning "**The rest of this section is
accumulated release history**", which described the release narrative that this release moved to
`docs/history/releases.md` and recommended the trim this release performed. It documents a state
that no longer exists.

Everything else moved or was restated. The invariants in the new `CLAUDE.md` are restatements, not
verbatim moves, and the full text of each remains in its `docs/` destination.

### Link and citation fallout

Smaller than the ~286 citations suggested, because nearly all are bare filenames rather than paths.
Two real markdown links in `HANDOFF.md` needed repointing for the archive move. Two that looked
broken were not — `WorkPlan-0.24.0.md`'s link to `WorkPlan-0.23.0.md` is now same-directory, and
`WorkPlan-V0.5.md`'s mention of `Planning Docs/ResponsiveAudit.md` is a record of an earlier move,
accurate as history.

- **43 cross-references** between sections that used to share one file (`see "Architecture: X"
  below`) were rewritten mechanically to name the file the section now lives in, resolved through a
  heading map built from the files themselves rather than by hand. One of them was already stale
  before this release: several referred to "Architecture: Party Playbook & Camp", renamed to "Party
  Identity & Camp" in `0.34.0`'s own correction note without the references being updated.
- **`README.md`'s two section anchors** were cited 46 times. The 19 in live docs and source comments
  now point at `docs/decisions.md` / `docs/not-built.md`; the 27 in `CHANGELOG.md`,
  `docs/history/` and `docs/archive/` are left alone, because this project does not edit shipped
  history.
- **The four project-authored skills** cite `CLAUDE.md` sections by name, and `CLAUDE.md` requires
  them to stay in sync. Thirteen citations repointed across `theme-tokens`,
  `responsive-device-qa`, `perf-budget` and `release-reliability-checklist`; two left alone, because
  they name invariants that are still in `CLAUDE.md`.

### `scripts/check-docs.mjs`

New, and wired into CI as a step inside the existing `lint` job rather than as a job of its own —
**branch protection matches required status checks by exact check-run name**, so a new job would
not be covered by the existing rule and could fail unnoticed. That is the same trap `HANDOFF.md`
item 7 records from `0.26.0`. Four checks, each guarding a mistake that has already shipped here:
every relative markdown link resolves; no live doc cites a section anchor that moved; no unmarked
dead symbol in the decision record (paragraph-level, because a file-wide `grep` for the marker
always passes); and no dangling numbered citation into `HANDOFF.md`'s open-issue list. Shipped
history and the five vendored skills are excluded.

### Also

`HANDOFF.md` item 7 records its own resolution: branch protection on `main` now requires exactly
`build`, `test`, `lint` and `responsive` — the four names `CLAUDE.md` has recommended since
`0.26.0`, by exact check-run name, with no bare matrix leg among them. Item 4 gains the real
diagnosis of unsigned commits: `commit.gpgsign true` with `gpg.format ssh` and a **zero-byte**
`user.signingkey`, so signing is switched on and silently produces nothing. That config belongs to
the execution environment, not this repo, and is regenerated per session.

## [0.51.0] — 2026-09-12T00:30:00Z

**The second release out of the post-V0.6 project audit** — Content Admin, phases 1 and 2 of the
plan agreed with the repo owner ("safety plus standard CRUD"). No game rules change. MINOR per this
file's versioning policy: new functionality, plus a behaviour change on `DELETE /library/:collection/:id`.
**No migration file** and **no `seedLibrary.ts` change**, so nothing to apply or reset after deploy.

The audit's finding was that the machinery under this panel is good — 14 collections and 11 field
types driven by one generic CRUD engine, so most capability here is additive — and that everything
around the edges was missing or unsafe. `/admin` is behind `React.lazy`, so none of this counts
toward the first-load bundle.

### Fixed — it could lose or destroy your work

- **Delete, Reset to seed and Import are confirmed.** All three fired on one click, in a codebase
  whose own convention gives `ConfirmModal` to anything destructive — which the Play Data views two
  nav entries away already used. Reset is the worst of the three: it replaces every authored record
  and its own changelog entry stores `Before: null`, so there is genuinely nothing to restore from.
  Delete's confirm names how many references it breaks rather than blocking, since breaking one is
  sometimes the point.
- **Switching record, collection or view no longer discards unsaved edits silently.** There was no
  dirty tracking at all: `selectObject`/`setView` overwrote the draft unconditionally. The store now
  keeps a `pristine` snapshot beside the draft, and every navigation out of a dirty one goes through
  a discard confirm. A pending raw-JSON field counts as dirty on its own — that text is held
  separately and only parsed at save time, so it would otherwise look clean.
- **`GameSettings.GlossaryAutoLink` was unusable and destructive.** `SettingsView` rendered *every*
  settings field as `<input type="number">`, ignoring the `type` each declares in `schema.ts` —
  so a field declared `bool` since `0.24.0` showed blank, and editing it ran through `parseInt()`
  to `NaN`, which serialises to `null`. `PUT /library/settings` shallow-merged the body with no
  validation, so that reached the stored library and silently disabled glossary auto-linking
  app-wide. The view now routes through the same `FieldEditor` every collection uses, and the route
  type-checks its patch.
- **`required` is enforced and `default:` is read.** Both were declared in `schema.ts` and consulted
  nowhere, so `FieldDef.default` was dead config and `POST /:collection` accepted anything —
  an empty-Name record rendered as `(unnamed)`. Now checked on the server (`validateCollectionBody`,
  a partial variant for PUT) and surfaced inline in the form.
- **A client-supplied `Id` can no longer override the generated one** on create — the spread ran
  `{ Id: newId(...), ...req.body }`, the wrong way round.
- **A failed Reset, settings save or Play Data delete is visible.** `0.50.0` added `.catch()` to
  save and delete; the rest were still bare `.then()` chains, so a rejection was an unhandled
  console error and nothing on screen. All library mutations now share one `runMutation()` that
  reports and refetches — the refetch matters as much as the message, since a write rejected by
  `0.50.0`'s optimistic-locking precondition means someone else's version is the live one.
- **Every control in Content Admin now meets the 44×44 touch floor.** Its forms are plain
  inputs/selects/buttons rather than the sheet's `.tap`/`.tap-inline` controls, so none of them
  carried it — at 360px, Save measured 58×29, Delete 76×31, a text input 316×35. Nothing had ever
  noticed because the panel had no interaction coverage at all (see Added).

### Added — standard CRUD

- **Search across the whole record, not just `Name`** — every `text`/`textarea`/`enum`/`taglist`
  field plus the Id. Matching `Name` alone made the glossary (whose Definitions are the point) and
  the 22 Moves effectively unsearchable.
- **A per-collection filter, derived from the schema rather than a lookup table**: the first `enum`
  or `ref` a collection declares. That lands on Moves' `Kind`, Improvements' `TreeId`, Enemies'
  `Toughness`, NPCs' `Type` — and on nothing for collections no field usefully carves up, which is
  the right answer for those. A new collection gets its filter the same way it already gets its CRUD.
- **Sort**: Name A–Z, Name Z–A, and Recently changed (read off the changelog, already fetched).
- **Duplicate a record** — the biggest authoring win for content that comes in families (25
  Improvement Trees, 22 Moves). It copies the record *as saved*, so it goes through the same
  unsaved-changes guard as any other navigation, and the copy reads as dirty from the moment it
  appears.
- **Restore a deleted record** (`POST /library/changelog/:entryId/restore`). Every delete has always
  stored the whole record as the entry's `Before`; nothing read it, so "there is no undo" was true
  only by omission. It restores under the record's *original* Id — which is the entire reason this
  is a route rather than the client re-POSTing the payload, since a fresh Id would leave every ref
  that pointed at the deleted record dangling. Refused (409) if that Id is live again.
- **Deleting something other records reference now needs `?force=true`.** `referencedBy()` has
  powered a "deleting this will break these" warning since the panel was built and the server
  ignored it entirely, so the warning was advice a client could decline to render. The default
  refuses and names what would break; Content Admin re-sends with `force` only after its own
  "Delete and break N" confirm. Deliberately not cascading — the Validation panel surfaces the
  dangling refs, and editing other records out from under the admin would be the bigger surprise.
- **Every admin view is a real address** — `/admin/:view/:id?`. `view` lived only in Zustand, so a
  refresh dumped you back on Virtues with nothing selected, and there was no way to link anyone to a
  record. The URL leads on first load and the store leads afterward, mirrored back with `replace`
  rather than `push`: every record you clicked would otherwise become a history entry, and stepping
  back through them would bypass the unsaved-changes confirm.
- **A Validation issue is clickable**, jumping straight to the offending record. Each issue already
  carried the collection and Id; the only thing missing was somewhere to send them.

### Added — coverage

- `apps/server/src/routes/library.test.ts` grows from 14 tests to 35 — field and settings
  validation, the restore route, and the reference guard.
- `apps/web/src/store/adminUiStore.test.ts` (new, 11 tests) — the dirty check and the draft
  lifecycle, including that a duplicate reads as dirty and copies the saved record rather than the
  edited one.
- **The first admin coverage in either browser pass.** Five new at-rest routes (collection list,
  record open, settings, history, validation — reachable at all seven viewports only because of the
  deep links above) and four interaction states (the two destructive confirms, Duplicate, and the
  discard-changes guard). The harness's admin fixtures gained a restorable delete, a delete whose Id
  is live again, and a validation issue against a real record, so the new controls actually render.
  The new coverage paid for itself on its first run: the harness's changelog fixture had never
  carried the `Diffs` the real endpoint always computes, and the History view reads it unguarded —
  so `/admin/history` failed to boot, and nothing had ever loaded it to find out.

### Changed

- `rowsOf()` helpers on both sides (`routes/library.ts`, `features/admin/adminHelpers.ts`) replace
  the `(lib as any)[key] as any[]` idiom this generic-over-14-collections code repeated at a dozen
  call sites. Lint warnings went from 60 to 52 across the release, and `npm run lint`'s
  `--max-warnings` ceiling comes down with them, 62 → 54 — a ratchet that only ever moves up stops
  being one.

**Bundle:** 215.23 kB gzip against the 220 kB cap, up 0.07 kB from `0.50.0` — `/admin` is a lazy
chunk, so the whole panel is free; the difference is one `layout.css` media query and one route
line in `App.tsx`. About 4.8 kB of headroom remains.

## [0.50.0] — 2026-09-11T19:45:00Z

**The first release out of the post-V0.6 project audit** — correctness and safety, not new scope.
The eight-slice migration shipped in nine days and nothing had stepped back since to ask what it
left behind. MINOR per this file's versioning policy: a shipped mechanic is restored, several
routes change behaviour, and one `CharacterSheet` field is removed. **No migration file** — every
change here is code or a JSONB shape with a read-time default.

### Fixed — live risk

- **The boot seed can no longer stop the server from starting** (`apps/server/src/index.ts`). It was
  an unguarded top-level `await runSeedIfEmpty()`, which is what took production down for about four
  hours at `0.28.0`: a transient Supabase 521 threw, the process died before `app.listen`, Render's
  failed deploy silently kept serving the previous build, and nothing reported it. Twenty-one
  releases later it was unchanged. Now caught and logged; the server always comes up.
- **The content library has optimistic locking.** Every admin write is a read-modify-write of the
  entire 16-key blob, so two admins editing unrelated records in unrelated collections silently
  clobbered each other, with the changelog recording both as successful. `getLibraryWithVersion()`
  returns the row's `updated_at`; `saveLibrary(lib, version)` makes the write conditional and throws
  `LibraryConflictError` (409) otherwise. Content Admin surfaces it and refetches — previously a
  failed save was an unhandled console rejection and nothing else. Import and Reset stay
  unconditional, since replacing what is there is their whole point.
- **`CharacterSheet.Hold` can be spent again.** Slice 4 (`0.45.0`) retired End the Session's Hold
  economy and its four spends, but left the Move-level grants (Assess the Situation, Discern the
  Truth) in place — so the number on the sheet only ever went up, in every release since. The four
  spends return as `SpendHoldModal.tsx`, decoupled from End the Session and reachable from the Hold
  readout: refresh a Gear item's Charges, clear a Condition, mark a Bond, or mark Potential. Marking
  a Bond still routes through the propose/accept handshake — Hold buys the offer, not the mark.
- **Four mutating campaign routes now honour the archive freeze**: `POST /combat/:id/end`,
  `DELETE /campaigns/:id/invites/:inviteId`, `PATCH /campaigns/:id/phase`, and
  `PATCH /campaigns/:id/ready`. All four were missed, and every existing test passed throughout
  because none exercised them against an archived campaign. `CampaignArchivedError` and its three
  phase-gate siblings now carry `status = 409`, so a route can call the assertion bare and let
  index.ts's error middleware answer — closing the footgun rather than just its four instances.
  `POST /api/invites/:id/decline` stays exempt by design, and now says so at the call site.
- **`Bond`, `Encounter` and `Adventure` gained read-time normalizes**, and the `Party` one is no
  longer bypassed by `listPartiesForCampaigns` (the reader behind Home's Rapport tiles). All three
  had gained required fields after rows were live, against this project's own documented rule.
- **`/c/:campaignId/combat` is phase-gated**, matching the inline view. `0.38.0` hid Combat until a
  campaign is Playing; the standalone route rendered it at any phase, so the gate was bypassable by
  typing the URL.

### Changed

- **The Bond cap reads `GameSettings.BondTrackLength`** instead of a hardcoded `5` in
  `isBondLocked`/`applySpendBond`/`resolveAcceptedBond`. The setting is admin-editable and already
  drove the pip count, so raising it rendered more pips than the logic would ever fill.
- **`CharacterSheet.Level` is removed.** Written twice in `MotifPanel.tsx`, read nowhere, displayed
  nowhere — `WorkPlan-V0.6.md`'s "Legacy code left stranded" recommended retiring it.
  **`CharacterSheet.Treasure` is deliberately kept**, reversing that document's recommendation: the
  slice-4 glossary rewrite (`g-treasure`) is a later, explicit decision that it stays a freely
  adjusted resource, and it has live UI.
- `strainExhausted` and the four Quest-progress functions keep their zero call sites and gained a
  note saying so — they are tested implementations of real mechanics waiting on UI, not dead code.

### Added

- `apps/server/src/routes/library.test.ts` — 14 tests. `library.ts` was the only untested server
  route, and it holds `POST /reset`.
- Tests for the four archive guards, the three normalizes, and the configurable Bond cap.
- `modal: Spend Hold` interaction-smoke state. Ember's seeded sheet carries `Hold: 2` so it opens
  with live options.

**Bundle:** 215.16 kB gzip against the 220 kB cap, up 0.38 kB — `SpendHoldModal` is lazy, so only
the Hold trigger counts toward first load. About 4.8 kB of headroom remains.

## [0.49.0] — 2026-09-10T22:00:00Z

**Slice 8 of the V0.6 ruleset migration** (`WorkPlan-V0.6.md`'s "Creating the World" bullet) — CATS
plus a collaborative map build, the eighth and last slice of the eight-slice migration plan. All
eight slices are now shipped. MINOR per this file's versioning policy — new functionality, a new
table (`world`, migration `0015_world.sql`, applying it after merge is required — see "Deployment"
in CLAUDE.md).

**A new `World` document, one per campaign — the same single-row-per-campaign JSONB-blob shape
`Party` already established.** `Ruleset-V0.6.md`'s brand-new chapter: CATS (Concept/Aim/Tone/Subject
Matter, a short group discussion captured as four freeform notes) plus a map build adapted from *The
Perilous Wilds* — a `StartingPlace` (a name, one local detail per player, the doc's own seven fixed
prompts, and its own place-specific rumors) plus `Regions`, `PlacesOfInterest` (a real three-value
`Area`/`Settlement`/`Landmark` enum, the one closed list the chapter names), `PersonalPlaces`,
`Connectors`, and a separate `Rumors` list for the chapter's "any place on the map" prompt.
`newWorld()`/`normalizeWorld()` (`packages/shared/src/logic.ts`) mirror `Party`'s own stable-id and
self-heal-on-read pattern, called from both campaign creation and the bootstrap route's self-heal
path as one shared function. `world.ts`'s `PUT` route is a trusted whole-document replace any
campaign member may call — no role gate, matching the doc's own "everyone... including the GM"
framing — gated only by the existing archive-freeze check.

**Fully collaborative Realtime sync, unlike Adventures.** `world` is added to the
`supabase_realtime` publication and subscribed in `useLiveCampaign.ts` — World has none of the
GM-only unrevealed-Secret leak concern that keeps Adventures off Realtime, so the whole table sees
every edit live, the same treatment Party and Clocks already get.

**The chapter's own headers name six sections, not five — carried forward as a documented mismatch,
not silently resolved.** "Step 2" is used twice in the source text (The Surrounding Regions, then —
a numbering slip, not a merged step — Places of Interest), so this app ships all six sections
exactly as headed (`StartingPlace`, `Regions`, `PlacesOfInterest`, `PersonalPlaces`, `Connectors`,
`Rumors`) rather than merging two to make "five-step" literally true, the same discipline already
applied to the Adventure Countdown's own "five steps, prose promises six."

**World-building happens before character creation in this app, reversing the chapter's own
narrated order.** The doc's prose has World-building follow Character Creation; this app's
`Campaign.Phase` model already reserves character creation for `PartyCreation`, the phase after
Signup, and the Slice 8 scope bullet itself calls this "a campaign Signup-phase surface." Rather
than reopen that phase ordering, `World` stays reachable — not phase-gated — for the campaign's
whole life, matching the doc's own "you can add more of any of them as your adventure plays out."
`PersonalPlace` drops any `CharacterId` reference for the same reason: no character exists yet when
this content is most likely being written, so it stays plain freeform text like every other section.

**Reachable from three places, not GM-gated.** A persistent "Creating the World" banner link in
`CampaignPage.tsx` (both GM and Player views, unlike the neighboring GM-only "Adventure Prep"
link), a "Build the world together" CTA in `CampaignSetupChecklist.tsx`'s Signup lane, and the
dedicated lazy route `/c/:campaignId/world` (`WorldPage.tsx`).

**Testing**: `logic.test.ts` gained `newWorld`/`normalizeWorld` `describe` blocks; a new
`apps/server/src/routes/world.test.ts` covers the PUT route's collaborative (no role gate),
archive-freeze, and self-heal-on-missing behavior; `harness.tsx` gained a `?world=1` fixture
(a populated `World` with one entry per list) and `harnessConfig.mjs` gained two new responsive-smoke
routes for the empty and populated states.

Typecheck clean; full test suite at 442 tests (up 10 from `0.48.0`'s 432); production build
succeeds, with `WorldPage`/`WorldPanel` correctly split into their own lazy chunk (20.69 kB raw /
6.37 kB gzip); bundle budget at 214.78 kB gzip against the 220 kB cap (up ~0.3 kB from `0.48.0`'s
214.48 kB — only the two new always-loaded banner/checklist links count toward first load); lint
holds at the existing 62-warning baseline. Full responsive and interaction smoke verification
confirmed green via this PR's own CI run (see the PR for the check-run results).

## [0.48.0] — 2026-09-10T20:10:00Z

**Slice 7 of the V0.6 ruleset migration** (`WorkPlan-V0.6.md`'s Party and Bond slice, Section A4
item 1, and Section C's Bond spend menu) — Rapport can now overflow its cap and bank until Camp,
Party Skill/Weakness Tags get a declare-and-log roll affordance with no numeric effect, and both
Bond UIs gain the doc's real five-option spend menu. MINOR per this file's versioning policy — new
functionality, no breaking data change (`Party`/`Bond` are JSONB blob fields; no migration added).

**Rapport overflow, per A4 item 1's worked example.** `Party.Rapport` is no longer clamped at
`GameSettings.RapportTrackLength` anywhere it's written — `applyPartyRapportAdvance()` (`logic.ts`)
now subtracts the cap rather than zeroing the field on an advance, so Rapport banked above the cap
survives and can fund a second advance in the same sitting if what's left is still at or over the
cap. A new `spendRapportForAid()` is the single shared spend path: spending before the party
reaches Camp **forfeits** any banked overflow and resolves from the normal cap instead (10/5, spend
1, lands at 4/5, not 9/5) — both Rapport-spend call sites (`AdvancementPanel.tsx`'s Aid button and
`EncounterView.tsx`'s Combat Help reaction, which used to spend inline) now route through it, so
they can't independently drift. The two remaining clamp-at-write sites (`EndSessionModal.tsx`'s
party-mark, and Combat's own start-of-fight Rapport delta in `apps/server/src/routes/combat.ts`)
had their ceiling removed, keeping the floor at 0.

**The "10/5" legibility problem** — `AdvancementPanel.tsx`'s Rapport `Pips` row now clamps its
`filled` prop at the cap, so a full-but-not-overflowing track and an actually-overflowing one no
longer render as identical rows of filled dots, plus a new text readout stating the true total and
the banked amount once Rapport exceeds the cap. No other Rapport display needed this — `CampaignTile
.tsx`, `CampaignPage.tsx`, and `EncounterView.tsx` already render plain "N / M" text.

**Party Skill and Weakness Tags get storage, deliberately no multiplier — Section D item 8's Party
Tag economy stays an open question.** `MoveRollHelper.tsx` gained a "Party Tags relevant to this
roll" section, the same declare-and-log shape as the existing Boons/Banes picker — tapping a Party
Tag logs the declaration to `Party.History` via a new `commitParty`/`party`/`myName` prop now
threaded through `CharacterSheetPage.tsx` → `MovesDrawer.tsx` → `MoveRollHelper.tsx`, and does not
touch `computeRollBreakdown()`'s `Total` in any way — the same "this app can't see a roll, so it
can't enforce or add a bonus, that stays with the table" treatment the Aid tooltip already gives
Rapport spending. This is intentionally unfinished: what a Party Tag actually does mechanically ("do
they only work once between Camping? Stronger than a Hero Tag? +2? Advantage?") is still exactly the
open question `WorkPlan-V0.6.md` Section D flags it as — this slice built the storage a future
answer needs, not a guess at one.

**The Bond spend menu's five explicit options, in both places this app has a Bond UI.** A new
`BOND_SPEND_OPTIONS` constant (`logic.ts`) is V0.6's own "Spending Bond" list, offered as a picker
everywhere the app used to have one hardcoded "Spend a Bond" button that always logged the same
generic note — `AdvancementPanel.tsx`'s own Bond section and `CampaignBonds.tsx`'s independent copy
both needed the identical picker, the same "lives in two places, both need the rename" precedent the
Kin→Bond rename already established for this exact pair of files. Each option is a logged choice on
the existing, unchanged `SpendBond` propose-and-apply-immediately flow (its route already accepted a
freeform `note`) — no new cross-character mutation, keeping "generalized cross-character Status
targeting" on this app's permanent not-built list. **Scoping call**: the doc's fifth option ("mark a
Condition on them, or give them a Rank 2 Status") uses stale pre-Strain wording, since the Bond
chapter — like Combat's — was never rewritten for V0.6's severity-slot harm model; mapped to "a
Minor Status," the closest severity-slot equivalent, the same documented reading this app already
gives every other stale "Rank N" reference elsewhere. **Forge a Bond stays fenced at "TO BE
DETERMINED"** — confirmed unchanged; this slice touched neither `ForgeBondModal.tsx` nor
`applySpendBond()`'s Forge branch.

**Testing**: `logic.test.ts` gained a `spendRapportForAid` `describe` block (the 10/5 worked
example, an ordinary below-cap subtraction, and the floor-at-0 case), a `BOND_SPEND_OPTIONS`
length-pin test, and an `applyPartyRapportAdvance` overflow-banking case; every existing call to
`applyPartyRapportAdvance` picked up the new required `cap` argument. `apps/server/src/routes/
combat.test.ts`'s "caps the Rapport bump at 5" test is rewritten to assert the opposite — Rapport
now reads 6, not clamped to 5, confirming the ceiling is actually gone server-side too.

Typecheck clean; full test suite at 432 tests (up 5 from `0.47.0`'s 427); production build succeeds;
bundle budget at 214.48 kB gzip against the 220 kB cap (up from `0.47.0`'s 213.02 kB — the Bond
spend menu and Rapport overflow readout are always-visible `AdvancementPanel` content, and
`MovesDrawer`/`MoveRollHelper` are not lazy-loaded, so the new Party Tags section counts toward
first load too); lint holds at the existing 62-warning baseline; responsive and interaction smoke
tests pass clean.

## [0.47.0] — 2026-09-10T18:25:00Z

**Slice 6 of the V0.6 ruleset migration** (`WorkPlan-V0.6.md`'s Clocks rewrite, and Section A4 item
3) — `ClockKind` renamed/split, Threat Clocks gained real content, and a GM-promotable Quest Board.
MINOR per this file's versioning policy — new functionality, no breaking data change (`Clock` is a
JSONB blob field; a new `normalizeClock()` backfill covers every shape change, no migration added).

**`'Basic'` renamed to `'Opposition'`; `'Countdown'` split into `'Threat'` and `'Project'`.** The
rename is lossless — same Success/Failure/Headway-risk mechanic, `applyClockRoll()`/`clockOutcome()`
unchanged — so a legacy `'Basic'` Clock translates forward to `'Opposition'` on read via the new
`normalizeClock()` (`logic.ts`), the same self-heal-on-read pattern every other JSONB-blob shape
change in this migration already uses. The Countdown split is a genuine one-to-two division with no
way to reconstruct which a given legacy Clock was meant to be, so every legacy `'Countdown'` Clock
defaults to `'Threat'` — the closer semantic match (GM-ticked, already the target of Camp Actions'
own advance flow) — rather than guessing per-clock or discarding data.

**`Clock` gained `Goal`/`SkillTags`/`Developments`/`PromotedToBoard`**, present regardless of Kind
and backfilling to their empty defaults. `Goal: string` is shared by Threat and Project; `SkillTags:
string[]` and `Developments: ClockDevelopment[]` (`{ Id, Text, Triggered }`, a GM-toggled flag not
tied mechanically to a segment) are Threat-only in the doc's own text. `ClockCard`'s editing of all
three is GM-only in the UI, matching the existing `isGM` gate the old Countdown tick controls
already had; their display is unconditional for every viewer — Developments are plain player-visible
text, not GM-only spoiler content like an Adventure's Secrets, since Threat Clocks are the doc's own
example of a player-facing Countdown and this app has no per-field visibility mechanism on a Clock
that wouldn't reopen the Realtime-payload-leak problem Adventures' GM-only surface exists to avoid.

**A GM can promote a Threat onto the campaign's Quest Board** (`PromotedToBoard: boolean`, `WorkPlan-
V0.6.md` Section A4 item 3 — "some GM Threats get promoted to visible party quests," a meeting-only
decision V0.6's own text never describes a board or promotion step for). `ClocksPanel.tsx` renders a
decorative `QuestBoardCard` per promoted Threat (Title, Goal, a segment-dot row, no buttons or
inputs of its own) above the ordinary Open list, where the same Clock still renders fully and
interactively — a second interactive copy would duplicate that card's own element ids (the risk-row
`aria-labelledby` target, in particular), a real accessibility bug rather than just redundant
markup. "The clocks of neglected Threats advancing as the party pursues others" is deliberately not
built — neither the meeting note nor V0.6's own text specifies how much or on what trigger, and the
doc's own better-specified "often when the Heroes Make Camp" line was already covered by the
existing, GM-manual Camp Actions advance flow (renamed "Advance a Threat" this slice, filtered to
`Kind === 'Threat'` instead of listing every open Clock).

**`Clock.UnlocksClockId`/`isClockLocked()` (Linked Clocks) are retired outright**, per the doc's own
restructure — the "Locked" badge and its gating in `ClockCard`'s `readOnly` are gone, along with the
`allClocks` prop that existed only to support the lookup. A stray `UnlocksClockId` key on an old
Clock's JSONB blob is left unread rather than actively stripped, the same "harmless leftover key"
treatment a retired `CharacterSheet` field already gets elsewhere in this app.

**`CampActionsModal.tsx`'s "Advance a Bad Guy Clock" is renamed "Advance a Threat"** and its picker
now filters to `Kind === 'Threat'`; both it and `EnjoyDowntimeModal.tsx`'s Advance activity filter
their project-Clock picker to `Kind === 'Project'`, instead of listing every open Clock. Neither
flow's own mechanic changed.

**Glossary**: `g-opposition-clock`/`g-threat-clock` rewritten to drop their "not yet built" framing;
a new `g-project-clock` entry added.

**Testing**: `clocks.test.ts` (`packages/shared`) dropped its `isClockLocked` tests and moved its
`Kind` literals to the new names; `logic.test.ts` gained a `normalizeClock` `describe` block pinning
the Basic→Opposition translation, the Countdown→Threat default, and the four-field backfill;
`apps/server/src/routes/clocks.test.ts`'s fixtures and request bodies moved to the new Kind names.
`harness.tsx`'s `?clocks=1` fixture now seeds one Clock of each of Opposition/Threat/Project (the
Threat pre-promoted to the Quest Board, with one triggered and one un-triggered Development), so the
existing responsive-smoke routes exercise the whole rebuild with no new route or interaction-smoke
state needed.

Typecheck clean; full test suite at 427 tests (up 3 from `0.46.0`'s 424); production build succeeds;
bundle budget flat at 213.02 kB gzip against the 220 kB cap (`ClocksPanel` is an unchanged lazy
chunk); lint holds at the existing 62-warning baseline; responsive and interaction smoke tests pass
clean.

## [0.46.0] — 2026-09-10T13:30:00Z

**Slice 5 of the V0.6 ruleset migration** (`WorkPlan-V0.6.md` Section A4, items 2 and 4) — Load
wildcard declarations, Light/Heavy Loadouts granting a Boon/Bane, and a freeform Pronouns field.
MINOR per this file's versioning policy — new functionality, no breaking data change (one additive
Postgres migration, backfilled in the same statement).

**Unused Load boxes are now declarable wildcard items** — `WorkPlan-V0.6.md` Section A4 item 2, a
decision reached in meetings but never written into `Ruleset-V0.6.md`'s own text (which only
describes the *declaration* half: "declare, at any time, that your character has any item ... by
checking a Load Box"). A new `WildcardDeclaration { Id, Text, Persistent }` list on
`CharacterSheet.WildcardDeclarations` — each entry a flat 1 Load, counted into `carriedLoad()`
alongside the existing catalog-item total, kept as its own list rather than folded into `Items[]`
since a wildcard has no `ItemId`/`Charges` and a catalog item has no `Persistent` flag.
`LoadPanel.tsx` gained a "Wildcard items" section (an `InlineEdit` for the declared text, a
Persistent/Ordinary toggle, an always-visible remove button) above the existing catalog list.
Ordinary declarations return to the ether at Make Camp (`StatusesPanel.tsx`'s `makeCamp()` filters
them out); Persistent ones (named, magical, or plot-relevant) survive and permanently consume that
Load box. "Running out should create problems, not just block" ships as a non-blocking reminder
message once Load reads full, alongside the pre-existing over-capacity warning — not an invented
formula, since neither the meeting note nor V0.6's own text specifies what the problem actually is.

**Light and Heavy Loadouts grant a matching Boon/Bane.** `applyLoadTierBoonBane()` (new,
`logic.ts`) adds/removes "Inconspicuous" (Boons, Light) and "Conspicuous" (Banes, Heavy) by exact
name on every tier switch, called from `LoadPanel.tsx`'s existing tier-switch handler. The doc's
own "+1 Movement"/"-1 Speed in Combat" clauses in the same paragraph are deliberately not modeled —
this app has no numeric Combat movement/speed stat (Range has been theater-of-the-mind bands since
Combat was first built), and the Slice 5 bullet only names the Boon/Bane grant.

**`Character.Pronouns: string` is a new freeform field** (`WorkPlan-V0.6.md` Section A4 item 4 —
V0.6's own Hero Creation opener, "Choose your Name, Pronouns, and Physical Description," names it
alongside Name, which the app already modeled). Captured in `CreateCharacterPage.tsx` right after
Character name, required non-empty the same way Name already is (client- and server-validated via
`characterCreationSchema.ts`); displayed on `CharacterSheetPage.tsx`'s sticky header next to the
character name. No post-creation edit route was added — there has never been one for `Name` either,
following the existing "Virtue scores and Theme are read-only, an edit affordance needs an explicit
repo-owner ask" precedent.

**`Character` is a real Postgres table, not a JSONB blob — the first migration this eight-slice plan
has actually required.** Every prior V0.6 slice's new fields lived on `CharacterSheet`/`Party`/
`Library` (JSONB columns needing only a TypeScript type change plus a normalize-on-read backfill).
Migration `0014_character_pronouns.sql` adds `pronouns text not null default ''`, backfilling every
existing row in the same statement; `repo.ts`'s `mapCharacter()` also falls back `r.pronouns ?? ''`
for the window between merge and that migration actually running live — needs applying to the live
Supabase project after merge, per this project's standard post-merge step.

**Testing**: `logic.test.ts` gained `describe` blocks for `carriedLoad`'s wildcard counting and
`applyLoadTierBoonBane`'s exact-name add/remove/no-op behavior, plus a `normalizeSheet` case for
`WildcardDeclarations` backfilling to `[]`; `characterCreationSchema.test.ts` gained a "trims and
requires non-empty Pronouns" case. `interaction-smoke.mjs` gained a "wildcard item editor" state —
a wildcard row's `InlineEdit` sits beside two siblings a plain `TagList` chip doesn't have (the
Persistent toggle, an always-visible remove button), distinct enough to warrant its own check.
`seedPlay.ts`'s four demo characters each got a Pronouns value, and two (Ember, Frostbite) a
Persistent/Ordinary wildcard declaration respectively, exercising both branches in manual QA and
the smoke suite.

Typecheck clean; full test suite at 424 tests (up 8 from `0.45.0`'s 416); production build
succeeds; bundle budget at 213.02 kB gzip against the 220 kB cap (up from `0.45.0`'s 211.77 kB for
the new always-visible wildcard section and Pronouns header display); lint holds at the existing
62-warning baseline; responsive and interaction smoke tests pass clean.

## [0.45.0] — 2026-09-10T11:05:00Z

**Slice 4 of the V0.6 ruleset migration** (`WorkPlan-V0.6.md` section C) — the largest single slice
by lines touched: all 22 seeded Moves re-authored, two Move renames, the new Consequence
vocabulary, five guided-flow rebuilds, an advance-timing change, and a glossary sweep. MINOR per
this file's versioning policy — new functionality and content, no breaking data change.

**All 22 seeded Moves in `seedLibrary.ts` are re-authored against `Ruleset-V0.6.md`'s literal
text.** `Description`/`Results`/`Options` for every Basic and Adventure Move now match the doc's own
current wording, replacing prose that still named ranked Status Ranks and the old five-Consequence
vocabulary. Two renames: `m-levelup` ("Level Up" → "Advance a Motif") and `m-journey` ("Undertake a
Journey" → "Set Out"), both keeping their existing `Id`. The new Consequence vocabulary — Burdened /
Compromised / Delayed / Depleted / Exposed, replacing Attrition / Detection / Danger / Delay /
Sacrifice — appears in Invoke Expertise and Take a Risk; a new `g-consequence` glossary entry
(aliased to all five names) reframes the old `g-attrition` entry as one concept.

**A full Potential/Rapport track no longer auto-advances — the app shows a manual "Ready to
advance" trigger instead, needing no new stored field.** `MotifPanel.tsx`/`AdvancementPanel.tsx`
stopped opening the advance picker the instant a track hit cap (which read as advancing
immediately, off any actual Camp) and instead render a persistent gold-tint button once the track
is full, opening the same picker whenever the player actually taps it — V0.6's own "advances the
next time you Make Camp" timing, applied with the track-and-display philosophy this app already
uses for Combat and Clocks rather than a new "are we at Camp" session concept.
`EndSessionModal.tsx`'s now-unreachable auto-open of `PartyAdvanceModal` was removed as dead code.

**`CampActionsModal.tsx`'s "Change Quest" Camp Action is replaced by "Rewrite a Skill/Flaw Tag,"**
per the doc's own "Change personal Drive/Want" → "Rewrite or update any one of your Skill or Flaw
Tags." The new shared `rewriteMotifTag()` (`logic.ts`) backs both this Camp Action and
`EndSessionModal.tsx`'s new growth option below — real, load-bearing duplication removed, not a
speculative extraction.

**`KeepWatchModal.tsx`'s GM 6- now marks party Rapport instead of everyone's Potential, and the
volunteer's roll is fixed to +Wit** rather than a free Virtue pick — both per the doc's literal
text. The volunteer's own 6- no longer marks Potential either (the doc's text for that branch names
no such effect), so the `motifIndex`/`MotifPicker` plumbing that only existed to support those
marks was removed.

**`UndertakeJourneyModal.tsx` is renamed to `SetOutModal.tsx`**, matching the Move rename — Loadout
was already this modal's first step before the rename (slice 7 already got this right), so the
real changes are the file/component rename and a few tightened option strings.

**`EnjoyDowntimeModal.tsx`: Rest, Carouse, and Pivot all changed mechanics, not just labels.** Rest
is now "spend 1 Wealth to Recuperate without taking Strain" — a new shared `applyRecuperateEffect()`
(`engine.ts`, taking a `takeStrain` flag) replaces the old full Status wipe, and
`StatusesPanel.tsx`'s own Recuperate action now calls the same function. Carouse spends 1 Wealth
instead of 1 Treasure. Pivot's personal branch reaches the doc's "as if you had marked your third
Forsake" via a new `pivotMotifQuest()` (`logic.ts`) that resets a Motif's Act Break/Forsake tracking
alongside its Quest text, instead of overwriting the Quest text alone.

**`EndSessionModal.tsx`'s entire per-player Hold economy is retired**, replaced by each player
choosing one of three ways to grow — mark a Bond, rewrite a Skill or Flaw Tag, or mark Potential on
a Motif whose Quest they progressed — per the doc's own text. `CharacterSheet.Hold` itself is
untouched and still fully live for the Moves that grant it directly (Assess the Situation, Discern
the Truth); only this modal's own use of the pool is gone.

**Glossary sweep**: added `g-strain`, `g-boon`, `g-bane`, `g-healing-track`, `g-opposition-clock`,
`g-threat-clock`, `g-development`, `g-headway`, `g-push-yourself`, `g-set-out` (the last four
describing Slice 6's not-yet-built Clock rename, each flagged as such in its own definition);
rewrote `g-status` and `g-advantage`; retired/reframed `g-recovery` and `g-scar`. Found stale during
the build and fixed for the same reason: `g-crumble`, `g-subdued`, and `g-unstable`, all still
describing pre-slice-1 mechanics a full three releases after they were replaced.

**Two real bugs found and fixed, both in `interaction-smoke.mjs`, not application code.** The
"modal: Give a Status"/"modal: Heal a Status" states targeted button labels slice 1 renamed to
`Take Strain…`/`Recuperate…` back in `0.42.0` — the script's own "trigger not present, skipped"
fallback silently swallowed the miss instead of failing, so this carried zero CI signal for three
whole slices. Verified factually (ran the stale states directly, confirmed "trigger not present")
before renaming both to match the real button text; both pass clean now, alongside the `modal: Set
Out` rename this slice's own Move rename required.

Verification: typecheck clean, 416 tests passing (no new logic branches needing dedicated unit
tests beyond what the two new shared helpers already share with tested call sites), production
build succeeds, bundle budget 211.77 kB / 220 kB gzip (essentially flat versus slice 3, since almost
everything this slice touched is lazy-loaded modal content), lint at the existing 62-warning
baseline. The responsive smoke test (character-sheet route, all viewports, both appearances) and
the full interaction-smoke suite (all states, after the renames above) both pass clean.

## [0.44.0] — 2026-09-10T03:30:00Z

**Slice 3 of the V0.6 ruleset migration** (`WorkPlan-V0.6.md` section C), landing right behind
slice 2 and closing out Section B1's mapping table and the remaining Combat Loop additions. MINOR
per this file's versioning policy — new functionality, no breaking data change.

**Cover is now a real Boon/Bane roll mechanic.** `CombatMoveModal.tsx`'s Engage roll calls
`computeRollBreakdown()` with real `RollExtras` — slice 2's own mechanism, applied to Combat's roll
surface for the first time. The Cover checkbox counts as an extra Bane against the attacker's own
roll (B1: "A Boon on the target, giving the attacker Disadvantage"); the actor's own sheet
Boons/Banes are also selectable as relevant to the roll, the same picker shape
`MoveRollHelper.tsx` already uses. `breakdown.Advantage` drives the displayed roll guidance instead
of a static tooltip.

**Surprise (Combat Loop step 4) is a new GM control.** `firstToActFromSurprise()` (`combat.ts`)
mirrors `firstToActFromInitiative()`'s shape but needs no roll and no new stored field — a one-shot
action, same as "Roll Initiative," since surprise and initiative are mutually exclusive in the
doc's own step order. The doc's further "at the GM's discretion" extra effects (a head-start round,
fewer actions, Disadvantage) are left as GM narrative discretion, not modeled.

**Combat-Goal achievement grants real, self-serve Potential.** `Encounter.CombatGoalAchieved`
(new field, GM-toggled) drives a banner every PC player sees once true, letting them mark Potential
on one of their own Motifs — self-serve because only a sheet's own owner can write it, the same
constraint `PendingStrainOffer` already works around. "No Potential on a 6- in Combat" ships as a
documented no-op rather than a suppression mechanic: it's a carve-out from a general
"rolls-can-award-Potential-on-a-miss" rule this app has never built (the only Potential-on-a-roll
mechanic anywhere is slice 2's unconditional, untiered Flaw Tags), so there's nothing to suppress.

**Boss Last Stand and 1d6-Wounded-style attack numbers get a documented-assumption `InfoTooltip`**
on the Boss badge row (`ParticipantCard.tsx`) — B1's own instruction was to surface this reading in
the UI rather than bury it in a constant, since it's Ryan's own flagged `!! UPDATE` area.

**Brace's mismapping was fixed — a real bug this slice's own research found, not new scope.** B1
gives Calculate and Brace different shapes: Calculate is "+1 forward" (a Boon already models this),
Brace is "−1 Strain from everything until your next turn" (a numeric reduction with a duration this
app has never tracked). Slice 1's code mapped both onto the same Boon-push primitive, silently
misrepresenting Brace's actual effect. Fixed by moving Brace to the same logged-only treatment
Seize/Other Gambits already get.

**A real, pre-existing accessibility bug was found and fixed: three raw `<input
type="checkbox">` elements at 13×13px** (Cover, Rolled-12+, and this slice's own two new Boons/Banes
pickers in `CombatMoveModal.tsx`) — well under the 44×44 touch-target floor, never previously
caught because no interaction-smoke state had ever opened this modal. This slice adds one
(`modal: Engage`) and fixes all four checkboxes via the shared `CheckboxRow` component, the same
convention `MoveRollHelper.tsx` already uses for its own Boons/Banes picker. A related 5px overlap
between the new Boons/Banes grid and the InfoTooltip trigger below it, caught by the same new
coverage, is fixed with a margin bump matching `VirtuesPanel.module.css`'s own precedent for the
identical class of bug.

See CLAUDE.md's new "Architecture: Combat on Strain (V0.6 slice 3)" section for the full account,
`README.md` item 46 for the judgment calls, and `HANDOFF.md`'s fifty-sixth-session note for the
fuller narrative. Verification: typecheck clean, 418 tests passing (two new `combat.test.ts` cases
for `firstToActFromSurprise`), production build succeeds, bundle budget 211.81 kB / 220 kB gzip
(unchanged — `CombatPanel` is lazy-loaded), lint at the existing 62-warning baseline, the responsive
smoke test on the Combat route, and the full interaction-smoke suite (including the new
`modal: Engage` state) all pass clean.

## [0.43.0] — 2026-09-10T02:15:00Z

**Slice 2 of the V0.6 ruleset migration** (`WorkPlan-V0.6.md` section C), landing right behind
slice 1. Skill and Flaw Tags — freeform text since the V0.5 migration — become mechanical, and
Advantage/Disadvantage becomes a general Boon/Bane comparison rather than two hardcoded per-Move
triggers. MINOR per this file's versioning policy — new functionality, no breaking data change.

**`computeRollBreakdown()` (`engine.ts`) gains an optional fourth parameter, `RollExtras`** —
`{ SkillTag, PushYourselfTag, FlawTags, BoonsSelected, BanesSelected }` — folding a declared Skill
Tag (+1), a Push Yourself second tag (+1), and any applicable Flaw Tags (−1 each) into `Sources`/
`Total`, and returning a new `Advantage: 'Advantage'|'Disadvantage'|'Normal'` field from
`compareBoonsAndBanes()`, V0.6's own "more Boons than Banes is Advantage" rule. A Minor Status now
folds into `Sources`/`Total` too, as a real −1; Major ("Disadvantage") and Severe ("roll 1d6 instead
of 2d6") stay the separate, non-numeric `StatusPenalty` display slice 1 shipped, since this app
doesn't invent a combination rule for two different sources of Disadvantage. The new parameter
defaults to `{}`, so every existing call site (`CombatMoveModal.tsx`'s Engage roll) keeps compiling
and behaving unchanged, picking up only the Minor-Status-folds-in change for free.

**`MoveRollHelper.tsx` becomes a real roll builder.** A Skill Tag picker (flattened across all three
Motifs) lets the player declare one tag (+1, free); a second applicable tag can be added via Push
Yourself, which marks a Condition (a Virtue picker reusing `VirtuesPanel.tsx`'s own `markCondition()`/
`CrumbleModal` pattern) for another +1. A Flaw Tag checklist lets the player mark every applicable
one (−1 each, and each irreversibly marks Potential on its own Motif via `addMotifPotential()`,
win or miss). A universal Boons/Banes picker (checkboxes over the sheet's own `Boons`/`Banes` lists)
replaces the old `Move.AdvantageTrigger`-driven UI, computing Advantage/Disadvantage generally
rather than per-Move.

**`Move.AdvantageTrigger` retires outright.** The old field's two hardcoded triggers
(`'wealthSpend'` on Follow a Lead, `'selfReport'` on Consult the Past) forced a fixed "roll 3d6,
keep the best/worst two" state; V0.6's own text for both Moves already reads as the general
mechanic ("add a relevant Boon," "roll with Advantage" for a Wealth spend that is itself just
acquiring a Boon), so neither needed a dedicated code path. Removed from `types.ts`, `schema.ts`,
and both seeded Moves in `seedLibrary.ts` — neither Move's `Description` text was rewritten (that's
Slice 4's "re-author all 22 Moves against V0.6" job, not this slice's).

**Combat's own roll surface is untouched.** `CombatMoveModal.tsx`'s Engage roll gets none of the new
tag/Boon/Bane UI and Cover is still a static reminder banner — this slice's scope was
`MoveRollHelper.tsx` specifically, per `WorkPlan-V0.6.md` Section C; Combat's full roll rebuild is
Slice 3 ("Combat on Strain," `0.44.0`).

See CLAUDE.md's new "Architecture: Rolls (V0.6 slice 2)" section for the full account, `README.md`
item 45 for the judgment calls (Push Yourself's free-pick Virtue choice, Skill Tags capping at two
per roll while Flaw Tags don't cap, no auto-opening `MotifAdvanceModal` from a Flaw-Tag Potential
mark), and `HANDOFF.md`'s fifty-fifth-session note for the fuller narrative. Verification: typecheck
clean, 414 tests passing (six new `engine.test.ts` cases plus a `compareBoonsAndBanes` describe
block), production build succeeds, bundle budget 211.80 kB / 220 kB gzip, lint at the existing
62-warning baseline, and both the responsive smoke test (character-sheet and Combat routes) and the
interaction smoke test's "drawer: Moves" state (91 controls, real Skill/Flaw Tag and Boon/Bane
content) pass clean at every viewport and appearance.

## [0.42.0] — 2026-09-10T01:30:00Z

**Slice 1 of the V0.6 ruleset migration** (`WorkPlan-V0.6.md` section C), the first code to land
against `Planning Docs/Ruleset-V0.6.md` since it was adopted as canon in `0.41.0`'s docs-only pass.
Deliberately ships no new screen: like V0.5's own slice 1 before it, this slice settles the harm
model's wire contract before any other surface gets rebuilt on it. MINOR per this file's versioning
policy — a notable internal architecture change, and a breaking one for stored play data (clean
break, see below).

**Statuses stop being ranked tracks.** `CharacterStatus` goes from `{ Marks: boolean[], Polarity }`
to `{ Severity: 'Minor'|'Major'|'Severe', Name, Description }` — a named lasting injury in one of
three severity slots (`GameSettings.MinorStatusSlots`/`MajorStatusSlots`/`SevereStatusSlots`, seeded
3/2/1) instead of a ranked row. `CharacterSheet` gains `Strain: boolean[5]` (a short-term track,
same sparse-marking rule the old Status row used — `markRank()`/`statusRank()`/`reduceRank()` in
`engine.ts` are unchanged, just serving a different track now), `HealingTrack: number` (a real
cumulative clock), and `Boons`/`Banes: string[]` (unranked situational tags). `Recoveries` and
`GameSettings.RecoveriesMax`/`StatusMaxRank` are retired (`StatusMaxRank` renamed
`StrainTrackLength`).

**New engine primitives** (`engine.ts`), replacing the retired ranked-Status ones: `markStrain()`/
`strainExhausted()`, `statusAbsorb()` (2/4/6 by severity — how much incoming Strain taking a Status
negates), `statusPenalty()` (`-1` / `Disadvantage` / `roll 1d6 instead of 2d6`, informational this
slice — not folded into a roll's `Total`, since Major/Severe change the roll's shape rather than
adding a number; `computeRollBreakdown()`'s old `StatusSources` becomes `StatusPenalty`),
`takeStatus()`, `downgradeStatuses()` (Healing-Track-full: every held Status drops one severity,
checked against starting slot occupancy so two Statuses can't double-book one freed slot),
`advanceHealingTrack()`, and `isSubdued()` — now derived (Strain track entirely full *and* every
severity slot full), with no further consequence: V0.6 deletes the entire "Limits, Scars, & Death"
section, so the old three-way Scar/Risk Death/Blaze of Glory modal (`SubduedModal.tsx`) is deleted
outright rather than retired-in-place. `CharacterSheet.Scars[]` survives as a field with no current
writer, so nothing already recorded is lost. `isUnstable()` is redefined: true while holding any
Major or Severe Status, not "Rank 4 of a ranked Status."

**`StatusesPanel.tsx` is rebuilt** — the single biggest UI change in the migration. Three severity
groups (Minor/Major/Severe, each a bounded number of slot cards) replace the three polarity groups;
a new Strain row reuses `StatusBoxes` (its sparse geometry already matches); a new Healing Track row
uses `Pips` (a real clock, unlike a Status row); Boons and Banes are two `TagList`s, the same
primitive Looks/Skill Tags/Flaw Tags already use. `GiveStatusModal`/`HealStatusModal` become
`TakeStrainModal`/`RecuperateModal`. Make Camp's own mechanic changed to match V0.6's new text
(clear one Condition, Recuperate separately, refresh Armor — replacing "2d6 Negative/1d6 Positive
Ranks, 1d6 Conditions"), pulled forward from Slice 4's nominal scope since the button directly
manipulated now-retired fields and had to be rewritten regardless. Armor's meaning changes from
Status-negation to Strain-negation, same controls.

**Combat was adapted to compile and keep working against the new harm model — not rebuilt.**
Retyping `CharacterStatus` broke every file touching Combat regardless of which slice was meant to
own it next, so this slice applies `WorkPlan-V0.6.md` Section B1's mapping table at the primitive
level only; the real rebuild (surprise, a Combat-Goal Potential rule, richer Boss content) stays
Slice 3's (`0.44.0`). What shipped: a new `EnemyStrainMark` type (an Enemy's own named counting
track — B1: "Enemies keep a counting track, they have no severity slots"); `PendingStatusOffer`
renamed `PendingStrainOffer`, carrying a plain `Amount` instead of `StatusName`/`Polarity`/`Rank`,
with a three-way resolution (apply, Resist, or take a Status) mirroring `TakeStrainModal`; Engage
Melee/Ranged now deals flat Strain rather than a named ranked Status; Cover became a static
reminder rather than an interactive picker (B1 turns it into a Boon/Disadvantage effect this app
can't compute without dice-rolling, which it doesn't do); Bolster/Halt/Impede/Brace/Repel updated
to their Strain/Bane/severity-band equivalents; Calculate/Brace grant the actor a Boon instead of a
ranked Status; and `applyCrumbleVulnerable()` is deleted (V0.6 drops Crumble's Vulnerable-4 grant
in Combat entirely). See `README.md` item 44 for the judgment calls made while building this.

**Two Adventure Moves (Keep Watch, Undertake a Journey) got the same forced-minimal treatment**:
their `giveStatus()` calls now push onto `Boons`/`Banes` instead, matching V0.6's own "the Alert
Boon, the Restless Bane" wording for Keep Watch — everything else about either flow is untouched,
still Slice 4's to rebuild properly.

**`normalizeSheet()`/`normalizeLibrary()` extended per the locked plan.** A missing `Strain`
backfills to an empty row, `Statuses`/`Boons`/`Banes` to `[]`, and `HealingTrack` to **0, not
full** — the mirror image of the old `Recoveries` trap, since a full Healing Track would falsely
downgrade an old sheet's Statuses the next time it advanced. **A legacy ranked-Status entry (no
`Severity`) is dropped on read, not translated** — `WorkPlan-V0.6.md` Section B2's "clean break"
call: there is no honest Rank-to-severity mapping. `seedPlay.ts`'s four demo sheets were
hand-authored fresh rather than mechanically converted for the same reason.

**Existing play data is a clean break**, same treatment the V0.5 migration's own slice 1 gave the
equivalent shape change — this is pre-release test data with no real users yet.

**Verification**: `npm run typecheck`/`npm run build`/`npm run test` all pass (408 tests across
`@asohav/shared`, `@asohav/server`, `@asohav/web`); the bundle-budget check measured 210.41 kB gzip
against the 220 kB cap (about 9.6 kB of headroom left for Slice 2's own always-visible content); the
responsive smoke test passed clean on the character-sheet route across all seven viewports and both
appearances.

**Not in this release, deliberately**: Skill/Flaw Tags becoming mechanical and the rest of
`computeRollBreakdown()`'s real roll-builder rework (Slice 2, `0.43.0`); Combat's own deeper rebuild
(Slice 3, `0.44.0`); re-authoring all 22 seeded Moves' `Results` text, which still describes ranked
Statuses in prose even though the mechanics underneath changed, plus the Make Camp/Keep Watch/Set
Out/Enjoy Downtime/End the Session flow rebuilds and the glossary sweep (Slice 4, `0.45.0`); any
real Enemy-side Boons/Banes representation, which V0.6 doesn't specify and this slice didn't invent.

## [0.41.0] — 2026-09-08T15:40:00Z

Finishes the two follow-ups `0.40.0` deliberately left open, both chosen by the repo owner: sweep
the type scale through every file `0.40.0` didn't reach, and give the test suite a way to see
layout that only exists after a tap. Client-side only — no server change, no migration, no
wire-contract change.

**This release also corrects three claims `0.40.0` made about itself.** Per this project's policy
its shipped entry is not edited (same treatment `README.md` item 7 gives the superseded
"14,000-line design doc" citations); the corrections live here.

### Fixed — corrections to `0.40.0`'s own claims

- **`0.40.0` did not fix an iOS zoom bug, because there was no bug to fix.** It claimed — in its
  CHANGELOG entry, its PR, and `CLAUDE.md` — to have discovered that tapping any sheet field zoomed
  the page on iOS, and fixed it. `layout.css` has raised every text control to 16px on a coarse
  pointer since **PR #68**, many versions earlier. What `0.40.0` actually shipped was a second copy
  of that rule, without the `.text-lg` opt-out the original carries. The duplicate is removed here
  and its only two real contributions — the `--fs-input` token in place of a hardcoded `16px`, and
  excluding checkbox/radio/range/color — folded into the rule that already existed.
- **`0.40.0` understated what it left behind by roughly 3x.** It reported "~140 literal font-sizes"
  in "the ~19 sheet files it didn't touch". The real figure was **405 declarations across 67
  files**, and the four panels it called converted were only partly converted — `StatusesPanel`
  still had 19 literals, `MotifPanel` 7, `PartyPlaybookPanel` 6. `tokens.css`'s own comment
  describing "19 distinct px font sizes in the sheet feature" as the *pre*-`0.40.0` state was still
  an accurate description of the state after it.
- **A fix committed earlier on this branch was aimed at the wrong axis.** It widened
  `.advantageRow`'s `gap` to stop an `InfoTooltip` overlay overlapping its neighbour; the overlap
  was vertical (44px wide by 5px tall) and `gap` there is horizontal, so it changed nothing. The
  real number: an 18px trigger (20px with border) under a 44px `.tap` overlay overhangs 12px
  vertically, against an 8px `margin-top`. Fixed properly here.

### Added

- **`apps/web/scripts/interaction-smoke.mjs`** (`npm run test:interaction`, a step in CI's existing
  `responsive` job). The at-rest smoke test never clicks, so an expander, an open editor, a modal or
  a drawer was entirely uncovered — which is how `0.40.0` shipped an overlapping-hit-area bug in the
  expanded Status row through a fully green suite. This drives ~21 states and reruns the same
  assertions on each.
- **`apps/web/scripts/hitChecks.mjs`** — the `::after`-aware hit rect, the 44px floor and the 2px
  overlap tolerance, now imported by both scripts instead of duplicated.

### Changed

- **Every literal px font-size in `apps/web/src` is gone** — 405 declarations across 67 files, plus
  119 `letter-spacing` literals. Per repo-owner decision the large display sizes map onto the
  existing six steps rather than extending the scale, so this is not a no-op repaint:
  `VirtuesPanel`'s Virtue score 26px → 23px, `LoadPanel`'s carried value 22px → 18px, and
  17/19/20/21px collapse to 18px.
- Three tracking declarations are deliberately still literals, each load-bearing for a measured
  budget documented in its own file: `AppShell`'s appearance picker (the bar needs 357px of a 360px
  viewport), `MotifPanel`'s `.tagHint` reset, and two lowercase-prose classes where a label tracking
  would be wrong.
- `MoveRollHelper` used the app's only native `<input type="checkbox">`, at 13×13 — the smallest
  touch target in the app, and an undocumented exception to `CheckboxRow`'s own doc comment claiming
  the app never uses one. Swapped to that existing primitive.
- Both drawer search fields (Moves, Glossary) were 34px tall. Pre-existing; fixed.
- `InlineEdit`'s editor was 26px tall — the read-only trigger grew to 44px on touch but the input
  replacing it carried nothing, so every tag and name editor in the app became an under-size touch
  target the moment it opened. A `0.40.0` bug, found by the new check on its first run.

## [0.40.0] — 2026-09-07T18:40:00Z

A density and readability pass over the character sheet, driven by direct iPhone testing feedback
from the repo owner rather than by an audit or a `Ruleset-V0.5.md` slice. Four screenshots (Party
Identity, Statuses, Background/Motifs, Looks) reported the same three complaints — wasted space,
clipped text, and player-authored values rendering larger than the labels above them. Pure
client-side: no server change, no migration, no wire-contract change.

**The root cause was that the app had no type scale and no spacing scale.** `tokens.css` carried
colour and font-family tokens and three content widths, and nothing else dimensional. The sheet
feature alone had accumulated **19 distinct px font sizes**, a third of them half-pixel
(`9.5`/`10.5`/`11.5`/`12.5`/`13.5`), none derived from `body`'s 14px — with 11 different
`letter-spacing` values across ~44 uppercase micro-labels that had no reason to differ. Size was
the one axis the project's own `theme-tokens` skill had nothing to enforce, which is exactly why
drift collected there and only there.

### Added

- **A type scale** (`--fs-label` 11px, `--fs-meta` 12, `--fs-body` 13, `--fs-lead` 15,
  `--fs-title` 18, `--fs-display` 23) and a **spacing scale** (`--sp-1`…`--sp-6`), plus
  `--track-label`/`--track-tight`. `--fs-label` deliberately *raises* the app's smallest text off
  10px: content should out-rank its own label by one step, not three, which is the reported "the
  words are bigger than most of the important labels" seen from the label's side.
- **`--fs-input: 16px` and a coarse-pointer rule applying it to every text control**
  (`layout.css`). iOS Safari zooms the whole page when a focused input is under 16px, and every
  text field on the sheet was 12.5–13.5px — so tapping *any* field on the reporter's own phone
  zoomed the page. Scoped to `(pointer: coarse)` like every other growth rule in that file, and
  placed in the `utilities` layer because a component's own `font-size` would otherwise outrank it.
- **`apps/web/src/styles/typography.module.css`** — shared `.label`/`.sectionLabel`/`.hint`/
  `.leadText` text roles, composed into panels rather than restated per file.
- **`components/InlineEdit.tsx`** — short authored text that reads as text until tapped, then
  swaps to an editor in place (commit on blur/Enter, cancel on Escape, optional remove).
- **`components/TagList.tsx`** — one wrapping tag row with its add control *inside* the wrap flow,
  replacing five hand-rolled implementations across three panels.

### Changed

- **A Status row is now one line**, and its Rank is drawn inside the box that represents it rather
  than as a separate digit beside the row (the separate `.rank` element is deleted). Boxes grew
  19px → 24px so a digit is legible; the per-box 44px hit slot is unchanged, because the coarse
  gap is derived from the box size. On a narrow row the six boxes collapse behind a single rank
  chip that expands them — six `<button>`s can never share a phone line with a name, since each
  needs its own 44×44 non-overlapping hit area.
- **Statuses' polarity-column floor rose 290px → `min(430px, 100%)`**, so a column only exists
  when it can host a complete one-line row. At 290px a 1440p monitor got three columns of 261px —
  each too narrow for the row inside it, so every Status on the widest supported screen fell back
  to the collapsed layout. Also fixes a latent bug the old value shipped with: a bare `minmax()`
  floor is a floor the track cannot go below, so at 360px the 290px column overran the 274px panel.
- **Looks, both Motif tag groups and both Party tag groups became `TagList` call sites.** Three
  Looks used to occupy three rows with the add button on a fourth, because each chip carried two
  44px controls and the add button sat outside the wrap flow.
- **Party Identity's four fields became a capped `auto-fit` grid** (`minmax(min(240px, 100%),
  320px)`) instead of a template-less grid that stacked at every width, and its two clipped
  placeholders were shortened. The cap is the load-bearing part: with `1fr` this full-width panel
  would hand back six near-400px columns at 2560px — a worse layout than the single column it
  replaced, just differently wrong.
- **Motif cards flow multi-column on a wide sheet** via `auto-fit`, and their Skill/Flaw tag
  columns pair at 440px rather than 520px (the old threshold assumed each column held a full-width
  input-plus-remove row; a `TagList` column is content-sized chips).
- **Three unrelated "add one of these" treatments became one** — an underlined text link, a dashed
  chip and an uppercase `btnSecondary` button.
- `button`/`input`/`select`/`textarea` now inherit `font-size` in `base.css`; previously an
  unstyled control fell to the UA default (~13.3px), not to body's 14px.

### Fixed

- **`--ink-85` was referenced in six places and never defined** (`PartyPlaybookPanel`,
  `MotifPanel`, `PartyAdvanceModal`, `CampActionsModal`), so those `color` declarations were
  invalid and silently fell through to inherited `--ink`. Now defined in both appearances.
- **`--ink-14` likewise did not exist**, leaving `border: 1px solid currentColor` on a Camp Asset
  card; repointed at `--rule`, which is the same value.
- The last viewport-keyed rule in `StatusesPanel` (`.addRow`'s `@media (min-width: 1024px)`)
  became a container query. Its own comment claimed it shared `.rowHead`'s threshold "for the same
  reason" — true when both were 1024px media queries, quietly false from `0.39.0` on.

## [0.39.0] — 2026-09-06T03:00:00Z

The second of two releases implementing `UIReviewRound_Handoff.md` — see `WorkPlan-0.39.0.md`.
`0.38.0` took the review's four **state** items; this release takes the four about **layout and
appearance**, plus the cross-cutting decision that Notice Board becomes the default appearance.
Pure client-side — no server change, no migration, no wire-contract change.

**Notice Board is now the default appearance, with a one-time forced reset and no migration
code.** `DEFAULT_APPEARANCE` flips to `'noticeboard'`; the storage key renames from
`asohav.appearance` to `asohav.appearance.v2` (`appearanceStore.ts`, `index.html`, `harness.html`)
so everyone falls through to the new default on first load with no marker/clear/write-on-load
logic needed — anyone who then picks Parchment keeps it, anyone already on Notice Board sees no
change. The old key is simply never read again.

**The Motif card readability bug (dark ink on dark cork under Notice Board) is fixed in this same
release**, since it becomes the default first impression the moment the flip above lands.
`MotifPanel.tsx` now wraps its three cards in a single `board`, each card `posting` (mirroring
`LooksPanel`'s already-correct chip treatment) — light paper under Notice Board, a no-op under
Parchment. No `tilt`: a Motif card is a full-width interactive row of text inputs, the same
carve-out `StatusesPanel`'s rows already have.

**`PeekCard` gets both halves of review item 7**: the unlabelled, hardcoded `Potential {n} / 5`
now reads `{Motif name}: Potential {n} / {library.settings.PotentialTrackLength}`, and the card
itself splits into two columns (identity + virtues left, statuses + footer stats right) once it
measures wide enough on its own — a new `container-name: peek-card` on `.card`, independent of
`.peekGrid`'s existing 768px viewport switch above it, which stays untouched.

**Background: Motifs 66% / Looks 33%, side by side, an explicit repo-owner layout call.**
`BackgroundPanel.tsx` gained a `.module.css` (it had none) and a two-column grid body — Motifs
`2fr` left, Looks `1fr` right, reusing `Panel`'s own `sheet-panel` container query rather than a
second one. JSX order is Motifs-then-Looks (not `order:`), so a keyboard user's tab order still
matches the wide layout's visual order; below the threshold it stacks, Motifs first. `MotifPanel`
itself gained a `motif-card` container of its own (each card queries its own width, not the whole
panel's, which item 4's split made a different, wider number) — the name/Potential head pairs up
side by side above ~380px, Skill Tags/Flaw Tags pair above ~520px, and vertical rhythm throughout
was tightened.

**Statuses: Positive/Neutral/Negative as columns — the riskiest CSS in this release.**
`StatusesPanel.tsx`'s three polarity groups now live in `.statusGroups`, an `auto-fit` grid
(`minmax(290px, 1fr)`, giving 1-up through most of the app's tested widths, 2-up at 1440px, 3-up
at the sheet's own ≥1800px wide step) — an empty group still renders its board with a muted "None"
line so a column never collapses to just a label. This **required** converting `.rowHead`'s
1024px viewport media query to a container query first (the one piece the 0.24.0 container-query
migration deliberately left unconverted): three columns share one viewport width, so a
viewport-keyed threshold can't tell a wide single column from a narrow one of three, and would
have fired the single-row six-pip template at exactly the width it overflows. The container lives
on the polarity group's own `board` (`container-name: status-col`), not the group wrapper, since
putting it one level up would fold `--board-pad` into the measured width and make the threshold
appearance-dependent. New threshold: `@container status-col (min-width: 510px)`, derived from real
numbers (see `StatusesPanel.module.css`'s rewritten comment) to reproduce today's behavior at
768px/1024px in both appearances and correctly refuse the single-row template at every
multi-column width.

**Correction 3 found `.sheet-pair` dead** — no call site left in `CharacterSheetPage.tsx` since
`AbilitiesSkillsPanel` was retired — and it's deleted from `layout.css` rather than kept as unused
CSS, with `.sheet-stack`'s own doc comment (and one dangling citation in `HomePage.module.css`)
corrected to describe the actual current render order.

Files: `apps/web/src/lib/appearances.ts`, `apps/web/src/store/{appearanceStore,appearanceStore.test}.ts`,
`apps/web/index.html`, `apps/web/harness.html`; `apps/web/src/features/sheet/{MotifPanel,BackgroundPanel}.tsx`
+ `.module.css` (new for `BackgroundPanel`), `StatusesPanel.tsx` + `.module.css`;
`apps/web/src/features/campaign/PeekCard.tsx` + `.module.css`; `apps/web/src/styles/layout.css`,
`apps/web/src/pages/HomePage.module.css`.

## [0.38.0] — 2026-09-06T01:00:00Z

The first of two releases implementing `UIReviewRound_Handoff.md`'s full UI review round with the
repo owner — see `WorkPlan-0.38.0.md`. This release is the four review items about **state**:
where a campaign is in its setup, who is waiting on what, and keeping it all live.
`WorkPlan-0.39.0.md` (`0.39.0`) takes the four about layout and appearance. No rules change —
`Ruleset-V0.5.md` is untouched.

**Realtime now covers `campaigns`/`memberships`/`characters`, closing a gap the review's "live
state" ask exposed.** A new migration (`0013_realtime_campaign_state.sql`) adds all three tables
to the `supabase_realtime` publication — their RLS SELECT policies were already the joinless shape
Realtime needs, but none of the three had ever been added to the publication itself, so no
subscription to them could ever have delivered anything. `useLiveCampaign.ts` subscribes to
`campaigns` (filtered on `id`, since the row *is* the campaign), `memberships`, and `characters`
(both filtered on `campaign_id`) alongside its existing tables; a new `useLiveHome.ts` hook,
unfiltered across the same three plus `party`/`bonds`, invalidates `['me']` so Home reacts to a
GM's phase change or a new membership without a refresh. **This migration must be applied by hand
after merge** — see `CLAUDE.md`'s Deployment section for why Render never does this automatically
and the three prior incidents this exact gap has already caused.

**`CampaignSetupChecklist`, the review's core ask**: a shared, three-lane (Signup / Party Creation
/ Playing) panel rendered once above the GM/Player split on the Campaign page, showing each
Player's character-creation and Ready status by name, with the GM's phase-advance actions moved
into it from the banner. Collapses to a one-line summary once the campaign is Playing rather than
unmounting. `MeResponse`'s per-membership shape gained `CampaignPhase` (`repo.ts`'s
`listMembershipsWithCampaignForUser` widened its select) so Home can show the same status without
a second round trip.

**Home splits into "Campaigns you run" / "Campaigns you play in" lanes**, each an `auto-fit` grid
so a user who only plays or only runs gets one full-width lane with no conditional CSS.
`CampaignTile` gained a phase badge and a "waiting on you" hint (no character yet, or not marked
Ready) for a Player membership still in Party Creation — the Home-side half of "what am I waiting
on." `PHASE_LABEL` moved out of `CampaignPage.tsx` into a shared `lib/phaseLabels.ts` so the two
call sites can't drift the way `AdvancementPanel`/`CampaignBonds`'s independent `TYPE_LABELS` maps
already have.

**Combat is now hidden until a campaign is actually Playing, in the UI *and* server-side.** A new
`assertPlayingPhase()`/`PlayingRequiredError` pair (`packages/shared/src/logic.ts`, mirroring
`assertPartyCreationPhase`) gates `POST /combat/start` with a 409; the client renders no Combat
heading at all — not even "No Combat right now." — for either GM or Player before Playing. `PUT
/:encounterId` and `/end` need no equivalent gate: `CAMPAIGN_PHASE_TRANSITIONS.Playing` is `[]`, so
with `/start` gated an Encounter can only ever exist in a Playing campaign. Clocks stay ungated —
legal pre-Playing, unchanged.

Files: `packages/shared/src/{api,logic,logic.test}.ts`; `apps/server/src/repo.ts`,
`apps/server/src/routes/combat.ts`, `apps/server/src/routes/{auth,combat}.test.ts`;
`supabase/migrations/0013_realtime_campaign_state.sql`; `apps/web/src/lib/{useLiveCampaign,
useLiveHome,phaseLabels}.ts`; `apps/web/src/pages/{HomePage,CampaignPage}.tsx` + `.module.css`;
`apps/web/src/features/campaign/{CampaignTile,CampaignSetupChecklist}.tsx` + `.module.css`;
`apps/web/src/harness.tsx`, `apps/web/scripts/harnessConfig.mjs`.

## [0.37.0] — 2026-09-04T21:20:00Z

Three independent repo-owner improvement requests against `0.36.0` — the release that closed out
the V0.5 migration — written up as `WorkPlan-0.37.0.md` and shipped together as one MINOR release.
Nothing here is a rules change.

**Campaign invites now send email, on a dual path, alongside the existing code/link (Issue 17).**
Sending an invite has always written an `invites` row and shown the GM a code to relay by hand;
that stays the authoritative mechanism. `apps/server/src/email.ts`'s `sendInviteEmail()` adds
best-effort delivery on top: Supabase Auth's `inviteUserByEmail` for an address with no account yet,
Resend (a third-party HTTPS API, via native `fetch` — no new npm dependency) for an address that
already has one, looked up via the same `listAuthUsers()` join `admin.ts`'s own user list already
relies on. Never throws — a provider failure returns a `{ delivered, via, error? }` result rather
than failing the request. The invite code also got wider (an 8-character alphanumeric code with a
uniqueness retry, replacing the old ~9,000-possibility 4-digit range) now that it's going out in an
emailed URL. `InvitesPanel.tsx` gained a Copy Link button and a Resend button per invite (peers of
equal weight, `.action-grid`), fed by a transient `Toast`; `JoinByCode.tsx` prefills its code input
from a `?invite=` query param, and `App.tsx` stashes that param through a first-time player's
email-confirmation round trip. See `CLAUDE.md`'s new "Architecture: campaign invites" section for
the full design, including the Supabase-dashboard custom-SMTP step this needs before the
`inviteUserByEmail` leg actually delivers, and `HANDOFF.md` open issue 22 for what still needs a
manual post-deploy check (email was not, and could not be, tested live from this sandbox).

**Adventure Prep panel: real responsive layout, plus an accessibility pass (Issue 18).** An audit
first confirmed touch targets, appearance tokens, and page chrome were already correct — no changes
there. What actually needed doing: `AdventuresPage`'s `.page` moved from the 640px `page-shell-form`
width to the 1280px `page-shell` (Adventure Prep is a multi-section working surface, not a
single-column form), and each Adventure card is now a named CSS container pairing its NPCs and
Locations ref-lists side by side once it measures wide enough, instead of one stacked column at
every width from 360px to 2560px. Card titles are real `<h2>`s and section labels real `<h3>`s (were
a `<span>`/`<div>` — screen-reader heading navigation used to skip the whole surface); the Villain
`<select>` gets an accessible name via `aria-labelledby` on its section heading; the NPC/Location
checkbox lists are grouped with `role="group"`, the same shape `FieldEditor.tsx`'s `multiref` fields
already use; the two authored-text hints get the shared `.prose` max-width; Concept/Type/Hook/
Villain move onto the shared `Field`/`Select` form primitives instead of duplicating their box
styling locally; and the Countdown's Advance/Back-up row uses `.action-grid` with affordance-only
disabling at the track's ends. Verified with the full responsive smoke test (both appearances,
seven viewports) and the screenshot script at 360/768/1024/1440/2560px. `GlossaryText` on Adventure
prose stays a real, recorded gap (`HANDOFF.md` open issue 21) — every candidate field is a live,
`onBlur`-committing `<textarea>`, and `GlossaryText` can't wrap an editable control.

**Write-in answers for `NPC.Type` and `Location.LocationType` (Issue 19).** A new opt-in
`allowCustom` flag on `FieldDef` (`packages/shared/src/schema.ts`) lets an author type a value
outside the enum's canonical options — scoped to exactly the two descriptive enums that drive no
branching game logic, never a blanket loosening of `FieldType: 'enum'` (`Villain`/`EnemyTemplate`'s
`Toughness`, which `applyToughness()` switches on, stays a plain enum). `FieldEditor.tsx` renders
the same freeSolo-autocomplete pattern `AddCampAssetModal.tsx` already established (an `<input>`
backed by a `<datalist>`) for an `allowCustom` field; `validateLibrary()` surfaces a non-canonical
value as an informational validation issue, matching how dangling refs and unresolved glossary tags
are already reported. Custom user-defined fields per entry, glossary auto-linking on the three GM
stat-block collections, and player-facing NPC/Location views were all offered to the repo owner and
not selected — read their absence as a decision, not an unfinished TODO.

No migration in this release — persisted per-invite delivery status wasn't selected, and the
write-in change is an additive, JSONB-blob-compatible type widening.

## [0.36.0] — 2026-09-03T17:21:00Z

**Slice 9 of the V0.5 ruleset migration** (`WorkPlan-V0.5.md` section C): Adventures — the fourth
app surface, alongside the Character Sheet, Content Admin, and the Campaign Shell. **The nine-slice
V0.5 migration this project has been running since `0.28.0` is complete as of this release.**

**Adventure prep, GM-only, at `/c/:campaignId/adventure`.** `Adventure` (`packages/shared/src/
types.ts`): Concept, Type (the doc's six named Adventure Types — Offensive/Stand/Race/Mission/
Mystery/Journey — each carrying its own "Elements to include" hint in `ADVENTURE_TYPES`), Hook, a
`VillainId`/`NpcIds`/`LocationIds` reference into `0.35.0`'s own Villain/NPC/Location collections
(an Adventure references them, it doesn't redefine them), floating Secrets (`{Text, Revealed}` —
deliberately no `LinkedToIds`, since the doc is explicit a Secret never ties to one specific NPC or
Location), and a Countdown. New campaign play-state table (migration `0012`, same joinless-RLS-
policy shape `clocks`/`combat_encounters` already established) plus a GM-only `adventuresRouter`
(create/save/remove, all three `Role === 'GM'`-gated — unlike Clocks, where any campaign member may
act).

**The Countdown reuses `Clock`'s tick-and-clamp mechanic as an embedded field, not a real linked
`Clock` row — a design tried and deliberately reversed mid-slice.** `Adventure.CountdownSteps` ships
the doc's own five named steps (Seed/Bloom/Wilt/Wither/Rot — the doc's own prose promises six and
never names a sixth; that inconsistency is carried forward unresolved, not silently fixed here) with
freeform GM prep text; `Adventure.CountdownMarks` tracks progress via `tickAdventureCountdown()`
(`packages/shared/src/adventures.ts`), the same clamped-delta shape as `clocks.ts`'s `tickClock()`.
A real linked `Clock` was the first cut, matching `WorkPlan-V0.5.md`'s own "a Countdown is a clock
variant" scope note — reversed once it became clear every existing Clock in this app is fully
player-visible (`ClocksPanel.tsx`, Realtime-synced), while the doc is explicit an Adventure's own
Countdown is the GM's *off-screen* reference, distinct from a *Threat* (also Countdown-kind, but
"player facing"). Realtime made this non-negotiable, not just a UI nicety: a `postgres_changes`
payload carries a table row's full data to every subscribed client regardless of whether the
handler reads it, so a linked Clock would have leaked Countdown progress to every player's browser
the instant the GM ticked it.

**That same fact is why Adventures are GM-only end to end — a first for this app.** Every prior
slice assumed the whole table should see the same state; an Adventure's Concept, Villain, and
Secrets are spoiler content by the doc's own design. Rather than build this app's first field-level
access-control mechanism, the whole surface stays GM-only instead: `campaign.ts`'s bootstrap route
only fetches `adventures` for a GM membership (mirroring `invites`), and `AdventuresPage.tsx`
redirects a Player who navigates to the route directly. `useLiveCampaign.ts` deliberately does not
subscribe to the `adventures` table at all — only the GM ever edits one, so a GM's own page just
refetches normally. See `README.md` item 39 for the full writeup (one decision, two consequences —
the Countdown's embedded shape and the surface's GM-only scope, not two independent calls).

**Seed content, harness-only** (Adventures are campaign play-state, not seeded library content — no
`seedPlay.ts` change): the responsive-smoke/screenshot `?adventures=1` fixture references `0.35.0`'s
own Grizza/Rosa/Skreel/Hollow Bend/Sunken Tomb/Whispering Wood seed data, mid-Countdown with one
revealed and one unrevealed Secret, so `AdventuresPanel`'s populated state gets coverage too.

**Verification**: `npm run typecheck`/`build`/`test`/`lint` all green (`npm run lint`'s
`--max-warnings` ceiling moved from 61 to 62 — `repo.ts`'s new `listAdventuresForCampaign()` needed
the same `(r: any) => ...` row-mapping cast every sibling list function in that file already uses).
`npm run test:responsive`, both the new `adventure prep` routes scoped and the full unfiltered
suite, came back clean on the first run (both appearances, all seven viewports). Bundle stays within
budget (209.12 kB gzip vs. the 220 kB cap) — `AdventuresPage`/`AdventuresPanel` are lazy-loaded.

## [0.35.0] — 2026-09-03T15:58:00Z

**Slice 8 of the V0.5 ruleset migration** (`WorkPlan-V0.5.md` section C): GM stat blocks. Villains,
NPCs, and Locations become real, authored Content Admin collections, extending the existing
`library.enemies` pattern rather than inventing a new one — no new server route or admin-page code,
since Content Admin's existing generic CRUD/validation/nav machinery covers a new collection once
it has a `schema.ts` entry, the same "zero new plumbing" precedent `CampAssetTemplate` set in
`0.34.0`. Unlike every slice since 4, this one needed no repo-owner decision — `WorkPlan-V0.5.md`'s
own scope statement was specific enough to build directly. See `README.md` item 38.

**Three new collections**: `Villain` (Name, Aspects, Goal, Scar, Skill Tags, Resources, Powers,
Attacks, Resistances, Vulnerabilities, Toughness, Status Limits), `NPC` (Name, Aspects, Type — the
doc's nine values from Meddler to Witness — Goal, Hero Connection, Skill Tags, Combatant?, Status
Limits), and `Location` (Name, Aspects, Location Type — the doc's nine values from Nexus to Wilds —
Custom Moves), all in `packages/shared/src/types.ts`/`schema.ts`. Authored content only: nothing
wires a Villain into Combat as a spawnable Boss `CombatParticipant` — `Villain` reuses `ToughnessTier`/
`EnemyStatusLimit` so the data shape lines up if a later slice bridges the two, but that bridge is
out of this slice's scope.

**A new `statusLimits` field type replaces raw, unvalidated `json` for Status Limits everywhere,
not just on the two new collections that needed it.** `WorkPlan-V0.5.md` Section B hazard 1 named
`EnemyTemplate.StatusLimits` as unvalidated raw JSON and flagged slice 8 as the most likely place it
would actually get fixed. `StatusLimitsEditor` (`FieldEditor.tsx`) is a real, repeatable
`{StatusName, Limit}` row editor; `validateLibrary()` (`adminLogic.ts`) checks every entry has a
non-empty Status name and a Limit greater than 0. Retrofitting `EnemyTemplate.StatusLimits` onto the
same field type, once it existed for `Villain`/`NPC` anyway, cost nothing extra and closed the
hazard for Enemies too.

**Seed content is drawn from `Ruleset-V0.5.md`'s own worked example**, not invented: Grizza the Tall
(the doc's only fully worked Villain, flavor text and Toughness/Status-Limits stat block included)
plus two NPCs and three Locations pulled from the same goblin-clan/ancient-tomb material the doc
introduces her with — Rosa the Blacksmith is the doc's own named Hook figure. Three new glossary
terms (Villain, NPC, Location) were added alongside them.

**Verification**: `npm run typecheck`/`build`/`test` all green (`packages/shared` unchanged at 218
tests — the new fields extended existing `normalizeLibrary` assertions rather than adding new test
cases; `apps/server` grew to 115, +4 for `statusLimits` shape validation; `apps/web` unchanged at
35), `validateLibrary(seedLibrary())` returns zero issues across every collection, and the bundle
stays within budget (208.73 kB gzip vs. the 220 kB cap — Content Admin is behind `React.lazy`, so
none of this slice's UI touches the first-load bundle at all). `npm run test:responsive` scoped to
the `content admin` route came back clean across all seven viewports and both appearances.

## [0.34.0] — 2026-09-03T15:20:00Z

**Slice 7 of the V0.5 ruleset migration** (`WorkPlan-V0.5.md` section C): Party Playbook & Camp.
The party gets its own shared identity — Motif, Quest, Skill/Weakness Tags, a Path, a changeable
Goal — and Camp Assets, and four Adventure Moves that shipped as reference-text-only in `0.30.0`
(Make Camp, Keep Watch, Undertake a Journey, Enjoy Downtime) become real guided flows. Three
repo-owner decisions, via `AskUserQuestion`, scoped this before any code — see `README.md` item 37.

**Party identity is freeform, not picked from a catalog.** `Party` gained `Motif`/`Quest`/
`SkillTags`/`WeaknessTags`/`Path`/`Goal` (`packages/shared/src/types.ts`) — V0.5 names no Party
Playbook catalog to pick from (Playbooks themselves are still doc-marked "Coming Soon"), so these
are plain text any campaign member can edit, the same treatment Quests and Bond Moves got before
any catalog existed for those either. `PartyPlaybookPanel.tsx` renders them on the Character Sheet,
the same home Rapport/Bonds already have despite being party-shared data too. Progressing a full
Rapport track now offers a real choice (`applyPartyRapportAdvance()`, replacing
`clearRapportForPartyLevel()`): add or remove a Skill/Weakness Tag via the shared
`PartyAdvanceModal.tsx` (also used by `EndSessionModal.tsx`) — Gain a Party Improvement stays
unavailable, since the doc names no Party Improvement trees at all.

**Camp Assets are a hybrid catalog-or-freeform pick**, a genuine third shape rather than either of
this app's two existing authored-content patterns (a pure library pick can't take a table's own
custom entry; Combat's ad-hoc-or-library pattern carries an admin-only "save to library" write
unsuited to a flow any player can run). `CampAssetTemplate` is a new, ordinary schema-driven
Content Admin collection (`Name`/`Description`/`Tier`/`Effect`); `AddCampAssetModal.tsx` backs a
plain text input with a native `<datalist>` of catalog names — typing a match autofills and links
`RefId`, typing anything else stays a fully custom entry — with no new dependency.

**Four Adventure Moves became real guided flows**, built on this app's existing "player reports
the tier, the engine applies the mechanical change" pattern (`MoveRollHelper.tsx`'s Hold grants,
the Subdued flow) rather than any new dice-adjacent mechanism; `TierChoiceRow.tsx` factors out the
repeated 10+/7-9/6- button row shared across every flow's several rolls. `CampActionsModal.tsx`
covers what `StatusesPanel.tsx`'s pre-existing "Make Camp" button doesn't already handle (personal
Status/Condition/Armor/Recoveries reset shipped earlier and is unchanged): advancing a Bad Guy
Clock, an eligibility reminder for Advancement, and the doc's own Camp Actions (Party Level + 1
per player, spent on the Party Goal, a personal Quest, a Camp Asset, or a project Clock).
`KeepWatchModal.tsx` runs the GM's "roll + Nothing" then a volunteer's Virtue roll — a Status grant
named for "one party member"/"the volunteer" other than the roller is scoped to the viewer's own
sheet only, since this app has no `PendingStatusOffer`-style mechanism outside Combat.
`UndertakeJourneyModal.tsx` runs Loadout, Scout Ahead, and Venture Forth. `EnjoyDowntimeModal.tsx`
covers all seven named activities — Rest, Recover, Carouse (routes through the existing Bond
handshake), Acquire, Train, Pivot, and Advance (ticks a real Clock).

**Bundle budget raised from 208 kB to 220 kB gzip, deliberately, per the check's own documented
policy** — `PartyPlaybookPanel` is real, necessary always-rendered sheet content (like
`AdvancementPanel`), and even after lazy-loading everything deferrable (the four guided-flow
modals, `PartyPlaybookPanel` itself with no render condition, and the shared
`PartyAdvanceModal`/`AddCampAssetModal`) the measured first-load gzip landed at 208.74 kB. See
`CLAUDE.md`'s "Architecture: Party Playbook & Camp" section for the full numbers.

## [0.33.0] — 2026-09-03T11:40:00Z

**Slice 6 of the V0.5 ruleset migration** (`WorkPlan-V0.5.md` section C): Clocks — the first
genuinely new play-state subsystem since Combat shipped in `0.14.0`-`0.16.0`. `Planning Docs/
Ruleset-V0.5.md`'s own "Clocks" chapter is explicitly marked "WIP" and names six variants (Basic,
Threat/Quest, Long-Term Project, Progress, Linked, Mission, Tug-of-War) but gives only one — Basic
— a complete mechanic; the doc even asks itself whether Threat and Quest are the same thing without
answering. Two repo-owner decisions, via `AskUserQuestion`, scoped this before any code — see
`README.md` items 35-36.

**Clocks collapse to three `Kind`s, not six shapes.** `Basic` gets the doc's actual mechanic:
Success/Failure tracks, a Hero risking 1-3 Headway before rolling, 10+/7-9/6- resolving per the
doc's own table (`applyClockRoll()`, `packages/shared/src/clocks.ts`), auto-resolving the Clock the
moment either track fills. `Countdown` covers Threat/Quest/Mission/Progress/Long-Term-Project as one
GM-ticked single track (+1/+2/+3, matching the doc's own "tick one/two/three segments" language) —
Threat and Quest are treated as one concept, the same "doc contradicts itself, pick the usable
reading" call already made for Bond/Kin/Kith. `TugOfWar` is Countdown's single track but can also
move down. Linked Clocks aren't a fourth Kind: `Clock.UnlocksClockId` is a plain reference a
prerequisite Clock carries to the Clock its Success resolution unlocks (`isClockLocked()`) — the
target Clock still displays, just marked Locked, rather than hidden.

**The losing side's spend menu (up to 4 Headway, 1-for-1, on four listed effects) stays freeform
and logged, not mechanically enforced.** Two of the four effects name "Advantage/Disadvantage
Forward" — V0.5's term (seen elsewhere, e.g. Discern the Truth's "+1 Forward") for a bonus that
applies to the very next roll. Building that for real would mean a new persisted per-character
pending-roll-modifier concept consumed by whichever roll comes next — a genuinely new cross-cutting
mechanic well beyond Clocks themselves, and more than this slice's own scope calls for. Clicking a
spend option just logs what was chosen to the Clock's own History for the table to enact.

**New play-state, not a JSONB-field bolt-on**: `Clock`/`ClockKind`/`ClockHistoryEntry`
(`packages/shared/src/types.ts`) back a new `clocks` table (migration `0011`, the same
joinless-RLS-policy/Realtime shape `combat_encounters` established in `0010`) — the first new table
since Combat's own. Unlike an Encounter, several Clocks can be open in a campaign at once (layered
obstacles, a Threat running alongside a Basic Clock), so `CampaignBootstrap.clocks` is a full list,
not a single "active" pointer; a new `ClocksPanel.tsx` (`apps/web/src/features/clocks/`, lazy-loaded
like `CombatPanel` to protect the bundle) renders inline on the Campaign Shell for both GM and
Player views, independent of whether Combat is running.

**Verification**: `npm run typecheck`/`build`/`test` all green — `packages/shared` grew to 213
tests (+18 for `clocks.ts`'s pure functions), `apps/server` to 111 (+15 for the new `clocks.ts`
routes' authorization/archive-freeze/CRUD coverage). Bundle stays within budget but only just:
207.13 kB gzip vs. the 208 kB cap, under a kilobyte of headroom left — flagged in `HANDOFF.md` as a
real constraint the next slice needs to actively watch, not a one-off note.

**Fixed in passing**: a screenshot spot-check caught the new Clocks panel's "New Clock" button
rendering nearly invisible under Notice Board — a same-specificity `composes: btnSecondary`
override losing the cascade, apparently because a lazy-loaded chunk's CSS is injected after the
main bundle's. Checked whether the same pattern existed elsewhere rather than assuming this was
isolated: `EncounterView.module.css`'s identical-shaped `.lightButton` (the Combat Defiant Goals
"Declare" button, also lazy-loaded) had the exact same bug. Both fixed with a doubled-selector
specificity bump (`.lightButton.lightButton`), each verified by rebuilding and re-screenshotting.

## [0.32.0] — 2026-09-03T02:50:00Z

**Slice 5 of the V0.5 ruleset migration** (`WorkPlan-V0.5.md` section D): the Combat update. The
live Encounter view was built against a "Combat Basics V2.2" draft that "Architecture: the ruleset
and where it lives" (`CLAUDE.md`) already established was never actually committed to this
repository; this slice brings it up to `Ruleset-V0.5.md`'s own Combat Basics text. MINOR per the
versioning policy — new functionality, no live production data affected (same sandbox-networking
caveat as `0.31.0`; `HANDOFF.md` open issue 11 is unchanged).

**Before any code, an Explore agent catalogued the existing implementation precisely and the
findings went back to the repo owner, not into the plan on assumption** — the same discipline
slice 4 used for its own two surprise findings. Two things `WorkPlan-V0.5.md` called "not built"
already worked (Armor already costs 1 AP in Combat, via `EncounterView.tsx`'s `defend()`; Help was
already fully wired and already matched V0.5's wording), one Gambit (Repel) had a doc-stated
formula the code deliberately left freeform since `0.15.0` because no formula used to exist, and
Boss-Enemy content in the doc turned out to be bespoke per-boss flavor text, not a generalizable
mechanic. All four were put to the repo owner via `AskUserQuestion` before scoping any code — see
`README.md` items 31-34 for the full writeup of each decision.

**Per-unit turn order replaces the old single `ActingSide` toggle.** `Encounter.ActingParticipantId`
(whose turn it is) and `Encounter.PairedParticipantId` (for "two Heroes act together as one pick")
are new fields; `endTurn()` (`packages/shared/src/combat.ts`) recharges AP and marks
`HasActedThisRound` only for the acting participant (and partner, if paired) — the actual "AP
recharges at the end of that Hero's own turn" rule, replacing the all-at-once round reset
`startNewRound()` used to also do. `startNewRound()` narrows to just clearing everyone's acted flag
at a round boundary; its own test was updated to confirm AP is untouched. `nextActor()` suggests
which side goes next under the alternating-with-leftovers-act-consecutively rule — a default only,
never enforced: the GM can always set `ActingParticipantId` to a different participant via the two
new selects in `EncounterView.tsx`'s header. The old "Toggle Acting Side" button is gone; `ActingSide`
is now set by rolling Initiative or by `nextActor`'s own suggestion after End Turn.

**Repel is automated, reversing the `0.15.0` decision to leave it freeform-logged only**
(`README.md` item 16 is superseded by item 32). `repelPushBands()` reuses the highest Negative
Status Rank on the target as the push distance in bands, applied via the existing `shiftRange()`.
Resist — the one Reaction Move among the five named in V0.5 that was still genuinely unbuilt — is
wired as a small optional "target's Mettle" field on the Repel Gambit row in `CombatMoveModal.tsx`
(`ChosenGambit.ResistMettle`), reduced via `resistForcedMovementBands()` before the push commits,
and as a standalone, always-available "Resist a forced push" button in `EncounterView.tsx`'s
Reactions section (self-reported bands pushed, same manually-triggered pattern already established
by Opportunity Attack) rather than a new persisted pending-offer type — Range isn't ownership-gated
the way Statuses are, so there's no cross-client write this app couldn't already make in one step.
Seize and Other stay freeform; both are still genuinely open-ended in the doc.

**Cover**: `CombatMoveModal.tsx` now accepts the target's own Statuses and offers a "Target's Cover"
picker — any of the target's Positive Statuses, or None — whose Rank subtracts from the displayed
and applied roll total, the same transparency pattern `StatusSources` already uses for the actor's
own Statuses. Deliberately not a hardcoded match against "Cover"/"Hidden"/"Invisible": the doc's own
examples are illustrative, not exhaustive, and this app already shows every Status transparently for
the table to judge rather than pattern-matching Status names elsewhere. See `README.md` item 33.

**Boss Enemies get minimal wiring, not a full mechanism** (repo-owner decision, `README.md` item
31): `CombatParticipant.IsBoss`/`GambitCharges` (also on `EnemyTemplate`, both threaded through
`newParticipant()` and Content Admin's `enemies` schema) give a Boss its own numbered Gambit-charge
pool — a plain stepper on `EnemyCard`, not simulated Gambit content — and reaching a Status Limit no
longer auto-sets `Defeated` for a Boss the way it does an ordinary enemy (`t.IsBoss` guards in
`EncounterView.tsx`'s `applyToEnemy`/`applyGambits`). Instead a derived "Last Stand" badge appears
(reusing the existing `isEnemyDefeated` check), and the GM marks it defeated manually once the
fiction says so. A "Boss Acts" button pair (Melee/Ranged, `free: true` — no AP cost, same flag
Opportunity Attack uses) in a new header section reminds the GM a Boss gets an action after every
Hero's turn; `Unstable` was already free once `IsBoss` threading landed, since it's derived purely
from `StatusLimits`, unrelated to `IsBoss`. The abilities a Last-Stand or Unstable Boss narrates
(Grizza's "Fall to my Power!", etc.) stay freeform GM content, same as the 25 Improvement Trees'
placeholder nodes in `0.31.0`.

**Combat's start form now asks V0.5's actual Combat-Loop-step-1 questions and computes a real,
two-branch Rapport delta** — closing `HANDOFF.md` open issue 13 for good, not just surfacing it.
`combatStartRapportDelta()` (`packages/shared/src/combat.ts`): initiating grants +1 (+2 if every
Hero shares the fight's goal); not initiating grants -1 only if the party is also ill-prepared or
off-balance; a fair fight the Heroes didn't start and aren't unready for gets no change.
`apps/server/src/routes/combat.ts`'s `/start` route computes this server-side from three booleans
the GM answers on `CombatPanel.tsx`'s start form (reusing `CheckboxRow`) and writes the Rapport
change in the same request that creates the Encounter, so a failure on either side can't leave one
half done.

**Doc corrections, no code change** (`README.md` item 34): `CLAUDE.md`'s former "not built" claims
for Armor-costs-AP-in-Combat and the Help Reaction Move are replaced with accurate descriptions —
both already shipped, in `0.16.0`/`0.18.0` respectively; the V0.5 Combat section's blockquotes are
updated to reflect exactly which of the five named mechanics remain unbuilt (Cover and Boss enemies
now landed this slice; side-alternating full turn order and AP-per-turn recharge are the model this
slice approximates, not literal grid/geometry; a rendered grid stays out of scope per the
already-standing `README.md` item 15 decision).

## [0.31.0] — 2026-09-02T23:45:00Z

**Slice 4 of the V0.5 ruleset migration** (`WorkPlan-V0.5.md` section C): Improvements. The flat,
Tier-gated `Advancement`/`AdvancementTrack` list is retired; `library.improvementTrees` (25 rows —
11 Combat + 14 Narrative, named and themed directly from `Ruleset-V0.5.md`) and `library.improvements`
(each node's tree, Starting flag, and prerequisites) replace it. Gating is **DAG-only, no Tier or
Level** — `improvementState()` (`packages/shared/src/logic.ts`) reports held/available/locked for a
node against a holder's already-taken Improvement Ids; a Starting Improvement is always available,
anything else needs a same-tree prerequisite already held. MINOR per the versioning policy — new
functionality and a data-shape change, but no live production data affected (see "Sandbox network
constraints" in `CLAUDE.md`; open issue 11 in `HANDOFF.md` — nothing has been created against these
shapes in a real browser yet).

**Two repo-owner decisions before any code, not one — the known Level-vs-Tier gate, and a deeper
content gap the migration hadn't actually gone looking for yet.** `Ruleset-V0.5.md` states the Hero
Improvement gating rule twice, contradicting itself: "Motif Advancement — Potential" (the section
this app has been built against since slice 2) gates purely on the prerequisite chain, no Tier or
Level; a separate "Level Up"/"Progress the Party" section (under Make Camp) states the old
`Advancements.md` Tier-1..4-and-Level formula verbatim, contradiction included. Put to the repo
owner directly rather than guessed: **gate on the DAG only** — the Tier/Level section is leftover,
unreconciled draft text. `CharacterSheet.Level`/`Party.PartyLevel` still exist as plain running
counters (incremented on every Motif-Potential-track/Rapport-track clear) since both doc sections
agree something called Level should go up, but they gate nothing. Separately, while seeding the 25
trees to test the DAG against, found `Ruleset-V0.5.md` names every tree but authors **zero actual
nodes** on any of them — no Starting Improvement, no prerequisite line. Also put to the repo owner:
**build the real mechanism now against clearly-labeled placeholder nodes** (a Starting Improvement
plus one chained node per tree, `Effect` text reading "Placeholder…") rather than inventing real
game content or waiting. See `HANDOFF.md` open issue 12 and `README.md` item 30 for the full
writeup, including a correction to a `0.28.0`-era assumption (`README.md` item 8) that V0.5 would
add "tiered Bond Improvements keyed to Bond Level" — the doc's "Bond Track + Improvements" section
turned out to have no content at all, not even tree names, so Bond and Party Improvements stayed
out of scope entirely (no slice assigned).

**Content Admin's Advancements group is now Improvements**, with plain nav/list/detail screens for
`improvementTrees` and `improvements` generated the same schema-driven way as every other
collection — the old track-split synthetic-nav-key machinery (`ADVANCEMENT_TRACK_VIEWS`,
`resolveAdminView`, `AdminListPane`'s `trackFilter`) is gone, since neither new collection needs
special-casing. `validateImprovementDag()` (`apps/server/src/adminLogic.ts`) checks the whole graph
in the Validation panel: a prerequisite on a different tree, a prerequisite cycle, or a non-Starting
node with no path back to a Starting Improvement on its own tree are all flagged by name.

**`MotifPanel.tsx`'s "Gain an Improvement" option is real now**, not the disabled stub slice 2/3
left behind. A new `ImprovementTreePicker.tsx` browses all 25 trees grouped by Category, showing
each node's held/available/locked state; picking an available node clears the Motif's Potential
track, adds the Improvement to `CharacterSheet.Improvements`, and logs it to history — deferred
until an actual pick is made (unlike the other three advance options), since backing out of the
tree browser should cost nothing. The party-Rapport side of the old picker is gone entirely:
`AdvancementPanel.tsx`/`EndSessionModal.tsx` now clear a full Rapport track via a plain
`ConfirmModal` that raises `PartyLevel`, rather than opening a picker with no real Party Improvement
content to offer (`ForgeBondPicker.tsx`, renamed from `AdvancementPicker.tsx`, is now solely the
Forge-a-Bond text writer — the only thing `PickerState` still opens a modal for).

**Verification**: `npm run typecheck`/`build`/`test` all green; `npm run test:responsive` run
scoped to the character-sheet and content-admin routes (both touched this slice) across all seven
viewports and both appearances, both clean. As with slices 1-3, **none of this has been
live-verified in a real browser** (`HANDOFF.md` open issue 11).

## [0.30.0] — 2026-09-02T22:00:00Z

**Slice 3 of the V0.5 ruleset migration** (`WorkPlan-V0.5.md` section C): Moves & glossary. All 22
V0.5 Moves (10 Basic, 12 Adventure) are now seeded with schema-validated result tables, Hold
becomes a first-class mechanic granted directly by two Moves, Advantage/Disadvantage gets real
detectable state for the two triggers this slice's own scope can reach, and the glossary gained
four new terms. MINOR per the versioning policy — new functionality, no breaking data-shape change
(unlike slices 1-2, nothing here needed a data wipe).

**All 22 Moves, replacing a partial roster.** The pre-existing seed had already picked up V0.5
vocabulary (Bond, Motif-neutral phrasing) incidentally from slices 1-2's rename passes, but named
two Moves ("Trust Your Gut", "Find the Answer") that don't exist in `Ruleset-V0.5.md` and was
missing four of the twelve Adventure Moves entirely. Both are replaced by a single, correctly
named **Discern the Truth** (Wit or Heart, player's choice — same `VirtueId: null` pattern already
used for Invoke Expertise/Take a Risk), and **Aid**, **Keep Watch**, **Undertake a Journey**, and
**Enjoy Downtime** are newly seeded. The last three ship as reference text only — real result
tables, but no new guided-flow UI — since building their guided flows is explicitly slice 7's job
(`WorkPlan-V0.5.md` section A3); Keep Watch and Undertake a Journey are each genuinely two rolls
that don't fit one Move's single `Results` slot, so their second roll's outcomes are written into
`Description` as prose rather than inventing a second Move V0.5 itself doesn't name.

**`Move.Results`/`PlayerVariantResults` gained real schema validation**, closing
`WorkPlan-V0.5.md` section B hazard 1 for Moves specifically (not for `Ability.Effects`/
`EnemyTemplate.StatusLimits`, left as raw `json` — Abilities are retired, `EnemyTemplate` wasn't
touched this slice). A new `moveResults` field type replaces the old unvalidated `json` field in
Content Admin: a structured Tier3(10+)/Tier2(7-9)/Tier1(miss) editor (`FieldEditor.tsx`) with each
tier's Description, Options, and Choose-count, and `validateLibrary()` now flags a missing
Description or a Choose-count higher than the number of listed Options.

**Hold is granted mechanically by the two Moves whose grant is a literal number.** Assess the
Situation (10+: 3, 7-9: 1) and Discern the Truth (10+: 2, 7-9: 1) carry a new typed `HoldGrant`
field; `holdGrantForTier()` (`engine.ts`) applies it once the player reports which tier they hit,
via a new control in `MoveRollHelper.tsx` — the same "report the tier, the engine applies the
mechanical change" pattern this app already uses for Statuses and Conditions. A tier offering a
*choice* of how much Hold to take (Assess the Situation's "hold 1, or hold 2 and choose one
complication") is represented by its guaranteed minimum; the extra Hold from taking the
complication is the player's own call, same as every other optional consequence this app leaves as
reference text. `CharacterSheet.Hold` is now visible outside `EndSessionModal` for the first
time — a read-only readout alongside Wealth/Treasure/Recoveries in `StatusesPanel.tsx`, since Hold
can change mid-session now instead of only at End the Session.

**Advantage/Disadvantage gets real state where this slice's own scope gives the app something to
detect** — a real reversal of `0.20.0`'s deletion of `AdvantageToggle.tsx`, but only this far. A
new `Move.AdvantageTrigger` (`'wealthSpend' | 'selfReport'`) drives two of V0.5's three named
triggers in `MoveRollHelper.tsx`: Follow a Lead spends 1 Wealth for a real Advantage flag (an
actual roll-scoped state, not just explanatory text); Consult the Past sets it from a
self-reported "I have a written record" checkbox. Once active, the roll guidance switches from the
usual +modifier line to "Roll 3d6 and keep the best two." **The third named trigger — Venture Forth
without Scouting Ahead — has no roll UI to attach to this slice**, since Undertake a Journey ships
as reference text only (above); it's deferred to slice 7 alongside that Move's guided flow, not
silently dropped. Every other Move keeps the informational-only tooltip unchanged.

**Glossary**: four new terms — Wealth, Treasure, Advantage (aliased to Disadvantage), and Attrition
(recorded as undefined-by-design, per `Ruleset-V0.5.md`'s own gap — see `WorkPlan-V0.5.md` section
D item 11). No V0.4-era dangling terms were found needing retirement — the standalone "Kin" term
had already merged into `g-bond` in slice 1, and "Theme" was already removed with the Motif system
in slice 2.

**Not in this release, deliberately**: guided-flow UI for Make Camp/Keep Watch/Undertake a
Journey/Enjoy Downtime (slice 7); the Venture-Forth-without-Scouting Disadvantage trigger (no
Journey UI yet); anything Improvement/Level/Tier-related (slice 4, still blocked on the
Level-vs-Tier rules question).

## [0.29.0] — 2026-09-02T19:00:00Z

**Slice 2 of the V0.5 ruleset migration** (`WorkPlan-V0.5.md` section C): character identity.
The single Theme — and the entire library-authored Theme/Quest/Skill/Ability catalog — retires in
favor of **three Motifs** per character, each with player-written Skill Tags, Flaw Tags, its own
0–5 Potential, a Quest, and three Act Breaks + three Forsakes. MINOR per the versioning policy: a
breaking change to `CharacterSheet`, with no translation path from the pre-0.29 shape (the play
data wiped in slice 1 stays empty, so no migration is needed).

**Motifs replace Theme and Abilities/Skills.** `CharacterSheet.Theme`/`AbilityIds`/`SkillIds` are
gone; a fixed-length `Motifs: CharacterMotif[]` (three slots) carries each Hero's identity. The
library now seeds 13 Motifs (`library.motifs`) with their Skill/Flaw example lists from
`Ruleset-V0.5.md`, and Content Admin loses the `themes`/`quests`/`skills`/`abilities` collections
entirely — tags and Quests are now written by the player, not picked from an authored catalog.
The Ability effect engine (which fed `computeRollBreakdown`'s permanent bonuses and
`MoveRollHelper`'s conditional bonuses) is removed with them; V0.5 has no Abilities, so the roll
math now stops at Virtue + Condition + Status.

**Potential becomes per-Motif.** The single character-level `Advancement.Potential` and its
Tier-gated picker are gone. Each Motif carries its own Potential; filling it clears the track and
offers add-a-Skill-Tag, add-a-Flaw-Tag, remove-a-Flaw-Tag, or a `GainImprovement` option that is
stubbed (disabled with a slice-4 note) until Improvements land. Motif Quests track three Act
Breaks and three Forsakes; three of either complete or abandon the Quest. `normalizeSheet` backfills
a missing `Motifs` field to three empty slots, matching the self-heal-on-read pattern.

**UI.** `ThemePanel` is replaced by `MotifPanel` inside the Background section; the
`AbilitiesSkillsPanel` and its effect chips are deleted, and Load becomes a standalone section.
`CreateCharacterPage` now collects three Motifs (each with a Skill Tag, Flaw Tag, and Quest) with
the 13 canonical Motifs and their example lists as pickable suggestions. `EndSessionModal` marks
Potential on a chosen Motif, and the GM's Peek card shows the three Motifs' names and Potential
instead of a single Theme/Potential.

## [0.28.0] — 2026-09-02T11:01:55Z

**Slice 1 of the V0.5 ruleset migration** (`WorkPlan-V0.5.md` section C), and the first code to
land against `Planning Docs/Ruleset-V0.5.md` since it was adopted as canon. Deliberately ships no
new screen: this slice settles the wire contract every later slice reads from, so a type change
that touches every surface happens once, first, rather than being threaded through screens that
would then need touching twice. MINOR per this file's versioning policy — a notable internal
architecture change, and a breaking one for stored play data (see the clean break below).

**A Status is a row of marked boxes, not an integer.** `CharacterStatus.Rank: number` became
`Marks: boolean[]`. Three primitives in `engine.ts` are the only code that knows how a row works:
`statusRank()` (the highest marked box — never a count, because the row is deliberately sparse:
`[_,X,_,X,_,_]` is Rank 4), `markRank()` (V0.5's real rule — mark box N, *or the next empty box to
its right* if N is taken), and `reduceRank()` (clears from the highest box down). Two consequences
that look like bugs if you don't expect them, both pinned by name in `engine.test.ts`: giving is no
longer additive (Rank 2 twice is Rank 3, not 4), and reducing clears *marks* rather than Ranks, so a
Status held as a lone mark on box 2 is removed by a reduction of 1 instead of dropping to Rank 1.

**Crumble replaces Dishonored, and stops being derived state.** `isDishonored()` was a predicate
over "all five Conditions marked". Under V0.5 that is a legal state; the consequence fires on the
*next attempted mark*, and clears one Condition — which no boolean can express. `markCondition()`
is now the single funnel for every Condition mark and the only thing that decides a Crumble;
`allConditionsMarked()` is what remains of the predicate, driving a badge that says what happens
next rather than naming a state. Crumble fires automatically wherever code marks a Condition and
finds all five marked, and manually via a new control in `VirtuesPanel` for the case the fiction
demands — the app can only see the Conditions it marks itself. A new `CrumbleModal` handles
choosing which Condition to clear (V0.5 leaves that to the player).

This also closes a live off-by-one: the seeded `g-dishonored` glossary text already said "a
**sixth** Condition with all five already marked" while the code fired at the fifth. The prose was
right; the code was wrong. The term is now `g-crumble`.

**Unstable at Rank 4, derived rather than stored.** `isUnstable()`/`isEnemyUnstable()` compute it
for Heroes and enemies. The old `CombatParticipant.Unstable` field was deleted — it was written
once as `false` and never set by anything, so its badge was unreachable and a stored flag could
only drift from the Statuses that determine it.

**Recoveries hitting 0 gives the Exhausted Condition, which can itself Crumble you.**
`spendRecovery()` is the single spend path for both sites and returns both an Exhausted and a
Crumbled flag, because the three-step cascade (last Recovery, then Exhausted, then nothing left to
mark, then Crumble) is real and easy to miss. Relatedly, `normalizeSheet()` now backfills a missing
`Recoveries` to `RecoveriesMax` rather than 0 — under the new rule, backfilling an empty pool would
have silently inflicted a Condition on an old sheet the moment it was read.

**Kin is Bond, everywhere.** `AdvancementTrack`'s `Kin` became `Bond`, `Bond.KinTrack` became
`BondTrack`, `MarkKin`/`SpendKin` became `MarkBond`/`SpendBond`, `applySpendKin()` became
`applySpendBond()`, `GameSettings.KinTrackLength` became `BondTrackLength`, `CampaignOverview.Kin`
became `Bonds`, `MarkKinModal` became `MarkBondModal`, and `KinAdvancementView` became
`BondAdvancementView`. V0.5 calls this track "Bond" in its Advancement chapter and "Kin"/"Kith" in
two others; those are treated as the doc's own typos rather than three concepts (recorded in
`HANDOFF.md`'s "Known gaps in V0.5"). The `g-kin` glossary term merged into `g-bond`, since under
V0.5 the relationship and its track are one concept.

**Rapport is spendable as Aid.** 1 Rapport for +1 on another Hero's roll, usable after the dice are
rolled, double during Risk Death — on top of its existing Advancement-track role. What ships is
honest about its limits: the app moves the currency and records who spent it and on what
(`Party.History` gained a `spent` action, and `By` is now actually populated), but does *not*
enforce V0.5's "once per teammate per roll", because this app has no concept of "a roll" to hang
that on. `MoveRollHelper` explains that in a tooltip rather than implying a rule is tracked when it
isn't — the same principle already governing Advantage/Disadvantage. A real cross-player Aid offer
flow, modelled on Combat's `PendingStatusOffer`, was considered and deliberately deferred.

**Two live bugs the box model forced into the open**, both fixed here:

- `applyOpposingStatus()` took no cap and returned a bare array, so a polarity flip could land past
  the Subdued box and never run the Subdued flow. It now returns a `StatusApplyResult` like every
  other give path.
- `EncounterView` discarded `giveStatus()`'s Subdued flag entirely, so a PC subdued by an enemy
  attack in Combat sat silently at the cap with no Scar/Risk Death choice. Only the sheet's own
  path ever ran it.

**One bug found by its own new test**, worth recording because the failure mode was silence:
`markCondition()` originally checked "is this Virtue already marked" before "are all five marked",
so a Crumble demanded on an already-marked Virtue returned "nothing happened" instead of Crumbling.
Guard order fixed, and the reasoning is now a comment in `logic.ts`.

**Also in this release**, because the above forced it: `PUT /party` gained server-side Rapport
clamping (it validated nothing before, so a client could persist `Rapport: 9999`; harmless while it
was a counter, not once Aid spends it); `GiveStatusModal` reads `StatusMaxRank` from the library
instead of two hardcoded `6`s; `AdvancementPanel` reads the three track lengths from `GameSettings`
rather than literal `5`s; `MakeCampModal`'s copy now matches the flat −2/−1 the code actually
applies rather than claiming a 2d6/1d6 rule that slice 7 owns; `characters.test.ts`'s settings
fixture regained the `RecoveriesMax` it was missing; and the dead `nextPipValue()` helper was
deleted.

**Not in this release, deliberately**: the two seeded Rapport advancements that presuppose Aid
(`ad-r-help`, `ad-r-lastline`) stay display-only text; V0.5's 2d6/1d6 Make Camp resolution is slice
7's; everything Motif-shaped is slice 2's; Level and Party Level are slice 4's and blocked.

**Existing play data is a clean break.** These shapes have no translation path, and the repo owner
chose to wipe rather than migrate — existing sheets are pre-release test data. No migration code
was written for records nobody needs kept. Note the wipe is currently one-way: `seed.ts` gates on
zero `profiles`, not on play data, so deleting campaigns does not make the demo campaign regenerate
on restart. Recorded in `HANDOFF.md` rather than fixed here.

New UI: `StatusBoxes.tsx` (deliberately not a `Pips` variant — `Pips` carries a magnitude and is
still correct for Potential/Rapport/Bond/charges, while a Status row is sparse), and
`CrumbleModal.tsx`. `StatusBoxes` reuses `.pip-row`/`.pip`'s existing hit-area machinery verbatim,
because the 239px six-box coarse-pointer arithmetic and `StatusesPanel.module.css`'s negative-margin
bleed are derived against it; the responsive smoke test was run across every viewport under both
appearances to confirm that carried over.

## [0.27.0] — 2026-08-16T21:17:07Z

Executes `TechStackAudit.md`'s section G "Order of work" in full except item 8 (deliberately
skipped, a repo-owner decision — see below): an audit-driven perf/tooling/dependency-currency
pass, the same shape as `0.19.0`'s engineering-quality audit-fix session, bundled under one MINOR
bump because it includes React Compiler adoption — "a notable internal architecture change" per
this file's own versioning policy above. The audit itself (`TechStackAudit.md`, written the same
day by the prior session) answered a direct repo-owner question about React Server Components and
TanStack Start — **verdict: adopt neither**, recorded as README judgment call 28 — and separately
found sixteen smaller, ranked opportunities while tracing what RSC would have needed. This release
is that second list, scoped and approved by the repo owner before implementation (including an
explicit go-ahead to include React Compiler despite the audit's own "riskier than it first
appears" framing, and an explicit call to skip local JWT verification rather than have a session
make that security trade-off alone).

- **Bundle measurement and a real budget.** `vite.config.ts` gained a `build.manifest` block and
  an opt-in `rollup-plugin-visualizer` (`npm run build:visualize -w @asohav/web`); new
  `scripts/bundle-budget.mjs` sums first-load JS (entry + synchronous imports, excluding
  `React.lazy` chunks) and gzips it, wired into CI's `build` job. Shipped report-only first, then
  flipped to enforcing once `CreateCharacterPage` was lazy-loaded (matching `/admin`/`/combat`'s
  existing pattern) — first-load gzip dropped 209.45 → 176.00 kB, confirming `zod` tree-shakes
  cleanly through the `@asohav/shared` barrel with no workaround needed. The budget was raised
  twice since, each time for a real, measured, deliberate reason recorded in the script itself:
  once for `manualChunks` (stable vendor-chunk hashes across deploys — zero first-load bytes
  saved on its own, inert until paired with the cache headers below) landing at parity, and once
  for React Compiler's own runtime memoization helper adding ~12% (176.08 → 197.83 kB gzip) —
  budget now 208 kB, ~200 kB actual after the react-router/Vite bumps below shaved a little back.
- **Server round-trip reduction.** `/bootstrap` — the app's most frequently re-run query path —
  no longer re-fetches characters or issues one `getSheet` per character; `listUsers()` no longer
  ships every registered account to every client on every campaign load (scoped to the requesting
  campaign's own membership, verified first that nothing else needed the wider set); `admin.ts`'s
  campaign list and `invites.ts`'s pending-invites list each batch what used to be a per-row
  round trip; `getActiveEncounter` filters in Postgres instead of loading every ended encounter's
  full history into JS. `getSheet`'s self-heal write-back for a pre-`0.13.0`/pre-`0.18.0` sheet —
  a real migration path, not incidental — was deliberately preserved through the rewrite. Added a
  focused test for `/bootstrap`, which had none before this pass despite being both the hottest
  route in the app and impossible to live-QA from this sandbox.
- **Cold-load waterfall.** `main.tsx` now prefetches `['library']` alongside `useMe()` instead of
  after it resolves — the library is user-independent and doesn't need auth to load. Hovering or
  focusing a `CampaignTile` link now prefetches that campaign's `['bootstrap', id]` too.
- **Cache headers**, fixing a real stranding foot-gun by omission: `index.html` now always ships
  `Cache-Control: no-cache` (through the one code path that ever serves it, `index:false` forcing
  `express.static` out of the way) while hashed assets get `public, max-age=31536000, immutable`.
  The `compression` middleware half of this recommendation was **not** added — whether Render's
  edge already compresses can't be checked from this sandbox, and adding it blind risks wasted CPU
  on a free instance if it's redundant.
- **ESLint**, for the first time in this repo's history: `eslint.config.js`, typescript-eslint's
  non-type-checked `recommended` preset plus `eslint-plugin-react-hooks@6` (which folds React
  Compiler's own rule set in — no separate compiler-lint plugin needed), scoped to `apps/web/src`
  since that's the only React code in the workspace. The first run found 123 problems across a
  never-linted, 137-file codebase; per the audit's own instruction, none of the pre-existing
  backlog was fixed in the PR that introduced the linter — `@typescript-eslint/no-explicit-any`,
  `@typescript-eslint/no-unused-vars`, and two real (but pre-existing, unrisked) react-hooks
  findings are downgraded to warnings with `eslint --max-warnings=61` as the actual gate, so CI is
  green today and catches only *new* findings going forward. Only genuine config gaps (missing
  Node/browser globals, one legitimate `require()` in the config file itself) were fixed outright.
- **A first `apps/web` vitest suite** — 35 tests covering `lib/api.ts`'s request/error-mapping
  logic, `lib/useGlossaryMatcher.ts`'s two-WeakMap cache split (the fix for a real `0.24.1` bug),
  and `store/appearanceStore.ts`/`panelCollapseStore.ts`'s persistence and fallback behavior,
  closing the `appearanceStore` test gap `HANDOFF.md` had flagged since `0.26.0`. Deliberately
  pure-logic only this pass, no jsdom/component tests yet — real, scoped future work, not an
  oversight. This is what actually gated React Compiler below, landing green immediately before
  it per the audit's own explicit dependency ordering.
- **React Compiler adopted** (`babel-plugin-react-compiler`), gated on ESLint and the new vitest
  suite landing first. Checked directly in this sandbox before enabling, closing gaps the audit
  session itself couldn't: `react-compiler-healthcheck` reports 88/88 components compiling
  successfully, and the new lint config found only two pre-existing Rules-of-React findings in
  the whole app (both left as ratchet-down warnings, not fixed blind in an unrelated PR). Verified
  with the full unit suite, a full responsive-smoke matrix (every route × viewport × appearance),
  and an isolated production-preview boot check in real headless Chromium — clean.
- **react-router-dom 6 → react-router 7**, and **Vite 6 → 7** — mechanical dependency bumps
  (~20 import-specifier rewrites for the former; no config changes needed for the latter), each
  verified with a full responsive-smoke matrix given how central both are to every page. Both
  ecosystems had already moved a further major version beyond what the audit assumed as current
  (react-router to 8, Vite to 8.2.1) by the time this was implemented the same day — deliberately
  not adopted, since both are unplanned scope beyond what was actually approved, and Vite 8 in
  particular is the audit's own explicitly deferred step (Rolldown's Rust-based CSS module
  scoping could change every class name — real future work, not closed by this release).
- **Version-sync check + dependency range refresh**: new `scripts/check-versions.mjs` (first step
  of CI's `build` job) confirms all four `package.json` files and `package-lock.json` agree;
  every declared dependency range refreshed to its actually-installed floor.
- **README judgment call 28** records the RSC/TanStack Start verdict and its reopen conditions —
  the audit's own "durable artifact," independent of everything else in this entry.

**Deliberately not done, a repo-owner decision recorded here and in `HANDOFF.md`, not an
oversight**: local JWT verification (trading Supabase's live user-exists/not-banned check for
latency) — this sandbox still can't confirm the Supabase project uses asymmetric signing keys,
and the underlying security trade-off was left for the repo owner rather than made unilaterally.

Verified throughout: `npm run typecheck`, `npm run build`, `npm run lint` (61 warnings/0 errors,
a threshold expected to ratchet down over future sessions, not stay fixed), `npm run test` (133
shared + 82 server + 35 web = 250, up from 212 at `0.26.0`), `npm run bundle-budget -w @asohav/web`,
and the full responsive-smoke matrix at each of the higher-risk steps (React Compiler,
react-router 7, Vite 7) — every route × viewport × appearance, clean each time.

## [0.26.0] — 2026-08-15T02:44:04Z

Executes `WorkPlan-0.26.0.md`, approved and merged docs-only as PR #94: a switchable UI
**appearance** system — Parchment (the existing look, unchanged) and a new dark "Notice Board"
corkboard/pinned-paper look — plus deletion of the parchment-damage overlay entirely, from both
appearances. Verified with `npm run typecheck`, the full unit suite (133 shared + 79 server tests,
unchanged from `0.25.0` — this release added no new pure logic, only CSS/markup/config; see
`HANDOFF.md` for the one deliberately-skipped unit-test gap this leaves), the full build, the full
responsive smoke test across all seven viewports **and both appearances** (14 matrix cells per
route, up from 7), and `npm run screenshot` under both appearances for every visual change.

- **Tokenized the last hardcoded color literals** across 11 component stylesheets plus
  `base.css`'s two texture gradients — new `--ink-80`/`-78`/`-32`/`-07`/`-04`, `--scrim`,
  `--gold-line-soft`, `--on-dark-line`, `--ground-sticky`, `--shadow-tint`/`--shadow-pop`, and the
  `--ground-texture`/`--panel-texture` pair that made the body/`.panel-grain` backgrounds
  appearance-aware instead of fixed in `base.css`. Prerequisite for everything below — a literal
  rgba value can't repaint per appearance the way a token can.
- **Deleted the parchment-damage overlay entirely** (`DamageOverlay.tsx`/`.module.css`, `Panel.tsx`'s
  `damageTier`/`damageVariant` props, `packages/shared/src/logic.ts`'s `damageTier()`/
  `DAMAGE_TIER_OPACITY`) — from both appearances, not kept as Parchment-only or reskinned for
  Notice Board, per the plan's decision 1. Static `grain` (`.panel-grain`, now driven by
  `--panel-texture`) is unaffected — it was always a separate, still-live concern from the deleted
  dynamic per-Condition/per-Status-rank system. See `AppThemeGuidelines.md`'s "The damage overlay:
  what it was, and why it's gone" for the full historical record.
- **The appearance-switching mechanism**: `data-appearance` on `<html>`, driven by
  `useAppearanceStore` (Zustand, `localStorage`-backed) with an inline `<head>` script in both
  `index.html` and `harness.html` so the correct appearance paints first — no flash of Parchment
  before a Notice Board repaint. A `<select>` picker in `AppShell.tsx` lets a player switch; label
  hides below 600px to save header width. Named "Appearance," deliberately not "Theme," to avoid
  colliding with this app's existing game-mechanical use of that word (`CharacterSheet.Theme`) —
  see `README.md#architecture-notes--judgment-calls` item 27.
- **Notice Board's real palette and self-hosted type**: a dark ground (`#241c15`), warm-paper panel
  surface, nudged gold accent, Cinzel (display) and Zilla Slab (body) — both self-hosted (13 new
  `apps/web/public/fonts/` files, `@font-face` in `appearances.css`, OFL license files included)
  rather than pulled from Google Fonts at runtime like Parchment's Cormorant Garamond/Lora, plus
  `color-scheme: dark` so native UA-styled form controls default sanely. Surfaced and fixed several
  previously-invisible bugs along the way that only mattered once ink polarity could flip: loose
  page-level text with no enclosing `.panel` now uses new token `--ink-on-ground` instead of the
  plain `--ink` stops (which stay meaningful for panel-nested text, since panels/dialogs/drawers
  stay a light surface in both appearances); Content Admin's `.admin-pane` had no `background` at
  all; unstyled `<button>`s were inheriting the browser's `color-scheme`-aware default text color
  instead of the app's own ink token.
- **New `.board`/`.posting` CSS primitives** (`surfaces.css`) give a tag-collection container the
  corkboard look and its items the pinned-paper look, real under Notice Board and a zero-effect
  no-op under Parchment. `.board` is safe as plain tokens (containers have no pre-existing
  background to erase); `.posting` needed splitting into an unconditional-safe base rule
  (deterministic per-item tilt via `:nth-child(4n+1..4)`, never `Math.random()`, plus its drop
  shadow and pin dot) and a separate `:root[data-appearance='noticeboard'] .posting` rule for the
  background/border/padding specifically — a plain neutralized token there would still have won
  over a component's own existing background, since the `utilities` cascade layer outranks
  `components` regardless of specificity. `LooksPanel`'s chips were the reference implementation.
- **Poster treatment applied to every remaining tag-collection surface** per the plan's decision 3:
  Theme's quest chips, Load's items, Abilities & Skills' ability/skill rows, Armor's rows (now
  wrapped in its own `.board`), and Statuses' per-polarity row groups (`.posting` without tilt, to
  keep each polarity group's rows visually aligned rather than scattered). `StatusesPanel`'s
  `.rowHead` breakpoint (documented as likely needing re-derivation once padding changed) was
  re-verified empirically against real rendered heights at 1024px/768px rather than trusted from
  arithmetic alone — the threshold held, with a thinner but real margin. A second, narrower squeeze
  in the same panel wasn't caught until the doubled testing matrix (below) actually ran: at 360px
  under Notice Board, `.board`+`.posting`'s combined padding pushed the dedicated six-pip Status-rank
  row under the exact width six pips need, so `Pips` wrapped internally and its touch overlays
  collided — the same overlap bug that dedicated row exists to prevent. Fixed with a negative
  `margin-inline` on `.pipsCell` (new `--posting-pad-x`/`-y` tokens, decomposed out of
  `--posting-pad` so the fix could reach for the horizontal axis alone) that bleeds it back out
  through its own row's padding plus half of the enclosing board's — verified with a real rendered
  measurement, not just arithmetic, after the first attempt (row's padding only) measured one pixel
  short in a real browser. That fix in turn regressed 1024px/1440px/1920px, caught by a second full
  matrix run: the `@media (min-width: 1024px)` block that moves `.pipsCell` into a shared row with
  `rank`/`remove` already reset one property for the width switch (`margin-bottom`) but not the new
  `margin-inline`, so the bleed kept firing on a cell that no longer needed it. Fixed by resetting
  it alongside the property already being reset there.
- **Testing matrix gained an appearance dimension**: `responsive-smoke.mjs`/`screenshot.mjs` now
  render every route at every viewport under both appearances (`?appearance=` query param, shared
  `APPEARANCES` list in the new `harnessConfig.mjs`), filterable with `SMOKE_APPEARANCE=`/
  `SCREENSHOT_APPEARANCE=` the same way route/viewport already were. CI's `responsive` job splits
  into a two-entry `strategy: matrix:` (one job per appearance) rather than doubling one job's
  wall-clock time. Fixed a real picker/render mismatch found while building this:
  `appearanceStore.ts`'s `loadAppearance()` only ever read `localStorage`, so a screenshot taken
  with `?appearance=noticeboard` correctly rendered dark while the `<select>` still showed
  "Parchment" selected — now checks the query param first, matching the inline script's own
  priority.
- **Docs**: `AppThemeGuidelines.md` rewritten (not edited) to keep Parchment's original governing
  philosophy verbatim as still-binding, and add a dated "Notice Board's reversal" section naming
  exactly which two of that philosophy's rules (no wood grain, no drop shadows) are deliberately
  reversed for Notice Board specifically, and why the reversal can't leak into Parchment. CLAUDE.md
  gained a new "Architecture: appearances" section; `theme-tokens`/`responsive-device-qa` skills
  updated for the two-palette define-in-every-appearance rule and the doubled test matrix.

## [0.25.0] — 2026-08-14T18:44:59Z

Executes `WorkPlan-0.25.0.md`, approved earlier the same day: mobile-device UI cleanup driven by
repo-owner testing feedback (four reported screenshots plus a 390px audit of all fifteen routes),
a player-facing Glossary drawer, and a real fix for the tooltip-nesting bug behind a reported
"bubbles two deep" screenshot. Verified with `npm run typecheck`, the full unit suite (133 shared
+ 79 server tests), the full responsive smoke test at every viewport, and `npm run screenshot`
before/after every layout change — plus, for the two things neither of those catch, direct
Playwright checks (a mixed input+button row's actual rendered width; a definition bubble's
position at both scroll extremes of the section nav and both bubble types at the viewport edge).

- **New `.action-grid` layout primitive** (`layout.css`) replaces `flex-wrap` for rows of peer
  actions — `grid-template-columns: repeat(auto-fit, minmax(var(--action-min, 150px), 1fr))`, so
  buttons distribute evenly and the column count falls out of the real content width instead of
  wrapping wherever a label happens to run out of room. Applied to the sheet footer row, Statuses'
  Give/Heal Status and Wealth/Treasure/Recoveries rows, Bond actions across `AdvancementPanel`/
  `CampaignBonds`/`EndSessionModal`, and Combat's round-action row. `--action-min` needed tuning to
  130px (not the plan's stated 150px) for rows nested inside a Panel's own padding, checked against
  real screenshots rather than trusted from the arithmetic — see `README.md#architecture-notes--
  judgment-calls` item 25 for the `auto-fit`-vs-container-query reasoning. One row deliberately
  did **not** convert: `EndSessionModal`'s Hold-count input + Grant Hold button is a mixed row (a
  fixed-width input beside a button), the shape the plan's own section B excludes — a screenshot
  showed `.action-grid` stretching the input to the full row width the moment it dropped to one
  column on a phone.
- **Statuses' Wealth/Treasure restructure to label-above-stepper** (an approved design change, the
  one place this plan changes a layout rather than reflowing it): `[−] Wealth 0 [+]` (value inside
  the label) becomes a `WEALTH` label over a `[−] 0 [+]` row, which is what lets Wealth and
  Treasure share a line at 360px. Recoveries moves out of `margin-left: auto` (which stranded it on
  its own line) into a third labelled cell in the same grid.
- **Combat's header row split into three groups** (`EncounterView.tsx`) — the worst wrapping
  offender found in the audit: a status readout (Round, Acting side), a mixed initiative sub-group
  (label, number input, Roll button — kept as plain flow, same "mixed row" reasoning as above), and
  an `.action-grid` of round actions (Toggle Acting Side, Next Round, End Combat, Add Participant).
  Was one `flex-wrap` row that broke into four ragged lines at 390px; now a clean 2×2 on a phone,
  4-across on desktop.
- **`CampaignTile`'s footer stacks below 600px** instead of `justify-content: space-between`
  throwing the last-played date and the "Open campaign" button to opposite ends of a wide gap.
- **The sheet's section nav gains a scroll-edge fade** (new `useScrollEdgeFade` hook,
  `useMediaQuery.ts`) — below 768px the nav is an `overflow-x: auto` strip with no visible sign it
  scrolls, so a label sliced mid-word at the edge ("Growth" as "Gro…") read as broken rather than
  continuable. The hook publishes which edge(s) actually have more content as
  `data-can-scroll-left`/`-right` attributes; `layout.css` masks a smooth fade in on just those
  edges via `mask-image`, which fades the nav's own pixels rather than painting a color overlay
  over them, so it matches the app's paper-texture background exactly without needing to reproduce
  it.
- **New Glossary drawer** (`components/GlossaryDrawer.tsx`), modelled on `MovesDrawer`: every
  `library.glossary` term, flat alphabetical, with a search box and no filter chips. Triggered
  beside Moves in the sheet's sticky header and from the Campaign page's banner action area (Combat
  renders inline on Campaign, so Toughness/Range need to be reachable mid-fight). Definitions
  render as plain text plus "See also" chips rather than nested tap-to-reveal bubbles — a chip
  scrolls to that term within the list. New `glossaryUiStore` (its own store, not `sheetUiStore`,
  since the Campaign page is not the sheet) tracks open state and which term to scroll to. Shell
  (scrim/panel/sticky head/title/close/body, plus the search input and empty-state text, found
  byte-identical to `MovesDrawer`'s own during implementation) composes from a new
  `styles/drawer.module.css` — `MovesDrawer` also picked up `useModalA11y` (focus trap, Escape,
  focus restore) in the same pass, the one dialog-shaped surface in the app that had never been
  migrated in `0.19.0`'s modal accessibility overhaul, since it's a drawer rather than a
  `modal.module.css` modal. Bundle impact checked directly rather than assumed: the main chunk
  grows ~1kB gzipped, confirming the plan's expectation that this doesn't need `React.lazy`.
- **Fixed the tooltip-nesting bug behind a reported "bubbles two deep" screenshot**
  (`packages/shared/src/glossary.ts`, `components/GlossaryText.tsx`). `MAX_DEPTH` drops from 1 to
  0 — `GlossaryText.tsx`'s `DefinitionText` passed a hardcoded `1` into every nested `linkifyText`
  call instead of `depth + 1`, so the depth counter never actually advanced and nesting was
  unbounded (Kin → Bond → Kin → …) rather than capped at two as intended. Rather than just fixing
  the counter and keeping one real nested level, the fix removes nesting entirely: a definition
  now renders plain text plus the same "See also" chips the new Glossary drawer uses, opening the
  drawer at that term instead of a second bubble. The depth-cap fix also closed a second bug: the
  old past-depth early return skipped explicit-tag resolution entirely, so a definition authored
  with `0.24.0`'s `[display][id]` syntax would leak raw bracket syntax into a bubble the moment it
  stopped linking — the fixed return still resolves tags and flattens to plain text. Full reasoning
  in `README.md#architecture-notes--judgment-calls` item 26.
- **Definition bubbles no longer hang off the right edge of the screen on mobile**
  (`GlossaryText.module.css`, `InfoTooltip.module.css`, `useTapReveal.ts`) — both bubble types were
  `position: absolute; left: 0`, so a trigger near the right margin clipped its own bubble at the
  viewport edge. Below 600px the bubble becomes a fixed card spanning the content width, positioned
  from a new `--bubble-top` custom property `useTapReveal.ts` sets from the trigger's own measured
  rect on open. New `responsive-smoke.mjs` case opens the rightmost glossary-term link and the
  rightmost `InfoTooltip` trigger on the character sheet at both phone viewports and asserts the
  resulting bubble stays inside the viewport — this class of bug was invisible to the smoke test's
  normal page-at-rest checks (a bubble only exists after a tap), so it needed a screenshot to catch
  before this.

## [0.24.1] — 2026-08-14T10:53:33Z

An adversarial review of the `0.24.0` implementation (against `WorkPlan-0.24.0.md`) found two real
bugs beyond what `npm run typecheck`/the unit suite/the responsive smoke test could catch — neither
is a layout regression, so the smoke test was never going to see either. Both fixed here.

- **`GlossaryAutoLink: false` silently didn't take effect for an already-loaded session**
  (`apps/web/src/lib/useGlossaryMatcher.ts`). The module-level matcher cache was a single `WeakMap`
  keyed only on `library.glossary`'s array reference, on the assumption that `GlossaryAutoLink`
  "always changes in lockstep with it." It doesn't: `useLibrary()` never sets
  `structuralSharing: false`, so TanStack Query's default `replaceEqualDeep` keeps a fetched
  sub-tree's *old* reference whenever it's deep-equal to the new one. A settings-only edit in
  Content Admin (or any other library write — `useLiveCampaign`'s Realtime subscription invalidates
  `['library']` on *any* change to the row) refetches `library`, and if the glossary terms
  themselves didn't change, `library.glossary` comes back as the exact same reference as before —
  so the single cache handed back the matcher built under the old `autoLink` value. Confirmed
  empirically (`replaceEqualDeep` run directly against a simulated refetch) before and after the
  fix. Fixed by splitting the cache into two `WeakMap`s, one per `autoLink` value, so a toggle
  always gets its own cache entry regardless of whether the glossary array's reference happened to
  survive structural sharing.
- **A typo'd `SMOKE_ROUTE`/`SMOKE_VIEWPORT` reported a false "All routes clean"**
  (`apps/web/scripts/responsive-smoke.mjs`): the `0.24.0` filters had no guard against matching
  zero routes/viewports, so every assertion was vacuously true over an empty matrix and the script
  exited 0. `screenshot.mjs` — built from the same `harnessConfig.mjs` in the same commit — already
  guarded this; the guard just hadn't been ported to its sibling. Added the same
  `console.error` + `process.exit(1)` check.

## [0.24.0] — 2026-08-13T23:23:12Z

The twenty-ninth session (planning-only, see `HANDOFF.md`) turned eight pieces of repo-owner
testing feedback — seven UI/UX changes plus one research question — into `WorkPlan-0.24.0.md`, a
nine-PR dependency-ordered plan (PR 1, the `HANDOFF.md`/`README.md` doc-only entries for open
issues 14/15, landed with the plan itself). This session executed the remaining eight PRs, each
verified independently (`npm run typecheck`, the full 211-test unit suite, and the responsive
smoke test at every viewport for anything touching layout) before the next began, since later PRs
depend on earlier ones (C/F/G build on B2's container-query foundation; E frees `.sheet-pair` for
C to reassign). See `WorkPlan-0.24.0.md`'s "Decisions already locked" table for the repo-owner
answers this work follows rather than re-litigates.

- **Explicit glossary tags** (`packages/shared/src/glossary.ts`). CommonMark reference-link
  syntax — `[Term]` links an occurrence case-insensitively; `[display][id-or-name]` links a
  display word that isn't a term's own `Name`/`Alias` to whichever term the second bracket names
  (by `Id` or by `Name`/`Alias`); `\[`/`\]` escape a literal bracket — answers all three things an
  author couldn't previously say about the regex auto-linker (don't link this occurrence, link
  this word to that term, override the casing rule). **A field with at least one explicit tag
  disables the regex auto-linker for that whole field** — the rule that makes migrating a field to
  explicit tags free (no flag, no backfill). New `GameSettings.GlossaryAutoLink` (default `true`,
  `normalizeLibrary()` backfills it) is a separate, library-wide kill switch for retiring the regex
  pass once content has migrated; explicit tags resolve independently of it either way. Content
  Admin's Validation panel now also flags an unresolved tag (`findUnresolvedGlossaryTags()`, wired
  into `validateLibrary()`) across every `text`/`textarea` field, alongside its existing dangling-
  ref checks. Full syntax-choice writeup, including the three alternatives considered and rejected
  (generic directives, MyST, wikilinks) and why full Markdown rendering wasn't adopted, in
  `README.md#architecture-notes--judgment-calls` item 23.
- **Page content-width intents, not a private `max-width` per page** (`tokens.css`, `layout.css`'s
  new `.page-shell`/`.page-shell-wide`/`.page-shell-form` utilities). Nobody had chosen the spread
  across pages before this — Home sat at a private 720px (the "wasted space on larger screens" the
  repo owner screenshotted, since its `repeat(auto-fill, minmax(300px, 1fr))` tile grid had room to
  run 3–4 up), Campaign at 1180px, the sheet at 1280px, each picked independently. Home and Campaign
  now share `--content-max` (1280px); the sheet and Campaign step up to `--content-max-wide`
  (1600px) at `>=1800px` viewports so a 1440p monitor (2560×1440) gains real content width; Create
  Character and the Combat deep link keep `--content-form` (640px), unchanged in value but now
  token-based.
- **The responsive smoke test gains two viewports (1920, 2560), and a new screenshot script.** 1440
  was previously the widest tested; a real 1440p monitor is 2560×1440. `apps/web/scripts/
  screenshot.mjs` (new) renders every route at every viewport to a gitignored `apps/web/
  .screenshots/` PNG — the smoke test only asserts overflow/touch-target/overlap/errors, none of
  which catch "this panel is wasting a lot of horizontal space," and needs no network (local Vite,
  local Chromium, seed fixtures), so it's the first visual-verification path any session on this
  project has had from inside a locked-down sandbox. Both scripts now share their route/viewport
  list and Vite-harness bootstrap via a new `apps/web/scripts/harnessConfig.mjs` rather than two
  independently-maintained copies; the smoke test also gained `SMOKE_ROUTE=`/`SMOKE_VIEWPORT=`
  filters for iterating on one risky change without paying for the full ~12–14 minute run every
  time.
- **Every `Panel` is now a container-query container for its own measured width**
  (`Panel.module.css`, `container-type: inline-size; container-name: sheet-panel`) — the real fix
  for a footgun CLAUDE.md had already documented in words ("a panel inside `.sheet-col` cannot
  assume viewport width is its own width once 768px is crossed"), prompted by two pieces of this
  session's feedback colliding head-on without one: Abilities & Skills becomes a half-width column
  at 768px *and* was asked to run two items per row at "medium screens and higher." Chosen over
  containing at `.sheet-col` so a full-width band (Advancement) and a paired half-width panel
  (Abilities & Skills, Load) share one mechanism. `StatusesPanel.module.css`'s own existing 1024px
  hand-derived breakpoint math was deliberately **not** converted in this pass — flagged as a
  follow-up in `WorkPlan-0.24.0.md`'s "Open items," not bundled into a feature PR (mixing a
  working-but-hairy conversion into new feature work is how the `0.22.0` overlap regression
  happened). Full writeup, including the CSS-cascade ordering trap a `@container` override has to
  respect in this app's CSS Modules setup, in `README.md#architecture-notes--judgment-calls`
  item 24.
- **Character sheet section layout: `.sheet-grid` → Background → `.sheet-pair` → Advancement →
  footer.** Theme and Looks merge into one new "Background" section (`BackgroundPanel.tsx`), Looks
  first per the repo owner's markup — `ThemePanel.tsx`/`LooksPanel.tsx` demote to plain sections
  (no `Panel`/`PanelHeader`) inside it, the same pattern `ArmorSection` established inside
  `StatusesPanel` in `0.22.0`. Freeing `.sheet-pair` (which held Theme \| Looks since `0.23.0`) is
  what lets it take **Abilities & Skills \| Load & Item Charges** instead, kept at the existing
  even `1fr`/`1fr` split rather than an invented asymmetric ratio. `PANEL_IDS`'s old separate
  `theme`/`looks` collapse keys collapse into one `background` key (an already-persisted old key on
  a client is just a harmless unused zustand entry, no migration). Within the new pairing:
  **Abilities & Skills flows abilities and skills into one combined two-column grid** (not two
  separate `.map()`s restarting the layout) once the panel's own container width clears 560px, one
  column below it; **Load & Item Charges splits into a 1fr tiers column / 2fr items column** at a
  deliberately conservative 700px threshold (worked out from `.itemHead`'s pips-plus-name row — the
  plan's own highest-flagged squeeze risk — so the split stays off at every desktop width this app
  tests while paired with Abilities & Skills, only reliably turning on at the sheet's own
  `>=1800px` wide step; see `LoadPanel.module.css`'s comment for the full arithmetic).
- **Virtue row: score box trails, Condition is a real button, no checkbox.** Reverses `0.22.0`'s
  Figma "Option A" pick (a boxed score *leading* the row) on a newer, more specific markup from the
  repo owner: `.naming` (name + tagline, tagline moved back under the name) leads the row;
  `.trailing` (the score box above the Condition button) trails it. The ✓-checkbox is gone — the
  Condition button itself now carries the "press me" affordance, its unmarked state switching from
  a near-invisible `1px solid var(--rule-field)` border to the `--gold-tint`/`--gold-line`
  "interactive chip" pair `ThemePanel`/`LooksPanel`'s own chips already use, rather than inventing
  a new color (per `theme-tokens`). `VirtuesPanel.module.css`'s three `0.22.0`-era comment blocks
  were rewritten, not deleted, to describe the new arrangement and the reversal; the `.tap`-overlay
  clearance math was redone from scratch for the new adjacency (the Condition button and its own
  InfoTooltip trigger, now side by side in `.trailing`, replacing the old vertically-stacked
  `.name`-trigger-vs-Condition-button pairing that needed the `0.22.0`-era 24px margin fix) and
  verified against the responsive smoke test, not just worked out on paper.
- **Advancement: Potential \| Rapport share a row at 850px container width; game history moves into
  a shared modal.** The two `.subBox`es pair side by side once the panel's own width clears 850px —
  derived from a 5-pip `Pips` row's coarse-pointer width (~220px) plus `.trackNaming`'s 150px
  minimum, per `AdvancementPanel.module.css`'s `.tracksRow` comment — stacking below it, same
  `flex-wrap` safety net as everywhere else in the app if the arithmetic ever runs marginally
  short. New `apps/web/src/components/HistoryModal.tsx` (built on `modal.module.css`/
  `useModalA11y.ts` like every other dialog — the app's 13th) replaces what used to be an
  always-rendered-inline `HistoryList` at all three call sites (Potential, party Rapport, per-Bond)
  with a "History (N)" trigger; per-Bond history also drops its `.slice(0, 8)` truncation, which
  only existed to fit inline on the sheet. Combat's `Encounter.History` log deliberately stayed a
  collapsible in-page section rather than also moving to this modal — it's live mid-fight
  reference, not a retrospective record — flagged as an open question rather than silently decided.

**Docs**: `CLAUDE.md`'s Frontend-conventions section gained new entries for the sheet reorder, the
container-query adoption, the Virtues redesign, explicit glossary tags, and `HistoryModal`; the
`responsive-device-qa` skill's viewport count and container-query guidance were updated to match,
and `theme-tokens`' token-group list picked up the new `--content-*` layout tokens (and, in
passing, the `--gold-fade`/`--positive*` tokens it had missed since `0.19.0`/`0.20.0`).
`README.md#architecture-notes--judgment-calls` gained items 23–24. No new migration — every field
addition (`GameSettings.GlossaryAutoLink`) is a JSONB-blob field with a `normalizeLibrary()`
read-time default, same self-heal-on-read pattern as every prior addition to that type.

## [0.23.0] — 2026-08-13T19:11:01Z

The twenty-seventh session (planning-only, see `HANDOFF.md`) turned six pieces of repo-owner
testing feedback plus four research findings into `WorkPlan-0.23.0.md`, a seven-PR dependency-
ordered plan. This session executed it start to finish: PRs #81–#87, each verified independently
(`typecheck`, the full unit suite, and — for anything touching layout or DOM structure — the
responsive smoke test) and merged in order before the next began, since later PRs in the plan
depend on earlier ones (the form rewrite in particular waits until PRs 2–6 stop moving the forms
it touches). See `WorkPlan-0.23.0.md`'s "Decisions already locked" table for the repo-owner
answers this work follows rather than re-litigates.

- **`commit()` becomes a real optimistic mutation, not a same-tick cache write with no failure
  path** (`apps/web/src/lib/mutations.ts`, PR #81). `useCommitSheet`/`useCommitParty`/
  `useCommitEncounter` previously wrote straight into TanStack Query's cache from inside a
  `qc.setQueryData` updater and fired the API call separately — no rollback if the request failed,
  errors reaching only `console.error`, and a missing cache entry meaning the save silently never
  happened. A new `useOptimisticCommit<T>` helper cancels in-flight queries, snapshots, and writes
  the optimistic value **synchronously in the closure `commit()` returns**, not inside React
  Query's `onMutate` (which only runs after a microtask) — same-tick double-commits still compose
  correctly this way. Rollback restores only the specific field that failed
  (`opts.set(currentCache, previousValue)`), not a whole-document snapshot, since Sheet/Party/
  Encounter share one cache entry and a wider rollback would clobber an unrelated field's already-
  applied optimistic change. A new `toastStore.ts` (zustand) plus a `tone?: 'error' | 'status'`
  prop on `Toast.tsx` surfaces failures to the player for the first time instead of only to the
  console.
- **`sortStatuses()`: Positive → Neutral → Negative, Rank descending within each group**
  (`packages/shared/src/engine.ts`, PR #82). Matches the locked decision that the most severe
  Status should lead its group so a GM can read impact at a glance. Applied at both places a
  Status list renders unsorted today: `PeekCard.tsx` (GM live-peek) and `ParticipantCard.tsx`
  (Combat).
- **Character sheet: Virtues \| Statuses lead, Theme \| Looks follow as a new even-split row**
  (`CharacterSheetPage.tsx`, `layout.css`, PR #83). `0.22.0` paired Virtues and Statuses into
  `.sheet-grid` but still rendered Theme/Looks/Abilities/Load/Advancement above it as full-width
  bands in their original order; repo-owner testing feedback wanted Virtues/Statuses — the two
  panels a player checks most during play — above the fold instead of below three other panels.
  `.sheet-grid` moves to the top of `.sheet-stack`; a new `.sheet-pair` class (even 1fr/1fr split,
  reusing `.sheet-col`) gives Theme and Looks their own paired row directly under it, ahead of
  Abilities & Skills/Load/Advancement.
- **Home screen: a real tile grid instead of a flat campaign list, plus a widened `/me`**
  (`apps/server/src/routes/auth.ts`, `HomePage.tsx`, PR #84). `MeResponse.memberships[]` gains an
  `Overview` object per campaign (`CampaignOverviewMember[]` roster with each member's Rapport
  contribution flag, `CampaignOverviewKin[]` — only populated when a Bond actually exists, per the
  locked decision — and a "last played" timestamp derived from existing `updated_at` columns, no
  new migration needed) assembled with new batch-fetch functions in `repo.ts`
  (`listMembershipsForCampaigns` and five siblings) rather than one query per campaign per
  request. `CampaignTile.tsx` renders GM name, roster (the viewer's own character marked and
  doubling as the sheet link — no separate button, per the locked decision), Rapport, Kin when
  present, and last-played. `PendingInvites.tsx`/`JoinByCode.tsx` split out of the deleted
  `InviteInbox.tsx`: pending invites stay above the tile grid, only the join-by-code field moves
  into a new bottom two-up row next to campaign creation — matching the locked decision on where
  each piece goes.
- **Combat moves inline into the campaign page for both GM and player views** (`CampaignPage.tsx`,
  new `CombatPanel.tsx`, PR #85). Extracted from `CombatPage.tsx` (which becomes a thin wrapper
  kept alive as a working `/c/:id/combat` deep link, per the locked decision) and imported into
  `CampaignPage.tsx` via `React.lazy` from both `GmView` and `PlayerView` — preserving the `0.19.0`
  code-split rather than reopening the 674 kB → 613 kB bundle win importing `EncounterView` and
  its modals eagerly would have undone (a risk flagged during planning). The GM's view always
  renders the lazy panel (a GM always needs the start-Encounter form); a player's view only
  triggers the lazy import when an Encounter is already active, otherwise a plain, zero-import
  "No Combat right now." The old banner link to `/combat` is gone along with it.
  **Also fixed while extracting this component**: `CombatPage.module.css` had never actually
  defined seven of the classNames its "no active Encounter" branch (including the entire Start
  Combat form) referenced, since Combat shipped in `0.14.0` — that whole branch had been rendering
  completely unstyled in production for three versions. Real CSS was written as part of the
  extraction (`CombatPanel.module.css`), not a separate fix, since new files were being created
  regardless.
- **The silent +1 Rapport on Combat start is now atomic, logged, and announced** (`apps/server/
  src/routes/combat.ts`, `useBootstrap.ts`, PR #85). Planning research found `CombatPage.tsx`
  bumping `Party.Rapport` client-side with nothing telling the player it happened and no doc
  explaining the rule — confirmed with the repo owner as *not* a deliberate, documented mechanic,
  but kept and surfaced rather than removed (see `HANDOFF.md` open issue 13; the rule question
  itself is still open). The bump moves server-side into `POST /combat/start` so it lands in the
  same write as the Encounter itself, gets one `Encounter.History` entry, and a new
  `useAnnounceCombatStart()` hook (tracking the last-seen Encounter id via `useRef` off the
  existing Realtime subscription) raises a Toast the first time a client observes a new Encounter.
  `Toast`'s new neutral `'status'` tone (PR #81, above) is what makes this read as an
  announcement rather than an error.
- **Combat styling pass: a shared `SectionHead`, real button semantics, and the History log
  finally rendered** (`SectionHead.tsx`, `EncounterView.tsx`, `AddParticipantModal.tsx`,
  `CombatMoveModal.tsx`, PR #86). `CampaignPage.tsx`'s hand-rolled section-heading markup (title +
  rule, repeated per section) becomes one shared `SectionHead` component (`size="lg" | "sm"`, an
  optional `spaced` prop). Two inline `style={{...}}` attributes and a `maxWidth: 80` become real
  CSS classes (`.lightButton`, `.limitInput`). `EncounterView.tsx`'s offer button/select were
  styled `--danger` (a destructive-action color) despite offering a Status, not destroying
  anything — renamed `.actionButton`/`.actionSelect` and recolored to the app's neutral gold
  accent. `AddParticipantModal.tsx` gained real ARIA tablist/tab/tabpanel roles on its three-tab
  layout. `CombatMoveModal.tsx`'s Apply button used to just sit disabled with no explanation for
  which of four conditions was blocking it (no target, no reported tier, no Status name, or a tier
  that gives no Status at all) — a new `applyBlockedReason()` surfaces the specific reason as
  inline text. **`Encounter.History` is finally rendered somewhere**: every `EncounterView.tsx`
  action already logged to it (a planning-research finding — the array was being written on every
  action and read by nothing), now shown as a collapsible log so a table has the shared record of
  what happened mid-fight that the data was always meant to support.
- **Shared field primitives, plus scoped react-hook-form and zod** (`apps/web/src/components/
  form/`, `packages/shared/src/characterCreationSchema.ts`, PR #87). Character creation gets the
  full treatment: `characterCreationSchema(library)`, a zod schema factory bound to a `Library`
  snapshot, replaces two independently hand-maintained copies of the same validation rules
  (`CreateCharacterPage.tsx`'s client-side checks and ~70 lines of manual validation in
  `apps/server/src/routes/characters.ts`) with one shared source of truth — `safeParse()` server-
  side, `zodResolver()` via `useForm` client-side. `CreateCharacterPage.tsx` splits into an outer
  loading/guard component and an inner form component, since `useForm` needs a schema built from
  `library` but React's Rules of Hooks forbid calling it conditionally after an early-return guard.
  `AddParticipantModal.tsx`/`CombatMoveModal.tsx` get a deliberately lighter touch — only their
  simple, independent fields are `register()`-ed, while their genuinely dynamic per-row arrays
  (Status Limits, Gambits) stay local `useState` rather than being rebuilt on `useFieldArray`, to
  avoid a larger rework of already-working Combat logic with no live-QA path to catch a regression
  in this sandbox. All three surfaces adopt new shared `Field`/`TextInput`/`Select`/`NumberInput`
  primitives (`apps/web/src/components/form/field.module.css`) for markup confirmed byte-identical
  across five modals — only the two touched by this PR actually migrated; `HealStatusModal.tsx`/
  `GiveStatusModal.tsx`/`MakeCampModal.tsx` keep their own copies untouched, and
  `CreateCharacterPage.tsx`'s differently-styled fields were left alone, per this repo's existing
  "only byte-identical CSS gets unified" rule. `zod` is `@asohav/shared`'s first-ever runtime
  dependency — see `README.md` judgment call #22 for the full scoping rationale, including a
  measured bundle-size cost (`zod` + `react-hook-form` + `@hookform/resolvers` land in the app's
  main JS chunk rather than a lazy one, since `CreateCharacterPage` isn't behind `React.lazy` the
  way `/admin` and `/combat` are: 622.71 kB → 726.69 kB raw, 179.89 kB → 211.64 kB gzip, measured
  directly against this branch immediately before and after the change) flagged as a good
  candidate for a future pass rather than fixed here.

## [0.22.0] — 2026-08-13T11:53:24Z

A Figma-workshopped follow-up on `0.21.0`'s Status group cleanup: the repo owner didn't like the
first cut of `VirtuesPanel`'s redesign, and flagged the character sheet's two-column layout as
arbitrarily unbalanced (3 panels in one column, 5 in the other). Rather than iterate blind again,
four `VirtuesPanel` treatments and four sheet-layout wireframes were mocked up in Figma using the
app's real tokens/fonts for the repo owner to pick from before any code changed — see `HANDOFF.md`
for that session's notes. PR #78.

- **VirtuesPanel: a boxed score leads the row, Condition moves to the trailing edge**
  (`VirtuesPanel.tsx`/`.module.css`): `.scoreBox` (score, and the Condition-adjusted value
  underneath when marked) now leads each row the way `StatusesPanel`'s Wealth/Treasure steppers
  are boxed, rather than trailing the Virtue name. The Tagline and the Condition toggle now share
  one row (`.conditionRow`), with the Tagline growing to push Condition to the row's trailing edge.
  A marked Condition no longer prints a redundant "`Name` — marked" — the marked state is already
  visible from the checkbox and the row's own danger tint.
- **Armor merges into StatusesPanel** (`ArmorPanel.tsx`/`.module.css` deleted, replaced by
  `ArmorSection.tsx`/`.module.css`): marking Armor Used is an alternative to taking a Status, so the
  repo owner asked for the controls to feel integrated rather than living in their own separate
  Panel below Statuses. `ArmorSection` renders inline inside `StatusesPanel`, ahead of the Positive/
  Neutral/Negative groups, with its own small heading and "Refresh all" action instead of a full
  `PanelHeader`.
- **Status rows compacted** (`StatusesPanel.tsx`/`.module.css`): dropped the inert "Link
  to…/Affected by…" row — a documented future-feature stub that was never wired up and was costing
  every Status entry a full second line — and tightened `.row`'s padding. Not a full visual
  redesign of the rows (name/pips/rank/remove are unchanged), just removing the dead weight.
- **Sheet layout rebalanced: full-width bands plus a slimmed Virtues|Statuses grid**
  (`CharacterSheetPage.tsx`, `layout.css`): Theme, Looks, Abilities & Skills, Load, and Advancement
  move to full-width bands under a new `.sheet-stack` wrapper; `.sheet-grid` now holds only Virtues
  and Statuses side by side — the two panels actually alike enough in size and purpose to justify
  pairing, rather than every panel being forced into one of two columns regardless of fit. The
  Virtues:Statuses column ratio itself is unchanged (Statuses' rows still need more width than
  Virtues'), so `StatusesPanel`'s existing 1024px breakpoint math still holds — confirmed, not
  assumed, since this exact file has been the site of two prior responsive regressions this
  project. A new `.prose` utility (`layout.css`, `max-width: 68ch`) keeps authored rules text and
  descriptions in the newly full-width panels from stretching to an unreadable line length at
  desktop widths.
- **Lesson from a real CI failure this round**: the first cut of the `VirtuesPanel` change shipped
  with `.conditionRow`'s `margin-top` carried over unchanged at 7px from the old layout's
  same-purpose gap. That value was tuned for a layout where a Tagline-only line sat between a
  Virtue's own InfoTooltip trigger and the Condition row below it; merging Tagline into
  `.conditionRow` removed that spacer line without anyone re-deriving the gap for the new
  arrangement, and the 7px comment's claim of being "checked against the responsive smoke test"
  was never actually true. CI's `responsive` job caught real overlapping-hit-area failures at 360px
  and 768px (the two narrowest widths this panel renders at); fixed by bumping the margin to 24px,
  with the `.tap` overlay math behind the number documented inline this time.

## [0.21.0] — 2026-08-13T04:19:20Z

Two follow-up rounds on `0.20.0`'s work, both from direct repo-owner feedback on the live result.
PR #76 shipped without a version bump at the time — folded in here per the twenty-fifth session's
own lesson (`HANDOFF.md`): bump per meaningful PR rather than batching at the end of a session.

- **Status quick-add row: even heights, reordered/distinct groups** (`StatusesPanel.tsx`/
  `.module.css`, PR #76): the Add button was visibly shorter than the Polarity/Rank fields next to
  it (`.add` composed `btnSecondary`, which has no explicit height) — gave `.add` its own
  `min-height: var(--tap-min)`, scoped to this one consumer. Statuses now render Positive → Neutral
  → Negative (was Negative → Neutral → Positive), and the two non-first groups get a hairline
  `border-top` so the three polarity groups read as distinct sub-sections without leaving the
  single Statuses panel.
- **A real "Roll 2d6 + Heart: +5" bug, not a display nitpick** (`packages/shared/src/engine.ts`,
  `MoveRollHelper.tsx`, `CombatMoveModal.tsx`): `computeRollBreakdown()`'s `Total` used to sum the
  named Virtue's own score *and* the highest helpful/hindering Status into one number — so a roll
  helper headlined with a Virtue's name could show a total almost entirely driven by a Status,
  reading as if the Status swing *were* the Virtue's modifier. `Total` is now the named stat's own
  value only (Virtue + Condition + any Permanent Ability bonus); Status contributions move to a new
  `StatusSources` field, rendered as a clearly separate "Also affecting this roll" list at both
  render sites rather than folded into the headline.
- **Advantage/Disadvantage: from an interactive toggle to a static tooltip** (deleted
  `AdvantageToggle.tsx`/`.module.css`; `MoveRollHelper.tsx`, `CombatMoveModal.tsx`): the `0.18.0`
  Normal/Advantage/Disadvantage segmented control was reported as over-built for what's actually a
  per-roll table judgment call this app was never going to track (same reasoning already governing
  conditional Ability `RollBonus` effects). Replaced with an `InfoTooltip`/`TooltipSection` (the
  same tap-to-reveal component used for Virtue reference text) explaining what Advantage/
  Disadvantage mean and that they're a GM call, not something this app detects.

## [0.20.0] — 2026-08-13T02:49:13Z

Another repo-owner-requested round of UI cleanup and rules verification — one rules correction at
character creation, a real cross-cutting Status-polarity bug found while investigating a smaller
coloring request, a new theming-philosophy doc, and two panel redesigns.

- **Character creation: five canonical Virtue arrays, not one** (`packages/shared/src/logic.ts`,
  `apps/server/src/routes/characters.ts`, `apps/web/src/pages/CreateCharacterPage.tsx`): the single
  hardcoded `STANDARD_VIRTUE_ARRAY` (`2, 1, 0, 0, -1`) was always an app-side inference from
  `seedPlay.ts`'s premade characters (`README.md` judgment-call #2), never actually specified in
  `Planning Docs/`. The repo owner confirmed the real rule is five valid starting arrays —
  `STANDARD_VIRTUE_ARRAYS` replaces the single constant (`isStandardVirtueArray` now matches
  against any one of the five), and `CreateCharacterPage.tsx` gained a picker so the player chooses
  which array to assign from before the existing per-Virtue assignment grid. Existing
  `seedPlay.ts` characters (permutations of the old, now-retired array) are unaffected — this
  validation only ever runs at character-creation time.
- **Statuses: a real "Neutral treated as Negative" bug, not just a coloring glitch**
  (`packages/shared/src/logic.ts`, `engine.ts`): `StatusPolarity` has been a real 3-way type
  (`Positive | Negative | Neutral`) for a while, but `negativeStatusRankTotal` (feeds the Statuses
  panel's damage-tier overlay), `computeRollBreakdown`'s "highest hindering Status" detection, and
  `giveStatus`'s Subdued trigger all still branched on "not Positive," silently treating a Neutral
  Status as a wound — contradicting `engine.ts`'s own doc comments ("a **Negative** Status...").
  All three now check `Polarity === 'Negative'` exactly, with new unit coverage. Also fixed the
  same bug at three UI display sites — `StatusesPanel.tsx` (a real "Neutral" group, previously
  lumped into "Negative" and colored red), `ParticipantCard.tsx`, and `PeekCard.tsx` (GM
  live-peek). Left alone, deliberately, with a flagging comment at each: `GiveStatusModal.tsx`'s
  opposing-Status candidate filter and `StatusesPanel.tsx`'s Make Camp differential clear, since
  neither has any doc-text basis for how a Neutral Status should behave, unlike the three sites
  above.
- **Status polarity recolor** (`apps/web/src/styles/tokens.css`): Positive moves from `--gold`
  (the app's general chrome accent, unrelated to Status polarity) to a new dedicated
  `--positive`/`--positive-tint`/`--positive-line` — a muted moss green matched to the existing
  warm, desaturated palette rather than a bright saturated green. Neutral reuses the existing
  `--ink-45`/`--ink-25` opacity stops rather than a new grey token.
- **Statuses quick-add row: matched Polarity/Rank fields, defaults to Neutral**
  (`StatusesPanel.tsx`/`.module.css`, `GiveStatusModal.tsx`): the Polarity `<select>` had no label
  (unlike Rank's) and no explicit height, reading as visually uneven, and didn't grow to fill the
  row below 1024px, leaving dead space after the Add button. Wrapped it in a labeled
  `.polarityField` matching `.rankField`'s existing pattern, sized to grow and fill the row. Both
  quick-add locations now default to `Neutral` instead of `Negative`.
- **`AppThemeGuidelines.md`** (new): consolidates the philosophy and mechanism behind the sheet's
  "parchment damage" overlay system (`Panel`'s `grain`/`damageTier`/`damageVariant` props,
  `DamageOverlay`, `damageTier()`/`DAMAGE_TIER_OPACITY`) — quotes the original design handoff
  directly, inventories which of the app's 8 sheet panels opt in (2: Virtues, Statuses), and lists
  open questions for a future refinement pass.
- **VirtuesPanel: tighter grouping, name paired with value** (`VirtuesPanel.module.css`): the
  Condition row sat a loose 9px below the Virtue's name/score, trimmed to 7px so it reads as
  belonging together; `.naming`'s `flex: 1` (which pinned the score to the panel's far right
  regardless of name length) removed so the score sits immediately next to its own Virtue's name.
- **Looks: an editable chip list instead of one freeform textarea**
  (`LooksPanel.tsx`/`.module.css`): mirrors `CreateCharacterPage.tsx`'s existing repeatable-list
  pattern for the same field — each line of `CharacterSheet.Looks` (still one `\n`-joined string on
  the wire) now renders as its own small "index tag" chip, restrained per the design handoff's own
  anti-skeuomorphism principle (no torn edges, wax seals, or drop shadows — "parchment and ink are
  the medium... not a costume the UI wears"). `seedPlay.ts`'s 4 premade characters' `Looks`
  reformatted from one comma-separated sentence to short `\n`-separated phrases so the demo
  campaign actually shows the new chip UI with more than one chip.
- `README.md`'s judgment-call #2 updated to reflect the Virtue-array correction above (was
  asserting the old single array as settled).

## [0.19.0] — 2026-08-11T23:36:18Z

A full-codebase audit against all six Claude Code skills installed in the repo (`theme-tokens`,
`perf-budget`, `responsive-device-qa`, `vercel-react-best-practices`/`vercel-composition-patterns`,
`web-design-guidelines`, `supabase`/`supabase-postgres-best-practices`), followed by fixing every
finding it surfaced — the mechanical/low-risk ones first, then the four the audit itself flagged as
needing a product/architecture decision rather than a mechanical fix. No regressions found on the
Supabase/Postgres side (the joinless-RLS-policy bug class fixed in `0006` doesn't recur anywhere,
including `combat_encounters`); no findings needed a schema change.

- **theme-tokens**: `InfoTooltip.module.css` referenced `var(--ink-80)`, which doesn't exist (the
  opacity stops run `--ink-75` down to `--ink-25`) — a copy/typo from the byte-identical `.bubble`
  block in `GlossaryText.module.css`. Fixed to `--ink-75`. Added `--gold-fade` to `tokens.css` and
  extracted the byte-identical gold-hairline `.rule` class (previously duplicated in `Panel.
  module.css`, `CampaignPage.module.css`, `CampaignBonds.module.css`) into a new
  `apps/web/src/styles/dividers.module.css`, composed the same way `buttons.module.css`/
  `modal.module.css` already are. Swept 34 unconditional hardcoded `44px` min-height/min-width/
  width literals across 15 component stylesheets to `var(--tap-min)` — no behavior change, same
  computed value, just sourced from the existing token instead of a literal.
- **perf-budget**: `GET /:id/bootstrap` (`apps/server/src/routes/campaign.ts`) awaited 8
  independent Supabase reads sequentially with no real dependency between them — batched with
  `Promise.all`. This is the app's highest-traffic route for this pattern: hit on every
  campaign-shell load and on every Realtime invalidation (`useLiveCampaign` invalidates the whole
  bootstrap key on any party/bond/sheet/encounter change). `useGlossaryMatcher.ts`'s `useMemo`
  only deduped within one component instance — 8+ sheet panels each rebuilt an identical matcher
  from the same referentially-stable `library.glossary` array on a single mount. Added a
  `WeakMap<GlossaryTerm[], GlossaryMatcher>` module-level cache keyed on the array's identity,
  making the hook's own "one matcher shared across the tree" comment literally true.
- **web-design-guidelines (headings/labels)**: `CharacterSheetPage`, `CampaignPage`, and
  `AdminPanelPage` all skipped straight to `<h2>` with no `<h1>` ancestor — promoted the
  character/campaign name to a real `<h1>` on the first two, added a new "Content Admin" `<h1>` to
  the third (which had no page title at all). Associated unassociated `<label>`/control pairs
  app-wide — `FieldEditor.tsx` (every Content Admin field), the sheet/combat modals, `CombatPage`'s
  Combat Goal field — plus two controls with zero accessible name at all (`StatusesPanel.tsx`'s
  per-Status rename input, `ThemePanel.tsx`'s quest-completion toggle, empty when unchecked).
- **web-design-guidelines (modal dialogs)**: every one of this app's 12 modals hand-rolled its own
  backdrop + dialog div with no focus management — a keyboard user could Tab straight through into
  the page behind an open modal, and Escape did nothing. Added `apps/web/src/lib/useModalA11y.ts`,
  a shared hook (focus trap, initial focus, Escape-to-close, focus-restore-on-close) applied to all
  12: `GiveStatusModal`, `HealStatusModal`, `MakeCampModal`, `CombatMoveModal`,
  `AddParticipantModal`, `EndSessionModal`, `SubduedModal`, `AdvancementPicker`, `ForgeBondModal`,
  `AboutModal`, `ConfirmModal`, `MarkKinModal`. A callback ref, not `useRef` + a mount effect,
  since `AdvancementPicker` never unmounts (its caller renders it unconditionally; it internally
  `return null`s when there's no active picker) — a callback ref fires correctly when only the
  dialog's own subtree appears/disappears, a mount effect wouldn't. Tracks a small open-dialog
  stack so Escape only closes the topmost dialog, since `EndSessionModal` nests `MarkKinModal` (Mark
  Kin, spent from Hold) — the one place two of this app's modals are open at once.
- **web-design-guidelines (confirm-before-destroy)**: revoking an invite (`InvitesPanel.tsx`),
  removing a Combat participant (`ParticipantCard.tsx`), deleting a Status
  (`StatusesPanel.tsx`), and dropping a Quest (`ThemePanel.tsx`) all used to fire immediately —
  gated each behind `ConfirmModal`, matching the pattern already used for campaign archive and
  sheet-import-overwrite.
- **vercel-react-best-practices**: `App.tsx` statically imported `AdminPanelPage` and `CombatPage`
  alongside every other route, shipping both in the same bundle as the character sheet every
  player session actually uses. Wrapped both in `React.lazy`/`Suspense` — main bundle
  674 kB → 613 kB, with `AdminPanelPage` (30.76 kB) and `CombatPage` (31.80 kB) now separate
  chunks that only download when a session navigates to those routes.
- **vercel-composition-patterns**: `ParticipantCard.tsx` took 6 boolean props (`canControl`,
  `canEngage`, `isOwnPC`, `canRecuperate`, `canDefend`, `canHelp`) to render what were always one
  of three fixed combinations — the tell was `EncounterView.tsx`'s enemy call site passing three
  literal no-op handlers (`onRecuperate`/`onDefend`/`onHelp={() => {}}`) purely to satisfy the
  shared prop type. Split into `OwnPCCard`/`AllyPCCard`/`EnemyCard`, composed from a shared
  unexported `ParticipantCardShell` holding the actually-common chrome (name/badges, Range/AP
  stepper, Statuses, the remove-confirm flow); only `canControl` turned out to be a genuinely
  orthogonal permission and stayed a real prop. The enemy call site no longer passes any no-op
  handlers at all.
- **supabase/supabase-postgres-best-practices (decision, no schema change)**:
  `campaigns.gm_user_id`/`characters.user_id`/`memberships.user_id` have no `ON DELETE` clause
  (defaults to `RESTRICT`) — confirmed with the repo owner to keep the status quo rather than
  cascade or `SET NULL`, since there's no in-app account-deletion feature yet and a cascade would
  let deleting one GM's account silently wipe every other player's data in their campaigns.
  Recorded as `README.md#architecture-notes--judgment-calls` item 21 so it doesn't get re-flagged
  as an open question in a future audit.

## [0.18.3] — 2026-08-11T15:45:54Z

- **Statuses panel quick-add row: name gets its own row on phones** (`StatusesPanel.tsx`,
  `StatusesPanel.module.css`): Polarity, Rank, and Add were sharing a cramped line with the name
  input below 1024px. Wrapped them in `.addControls` and switched `.addRow` to a column flex below
  1024px (name full-width, controls grouped on the row underneath) — a plain flex column rather
  than `.rowHead`'s CSS grid, since none of these four controls is wide enough to trigger the
  flex-basis:0 wrapping trap that forced the grid there. At 1024px and up, `.addControls` becomes
  `display: contents` so its children rejoin `.addRow`'s single-row flex layout directly,
  reproducing today's one-line order exactly.
- **Rank/d6 number inputs actually take arbitrary values now** (`StatusesPanel.tsx`,
  `GiveStatusModal.tsx`, `HealStatusModal.tsx`): all three shared the same bug — clamping the
  input's own controlled value on every keystroke (`Math.max(1, Math.min(6, parseInt(...) || 1))`)
  meant backspacing to clear the field snapped it back to `"1"` before a replacement digit could be
  typed, so the next digit landed on top of that forced `"1"` instead of starting fresh (e.g. typing
  `2` after the snap-back produced `"12"`, which clamped to the max — trying to set Rank 2 could
  silently land on 6). Fixed by controlling each input with its own raw text state, deriving the
  clamped number fresh every render for display/submit, and normalizing the visible text only on
  blur — the same commit-on-blur shape the per-status name field already used, not a new pattern.

## [0.18.2] — 2026-08-11T12:48:37Z

- **Statuses panel mobile layout fix** (`apps/web/src/features/sheet/StatusesPanel.tsx`,
  `StatusesPanel.module.css`): on a real phone, an existing status row's name input, 6-dot `Pips`
  row, rank digit, and remove button were fighting for space in one `flex-wrap` row — the name
  input rendered narrower than its own value (a status named "Chubby" displayed as "Chubb") and the
  rank digit got stranded on its own line. `.rowHead` is now a CSS grid with two named-area
  templates: unchanged single-row layout (`name pips rank remove`) at 1024px and up, reflowing
  below that to `name rank remove` on one row and `pips` alone on the next — `pips` needs a row
  entirely to itself (not shared with `rank` in a split column) or its own internal `flex-wrap`
  kicks in and its 44px touch overlays overlap between the wrapped lines, which the responsive
  smoke test caught on the first cut of this fix. The 1024px threshold (not the phone/tablet 600px
  break used elsewhere in this file) is also smoke-test-derived: this panel sits in `.sheet-grid`'s
  second column, still too narrow for the single-row layout through the 768–1023px range (a 600px
  cut passed locally but the smoke test caught it overflowing at 768px). See the new Frontend
  conventions note in `CLAUDE.md` for the full diagnosis and the always-stack alternative
  considered and deferred.
- **Statuses panel quick-add name field** (`StatusesPanel.tsx`): the "New status name…" input was
  missing the `tap-inline` class every other control in the same row already had, leaving it at a
  29px painted height on a coarse pointer — under the 44px minimum, and the one control in that row
  the responsive smoke test hadn't been catching. Pre-existing, unrelated to the layout fix above;
  found while re-running the smoke test for it.
- **Statuses panel quick-add row polish**: the Rank number input had no visible label (just a bare
  box), and the Add button used the app's solid dark primary-CTA treatment, which read as
  disproportionately heavy for a small inline form. Added a small uppercase "Rank" label
  (`<label htmlFor>`, replacing the screen-reader-only `aria-label`) and switched Add to the
  existing outline/ghost secondary-button look ("Make Camp", "Refresh all"). That treatment was
  duplicated byte-for-byte across `StatusesPanel.module.css`'s `.camp` and `ArmorPanel.module.css`'s
  `.refresh`; extracted into a shared `.btnSecondary` in `styles/buttons.module.css`, composed into
  all three call sites now that there's a third consumer.

## [0.18.1] — 2026-08-11T11:31:14Z

- **Statuses panel quick-add row** (`apps/web/src/features/sheet/StatusesPanel.tsx`): the ad-hoc
  "New status name…" row always created a new Status at a hardcoded `Rank: 1` — Rank could only be
  changed afterward, via the pips on the row it just created. Added a bounded (1 to
  `library.settings.StatusMaxRank`) Rank number input next to the Polarity select so Rank is set at
  creation time, alongside the name, in one step. The "Give a Status…" modal (`GiveStatusModal.tsx`)
  already let Name and Rank be set together and was untouched.

## [0.18.0] — 2026-08-11T00:40:00Z

Track B from the `0.17.0` audit — the real content/mechanic gaps that audit found but deliberately
didn't act on. Scoped with the repo owner before writing any code: five decisions confirmed up
front (defer the Level/Tier-threshold formula question, model Wealth/Treasure as per-character
resources, consolidate "Kith" into "Kin," Advantage/Disadvantage informational-only, defer
Undertake a Journey/Enjoy Downtime's guided UI), everything else built straight from the doc text.

- **`CharacterSheet.Wealth`/`Treasure`** (`packages/shared/src/types.ts`): every doc mention of
  either is a per-player spend (Follow a Lead, Enjoy Downtime, Gear Charges), never a shared party
  pool like Rapport, so both live on the character. The doc has no earn mechanic for either — per
  the repo owner, both are just a freely player/GM-adjusted `+`/`−` counter on the sheet
  (`StatusesPanel.tsx`) for now, no automated grant.
- **`CharacterSheet.Hold`**: End the Session's per-player pool, persisted rather than resolved in
  one sitting.
- **`normalizeLibrary()`... — this session's actual counterpart, `normalizeSheet()`** extended to
  default `Wealth`/`Treasure`/`Hold` to `0` on a sheet saved before `0.18.0`, same self-heal-on-read
  pattern as `Recoveries`/`Scars`. Unit tested.
- **`EndSessionModal.tsx`** (new, `apps/web/src/features/sheet/`): the doc's branching Rapport
  formula (0/1–2/3+ party questions hit → 0/+1/+2 Rapport) plus the per-player hold/spend
  subsystem (grant Hold from your own questions, spend it 1-for-1 refreshing a piece of Gear,
  clearing a Condition, marking Kin via the existing `MarkKinModal`/Bond-propose flow, or marking
  Potential). This app has no Playbook system yet, so it doesn't author or count the doc's example
  questions itself — the table answers them out loud and reports how many hit.
- **`MakeCampModal.tsx`** (new): Make Camp was already fully automated (Status/Armor/Recoveries)
  except the doc's "clear 1d6 Conditions" component, which needed a choice — report the d6, then
  pick up to that many currently-marked Conditions to clear.
- **`AdvantageToggle.tsx`** (new shared component, `apps/web/src/components/`): a purely
  informational Normal/Advantage/Disadvantage toggle wired into both roll-breakdown render sites
  (`MoveRollHelper.tsx`, `CombatMoveModal.tsx`). This app never rolls dice (see `engine.ts`'s doc
  comment) — Advantage/Disadvantage don't change the computed total at all, the toggle just notes
  "roll 3d6, keep the best/worst two" for the table.
- **Six new seeded Moves** (`packages/shared/src/seedLibrary.ts`): Strike a Nerve, Recall a
  Flashback, Recuperate (the Move entry was missing even though its mechanic — spend a Recovery,
  1d6+Mettle — already existed), Level Up, Progress the Party, Forge a Bond (the latter two also
  already-shipped mechanics that just lacked a library entry). Level Up/Progress the Party's text
  deliberately omits the doc's compound Tier-unlock formula — see below.
- **Deliberately not resolved, flagged for later** (see `README.md#architecture-notes--
  judgment-calls` and `CLAUDE.md`): the doc's Tier-unlock formula for Level Up/Progress the Party
  requires both an advancement count *and* a specific Level, and the two clauses can't both be
  literally true at the same moment as worded — this app still gates purely on advancement count
  (unchanged from `0.13.0`), with no `Level`/`PartyLevel` field added yet. Undertake a Journey and
  Enjoy Downtime remain un-seeded and without dedicated UI, pending a scoping decision on whether
  either needs a guided flow beyond generic Move-text reference.

## [0.17.0] — 2026-08-10T22:00:00Z

The result of a full codebase/rules/schema audit requested by the repo owner (see `HANDOFF.md`
for the full writeup and the Track B list of open content decisions this surfaced but didn't act
on). Five fixes, all confirmed with the repo owner before landing:

- **`normalizeLibrary()`** (`packages/shared/src/logic.ts`, unit tested): the same self-heal-on-
  read pattern `normalizeSheet()` already used for `CharacterSheet`, extended to the `Library`
  singleton — CLAUDE.md already called this out as the general rule but it was never actually done
  for Library. The live project's `library.settings` predated `0.13.0`/`0.14.0` and was silently
  breaking real gameplay math: new characters got 0 Recoveries instead of 6, the server-side
  Skill-count cap at character creation never triggered, and Advancement Tier progression was stuck
  at Tier 1 forever for every character and the party. Called from `repo.ts`'s `getLibrary()`,
  same persist-the-backfill pattern as `getSheet()`. The live `library` singleton was also directly
  reseeded to the current `seedLibrary()` output (test data, not precious — confirmed with the repo
  owner) so it actually has Glossary/Enemies content instead of just empty-array defaults, and the
  four live `character_sheets` rows still missing `Recoveries`/`Scars` (an unexercised corner of the
  `0.16.1` fix — nobody had loaded them live yet) were backfilled directly to the same 0/`[]`
  defaults `normalizeSheet()` would apply.
- **Bond Kin-lock** (`isBondLocked()`/`applySpendKin()` in `packages/shared/src/logic.ts`, unit
  tested): `Advancements.md` — "When you place your 5th Kin at Bond 5, your Bond Level locks and
  can not be moved down. You can no longer spend Kin on that track" — was never enforced.
  `applySpendKin()` now throws `BondHandshakeError` (409) once a Bond is locked; the `ForgeBond`
  route guard (`apps/server/src/routes/bond.ts`) also refuses a further Forge on an already-locked
  Bond, since forging again would otherwise reset `KinTrack` to 0 and silently unlock it.
  `CampaignBonds.tsx`/`AdvancementPanel.tsx` show "(Locked)" next to the Bond Level and hide the
  Spend/Forge controls instead of leaving them to fail against the 409, matching the archived-
  campaign precedent.
- **`Martyr`'s Skill and Ability entries disagreed on their own trigger** (`seedLibrary.ts`): the
  Skill read "3 Conditions or 6 negative Status Ranks," the Ability dropped the Status-Rank branch
  entirely. Aligned the Ability's `RulesText`/`TriggerText` to match the Skill.
- **`Dishonored`'s Combat effect, previously an unfulfilled "once it's built" promise in its own
  glossary text, is now real**: `applyDishonoredVulnerable()` (`packages/shared/src/combat.ts`,
  unit tested) grants a flat Rank-4 negative "Vulnerable" Status — reusing `giveStatus()`, no new
  tracker, same pattern as Gambits' Calculate/Brace — the moment a PC's Condition-marking action
  inside a live Combat Encounter pushes them into Dishonored (all five Conditions marked). Wired
  into `EncounterView.tsx`'s `applyGambits()`, the only place Combat currently marks a Condition
  (a Gambit's cost). Fires once at the false-to-true transition, not on every subsequent Condition
  mark while already Dishonored. **Deliberately scoped narrower than "whenever Dishonored in
  Combat"** — a PC who enters an Encounter already Dishonored, or becomes Dishonored some other way
  while an Encounter is merely open, doesn't get this applied retroactively; flagged in `CLAUDE.md`
  as a judgment call worth revisiting if that gap matters at the table.
- No new migration — all JSONB-field-level fixes plus one live data reseed/backfill (via the
  Supabase MCP tool).

## [0.16.1] — 2026-08-10T01:49:45Z

Fixes a live-app crash reported by the repo owner: opening an existing (pre-`0.13.0`) character
sheet threw and blanked the page.

- **Root cause**: `Recoveries`/`Scars` were added to `CharacterSheet` in `0.13.0` with no backfill
  for already-saved sheets. A sheet's JSONB blob written before that version simply has no such
  keys, so `sheet.Scars` deserialized as `undefined` — `StatusesPanel.tsx`'s unguarded
  `sheet.Scars.length` (and `.map()`) threw `TypeError: Cannot read properties of undefined
  (reading 'length')` on first render, crashing the page for anyone with an older sheet. A
  newly-created sheet never hit this, since character creation always initializes both fields —
  only accounts that predate the rules-engine work were affected.
- **Fix, both sides**: `packages/shared/src/logic.ts` gets a new `normalizeSheet()` (unit tested)
  that defaults a missing `Recoveries` to `0` and a missing `Scars` to `[]`; `apps/server/src/
  repo.ts`'s `getSheet()` now calls it on every read and — same self-heal-on-read pattern
  `campaign.ts`'s bootstrap route already uses for a missing `Party` row (see `HANDOFF.md`
  Open issue 1) — persists the backfilled shape back to the row so it's fixed once, permanently,
  rather than re-patched on every load. `StatusesPanel.tsx` and `EncounterView.tsx` also guard
  their `Recoveries`/`Scars` reads directly (`?? 0` / `?? []`), as defense in depth in case a sheet
  ever reaches the client from anywhere other than `getSheet()`.
- No migration needed — this is a JSONB-field default, not a schema change, and the fix repairs
  affected rows itself the first time each is read after deploying.

## [0.16.0] — 2026-08-09T16:20:00Z

The last two Reaction Moves — all five are now wired up. Both reuse existing mechanics off-turn
rather than inventing new ones; see `CLAUDE.md`'s Combat note and `README.md#architecture-notes--
judgment-calls` item 17 for the full writeup.

- **Opportunity Attack**: `CombatMoveModal`'s ordinary Engage-in-Melee flow (roll breakdown, tier,
  Gambits) triggered off-turn from a standalone "Reactions" button, with a `free` flag that skips
  the usual Action Point cost. Deliberately manually triggered rather than auto-detected — this
  app's Reposition control already collapsed Maneuver/Shift into one generic move, so there's no
  signal left to tell which one an enemy used to leave Melee range.
- **Interpose**: redirects an existing `PendingStatusOffer` to the interposing PC (new
  `PendingStatusOffer.Resistable` field, set `false` — the doc is explicit this can't be Resisted)
  and swaps Range with the original target, rather than creating a second offer.
- **`packages/shared/src/combat.ts`**: `rangeBandDistance()`, backing Interpose's "within 2 Range
  bands" reach check. Unit tested.
- Both Reactions are PC-only, matching Gambits' precedent. No new migration.

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
