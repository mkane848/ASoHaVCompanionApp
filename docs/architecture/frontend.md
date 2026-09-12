# Frontend conventions

The largest single body of convention in this project: server state, the type and spacing scales, touch targets, `.action-grid`, container queries, modals and shared components.

_Part of `docs/architecture/`. Index: [`docs/architecture/README.md`](README.md). The invariants a session must not violate stay in `CLAUDE.md`; this file is the detail behind them._

---

## Frontend conventions

- **Server state only in TanStack Query.** No Redux/Context-based server-state store. Hooks in
  `apps/web/src/lib/` (`useBootstrap`, `useLibrary`, `useMe`) wrap `useQuery`; `lib/mutations.ts`
  wraps `useMutation`. `useLiveCampaign` invalidates query keys on Realtime events rather than
  patching cache data directly — treat Realtime as a signal to refetch, not a data source.
- **There is a type scale and a spacing scale, as of `0.40.0` — use them.** `tokens.css` defines
  `--fs-label` (11px) / `--fs-meta` (12) / `--fs-body` (13) / `--fs-lead` (15) / `--fs-title` (18)
  / `--fs-display` (23), plus `--fs-input` (16, see below), `--track-label`/`--track-tight`, and
  `--sp-1`…`--sp-6` (4/8/12/16/20/28). Before this the app had colour and font-family tokens and
  nothing dimensional, and the sheet feature alone had drifted to **19 distinct px font sizes**, a
  third of them half-pixel, with 11 letter-spacing values across ~44 uppercase micro-labels. Size
  was the one axis `theme-tokens` had nothing to enforce — which is why that skill now covers it
  too. A new literal px font-size or gap in a `.module.css` should be a deliberate, commented
  exception, not the default.
  **The scale is universal as of `0.41.0` — there are zero literal px font-sizes left in any
  `.module.css` under `apps/web/src`.** `0.40.0` adopted it in four panels and this file then
  claimed "~140 literal font-sizes" remained in "the ~19 sheet files it didn't touch"; both halves
  were wrong. The real figure was **405 declarations across 67 files**, and the four panels
  `0.40.0` called converted were only partly converted (`StatusesPanel` still had 19 literals,
  `MotifPanel` 7, `PartyPlaybookPanel` 6) — `tokens.css`'s own "19 distinct px font sizes in the
  sheet feature" comment, written to describe the *pre*-`0.40.0` state, was still an accurate
  description of the state after it. `0.41.0` swept all of them, and 119 `letter-spacing` literals
  with them.
  Per an explicit repo-owner decision, the large display sizes map onto the existing six steps
  rather than extending the scale, so this was not a no-op repaint: `VirtuesPanel`'s Virtue score
  went 26px → 23px, `LoadPanel`'s carried value 22px → 18px, and 17/19/20/21px collapsed to 18px.
  **Three declarations are deliberately still literals**, each load-bearing for a measured budget
  documented in its own file: `AppShell`'s appearance-picker tracking (the app bar needs 357px of a
  360px viewport — 3px of headroom), `MotifPanel`'s `.tagHint` tracking reset, and the two
  lowercase-prose classes where a label tracking would be wrong. Hit-area arithmetic derived from
  `--tap-min`, and container-query thresholds themselves, also stay literal — both are measured
  properties of real content, not scale steps.
- **A repeated text role lives in `apps/web/src/styles/typography.module.css`**, composed in
  (`composes: label from '../../styles/typography.module.css'`), not restated per panel: `.label`
  (uppercase micro-label), `.sectionLabel` (the same at section scope, `--gold-dark`), `.hint`,
  `.leadText`. Same rule as the shared `modal.module.css`/`buttons.module.css` — only extract where
  every consumer's properties match exactly.
- **Short player-authored text is tap-to-edit, never a permanently-live input** — `InlineEdit`
  (`apps/web/src/components/`), and `TagList` for a list of them. This is not only a visual
  preference: the responsive smoke test requires every `button, a, input, select, textarea` to hold
  its own 44×44 non-overlapping hit area on a touch viewport, so a chip built as "live input + its
  own remove button" carries two 44px floors and can never be narrower than ~100px. One control per
  value instead of two is what lets tags flow several to a row and what made a one-line Status row
  possible at 360px. Note the floor doesn't go away — a read-only pill is still a `<button>` — the
  saving is in the *count*. `TagList` also puts its "+ Add" inside the wrap flow; every
  implementation it replaced put it on a row of its own, which is why three Looks used to occupy
  four rows.
- **Any text control the user types into must be at least 16px (`--fs-input`) on a coarse
  pointer.** iOS Safari zooms the entire page when a focused input is under 16px, and the only way
  to suppress that is to disable pinch-zoom, which is a real accessibility regression. The rule is
  global in `layout.css`'s `utilities` layer (not `base.css`) precisely so it outranks a
  component's own `font-size`, and scoped to `(pointer: coarse)` like every other growth rule
  there.
  **This rule is not new and was never broken — read the next sentence before "fixing" it again.**
  It has been in `layout.css` since PR #68. `0.40.0` shipped a *second* copy of it higher up the
  same file and described it in the CHANGELOG, that release's PR, and this bullet as a
  newly-discovered iOS bug it had just fixed; it was not, and tapping a sheet field was not
  actually zooming anything. `0.41.0` removed the duplicate and folded its only two real
  contributions (the `--fs-input` token in place of a hardcoded `16px`, and excluding
  checkbox/radio/range/color) into the original. The lesson is the one this app keeps relearning:
  grep for a rule before concluding it doesn't exist — `0.34.0` nearly rebuilt Make Camp's
  already-shipped resource reset the same way.
- **An `auto-fit` grid of content (as opposed to peer buttons) needs both bounds thought about.**
  `minmax(min(FLOOR, 100%), CAP)`: the `min(…, 100%)` matters because a bare `minmax()` floor is a
  floor the *track* cannot go below, so a 290px floor in a 274px panel overflows (a real latent bug
  `.statusGroups` shipped from `0.39.0` until `0.40.0`); and the CAP matters on full-width panels,
  because at 2560px `.sheet-stack` gives a band 1514px and an uncapped `1fr` hands back six
  absurdly wide columns — worse than the single column it replaced. `.action-grid`'s peer buttons
  are the exception that genuinely wants `1fr`.
- **CSS Modules everywhere**, one `.module.css` per component (the whole UI was migrated off
  inline styles for this — see `CHANGELOG.md` 0.4.0). Design tokens (`apps/web/src/styles/tokens.css`)
  are CSS custom properties ported verbatim from the design handoff — reuse them (`--ink`,
  `--gold`, `--panel`, etc.) rather than hardcoding colors/fonts; if a value repeats and none of
  the existing tokens match, add one rather than writing another literal (`CHANGELOG.md` 0.4.2 did
  a pass consolidating these — read its entry before adding a new `--ink-*` stop, in case one
  already covers it). CSS that's genuinely byte-identical across components lives in a shared
  stylesheet and gets pulled in via CSS Modules `composes: ... from` rather than redefined per
  component — `apps/web/src/styles/modal.module.css` (modal shell) and
  `apps/web/src/styles/buttons.module.css` (the primary-button treatment) are the two so far. Only
  extract a class this way when every consumer's properties match exactly; near-duplicates that
  differ in size/color/spacing are usually real per-context variation, not copy-paste drift —
  forcing them into one class is a design decision (a type scale, a button-variant system), not a
  mechanical dedup. See `CHANGELOG.md` 0.4.2 for what was judged safe to unify and what wasn't.
- **44×44px minimum touch targets**, deliberate 768px/1024px breakpoints (not accidental ones
  from flex-wrap arithmetic) — both are enforced by the responsive smoke test, so a regression
  fails CI rather than getting noticed visually.
- **A row of peer actions of equal weight uses `.action-grid` (`layout.css`, `0.25.0`), not
  `flex-wrap`.** `flex-wrap: wrap` on content-sized buttons isn't a layout, it's an overflow
  fallback — each button is exactly as wide as its own label, so a row breaks wherever labels
  happen to run out of room, `justify-content`'s `flex-start` default leaves every wrapped row
  ragged-right, and leftover space collects at the right edge of the last line rather than being
  distributed. `.action-grid` is `display: grid; grid-template-columns: repeat(auto-fit,
  minmax(var(--action-min, 150px), 1fr))` — every child gets an equal share, the column count
  falls out of the available width, and `--action-min` is set per call site (a row of two long
  labels wants a higher floor than four short ones). Used for the sheet footer row, Statuses'
  Wealth/Treasure/Recoveries and Give/Heal Status rows, Bond actions (`AdvancementPanel`,
  `CampaignBonds`, `EndSessionModal`), and Combat's round-action row. **`auto-fit` over a container
  query on purpose**: a container query still needs someone to derive the right px threshold from
  the widest label plus gaps plus padding (see `StatusesPanel.module.css`'s 1024px comment for how
  much arithmetic that takes and how often it's been re-derived) — `auto-fit` computes the right
  column count from the real content every time, with nothing to get wrong. Container queries stay
  the right tool for *rearranging* a layout (Abilities & Skills going two-column, Load splitting
  tiers from items); `auto-fit` is the right tool for *distributing peers*. **Does not apply to**:
  mixed rows (a flexible text input beside a button — Home's create-campaign row, Statuses' quick-add
  row, Combat's initiative input — these keep the `display: contents` regroup technique from
  `0.18.3`'s `.addRow` instead, since the input should take the slack, not share an equal-width
  cell), chip/tag rows where ragged is genuinely correct (`CampaignTile` roster names, `MovesDrawer`
  filter chips, `ThemePanel`'s available-quest chips — these stay `flex-wrap` for their own layout;
  `ThemePanel`'s chips separately gained `.board`/`.posting` in `0.26.0`, an unrelated appearance-
  system decoration layered on top, not a `flex-wrap`-vs-`.action-grid` call — see "Architecture:
  appearances" in `docs/architecture/appearances.md`), and multi-pip rows (`Pips` has
  its own hit-area tiling math from the bullet below — don't put one in an `.action-grid` cell
  without redoing that arithmetic). A lone trailing item on the last row is deliberately left as an
  empty half-cell rather than stretched to fill it: there's no CSS-only way to detect "alone on the
  last row" once the column count itself varies with `auto-fit`, and a trailing empty cell reads as
  grid rhythm, not raggedness — an explicit `.span-all` utility (`grid-column: 1 / -1`) is available
  for the rare case a full-width action is a deliberate emphasis choice at every width, applied
  per-child at the call site, never automatically.
- **A tag-collection container/item (a Looks chip, a Load item row, a Status row, …) uses
  `.board`/`.posting` (`surfaces.css`, `0.26.0`) for the pinned-paper-on-a-corkboard look under
  Notice Board** — see "Architecture: appearances" in `docs/architecture/appearances.md` for the full primitive, the tilt
  constraint, and why `.posting`'s background/border/padding specifically can't be plain
  neutralised tokens the way the rest of this app's token system works. Scoped to the character
  sheet's tag collections per the plan's decision 3 (Looks, Theme's quest chips, Load items,
  Abilities & Skills entries, Armor entries, Statuses rows); everything else in the app gets the
  token repaint only. **Each Motif card joined this list in `0.39.0`** — `MotifPanel.tsx` wraps its
  three cards in one `board`, each card `posting`, no `tilt` (a full-width row of text inputs, the
  same carve-out `StatusesPanel`'s own rows already have) — fixing a real readability bug (dark
  ink on dark cork) that predated this convention being applied there at all; see "Architecture:
  appearances" in `docs/architecture/appearances.md`'s "Default flip" note for why this shipped in the same release as the
  appearance default changing.
- **A repeated-control row (like `Pips`) sharing a line with a flexible text input needs a real
  breakpoint, not a wrapping flex row, once the repeated controls get wide enough.** `Pips` grows
  each dot's *tap* area to 44px on a coarse pointer while keeping the painted dot small (see
  `layout.css`'s `.pip-row` comment) — six pips alone claim ~239px, which the comment there assumes
  will have a line to itself. `StatusesPanel.tsx`'s per-status row (name input + 6 Pips + rank +
  remove, `0.18.2`) used to put all four in one `flex-wrap: wrap` row; on a real iPhone the name
  input rendered narrower than its own value (`"Chubby"` displayed as `"Chubb"`) and the rank digit
  got stranded on its own line next to the remove button, because `flex: 1`'s `flex-basis: 0%`
  doesn't cleanly bump a whole sibling group to the next line the way a stated breakpoint does. Fixed
  by switching `.rowHead` to a `display: grid` with two named-area templates: one row (`name pips
  rank remove`) — today's original layout, unchanged — reflowing below 1024px to `name rank remove`
  on one row and `pips` alone on the next. **`pips` needs a row entirely to itself, not shared with
  `rank` in a split column** — the first cut of the two-row template split "pips | rank" across the
  two mobile columns, which left `pips` only the `1fr` share (~222px at 360px, still short of the
  ~239px six pips need), so `Pips`' own internal `flex-wrap` kicked in and its 44px-tall touch
  overlays (sized for `--tap-min`, not the ~19px painted dot — see `layout.css`'s `.pip::after`,
  unconditional on every pointer type) overlapped between the two wrapped lines, caught by the
  responsive smoke test's hit-area-overlap check. `rank` moved up next to `name`/`remove` instead,
  since it's just a small number badge with room to spare there — and even with a row fully to
  itself, `pips`' 44px-tall overlay still reaches ~12.5px past the painted dot, which very nearly
  overlapped the `Link to…`/`Affected by…` row directly underneath (`.links`, `margin-top: 7px`);
  `.pipsCell` carries an extra `margin-bottom: 14px` below 1024px to cover that.
  **The single-row template only turns on at 1024px, not the phone/tablet 600px break used
  elsewhere in this file** — the first cut used 600px and the responsive smoke test caught it
  overflowing at 768px. This panel doesn't sit at full viewport width: `.sheet-grid` goes
  two-column at 768px, and `StatusesPanel` is in the second (wider) `.sheet-col`, but that column
  is only `minmax(0, 1.5fr)` there — ~382px of content at a 768px viewport, short of the ~470px
  the single-row template needs. It isn't comfortably wide enough until 1024px, where the ratio
  becomes `1.7fr` (~564px of content). The general lesson: a panel inside `.sheet-col` cannot
  assume viewport width is its own width once 768px is crossed — check the actual column math (or
  just run the responsive smoke test) rather than picking a breakpoint from the viewport alone.
  Chosen over the alternative of always stacking those two rows regardless of viewport (simpler —
  one layout rule instead of two — at the cost of extra vertical space on desktop where it isn't
  needed); revisit that trade if the two-template grid proves annoying to maintain. If another panel
  ever puts a multi-pip `Pips` row next to a flexible-width input on the same line, check whether it
  needs the same treatment rather than assuming `flex-wrap` will degrade gracefully — it doesn't
  once the pip count is high enough.
  **This viewport-keyed threshold became a container query in `0.39.0`, and the reason it had to
  wait until then is worth internalizing**: `0.24.0`'s own migration deliberately left this one
  breakpoint unconverted (flagged as a follow-up in both `Panel.module.css` and this file), but a
  container query keyed to the *panel's* width couldn't have told a wide single polarity column
  from a narrow one of three — `0.39.0`'s Statuses-columns feature is what made the conversion a
  hard prerequisite rather than an optional cleanup, since three columns now share one viewport
  width. The container (`container-name: status-col`) lives on the polarity group's own `board`
  element, not the group wrapper around label+board — putting it one level up would fold
  `--board-pad` into the measured width, making the threshold silently different per appearance,
  exactly the class of bug the doubled smoke matrix exists to catch. New threshold:
  `@container status-col (min-width: 510px)`, derived to reproduce the old 1024px-viewport
  behavior at 768px/1024px in both appearances and correctly refuse the single-row template at
  every multi-column width — see `StatusesPanel.module.css`'s rewritten comment for the full table.
  The three groups themselves sit in `.statusGroups`, an `auto-fit` grid
  (`minmax(290px, 1fr)`, per this file's own "distributing peers" rule below) rather than a
  hand-picked column count — 1-up through most tested widths, 2-up at 1440px, 3-up at the sheet's
  own `>=1800px` wide step. An empty group still renders its `board` with a muted "None" line
  rather than being omitted, so a column never collapses to just a label mid-grid.
  **The quick-add row's four controls (`.addRow`, `0.18.3`) hit the same too-narrow-below-1024px
  problem and reuse the same threshold, but not the grid technique** — Polarity/Rank/Add are all
  modest, well-behaved widths (nothing like Pips' 239px), so there's no flex-basis:0 wrapping trap
  to design around. A plain `display: flex; flex-direction: column` on `.addRow` puts the name input
  on its own full-width row with a nested `.addControls` flex row (Polarity, Rank, Add) below it;
  at 1024px, `.addRow` flips to `flex-direction: row` and `.addControls` switches to
  `display: contents`, dissolving the wrapper so its children rejoin `.addRow`'s single-row layout
  directly — reproducing the original one-line order with no extra nesting affecting layout. Prefer
  this simpler `display: contents` approach over `.rowHead`'s named-grid-area trick when a
  breakpoint-gated regroup doesn't involve an item wide enough to trigger the flex-wrap trap in the
  first place.
- **The character sheet's two-column layout is `.sheet-stack` (full-width bands) wrapping
  `.sheet-grid` (a two-column grid), not one element doing both jobs (`0.22.0`)** — a Figma-workshopped
  fix for every panel being forced into one of two columns regardless of fit (3 panels on the left, 5
  on the right, which read as arbitrary rather than deliberate). `.sheet-stack` (`layout.css`) is now
  the outer container — `max-width`/centering/padding/vertical `gap` live here, as direct children in
  render order: `.sheet-grid`, `.sheet-pair`, Abilities & Skills, Load, Advancement, the footer row
  (reordered in `0.23.0` — see below). `.sheet-grid` itself keeps only the grid-column behavior (the
  same `minmax(280px,1fr)
  minmax(0,1.5fr)` at 768px / `minmax(320px,1fr) minmax(0,1.7fr)` at 1024px ratio as before — see the
  `.sheet-grid` comment for why that ratio wasn't rebalanced to an even split just because there are
  only two panels in it now: Statuses' rows still need more width than Virtues', so the width each of
  them gets is unchanged from before this pass, and `StatusesPanel.module.css`'s 1024px breakpoint
  math didn't need re-deriving as a result — confirmed by re-running the responsive smoke test, not
  just by the arithmetic. **Prose text in the newly full-width panels needed a separate fix**: Theme/
  Abilities & Skills/Load render authored rules text and descriptions that would otherwise stretch to
  150+ characters per line at desktop widths now that their panel isn't capped at half the sheet's
  width. A new `.prose` utility (`layout.css`, `max-width: 68ch`) is applied at each affected `<p>`/
  text-block call site individually (not blanket-applied, and not applied to `AdvancementPanel`,
  whose own prose sits inside already-bounded row/badge layouts rather than running the panel's full
  width) rather than capping the panels themselves, so structured content (chip rows, pip trackers)
  still gets to use the full band width.
- **`.sheet-grid` (Virtues \| Statuses) moved to the top of `.sheet-stack`, and Theme/Looks now
  pair up in their own row instead of stacking as two separate full-width bands (`0.23.0`)** —
  direct repo-owner testing feedback: Virtues and Statuses are what a player checks most during
  play and were previously buried below Theme/Looks/Abilities & Skills/Load. `CharacterSheetPage.tsx`
  reorders its `PANEL_IDS`/render order accordingly; a new `.sheet-pair` class (`layout.css`) gives
  Theme and Looks an even 1fr/1fr split, reusing the same `.sheet-col` styling `.sheet-grid`'s
  columns already use rather than inventing a second column treatment. `.sheet-grid`'s own
  Virtues:Statuses ratio was deliberately left unchanged by this move (still `1fr`/`1.5fr`/`1.7fr` at
  the breakpoints described above) — reordering which row comes first doesn't change how wide either
  column needs to be, and `StatusesPanel.module.css`'s breakpoint math was reconfirmed against the
  responsive smoke test rather than assumed to still hold.
- **`.sheet-stack`'s render order changed again in `0.24.0`, and every panel is now a container-
  query container for its own measured width, not just a `.sheet-col` grid item.** Current order:
  `.sheet-grid` (Virtues | Statuses, unchanged since `0.23.0`) → `BackgroundPanel` (full width) →
  `.sheet-pair` (now Abilities & Skills | Load, not `0.23.0`'s Theme | Looks) → Advancement →
  footer row. **Theme and Looks merged into one "Background" section** (`BackgroundPanel.tsx`,
  new), Looks first per the repo owner's markup — `ThemePanel.tsx`/`LooksPanel.tsx` are demoted to
  plain sections inside it (a `.sectionLabel`-style heading, no `Panel`/`PanelHeader`), same
  "integrated sub-section" shape `ArmorSection` established inside `StatusesPanel` in `0.22.0`.
  Freeing `.sheet-pair` is what let it take Abilities & Skills | Load instead — see `layout.css`'s
  `.sheet-pair` comment for why that pairing kept the existing even `1fr`/`1fr` split rather than
  inventing an asymmetric one. `PANEL_IDS`'s old separate `theme`/`looks` collapse keys collapsed
  into one `background` key; a client with either old key already persisted in its zustand store
  just carries it as a harmless unused entry, no migration needed.
  **Every `Panel` (`Panel.module.css`'s `.panel` class) is now a named container-query container**
  (`container-type: inline-size; container-name: sheet-panel`) — the real fix for the footgun
  CLAUDE.md had already documented ("a panel inside `.sheet-col` cannot assume viewport width is
  its own width once 768px is crossed"), chosen over containing at `.sheet-col` so a full-width
  band (Advancement) and a half-width paired panel (Abilities & Skills, Load) share one mechanism.
  Three panels now query their own width via `@container sheet-panel (min-width: …)` rather than a
  hand-derived viewport breakpoint: `AbilitiesSkillsPanel` goes two columns at 560px (one combined
  `.list` grid, abilities then skills, not two separate `.map()`s restarting the flow); `LoadPanel`
  splits into a 1fr tiers column / 2fr items column at 700px (deliberately conservative — see
  `LoadPanel.module.css`'s `.body` comment for the arithmetic showing this rarely activates while
  paired with Abilities & Skills at ordinary desktop widths, only reliably at the sheet's own
  `>=1800px` wide step); `AdvancementPanel`'s two `.subBox`es (Potential, Rapport) pair at 850px
  (worked out from a 5-pip `Pips` row's own coarse-pointer width, per `AdvancementPanel.module.css`'s
  `.tracksRow` comment). `StatusesPanel.module.css`'s own existing 1024px media-query math was
  **deliberately not converted** in this pass — flagged as a follow-up, not bundled into a feature
  PR, per the lesson in the `.tap`-overlay bullet below — **and was converted in `0.39.0`**, once
  Statuses' own polarity-columns feature made a viewport-keyed threshold actually wrong rather than
  merely inconsistent (see this file's Statuses-columns note above for why three columns sharing
  one viewport broke the old assumption). See `../decisions.md` item 24 for the full container-query adoption writeup.
  **Two more containers joined in `0.39.0`**: `BackgroundPanel` reuses `Panel`'s own `sheet-panel`
  container for its new Motifs `2fr` / Looks `1fr` split at 760px (an explicit repo-owner layout
  call, `WorkPlan-0.39.0.md` item 4), and each `MotifPanel` card gets its *own* `motif-card`
  container (not `sheet-panel`, which after that same split measures the whole panel — a different,
  wider number than one card actually has to lay out into) for its name/Potential head (380px) and
  Skill/Flaw Tag pairing (520px). `PeekCard.tsx` (Campaign Shell, not the sheet — a different
  `Panel` component entirely) also gained its own `peek-card` container for its identity+virtues /
  statuses+stats split, independent of `.peekGrid`'s existing 768px viewport switch one level up.
  **`VirtuesPanel`'s score box moved from leading to trailing the row, and the Condition checkbox
  is gone.** This reverses `0.22.0`'s Figma "Option A" pick on a newer, more specific markup from
  the repo owner: `.naming` (name + tagline, in that order — tagline moved back under the name,
  where it lived before `0.22.0`) leads the row; `.trailing` (the score box above the Condition
  button) trails it. The Condition button itself now carries the "press me" affordance instead of
  a separate checkmark glyph — unmarked uses the `--gold-tint`/`--gold-line` "interactive chip"
  pair already used for `ThemePanel`/`LooksPanel`'s own chips, rather than the old near-invisible
  neutral border. `VirtuesPanel.module.css`'s comment blocks were rewritten, not just deleted, to
  describe the new arrangement and note the reversal — see the file itself for the full tap-overlay
  arithmetic redone for the new layout (the old `.conditionRow`'s 24px margin-top doesn't carry
  over: `.naming`'s tooltip trigger and the Condition button are no longer vertically adjacent in
  this layout, but the Condition button and its own tooltip trigger, now side by side in
  `.trailing`, are a new pair that needed its own clearance worked out).
  **Explicit glossary tags** (`packages/shared/src/glossary.ts`, `0.24.0`) — CommonMark reference-
  link syntax (`[Term]`, `[display][id-or-name]`, `\[`/`\]` to escape a literal bracket) lets an
  author opt a specific occurrence out of auto-linking, or link a display word that isn't a term's
  own `Name`/`Alias`, without a new global `Alias`. A field with at least one explicit tag disables
  the regex auto-linker for that whole field — see `linkifyText()`'s doc comment. New
  `GameSettings.GlossaryAutoLink` (default `true`) is a separate, library-wide kill switch for the
  regex pass; explicit tags resolve independently of it either way. Content Admin's Validation
  panel now also surfaces an unresolved tag (`findUnresolvedGlossaryTags()`, wired into
  `validateLibrary()` in `apps/server/src/adminLogic.ts`) across every `text`/`textarea` field, the
  same way it already surfaces a dangling ref. See `../decisions.md`
  item 23 for the full syntax-choice writeup.
  **Game history moved into a shared modal** (`apps/web/src/components/HistoryModal.tsx`) at all
  three places `AdvancementPanel.tsx` used to render it inline at all times (Potential, party
  Rapport, per-Bond) — a "History (N)" trigger opens it instead. Built on `modal.module.css` and
  `useModalA11y.ts` like every other dialog (see the modal-count note below); per-Bond history also
  dropped its `.slice(0, 8)` truncation, which only existed to fit inline on the sheet.
- **Armor lives inside StatusesPanel now, not its own Panel (`0.22.0`)** — `ArmorPanel.tsx` is gone;
  `ArmorSection.tsx` renders the same controls (per-Armor Used toggle, Refresh all with the same
  `ConfirmModal`) as a plain `<div>` section inline inside `StatusesPanel.tsx`, ahead of the Positive/
  Neutral/Negative groups, with its own small `.groupLabel`-style heading instead of a `PanelHeader`.
  Prompted by a direct repo-owner request: marking Armor Used is an alternative to taking a Status, so
  the controls should feel integrated rather than living in a separate collapsible section below.
  `StatusesPanel.tsx` also dropped its inert "Link to…/Affected by…" row (a `LinkedToIds`/
  `AffectedByIds` future-feature stub that was never wired to anything — the underlying
  `CharacterStatus` fields are untouched, only the dead UI row is gone) and tightened `.row`'s padding,
  both in the same space-optimization pass.
- **A `.tap` element's overlay only overhangs the axis where the element itself is under 44px** — worth
  internalizing exactly, not just approximately, because a near-miss here doesn't fail loudly, it fails
  as a CI-only overlapping-hit-area error. `.tap::after`'s `width`/`height` are each `max(100%,
  var(--tap-min))` independently: a button already ≥44px wide gets zero *horizontal* overhang even if
  it's short, and vice versa. `VirtuesPanel.module.css`'s `0.22.0` VirtuesPanel rework shipped a real
  instance of getting this wrong: merging `.tagline` into `.conditionRow` (so Condition could move to
  the row's trailing edge, per the same Figma pick above) removed a tagline-only spacer line that used
  to separate a Virtue's own InfoTooltip trigger from the Condition row below it, and the `margin-top`
  separating them was left at the old layout's 7px instead of being re-derived for the new one — its
  own comment even claimed a responsive-smoke-test check that had never actually been run. CI caught
  real overlaps at 360px and 768px (the two narrowest widths this panel renders at, not necessarily
  the two narrowest viewports overall — see the `.sheet-grid` note above for why 768px, right at the
  single-to-two-column transition, is tighter than 360px here). Fixed by bumping the margin to 24px
  with the overlay arithmetic worked through in the CSS comment, rather than by trial-and-error. If you
  change spacing between two `.tap`-classed elements that both fall under 44px in the same dimension,
  redo this math rather than assuming a value that worked in a different layout still applies.
- Auth (sign up/in/out) calls `@supabase/supabase-js` directly from the browser
  (`apps/web/src/lib/supabaseClient.ts`) — it does not proxy through the Express server. The
  Express API client (`apps/web/src/lib/api.ts`) attaches the Supabase session's access token as
  a Bearer header to every `/api/...` call.
- Small shared components — reuse rather than re-inventing:
  `apps/web/src/components/ConfirmModal.tsx` (`0.5.0`, yes/no confirmation dialog, built on
  `modal.module.css`) for any button that bulk-resets/refreshes sheet state or destroys a single
  record — Make Camp/Refresh-all/import-overwrite since `0.5.0`, extended in `0.19.0` to revoking
  an invite, removing a Combat participant, deleting a Status, and dropping a Quest, all of which
  used to fire immediately with no way back;
  `apps/web/src/components/InfoTooltip.tsx` (`0.5.0`, tap-to-reveal "i" trigger, not a native
  `title` — those never show on touch) for description/flavor text that's authored in the library
  but not otherwise rendered on the sheet (a Virtue's `Essence`/`UsageHelperText`, an Armor Type's
  `Description`, ...); and `apps/web/src/components/GlossaryText.tsx` (`0.9.0`) for any authored
  or player-authored prose rendered anywhere in the app — not just the Character Sheet (a
  Move/Skill/Ability's description/effect/rules text, an Item/Theme/Quest's description, a Bond
  proposal/history `Note`, ...) but the Campaign Shell too (`CampaignBonds.tsx`'s Bond move text
  and notes; `0.10.1` closed a gap where this duplicate render path had been missed) — it
  auto-links every glossary term the text contains into its own tap-to-reveal definition, so
  don't hand-roll term-specific tooltips, and don't add a new free-text render site without it.
  Pass it
  the matcher from `apps/web/src/lib/useGlossaryMatcher.ts` (memoized off `library.glossary`, one
  matcher shared across the tree). `InfoTooltip` and `GlossaryText`'s bubbles share their
  open/dismiss-on-outside-click-or-Escape behavior via `apps/web/src/lib/useTapReveal.ts` rather
  than each reimplementing it — extend that hook, don't fork it, if a third tap-to-reveal surface
  shows up. See `../decisions.md` item 9 for why a linked term is a
  `<span role="button">` rather than a real `<button>` (44×44 touch targets on words packed
  together mid-sentence would overlap) before changing how `GlossaryTermLink` renders.
  `apps/web/src/components/HistoryModal.tsx` (`0.24.0`) is the newest addition to this list — a
  shared "game history" display (title + a scrollable list of timestamped entries, each optionally
  carrying `GlossaryText`-rendered detail) for any place this app shows a retrospective record
  rather than live reference; reuse it rather than rendering history inline the way
  `AdvancementPanel.tsx` used to before this version. Combat's `Encounter.History` log stayed a
  collapsible in-page section rather than moving to this modal — it's live reference read *during*
  a fight, not a retrospective record, and a modal would cover the board mid-turn; flagged as an
  open question in `WorkPlan-0.24.0.md` rather than silently decided either way, in case that
  judgment call gets revisited.
- **Every modal shares focus-trap/initial-focus/Escape-to-close/focus-restore behavior via
  `apps/web/src/lib/useModalA11y.ts` (`0.19.0`)** — attach its returned ref to the `modal.dialog`
  element alongside `role="dialog"` `aria-modal="true"` `aria-labelledby={titleId}` `tabIndex={-1}`
  (those stay in each consumer's own JSX since they don't vary at runtime the way the hook's
  behavior does). It's a **callback ref, not `useRef` + a mount effect** — most modals unmount
  when closed, but `AdvancementPicker` is rendered unconditionally by its caller and internally
  `return null`s when there's no active picker, so it never unmounts; only the dialog's own
  subtree appears/disappears, and only a callback ref fires correctly on both patterns. It also
  tracks a small open-dialog stack so Escape only closes the topmost dialog — `EndSessionModal`
  nests `MarkKinModal` (Mark Kin, spent from Hold), the one place two of this app's modals are open
  at once, and a bare per-dialog Escape listener would otherwise close both in one keypress.
  Applied to all 13 modals in the app (`HistoryModal.tsx`, `0.24.0`, is the newest). Extend this
  hook, don't fork it, for any new modal.
- **Form fields: a shared `Field`/`TextInput`/`Select`/`NumberInput`/`CheckboxRow` set
  (`apps/web/src/components/form/`, `0.23.0`), and react-hook-form + zod scoped to where they
  replace real duplicated logic, not adopted everywhere.** `Field` is a label+control pair (a
  `Fragment`, not a wrapping `<div>` — matches the plain sibling `<label>`/`<input>` markup it
  replaces exactly, so it carries zero layout risk); `TextInput`/`Select`/`NumberInput` are thin
  styled wrappers taking `ref` as a plain React 19 prop so `register()`'s returned `ref` spreads
  straight through for an uncontrolled RHF field. `characterCreationSchema(library)`
  (`packages/shared/src/characterCreationSchema.ts`) is a zod schema factory — `zod` is
  `@asohav/shared`'s first-ever runtime dependency — bound to a `Library` snapshot since character
  creation is the one form in this app that validates against real content, not just field shapes;
  `apps/server/src/routes/characters.ts` (`safeParse`) and `CreateCharacterPage.tsx`
  (`zodResolver` via `useForm`) both call it, replacing what used to be two independently
  hand-maintained copies of the same rules. `AddParticipantModal.tsx`/`CombatMoveModal.tsx` only
  `register()` their simple, independent fields — no zod schema, since there was no duplicated
  validation to unify there, just repeated markup the new primitives replace. Both modals'
  genuinely dynamic per-row arrays (Status Limits, Gambits) deliberately stayed local `useState`
  rather than `useFieldArray`, to avoid rebuilding already-working Combat state management with no
  live-QA path in this sandbox to catch a regression. See `../decisions.md` item 22 for the full scoping rationale, including which of the five modals
  sharing this CSS actually migrated (two) versus were deliberately left alone (three, plus
  `CreateCharacterPage`'s own differently-styled fields) and the bundle-size cost of not
  lazy-loading `CreateCharacterPage` the way `/admin`/`/combat` are (below).
- **`/admin` and `/combat` are behind `React.lazy`/`Suspense` (`0.19.0`)** in `App.tsx` — Content
  Admin is designer/admin-only (~960 lines of schema-driven CRUD) and Combat is only relevant
  mid-session, so neither belongs in the bundle every player downloads just to open their
  character sheet. One `<Suspense fallback={...}>` wraps the whole `<Routes>` block rather than
  each lazy route individually, since only one route ever renders at a time anyway; the fallback
  reuses the in-shell "Loading…" convention (`padding: 20px`, `App.module.css`'s `.routeLoading`)
  rather than the full-viewport pre-auth `.loading` class, since it renders inside `AppShell`. If
  another route grows large and is similarly rare in a typical session, split it the same way.
