# Work plan — `0.25.0`

Mobile-device UI cleanup, a player-facing Glossary drawer, and a one-level cap on definition
tooltips. Written from repo-owner testing feedback on a real iPhone (four screenshots: the
Advancement panel's Bond actions and the sheet footer row, a two-deep nested definition bubble,
the Statuses panel's Wealth/Treasure steppers, and the Home campaign tiles), plus a screenshot
audit of all fifteen routes at 390px run while writing this plan.

Planning only — no code lands with this document beyond the document itself.

> **Status: APPROVED by the repo owner (2026-08-14), not yet implemented.** PR 1 below (this
> document) has landed on [PR #92](https://github.com/mkane848/ASoHaVCompanionApp/pull/92). Every
> other item is unstarted. A session picking this up should start at PR 2 and work down the
> "Order of work" checklist, ticking items as they land. The four questions in "Decisions already
> locked" were put to the repo owner and answered — don't re-ask them.
>
> Two questions were raised at approval time and are still open, both noted at the end of "Order
> of work": PR granularity, and the one place this plan changes a design rather than a reflow.

## Decisions already locked

Confirmed with the repo owner before this plan was written:

1. **The Glossary drawer appears on both the character sheet and the Campaign page**, not just
   the sheet. Combat renders inline on the Campaign page, so terms like Toughness and Range have
   to be reachable mid-fight. Not added to the global app bar — that bar is account/navigation
   chrome (About, Sign out), and a game-rules control doesn't belong in it.
2. **The layout sweep covers all fifteen routes**, driven by `screenshot.mjs` at 360/390, not
   only the rows in the four reported screenshots.
3. **A definition bubble becomes a fixed card below 600px** rather than an absolutely-positioned
   bubble that can hang off the right edge of the screen.
4. **A definition lists the other glossary terms it mentions as "See also" chips** that open the
   Glossary drawer at that term — this is what replaces the nested tooltips being removed.

Defaults taken without a specific ask, flagged here so they're easy to veto:

- **Version `0.25.0`** (MINOR — a new player-facing feature plus a notable internal layout
  convention), from `0.24.1`.
- **`MovesDrawer` gains focus-trap/Escape/focus-restore** via the existing `useModalA11y` hook.
  It has none of that today — it's the one dialog-shaped surface in the app that was never
  migrated in `0.19.0`, because it's a drawer rather than a `modal.module.css` modal. The new
  Glossary drawer shares its shell, so fixing both at once is cheaper than fixing neither.
- **A leftover button on a grid's last row is *not* stretched to fill it.** See "The leftover
  cell" under B below — this reverses an off-hand suggestion made while scoping, for reasons
  that only became clear once the arithmetic was worked through.

---

## A — Diagnosis: is the UI using a layout system, and why doesn't it reflow as expected?

**Yes, it uses flexbox — that's the problem, not the absence of one.** There are 63
`flex-wrap: wrap` declarations across 31 stylesheets in `apps/web/src`, and exactly one
`repeat(auto-fit, minmax(...))` grid in the entire app (`HomePage.module.css:22`).

`flex-wrap: wrap` on content-sized children isn't a layout — it's an overflow fallback. Each
button is exactly as wide as its own label, so a row breaks wherever the labels happen to run
out of room, and whatever space is left over collects at the right edge of the last line.
Nothing in that arrangement expresses "these four buttons are peers, distribute them evenly."
The result is exactly what was reported: ragged wrapping with inconsistent spacing.

This is the same root cause `Planning Docs/ResponsiveAudit.md` identified on 2026-08-02 —
"breakpoints land wherever the arithmetic happens to put them, and nobody chose those places" —
but one level down. That audit fixed the **page** layout (real breakpoints, deliberate columns,
a smoke test guarding both). The **row** layout inside a panel was never revisited and still runs
on the original accidental arithmetic.

Three compounding factors make it worse on a phone specifically:

1. **`.tap-row` doubles gaps on a coarse pointer.** `layout.css:120` sets `row-gap`/`column-gap`
   to 16px on touch devices, up from the 6–10px most components declare. That's correct for
   hit-area separation, but it means a row that fits three buttons in the desktop CSS fits two on
   a phone — and the wrap threshold moves without the author ever seeing it.
2. **`justify-content` defaults to `flex-start`.** Every wrapped row is ragged-right by
   construction.
3. **Rigid minimum widths turn "wraps badly" into "wastes a whole row."** `StatusesPanel`'s
   `.resource` is `32px + 6 + 76px + 6 + 32px = 152px` of hard minimum. Two need 320px. A panel
   at a 360px viewport has **276px** of content width (`.sheet-stack` 20px padding each side,
   `Panel` 22px each side — the same number `layout.css`'s `.pip-row` comment already cites). So
   Wealth and Treasure can never share a line, and each leaves ~124px of dead space to its right.

The fix isn't more breakpoints. It's a primitive that states the intent, and one that — unlike a
media query or even a container query — doesn't need to know how wide its container is at all.

---

## B — The `.action-grid` primitive

Add to `apps/web/src/styles/layout.css`, in the `utilities` layer alongside `.tap-row`:

```css
.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(var(--action-min, 150px), 1fr));
  gap: 8px;
}
@media (pointer: coarse) {
  /* Mirrors .tap-row's clearance rule — a grid cell's neighbours are as close
     as a wrapped flex row's, and the buttons carry the same 44px hit areas. */
  .action-grid { gap: 16px; }
}
```

Every child gets an equal share of the row; the column count falls out of the available width
automatically. `--action-min` is per-call-site (a row of two long labels wants a higher floor
than a row of four short ones).

Why `auto-fit` rather than a container query, given `0.24.0` just made every `Panel` a
container: **`auto-fit` needs no threshold at all.** A container query still requires someone to
derive the right px value from the widest label plus gaps plus padding — the exact arithmetic
`StatusesPanel.module.css`'s 1024px comment spends 40 lines justifying, and the exact arithmetic
that has been re-derived and re-checked in three separate versions now. `auto-fit` computes it
from the real content every time. Container queries stay the right tool for *rearranging* a
layout (Abilities & Skills going two-column, Load splitting tiers from items); `auto-fit` is the
right tool for *distributing peers*.

### What this does and does not apply to

**Applies to** — rows where every child is a peer action of the same weight: the sheet footer
row, Bond actions, Combat's round actions, `EndSessionModal`'s answer buttons, Give/Heal Status.

**Does not apply to**:

- **Mixed rows** (a flexible text input beside a button — Home's create-campaign row, Statuses'
  quick-add row, Combat's initiative input). Equal-width cells are wrong here; the input should
  take the slack. These keep the `display: contents` regroup technique already established in
  `0.18.3` (`StatusesPanel.module.css`'s `.addRow`).
- **Chip/tag rows** where ragged is genuinely correct — `CampaignTile`'s roster names,
  `MovesDrawer`'s filter chips, `ThemePanel`'s quest chips. A tag row that force-justified every
  chip to equal width would look worse, not better. These stay `flex-wrap`.
- **Multi-pip rows.** `Pips` has its own hit-area tiling rules; don't put one in an
  `.action-grid` cell without redoing the arithmetic in `layout.css`'s `.pip-row` comment.

### The leftover cell

While scoping this I suggested that a button left alone on the last row should stretch to fill
it. Working it through, that's not implementable as a sane default, and the plan is to **not do
it**:

A CSS-only "is this item alone on the last row" test doesn't exist. `:last-child:nth-child(odd)`
only works if the grid happens to have exactly two columns — but the whole point of `auto-fit` is
that the column count varies with width, so the same rule that tidies a phone would wrongly
stretch a button on a desktop where all three already fit on one line.

The plain `auto-fit` result is already a large improvement: every button is the same width, left
and right edges align into columns, and gaps are uniform. A trailing empty half-cell reads as
grid rhythm, not as raggedness — which is precisely what the current ragged-right wrapping does
*not* do.

An explicit `--span-all` modifier (`grid-column: 1 / -1`) stays available for the small number of
places where a full-width primary action is a deliberate emphasis choice at *every* width, not a
reflow artifact. Used sparingly and named at the call site, never applied automatically.

---

## C — The site-by-site sweep

From the 390px screenshot pass over all fifteen routes, plus the four reported screenshots.
Ordered roughly by how bad it looks.

### C1 — Combat's header row (worst instance in the app)

`EncounterView.tsx:337` `.headerRow` is a single `flex-wrap` row carrying: two status readouts
(Round, Acting), a "Toggle Acting Side" button, an "Initiative (2d6)" label, a number input, and
four more buttons. At 390px this wraps into four ragged lines, ending with "Add Participant"
alone on its own row with ~220px of dead space beside it.

This isn't a peer row that needs a better wrap rule — it's **three logical groups crammed into
one container**. Split it:

- a status readout line (Round, Acting side),
- an initiative sub-group (label + input + roll button — a mixed row, so `display: contents`),
- an `.action-grid` of round actions (Toggle Acting Side, Next Round, End Combat, Add
  Participant).

### C2 — Statuses: Wealth, Treasure, Recoveries

`.resource` becomes **label above stepper** instead of `[−] Wealth 0 [+]`. This fixes two things
at once: the arithmetic (a stepper row is `32 + 6 + value + 6 + 32 ≈ 100px`, comfortably inside
the ~130–145px an `.action-grid` cell gets at 360–390px, where the current 152px minimum can
never fit two up), and a small oddity in the current design — the *value* currently lives inside
the label ("Wealth 0"), reading as part of the name rather than as the number the two buttons
change.

`Recoveries 0 / 6` moves out of `.actionRow`'s `margin-left: auto` — which is what strands it on
its own right-aligned line today — and becomes a third read-only cell in the same grid. It has no
`+`/`−` (Recoveries are spent by healing a Status, not adjusted directly), so it renders as a
labelled readout in a matching cell.

The `Give a Status…` / `Heal a Status…` pair above becomes its own two-cell `.action-grid`.

### C3 — Bond actions

`AdvancementPanel.module.css`'s `.actions` (three buttons: Propose +1 Kin, Spend a Kin, Propose
Forge) → `.action-grid` with `--action-min: 150px`. Two up at 390px, three up on desktop. Same
change for the same-shaped rows in `CampaignBonds.tsx:115` and `EndSessionModal.tsx`'s five
`.buttonRow` instances.

### C4 — The sheet footer row

`CharacterSheetPage.tsx:167` — four ghost buttons (End the Session, Export JSON, Import JSON,
Fold all) currently wrap 2+2 at two different widths per row. `.action-grid` gives a clean 2×2 on
a phone and 4-across on desktop. The `.saveNote` span moves to its own line
(`grid-column: 1 / -1`) rather than competing for a cell.

### C5 — The section nav clips mid-word

Visible in two of the four reported screenshots: "GROWT", cut off at the right edge. This is
`layout.css:444`'s deliberate below-768px horizontal scroll strip working as designed — but with
no affordance that it scrolls, a label sliced mid-word just reads as broken. Add a right-edge
fade mask (and matching left-edge fade once scrolled) so the strip is visibly continuable, plus
trailing scroll padding so the last item can never rest half-clipped.

### C6 — Campaign tile footer

`CampaignTile.module.css`'s `.footer` uses `justify-content: space-between` with `flex-wrap`,
which throws "Last played 8/13/2026" and "Open campaign" to opposite ends of a wide gap. Below
600px, stack: date on its own line, button full width. The roster chips above it stay
`flex-wrap` — see "chip/tag rows" in B.

### C7 — Everything else the audit turns up

The 390px pass is written; a 360px pass and a per-route triage happen at the top of
implementation. Routes not yet examined closely: `create character`, `content admin`, the
archived variants, `home (pending invite)`. Findings get appended to this section rather than
handled silently, so the diff has a stated scope.

**360px triage (implementation session, after C1-C6 landed):** ran `screenshot.mjs` at 360px
across all fifteen routes and read every one. `create character`, `content admin`, `login (signed
out)`, `home (pending invite)`, `campaign (archived)`, and `character sheet (archived)` — the six
not previously examined — are all clean; no ragged wrapping, no wasted space, nothing needing a
row-level fix. The only thing this pass turned up was confirmation of the already-scoped C5 nav-
clipping bug (`character sheet (archived)`'s section-nav strip cuts "Advancement" to "GRO" with no
scroll affordance, same as the two originally reported screenshots) — not a new finding, just
verification it still reproduces ahead of fixing it in item 6.

One cosmetic note, not a fix: on `combat (active encounter, GM)` and `campaign (…, active
encounter)` at 360px, the "Toggle Acting Side" round-action button wraps its label to two lines
inside the `.action-grid` cell (`--action-min: 130px` isn't quite wide enough for "TOGGLE ACTING
SIDE" at a 2-up column width). The button still meets the 44px touch target (it grows taller to
fit two lines) and nothing overflows or clips — left as-is rather than raising `--action-min`
further, which would only shrink how many columns fit on narrower phones for a cosmetic gain.

---

## D — The Glossary drawer

New player-facing reference, modelled directly on `MovesDrawer`.

**New files**

- `apps/web/src/components/GlossaryDrawer.tsx` — in `components/`, not `features/sheet/`, since
  it's rendered from two surfaces.
- `apps/web/src/styles/drawer.module.css` — the drawer shell (scrim, panel, sticky head, title,
  close button, body), extracted from `MovesDrawer.module.css` and pulled into both via
  `composes: ... from`. Per the convention in CLAUDE.md, **only the byte-identical properties
  move**; anything that differs stays local. That identity gets verified against the real files
  during implementation rather than assumed here.
- `apps/web/src/store/glossaryUiStore.ts` — `open`, `initialTermId`, `query`. Its own store
  rather than an addition to `sheetUiStore`, because the Campaign page is not the sheet.

**Contents.** `library.glossary` (14 terms seeded; the live library may carry more), flat
alphabetical by `Name`, with the same search input `MovesDrawer` uses. No filter chips —
`GlossaryTerm` has no category field, and 14 entries don't need grouping. Letter headers can come
later if the list grows.

**Definitions inside the drawer render as plain text plus "See also" chips**, same rule as the
tooltips (E below) — a drawer full of nested tap-to-reveal bubbles would reintroduce exactly the
problem this version is removing. In the drawer, a "See also" chip scrolls to that term within
the list instead of opening anything.

**Triggers.** Sheet: beside "Moves" in the sticky header (`CharacterSheetPage.tsx:124`).
Campaign: in the banner action area (`CampaignPage.tsx:69`).

**Accessibility.** Both drawers get `useModalA11y` plus `role="dialog"`, `aria-modal="true"`,
`aria-labelledby`, `tabIndex={-1}` — matching all 13 existing modals. The hook's open-dialog
stack means Escape closes the drawer without also closing a modal underneath it.

**Bundle.** Small enough not to need `React.lazy` (a search box and a list over data already in
the `library` query), so it doesn't reopen the `0.19.0` code-split question. Worth a re-check
against the build output before merge, since `CampaignPage` is a route every player loads.

---

## E — Definition tooltips: one level deep

### The bug behind the reported behaviour

`packages/shared/src/glossary.ts:25` sets `MAX_DEPTH = 1`, and `linkifyText` guards on
`depth > MAX_DEPTH`. The intent was "one nested level allowed" — which is what the reported
screenshot shows.

But `GlossaryText.tsx:81` passes a **hardcoded `1`** into every nested definition instead of
`depth + 1`. The counter therefore never increments, `depth > MAX_DEPTH` is never true inside a
definition, and nesting is **unbounded** — not capped at two. Kin → Bond → Kin → … can be
stacked as deep as a player is willing to tap. So the report is both a design complaint (two is
too many) and a real defect (two was never the actual ceiling).

### The fix

1. **`packages/shared/src/glossary.ts`** — set `MAX_DEPTH = 0`, and change the past-depth early
   return so it still runs `scanExplicitTags` and flattens the result to plain text. That second
   half matters: today the early return is `return [{ text }]`, so a definition authored with
   `0.24.0`'s explicit `[display][id]` tag syntax would leak raw bracket syntax into the bubble
   the moment it stopped being linkified.
2. **`apps/web/src/components/GlossaryText.tsx`** — `DefinitionText` renders segment text only.
   Also pass `depth + 1` rather than a literal, so the latent counter bug is gone regardless of
   what `MAX_DEPTH` is set to later.
3. **"See also" chips** below the definition body: the distinct terms that definition mentions
   (deduped, excluding itself), each opening the Glossary drawer at that term via
   `glossaryUiStore`. `linkifyText` already returns exactly this information in its segments, so
   no new matching logic is needed.

### Tests

`packages/shared/src/glossary.test.ts:58-60` asserts the current depth boundary and will need
updating. Add coverage for the tag-flattening behaviour, which is new and is the part most likely
to regress silently.

---

## F — The bubble hangs off the right edge

Visible in the reported screenshot: the second bubble is clipped by the viewport. `.bubble` is
`position: absolute; left: 0; max-width: min(280px, 80vw)`, so any linked word near the right
margin puts its bubble partly off-screen. **Capping depth reduces this but does not fix it** — a
single bubble on a word near the right edge clips the same way.

The responsive smoke test cannot catch this: bubbles only exist after a tap, and the test asserts
against the page at rest.

**Plan:** below 600px the bubble becomes a fixed card spanning the content width, vertically
positioned from the trigger's measured rect (a `--bubble-top` custom property set on open, ~15
lines inside `useTapReveal`, which both `GlossaryText` and `InfoTooltip` already share). Keeping
it next to the word rather than pinning it to the bottom of the screen matters for reading — the
definition explains *that* word, and a bottom sheet breaks the connection.

If the measured position proves janky under iOS Safari's scroll/URL-bar behaviour, the fallback
is a plain bottom sheet (`position: fixed; left/right/bottom: 0`), which needs no measurement at
all. That call gets made against a real screenshot, not in advance.

`InfoTooltip.module.css` carries the same bubble pattern and gets the same treatment — the Armor
`i` triggers in the reported Statuses screenshot sit close to the right edge for exactly the same
reason.

**Test coverage:** propose adding one smoke-test case that opens a bubble on the rightmost linked
term and asserts it stays inside the viewport, so this class of bug stops being invisible to CI.

---

## Order of work

Each lands as its own PR, verified before the next begins. **Tick these as they land** — this is
the resume point for a session picking the plan up.

- [x] **1. Docs** — this work plan. *(landed, PR #92)*
- [x] **2. `.action-grid` primitive** — `layout.css` + the convention documented in CLAUDE.md's
  "Frontend conventions".
- [x] **3. Sheet rows** — footer row, Statuses action/resource rows, Bond actions (C2, C3, C4).
  Shipped with two deviations from this document, both checked against real screenshots rather
  than assumed: `--action-min` is 130px, not the stated 150px, since 150px never reached two-up
  once a row sat inside a Panel's own padding; and EndSessionModal's Hold-count input + Grant
  Hold row stayed a plain flex row rather than `.action-grid`, since it's a mixed row (fixed-
  width input beside a button) — the exact shape section B excludes.
- [x] **4. Combat header restructure** (C1).
- [x] **5. Sweep** — the 360/390 triage across the remaining routes (C7), plus C6.
- [x] **6. Section nav scroll affordance** (C5).
- [ ] **7. Drawer shell extraction + `useModalA11y` on `MovesDrawer`.**
- [ ] **8. `GlossaryDrawer` + both triggers** (D).
- [ ] **9. Depth cap + "See also"** (E) — shared logic and tests first, then the web wiring.
- [ ] **10. Bubble positioning** (F), including the new smoke-test case.
- [ ] **11. Paperwork** — version bump ×4, CHANGELOG, README judgment calls, HANDOFF, skill
  updates.

Steps 2–6 and 7–10 are independently shippable; if this needs to land in two passes, the layout
work and the glossary work are a clean seam.

### Two open questions from approval

Raised with the repo owner when the plan was approved, not yet answered. Neither blocks starting
at PR 2, but both want an answer before the work is far along:

1. **Is eleven PRs the right granularity?** `0.24.0` shipped nine planned PRs as one squashed
   commit, which the thirty-first session flagged as a real traceability gap on a `main` with no
   required status checks (open issue 7). Eleven separate PRs is the opposite extreme for a solo
   maintainer to review. A middle option is one PR per numbered group with a commit per item.
2. **Is the `.resource` restructure in C2 wanted?** It is the one place this plan changes a
   *design* rather than how something reflows — the label moves above the stepper and the value
   moves out of the label (`[−] Wealth 0 [+]` becomes a `Wealth` label over a `[−] 0 [+]` row).
   The layout arithmetic in C2 depends on it; if the current arrangement is preferred, Wealth and
   Treasure cannot share a line at 360px and that row needs a different answer.

## Verification and paperwork

Per `.claude/skills/release-reliability-checklist` and `responsive-device-qa`:

- `npm run typecheck`, `npm run test` (211 tests today, plus the new glossary cases) on every PR.
- **Full** `npm run test:responsive` (7 viewports × 15 routes, ~12–14 minutes in this sandbox)
  on anything touching layout — `CHROMIUM_PATH=/opt/pw-browsers/chromium`, since
  `playwright install` is blocked here. `SMOKE_ROUTE=`/`SMOKE_VIEWPORT=` for iteration, but never
  as the final check.
- `npm run screenshot -w @asohav/web` before and after each layout PR at 360/390, as the evidence
  that a row actually got better — the smoke test asserts no overflow, no small targets, and no
  overlapping hit areas, none of which can tell "tidy" from "ragged."
- Version `0.25.0` across all four `package.json` files, a CHANGELOG entry with a full UTC
  timestamp, tag the merge commit `v0.25.0`.
- CLAUDE.md needs the `.action-grid` convention added to "Frontend conventions"; the
  `responsive-device-qa` skill needs it too, since that skill's manual-review pass is exactly
  where "should this be a grid?" belongs. README gets judgment-call entries for the `auto-fit`
  vs. container-query split and the glossary depth cap.

## Open items

- **`StatusesPanel`'s 1024px media query is still un-converted** to a container query — flagged
  as a follow-up in `0.24.0` and still outstanding. Some of it may become moot once `.resource`
  and `.actionRow` are grids; `.rowHead`'s named-area template almost certainly won't. Not
  bundled into this version's feature work, same reasoning as last time.
- **Whether Combat's `Encounter.History` should move into `HistoryModal`** — recorded as an open
  question in `WorkPlan-0.24.0.md` and untouched here.
- **The Glossary drawer has no admin-side counterpart concern** — Content Admin already has full
  glossary CRUD; this is purely a player-facing read surface, and no schema or API change is
  needed anywhere in this plan. `0.25.0` touches no migrations, no routes, and no wire shapes.
