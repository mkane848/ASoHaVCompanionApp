# Appearances

A switchable UI look — Parchment and Notice Board — not a game concept. Always "Appearance", never "Theme": `CharacterSheet.Theme` is an existing game concept and reusing the word would make `grep -rn theme` useless.

_Part of `docs/architecture/`. Index: [`docs/architecture/README.md`](README.md). The invariants a session must not violate stay in `CLAUDE.md`; this file is the detail behind them._

---

## Architecture: appearances — a switchable UI look, not a game concept (`0.26.0`)

`WorkPlan-0.26.0.md`, approved by the repo owner before implementation: the app has two
switchable **appearances** — Parchment (the only look before `0.26.0`, and the default through
`0.38.0`) and Notice Board (a dark corkboard-and-pinned-paper metaphor). **Notice Board became the
default in `0.39.0`** (`WorkPlan-0.39.0.md` item 1) — see the "Default flip" note near the end of
this section for how. **Always "Appearance," never "Theme"**
in code or UI copy — `CharacterSheet.Theme`/`ThemePanel.tsx`/`library.themes` are an existing game
concept (a character's narrative Theme), and naming the UI concept the same word would make
`grep -rn theme` useless in a repo whose working convention is "read the code before changing it."
See `../decisions.md` item 27 for the full naming writeup.

**Three tiers of token**, all defined in both `apps/web/src/styles/tokens.css` (Parchment) and
`apps/web/src/styles/appearances.css` (`:root[data-appearance='noticeboard']`, same `tokens`
cascade layer — its higher selector specificity outranks plain `:root` on the same element with no
separate cascade layer needed):
- **Tier 1** — the existing palette (colors, `--font-display`/`--font-body`). Notice Board's own
  values live entirely in `appearances.css`; `tokens.css` itself only gained an explicit
  `color-scheme` and the new `--ink-on-ground` token (below).
- **Tier 2** — `--ground-texture`/`--panel-texture`, so `base.css` no longer hardcodes the
  parchment gradients directly.
- **Tier 3** — `--board-*`/`--posting-*`/`--pin-*`, consumed by `.board`/`.posting`
  (`apps/web/src/styles/surfaces.css`, `@layer utilities` — the same layer as `.action-grid`/
  `.tap`, so the decoration reliably outranks a component's own rules without `!important`).

**The rule this establishes: a new token is defined in every appearance, never only in the one
being worked on.** A token defined in just one appearance is the new version of the hardcoded
literal `theme-tokens`'s skill already exists to prevent — Notice Board's Tier-3 values are
neutralised (`transparent`/`none`/`0deg`/`0`) under Parchment specifically so a `.board`/`.posting`
element renders exactly as it did before either class existed.

**`.posting`'s background/border/padding are *not* plain unconditional tokens, unlike everything
else here** — see `surfaces.css`'s own comment for the full reasoning. The items it decorates (a
Looks chip, a Load item row, a Status row, …) already have their own component-authored
background/border/padding, and the `utilities` layer already outranks `components` by design — a
naive `.posting { background: var(--posting-bg); }` with Parchment's value neutralised to
`transparent` would still *win* the cascade and silently erase the item's real background instead
of leaving it alone. The fix: only the properties genuinely inert at their neutral value (tilt,
drop shadow, a new pin pseudo-element) live in an unconditional `.posting` rule; background/
border/padding are scoped to `:root[data-appearance='noticeboard'] .posting`, so that rule simply
doesn't exist for Parchment's cascade to contend with. `.board` doesn't need this split — every
container it's applied to (a bare flex/grid wrapper like `.chips`) has no background/border/
padding of its own to lose.

**Tilt is a per-call-site opt-in** (a `.tilt` class alongside `.posting`), varied deterministically
via `:nth-child(4n+1…4)` — never `Math.random()`, so `npm run screenshot`'s before/after comparison
stays reliable — and capped at 1.5°. On for chip-shaped items (Looks, quest chips, Load items,
Abilities & Skills entries, Armor entries); **off** for `StatusesPanel`'s full-width interactive
rows, per the plan's own carve-out — `getBoundingClientRect()` reports the *transformed* box, and a
tilted row is worse to actually use, not just riskier to lay out.

**`--ink-on-ground`** (`tokens.css`) is the one ink token that genuinely flips polarity per
appearance (`--ink` under Parchment, `--ink-on-dark` under Notice Board) — every other `--ink-*`
opacity stop stays meaningful unchanged, because `.panel`/`.dialog`/`.drawer` all stay a light
surface in both appearances (Notice Board's ground goes dark; its panels don't). Apply it
explicitly wherever text renders straight on the bare page background instead of inside a
`.panel`/`.dialog`/`.drawer` — a real, previously invisible class of UI (`HomePage`'s greeting,
every top-level page's own title, `SectionHead`'s "The party"/"Combat", `CharacterSheetPage`'s
sticky-bar identity, `App.tsx`'s loading screens) that Parchment's near-identical `--ground`/
`--panel` values had been silently papering over the whole time, long before this appearance
system existed to expose it.

**Two more real, previously invisible bugs surfaced by Notice Board's genuinely dark ground, both
fixed for both appearances rather than patched only for Notice Board:**
- `layout.css`'s `.admin-pane` (Content Admin's list/detail panes) never had its own background —
  always relied on the page ground showing through, indistinguishable from real panel chrome only
  because Parchment's `--ground`/`--panel` happen to be nearly the same pale cream. Now explicit
  `--panel`.
- Any unstyled `<button>` fell back to the UA stylesheet's `color: buttontext`, which is
  `color-scheme`-aware — under Notice Board's `color-scheme: dark` (needed for native `<select>`
  chrome, below) that silently resolved to a light default, so a button that forgot its own color
  rendered light-on-light against a `--panel` background. `base.css`'s `button` rule now has
  `color: inherit`, matching `input`/`select`/`textarea`, which already had it.

**`color-scheme: dark` is set on Notice Board's `:root` block** (`color-scheme: light`, newly
explicit, on Parchment's) — needed so native form-control chrome (a `<select>`'s own dropdown/
scrollbar rendering, including the appearance picker itself) doesn't default to whatever the OS/
browser guesses regardless of the page's own painted colors.

**Persistence and no-flash** (`apps/web/src/store/appearanceStore.ts`, `apps/web/src/lib/
appearances.ts`): `localStorage`, mirroring `panelCollapseStore.ts`'s try/catch-with-fallback shape
exactly — read/write live in their own `loadAppearance()`/`saveAppearance()` functions so a
server-backed source can replace them later without touching a call site. The store does not own
the *initial* paint: `index.html`/`harness.html` each carry a small inline `<head>` script that
sets `document.documentElement.dataset.appearance` from the same `localStorage` key before any CSS
paints (has to be inline — a module import runs too late to help). `loadAppearance()` also checks a
`?appearance=` query param before `localStorage` (harmless in the real app, where nothing ever sets
this param) — the test harness navigates with it to force an appearance deterministically for
`responsive-smoke.mjs`/`screenshot.mjs`, and without this check the picker's own displayed value
would silently disagree with what the query param actually rendered — a real mismatch a human
reviewing `screenshot.mjs`'s output would see.

**The picker** is a labelled `<select>` in the app bar (`AppShell.tsx`), alongside About and Sign
out — `0.25.0` ruled the app bar is account/navigation chrome and game-rules controls don't belong
in it; an appearance picker *is* account chrome, so this follows that rule rather than bending it.
Verified against the bar's own documented tightness (see `AppShell.module.css`'s `.adminShort`
comment) at 320/360/390px before landing — it fit; the plan's fallback (move the picker into
`AboutModal`) wasn't needed.

**Testing**: the responsive-smoke/screenshot matrix gained an appearance dimension —
`harnessConfig.mjs`'s `APPEARANCES` list, `harness.html`'s `?appearance=`, and
`SMOKE_APPEARANCE=`/`SCREENSHOT_APPEARANCE=` filters matching the existing route/viewport
convention. CI's `responsive` job is a two-entry matrix over appearance so wall-clock stays flat
rather than doubling. **`appearanceStore.ts` has no dedicated unit test** — `apps/web` has no
vitest suite at all (see "Commands" above), and standing one up (plus a DOM environment for
`localStorage`) just to cover one small store was judged disproportionate to this pass; flagged in
`HANDOFF.md` rather than silently skipped. It's exercised the same way every other web-side store
in this app is (the responsive smoke test, manual QA) — consistent with `panelCollapseStore.ts`
having no dedicated test either.

**The doubled matrix earned its cost immediately**: the first full both-appearance run caught a
real regression the Parchment-only-era hand arithmetic had no way to see — at 360px under Notice
Board, `.board`+`.posting`'s combined horizontal padding squeezed `StatusesPanel`'s dedicated
six-pip Status-rank row (see its own file for the exact number) below what six pips need, so
`Pips` wrapped internally and its touch overlays collided, reproducing the exact overlap bug that
row's whole layout exists to prevent. Fixed with a negative `margin-inline` on `.pipsCell`, driven
by two new tokens (`--posting-pad-x`/`-y`, decomposed out of `--posting-pad` so the fix could
target the horizontal axis alone) — verified with a real rendered measurement after the first
attempt (bleeding only the row's own padding) came in one pixel short in an actual browser, not
just close on paper. That fix then regressed the desktop widths (1024/1440/1920px) in turn, caught
by re-running the full matrix a second time: the negative margin needed resetting inside the
existing `@media (min-width: 1024px)` block (which already resets a different `.pipsCell` property
for the same width switch) and wasn't. Two regressions, two full-matrix runs, both caught before
either shipped — see `StatusesPanel.module.css`'s `.pipsCell` comment for the full numbers. (That
`@media (min-width: 1024px)` block itself became `@container status-col (min-width: 510px)` in
`0.39.0`, when Statuses' polarity groups became columns — see the "Frontend conventions" section's
Statuses-columns note below and the file's own rewritten comment; this paragraph is left as-is,
describing 0.26.0's own history, rather than rewritten to match.)

**Default flip (`0.39.0`)**: `DEFAULT_APPEARANCE` is now `'noticeboard'`, and the storage key
renamed from `asohav.appearance` to `asohav.appearance.v2` (`appearanceStore.ts`, `index.html`,
`harness.html`) — a key rename delivers the one-time forced reset with no marker/migration logic
at all: nobody has the new key yet, so everyone falls through to the new default on first load
after this shipped, and anyone who then picks Parchment writes the new key and keeps it. The old
key is simply never read again (left in place rather than deleted — an inline `<head>` script that
deletes storage is more risk than a few dead bytes). The Motif card readability bug (dark ink on
dark cork, `MotifPanel.tsx` giving its cards `board` instead of wrapping them in one `board` with
each card `posting`, mirroring `LooksPanel`) shipped in the same release, since it becomes the
default first impression the moment this flip lands.
