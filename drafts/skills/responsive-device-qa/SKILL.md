---
name: responsive-device-qa
description: >
  DRAFT — NOT YET IMPLEMENTED. Once finished, this skill should verify that a UI/layout
  change in the ASoHaVCompanionApp web app works across phone/tablet/desktop viewports
  before it's called done — wrapping the existing Playwright responsive smoke test
  (apps/web/scripts/responsive-smoke.mjs) plus a manual-check pass for the things that
  test doesn't catch. Should trigger whenever the user touches a .module.css file, changes
  a breakpoint, adds/resizes a repeated-control row (like Pips) next to a flexible input,
  or asks "does this work on mobile" / "check this is responsive" / "will this look right
  on a phone" — even if they don't name the smoke test directly.
status: draft — TODO, do not install/register yet
---

# responsive-device-qa (DRAFT)

> This is a scaffold, not a working skill. The body below is a TODO outline captured from
> a conversation with the repo owner (2026-08-11) — flesh it out before installing.

## What this skill should do (TODO: turn into real instructions)

- [ ] TODO: Document how to actually run the existing smoke test from this skill —
      `npm run test:responsive -w @asohav/web`, and the sandboxed-environment variant
      `CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:responsive -w @asohav/web`
      (see CLAUDE.md's Commands section for why the plain command can fail in some sandboxes).
- [ ] TODO: Decide whether this skill should just *tell the user to run it* vs. actually
      run it itself and report pass/fail — probably the latter when tool access allows.
- [ ] TODO: Write the manual-check checklist for things the automated test doesn't assert,
      pulled from CLAUDE.md's "Frontend conventions" section:
  - 44×44px minimum touch targets (already enforced by the smoke test, but call out *why*
    a change might still fail this — e.g. adding a new tappable control without checking it)
  - The documented breakpoint-math gotchas that have actually bitten this project before:
    - `StatusesPanel.tsx`'s `.rowHead` two-template grid (600px vs 1024px breakpoint choice,
      why `.sheet-col`'s `minmax(0, 1.5fr)`/`1.7fr` ratio matters more than raw viewport width)
    - `Pips` needing a full row to itself, not sharing a split column with `rank`
    - The `.addRow` / `.addControls` `display: contents` pattern as the simpler alternative
      to a named-grid-area breakpoint, for cases that don't hit the flex-wrap trap
  - General rule to extract: **a panel inside `.sheet-col` cannot assume viewport width is
    its own width past 768px — check the actual column math, not just the viewport.**
- [ ] TODO: Decide the skill's output format — a checklist Claude reports against, or
      something more structured?
- [ ] TODO: Should it also remind the user to test with a real Chromium binary vs. relying
      solely on eyeballing devtools' responsive mode?

## Open questions for the repo owner before finishing this

- Should this skill also flag when a *new* breakpoint is being introduced that doesn't
  match the project's existing 768px/1024px convention?
- Should it be scoped only to `apps/web/src/features/**/*.module.css` or broader?
