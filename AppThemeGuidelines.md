# App Theme Guidelines

What "the UI's theme" means in this app, and the ruleset behind the one place it currently
changes dynamically as play progresses: the **parchment damage overlay**. This is not light/dark
mode or any kind of user-facing theme picker — this app doesn't have one. It's a single, specific
piece of environmental storytelling: two sheet panels visibly "take damage" as the character they
represent gets worse off, exactly the way a real, heavily-used book would show wear.

Written as a reference for picking this system back up and refining it — consolidated from the
original design handoff (`Planning Docs/ASoHaVHandoff_extracted/.../Character Sheet Plan.html`)
and the shipped implementation as of `0.20.0`, which match closely but not perfectly (see
"Current inventory" below).

## Philosophy

The handoff's own words, verbatim:

> **The page gets ruined as the character does.** Marked Conditions and negative Statuses
> progressively dirty their own panels — warm blotching, stain, and a roughed-up grain over the
> parchment, as though the book itself is taking the damage. It is the clearest way to make a
> sheet feel authored and lived-in rather than filled out.

That sits inside a longer list of visual principles for the whole app, most of which bear on this
system too:

> **Parchment as a real surface**, not a background colour — a warm, slightly uneven ground with
> subtle tone variation, so panels feel like leaves of the same book rather than cards on a page.
> **Ink as the only mark-making language.** Every track, pip, clock and box is drawn as a pen
> stroke: hollow circles that fill, hairline rules, a marked Condition as a wash bleeding across
> the row. Nothing in the interface should look like a checkbox or a progress bar.

And a second, equally load-bearing principle that specifically constrains how far the damage
effect (or any other texture) is allowed to go — worth reading before adding anything more
literal than the current noise/blotch overlays:

> **Still holding the line on:** No dragons, no wood grain, no torn or burnt edges, no
> faux-leather, no drop shadows pretending to be a physical object on a desk. The distinction:
> **parchment and ink are the medium the characters' stories are written in — they are not a
> costume the UI wears.** Texture earns its place when it makes the writing feel real; it fails
> when it makes the app look like a prop.
>
> The sheet as built uses the restrained version of this. Pushing it further is a small,
> self-contained pass — it is on the list.

That last line is effectively an invitation from the original design pass to do exactly what this
document is for — refining the restrained version that shipped, deliberately, rather than
reaching for literal skeuomorphism (a scorch mark, a torn corner) as the first move.

## Mechanism

Everything lives in three places:

- **`apps/web/src/features/sheet/Panel.tsx`** — the shared panel shell every sheet section renders
  through. Three relevant props, all optional:
  - `grain?: boolean` — applies the global `panel-grain` class (defined in
    `apps/web/src/styles/base.css`, a `repeating-linear-gradient` paper texture). **Static and
    always-on** — this is a permanent decorative treatment, not tied to character state, and is a
    separate concern from the two props below even though today they always travel together (see
    "Current inventory").
  - `damageTier?: 0 | 1 | 2 | 3 | 4` — how damaged this panel currently is.
  - `damageVariant?: 'virtues' | 'statuses'` — which noise/blotch texture to paint. When both
    `damageTier` and `damageVariant` are set and the panel isn't collapsed, `Panel` renders
    `<DamageOverlay tier={damageTier} variant={damageVariant} />` as the **first** child inside the
    panel's positioned wrapper — it has to be first so real content (in a sibling
    `position: relative` block) paints above it; see the comment in `DamageOverlay.tsx` for why.
- **`apps/web/src/features/sheet/DamageOverlay.tsx`** — a single `<div>` per panel with a computed
  `opacity` and a variant-specific `background-image` (`DamageOverlay.module.css`): each of the
  two variants is a hand-authored SVG turbulence-noise data URI layered under several
  radial-gradient "blotches," positioned differently per variant but drawn from the same rust/brown
  palette either way, composited with `mix-blend-mode: multiply` so it reads as staining the
  parchment rather than sitting on top of it. Renders nothing at `tier <= 0`.
- **`packages/shared/src/logic.ts`** — the two pure functions that turn character state into a
  tier, shared so the same math could back a server-side read if that's ever needed:
  ```ts
  // Quantises a raw count into the 4-tier damage scale used for the parchment-damage overlay.
  export function damageTier(rawCount: number, perTier: number): 0 | 1 | 2 | 3 | 4 {
    if (rawCount <= 0) return 0;
    return Math.min(4, Math.ceil(rawCount / perTier)) as 0 | 1 | 2 | 3 | 4;
  }

  export const DAMAGE_TIER_OPACITY = [0, 0.16, 0.31, 0.46, 0.62] as const;
  ```
  `DamageOverlay` interpolates its inline `opacity` style straight from `DAMAGE_TIER_OPACITY[tier]`
  — the only genuinely dynamic value in the whole system; every other visual is a static per-variant
  asset. The 0.62 cap is deliberate, matching the handoff text above almost word for word: a
  badly-off character's sheet has to stay readable.

## Current call sites

Exactly two, both in `apps/web/src/features/sheet/`:

| Panel | `perTier` call | What one tier "costs" |
|---|---|---|
| `VirtuesPanel.tsx` | `damageTier(markedConditionCount(sheet), 1)` | **Every single** marked Condition — there are only 5 Conditions total, so this panel can reach max visual tier (4) after just 4 are marked. |
| `StatusesPanel.tsx` | `damageTier(negativeStatusRankTotal(sheet), 3)` | Every 3 points of accumulated **Negative** Status Rank (as of `0.20.0` — `negativeStatusRankTotal` used to also count Neutral Statuses due to a bug that inflated this panel's damage tier; fixed in the same pass as this document, see `CHANGELOG.md`). |

Both match the handoff's own "How the damage is implemented" text almost exactly ("Marked
Conditions drive the Virtues panel, one tier each. Total negative Status ranks drive the Statuses
panel, one tier per three ranks accumulated.") — this is one of the more faithfully-shipped pieces
of the original design, not a reinterpretation.

## Current inventory — which panels opt in

`CharacterSheetPage.tsx`'s `PANEL_IDS` lists exactly 8 sheet panels. Only 2 currently use any part
of this system:

| Panel | `grain` | `damageTier`/`damageVariant` | `primary` |
|---|---|---|---|
| Virtues | ✓ | ✓ (`virtues`) | ✓ |
| Statuses | ✓ | ✓ (`statuses`) | ✓ |
| Theme | | | ✓ |
| Advancement (Growth) | | | ✓ |
| Load & Item Charges | | | ✓ |
| Looks | | | |
| Abilities & Skills | | | |
| Armor | | | |

Only Virtues and Statuses have a natural "how bad off is this character" count to visualize, which
is presumably why they're the only two — but note `grain` and the dynamic damage system are two
independent booleans/props that today happen to be set on exactly the same two panels every time.
Nothing enforces that pairing; a future panel could opt into static `grain` texture without the
dynamic overlay, or vice versa.

## Open questions for refinement

Not resolved here — flagged for whoever picks this back up next, per the repo owner's request to
consolidate the system before handing it off:

1. **Should any other panel opt in?** Of the 6 plain panels, **Load** is the most obvious next
   candidate — it already has a natural "how bad off is this" number (carried weight vs. capacity)
   that reads a lot like the two existing call sites conceptually, just not wired up.
2. **The system only ever degrades.** There's no positive-visual-reward counterpart — a
   well-rested character with strong Positive Statuses and no marked Conditions looks identical to
   one who's simply never been played, rather than looking *good*. Whether that asymmetry is worth
   addressing (and what it would even look like, given the "not a costume" restraint above) is
   open.
3. **`grain` and the dynamic tier system read as one idea ("this panel is a physical, agable
   object") but are implemented as two unrelated props on `Panel`.** Worth deciding whether to
   unify them under one naming/config scheme (e.g. a single `weathering` prop that implies grain
   and takes the tier/variant) now that there's a real second data point (Virtues, Statuses) to
   design a shared shape from, versus keeping them independent in case a future panel wants one
   without the other.
4. **How far to push the restrained treatment.** The handoff explicitly left this as a "small,
   self-contained pass" for later (see the Philosophy section above) — any refinement should stay
   inside the "not a costume the UI wears" line (no literal torn edges, burns, or drop-shadowed
   physical objects) unless that principle itself is deliberately revisited with the repo owner.
