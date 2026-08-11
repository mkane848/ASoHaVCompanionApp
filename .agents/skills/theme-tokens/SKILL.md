---
name: theme-tokens
description: >
  Enforces reuse of the design tokens in apps/web/src/styles/tokens.css (--ink, --gold,
  --panel, the --ink-* opacity stops, etc.) instead of hardcoded colors/fonts whenever a
  .module.css file is created or edited in the ASoHaVCompanionApp web app. Use whenever
  writing or editing CSS Modules, when asked to "update the theme," "add a new color,"
  "style this panel," or when a literal hex/rgb/hsl/named-color value is about to go into
  a stylesheet — even if the user doesn't mention tokens or theming explicitly.
---

# theme-tokens

## The rule

`apps/web/src/styles/tokens.css` is ported verbatim from the design handoff — every color
and font in the app is supposed to trace back to a `--*` custom property there, not a
literal. Before writing a color or font value into any `.module.css` file (new or edited),
resolve it against the existing tokens first. See CLAUDE.md's Frontend conventions
section for the source of this rule.

## Workflow: before writing a literal into a stylesheet

1. **Read `apps/web/src/styles/tokens.css`.** It's short (under 40 lines) — read the whole
   file, don't grep for a guess. Current token groups:
   - Surfaces: `--ground`, `--panel`, `--sidebar`
   - Ink (text/borders): `--ink`, `--ink-on-dark`, plus opacity stops `--ink-75` down to
     `--ink-25` (each is `rgba(42, 32, 26, N)` at a specific alpha — these exist because a
     0.4.2 cleanup pass found the same handful of alpha values hand-written as raw `rgba()`
     literals 30+ times across the codebase)
   - Rules/borders: `--rule`, `--rule-soft`, `--rule-field`
   - Accent: `--gold`, `--gold-dark`, `--gold-tint`, `--gold-line`
   - State: `--danger`, `--danger-tint`, `--danger-line`
   - Type: `--font-display`, `--font-body`, `--font-mono`
2. **Exact or near-exact match exists → use `var(--token-name)`.** Don't write the literal
   even if it's more convenient in the moment (e.g. copy-pasting from another stylesheet
   that itself has a stray literal — fix that stylesheet too rather than propagating it).
3. **No match exists → stop and classify it before writing anything:**
   - **Repeats 2+ times across the codebase already, or is very likely to** (e.g. it's the
     same ink color at a new opacity you can already see a second use-case for) → this is a
     real gap in `tokens.css`. Add a new `--*` custom property there (following the existing
     naming pattern — `--ink-NN` for ink opacity stops, `--<name>-tint`/`-line` for a
     color's soft-fill/border variants) and use it, rather than writing a one-off literal
     the next person will have to notice and clean up later.
   - **Is genuinely a one-off** (a decorative texture gradient, a single-use tint that
     doesn't share meaning with anything else) → a literal is fine. Not everything belongs
     in `tokens.css`. Don't force it into a token just to avoid ever writing a hex code —
     0.4.2 explicitly left 6 of 36 audited literals alone for exactly this reason.
   - **Unsure which of the two** → ask, don't guess silently either way. Flag the value,
     where it's used, and why you're unsure it's shared vs. one-off.

## Judgment call: near-duplicates are often real variation, not drift

This is the part most likely to get overcorrected. Don't treat "these two values are
close" as "these two values should be one token." CLAUDE.md and `CHANGELOG.md` 0.4.2 are
explicit that unifying near-duplicate *patterns* (not raw color literals — component-level
CSS like a button treatment or a label style) is a design decision, not a mechanical
dedup, and three patterns were deliberately left alone after audit: an "eyebrow" uppercase
label style used 40+ times, an outlined "ghost" button pattern, and a card/panel wrapper
pattern — all of which vary in font-size, letter-spacing, or color per context. Read that
changelog entry before proposing a new consolidation; it's the record of what was already
judged safe to unify vs. not, so don't re-litigate the same call from scratch.

The bar for actually merging two things into one shared class/token: **byte-identical**,
not "close enough." If two blocks of CSS match exactly across every consumer, extract the
shared part; if anything differs (size, color, spacing), leave them separate even if it
looks like near-duplication at a glance.

## Shared stylesheets: check `composes: ... from` before writing new component CSS

Two shared stylesheets exist for CSS that's genuinely byte-identical across components,
pulled in via CSS Modules `composes: ... from` rather than redefined per component:

- `apps/web/src/styles/modal.module.css` — the modal shell (backdrop, dialog, head/title/
  subtitle, body, primary/secondary action, textarea)
- `apps/web/src/styles/buttons.module.css` — `.btnPrimary`/`.btnPrimaryFill` (solid dark
  CTA) and `.btnSecondary` (quiet outline treatment)

Before writing a new modal or a new primary/secondary button's styling from scratch,
check whether it matches one of these exactly. If it does, `composes: btnPrimary from
'./buttons.module.css'` (see `modal.module.css`'s own `.primaryAction` for the pattern —
compose the shared part, then add only what's different, like `width`/`margin`/`padding`,
locally). If a new component's button or modal styling looks byte-identical to one of
these but wasn't composed from it, that's worth flagging — it's exactly the kind of
duplication these two files exist to prevent. If it's close but not exact, leave it local;
see the judgment-call section above.

## Also in scope: `--tap-min` sizing

`apps/web/src/styles/layout.css` defines `--tap-min: 44px` (WCAG 2.5.5 / Apple HIG minimum
touch target) once, in the `utilities` layer. New interactive elements (buttons, inputs,
clickable rows) should size their touch target off this token — directly, or via an
existing pattern like the coarse-pointer rules already in `layout.css` — rather than a
fresh literal `44px`. This is the same reuse-a-token principle as colors/fonts, just for
sizing; treat a new hardcoded `44px` in a stylesheet the same way you'd treat a new
hardcoded hex color. (Full responsive-breakpoint reasoning beyond this one property is
`responsive-device-qa`'s territory, not this skill's — don't duplicate that skill's
breakpoint-math guidance here.)

## Report shape

When reviewing or writing CSS, call out token usage the same way a diff review would:

```
Tokens: <ok, or the specific literal(s) found and what they should be>
New token needed: <none, or the proposed --name and where it's used>
Shared stylesheet: <n/a, composed from <file>, or flagged as a possible duplicate of <file>>
```

For anything flagged, name the file/selector and the literal value — a flag without the
specific value isn't actionable.

## Reference files

- `apps/web/src/styles/tokens.css` — the token source of truth
- `apps/web/src/styles/layout.css` — `--tap-min` and the breakpoint tokens
- `apps/web/src/styles/modal.module.css`, `apps/web/src/styles/buttons.module.css` — the
  two existing shared/composed stylesheets
- `CHANGELOG.md` 0.4.2 — what was already judged safe to unify into a token/shared class,
  and what was deliberately left as per-context variation
