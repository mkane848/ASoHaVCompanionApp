# Web client guide (`@asohav/web`)

This file applies inside `apps/web/`. Follow the root `AGENTS.md` unless this file gives a more
specific rule.

## Local commands

- Run: `npm run dev -w @asohav/web` (http://localhost:5173)
- Unit tests: `npm test -w @asohav/web`
- Type check: `npm run typecheck -w @asohav/web`
- Responsive smoke test (Playwright, every viewport and appearance):
  `npm run test:responsive -w @asohav/web`. To run one viewport group:
  `SMOKE_GROUP=tablets npm run test:responsive -w @asohav/web` (`phones`, `tablets`, `desktops`).
- Interaction-gated states: `npm run test:interaction -w @asohav/web`
- Tap behaviour under latency, refusal and double-tap: `npm run test:behavior -w @asohav/web`
- Print renders: `npm run print:sheet -w @asohav/web`, `npm run print:gm -w @asohav/web`
- Bundle budget: `npm run bundle-budget -w @asohav/web`

## Local conventions

- **44×44 touch targets.** Every `button, a, input, select, textarea` holds its own non-overlapping
  44×44 hit area on a touch viewport. The responsive smoke test enforces this.
- **16px text inputs.** Any control the user types into is at least `--fs-input` (16px) on a coarse
  pointer, or iOS Safari zooms the page. This rule has been in `layout.css` since PR #68, so grep
  before adding it again.
- **Use the tokens.** `src/styles/tokens.css` defines the palette, `--fs-*` (11/12/13/15/18/23),
  `--track-*` and `--sp-*` (4/8/12/16/20/28). There are zero literal px font sizes in any
  `.module.css`, so a new one must be a deliberate, commented exception. Define every token in
  **every** appearance, not only the one you are working on. Use the `theme-tokens` skill.
- **Printables.** `src/features/print/` renders paper sheets (`/c/:id/sheet/print`, `?blank=1`,
  `/c/:id/gm-reference/print`) from live data. `printCoverage.ts` and
  `printGmReferenceCoverage.ts` are `Record<keyof …, Coverage>` maps. A new field fails typecheck
  until you decide, with a recorded reason, whether it prints. When a rule changes what a sheet
  shows, update `PrintSheet.tsx` to match, then run `print:sheet` and look at the pages. Any new
  printable needs the same guard.
- **Virtue scores are read-only on the sheet.** Don't add a stepper or `<select>` to
  `VirtuesPanel`. The repo owner asked for this directly. Scores change only through the Motif
  advance (`MotifAdvanceFlow.tsx`, which calls `applyMotifAdvanceBonus()`).
- **State.** All server state lives in TanStack Query's cache. Zustand stores hold pure UI state
  only, and there is no global app store.

Detail: [`docs/architecture/frontend.md`](../../docs/architecture/frontend.md),
[`appearances.md`](../../docs/architecture/appearances.md),
[`docs/AppThemeGuidelines.md`](../../docs/AppThemeGuidelines.md). Run the `perf-budget` skill when
you change a `useQuery`/`useMutation` hook or a `useLiveCampaign` subscription.

## Verification

For changes in this tree:

1. `npm test -w @asohav/web` and `npm run typecheck -w @asohav/web`
2. For CSS or control changes, the `responsive-device-qa` skill: the smoke test plus its
   breakpoint review.
3. For sheet or GM Reference changes, `print:sheet` / `print:gm`, and look at the output.
