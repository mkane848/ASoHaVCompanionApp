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
