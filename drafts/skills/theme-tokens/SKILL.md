---
name: theme-tokens
description: >
  DRAFT — NOT YET IMPLEMENTED. Once finished, this skill should enforce reuse of the
  design tokens in apps/web/src/styles/tokens.css (--ink, --gold, --panel, etc.) instead
  of hardcoded colors/fonts/spacing whenever a .module.css file is created or edited in
  the ASoHaVCompanionApp web app. Should trigger whenever the user writes or edits CSS
  Modules, asks to "update the theme," "add a new color," "style this panel," or
  introduces a literal hex/rgb/hsl value in a stylesheet — even if they don't mention
  tokens or theming explicitly.
status: draft — TODO, do not install/register yet
---

# theme-tokens (DRAFT)

> This is a scaffold, not a working skill. The body below is a TODO outline captured from
> a conversation with the repo owner (2026-08-11) — flesh it out before installing.

## What this skill should do (TODO: turn into real instructions)

- [ ] TODO: Document the core rule from CLAUDE.md: design tokens in
      `apps/web/src/styles/tokens.css` are ported verbatim from the design handoff —
      reuse them rather than hardcoding colors/fonts; if a value repeats and no existing
      token matches, add one rather than writing another literal.
- [ ] TODO: Decide the actual workflow — before writing a color/font value into a
      `.module.css` file, should the skill:
  1. Read `tokens.css` and check if an existing `--*` custom property already matches
     the value being used
  2. If yes, use `var(--token-name)` instead of the literal
  3. If no close match exists, flag it and ask whether to add a new token vs. treat this
     as legitimate per-context variation
- [ ] TODO: Capture the "near-duplicates are often real variation, not drift" judgment
      call from CLAUDE.md — this skill should NOT blindly force every similar-looking
      value into one token. Only genuinely byte-identical repeated values should be
      unified. Point to `CHANGELOG.md` 0.4.2 for what was already judged safe to unify.
- [ ] TODO: Should this also cover the shared stylesheets pattern (`modal.module.css`,
      `buttons.module.css` via CSS Modules `composes: ... from`) — i.e., flag when a new
      component's modal/button styling looks byte-identical to an existing shared class
      but wasn't composed from it?
- [ ] TODO: Decide whether to bundle a script that greps a target `.module.css` file for
      hex/rgb/hsl literals as a first pass, vs. relying on Claude reading the file directly.

## Open questions for the repo owner before finishing this

- Should this skill also touch `apps/web/src/styles/layout.css` conventions (e.g. the
  `--tap-min` 44px touch-target sizing mentioned in CLAUDE.md), or stay scoped to color/
  font tokens only?
