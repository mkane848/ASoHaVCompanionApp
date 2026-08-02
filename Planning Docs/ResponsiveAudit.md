# UI responsiveness audit & remediation plan

Audited 2026-08-02 against `main` @ `5440bd0`. Every number below was measured in a real
Chromium at the stated viewport, not estimated — see *How this was measured*.

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

### 5. Inputs are below 16px — iOS Safari will auto-zoom on focus

Every text input in the app is 13.5px (`LoginPage.tsx`, `StatusesPanel.tsx`,
`InvitesPanel.tsx`, `FieldEditor.tsx`, `SettingsView.tsx`). iOS Safari zooms the viewport when
a user focuses an input smaller than 16px, and does not zoom back out. Sign-in, status names,
and every admin field trigger it.

### 6. `100vh` and a hardcoded `52px` header offset

- `AppShell.tsx:11`, `App.tsx:16`, `LoginPage.tsx:30` use `100vh`, which on mobile Safari
  refers to the *largest* viewport, so content sits under the browser chrome until you scroll.
  `100dvh` is the fix.
- `AdminNav.tsx:26`, `AdminListPane.tsx:24`, `AdminPanelPage.tsx:108` use
  `calc(100vh - 52px)` — the 52px is the AppShell header, but that header is **93px** at 360px
  because it wraps. The offset is wrong on exactly the devices where it matters.

### 7. Smaller items

- **Sheet length on mobile:** 5,429px at 360px = ~7 full screens; 3,066px at 1440px. No
  collapse/accordion affordance, and the in-page nav that would mitigate it is the one broken
  by finding #3.
- **`background-attachment: fixed`** on `body` (`tokens.css:47`) is a known scroll-jank and
  repaint cost on mobile Safari, on a page that is 7 screens tall.
- **No `:focus-visible` styles anywhere** — inline styles can't express them. Every input also
  sets `outline: 'none'`, so keyboard focus is currently invisible app-wide. This is an
  accessibility bug as much as a responsiveness one.
- **No `prefers-reduced-motion`** guard on the `fadeUp` animation used by the drawer and modals.
- **Header wrap at 360px:** "Sign out" drops to its own line, costing 42px of permanent chrome.
- **Long-word overflow is unguarded:** no `overflowWrap` on user-entered strings (character
  names, status names, invite emails). Nothing broke with seed data, but a long unbroken string
  has nothing stopping it.

### What already works — leave it alone

- No horizontal page overflow at 360 / 390 / 768 / 1024 / 1440 on any route.
- The Moves drawer is already `width: min(560px, 100%)` — correct full-bleed on phones, panel
  on desktop. Both modals use `maxWidth` + `width: 100%` + padded backdrop correctly.
- Campaign (GM and player) reads well at 360px; the peek cards wrap cleanly.
- Home and Login are fine at every width tested.

---

## Plan

Six phases, ordered by player-facing impact per unit of risk. Phases 1–3 are the ones that
matter; 4–6 are follow-ons.

### Phase 1 — Make responsive styling possible (no visible change)

Inline styles are the blocker for everything else, but a wholesale rewrite to Tailwind or CSS
modules is not warranted. The minimum viable change:

- Add `apps/web/src/styles/layout.css` next to the existing `tokens.css`, with breakpoint
  tokens (`--bp-sm: 600px`, `--bp-md: 768px`, `--bp-lg: 1024px`) and a small set of layout
  classes that own the things media queries must own.
- Keep inline styles for one-off cosmetics. The rule: **anything that changes with viewport
  width, or responds to `:hover` / `:focus-visible`, lives in CSS; everything else stays
  inline.** This matches the existing idiom instead of fighting it.
- Add a global `:focus-visible` ring and a `prefers-reduced-motion` guard while we're in there.

*No visual change ships in this phase — it's the substrate for phases 2–5.*

### Phase 2 — Touch targets

- Give `Pips`, the steppers, and the checkbox-style buttons a **44×44 minimum hit area** via
  padding or an `::after` overlay, so the *visual* size stays exactly as designed. The look
  does not change; the touchable region grows.
- Bump every input to `font-size: 16px` on touch viewports to kill the iOS zoom.
- Widen the header controls and bond action buttons to 44px minimum height.

### Phase 3 — Character Sheet on phones and tablets

- Replace `scrollMarginTop: 70` with a `--sticky-h` custom property that the sticky header
  sets from its own measured height, so anchor jumps are correct at every width.
- Collapse the double header on small screens: merge the AppShell bar and the sheet header
  into one row, and make the section nav a horizontally scrolling strip instead of a
  two-line wrap. Target ≤120px of chrome at 360px, down from 255px.
- Introduce a **deliberate** two-column breakpoint at 768px so iPad portrait gets the tablet
  layout, replacing the accidental 818px.
- Swap `100vh` → `100dvh`; replace `calc(100vh - 52px)` with the measured header variable.

### Phase 4 — Sheet length

Make the panels collapsible with persisted open/closed state (or a segmented single-panel view
on phones). 7 screens of scroll is the mobile experience whether or not anything is "broken."

### Phase 5 — Content Admin below 900px

Replace the 3-pane horizontal scroll with a drill-down: **nav → list → detail**, one pane at a
time with a back affordance, below the `--bp-lg` breakpoint. Above it, the current 3-pane
layout is unchanged. This is the largest single piece of work in the plan and the one most
worth deferring if you want the player-facing wins first.

### Phase 6 — Guardrails

`apps/web/harness.html` + `src/harness.tsx` (added in this commit) render the real pages
against the shared seed fixtures with no server or Supabase, at any viewport. Turn the audit
script into a checked-in smoke test that asserts, per route × viewport:

- no horizontal page overflow;
- no interactive element under 44×44 on touch viewports;
- no console errors.

Wire it into the existing CI so this doesn't regress silently.

---

## Open questions

1. **What's the real device mix?** The plan assumes phones matter for the sheet and tablets
   matter a lot (iPad at the table). If everyone plays on a laptop, phases 3–4 drop in priority.
2. **How much does Content Admin matter on a phone?** Phase 5 is the biggest chunk of work and
   it's for a two-person internal tool.
3. **Is 44×44 the right target?** It's the Apple/WCAG 2.5.5 figure. Hitting it on the pip rows
   changes their density noticeably; 36px is a defensible compromise if the density matters to
   the design.

---

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
npm run dev:web            # harness at http://localhost:5173/harness.html
# e.g. /harness.html?route=/c/cm-1/sheet&as=ryan
#      /harness.html?route=/c/cm-1&as=mike      (GM view)
#      /harness.html?route=/admin&as=mike
```

Requires `apps/web/.env.local` to exist with any non-empty `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` — `supabaseClient.ts` throws at import time without them. The values
need not be real; the harness never makes a network call that matters.
