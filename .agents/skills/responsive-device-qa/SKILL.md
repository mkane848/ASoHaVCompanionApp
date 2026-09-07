---
name: responsive-device-qa
description: >
  Verifies that a layout or CSS change in the ASoHaVCompanionApp web app (apps/web)
  actually works across phone, tablet, and desktop before calling it done — running the
  project's Playwright responsive smoke test plus a manual review pass for the class of
  bug that test can't catch (wrong breakpoint choice, a repeated-control row that doesn't
  fit its column at the width it actually renders at). Use this whenever editing a
  .module.css file, apps/web/src/styles/layout.css, adding or resizing an interactive
  control, adding a new CSS breakpoint, or when asked "does this work on mobile," "check
  this is responsive," "will this look right on a phone/tablet," or "test this layout
  change" — even if the user doesn't name the smoke test or mention devices explicitly.
---

# responsive-device-qa

## Why this needs more than "looks fine in devtools"

Every layout bug that has actually shipped in this app followed the same pattern: it
looked correct at the one width someone happened to check, and broke at a width nobody
did. The automated smoke test (`apps/web/scripts/responsive-smoke.mjs`) catches the
*symptoms* — overflow, undersized touch targets, overlapping hit areas — but not the
*reasoning error* that causes them, which is almost always **judging a breakpoint by
viewport width when the actual constraint is a column's rendered width**. Fix the
reasoning, not just the test failure, or the same mistake resurfaces in the next panel.

## Step 1: run the automated smoke test

```bash
npm run test:responsive -w @asohav/web
```

It renders every real route through `apps/web/harness.html` (no server, no Supabase — seed
fixtures) at seven viewports (360/390 phone, 768 tablet portrait, 1024 tablet landscape,
1440/1920/2560 desktop — the 1920/2560 pair added `0.24.0` so a real "1440p monitor"
(2560×1440) is actually tested) **and, as of `0.26.0`, both appearances (Parchment, Notice
Board)** and asserts, per the script's own header: no horizontal overflow, no interactive
element under 44×44 on a touch viewport, no two controls with overlapping hit areas, and no
uncaught page error. The appearance dimension is not a repaint-only concern the structural
checks would pass trivially either way — board padding, posting padding, tilt transforms,
and Notice Board's different font metrics (Cinzel/Zilla Slab vs. Cormorant Garamond/Lora)
all shift real geometry, so a layout change that's clean under Parchment can still overflow
or collide under Notice Board. Narrow a run to one route/viewport/appearance while iterating
with `SMOKE_ROUTE=`/`SMOKE_VIEWPORT=`/`SMOKE_APPEARANCE=` (substring match), e.g.
`SMOKE_ROUTE="character sheet" SMOKE_VIEWPORT=768 SMOKE_APPEARANCE=notice npm run
test:responsive -w @asohav/web` — the full seven-viewport × two-appearance run takes
~25–28 minutes in a typical sandbox (CI splits it into two parallel matrix jobs, one per
appearance, to keep wall-clock time flat — see `.github/workflows/ci.yml`'s `responsive`
job). **When iterating on a single risky layout change, run it under both appearances
before calling it done, not just the one you're actively looking at** — `SMOKE_APPEARANCE=`
narrows to one appearance for speed while you're still figuring out a fix, but the final
check before committing should cover both, the same way you wouldn't skip a viewport just
because the change "obviously" only affects desktop.

If the plain command fails to launch Chromium, this is very likely the sandboxed-CI-like
environment described in CLAUDE.md, not a real regression — retry with:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:responsive -w @asohav/web
```

Run this yourself if you have shell access rather than telling the user to run it — it's
the objective ground truth. Report the exact failing route/viewport lines it prints, not a
paraphrase.

**Two corrections from `0.40.0`, both measured rather than assumed:**

- **`CHROMIUM_PATH` is not a fallback in this sandbox, it is required.** Playwright's pinned
  build (`chromium-1234`) does not match what is on disk (`chromium-1194`), so the plain
  command fails even with `PLAYWRIGHT_BROWSERS_PATH` set — with a "run npx playwright install"
  hint that points at exactly the download this sandbox blocks. Reach for `CHROMIUM_PATH`
  first, not after a confusing failure.
- **The full matrix is not "under a minute" and is not ~25-28 minutes either.** It is now 7
  viewports x 2 appearances x **21** routes = 294 page loads (the route list grew; several
  places in this repo still say 15), and in a single-core sandbox it runs on the order of
  hours — dramatically worse if anything else is running concurrently, which is the single
  biggest factor. Narrow while iterating; run it in full once, uninterrupted, at the end, and
  budget for it rather than assuming it will finish while you keep working.

**The suite cannot see any state that requires interaction to reach.** It loads each route and
measures; it never clicks. So a layout that only exists after a tap — an expander, a revealed
editor, an opened picker — is entirely uncovered, and "the smoke test is green" says nothing
about it. `0.40.0` shipped a Status row whose boxes are revealed by tapping a rank chip, and
the revealed layout reproduced the exact `flex-wrap`-then-overlapping-overlays bug this panel
had already hit once before, through a completely green suite. If you add an interaction-gated
layout, write a throwaway probe that drives the interaction at each phone width in both
appearances and reruns the script's own hit-rect arithmetic (`hitRect`/overlap logic in
`responsive-smoke.mjs`, ~40 lines to copy) — or you are shipping that state unverified.

## Step 2: manual checks the automated test structurally cannot catch

The test only sees the DOM that renders — it has no idea *why* a control ended up a
certain size, so it can't tell you "this will break next time someone edits this," only
"this is broken right now." Check these whenever you touch layout:

### A new interactive control needs its 44×44 target sized on purpose, not by accident

The test will catch it if it's missing, but by then it's a failure to fix under time
pressure instead of a design decision. `--tap-min: 44px` is defined once in
`layout.css` (WCAG 2.5.5 / Apple HIG minimum) — new buttons/inputs/links should size off
it (directly, or via an existing pattern like `.tap-inline`'s `@media (pointer: coarse)`
rule) rather than a fresh literal `44px` and definitely rather than nothing.

### If the changed panel lives inside `.sheet-col` (or any panel at all), reach for a container query, not a viewport breakpoint

As of `0.24.0`, every `Panel` (`Panel.module.css`'s `.panel` class) is a named
container-query container (`container-type: inline-size; container-name: sheet-panel`) —
this is the real fix for the "viewport width is not your width" problem this section used
to only warn about, not a second thing to additionally check. **For any panel-internal
layout decision (a two-up list, a tiers-vs-items split, two sub-boxes sharing a row), write
`@container sheet-panel (min-width: …)` and pick the threshold from the actual content
that needs to fit** (a `Pips` row's coarse-pointer width, a readable prose column) — not
from a viewport number, and not by re-deriving a `.sheet-col`/`.sheet-pair` grid-ratio
calculation by hand the way this codebase used to have to. See
`AbilitiesSkillsPanel.module.css` (two columns at 560px), `LoadPanel.module.css` (tiers |
items at 700px), and `AdvancementPanel.module.css`'s `.tracksRow` (850px) for three worked
examples with the arithmetic shown in each file's own comment.

**One CSS-cascade trap specific to container queries in this codebase's CSS Modules
setup**: a `@container` block and a later plain rule for the same class compile to
equal-specificity selectors, so *source order* decides the winner regardless of whether
the query currently matches — the `@container` override must be declared **after** the
base rule it's meant to override, or the base rule silently wins even when the query
matches. `AbilitiesSkillsPanel.module.css`'s comment above its `@container` block spells
this out; if a container-query override doesn't seem to be taking effect, check ordering
before anything else.

**`StatusesPanel.module.css`'s existing 1024px breakpoint math predates this mechanism
and was deliberately not converted** when the rest of the sheet moved to container
queries — it works, it's heavily commented, and converting a working, hairy layout inside
the same pass as new feature work is exactly how a past regression shipped (see the
`.tap`-overlay section below). Treat it as a worked example of the *old* pattern, not a
template for new code; a real container-query conversion of it is flagged as a follow-up
in `WorkPlan-0.24.0.md`'s "Open items," not done yet.

Viewport media queries are still correct for genuinely **page-level** decisions — how
many columns `.sheet-grid`/`.sheet-pair` themselves have, the app bar, Content Admin's
three-pane layout. The split going forward: **page structure = media query, panel
internals = container query.** The rest of this section (`.sheet-grid`'s two-column
breakpoint, `StatusesPanel`'s worked example) is kept for historical/reference value and
because `StatusesPanel` itself hasn't converted yet — but don't copy its viewport-
media-query pattern into new panel-internal code.

### A row of peer action buttons needs `.action-grid` (`0.25.0`), not `flex-wrap`

`flex-wrap` on content-sized buttons isn't a layout, it's an overflow fallback: each
button is exactly as wide as its own label, so a row breaks wherever labels happen to
run out of room, `justify-content`'s `flex-start` default leaves every wrapped row
ragged-right, and leftover space collects at the right edge of the last line. The tell
is a row of buttons that are all peers of roughly equal importance — the sheet footer
row, Bond actions, Combat's round-action row, Give/Heal Status — as opposed to a row
mixing a flexible input with a button (see the `display: contents` pattern below) or a
chip/tag row where ragged is genuinely correct (roster names, filter chips).

`.action-grid` (`layout.css`) is `display: grid; grid-template-columns: repeat(auto-fit,
minmax(var(--action-min, 150px), 1fr))` — every child gets an equal share and the column
count falls out of the real content width, with no threshold to derive by hand the way a
container query would need. **Check `--action-min` against the row's actual nesting
depth before trusting the 150px default**: a row inside a bare `Panel` reaches two-up
around 360-390px at 150px, but a row inside a `Panel` *plus* another padded wrapper
(`AdvancementPanel.module.css`'s `.bondsBox`, or one level deeper still inside
`.pending`) needs a lower floor — `StatusesPanel.module.css`'s `.actionRow`/
`.resourceRow` and `AdvancementPanel.module.css`'s `.actions` comments show the worked
arithmetic for both cases, found by checking a real screenshot rather than trusted from
the plan that introduced this primitive (`WorkPlan-0.25.0.md`'s stated 150px never
actually reached two-up once a row was nested one level deeper than it accounted for).
**Never apply it to a mixed row** (a flexible-width input beside a button, e.g.
`EndSessionModal`'s Hold-count input + Grant Hold) — a real regression caught only by
screenshot, not by the smoke test: the grid's default stretch expanded a `width: 70px`
input to the row's full column width the moment the row dropped to one column on a
phone. Mixed rows keep the `display: contents` pattern below instead.

### A repeated-control row sharing space with a flexible input needs a real breakpoint, not `flex-wrap`

`flex-wrap` looks like it degrades gracefully but doesn't once one sibling is wide enough
to trigger `flex-basis: 0`'s per-item wrapping instead of moving the whole group as a
unit. The tell: a row mixes a flexible-width text input with a *repeated* control (dots,
pills, a fixed set of buttons) whose combined width is non-trivial. Concretely, six `Pips`
alone claim ~239px on a coarse pointer (each slot padded out to `--tap-min`, not the
~19px painted dot) — enough to starve a name input down to rendering narrower than its own
value.

If you hit this: use a named-grid-area template that explicitly reflows below the
breakpoint (see `StatusesPanel.module.css`'s `.rowHead` — one row `name/rank/remove` +
`pips` alone on the row below, single row again at 1024px) rather than trusting
`flex-wrap`. **Give the repeated-control group a full row to itself when it reflows** —
splitting it across a two-column mobile layout (e.g. "pips | rank" side by side) just
re-triggers the same wrapping problem inside the narrower half-column, and — for `Pips`
specifically — makes its 44px-tall touch overlay reach into whatever sits directly below.

If none of the row's controls are individually wide enough to hit the `flex-basis: 0`
trap (e.g. a handful of ordinary-width fields, not a repeated dot/pip group), the trap
doesn't apply — the simpler fix is `.addRow`'s pattern: a plain `flex-direction: column`
wrapper that flips to `row` above the breakpoint, with the grouped controls wrapped in a
sub-container that switches to `display: contents` to dissolve itself and rejoin the
parent's single-row order. Reach for this first; only reach for the named-grid-area
version when something in the row is actually wide enough to force the issue.

### A new breakpoint value is a signal to double-check your math, not a free choice

This codebase uses two deliberate breakpoints — 600px (general phone/tablet split) and
1024px (used specifically where a panel sits in a narrower-than-viewport container, per
the `.sheet-col` math above). If a change is about to introduce a third value, stop and
verify it against the *container's* rendered width at that point rather than picking
whatever number happens to make the current bug go away — an arbitrary breakpoint is
usually evidence the real constraint (which container, how wide) wasn't identified yet.

## Step 3: report results

Report in this shape — it mirrors how the smoke test already reports, so a failure here
reads the same way a CI failure would:

```
Automated (npm run test:responsive -w @asohav/web): <PASS, or the exact failing lines>
  Appearances covered: <both, or which one — flag if only one was checked>

Manual review:
  [ok|FLAG] 44×44 targets for new/changed controls
  [ok|FLAG] breakpoint choice checked against actual container width (not viewport)
  [ok|FLAG] a peer-action row uses .action-grid, not flex-wrap (and --action-min checked
            against the row's real nesting depth, not assumed from the 150px default)
  [ok|FLAG] repeated-control row given a full reflow row, not split
  [ok|FLAG] no new breakpoint value introduced without container-width justification
  [ok|FLAG|n/a] if a .board/.posting surface was touched, checked under Notice Board where
            the padding/tilt/shadow are actually real, not just under Parchment where they're
            neutral no-ops
```

For anything flagged, name the specific file/selector and what width it actually needs,
the same way `StatusesPanel.module.css`'s own comments do — a flag without the
underlying number isn't actionable.

## Reference files

- `apps/web/scripts/responsive-smoke.mjs` — the automated test itself
- `apps/web/src/styles/layout.css` — `--tap-min`, `.pip-row`, `.sheet-grid`/`.sheet-col`,
  `.action-grid`
- `apps/web/src/features/sheet/StatusesPanel.module.css` — worked examples of the
  named-grid-area reflow (`.rowHead`), the simpler `display: contents` dissolve
  (`.addRow`/`.addControls`), and `--action-min` tuned for a row nested one level deep
  in a Panel (`.actionRow`/`.resourceRow`)
- `apps/web/src/features/sheet/AdvancementPanel.module.css`'s `.actions` — `--action-min`
  tuned for a row nested two levels deep (Panel + `.bondsBox` + `.pending`)
- `apps/web/scripts/harnessConfig.mjs` (`0.26.0`) — shared `APPEARANCES` list consumed by
  both `responsive-smoke.mjs` and `screenshot.mjs`; a new appearance (if one's ever added)
  only needs adding here, not in both scripts
- `apps/web/src/styles/surfaces.css` (`0.26.0`) — `.board`/`.posting`, the primitive whose
  geometry only exists under Notice Board; see CLAUDE.md's "Architecture: appearances"
  section before assuming a Parchment-only check is sufficient for a surface using it
