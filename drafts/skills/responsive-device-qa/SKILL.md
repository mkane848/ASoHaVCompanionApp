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
fixtures) at five viewports (360/390 phone, 768 tablet portrait, 1024 tablet landscape,
1440 desktop) and asserts, per the script's own header: no horizontal overflow, no
interactive element under 44×44 on a touch viewport, no two controls with overlapping hit
areas, and no uncaught page error.

If the plain command fails to launch Chromium, this is very likely the sandboxed-CI-like
environment described in CLAUDE.md, not a real regression — retry with:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:responsive -w @asohav/web
```

Run this yourself if you have shell access rather than telling the user to run it — it's
the objective ground truth and takes under a minute. Report the exact failing
route/viewport lines it prints, not a paraphrase.

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

### If the changed panel lives inside `.sheet-col`, viewport width is not your width

`layout.css`'s `.sheet-grid` goes two-column at 768px (`minmax(280px, 1fr) minmax(0,
1.5fr)`) and widens the second column's ratio to `1.7fr` at 1024px. That means a panel
sitting in the second `.sheet-col` has roughly **382px of content at a 768px viewport**,
not 768px — it doesn't get comfortably wide until **1024px** (~564px of content). This is
exactly the miscalculation that broke `StatusesPanel.tsx`'s row layout: a breakpoint
chosen at the project's usual 600px phone/tablet split looked right in isolation but
overflowed once actually placed in the narrower column, because the column's own
`minmax()` ratio — not the viewport — was the real constraint.

**Before picking a breakpoint for anything inside `.sheet-col` (or any other
narrower-than-viewport container), compute the container's actual rendered width at each
candidate breakpoint, don't default to the viewport-wide 600px break used elsewhere in
this codebase.** If you're not sure, run the smoke test at 768px first — it will tell you
immediately if the choice was wrong.

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

Manual review:
  [ok|FLAG] 44×44 targets for new/changed controls
  [ok|FLAG] breakpoint choice checked against actual container width (not viewport)
  [ok|FLAG] repeated-control row given a full reflow row, not split
  [ok|FLAG] no new breakpoint value introduced without container-width justification
```

For anything flagged, name the specific file/selector and what width it actually needs,
the same way `StatusesPanel.module.css`'s own comments do — a flag without the
underlying number isn't actionable.

## Reference files

- `apps/web/scripts/responsive-smoke.mjs` — the automated test itself
- `apps/web/src/styles/layout.css` — `--tap-min`, `.pip-row`, `.sheet-grid`/`.sheet-col`
- `apps/web/src/features/sheet/StatusesPanel.module.css` — worked example of both the
  named-grid-area reflow (`.rowHead`) and the simpler `display: contents` dissolve
  (`.addRow`/`.addControls`)
