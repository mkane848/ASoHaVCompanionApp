# UI responsiveness audit & remediation plan

Audited 2026-08-02 against `main` @ `5440bd0`. Every number below was measured in a real
Chromium at the stated viewport, not estimated — see *How this was measured*.

> **Status: all six phases are implemented** (commits `d268fa3` … `0471275`). The findings
> below are kept as the record of what was wrong and how it was measured; each one now carries
> a **Fixed** line with the after-number. Phase 6 turned the audit into
> `npm run test:responsive -w @asohav/web`, which runs in CI and now guards all of it.

---

## Summary

The app is **not broken** at any width — there is no horizontal page overflow anywhere, and
the flex-wrap layouts do degrade to a single column on phones. But "not broken" is doing a lot
of work: the sheet is uncomfortable to use on a phone (tiny controls, a third of the screen
eaten by chrome, seven screens of scrolling), tablet portrait gets the phone layout, and
Content Admin is effectively unusable below ~900px.

The root cause is structural: **the entire UI is styled with inline React style objects.**
Inline styles cannot express media queries, `:hover`, or `:focus-visible`. So there is not a
single deliberate breakpoint in the codebase. Every responsive behaviour that exists today is
an emergent side effect of `flexWrap: 'wrap'` plus a `flex-basis` number — which means
breakpoints land wherever the arithmetic happens to put them, and nobody chose those places.

---

## Findings

### 1. No breakpoints exist — layout changes happen by accident (structural)

The sheet's two columns are `flex: '1 1 340px'` and `flex: '3 1 420px'` inside a `maxWidth:
1280` container with `gap: 18` and `padding: 20`. Two-up therefore requires
340 + 420 + 18 + 40 = **818px**. Measured, the columns go side-by-side at 820px and stack
below it:

| Viewport | Sheet columns | Result |
|---|---|---|
| 768px (iPad portrait) | `[728, 728]` stacked | phone layout on a tablet |
| 820px (iPad Air portrait) | `[341, 422]` side by side | two-up |

So **iPad portrait — one of the most likely devices at a real table — gets the phone layout.**
`768__sheet-top.png` shows the cost: the Virtues panel spans the full 728px with the −/+
steppers stranded ~600px to the right of the Virtue they modify.

**Fixed** (`30240b9`): replaced with a CSS grid that goes two-column at a stated 768px.
Measured after: 284/426 at 768px, and 453/769 at 1440px against 456/767 before — desktop
proportions are preserved to within 3px.

### 2. Touch targets are far below the 44×44 minimum (highest player-facing impact)

Counted at 390px with a touch context, elements under 44px in either dimension:

| Screen | Sub-44px controls |
|---|---|
| Character Sheet | **99** |
| Content Admin | 19 |
| Campaign | 10 |
| Home | 3 |

The worst offenders are the controls players touch most:

| Control | Size | File |
|---|---|---|
| Virtue −/+ steppers | 24×24 | `VirtuesPanel.tsx:104` |
| Item charge pips | **15×15** | `LoadPanel.tsx:82` (via `Pips.tsx`) |
| Status rank pips | 19×19 | `StatusesPanel.tsx:50` |
| Theme quest checkboxes | 24×24 | `ThemePanel.tsx:42` |
| Kit carried checkboxes | 26×26 | `LoadPanel.tsx:62` |
| Armor slot buttons | 30×30 | `ArmorPanel.tsx:30` |
| Bond "Propose +1 Kin" | 116×23 | `CampaignBonds.tsx` |
| Header "Sign out" | 86×26 | `AppShell.tsx` |

A 15px pip is roughly a fifth of the area of a fingertip contact patch. These are not
cosmetic — they are mis-tap generators on the exact controls used mid-session.

**Fixed** (`d269ec0`, `0471275`): **0** controls under 44×44 on any touch viewport, and **0**
pairs with overlapping hit areas. The painted sizes are unchanged on a fine pointer — the hit
area grows, not the design. Three mechanisms were needed; see the commit for why one wasn't
enough.

### 3. Anchor navigation lands behind the sticky header on phones (functional bug)

`Panel.tsx:31` hardcodes `scrollMarginTop: 70`, which assumes a ~70px sticky header. The
actual header height is width-dependent because it wraps:

| Viewport | AppShell bar | Sticky sheet header | Total chrome | Anchor jump result |
|---|---|---|---|---|
| 360px | 93px | 162px | 255px (**32%** of an 800px viewport) | heading buried **92px** behind header |
| 390px | 51px | 131px | 182px (23%) | heading buried **61px** behind header |
| 768px+ | 51px | 58px | 109px (14%) | correct |

Tapping "Growth" on a phone scrolls to a position where the panel heading and the first 92px
of its content sit underneath the sticky header. Reproduced at 360px and 390px.

**Fixed** (`30240b9`): AppShell and the sheet header publish their measured heights as
`--app-bar-h` / `--sticky-h` via ResizeObserver, and panels anchor against the variable. The
Growth heading now lands 12px clear of the header at 360, 390, 768 and 1440. The header itself
went from 162px to 109px at 360px by making the section nav a single scrolling strip.

### 4. Content Admin is unusable below ~900px

Commit `93b84b8` swapped the wrapping 3-pane row for `overflowX: 'auto'`. That stopped the
panes stacking, but the panes still demand 190 + 300 = 490px before the detail form — the only
pane you actually edit in — gets any width at all:

| Viewport | Detail pane visible width |
|---|---|
| 360px | **97px** |
| 768px | 278px |
| 1440px | 950px |

At 360px, 47 elements sit outside the viewport inside that horizontal scroller. Editing a Move
means scrolling right, at which point the nav and list scroll out of view entirely. The commit
message called this an acceptable trade for an internal tool; it is worth revisiting, because
"internal" and "someone will open it on a phone at the table" aren't mutually exclusive.

**Fixed** (`31f21b7`): below 1024px the panes become a drill-down — nav → list → detail, one
full-width pane at a time with back affordances. Detail pane at 360px: **97px → 360px**. The
three-pane layout is untouched at 1024px and above (190/300/534 and 190/300/950).

### 5. Inputs are below 16px — iOS Safari will auto-zoom on focus

Every text input in the app is 13.5px (`LoginPage.tsx`, `StatusesPanel.tsx`,
`InvitesPanel.tsx`, `FieldEditor.tsx`, `SettingsView.tsx`). iOS Safari zooms the viewport when
a user focuses an input smaller than 16px, and does not zoom back out. Sign-in, status names,
and every admin field trigger it.

**Fixed** (`d269ec0`): 16px minimum on coarse pointers. Two fields deliberately set in 19px
display type opt out via `.text-lg` — the first version of the rule *shrank* them, which the
measurement caught.

### 6. `100vh` and a hardcoded `52px` header offset

- `AppShell.tsx:11`, `App.tsx:16`, `LoginPage.tsx:30` use `100vh`, which on mobile Safari
  refers to the *largest* viewport, so content sits under the browser chrome until you scroll.
  `100dvh` is the fix.
- `AdminNav.tsx:26`, `AdminListPane.tsx:24`, `AdminPanelPage.tsx:108` use
  `calc(100vh - 52px)` — the 52px is the AppShell header, but that header is **93px** at 360px
  because it wraps. The offset is wrong on exactly the devices where it matters.

**Fixed** (`d268fa3`): `100dvh` throughout, and the admin panes size against the measured
`--app-bar-h`.

### 7. Smaller items

- **Sheet length on mobile:** 5,429px at 360px = ~7 full screens; 3,066px at 1440px. No
  collapse/accordion affordance, and the in-page nav that would mitigate it is the one broken
  by finding #3. — **Fixed** (`dda70cc`): every panel folds to its header, persisted in
  localStorage. All eight folded takes the sheet to 1,137px at 390px, from 5,316px.
- **`background-attachment: fixed`** on `body` (`tokens.css:47`) is a known scroll-jank and
  repaint cost on mobile Safari, on a page that is 7 screens tall. — **Fixed** (`d268fa3`).
- **No `:focus-visible` styles anywhere** — inline styles can't express them. Every input also
  sets `outline: 'none'`, so keyboard focus is currently invisible app-wide. This is an
  accessibility bug as much as a responsiveness one. — **Fixed** (`d268fa3`).
- **No `prefers-reduced-motion`** guard on the `fadeUp` animation used by the drawer and
  modals. — **Fixed** (`d268fa3`).
- **Header wrap at 360px:** "Sign out" drops to its own line, costing 42px of permanent
  chrome. — **Fixed** (`d268fa3`): app bar is 93px → 44px at 360px.
- **Long-word overflow is unguarded:** no `overflowWrap` on user-entered strings (character
  names, status names, invite emails). Nothing broke with seed data, but a long unbroken string
  has nothing stopping it. — **Fixed** (`d269ec0`) via `.wrap-anywhere`.

### What already works — leave it alone

- No horizontal page overflow at 360 / 390 / 768 / 1024 / 1440 on any route.
- The Moves drawer is already `width: min(560px, 100%)` — correct full-bleed on phones, panel
  on desktop. Both modals use `maxWidth` + `width: 100%` + padded backdrop correctly.
- Campaign (GM and player) reads well at 360px; the peek cards wrap cleanly.
- Home and Login are fine at every width tested.

---

## What shipped

All six phases are implemented. Commits, in order:

| Phase | Commit | What changed |
|---|---|---|
| 1 — substrate | `d268fa3` | `styles/layout.css` + `lib/useMediaQuery.ts`. Focus rings, reduced-motion, `100dvh`, measured header heights, app-bar compaction. No breakpoint behaviour yet. |
| 2 — touch targets | `d269ec0` | 44px hit areas via three mechanisms; iOS input-zoom fix; `.wrap-anywhere`; modal `dvh` heights. |
| 3 — sheet layout | `30240b9` | Stated 768px two-column breakpoint; `--sticky-h` anchor offset; header 162px → 109px at 360px. |
| 4 — sheet length | `dda70cc` | Collapsible panels, persisted per panel in localStorage. |
| 5 — Content Admin | `31f21b7` | nav → list → detail drill-down below 1024px. |
| 6 — guardrail | `0471275` | `npm run test:responsive`, wired into CI as its own job. |

### Before and after

| | Before | After |
|---|---|---|
| Sub-44px controls, sheet @390 touch | 99 | **0** |
| Overlapping hit areas, all routes | (not measured) | **0** |
| Sheet two-column breakpoint | 818px, by accident | **768px, stated** |
| Columns @768px | `[728, 728]` stacked | **284 / 426 side by side** |
| Columns @1440px | 456 / 767 | 453 / 769 (unchanged by design) |
| Anchor jump @360px | heading 92px behind header | **12px clear** |
| Sticky header @360px | 162px | **109px** |
| App bar @360px | 93px (wrapped) | **44px** |
| Admin detail pane @360px | 97px | **360px** |
| Sheet height @390px, folded | n/a | **1,137px** (from 5,316px) |
| Horizontal overflow, any route/width | none | none |

The sheet's *expanded* height on a phone went up rather than down — 5,429px → 5,970px at 360px —
because 44px touch targets are physically taller than 15px ones. That is the trade the folding
in phase 4 is there to pay for, and a folded sheet is now far shorter than the original.

### Deliberately not done

- **Desktop tap targets.** The 44px rule is enforced only under `pointer: coarse`. On a mouse
  the design stays as compact as it was, and the CI check reflects that.
- **A styling-system migration.** Tailwind or CSS modules would be a bigger change than the
  problem justified. The rule instead is: viewport-, pointer-, or focus-dependent styling goes
  in `layout.css`; everything else stays inline.

### The recurring hazard, for whoever touches this next

Inline styles outrank stylesheet rules for the same element. That bit this work **four**
separate times, each time silently — the thing looked applied and wasn't:

1. `--pip-gap` set inline meant the coarse-pointer gap widened while the hit areas didn't.
2. An inline `gap` shorthand beat `.tap-row`'s `row-gap`.
3. Inline `display: flex` on panel rows beat `.panel-collapsed`'s `display: none`, so four
   panels folded their headers and kept their bodies.
4. A percentage width on an absolutely positioned `::after` resolves against the *padding* box,
   which silently excluded the pips' 1.5px borders.

Each is why a `!important` or a value indirection exists where it does. None of them would have
been caught by reading the diff — they were all found by measuring the rendered page, which is
the argument for phase 6 existing at all.

## Open questions

1. **Is 44×44 right for the pip rows?** It is the Apple/WCAG 2.5.5 figure, and it's met by
   widening the gap on touch rather than the dots. Six rank pips now span 239px of the 276px a
   360px phone has inside a panel. If that reads as too airy, `--tap-min` is one number in
   `layout.css` and the CI check reads the same constant.
2. **Should panels start folded on a phone?** They currently start open everywhere, and folding
   is remembered once chosen. Defaulting to folded below 600px would put every section heading
   on one screen at the cost of a tap to open the one you want.

## How this was measured

`apps/web/harness.html` + `src/harness.tsx` mount the real `App` inside a `MemoryRouter` with a
`QueryClient` pre-seeded from `@asohav/shared`'s `seedLibrary()` / `seedPlay()` fixtures, so
every page renders with no server, no database, and no Supabase connection. A route and a user
(`?route=/c/cm-1/sheet&as=ryan`) come in as query params.

The harness is dev-only: `vite build` uses `index.html` as its sole entry, so `harness.html` is
never emitted to `dist/` (verified). Playwright then drove it at 360 / 390 / 414 / 600 / 768 /
820 / 1024 / 1280 / 1440px with touch emulation on the mobile sizes, capturing screenshots and
measuring overflow, tap-target sizes, header heights, column widths, and anchor-scroll offsets.

To reproduce:

```bash
npm run test:responsive -w @asohav/web   # the CI check: 5 routes x 5 viewports

npm run dev:web                          # or drive it by hand
# http://localhost:5173/harness.html?route=/c/cm-1/sheet&as=ryan
#                                     ?route=/c/cm-1&as=mike      (GM view)
#                                     ?route=/admin&as=mike
```

The smoke test starts its own Vite server and injects placeholder Supabase env vars, so it
needs no setup. Driving the harness by hand through `npm run dev:web` needs
`apps/web/.env.local` to exist with any non-empty `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` — `supabaseClient.ts` throws at import time without them. The values
need not be real; the harness never makes a network call that matters.

Set `CHROMIUM_PATH` if your environment already ships a Chromium whose build number doesn't
match the pinned Playwright.
