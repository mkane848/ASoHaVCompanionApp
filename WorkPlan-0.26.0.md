# Work plan — `0.26.0`

A switchable **appearance** system, and a second appearance built on the notice-board metaphor:
collections of tags — Statuses, Looks, equipped Items, quests — render as papers pinned to a board.
Parchment stops being *the* look and becomes *an* option. The dynamic parchment-damage overlay is
removed entirely.

Written from a direct repo-owner brief, not an audit. Planning only — no code lands with this
document beyond the document itself.

> **Status: APPROVED by the repo owner (2026-08-14), not yet implemented.** PR 1 below (this
> document) is the only landed item; everything else is unstarted. A session picking this up should
> start at PR 2 and work down the "Order of work" checklist, ticking items as they land. The four
> questions in "Decisions already locked" were put to the repo owner and answered — don't re-ask
> them.

## Decisions already locked

Confirmed with the repo owner before this plan was written:

1. **The damage overlay is deleted entirely**, from both appearances — component, both `Panel`
   props, the shared tier math, and its documentation. Not kept as a Parchment-only feature, not
   reskinned per appearance.
2. **Appearance choice persists in `localStorage`, structured for a DB swap later.** No migration,
   no route, no `MeResponse` change in this pass; the read/write path is deliberately isolated so a
   server-backed source can replace it without touching call sites.
3. **The pinned-poster treatment covers the character sheet's tag collections first.** Every other
   surface in the app gets the token repaint only.
4. **The new appearance gets its own display *and* body typeface**, not just a colour change.

Defaults taken without a specific ask, flagged here so they're easy to veto:

- **Version `0.26.0`** (MINOR — new user-facing functionality plus a notable internal architecture
  change), from `0.25.0`.
- **The new appearance is called "Notice Board"** (`noticeboard`); the existing one is "Parchment"
  (`parchment`).
- **`Cinzel` + `Zilla Slab`** as the Notice Board typefaces, self-hosted rather than loaded from the
  Google Fonts CDN. Reasoning in C2 — the constraint driving the pick is the codebase's existing
  weight usage, not taste.
- **The picker is a `<select>` in the app bar.** See B4 for the risk and the fallback.

---

## A — Naming: the UI concept cannot be called "Theme"

`CharacterSheet.Theme`, `ThemePanel.tsx`, `library.themes`, and Content Admin's Themes collection
are all a **game** concept — a character's narrative Theme. A UI theme called `Theme` would make
`grep -rn theme` useless in a repo whose entire working convention is "read the code before changing
it."

**Everything user-facing and in code uses "Appearance":**

| Thing | Name |
|---|---|
| DOM attribute | `data-appearance="parchment" \| "noticeboard"` on `<html>` |
| TS type / registry | `AppearanceId`, `APPEARANCES` (`apps/web/src/lib/appearances.ts`) |
| Store | `apps/web/src/store/appearanceStore.ts` |
| Stylesheets | `apps/web/src/styles/appearances.css`, `apps/web/src/styles/surfaces.css` |
| UI label | "Appearance" |

`data-theme` is the web idiom and would work perfectly well in CSS — greppability in *this* repo is
what decides it. Record as `README.md#architecture-notes--judgment-calls` item 25.

---

## B — Architecture

### B1 — Three tiers of token

**Tier 1 — the existing palette, redefined per appearance.** `tokens.css` keeps its current `:root`
block as the Parchment values. A new `appearances.css` adds
`:root[data-appearance='noticeboard'] { … }` overriding the same names.
`:root[data-appearance='…']` (specificity 0,2,0) outranks `:root` (0,1,0) inside the same `tokens`
layer, so **no new cascade layer is needed** and all 66 existing stylesheets repaint with zero
edits.

Set `color-scheme: light` / `dark` per appearance as well. Notice Board is a dark board, and the app
has real `<select>` elements (`StatusesPanel`'s Polarity field, all of Content Admin) whose native
dropdown and scrollbar rendering will otherwise stay light-on-dark.

**Tier 2 — two texture tokens, so `base.css` stops hardcoding parchment.** `base.css` currently
hardcodes the body's four-layer radial-gradient parchment ground (lines 16–19) and `.panel-grain`
(line 62). Both become `var(--ground-texture)` / `var(--panel-texture)`, supplied per appearance.

**Tier 3 — new role tokens for the board metaphor, defined in *both* appearances.** This is the
mechanism that lets one set of markup serve both without forking components:

```
--board-bg, --board-border, --board-inset, --board-pad
--posting-bg, --posting-border, --posting-shadow, --posting-pad, --posting-tilt
--pin-size, --pin-color, --pin-shadow, --pin-opacity
```

Under Parchment these are neutralised — `--board-bg: transparent`, `--board-border: none`,
`--posting-shadow: none`, `--posting-tilt: 0deg`, `--pin-opacity: 0` — so a `.board`/`.posting`
element renders exactly as it does today.

**The rule this establishes, and which `theme-tokens/SKILL.md` must state: a new token is defined in
every appearance, never only in the one being worked on.** A token defined in just one appearance is
the new version of the hardcoded literal that skill already exists to prevent.

### B2 — The `.board` and `.posting` primitives

New `apps/web/src/styles/surfaces.css`, opening `@layer utilities` — the same layer as
`.action-grid` and `.tap`, so the decoration reliably outranks component rules without `!important`.
A separate file rather than growing `layout.css` past its current 25KB, matching how `base.css` and
`layout.css` are already split.

- **`.board`** paints `--board-bg` / `--board-border` / `--board-inset` behind an existing flex or
  grid container. It does not change the container's display mode or its children's sizing beyond
  `--board-pad`.
- **`.posting`** paints `--posting-bg` / `--posting-border` / `--posting-shadow` on an item, with
  the pin as a `::before` pseudo-element — no extra DOM, and it vanishes under Parchment via
  `--pin-opacity: 0`.

**Tilt is a per-call-site opt-in through `--posting-tilt`, defaulting to `0deg`.** Two concrete
reasons, both grounded in this repo's own history:

- `getBoundingClientRect()` reports the **transformed** box, and `responsive-smoke.mjs` asserts that
  no two controls have overlapping hit areas. A 300×60px row at 1° grows roughly 5px vertically on
  each side — more than the 8–10px gaps in `StatusesPanel` can absorb once `.pip`'s 44px-tall touch
  overlays are also in play. `StatusesPanel.module.css`'s and `VirtuesPanel.module.css`'s comment
  blocks record this exact failure mode being hit twice already.
- A tilted row containing a text input and six pips is worse to *use*, not merely riskier to lay
  out.

So: **tilt on for chip-shaped items** (Looks chips, Theme quest chips, Load item tags — small,
single-control, generous surrounding gap); **tilt off for full-width interactive rows** (Statuses
rows). Cap at 1.5°.

**Vary the tilt deterministically with `:nth-child(4n+1…4)`, never `Math.random()`.**
`screenshot.mjs` exists so a layout change can be compared before and after; random tilt makes every
screenshot comparison a false positive.

### B3 — Switching, persistence, and the flash

`appearanceStore.ts` mirrors `panelCollapseStore.ts` exactly: `localStorage` with `try/catch` around
both read and write, falling back to the default rather than throwing. That file's comment — "a
panel that forgets it was collapsed is a much smaller problem than a sheet that won't render" —
applies verbatim here.

Per decision 2, the read and write go through module-level `loadAppearance()` / `saveAppearance()`
functions rather than inline `localStorage` calls, so a server-backed source can replace them
without touching a single call site.

**The store applies the attribute; it does not own the initial paint.** A React effect runs after
first paint, so the app would flash Parchment and then repaint. `index.html` and `harness.html` each
need a small inline `<script>` in `<head>` that reads the key and sets
`document.documentElement.dataset.appearance` before any CSS paints. It has to be inline — a module
import is deferred and lands too late to help.

### B4 — Where the picker lives

A labelled `<select>` in the app bar (`AppShell.tsx`), alongside About and Sign out. `0.25.0` ruled
that the app bar is account and navigation chrome and that game-rules controls don't belong in it;
an appearance picker **is** account chrome, so this follows that rule rather than bending it. A
`<select>` rather than a segmented control because more appearances are explicitly wanted later, and
a `<select>` absorbs an N-th option with no layout change at all.

**Known risk:** the bar is tight. It already hides `.app-bar__who` below 600px specifically to stay
on one line down to 320px. Verify the bar at 320/360/390px explicitly. If it wraps, the fallback is
to move the control into `AboutModal` — don't fight the bar with a hand-rolled compact widget.

---

## C — The Notice Board appearance

### C1 — Palette

Direction, not final hex values; the implementing agent should run `npm run screenshot` and iterate
with the repo owner.

Aim for a dark, warm, matte **board** ground (worn cork or planked wood, expressed through
`--ground-texture` rather than an image asset); **postings** in off-white to aged-manila paper; and
the existing accent semantics (`--gold`, `--danger`, `--positive`) re-tuned to hold contrast against
paper rather than against parchment.

**Because postings stay light, most text keeps a dark ink colour.** The dark shift is the *ground*
and the panel chrome, not the reading surface. That is what keeps the 16 existing `--ink-*` opacity
stops meaningful instead of requiring an inverted parallel set of tokens.

Every `--ink-*`, `--rule*`, and accent token still has to be re-derived for the new ground. Check
contrast specifically on `--ink-35` (placeholders), `--ink-45` (the 10px uppercase labels used
throughout `StatusesPanel`/`LooksPanel`), and `--rule-soft` hairlines — the three places the current
palette already sits at its lightest.

### C2 — Type

**Self-host both faces as `woff2` under `apps/web/public/fonts/`, with `@font-face` declared in
`appearances.css`.** Three reasons this beats a second `<link>` to Google Fonts:

- **`@font-face` is lazy.** A browser fetches a face only when rendered text actually uses it, so
  declaring all four faces costs the inactive appearance nothing.
- **It makes `screenshot.mjs` representative for typography.** `CLAUDE.md` currently carries the
  caveat that screenshots render in fallback serif because the sandbox's proxy blocks Google Fonts.
  Self-hosted files are served by the local Vite harness, so that caveat goes away — for the new
  faces immediately, and for Cormorant/Lora too if they migrate in the same pass.
- One fewer render-blocking cross-origin request on every page load.

Both `fonts.googleapis.com` and `fonts.gstatic.com` were verified reachable from this sandbox while
writing this plan (CSS `200`, a real `woff2` downloaded), so the font files can be fetched here
despite the general allowlist.

**Default pick: `Cinzel` for `--font-display`, `Zilla Slab` for `--font-body`.** The binding
constraint is the codebase, not taste. `--font-display` is used at `font-weight: 600` and `700` and
at sizes down to 16px (`Panel`'s `.heading` 23px, `StatusesPanel`'s `.name` 19px, `.rank` 20px,
`.resourceValue` 16px); `--font-body` runs down to 10px uppercase labels. Cinzel is a 400–900
variable face in one ~26KB latin file and reads as a printed proclamation; Zilla Slab covers 300–700
plus italics and holds up at 10px.

The obvious poster faces — `Rye`, `Alfa Slab One`, `Bevan`, `IM Fell English SC` — are all
**single-weight 400 only**, which would leave every 600/700 site to synthetic bolding. Any of them
is a legitimate alternate to screenshot-compare *for display only*, and if one wins, the existing
weight usages have to be audited and collapsed first. Don't swap one in without doing that.

Changing both faces changes metrics, which changes wrapping — so C2 lands before the surface work in
D, and the full responsive matrix runs after it.

---

## D — Surfaces getting the poster treatment

Scoped to the sheet's tag collections per decision 3. Each is an existing container plus its
existing items; `.board` and `.posting` attach to markup that already exists.

| Surface | Container → `.board` | Item → `.posting` | Tilt |
|---|---|---|---|
| `StatusesPanel.tsx` | the Positive / Neutral / Negative group lists | `.row` | **off** — see B2 |
| `LooksPanel.tsx` | `.chips` | `.chip` | on |
| `ThemePanel.tsx` | the quest chip row | quest chip | on |
| `LoadPanel.tsx` | the items column | each item row | on |
| `AbilitiesSkillsPanel.tsx` | `.list` | each entry | on |
| `ArmorSection.tsx` | the armor row | each armor entry | on |

Two things to preserve, both load-bearing and both easy to break silently:

- **`StatusesPanel.module.css`'s `.rowHead` grid and its 1024px threshold.** Its comment block
  records the arithmetic — the six-pip row needs ~239px; the panel's `.sheet-col` gives ~382px at a
  768px viewport and ~564px at 1024px — and two separate bugs caused by getting it wrong.
  `--posting-pad` reduces the width available inside every row, so **re-derive against the new
  padding** rather than assuming the threshold still holds.
- **`Panel.module.css`'s `container-type: inline-size`.** Three panels query their own measured
  width (`AbilitiesSkillsPanel` at 560px, `LoadPanel` at 700px, `AdvancementPanel` at 850px). Board
  padding changes the content width those queries read.

Everything outside this table — Home tiles, Campaign roster, Combat participant cards, drawers,
modals, Content Admin — gets the token repaint only, and should be screenshotted to confirm it looks
*different* rather than *broken*.

---

## E — Removing the damage overlay

Delete, in this order:

- `apps/web/src/features/sheet/DamageOverlay.tsx` and `DamageOverlay.module.css`.
- `Panel.tsx`: the `damageTier` / `damageVariant` props, the import, and the conditional render.
  **`grain` and the `panel-grain` class stay** — that's static paper texture, a separate concern
  which `AppThemeGuidelines.md` explicitly notes is independent of the damage system, and it becomes
  appearance-driven via `--panel-texture` (B1).
- `VirtuesPanel.tsx` and `StatusesPanel.tsx`: the two `damageTier(...)` call sites and the props they
  feed.
- `packages/shared/src/logic.ts`: `damageTier()` and `DAMAGE_TIER_OPACITY`, plus their unit tests.
  **Check `markedConditionCount` and `negativeStatusRankTotal` for other callers before touching
  them** — both are used elsewhere and should stay.

---

## F — Pre-work: tokenise the last literals

**This lands first, as its own PR.** These 16 sites are exactly the ones that would silently stay
parchment-coloured under Notice Board. It's a mechanical change with no visual effect in Parchment,
so a screenshot diff proving "nothing changed" is a complete verification.

| Value | Sites | Token |
|---|---|---|
| `0 6px 18px rgba(0,0,0,.18)` | `InfoTooltip:35`, `Toast:16`, `GlossaryText:30` | `--shadow-pop` |
| `rgba(42,32,26,.78)` | `GlossaryDrawer:62`, `MovesDrawer:122` | `--ink-78` |
| `rgba(42,32,26,.80)` | `MovesDrawer:142` | `--ink-80` |
| `rgba(42,32,26,.32)` | `ThemePanel:113` | `--ink-32` |
| `rgba(42,32,26,.07)` | `ArmorSection:59` | `--ink-07` |
| `rgba(42,32,26,.04)` | `AdvancementPicker:16` | `--ink-04` |
| `rgba(42,32,26,.42)` | `drawer:12` (scrim) | `--scrim` |
| `rgba(157,124,51,.22)` | `MovesDrawer:157` | `--gold-line-soft` |
| `rgba(140,58,31,.4)` | `VirtuesPanel:213` | **reuse the existing `--danger-line`** (`.45`) |
| `rgba(255,255,255,.3)` | `AppShell:63` | `--on-dark-line` |
| `rgba(239,232,218,.94)` | `CharacterSheetPage:10` (sticky bar) | `--ground-sticky` |
| the parchment gradients | `base.css:16-19`, `base.css:62` | `--ground-texture`, `--panel-texture` |

The `VirtuesPanel:213` row is a near-duplicate of a token that already exists, which is precisely
the case `theme-tokens/SKILL.md` says to resolve against the existing tokens rather than mint a new
one for. The remaining 12 `DamageOverlay` literals need no treatment — that file is deleted in E.

---

## G — Testing

**The route matrix gains an appearance dimension.** `harnessConfig.mjs` grows an `APPEARANCES` list;
`harness.html` accepts `?appearance=`; `responsive-smoke.mjs` and `screenshot.mjs` both iterate it.
`screenshot.mjs` writes to `.screenshots/<appearance>/…`.

15 routes × 7 viewports × 2 appearances runs ~25–28 minutes in this sandbox, roughly double today.
Handle it two ways: add a `SMOKE_APPEARANCE=` filter matching the existing `SMOKE_ROUTE=` /
`SMOKE_VIEWPORT=` convention for local iteration, and split CI's `responsive` job into a two-entry
matrix over appearance so wall-clock stays flat.

**Both appearances must pass the full matrix.** This is not a repaint that can't move layout — the
board padding, the paper padding, the tilt, and especially the new font metrics all shift geometry.

Also verify, since nothing automated covers any of these:

- **The app bar at 320/360/390px** with the picker added (B4).
- **Contrast** on the three lightest ink stops against the new ground (C1).
- **No flash of Parchment** on a hard reload with Notice Board selected — the inline script (B3).
- **Native `<select>` dropdowns** render correctly under `color-scheme: dark` (B1).
- Unit tests for `appearanceStore`'s `localStorage` read/write fallbacks. Nothing else introduced
  here has logic worth testing.

---

## H — Documentation

Not optional in this repo, and one file needs a rewrite rather than an edit.

- **`AppThemeGuidelines.md` — full rewrite.** It currently states "This is not light/dark mode or
  any kind of user-facing theme picker — this app doesn't have one," and holds the line on "no wood
  grain … no drop shadows pretending to be a physical object on a desk," with "parchment and ink are
  the medium the characters' stories are written in — they are not a costume the UI wears." **Notice
  Board deliberately reverses both.** Write it as a dated, reasoned reversal that keeps the original
  principle on record as Parchment's governing rule — don't quietly delete the sentences that now
  read as wrong. Its four "Open questions for refinement" are all moot once E lands and should be
  removed with a note saying why.
- **`CLAUDE.md`** — a new "Architecture: appearances" section (the three token tiers, the
  define-in-every-appearance rule, `.board`/`.posting`, the tilt constraint, the Appearance-vs-Theme
  naming); an update to "Frontend conventions"; and removal of the damage-overlay references. The
  `AppThemeGuidelines.md` mention inside `StatusesPanel.module.css`'s `.groupLabel` comment needs
  updating too.
- **`README.md#architecture-notes--judgment-calls`** — item 25: the appearance system, the naming
  call, and the reversed design principle.
- **`.claude/skills/theme-tokens/SKILL.md`** — currently says tokens are "ported verbatim from the
  design handoff" and lists a single palette. Update to the two-palette model and add the
  define-in-every-appearance rule. `CLAUDE.md` requires a skill to stay in sync with the convention
  it encodes.
- **`.claude/skills/responsive-device-qa/SKILL.md`** — add the appearance dimension and the
  `SMOKE_APPEARANCE` filter.
- **`CHANGELOG.md`** — a `0.26.0` entry with a full UTC timestamp; bump all four `package.json`
  files together; tag the merge commit `v0.26.0` (the repo owner does the tagging at the real merge
  commit on `main`, per the versioning policy — a feature-branch commit is the wrong target).
- **`HANDOFF.md`** — session notes and any open items left standing.

---

## Order of work

Each numbered item lands as its own PR, verified before the next begins. **Tick these as they
land** — this is the resume point for a session picking the plan up.

The ordering is deliberate: every step is independently verifiable, and nothing that can move layout
lands before the mechanism that lets you see it.

- [x] **1. Docs** — this work plan. *(landed)*
- [ ] **2. Tokenise the remaining literals** (F). No visual change; verified by screenshot diff.
- [ ] **3. Delete the damage overlay** (E). A Parchment-only change, easy to review in isolation.
- [ ] **4. The appearance mechanism** (B1, B3, B4) with Notice Board registered but its palette a
  deliberate near-copy of Parchment. This proves switching, persistence, the no-flash script, the
  picker, and the doubled test matrix **before** any visual work makes a failure ambiguous.
- [ ] **5. Notice Board palette and type** (C). The first real visual change; full matrix, both
  appearances.
- [ ] **6. `.board` / `.posting` primitives** (B2) plus the first surface — `LooksPanel` — as the
  reference implementation.
- [ ] **7. The remaining surfaces** (D). Split into two PRs if `StatusesPanel`'s `.rowHead`
  arithmetic needs real re-derivation, which is likely.
- [ ] **8. Docs and release** (H).

Items 2–4 and 5–7 are a clean seam if this needs to land in two passes: the first group is
mechanism with no visual change, the second is the visual work.

## Verification and paperwork

Per `.claude/skills/release-reliability-checklist` and `responsive-device-qa`:

- `npm run typecheck` and `npm run test` on every PR.
- **Full** `npm run test:responsive` on anything touching layout —
  `CHROMIUM_PATH=/opt/pw-browsers/chromium`, since `playwright install` is blocked in this sandbox.
  `SMOKE_ROUTE=` / `SMOKE_VIEWPORT=` / the new `SMOKE_APPEARANCE=` for iteration, never as the final
  check.
- `npm run screenshot -w @asohav/web` before and after every visual PR, in **both** appearances. The
  smoke test asserts no overflow, no small targets, and no overlapping hit areas — none of which can
  tell a good repaint from a bad one.
- Version `0.26.0` across all four `package.json` files, a CHANGELOG entry with a full UTC
  timestamp, tag the merge commit `v0.26.0`.

## Open items

Raise these with the repo owner rather than guessing:

- **Final palette hex values and the display-face pick** (C1, C2). Both want a screenshot review,
  not a unilateral call.
- **Whether Cormorant and Lora migrate to self-hosting in the same pass.** Recommended — it removes
  the "screenshots aren't representative for typography" caveat from `CLAUDE.md` entirely — but it
  changes Parchment's rendering, so it deserves its own before/after screenshot rather than riding
  along inside a Notice Board PR.
- **Whether the card-like surfaces outside D's table look wrong once postings exist next to them** —
  Home tiles, the Campaign roster, Combat's `ParticipantCard`. A real possibility, and the natural
  `0.27.0` scope; not something to quietly expand into here.

Carried forward from earlier plans, untouched by this one:

- **`StatusesPanel`'s 1024px media query is still un-converted** to a container query, flagged as a
  follow-up in `0.24.0` and again in `0.25.0`. D's re-derivation of `.rowHead` against
  `--posting-pad` is a natural moment to reconsider it — but converting it and repadding it in the
  same PR would make a regression hard to attribute, so keep them separate.
- **Whether Combat's `Encounter.History` should move into `HistoryModal`** — an open question since
  `0.24.0`, unaffected by this plan.

`0.26.0` touches no migrations, no routes, and no wire shapes. `packages/shared` changes only by the
deletion of `damageTier()` / `DAMAGE_TIER_OPACITY` in E.
