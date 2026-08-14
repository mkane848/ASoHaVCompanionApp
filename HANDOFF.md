# Handoff

Status snapshot and open threads for whoever (human or Claude) picks this project up next. If
you're starting new work here, read this first — especially "Open issues" below, so you don't
duplicate a fix or lose track of something already in flight.

Last updated: 2026-08-14, a thirty-third session — executed `WorkPlan-0.25.0.md` (written and
approved by the repo owner in the thirty-second session) start to finish: all ten remaining
checklist items, `0.24.1` → `0.25.0`. **`WorkPlan-0.25.0.md` is now fully landed** — nothing left
to pick up from it, kept in the repo as a record of the decisions locked during planning, same as
the other `WorkPlan-*.md` files. Summary in the thirty-third-session note directly below.

The thirty-second session was planning only, no app code: wrote
`WorkPlan-0.25.0.md` (mobile UI cleanup, a player-facing Glossary drawer, a one-level cap on
definition tooltips) from repo-owner mobile testing feedback, and the repo owner approved it.
Summary in the thirty-second-session note below that.

The thirty-first session was an adversarial review of the thirtieth
session's `WorkPlan-0.24.0.md` implementation, checked against the actual diff rather than the
shipped commit's own account of itself. Found two real bugs that `npm run typecheck`, the unit
suite, and the responsive smoke test structurally couldn't have caught (neither is a layout
regression), each confirmed empirically before being fixed: `GlossaryAutoLink` silently not taking
effect for an already-loaded session, and a typo'd smoke-test filter reporting a false "all clean."
`0.24.0` → `0.24.1`. Summary in the thirty-first-session note directly below.

The thirtieth session executed `WorkPlan-0.24.0.md` (written by the
twenty-ninth session, planning-only) start to finish: all eight remaining PRs (PR 1, the doc-only
open-issues entries, had already landed with the plan itself), `0.23.0` → `0.24.0`. Summary in the
thirtieth-session note below. **`WorkPlan-0.24.0.md` is now fully landed** — nothing left
to pick up from it — kept in the repo as a record of the decisions locked with the repo owner
during planning, same as `WorkPlan-0.23.0.md`/`AppThemeGuidelines.md`. The twenty-ninth session
(planning only, no code) is summarized right after.

The twenty-eighth session executed `WorkPlan-0.23.0.md` (written by
the twenty-seventh session, planning-only) start to finish: all seven PRs, `0.22.0` → `0.23.0`.
Summary in the twenty-eighth-session note below. **`WorkPlan-0.23.0.md` is now fully
landed** — nothing left to pick up from it — but it's kept in the repo as a record of the decisions
locked with the repo owner during planning, same as `AppThemeGuidelines.md`. The twenty-seventh
session (planning only, no code) is summarized right after. The twenty-sixth session
(`0.19.0` → `0.22.0`) did three
repo-owner-requested rounds of UI cleanup and rules verification in sequence, each shipped as its
own version bump — see after that. The twenty-fifth session (`0.18.3` →
`0.19.0`) ran a full engineering-quality audit against all six
Claude Code skills installed in the repo and then fixed every finding. The twenty-fourth session
(`0.18.1`) let a Status's Rank be set at creation time in the sheet's quick-add row, requested
directly by the repo owner. The twenty-third session
(`0.18.0`) built "Track B" from a previous audit — see Open issue 12 for the two pieces still
deliberately deferred. The twenty-second session (`0.17.0`) ran that audit itself and fixed the
smaller "Track A" findings, summarized right after. The twenty-first session (`0.16.1`) fixed a
live-reported crash, summarized after that. The twentieth session (`0.12.1` → `0.16.0`) is
summarized after that — the first real game-engine slices: roll-modifier breakdowns, a full
Status/Condition mechanical system, and a live Combat Encounter view (core loop, all five Combat/
Reaction Moves, Gambits, Enemy stat blocks). See [CHANGELOG.md](CHANGELOG.md) for the
version-by-version detail and [README.md](README.md#architecture-notes--judgment-calls) for design
decisions and rationale. The session-by-session history below starts from `0.3.0`→`0.4.0`; sessions
before the sixteenth (which started the game engine) are condensed to a line or two each — see
`CHANGELOG.md` if you need a version's full technical detail.

**Thirty-third session (`0.24.1` → `0.25.0`)**: executed `WorkPlan-0.25.0.md` in full, all ten
remaining checklist items (PR 1, the plan document itself, had already landed with the thirty-
second session). Landed as five separate PRs — one per numbered group of the plan's own "Order of
work," each with a per-item commit inside it — rather than the eleven the plan enumerated or one
squashed commit: eleven was agreed to be more review overhead than a solo maintainer needs, and a
single squashed PR was the exact traceability gap the thirty-first session's adversarial review
flagged against `0.24.0`. Each PR verified independently (`npm run typecheck`, the full unit
suite, the full responsive smoke test at every viewport for anything touching layout, `npm run
screenshot` before/after) before the next began.

Three things worth knowing before touching this area again:

1. **`--action-min: 150px` (the plan's own stated value) never actually reached two-up for a row
   nested inside a Panel's own padding** — checked against a real screenshot rather than trusted
   from the plan's arithmetic, which didn't account for the Panel's 22px padding (and, for Bond
   actions, a further `.bondsBox`/`.pending` wrapper on top of that). 130px does, without
   truncating the longest label found at any call site. See `README.md#architecture-notes--
   judgment-calls` item 25.
2. **The plan's own "same rule as tooltips" language for the Glossary drawer's definitions turned
   out not to be a real ordering dependency.** Section D (item 8) reads as depending on section E's
   (item 9's) depth-cap fix landing first, but `linkifyText` called at depth 0 — which every
   top-level GlossaryDrawer entry does, since none of them are nested inside another bubble —
   already resolves explicit-tag brackets to plain text regardless of `MAX_DEPTH`. Built item 8
   before item 9 with no issue; flagged in the plan's own checklist in case this surprises a future
   read of the diff order.
3. **One real regression caught only by checking a screenshot, not by any automated check**:
   `EndSessionModal`'s Hold-count input + Grant Hold row is exactly the "mixed row" shape section B
   says shouldn't get `.action-grid` (a fixed-width input beside a button) — building it anyway
   (the plan's own C3 listed it among the rows to convert) stretched the input to the row's full
   width the moment it dropped to one column on a phone. Kept as a plain flex row instead. Worth
   remembering that "the plan said to convert this row" and "this row is safe to convert" aren't
   always the same fact, even within the same plan.

Also fixed a real, previously-undetected bug while building the new `responsive-smoke.mjs` bubble-
positioning check (item 10): confirmed via Playwright that a definition bubble on the rightmost
term/trigger genuinely clipped off the right edge of a 375px viewport before the fix, and stayed
fully on-screen after — not just inferred from the CSS.

**Thirty-second session (planning only, no version bump — still `0.24.1`)**: wrote
`WorkPlan-0.25.0.md` and got it approved by the repo owner. **No app code changed**; the only
non-doc commit was a lockfile sync (below). Pick this up at PR 2 of the plan's "Order of work"
checklist — PR 1 (the plan itself) has landed.

Prompted by repo-owner testing on a real iPhone: four screenshots showing buttons wrapping raggedly
into the next row, and controls taking a whole row each where two would fit. The plan is on
[PR #92](https://github.com/mkane848/ASoHaVCompanionApp/pull/92) (draft, CI green).

Three things a future session should know before opening the plan:

1. **The diagnosis, so it doesn't get re-litigated.** The app is not missing a layout system — it
   has 63 `flex-wrap: wrap` declarations across 31 stylesheets and exactly *one*
   `repeat(auto-fit, minmax(...))` grid (`HomePage.module.css:22`). `flex-wrap` on content-sized
   children is an overflow fallback, not a layout: each button is as wide as its own label, so rows
   break wherever the labels run out of room and the slack collects at the right edge. This is the
   same root cause `Planning Docs/ResponsiveAudit.md` identified on 2026-08-02, one level down —
   that audit fixed *page* layout, and *row* layout inside a panel was never revisited. The fix is
   an `.action-grid` primitive on `auto-fit`/`minmax`, chosen over a container query **specifically
   because it needs no hand-derived threshold** — that arithmetic is what `StatusesPanel.module.css`
   has had re-derived and re-checked across three separate versions now. Container queries stay the
   right tool for *rearranging* a layout; `auto-fit` is the right tool for *distributing peers*.
2. **A real defect was found while scoping, and is not yet fixed.** Nested definition tooltips are
   **unbounded**, not capped at two levels as designed. `packages/shared/src/glossary.ts:25` sets
   `MAX_DEPTH = 1` and `linkifyText` guards on `depth > MAX_DEPTH`, but
   `apps/web/src/components/GlossaryText.tsx:81` passes a hardcoded `1` instead of `depth + 1`, so
   the counter never increments and the guard never trips. Kin → Bond → Kin → … stacks as deep as a
   player keeps tapping. Plan section E fixes it; nothing is fixed yet.
3. **A decision was reversed mid-scoping, deliberately.** While answering the repo owner's
   clarifying questions I said a button left alone on a grid's last row would stretch to fill it.
   That is not implementable as a default: there is no CSS-only test for "alone on the last row"
   once `auto-fit` makes the column count variable, so the rule that tidies a phone would wrongly
   stretch a button on a desktop where all three already fit. The plan does **not** do it — see
   "The leftover cell" in section B. An explicit `--span-all` modifier stays available where
   full-width is a deliberate emphasis choice at every width.

Four questions were put to the repo owner and answered before the plan was written; all four
answers are recorded in the plan's "Decisions already locked" section (Glossary on both the sheet
and the Campaign page; sweep all fifteen routes; fixed card below 600px for definition bubbles;
"See also" chips replacing the removed nesting). Don't re-ask these.

Also landed, unrelated to the plan: **`package-lock.json` was synced to `0.24.1`.** The `0.24.1`
bump updated all four `package.json` files but never regenerated the lockfile, which still recorded
`0.24.0` for the root and all three workspaces. Version fields only, no dependency changes. Worth
noting as a recurring failure mode — the version-sync step in
`.claude/skills/release-reliability-checklist` covers the four `package.json` files but the lockfile
is easy to forget, and nothing in CI catches it.

One environment note for the next session: **this container needed `npm install` before anything
would build** (a fresh clone has no `node_modules`, so `npm run build -w @asohav/shared` fails with
missing `vitest`/`zod` types rather than a real type error). The screenshot script then works fine
with `CHROMIUM_PATH=/opt/pw-browsers/chromium` — a 390px pass over all fifteen routes takes about
two minutes and needs no network, and its output is what section C's findings were drawn from.

**Thirty-first session (`0.24.0` → `0.24.1`)**: an adversarial review of the thirtieth session's
`WorkPlan-0.24.0.md` implementation — re-read the actual diff against each plan item rather than
trusting the shipped commit message, then re-ran `npm run typecheck`, the full unit suite, and the
responsive smoke test (all seven viewports, character-sheet route) clean before looking for what
those checks can't catch. Found and fixed two real bugs, both confirmed empirically rather than
asserted:

1. **`GlossaryAutoLink: false` didn't reliably take effect** (`apps/web/src/lib/
   useGlossaryMatcher.ts`) — the matcher cache was a single `WeakMap` keyed only on
   `library.glossary`'s array reference, on the documented assumption that `GlossaryAutoLink`
   always changes in lockstep with it. It doesn't: `useLibrary()` never opts out of TanStack
   Query's default `structuralSharing`, which keeps a fetched sub-tree's *old* reference whenever
   it's deep-equal to the new one — so a settings-only refetch (Content Admin's own save, or
   `useLiveCampaign`'s Realtime subscription firing on *any* library write) could hand
   `library.glossary` back with its previous reference intact, and the single cache would return
   the matcher built under the stale `autoLink` value. Verified with `replaceEqualDeep` run
   directly against a simulated refetch, both before the fix (reproduced the staleness) and after
   (confirmed it's gone). Fixed by splitting the cache into two `WeakMap`s, one per `autoLink`
   value.
2. **A typo'd `SMOKE_ROUTE`/`SMOKE_VIEWPORT` reported a false "All routes clean"**
   (`apps/web/scripts/responsive-smoke.mjs`) — the `0.24.0` filters had no guard against matching
   zero routes/viewports, so every assertion was vacuously true over an empty matrix. Its sibling
   `screenshot.mjs`, built from the same `harnessConfig.mjs` in the same commit, already had this
   guard; it just hadn't been ported over. Added the matching `console.error` + `process.exit(1)`.

See `CHANGELOG.md` 0.24.1 for the full technical detail. The review also worked through (and ruled
out, after building an actual Playwright probe rather than reasoning from memory) a suspected
containing-block regression from `Panel.module.css`'s new `container-type: inline-size` breaking
`position: fixed` modals nested inside a Panel — it doesn't, since `inline-size` containment
doesn't include paint containment. Separately flagged, not fixed: `0.24.0` shipped as one squashed
commit rather than the plan's nine small PRs, which is a real traceability gap on a `main` with no
required status checks (open issue 7) — process, not a code bug, so left as-is here.

**Thirtieth session (`0.23.0` → `0.24.0`)**: executed `WorkPlan-0.24.0.md` end to end, autonomously
— eight PRs' worth of work (the plan's PR 1 had already landed with the plan itself), each verified
independently (`npm run typecheck`, the full 211-test unit suite, and the responsive smoke test at
every viewport for anything touching layout) before the next began. See `CHANGELOG.md` 0.24.0 for
the full technical detail per item; the summary here is what a future session actually needs to
know.

1. **Explicit glossary tags** (`packages/shared/src/glossary.ts`) — CommonMark reference-link
   syntax (`[Term]`, `[display][id-or-name]`, `\[`/`\]` escapes), answering the plan's research
   question. A field with at least one explicit tag disables the regex auto-linker for that whole
   field — no flag, no backfill needed to migrate a field. New `GameSettings.GlossaryAutoLink`
   (default `true`) is a separate library-wide kill switch for the regex pass. Content Admin's
   Validation panel now flags an unresolved tag too. Full syntax writeup in `README.md` judgment-
   call item 23.
2. **Page content-width tokens** (`--content-max`/`--content-max-wide`/`--content-form`,
   `layout.css`'s `.page-shell*` utilities) replace five independently-picked private page widths.
   Home and Campaign now share 1280px; the sheet and Campaign step up to 1600px at `>=1800px`
   viewports for real 1440p-monitor width.
3. **The responsive smoke test gained 1920px/2560px viewports, and a new `screenshot.mjs`** writes
   a PNG per route/viewport to a gitignored dir — the first visual-verification path a session in
   this sandbox has had, since it needs no network. Both scripts now share their route/viewport
   list via a new `harnessConfig.mjs`.
4. **Every `Panel` is a named container-query container** (`Panel.module.css`, `container-type:
   inline-size; container-name: sheet-panel`) — the real fix for the "a panel inside `.sheet-col`
   cannot assume viewport width is its own width" footgun CLAUDE.md had already documented in
   words. Three panels now query their own measured width instead of a hand-derived viewport
   breakpoint: Abilities & Skills (two columns at 560px), Load (tiers \| items at 700px,
   deliberately conservative — see `LoadPanel.module.css`), Advancement (Potential \| Rapport pair
   at 850px). `StatusesPanel`'s own existing 1024px media-query math was deliberately **not**
   converted this pass — flagged as a follow-up, not bundled into feature work. Full writeup,
   including a real CSS-cascade ordering trap this uncovered (`@container` overrides must be
   declared *after* the base rule they override, in this app's CSS Modules setup), in `README.md`
   judgment-call item 24.
5. **Character sheet reorder**: `.sheet-grid` (Virtues \| Statuses, unchanged) → new full-width
   Background panel (Looks + Theme merged, Looks first) → `.sheet-pair` reassigned from Theme \|
   Looks to Abilities & Skills \| Load → Advancement → footer. `ThemePanel`/`LooksPanel` demoted to
   plain sections inside `BackgroundPanel.tsx`, same pattern `ArmorSection` established in `0.22.0`.
6. **Virtue row redesign**: score box moves from leading to trailing the row, Condition is now an
   obviously-pressable button (no checkbox) using the `--gold-tint`/`--gold-line` chip treatment —
   reverses `0.22.0`'s Figma "Option A" pick on a newer, more specific repo-owner markup. Tap-overlay
   clearance math redone from scratch for the new adjacency, not carried over.
7. **Advancement**: Potential \| Rapport pair at an 850px container width; a new shared
   `HistoryModal.tsx` (the app's 13th modal) replaces always-inline history at all three call sites
   (Potential, Rapport, per-Bond) with a "History (N)" trigger — per-Bond history also drops its
   old `.slice(0, 8)` truncation. Combat's `Encounter.History` deliberately stayed a collapsible
   in-page log rather than also moving to this modal (live mid-fight reference, not a retrospective
   record) — left as an open question, not silently decided.

Verification: every item ran clean against `npm run typecheck`, the full 211-test unit suite (132
shared + 79 server — `adminLogic.test.ts` is new, covering the unresolved-glossary-tag validation
path), and the responsive smoke test at all seven viewports (360→2560) for the character-sheet
route specifically, run incrementally after each risky layout change (Virtues, the sheet reorder,
Abilities/Load, Advancement) rather than only once at the end — all clean, no regressions found or
fixed mid-pass. `CLAUDE.md`, `README.md` (two new judgment-call items, 23–24), and the
`responsive-device-qa`/`theme-tokens` skills were updated in the same pass per the plan's own
"Docs and versioning" checklist. No new migration — `GameSettings.GlossaryAutoLink` is a JSONB
field with a `normalizeLibrary()` read-time default, same pattern as every prior addition to that
type. Live QA (clicking through the actual deployed app) still wasn't possible from this sandbox,
same as every prior session — see Open issue 5.

**Twenty-ninth session (planning only, no version bump)**: the repo owner brought a round of testing
feedback — seven UI/UX changes across the character sheet plus one research question about the
glossary — and asked for a plan rather than an implementation, same shape as the twenty-seventh
session. The output is [`WorkPlan-0.24.0.md`](WorkPlan-0.24.0.md), nine PRs in dependency order
(also published as an Artifact for the repo owner at
<https://claude.ai/code/artifact/fbecb9dc-5074-4136-a79a-765cfc4fe294>; the file is the source of
truth if they diverge).
**Nothing was implemented — the branch carries the plan and these doc updates only.**

Five decisions were settled with the repo owner during planning and are in the plan's "Decisions
already locked" table. Three are worth repeating here because a future session would otherwise guess
differently:

- **"Capped resources" means Advancement tracks**, not Wealth/Treasure/Hold — Potential and Rapport
  hitting their cap, where the app has no handling for a further mark. Recorded as open issue 14
  below, not built.
- **The Virtue row's score box moves to the trailing edge**, with the Condition as an obviously-
  pressable button directly beneath it and no checkbox. This **reverses `0.22.0`'s Figma "Option A"
  pick** (boxed score *leading* the row) on the strength of a newer markup from the repo owner —
  `VirtuesPanel.module.css`'s three comment blocks explaining the current arrangement become wrong
  and need rewriting, not deleting.
- **Theme and Looks merge into one "Background" section**, Looks first. That frees `.sheet-pair`
  (which `0.23.0` built for Theme | Looks) to hold Abilities & Skills | Load instead.

Four findings came out of the research that weren't in the feedback and aren't tracked anywhere else
— all scoped in the plan, none fixed:

1. **Page max-widths are inconsistent and nobody chose the spread**: Home 720px, Campaign 1180px,
   sheet 1280px, Combat/create-character 640px. Home's 720px cap is the "wasted space on larger
   screens" the repo owner screenshotted — its tile grid would run four-up given the room.
2. **The responsive smoke test stops at 1440px wide.** A 1440p monitor is 2560×1440, i.e. literally
   untested. The plan adds 1920 and 2560 viewports (and warns the ~8–10 minute run becomes ~12–14).
3. **A screenshot script would actually work in this sandbox** — local vite server, local Chromium,
   seed fixtures, no network — which would be the first visual-verification path any session on this
   project has had. The smoke test asserts overflow/touch/overlap/errors, none of which can catch
   "wasted space." Caveat: `harness.html` pulls Google Fonts from a blocked CDN, so screenshots
   render in fallback serif.
4. **Container queries are the real fix for a bug class `CLAUDE.md` already documents** ("a panel
   inside `.sheet-col` cannot assume viewport width is its own width"). Two of the feedback items
   collide head-on without them: Abilities & Skills becomes a ~350px half-column at 768px *and* is
   supposed to render two items per row at "medium and higher."

Also noticed and deliberately not fixed (out of scope for a planning branch): `README.md`'s
"What's not built" still describes `StatusesPanel.tsx`'s "Link to…"/"Affected by…" buttons as
present — that dead UI row was removed in `0.22.0`. One-line correction for whoever next edits that
section.

**Twenty-eighth session (`0.22.0` → `0.23.0`)**: executed `WorkPlan-0.23.0.md` end to end, autonomously
— seven PRs (#81–#87), each shipped in the plan's dependency order, individually verified
(`typecheck`, the full unit suite, and the responsive smoke test for anything touching layout), and
merged before the next began. See `CHANGELOG.md` 0.23.0 for the full technical detail per PR; the
summary here is what a future session actually needs to know.

1. **`commit()` (PR #81) went from a same-tick cache write with no failure path to a real
   optimistic mutation** — `useOptimisticCommit<T>` in `apps/web/src/lib/mutations.ts`, with a real
   Toast on failure (`toastStore.ts`, new). The one subtlety worth remembering if this code is
   touched again: the cache write happens *synchronously in the closure `commit()` returns*, not
   inside React Query's `onMutate` — `onMutate` only runs after a microtask, which would silently
   break two same-tick commits from composing (each would read the same stale base). Rollback
   restores only the one field that failed, not a whole-document snapshot, since Sheet/Party/
   Encounter share one cache entry.
2. **Status sort order (PR #82), sheet layout reorder (PR #83), and the home-screen tile grid
   (PR #84)** were all repo-owner testing feedback landed close to as specified in the plan, no
   surprises. PR #84's `/me` response batch-fetches per-campaign overview data (roster, Rapport,
   Kin, last-played) with new `repo.ts` functions rather than one query per campaign — worth
   checking `perf-budget`'s guidance again before adding another per-membership field to
   `CampaignOverview`, so this doesn't quietly become an N+1 route as more fields get added.
3. **Combat moved inline into the campaign page for both GM and player views (PR #85)**, preserving
   the `0.19.0` lazy-loading bundle win via a `React.lazy`-imported `CombatPanel` from both
   `GmView`/`PlayerView` — see `CLAUDE.md`'s Combat architecture section, updated this session, for
   the full mechanism. **Found and fixed in passing**: `CombatPage.module.css` had never defined
   seven classNames its "no active Encounter" branch referenced since Combat shipped in `0.14.0` —
   that whole branch (including the Start Combat form) had been rendering unstyled in production
   for three versions with nobody noticing, presumably because most sessions start Combat
   immediately rather than lingering on the empty state. Also moved the undocumented +1-Rapport-on-
   Combat-start bump server-side, atomic with Encounter creation, logged, and Toast-announced — see
   Open issue 13 below, updated this session; the surfacing work is done but the underlying rule
   question is still open.
4. **Combat styling pass and the History log (PR #86)**: a shared `SectionHead` component, real
   button semantics (an offer button/select had been styled `--danger`, i.e. destructive, despite
   not destroying anything), and `Encounter.History` — written on every action since `0.14.0` and
   rendered nowhere until this PR — now shown as a collapsible log.
5. **Shared form primitives plus scoped react-hook-form/zod (PR #87)**, the largest single PR:
   `characterCreationSchema.ts` (`packages/shared`, zod's first use in this repo) replaces two
   independently hand-maintained copies of character-creation validation (client + server) with
   one; `AddParticipantModal`/`CombatMoveModal` got a lighter touch (simple fields registered,
   dynamic arrays left as local state — full `useFieldArray` conversion of working Combat logic
   was judged higher regression risk than this pass's budget, with no live-QA path in this sandbox
   to catch a mistake). See `README.md` judgment-call 22 for the full scoping writeup, including a
   directly-measured bundle-size cost: `zod`+`react-hook-form`+`@hookform/resolvers` land in the
   main JS chunk (not lazy, since `CreateCharacterPage` isn't split the way `/admin`/`/combat`
   are) — 622.71 kB → 726.69 kB raw, 179.89 kB → 211.64 kB gzip. Flagged as a good next-pass
   candidate, not fixed this session; scope was already large enough for one PR.

Verification: every PR ran `npm run typecheck` and the full unit suite (122 shared + 74 server
tests by the end, several new — `characterCreationSchema.test.ts` alone added 12); every PR
touching layout or DOM structure also ran the responsive smoke test
(`CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:responsive -w @asohav/web`), matching CI's
`responsive` job (which stayed green across all seven merges — confirmed via `get_check_runs` per
PR, not assumed). All seven PRs merged clean, no reverts, no CI failures caught after merge. No new
migration — the plan called this correctly: the widened `/me` response reads existing columns, and
Combat's History-log UI reads a field that already existed. Live QA (clicking through the actual
deployed app) still wasn't possible from this sandbox, same as every prior session — see Open issue
2 in `WorkPlan-0.23.0.md` and Open issue 5 below.

**Twenty-seventh session (planning only, no version bump)**: the repo owner brought six pieces of
testing feedback — home-screen tiles, Combat moving into the GM view plus Status ordering, a sheet
layout change, a Combat styling pass, a react-hook-form architecture question, and a tooling ask —
and asked for a plan rather than an implementation. The output is
[`WorkPlan-0.23.0.md`](WorkPlan-0.23.0.md) (also published as an Artifact for the repo owner at
<https://claude.ai/code/artifact/fca7a6d8-4677-4ced-a0ba-71fb40719610>; the file is the source of
truth if they diverge). **Nothing was implemented — the branch carries the plan and these doc
updates only.**

Seven decisions were settled with the repo owner during planning and are recorded in the plan's
"Decisions already locked" table. Three are worth repeating here because a future session would
otherwise be tempted to guess differently: Combat goes inline for **both** the GM and player views
(players are the ones who apply Status offers and Interpose, so a GM-only section would strand
them) with `/c/:id/combat` kept as a working deep link; Status Rank sorts **descending** so the most
impactful Status leads its group; and **zod is approved** as `@asohav/shared`'s first-ever runtime
dependency, which wants a README judgment-call entry (next free number is 22) rather than a silent
lockfile change.

Four findings came out of the research that weren't in the feedback and aren't tracked anywhere else
— all four are scoped in the plan, none are fixed:

1. **`useCommitSheet`/`useCommitParty`/`useCommitEncounter` fire their API write inside a
   `qc.setQueryData` updater callback** (`apps/web/src/lib/mutations.ts`). No rollback on failure,
   errors reach `console.error` and nowhere the player can see, a missing cache entry means the save
   silently never happens, and every commit is an uncoalesced full-document PUT. This is PR 1 in the
   plan's order, ahead of everything else, because it underpins every surface that writes state.
2. **`Encounter.History` is written on every action and rendered nowhere.** Every `log()` call in
   `EncounterView.tsx` pushes an entry; no component reads the array. Either surface it as a
   collapsible log (the plan's recommendation — it's the shared record a table wants mid-fight) or
   stop writing it.
3. **Moving Combat inline threatens PR #70's bundle win.** `EncounterView` and its modals are only in
   the lazy `/combat` chunk; importing them from `CampaignPage`, which every player loads, undoes the
   674 kB → 613 kB split. The plan lazy-loads the extracted `CombatPanel` from the campaign page too
   and keeps a cheap stub for the no-Encounter case.
4. **Starting Combat silently grants +1 Rapport** (`CombatPage.tsx:58`). The repo owner confirmed
   this was *not* deliberate but chose to keep the bump and surface it rather than remove it — see
   Open issue 13 for the rule question that stays unresolved.

The Render MCP connector was also found working for the first time (see Open issue 6, now resolved)
and the workspace confirmed. No code, no migration, no version bump this session.

**Twenty-sixth session (`0.19.0` → `0.20.0`)**: another repo-owner-requested UI-cleanup-and-rules-
check pass, seven items plus a tooling-suggestions ask, planned up front (with a second validation
pass from a Plan agent that caught a real bug in the planned approach before any code was written —
see below) and landed as one PR since this session was scoped to a single branch.

1. **Character-creation Virtue arrays were wrong** — the app's single hardcoded
   `STANDARD_VIRTUE_ARRAY` (`2, 1, 0, 0, -1`) was always just an inference from `seedPlay.ts`'s
   premade characters (`README.md` judgment-call #2), never actually specified in `Planning
   Docs/`. The repo owner gave the real rule: five valid starting arrays. `STANDARD_VIRTUE_ARRAYS`
   replaces the single constant; `CreateCharacterPage.tsx` gained a picker. **The validation-pass
   agent caught a bug in the first-draft approach before it shipped**: the old `VIRTUE_VALUES =
   [2, 1, 0, -1]` constant hardcoded the retired array's distinct-value set, which isn't shared by
   all five new arrays (e.g. `[1,1,1,1,-1]` never uses 2 or 0) — rendering the original fixed
   button set would have left permanently-disabled buttons on some rows. Fixed to derive the
   button set from whichever array the player picks. Worth remembering: even a well-researched
   plan benefits from a second, independent pass before code gets written, and re-deriving claims
   from the actual code rather than trusting a first pass's summary is what caught this one.
2. **A real "Neutral Status treated as Negative" bug**, not just the coloring issue it was reported
   as. `StatusPolarity` has been a real 3-way type for a while, but six sites (three in
   `packages/shared` — the Statuses damage-tier total, the roll-breakdown "hindering Status"
   detection, and the Subdued trigger — plus three UI display sites) all still branched on "not
   Positive," contradicting `engine.ts`'s own doc comments naming Negative specifically. All six
   fixed; two related-but-textually-unsupported spots (`GiveStatusModal.tsx`'s opposing-Status
   filter, `StatusesPanel.tsx`'s Make Camp differential clear) were deliberately left alone with a
   flagging code comment each, rather than guessed at — see `CHANGELOG.md` 0.20.0 for the full
   list.
3. Positive Statuses recolored from `--gold` (the app's general chrome accent, not specific to
   Status polarity) to a new dedicated `--positive` token family (a muted moss green); Neutral
   reuses existing `--ink-*` opacity stops rather than a new grey token.
4. New `AppThemeGuidelines.md` at the repo root, consolidating the philosophy and mechanism of the
   sheet's "parchment damage" overlay system (previously only implicit in scattered code comments)
   for a future refinement pass, per the repo owner's explicit request.
5. Two panel redesigns: `LooksPanel.tsx` went from one freeform textarea to an editable chip list
   (mirroring `CreateCharacterPage.tsx`'s existing repeatable-list pattern), styled restrained
   per the design handoff's own anti-skeuomorphism principle (found while researching item 4, not
   previously written down anywhere in this codebase) rather than reaching for literal
   dog-ears/wax-seal imagery; `VirtuesPanel.module.css` got two small layout fixes (tighter
   Condition-row grouping, Virtue name paired with its own value instead of pinned apart).
6. The Statuses quick-add row's Polarity field gained a label + explicit height to match Rank
   (previously visually uneven) and now grows to fill the row instead of leaving dead space after
   Add; both quick-add locations default to `Neutral` instead of `Negative`.

Verification: `npm run typecheck` and the full unit suite (106 shared + 67 server tests, several
new) ran clean; the responsive smoke test was run against every CSS/layout change before merge —
see `CHANGELOG.md` 0.20.0 for the complete file list. No new migration, no schema change. Tooling
suggestions given
alongside the plan (Figma MCP already connected, a "design" plugin bundle found via marketplace
search, no dedicated TTRPG-specific skill/plugin exists) — informational only, not acted on this
session beyond the suggestion itself.

**Same session, two follow-up rounds after `0.20.0` shipped, both from the repo owner reacting to
the live result (`0.20.0` → `0.21.0`)**:

- **PR #76** (merged without a version bump at the time — folded into `0.21.0`'s changelog entry
  after the fact, per the lesson two paragraphs below): the Statuses quick-add row's Add button
  didn't match Polarity/Rank's height (`min-height` added, scoped to that one button); Status
  groups reordered to Positive → Neutral → Negative per the repo owner's request, with a hairline
  rule added above the two non-first groups so they read as distinct without leaving the panel.
- **A real bug in the roll-breakdown display, caught from a screenshot of "Offer Solace"**: the
  repo owner reported "Roll 2d6 + Heart: +5" as misleading — confirmed via a clarifying question
  (worth asking rather than guessing a third time, given the VirtuesPanel miss above) that the fix
  was splitting `computeRollBreakdown()`'s `Total` (previously Virtue + Condition + Status all
  summed) into `Total` (Virtue + Condition + Permanent Ability only — the named stat's own value)
  and a new `StatusSources` field, rendered as a separate "Also affecting this roll" list at both
  `MoveRollHelper.tsx` and `CombatMoveModal.tsx` rather than folded into the headline. Also removed
  the `0.18.0`-era `AdvantageToggle.tsx` interactive segmented control entirely (deleted, fully
  orphaned once both call sites were updated) — replaced with a static `InfoTooltip` explaining
  Advantage/Disadvantage, since the repo owner confirmed there was never anything to actually
  *toggle*, only something to explain. See `CLAUDE.md`'s rules-engine section and `CHANGELOG.md`
  0.21.0 for the full writeup.
- **The Figma workshop got a reply, and it shipped (`0.21.0` → `0.22.0`, PR #78)**: the repo owner
  picked VirtuesPanel Option A (a boxed score leading the row) with Option B's condition-on-the-right
  placement mixed in, plus "we don't need '— marked' after a Condition name — waste of space"; and
  sheet-layout Option C with a specific addition — merge Armor into StatusesPanel ("a player marked
  an Armor as used rather than taking a Status, so I want the controls to feel integrated") plus a
  general space-optimization ask for the Status rows, sized to feel closer to the Wealth/Treasure
  steppers. All of it shipped: `VirtuesPanel`'s `.scoreBox`/`.conditionRow` restructuring;
  `ArmorPanel.tsx` deleted in favor of an integrated `ArmorSection.tsx` rendered inside
  `StatusesPanel`; the inert "Link to…/Affected by…" Status-row placeholder removed; the sheet
  layout split into full-width bands (Theme, Looks, Abilities & Skills, Load, Advancement) plus a
  `.sheet-grid` holding only Virtues and Statuses; a new `.prose` utility capping paragraph measure
  in the newly-full-width panels. Full writeup in `CHANGELOG.md` 0.22.0.
- **Worth remembering**: the first cut of the VirtuesPanel change shipped a real overlapping-hit-area
  regression that CI caught (not local testing — the local responsive run for that commit was still
  in flight when a stop-hook prompted committing/pushing what existed, which is a fine call given
  the repo's "small, frequent commits, CI is the real gate" convention, but it means this one leaned
  on CI rather than a pre-push local pass). Merging `.tagline` into `.conditionRow` removed a
  spacer line that used to separate a Virtue's own InfoTooltip trigger from the Condition row below
  it; the old `margin-top` value got carried over unchanged instead of being re-derived, and its own
  comment claimed a responsive-test check that never actually happened. Fixed same-session (bumped
  7px → 24px, `.tap` overlay math now documented inline in `VirtuesPanel.module.css`), but the
  general lesson repeats one already in this file: a plausible-sounding number in a carried-over
  comment isn't the same as a re-verified one — re-derive spacing math when the layout around it
  changes, don't just keep the old value.

**Twenty-fifth session (`0.18.3` → `0.19.0`)**: two threads. First, a small doc-sync pass —
`CLAUDE.md` was audited against the four project-authored Claude Code skills (`theme-tokens`,
`responsive-device-qa`, `perf-budget`, `release-reliability-checklist`) installed since the last
session touched it; found it already fully in sync with shipped code, and added a pointer from
`CLAUDE.md`'s "Working conventions" to those skills since they'd been installed with no reverse
reference (PR #60).

Second, and the bulk of the session: the repo owner asked for a full codebase audit using all six
installed skills (the four above plus the generic `vercel-react-best-practices`/
`vercel-composition-patterns` and `supabase`/`supabase-postgres-best-practices`). Ran the
mechanical checks directly (typecheck/build/168-test-suite/responsive-smoke-test, all clean) and
dispatched five parallel agents for the reasoning-based reviews, then compiled everything into a
published Artifact report. Headline result: the joinless-RLS-policy bug class that broke GM
live-peek before migration `0006` does not recur anywhere, including the newest table
(`combat_encounters`) — no Supabase/Postgres findings needed a schema change. Real findings across
the other five skills got triaged into three columns (safe to just do / worth a small PR / needs a
product decision), and the repo owner asked for all of them:

- **Safe / small-PR items**, five separate PRs: the `--ink-80` typo plus a new `--gold-fade` token
  and `--tap-min` sweep (PR #62); batching the campaign bootstrap route's 8 independent reads (PR
  #63); caching `useGlossaryMatcher`'s built matcher at module level (PR #64); giving
  `CharacterSheetPage`/`CampaignPage`/`AdminPanelPage` a real `<h1>` (PR #65); associating
  unassociated form labels app-wide (PR #66).
- **The four "needs a decision" items**, resolved one at a time: the modal accessibility overhaul
  (`useModalA11y.ts`, all 12 modals, PR #67); the `auth.users` FK delete-behavior policy — asked
  the repo owner directly rather than guessing, since a wrong default (a silent cascade) could
  destroy other players' data; they chose to keep the status quo (`RESTRICT`), recorded as
  `README.md` judgment-call item 21 (PR #68, no schema change); confirm-before-destroy for
  revoking an invite/removing a Combat participant/deleting a Status/dropping a Quest (PR #69);
  route-level code splitting for `/admin` and `/combat` (PR #70, main bundle 674 kB → 613 kB); and
  the `ParticipantCard` boolean-prop-to-explicit-variant split (PR #71), the most invasive of the
  four — planned and reported to the repo owner before implementing.

All ten PRs from this session (`#60`, `#62`–`#71`) merged to `main` clean. Verification ran the
same way for every code-touching PR: `npm run typecheck`, the full 168-test suite, and — for
anything touching layout or DOM structure — `CHROMIUM_PATH=/opt/pw-browsers/chromium npm run
test:responsive -w @asohav/web`, all clean before each merge. One process note for a future
session: this sandbox's responsive smoke test run takes noticeably longer than the "under a
minute" the `responsive-device-qa` skill describes (closer to 8–10 minutes some runs), and
switching git branches while one is still running corrupts the result (the dev server it spins up
serves from whatever's currently checked out) — wait for a run to fully finish before touching
branches again, don't assume a quick early pass of clean output means the whole run will be. Bumped
all four `package.json`s to `0.19.0` and added the `CHANGELOG.md` entry after the fact, since none
of the ten PRs did so individually — worth doing that as part of the PR itself next time a session
ships a version-worthy change, rather than batching it into a separate docs pass afterward.

**Twenty-fourth session (`0.18.1`)**: small, direct request — the sheet's ad-hoc "New status
name…" quick-add row (`StatusesPanel.tsx`) only ever created a new Status at a hardcoded Rank 1,
so setting a real Rank meant creating the Status first, then tapping its pips afterward. Added a
bounded Rank number input to that row so it's set in the same step as the name, same pattern the
"Give a Status…" modal already used. No engine/type changes — pure UI, `giveStatus()`/
`applyOpposingStatus()` untouched. See `CHANGELOG.md` 0.18.1. Shipped as PR #51, merged same
session; `npm run typecheck`, the full unit suite (168 tests), and the responsive smoke test
(`CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:responsive -w @asohav/web`, all
routes/viewports clean) all ran clean before merge.

**Twenty-third session (`0.18.0`)**: the repo owner asked to build all of the previous session's
"Track B" list. Before writing code, re-read the actual source text closely (`TheMoves.md`'s Level
Up/Progress the Party/Undertake a Journey/Enjoy Downtime sections) and surfaced five genuine
ambiguities the earlier audit's paraphrase had smoothed over; got explicit direction from the repo
owner on each before building anything:

1. The Level Up/Progress the Party Tier-unlock formula (a real internal contradiction, not just a
   missing field) — **deferred**, see Open issue 12.
2. Wealth/Treasure — **implement as per-character resources**, earn mechanism decided later.
3. "Kith" vs "Kin" in Make Camp's gate condition — **consolidate under Kin** (turned out to need no
   code change at all; the app never used "Kith").
4. Advantage/Disadvantage — **informational only**, no dice simulation.
5. Undertake a Journey / Enjoy Downtime's guided-UI question — **deferred**, see Open issue 12.

Everything else got built straight from the doc text: `CharacterSheet.Wealth`/`Treasure`/`Hold`
(new fields, `normalizeSheet()` extended, unit tested), `MakeCampModal.tsx` (the missing "clear 1d6
Conditions" step), `EndSessionModal.tsx` (the branching Rapport formula plus the full per-player
hold/spend subsystem — refresh Gear, clear a Condition, mark Kin via the existing `MarkKinModal`/
Bond-propose flow, mark Potential), `AdvantageToggle.tsx` (a shared informational component wired
into both roll-breakdown render sites), and six new seeded Moves (Strike a Nerve, Recall a
Flashback, Recuperate, Level Up, Progress the Party, Forge a Bond — the last three's text
deliberately omits the deferred Tier-unlock formula). See `CHANGELOG.md` 0.18.0 for the full
technical writeup and `CLAUDE.md`'s new "Wealth, Treasure, Advantage, and End the Session" section
for the complete reasoning behind every judgment call. No new migration — all JSONB-field
additions. The live `library` singleton was updated directly (via the Supabase MCP tool) to append
the six new Moves to its existing `moves` array, so a live GM can reference them without a full
reseed — verified via `jsonb_array_length` (13 → 19) and the six new IDs present. Not done this
session: live browser QA (same standing sandbox-network limitation as every prior session, see
Open issue 5).

**Twenty-second session (`0.17.0`)**: the repo owner asked for a full once-over of the codebase,
rules docs, and database schema now that the game engine and Combat have shipped, to confirm
earlier decisions still hold. Broke the audit into four parts — rules-vs-implementation, live
Supabase state, a re-check of README's 17 judgment calls, and repo hygiene — then split the
findings into "Track A" (concrete, unambiguous fixes, approved and shipped this session) and
"Track B" (real content/mechanic gaps needing the repo owner's choice, not guessed at — see Open
issue 12 below). Track A, all confirmed with the repo owner before landing:

- The live `library` singleton had drifted stale across four versions (`0.9.0`'s `glossary`,
  `0.14.0`'s `enemies`, and several `0.13.0`/`0.14.0` `GameSettings` fields were all missing) —
  silently breaking real gameplay math rather than crashing (0 Recoveries on new characters, an
  unenforced Skill-count cap, Advancement Tiers frozen at 1 forever), which is why nobody had
  noticed. Fixed with `normalizeLibrary()` (closing a gap CLAUDE.md already documented as the
  general rule for JSONB-blob types but had only ever applied to `CharacterSheet`) plus a direct
  reseed of the live `library` row and a backfill of the four live `character_sheets` rows still
  missing `Recoveries`/`Scars` from the `0.16.1` fix (nobody had loaded them live yet to trigger
  its self-heal).
- Enforced the Bond Kin-lock at Level 5 (`Advancements.md`), which had never been implemented.
- Fixed a self-contradiction in the seeded `Martyr` Skill/Ability pair (they named different
  trigger conditions for the same doc line).
- Built out `Dishonored`'s Combat effect (Vulnerable 4) for real, replacing a "once it's built"
  placeholder that had sat unfulfilled in the seeded glossary text since Combat shipped in
  `0.14.0` — deliberately scoped to the one place Combat currently marks a Condition (a Gambit's
  cost); see `CLAUDE.md`'s Combat section and `README.md#architecture-notes--judgment-calls` item
  19 for why that scoping is flagged as revisitable rather than settled.

See `CHANGELOG.md` 0.17.0 for the full technical writeup. No new migration. Repo hygiene turned up
nothing new actionable — Open issues 3/4/7 below are all still exactly where earlier sessions left
them (still needs an account admin or full push access this session doesn't have).

**Twenty-first session (`0.16.1`)**: the repo owner reported the live app crashing when opening an
existing character sheet — this turned out to be exactly the risk flagged (but not yet confirmed)
by the twentieth session's HANDOFF item 11 below: `0.13.0` added `Recoveries`/`Scars` to
`CharacterSheet` with no backfill, so any sheet saved before that version is missing both keys
entirely, and `StatusesPanel.tsx`'s unguarded `sheet.Scars.length` threw on first render for every
such sheet. Fixed with a new `normalizeSheet()` (`packages/shared/src/logic.ts`, unit tested)
called from `apps/server/src/repo.ts`'s `getSheet()` on every read — same self-heal-on-read pattern
already used for a missing `Party` row (Open issue 1 below) — which also persists the backfilled
shape back to the row so each affected sheet is repaired once, permanently. Client-side reads of
both fields also got defensive `?? 0`/`?? []` guards. See `CHANGELOG.md` 0.16.1 for the full
writeup. No migration — this is a JSONB-field default, not a schema change.

**Earlier sessions (`0.4.1` → `0.12.1`), condensed** — this span moved from a static-prototype
port to a working campaign-management app, before the game-engine/Combat work below started. Full
technical detail for each version is in `CHANGELOG.md`; only what still has live relevance today
is called out here:

- **`0.4.1`**: added `CLAUDE.md` — no other changes, doc-only.
- **`0.4.2`**: CSS cleanup — consolidated hardcoded ink-opacity `rgba()`s into `--ink-*` tokens,
  fixed `AboutModal`'s padding inconsistency, extracted `buttons.module.css` and
  `adminShared.module.css`'s `.backLink`. Deliberately left the "eyebrow" label pattern, the ghost
  button, and the card wrapper unmerged as real per-context variation, not copy-paste drift — see
  `CHANGELOG.md` 0.4.2 before re-litigating that call.
- **`0.5.0`**: first UX-feedback round — Virtue/Theme locked to Advancements, unilateral Spend
  Kin, collapsible Load, `ConfirmModal` on destructive sheet buttons, Bond accept/reject from the
  sheet, a Moves Virtue filter, Condition checkboxes, new tooltips, Create Campaign, the Admin nav
  reorg into Core/Narrative/Advancements/Tools.
- **`0.5.1`**: fixed GM live-peek missing Condition updates — `character_sheets`' RLS policy was
  the one Realtime-subscribed policy still doing an inline join (migration `0006`; see `CLAUDE.md`'s
  Realtime section for the general joinless-policy rule this established, still the rule to follow).
- **`0.6.0`**: classified Kin as a real Advancement track; Content Admin's nav gained a Kin entry.
- **`0.7.0`**: the invite-accept join flow, in-app character creation, the "Seelie" seed campaign;
  `vitest` added to the monorepo for the first time.
- **`0.8.0`**: admin user-account management, admin-only campaign/character deletion.
- **`0.9.0`**: the Glossary feature — tap-to-reveal term definitions, auto-linked into authored text.
- **`0.10.0`**: a pending-Bond-confirmation badge; player-authored Mark Kin reasons (`MarkKinModal`).
- **`0.10.1`**: closed a Glossary-wiring gap in `CampaignBonds.tsx` that `0.10.0`'s freeform Kin
  notes exposed.
- **`0.11.0`**: campaign archive/freeze (`Campaign.Status`, migration `0008`).
- **`0.12.0`**: campaign-setup phases (Signup → Party Creation → Playing) and a fuller
  character-creation flow.
- **`0.12.1`**: fixed a live crash loop — `0.12.0`'s migration `0009` reached Render before it was
  applied to the live database, and this app's then-Express-4 routes had no async-error handling,
  so every failed query crashed the whole process instead of returning a 500. Fixed both layers:
  applied the migration, and added `apps/server/src/asyncHandler.ts`'s `wrap()` to all route
  handlers — **still the pattern every route handler uses today**, wrap any new one the same way.
  Also added a client-side request timeout and the `Toast` error-banner component
  (`apps/web/src/components/Toast.tsx`), both still in use.

A handful of same-span sessions did live-ops-only work (no code, Supabase MCP tool only): applying
migrations `0007`/`0008` once they were committed but unrun, and repairing a live seed-data gap
(the "Seelie" campaign hadn't actually been inserted). Folded into the summary above since the net
effect — those migrations are applied, that data is present — is what's still true today; the
session-by-session path to get there isn't.

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
  which isn't subject to that restriction — see the thirteenth-session, twenty-second-session, and
  twenty-third-session notes above.
- **Version:** `0.24.1` (all four `package.json` files, synchronized — see CHANGELOG.md; the
  lockfile lagged at `0.24.0` until the thirty-second session synced it). `0.24.0` was landed by
  the thirtieth session executing `WorkPlan-0.24.0.md` in full, `0.24.1` by the thirty-first
  session's review-and-fix pass. Not
  git-tagged — see item 3 above (still true; no session since has gained any more push access than
  earlier ones). `0.14.0` added a real migration (`0010_combat_encounters.sql`, a new table),
  applied live in the eighteenth session; `0.15.0` through `0.24.0` needed no new migration — the
  twenty-fifth session's audit-fix pass, the twenty-sixth session's UI rounds, the twenty-eighth
  session's `0.23.0` work, and this session's `0.24.0` work were all application code, config, and
  docs. `GameSettings.GlossaryAutoLink` (new this session) is a JSONB field with a
  `normalizeLibrary()` read-time default, same self-heal-on-read pattern as every prior addition —
  the live `library` singleton doesn't strictly need a manual reseed for it, but worth checking
  next time someone has Supabase MCP access, same standing caveat as every other `GameSettings`
  field added since the `0.17.0` audit found the live singleton stale by four versions (see that
  session's note below).
- **Database:** live Supabase project (`ihrtdbknhpgysgwaqnfj`), **all 10 migrations applied**, and
  as of the twenty-second session's audit, **the live `library` singleton is finally current** —
  it was found stale by four versions (missing `0.9.0`'s `glossary`, `0.14.0`'s `enemies`, and
  several `0.13.0`/`0.14.0` `GameSettings` fields) and was directly reseeded to match
  `seedLibrary()`'s current output, plus `normalizeLibrary()` now self-heals this on every read
  going forward regardless. The four live `character_sheets` rows were also confirmed/backfilled to
  have `Recoveries`/`Scars` (the `0.16.1` fix's self-heal-on-read had never actually been exercised
  live since nobody had loaded them). Security advisor otherwise clean (one pre-existing `WARN`,
  leaked password protection, unrelated to any of this app's migrations; one expected `INFO`
  "unused index" note for the `combat_encounters` table). The "Seelie" campaign and
  mike@asohav.dev's pending invite (seventh session's seed data) are still present live — see the
  thirteenth-session note above for why they weren't already and what was inserted.
- CI (`.github/workflows/ci.yml`) has four jobs: `build`, `typecheck`, `test` (`vitest`), and
  `responsive` (`apps/web/scripts/responsive-smoke.mjs`, driven by `apps/web/harness.html`). Green
  on `main` as of this writing — the twenty-eighth session's seven PRs all merged with green CI,
  verified per PR rather than assumed — but **`main` still has no branch protection requiring any
  of them to pass before merge** — see item 7 below, still unresolved. That gap is exactly how a
  red `responsive` job merged to `main` once already in an earlier session (fixed immediately
  after, in a follow-up PR); seven more merges against an unprotected branch this session is seven
  more chances for that to recur, even though it didn't this time.

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

### 3. No version has ever been git-tagged — no session has had the push access for it

Per the versioning policy in `CHANGELOG.md` ("tag the merge commit `vX.Y.Z`"), every version since
`0.3.0` should have an annotated tag on its merge commit. None do. Every session that's tried
(originally at `0.3.0`; again at `0.5.0`; again with all 21 then-missing tags batched together at
the twenty-second session, `0.17.0`) has hit an identical `403` — the git credentials available
inside a Claude Code session here are scoped to pushing branches, not arbitrary refs like tags.
The constraint hasn't changed across any of those attempts, so there's no reason for a future
session to re-attempt it; this needs someone with real repo push access, once, for all of them:

```bash
git fetch origin main
# find each version's merge commit — CHANGELOG.md's timestamps + the PR list — then:
git tag -a vX.Y.Z <merge-commit-sha> -m "vX.Y.Z"
git push origin vX.Y.Z   # repeat per version, or batch multiple tags onto one push
```

**Mapping a version to its merge commit gets genuinely ambiguous past `~0.5.0`** — several early
versions were renumbered mid-flight when two draft branches' PRs landed out of order, so a naive
"first commit with this `package.json` version" walk can land on the wrong side of a rename.
Whoever does this should re-derive each merge commit carefully from the PR list and CHANGELOG
timestamps rather than trust a mechanically-generated table — a tag on the wrong commit is worse
than no tag at all.

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

### 6. RESOLVED: the Render MCP connector works now

Confirmed working in the twenty-seventh session, the first time any session has reached it. It
authenticates and returns the account's workspaces; the only step it won't take on its own is
picking one, which is deliberate (acting on the wrong workspace could touch unintended resources).
The repo owner confirmed **"My Workspace"** (`tea-d9hs81ernols73aknf00`,
mikekane848@gmail.com) — the account has exactly one.

Render deploy status, logs, metrics, and env-var changes are therefore available to a session here
for the first time. `render.yaml` should stay regardless — it's the actual source of truth Render
reads, and the Blueprint flow isn't replaced by the connector, just supplemented by it.

Original problem, for history: the repo owner hit a "failed to connect MCP" error, and a later
attempt showed it installed at the account level but not enabled for the chat. Deployment was done
manually instead — writing `render.yaml` as a Blueprint and pasting env vars into Render's dashboard
by hand.

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

### 9. PARKED: Datasworn (Ironsworn/Starforged JSON Schema) as a possible reference

Not an action item — a reading pointer raised once during a styling-strategy conversation, never
revisited since. [Datasworn](https://github.com/rsek/datasworn) models PbtA-lineage content
(Moves/Assets/Oracles) as an interchange format built to accommodate homebrew — ASoHaV's `Moves`
with `Tier3`/`Tier2`/`Tier1` results maps onto its move-outcome structure fairly directly
(`packages/shared/src/schema.ts`, `seedLibrary.ts`). Worth a look only if community tools or
homebrew content ever land on the roadmap — not a recommendation to adopt it, since ASoHaV's
schema is original and already reconciled from the design handoff.

### 10. DORMANT: reported inconsistent on-click behavior on Statuses — investigated twice, never reproduced, no reports since `0.5.1`

The repo owner reported clicks/taps on the character sheet — Statuses specifically — not always
registering on the first interaction. Two candidates were investigated in the `0.5.1` session and
neither panned out: the GM-view symptom turned out to be the separate, now-fixed joined-RLS-policy
Realtime bug (item 3's neighbor above — see `CHANGELOG.md` 0.5.1), not this; and a Playwright
script driving real touch `tap()` events against the flagged scenarios (a Condition toggle, a
Status rename-input racing a sibling Pip click) produced no double-fire or missed-tap in any case.
Doesn't rule out a device-specific quirk Playwright's touch emulation can't reproduce (real iOS
Safari being the likeliest gap) — just that it isn't a straightforward bug in the click-handling
code. No further reports from the repo owner since. Needs a fresh, specific repro (which control,
which device/browser, single vs. double tap) before another session can act on it.

### 11. The entire game engine and Combat system have never run in a real browser

**Update, `0.16.1`**: this risk was confirmed, not just theoretical — see the twenty-first
session's note above. Any character sheet saved before `0.13.0` crashed on load until that fix
shipped; the two bullets below (Combat's live Realtime sync, and whether the live `library`
singleton was re-seeded) are still open and unconfirmed.

Flagging this with more weight than the standing sandbox-network note (item 5) because of how much
new, genuinely interactive logic landed across the sixteenth–twentieth sessions with zero live
QA: the roll-breakdown engine, the full Status/Condition/Subdued flow, and — the biggest surface —
the entire Combat Encounter view (start/end, five Combat/Reaction Moves, Gambits, enemy stat
blocks, `PendingStatusOffer` redirection for Interpose). All of this is covered by unit tests
(pure functions in `packages/shared`) and the responsive smoke test (layout/touch-targets only,
against static seed fixtures) — neither exercises real multi-step user flows: opening a modal,
picking a target, applying a Gambit, watching another browser tab see the Realtime update. Two
concrete things worth a deliberate pass once someone has real browser access:

- Click through a full Combat Encounter end-to-end (start → add participants → Engage with
  Gambits → an Enemy's attack → the target applying a `PendingStatusOffer`, optionally resisted →
  Interpose → end) as both a GM and a player, ideally two browser sessions at once to verify
  Realtime sync actually delivers `combat_encounters` changes the way `useLiveCampaign.ts` assumes.
- ~~Confirm the live `library` singleton has actually been re-seeded/re-imported to pick up
  `0.13.0`'s new `GameSettings` fields and `0.14.0`'s `library.enemies`~~ **Done, twenty-second
  session (`0.17.0`)** — it hadn't been, and was silently breaking gameplay math rather than just
  missing Enemies content (see that session's note above and Open issue 12 below). Reseeded
  directly, plus `normalizeLibrary()` now self-heals this going forward. (Independently
  re-confirmed live via the Supabase MCP tool on 2026-08-11: `enemies`, `settings`, and `glossary`
  are all still current — no drift since that reseed.)

### 12. Rules/content gaps a full audit found — mostly built in the twenty-third session, two pieces still deferred

The twenty-second session (`0.17.0`) cross-referenced `Planning Docs/*.md` (TheMoves.md,
TheGear.md, TheSkills.md, Advancements.md, etc.) against `packages/shared` line by line looking for
drift now that the game engine and Combat have both fully shipped. Track A (small, unambiguous
fixes) landed in that session — see its note above and `CHANGELOG.md` 0.17.0. Everything below was
"Track B" — real content/mechanic gaps, deliberately not guessed at in that session. The
twenty-third session (`0.18.0`, see below) scoped five decisions with the repo owner up front and
then built everything except the two items still marked open at the bottom:

- ~~Seven named Moves in `TheMoves.md` have no `seedLibrary.ts` entry at all~~ **Done, `0.18.0`**:
  Strike a Nerve, Recall a Flashback, Recuperate, Level Up, Progress the Party, and Forge a Bond
  are now seeded. Undertake a Journey and Enjoy Downtime are still un-seeded — see the open item
  below.
- ~~Character Level and Party Level don't exist as fields anywhere~~ **Deliberately still not
  built** — see the open item below; this turned out to be inseparable from the Tier-unlock formula
  question, not just a missing field.
- **`Advancements.md`'s Potential-tier contradiction (2-tier vs. 4-tier) is still open** — not
  resolved by the `0.18.0` session; it compounds with the Level/Tier-unlock formula question below
  rather than being independent of it.
- ~~Wealth and Treasure are named spendable resources with zero representation in the data
  model~~ **Done, `0.18.0`**: `CharacterSheet.Wealth`/`Treasure`, per-character, freely
  player/GM-adjusted (no earn mechanic yet — confirmed with the repo owner as an explicit "decide
  later" rather than an oversight).
- ~~Advantage/Disadvantage rolls are referenced three times in the doc... but the engine has no
  concept of them~~ **Done, `0.18.0`**, informational-only per the repo owner's explicit call —
  `AdvantageToggle.tsx`.
- ~~Make Camp is missing its "clear 1D6 Conditions" component~~ **Done, `0.18.0`** —
  `MakeCampModal.tsx`.
- ~~End the Session is missing its branching Rapport formula... and its entire per-player
  hold/spend subsystem~~ **Done, `0.18.0`** — `EndSessionModal.tsx`.

**Still open, deliberately deferred (not guessed at) — see `CLAUDE.md`'s "Wealth, Treasure,
Advantage, and End the Session" section for the full reasoning:**

- **The Level Up/Progress the Party Tier-unlock formula.** "4 Tier-1 advancements *and* Level 5"
  can't be made internally consistent if Level is just the count of Advancement picks taken (the
  only reading the rest of the doc supports) — a 4th pick is Level 4, and a 5th pick (still Tier 1,
  since Tier 2 isn't unlocked yet) is 5 Tier-1 picks, not 4. No `Level`/`PartyLevel` field exists;
  `unlockedTier()` still gates purely on count, unchanged since `0.13.0`.
- **Undertake a Journey and Enjoy Downtime** — both full multi-step flows (Scout Ahead → Venture
  Forth with GM-chosen complication lists; five distinct Downtime activities). Whether either needs
  guided UI beyond a generic library Move-text entry wasn't decided before this pass.

Two smaller, lower-confidence notes from the same pass, included for completeness rather than as
action items: `TheMoves.md` calls the middle Load tier "Medium" once, while `TheGear.md` and all of
the code call it "Normal" (looks like a doc-internal typo, not a code defect — the code correctly
follows the more authoritative, dedicated Load doc). And worth noting `TheMoves.md`'s own prose is
visibly an unfinished draft in places — bracketed author notes (e.g. a "[Mike Note: ...]"
reconsidering the Keep Watch mechanic) and undefined terms ("Kith" where "Kin" is presumably meant,
"Villain or Lieutenant (define those…)") — so not everything above necessarily deserves faithful
implementation as written; some of it may be exactly what the repo owner meant to flag as
still-in-flux when the doc was written.

### 13. RESOLVED (surfacing only): starting Combat grants the party +1 Rapport — now visible, rule itself still unconfirmed

Found during the twenty-seventh session's planning research: `CombatPage.tsx:58` bumped
`Party.Rapport` by 1 when the GM started an Encounter, with nothing anywhere in the UI saying so and
no note in `CHANGELOG.md`/`README.md` explaining where the rule came from. It had been there since
Combat shipped in `0.14.0`.

The repo owner confirmed it was **not** a deliberate, documented rule, but chose to keep the bump and
make it visible rather than remove a mechanic that might be real — "make a note to come back to this
later for confirmation, but this is a good enough fix for now." The twenty-eighth session's PR #85
did exactly that: the bump moved server-side into `POST /combat/start` (lands atomically with the
Encounter instead of as a separate client-side write), logs one `Encounter.History` entry, and a new
`useAnnounceCombatStart()` hook raises a client-side Toast the first time a client observes the new
Encounter via the existing `combat_encounters` Realtime subscription.

**Still to resolve — unchanged by the above, and not attempted this session:** whether the Combat
Basics V2.2 draft in `Planning Docs/` actually calls for Rapport on Combat start, and if so under
what conditions. Check the doc before either keeping it permanently or removing it — this is the
same class of "shipped code and rules doc were never cross-checked" gap the `0.17.0` audit found
several of.

### 14. TODO: a full Advancement track silently swallows every further mark

Recorded at the repo owner's request in the twenty-ninth session ("we don't currently handle the
situation where we try to add to something that's already capped"). Confirmed against the code, not
assumed: every path that marks Potential, Rapport, or Kin clamps with `Math.min()` and drops the
excess with no record, no carry-over, and nothing shown to the player.

| Site | Code |
| --- | --- |
| `apps/web/src/features/sheet/EndSessionModal.tsx:59` | `Math.min(RapportTrackLength, d.Rapport + n)` |
| `apps/web/src/features/sheet/EndSessionModal.tsx:94` | `Math.min(PotentialTrackLength, d.Advancement.Potential + 1)` |
| `apps/server/src/routes/combat.ts:52` | `Math.min(5, party.Rapport + 1)` |
| `packages/shared/src/logic.ts:179` | `Math.min(5, bond.KinTrack + Delta)` on an accepted Mark Kin |

The UI can't even express the situation. `Pips` treats a tap on the currently-filled pip as *drop to
n−1* (`Pips.tsx:39`), so there's no gesture for "I earned another Potential while my track was
already full." And `AdvancementPicker`'s "Not yet — keep the track full" dismissal
(`AdvancementPicker.tsx:248`) deliberately leaves the track at max, which makes every subsequent
mark a silent loss until the player takes the Advancement.

**The rule question to settle before building anything:** does a mark on a full track **carry over**
after the Advancement is taken, **queue** a second Advancement, or is it **lost by rule**? Note the
Bond Kin-lock (`isBondLocked()`, `0.17.0`) is a close cousin that *does* have defined behavior, so
there may well be an answer in `Advancements.md` — check the doc before guessing.

Two smaller findings worth fixing in the same pass: three of the four sites above hardcode `5`
instead of reading `GameSettings.RapportTrackLength` / `KinTrackLength`, and
`AdvancementPanel.tsx:82`/`:113` hardcode `count={5}` rather than the configured track length — so
raising a track length in Content Admin today would only half-work.

### 15. TODO: the advancement-options workflow kickoff

Also recorded at the repo owner's request in the twenty-ninth session, confirmed as covering **both**
halves below:

1. **The deferred Level / Tier-unlock formula** — this is open issue 12's still-open bullet,
   unchanged since `0.18.0`: "4 Tier-1 advancements *and* Level 5" can't both hold if Level is the
   count of picks taken; no `Level`/`PartyLevel` field exists; `unlockedTier()` still gates purely on
   count. Compounds with `Advancements.md`'s separate 2-tier-vs-4-tier contradiction.
2. **A guided flow when a track fills** — today `AdvancementPicker` appears the instant a track hits
   5, triggered by a pip tap (`AdvancementPanel.tsx:87`, `:118`) or from `EndSessionModal`. A modal
   materializing under the player's finger mid-tap is the wrong kickoff for what is a significant
   character moment; this wants a real announce → consider → choose → confirm flow.

## Everything else

- What's deliberately *not* built (dice rolling — a permanent decision, not a gap — Hero Moves, a
  Combat grid, Bond-proposal expiry, etc.) is listed in
  [README.md#whats-not-built](README.md#whats-not-built), kept current as of `0.16.0`.
- Design decisions and judgment calls (why Realtime instead of WebSockets, why no
  character-creation flow, etc.) are in
  [README.md#architecture-notes--judgment-calls](README.md#architecture-notes--judgment-calls).
- Full version-by-version history: [CHANGELOG.md](CHANGELOG.md).
