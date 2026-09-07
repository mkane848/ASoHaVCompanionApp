---
name: theme-tokens
description: >
  Enforces reuse of the design tokens in apps/web/src/styles/tokens.css — colors and fonts
  (--ink, --gold, --panel, the --ink-* opacity stops) and, as of 0.40.0, the type and spacing
  scales (--fs-*, --track-*, --sp-*) — instead of hardcoded literals whenever a .module.css
  file is created or edited in the ASoHaVCompanionApp web app. Use whenever writing or editing
  CSS Modules, when asked to "update the theme," "add a new color," "style this panel," or when
  a literal hex/rgb/hsl/named-color, px font-size, letter-spacing or gap value is about to go
  into a stylesheet — even if the user doesn't mention tokens or theming explicitly.
---

# theme-tokens

## The rule

`apps/web/src/styles/tokens.css` is ported verbatim from the design handoff — every color
and font in the app is supposed to trace back to a `--*` custom property there, not a
literal. Before writing a color or font value into any `.module.css` file (new or edited),
resolve it against the existing tokens first. See CLAUDE.md's Frontend conventions
section for the source of this rule.

**As of `0.26.0` there are two palettes, not one.** `tokens.css` defines Parchment's values
on bare `:root`; `apps/web/src/styles/appearances.css` redefines the same token names under
`:root[data-appearance='noticeboard']` for Notice Board. Every token that exists must have a
value in *both* files — a token defined only in `tokens.css` silently falls through to
nothing (or an inherited value that happens to look plausible) under Notice Board, and the
gap won't show up as a build error, only as a wrong color once someone actually switches
appearances. If you add a new token, add it to `appearances.css` in the same commit, even if
Notice Board's value is deliberately a no-op (`transparent`, `none`, `0deg` — see
`tokens.css`'s Tier-3 block for what a neutral value looks like for a non-color property).
See CLAUDE.md's "Architecture: appearances" section for the full three-tier breakdown (Tier
1: existing palette/fonts: Tier 2: texture gradients; Tier 3: `--board-*`/`--posting-*`/
`--pin-*` role tokens) and why `.posting` specifically can't just use neutralized tokens the
way everything else does — cascade-layer priority means a neutral value in the `utilities`
layer still wins over a component's own background in the `components` layer, so `.posting`
splits into an unconditional-safe base rule plus an appearance-scoped override instead.

**As of `0.40.0` the rule covers size, not just color.** Until then `tokens.css` had no
dimensional tokens at all beyond three content widths, so "reuse a token" simply didn't apply to
a font-size or a gap — and that is precisely where drift collected: **19 distinct px font sizes
in the sheet feature alone**, a third of them half-pixel (`9.5`/`10.5`/`11.5`/`12.5`/`13.5`), and
11 different `letter-spacing` values across ~44 uppercase micro-labels that had no reason to
differ from one another. A literal `font-size: 12.5px` is now the same kind of finding this skill
already flags a literal `#7d6127` for.

The scales:

- **Type**: `--fs-label` (11px, uppercase micro-labels) / `--fs-meta` (12, hints and secondary) /
  `--fs-body` (13, content and chip text) / `--fs-lead` (15, the primary thing in a row — a Status
  name, a Motif name) / `--fs-title` (18, sub-headings) / `--fs-display` (23, panel headings).
- **`--fs-input` (16px)** is not a step on that scale and is not a style choice: iOS Safari zooms
  the whole page when a focused text control is under 16px. `layout.css` applies it globally under
  `(pointer: coarse)` from the `utilities` layer, which outranks any component's own `font-size` —
  so don't try to "fix" a control that looks larger than its neighbours on a touch viewport by
  setting a smaller size on it. That is the rule working.
- **Tracking**: `--track-label` (0.1em, the uppercase micro-label recipe) / `--track-tight`
  (0.02em).
- **Spacing**: `--sp-1` 4px / `--sp-2` 8 / `--sp-3` 12 / `--sp-4` 16 / `--sp-5` 20 / `--sp-6` 28.

**A repeated *combination* belongs in `apps/web/src/styles/typography.module.css`, not restated.**
`.label`, `.sectionLabel`, `.hint` and `.leadText` exist so a panel composes the role
(`composes: label from '../../styles/typography.module.css'`) instead of re-deriving
size + tracking + transform + color for the forty-fifth time. Override one property at the call
site when a role needs a different color; don't copy the recipe.

Two literals that are still correct, so don't flag them: a **hit-area** number derived from
`--tap-min` (44px and the arithmetic around it — see `.pipsCell`/`.rowHead` in
`StatusesPanel.module.css`), and a **container-query threshold**, which is a measured property of
real content and cannot come from a scale. Both should carry a comment explaining the derivation;
if one doesn't, that's the finding, not the literal itself.

## Workflow: before writing a literal into a stylesheet

1. **Read `apps/web/src/styles/tokens.css`, then check `appearances.css` for the same
   token name.** `tokens.css` is short (under 40 lines pre-`0.26.0`, longer now with the
   Tier-2/Tier-3 additions) — read the whole file, don't grep for a guess. Current token
   groups:
   - Surfaces: `--ground`, `--panel`, `--sidebar`
   - Ink (text/borders): `--ink`, `--ink-on-dark`, `--ink-on-ground` (`0.26.0` — the one ink
     token that actually flips polarity per appearance; see CLAUDE.md before reaching for it
     — it's for page-level text rendered straight on the bare ground, not inside a
     `.panel`/`.dialog`/`.drawer`, which stay a light surface in both appearances), plus
     opacity stops `--ink-80` down to `--ink-04` (each is `rgba(42, 32, 26, N)` at a specific
     alpha under Parchment, a different base color under Notice Board — these exist because a
     0.4.2 cleanup pass found the same handful of alpha values hand-written as raw `rgba()`
     literals 30+ times across the codebase)
   - Rules/borders: `--rule`, `--rule-soft`, `--rule-field`, `--gold-line-soft`,
     `--on-dark-line`
   - Accent: `--gold`, `--gold-dark`, `--gold-tint`, `--gold-line`, `--gold-fade`
   - State: `--danger`, `--danger-tint`, `--danger-line`, `--positive`, `--positive-tint`,
     `--positive-line`
   - Overlay/shadow: `--scrim`, `--shadow-tint`, `--shadow-pop`
   - Texture (`0.26.0`, Tier 2): `--ground-texture`, `--panel-texture` — the gradient(s)
     behind `body` and `.panel-grain` respectively, real values in both appearances rather
     than hardcoded in `base.css`
   - Board/posting (`0.26.0`, Tier 3): `--board-*`/`--posting-*`/`--pin-*` — neutral
     (`transparent`/`none`/`0deg`/`0`) under Parchment, real under Notice Board; see
     `surfaces.css` and CLAUDE.md before adding to this group, the safety constraint is
     non-obvious
   - Type: `--font-display`, `--font-body`, `--font-mono`
   - Layout (`0.24.0`): `--content-max`, `--content-max-wide`, `--content-form` — a page's
     content-width *intent*, applied via `layout.css`'s `.page-shell`/`.page-shell-wide`/
     `.page-shell-form` utilities rather than a private per-page `max-width` literal. If a
     new top-level page needs a width, pick one of these three rather than writing a new
     number — see `layout.css`'s "Page shell" comment for which intent fits which kind of
     page.
2. **Exact or near-exact match exists → use `var(--token-name)`.** Don't write the literal
   even if it's more convenient in the moment (e.g. copy-pasting from another stylesheet
   that itself has a stray literal — fix that stylesheet too rather than propagating it).
3. **No match exists → stop and classify it before writing anything:**
   - **Repeats 2+ times across the codebase already, or is very likely to** (e.g. it's the
     same ink color at a new opacity you can already see a second use-case for) → this is a
     real gap in `tokens.css`. Add a new `--*` custom property there (following the existing
     naming pattern — `--ink-NN` for ink opacity stops, `--<name>-tint`/`-line` for a
     color's soft-fill/border variants) and use it, rather than writing a one-off literal
     the next person will have to notice and clean up later. **Also add the same token name
     to `appearances.css`** in the same change — a Parchment-only token is exactly the gap
     described above, and it won't fail typecheck or build, only render wrong the first time
     someone actually switches to Notice Board.
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
Defined in both appearances: <n/a (no new token), ok, or which of tokens.css/appearances.css
                                is missing it>
Shared stylesheet: <n/a, composed from <file>, or flagged as a possible duplicate of <file>>
```

For anything flagged, name the file/selector and the literal value — a flag without the
specific value isn't actionable.

## Reference files

- `apps/web/src/styles/tokens.css` — Parchment's token values, the source of truth for
  token *names*
- `apps/web/src/styles/appearances.css` (`0.26.0`) — Notice Board's values for the same
  token names, plus the two texture/board/posting tiers that only exist because of it
- `apps/web/src/styles/surfaces.css` (`0.26.0`) — `.board`/`.posting`, the one place a
  primitive can't just use neutralized tokens the naive way; its own comment explains why
- `apps/web/src/styles/layout.css` — `--tap-min` and the breakpoint tokens
- `apps/web/src/styles/modal.module.css`, `apps/web/src/styles/buttons.module.css` — the
  two existing shared/composed stylesheets
- `CHANGELOG.md` 0.4.2 — what was already judged safe to unify into a token/shared class,
  and what was deliberately left as per-context variation
- CLAUDE.md's "Architecture: appearances" section — the full mechanism writeup this skill
  only summarizes
