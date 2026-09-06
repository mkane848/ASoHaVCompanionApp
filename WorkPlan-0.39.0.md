# Work plan — `0.39.0`: appearance default & sheet layout

The second of two releases implementing `UIReviewRound_Handoff.md`. `WorkPlan-0.38.0.md` took the
review's **state** items; this one takes the four about **layout and appearance**, plus the
cross-cutting decision that Notice Board becomes the default appearance.

Pure client-side. No server change, no migration, no wire-contract change.

> **Status: APPROVED by the repo owner (2026-09-05), not yet implemented.** Do not start this until
> `0.38.0` is merged — both releases touch `CampaignPage.tsx`, and running them on parallel branches
> buys a merge conflict for nothing. Every scope decision below was confirmed with the repo owner;
> don't re-litigate them. The corrections were verified against the actual code.

## Decisions already locked

1. **Notice Board becomes the default appearance**, and everyone who previously chose Parchment
   explicitly is reset to Notice Board once. They can choose Parchment again and it sticks.
2. **The Motif card readability bug must be fixed in this same release** — it becomes the default
   first impression the moment decision 1 lands.
3. **Background is Motifs 66% left, Looks 33% right**, side by side rather than stacked.
4. **Statuses polarity groups become columns, done properly** — including converting `.rowHead`'s
   viewport media query to a container query, which is a hard prerequisite (see correction 1).
5. **`PeekCard` gets the Potential label fix *and* an internal column restructure.**

---

## Corrections to the review handoff

### 1. Statuses columns are not a self-contained change

The handoff treats the three-polarity-column layout as a local change to
`StatusesPanel.tsx:267-274`. It isn't.

`.rowHead`'s single-line template (`name pips rank remove`) switches on a **viewport** media query at
1024px (`StatusesPanel.module.css:271-288`), and that file's own ~90-line rationale block
(`:162-230`) derives 1024px from the fact that this panel sits in `.sheet-grid`'s second column: the
single-row template needs **~470px**, and the column only reaches ~564px of panel content at a 1024px
viewport.

Put three polarity groups side by side at a 1920px viewport and each column is roughly **300px** —
while that viewport query is still firing, because the *viewport* is 1920px. The row overflows, and
the six-box `StatusBoxes` row (239px on a coarse pointer) wraps into its own 44px touch overlays,
which is the exact overlapping-hit-area bug the dedicated pips row exists to prevent.

So columns require moving that breakpoint to a container query. That is also the one deliberately
unconverted piece of the `0.24.0` container-query migration, flagged as an open follow-up in both
`Panel.module.css:16-21` and the `.rowHead` comment — this release closes it.

### 2. `PeekCard` has a second bug in the same three lines

Alongside the unlabelled `Potential {m.Potential} / 5` (`PeekCard.tsx:84-86`), the `/ 5` is
**hardcoded** rather than read from `library.settings.PotentialTrackLength`. Every other track readout
in the app reads its length from the library.

### 3. The handoff's "apply column thinking to other sheet panels" list is stale

Handoff §5 names `AbilitiesSkillsPanel` (already 2-up) and a `.sheet-pair` "Abilities & Skills | Load"
pairing. **`AbilitiesSkillsPanel` no longer exists**, and `.sheet-pair` has no call site in
`CharacterSheetPage.tsx` at all any more — `layout.css`'s comment describing that pairing is out of
date. Current `.sheet-stack` order is: `.sheet-grid` (Virtues | Statuses) → `BackgroundPanel` →
`LoadPanel` → `AdvancementPanel` → `PartyPlaybookPanel` → footer row, every one after the grid being a
full-width band.

Consequence for item 4 below: `BackgroundPanel` is *already* full-width, so the 66/33 split goes inside
its own body — which is the handoff's conclusion, just not for the reason it states. While you're in
`layout.css`, fix the stale `.sheet-pair` comment.

### 4. The forced appearance migration needs no migration code at all

See item 1. The handoff proposes a marker key plus clear-and-rewrite logic in three places; a key
rename gets the same result with no logic.

---

## Item 1 — Notice Board becomes the default, with a one-time reset

### The change is a key rename, not a migration

The handoff proposes a separate `asohav.appearance.migrated` marker, and logic in all three places to
check it, clear a stored `'parchment'`, write the default, and set the marker. That is three
hand-synced copies of a stateful branch — the exact shape most likely to drift.

**Rename the storage key instead.** `asohav.appearance` → `asohav.appearance.v2`, and flip the
default. Nobody has the new key yet, so on first load after this ships *everyone* falls through to the
default — which is now Notice Board. That **is** the forced reset, with no marker, no clearing, and no
write-on-load. Anyone who then picks Parchment writes the new key and keeps it. Anyone who had already
chosen Notice Board is "reset" to Notice Board and sees no change.

The legacy `asohav.appearance` key is simply never read again. Leave it in place rather than deleting
it — an inline `<head>` script that deletes storage is more risk than a few dead bytes.

### Files

- **`apps/web/src/lib/appearances.ts:18`** — `DEFAULT_APPEARANCE: AppearanceId = 'noticeboard'`.
- **`apps/web/src/store/appearanceStore.ts:4`** — `const KEY = 'asohav.appearance.v2'`. `loadAppearance()`
  (L23) needs no other change: a missing key already falls through to `DEFAULT_APPEARANCE`.
  Update its doc comment, which currently describes the old key.
- **`apps/web/index.html:12-20`** — the inline no-flash script becomes:

  ```js
  var v = 'noticeboard';
  try {
    if (localStorage.getItem('asohav.appearance.v2') === 'parchment') v = 'parchment';
  } catch (e) {}
  ```

  (Note it inverts: today it defaults to `'parchment'` and only flips on an exact `'noticeboard'`
  match.) Update the comment above it, which says "Parchment first (WorkPlan-0.26.0 B3)".
- **`apps/web/harness.html:13-23`** — same inversion, and **keep the `?appearance=` priority branch
  exactly as it is**. `harnessConfig.mjs`'s `APPEARANCES` matrix navigates with that param to force
  each appearance deterministically; only the *no-param* fallback flips.

### Tests

`apps/web/src/store/appearanceStore.test.ts` (7 `loadAppearance` cases today):

- "defaults to Parchment when localStorage has nothing" → now expects `noticeboard`.
- New: a legacy `asohav.appearance = 'parchment'` with no `.v2` key → `noticeboard` (the forced reset).
- New: `asohav.appearance.v2 = 'parchment'` → `parchment` (respected thereafter).
- Existing `?appearance=` priority, garbage-value, storage-throws and `location`-undefined cases all
  still pass unchanged.

**Add one new guard test**: assert `DEFAULT_APPEARANCE` matches the literal in `index.html`'s inline
script by reading the file. That sync is comment-only today, and this release is exactly the kind of
change that breaks it — `appearances.test.ts` currently asserts nothing about it.

### Docs

`CLAUDE.md:35` and `:1345` both say Parchment is "still the default". `AppThemeGuidelines.md` needs a
dated note that Notice Board is now the default (it doesn't currently claim otherwise, but it reads as
though Parchment is primary). `README.md`'s appearance items likewise.

---

## Item 2 — Motif card readability (must ship with item 1)

Review item 5: *"the coloring makes text hard to read."*

`MotifPanel.tsx:86` gives each of the three Motif cards a global `board` class alongside its own
`styles.motif` — a template literal in `className`. Under
Notice Board, `.board` paints `--board-bg: rgba(0, 0, 0, 0.18)` — the dark corkboard — and the card's
transparent-background inputs then render `--ink`/`--ink-85` text straight onto it. Dark ink on dark
cork. Once item 1 lands this is the first thing a player sees.

**Fix by mirroring what `LooksPanel` already does correctly.** `LooksPanel.tsx:39/41` wraps its chips
in a single `<div className="board">` and makes each *chip* a `.posting`, which under Notice Board
paints `--posting-bg: #f1e9d4` — light paper. Do the same here: one `board` wrapper around the three
cards, each card `posting`.

**No `tilt`.** A Motif card is a full-width interactive row containing text inputs, not a chip — the
same carve-out `StatusesPanel`'s rows already take, and for the same two reasons `surfaces.css`
documents (`getBoundingClientRect()` reports the transformed box, and a tilted input row is worse to
actually use).

Inert under Parchment, where every `--posting-*`/`--board-*` token is neutralised to
`transparent`/`none`/`0px` — but **verify it, don't assume it**: `surfaces.css`'s own comment explains
that `.posting`'s background/border/padding are scoped to
`:root[data-appearance='noticeboard'] .posting` precisely so a neutralised token can't win the cascade
and erase a component's own background. Check the Parchment screenshots are byte-identical before and
after.

---

## Item 3 — Motif card internals (wasted space)

Review item 5's other half. Each card currently stacks Name → Skill Tags → Flaw Tags → Quest → Act
Breaks/Forsakes as one tall column, three times over. `MotifPanel.module.css` has **no media queries
and no container queries at all**.

- Give `.motif` its own container (`container-type: inline-size; container-name: motif-card`).
  **Not `sheet-panel`** — `Panel`'s container measures the whole panel, which is the wrong number once
  item 4 makes Motifs 66% of it.
- `.motifHead` is a single-column grid today, so the name input and the Potential `TrackStepper` always
  stack. Give it a two-column split above a threshold.
- Pair Skill Tags | Flaw Tags side by side above a threshold. Tighten vertical rhythm throughout.
- **Keep `TrackStepper`** and its deliberate avoidance of `Pips` (`MotifPanel.tsx:190-194`) — that
  comment records a real 44px-overlay collision, not a style preference.

Thresholds derived from real rendering, not guessed. `0.37.0`'s `@container adventure-card
(min-width: 600px)` is the precedent for how: pick from the real content width, then confirm with the
screenshot script at 360/768/1024/1440/2560 before landing.

---

## Item 4 — Background: Motifs 66% left, Looks 33% right

Review item 4, an explicit repo-owner layout call.

`BackgroundPanel.tsx` is 17 lines and **has no `.module.css` at all** — it renders `LooksPanel` then
`MotifPanel` stacked inside one collapsible `Panel` (`#p-background`, collapse key `background`). Add
the stylesheet.

- Panel body becomes a two-column grid, **Motifs `2fr` left, Looks `1fr` right**.
- **Reorder the JSX**, don't use `order:`. Looks currently renders first in the DOM; the ask puts it on
  the right. Reordering the source keeps tab order matching visual order — an `order:` flip would leave
  a keyboard user tabbing right-to-left.
- Gate on `@container sheet-panel (min-width: …)` — `Panel.module.css:22` already establishes that
  container. Start around 700-760px and verify: at a 1024px viewport this full-width band gives ~940px
  of panel content, at 768px it gives ~684px, so the threshold decides whether tablet portrait stacks.
- Below the threshold, stack. **Recommend Motifs first when stacked too**, matching the wide layout's
  reading order rather than preserving today's Looks-first order. If you keep Looks first instead,
  record it as a judgment call in `README.md` — either is defensible, but silently having two different
  orders isn't.
- Keep the single collapse unit intact — the grid lives inside the panel body, and `#p-background` /
  the `background` collapse key / the nav anchor in `CharacterSheetPage.tsx:143-150` all stay.

---

## Item 5 — Statuses: polarity groups as columns

Review item 6, scoped by the repo owner to *"stays in grid, columns only at genuinely wide widths."*
Read correction 1 first — the container-query conversion is not optional.

### Structure

`StatusesPanel.tsx:267-274` currently renders three stacked pairs of a `.groupLabel` div plus, when
non-empty, a `<div className="board">` of rows.

- Wrap all three in `.statusGroups`, a grid: `grid-template-columns: repeat(auto-fit, minmax(<floor>, 1fr))`.
  `auto-fit` over a hand-picked breakpoint, per `CLAUDE.md`'s "distributing peers" rule.
- Each group becomes one cell — its label and its `board` together.
- **Render an empty group's `board` with a muted "None" line** rather than omitting it as today, so a
  column doesn't collapse to just a label mid-grid.

### The container goes on the `board`, not the group

Put `container-type: inline-size; container-name: status-col` on the **`board`** element — the one
whose content box directly contains the `.posting` rows. Putting it on an outer group wrapper would
make the container width include `--board-pad`, which is `16px` under Notice Board and `0px` under
Parchment — an appearance-dependent 32px error in the threshold, which is precisely the class of bug
the doubled smoke matrix exists to catch.

### The threshold

Move `.rowHead`'s `@media (min-width: 1024px)` block (`StatusesPanel.module.css:271-288`) — both the
`grid-template-columns`/`grid-template-areas` switch **and** the `.pipsCell` `margin-inline: 0` /
`margin-bottom: 0` reset — to `@container status-col (min-width: <T>)`.

Starting point `T ≈ 510px`, which is derived, not guessed. The row itself sits inside `.posting`'s
`--posting-pad-x` (14px each side under Notice Board, 0 under Parchment), and the single-row template
needs ~470px:

| Viewport | Panel content | Columns | `board` content box (NB) | Row gets | Template |
|---|---|---|---|---|---|
| 768 | ~382px | 1 | 350 | 322 | two-row (matches today) |
| 1024 | ~564px | 1 | 532 | 504 | single-row (matches today) |
| 1440 | ~725px | 2 | ~323 | ~295 | two-row |
| 1920+ | ~927px | 3 | ~268 | ~240 | two-row |

`T = 510` reproduces today's behaviour exactly at 768 and 1024 in **both** appearances (under
Parchment the `board` content box is 382 / 564 with no padding subtracted, which lands on the same
side of 510 both times), and correctly refuses the single-row template in every multi-column case.

### The `auto-fit` floor

The column counts above assume a floor of about **290px**. That is what produces 2-up at 1440 and 3-up
at 1800+ (where `--content-max-wide: 1600px` widens the sheet). The arithmetic, from
`--content-max: 1280px`, `.sheet-stack` padding 20px, `.sheet-grid` gap 18px and its 1.7fr ratio at
≥1024px, then `.panel` padding 22px:

- 1440 viewport → panel content ~725px → `2 × 290 + 14 = 594 ≤ 725`, `3 × 290 + 28 = 898 > 725` → 2 columns.
- 1920/2560 viewport → panel content ~927px → `898 ≤ 927` → 3 columns.

A floor of 320px would give 2-up at both 1440 and 1920 and never reach 3-up (`3 × 320 + 28 = 988`).
Both are legitimate readings of "columns only at genuinely wide widths" — **derive the final number
from screenshots at 1440/1920/2560 and record which you picked and why**, rather than taking 290 on
faith.

Note the real trade this makes and check it in the screenshots: at 1440 today, Statuses rows are
single-line. Going 2-up there makes them two-line. More columns, taller rows.

### Re-verify, don't assume

`.pipsCell`'s negative `margin-inline: calc(-1 * (var(--posting-pad-x) + var(--board-pad) * 0.5))`
(`:265-269`) was derived by real measurement at 360px under Notice Board — a first attempt that bled
only `--posting-pad-x` measured 238px against the 239px six pips need, and wrapped. Re-verify it holds
at **every** resulting column count, in both appearances. Rewrite the `:162-230` comment block to
describe the container-query model rather than deleting it; it is the most load-bearing comment in the
repo, and both prior sessions to touch this file shipped a regression caught only by the full matrix.

---

## Item 6 — `PeekCard` and "The Party" overview

Review item 7: *"the GM live-peek shows 'Potential 0/5' three times with no way to know which Motif
it's about."*

### The literal fix

`PeekCard.tsx:84-86` — label each with its Motif name and read the real track length:

```tsx
{summary.Motifs.map((m, i) => (
  <span key={i}>{m.Name}: Potential {m.Potential} / {library.settings.PotentialTrackLength}</span>
))}
```

`CharacterSummary.Motifs` is `{ Name, Potential }[]` (`logic.ts:112`) and the card already renders
`m.Name` at L24, so the data is there. See correction 2 for the hardcoded `/ 5`.

### The restructure

Give `.card` its own container (`container-name: peek-card`) and split the interior into two columns
above a threshold — identity + virtues on the left, statuses + footer stats on the right — so a GM can
scan one player at a glance instead of reading a tall single column. Approved shape:

```
+----------------------------------------+
| Ember          Ryan                    |
| Wandering Blade . Oathkeeper . Scholar |
+------------------+---------------------+
| Might   +1       | Hurt 2   Braced 1   |
| Mettle  +2       |                     |
| Heart   +0       | Load 3/5  Armor 1/2 |
| Wit     -1       |                     |
| Guile   +1       | Wandering Blade 3/5 |
|                  | Oathkeeper      0/5 |
|                  | Scholar         1/5 |
+------------------+---------------------+
```

Keep the Crumble/Unstable badges and their `InfoTooltip`s exactly as they are.

### Leave `.peekGrid` alone

`CampaignPage.module.css:181-202`'s existing 768px two-column switch and its
`:last-child:nth-child(odd)` centering rule stay, unless the screenshots show the restructured card
reads badly in them. Don't change two layers at once.

---

## Files touched

- `apps/web/src/lib/appearances.ts`, `apps/web/src/store/appearanceStore.ts`,
  `apps/web/index.html`, `apps/web/harness.html`, `appearanceStore.test.ts`,
  `apps/web/src/lib/appearances.test.ts`.
- `apps/web/src/features/sheet/BackgroundPanel.tsx` + new `.module.css`,
  `MotifPanel.tsx` + `.module.css`, `LooksPanel.module.css` (if the shared `board` wrapper moves up),
  `StatusesPanel.tsx` + `.module.css`.
- `apps/web/src/features/campaign/PeekCard.tsx` + `.module.css`.
- `apps/web/src/styles/layout.css` (stale `.sheet-pair` comment, correction 3).
- Docs: `CHANGELOG.md`, `README.md`, `HANDOFF.md`, `CLAUDE.md`, `AppThemeGuidelines.md`,
  four `package.json` files.

---

## Verification

This release is almost entirely CSS, so the automated gate is necessary but nowhere near sufficient.

- `npm run typecheck`, `npm run build`, `npm test`, `npm run bundle-budget -w @asohav/web`
  (220 kB gzip cap; this release should barely move it).
- **`npm run test:responsive -w @asohav/web` — the full matrix, both appearances × 7 viewports × every
  route, after every CSS iteration, not just at the end.** `0.26.0` shipped two regressions in this
  exact panel that only the doubled matrix caught, and the second was introduced by the fix for the
  first. `npx playwright install chromium` first — nothing is installed on this machine
  (`~/AppData/Local/ms-playwright` is empty); this machine has working egress, unlike the sandboxes
  `HANDOFF.md` open issue 5 describes.
- **`npm run screenshot -w @asohav/web` at 360/768/1024/1440/2560, both appearances.** The smoke test
  asserts overflow, touch targets, hit-area overlap and page errors — none of which can see "this panel
  wastes half the screen," which is what four of this release's six items are about. Compare before and
  after; the Parchment set should be unchanged except where item 1 deliberately changes the default.
- Manual: Motif card text is readable under Notice Board (item 2 — this is the one that must not ship
  broken); a fresh browser profile lands on Notice Board; picking Parchment survives a reload; the
  smoke harness still honours `?appearance=`.

Post-merge: confirm the Render deploy reached `live` on service `srv-d9nqoqlaeets73ch25q0` and that the
top entry matches the merge commit — `/api/health` answers `200` from the previous build too. **No
migration in this release**, and `seedLibrary.ts` is untouched, so neither the migration step nor the
library-reset step applies.

---

## Order of work

1. **Item 1** (appearance flip) and **item 2** (Motif readability) together, first — they must ship
   together, and item 2 is the reason. Doing them first also means every subsequent screenshot in this
   release is taken against the real default.
2. **Item 6** (`PeekCard`) — self-contained, small, on a different page. Good second step while the
   screenshot loop is warm.
3. **Item 4** (Background 66/33), then **item 3** (Motif internals) — in that order, because the Motif
   card's own thresholds depend on how wide 66% of the Background panel actually is.
4. **Item 5** (Statuses columns) last. It is the riskiest CSS in the repo, it needs the most matrix
   runs, and nothing else depends on it — so a problem here can't block the rest of the release.
5. Docs and version bump.
