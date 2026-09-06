# App Theme Guidelines

What "the UI's theme" means in this app. Until `0.26.0` this app had exactly one look
(parchment-and-ink) and one piece of dynamic environmental storytelling layered onto it (the
parchment damage overlay). As of `0.26.0` (`WorkPlan-0.26.0.md`) this app has a **switchable
appearance system** — Parchment and Notice Board — and the damage overlay is gone entirely, from
both appearances. This document is a full rewrite, not an edit: the original text below is kept on
record rather than deleted, because it's still the accurate, still-governing description of
Parchment's own design principles. Notice Board **deliberately reverses** two of Parchment's
stated rules, and that reversal is dated and reasoned here rather than silently overwriting the
line that now reads as wrong for one of the two appearances.

**Notice Board became the default appearance in `0.39.0`** (`WorkPlan-0.39.0.md` item 1) — a
storage-key rename (`asohav.appearance` -> `asohav.appearance.v2`) delivers the one-time forced
reset, with `DEFAULT_APPEARANCE` flipped in `apps/web/src/lib/appearances.ts`. Everything below
this note describing Parchment as the app's original or primary look is a statement about history
(what shipped in `0.26.0`, and remained the default through `0.38.0`), not about what a new player
sees today — both appearances remain fully supported and switchable at any time; this section
governs the design principles behind each, not which one loads first.

## Parchment's governing philosophy (original text, unchanged, still binding for Parchment)

The handoff's own words, verbatim — this was the whole app's design philosophy before `0.26.0`,
and remains Parchment's own:

> **Parchment as a real surface**, not a background colour — a warm, slightly uneven ground with
> subtle tone variation, so panels feel like leaves of the same book rather than cards on a page.
> **Ink as the only mark-making language.** Every track, pip, clock and box is drawn as a pen
> stroke: hollow circles that fill, hairline rules, a marked Condition as a wash bleeding across
> the row. Nothing in the interface should look like a checkbox or a progress bar.
>
> **Still holding the line on:** No dragons, no wood grain, no torn or burnt edges, no
> faux-leather, no drop shadows pretending to be a physical object on a desk. The distinction:
> **parchment and ink are the medium the characters' stories are written in — they are not a
> costume the UI wears.** Texture earns its place when it makes the writing feel real; it fails
> when it makes the app look like a prop.

And the damage overlay's own founding text, kept here as a historical record even though the
mechanism it describes no longer exists in code (see "The damage overlay: what it was, and why
it's gone" below):

> **The page gets ruined as the character does.** Marked Conditions and negative Statuses
> progressively dirty their own panels — warm blotching, stain, and a roughed-up grain over the
> parchment, as though the book itself is taking the damage. It is the clearest way to make a
> sheet feel authored and lived-in rather than filled out.

## Notice Board's reversal (new as of `0.26.0`, dated and reasoned)

Notice Board is a second appearance built on a different metaphor: Statuses, Looks, equipped
Items, and Quests render as papers pinned to a corkboard, not entries in a parchment ledger. Built
from a direct repo-owner brief (`WorkPlan-0.26.0.md`), not a reinterpretation of the original
design doc — Parchment was never intended to be the *only* possible look, and a second appearance
was an explicit, repo-owner-approved product decision, not a designer's unilateral aesthetic call.

Two of Parchment's own stated rules are **deliberately reversed** for Notice Board specifically:

- **"No wood grain"** — Notice Board's `--ground-texture` (`appearances.css`) is a dark,
  deliberately grain-visible worn-plank surface. This is the literal opposite of the Parchment
  rule quoted above, on purpose: a notice board's texture (cork or planked wood) is the medium
  *this* appearance's postings are pinned to, playing the same structural role parchment plays for
  the original appearance.
- **"No drop shadows pretending to be a physical object on a desk"** — `.posting`'s
  `--posting-shadow` (`surfaces.css`) is exactly that: a drop shadow suggesting a piece of paper
  lifted slightly off the board it's pinned to. Same reasoning: the physical-object illusion *is*
  the appearance's whole premise here, not a lapse in restraint.

Both reversals are scoped to Notice Board's own tokens (`appearances.css`) — Parchment's own
`tokens.css` values, and the philosophy quoted above, are completely untouched. `.board`/
`.posting`'s properties resolve to `transparent`/`none`/`0deg` under Parchment specifically so
that this reversal has zero effect there; see `surfaces.css`'s own comment for the mechanism
(and why it's not as simple as "just neutralise the tokens" — a naive version of that would have
silently erased a component's own existing background under Parchment instead of leaving it
alone).

**Everything else about the original philosophy still holds for Notice Board too** — ink as the
mark-making language for pips/tracks/clocks, no literal skeuomorphism beyond the board/posting
metaphor itself (no dragons, no torn edges, no faux-leather), and texture earning its place rather
than becoming a costume. The reversal is narrow and named, not a wholesale abandonment of the
original restraint.

## Architecture

Full technical detail lives in CLAUDE.md's "Architecture: appearances" section — this is the
design-intent summary, not a duplicate of the implementation writeup.

- **Three tiers of token** (`tokens.css` for Parchment, `appearances.css` for Notice Board,
  applied via `:root[data-appearance='noticeboard']`): the existing palette (Tier 1), two texture
  tokens (Tier 2, `--ground-texture`/`--panel-texture`), and new role tokens for the board/posting
  metaphor (Tier 3, `--board-*`/`--posting-*`/`--pin-*`). A token is always defined in *every*
  appearance, even when only one appearance's value does anything visible — the Tier-3 tokens are
  neutral (`transparent`/`none`/`0deg`/`0`) under Parchment, real under Notice Board.
- **`.board`/`.posting`** (`surfaces.css`): the primitives that give a tag-collection container the
  corkboard look and its items the pinned-paper look. Scoped to the character sheet's tag
  collections (Looks, quest chips, Load items, Abilities & Skills entries, Armor entries, Status
  rows) per the plan's decision 3 — everything else in the app gets the token repaint only.
- **`--ink-on-ground`** (`tokens.css`): the one ink token that genuinely flips polarity per
  appearance, for the handful of page-level headings/labels that render straight on the bare page
  background rather than inside a `.panel`. Every other `--ink-*` opacity stop stays meaningful
  unchanged across both appearances, because `.panel`/`.dialog`/`.drawer` all stay a light surface
  in both — see CLAUDE.md for the fuller reasoning and the real, previously-invisible bugs this
  surfaced (Content Admin's list/detail panes, a couple of tint-only callout boxes, unstyled
  `<button>`s picking up the browser's `color-scheme`-aware default).

## The damage overlay: what it was, and why it's gone

Deleted entirely in `0.26.0` (`DamageOverlay.tsx`/`.module.css`, `Panel.tsx`'s `damageTier`/
`damageVariant` props, `packages/shared/src/logic.ts`'s `damageTier()`/`DAMAGE_TIER_OPACITY`) —
per the plan's decision 1, from both appearances, not kept as a Parchment-only feature and not
reskinned for Notice Board. The mechanism (recorded here for history, not because any of it still
exists in code): `Panel` rendered a positioned `<div>` first-child with a computed `opacity`
(`DAMAGE_TIER_OPACITY[tier]`, capped at 0.62) and a variant-specific hand-authored SVG-turbulence
+ radial-gradient background, driven by `markedConditionCount` (Virtues panel, one tier per marked
Condition) and `negativeStatusRankTotal` (Statuses panel, one tier per three ranks of accumulated
Negative Status). Static `grain` (the `panel-grain` class, a faint paper-fiber texture) is a
**separate, still-live concern**, independent of the deleted dynamic system — it's now driven by
`--panel-texture` (Tier 2) so it repaints correctly per appearance instead of being hardcoded in
`base.css`.

The four "Open questions for refinement" that used to close this document (whether another panel
should opt in, whether the system should have a positive-visual-reward counterpart, whether
`grain` and the dynamic tier system should share one naming scheme, how far to push the restrained
treatment) are **removed, not answered** — they were all questions about *how to extend* a system
that no longer exists. If a comparable "the sheet visibly reflects character state" mechanism is
ever wanted again, it starts as new design work informed by this document's history, not as a
continuation of these four questions.
