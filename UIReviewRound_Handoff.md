# UI Review Round — Implementation Plan Handoff

> **⚠ SUPERSEDED AS AN IMPLEMENTATION SPEC (2026-09-05). Do not build from this file.**
> The work is planned in **`WorkPlan-0.38.0.md`** (live campaign state — review items 1, 2, 3, 8)
> and **`WorkPlan-0.39.0.md`** (appearance default & sheet layout — items 4, 5, 6, 7), which run
> sequentially, in that order.
>
> **The review-round scope decisions below are still authoritative** — they came from the repo owner
> and neither work plan changes them. What is superseded is this file's *technical* guidance, which
> was written as a record of the review conversation rather than against a codebase audit. Five of
> its claims are wrong or stale; each work plan carries the corrections in full, but the one that
> matters most here:
>
> **"RLS verified Realtime-ready, no migration needed" (§1 and §3 below) is wrong.** `campaigns`,
> `memberships` and `characters` are **not** in the `supabase_realtime` publication — verified both
> against `supabase/migrations/` and by querying `pg_publication_tables` on the live project. The
> RLS policies really are already joinless and need no change; it is publication membership that is
> missing. Building §1 and §3 as written produces subscriptions that silently receive nothing.
> `WorkPlan-0.38.0.md` item 2 adds migration `0013` for this.
>
> The other four: Statuses columns need `.rowHead`'s viewport media query converted to a container
> query first (§5); `PeekCard` also hardcodes `/ 5` instead of the library track length (§6); §5's
> "other sheet panels" list names `AbilitiesSkillsPanel` and `.sheet-pair`, neither of which is in
> use any more; and the Combat phase gate (§7) breaks 8 existing `combat.test.ts` tests whose
> fixture has no `Phase`.

**Status:** Superseded as an implementation spec — see the banner above. Kept as the record of the
review round itself, and as the source the two work plans were written from.
**Branch:** `claude/ui-review-round-handoff-7t3m4k` (this file only — the implementation happens from
the two work plans named above, each on its own branch).
**Source:** A full UI review round with the repo owner across the Home page, the Campaign page state flow, the Character Sheet layout, and the Appearance system. Every scope decision below was confirmed directly with the repo owner during the review; do not re-litigate them.

---

## Review round — the full feedback list

1. **Home page** — screen space is not well utilized; better distinguish campaigns you *run* vs. campaigns you *play in*.
2. **"Create Your Character" discoverability + state-flow.** The whole "where is the campaign in its setup" story feels disjointed. The GM side and Player side each lack a sense of "what am I waiting on." **Answer given:** build a central **setup checklist** — a shared "where the campaign is" panel on both the GM and Player sides, with the setup steps and who's done what.
3. **Live state.** The state of a campaign should update live — no refresh when the GM closes signup and starts character creation. **Answer given:** live on **both** the Campaign page and Home tiles.
4. **Background / Motifs layout.** Looks should be one column **on the right at 33%**, Motifs at **66%**, side by side — not stacked.
5. **Motif components need rework.** Wasted screen space; the coloring makes text hard to read (dark `.board` under Notice Board behind transparent inputs — dark ink on dark cork).
6. **Columns, not rows (kanban/sprint feel).** Positive/Neutral/Negative should also be columns. General direction: shift things left/right, split into columns more often than rows. **Scoped answers given:** Statuses stays *in grid*, columns only at genuinely wide widths; apply column thinking to character sheet panels, the campaign state flow, and Home tiles.
7. **"The Party" Overview revamp.** Currently the GM live-peek shows "Potential 0/5" three times with no way to know which Motif it's about.
8. **Combat section gating.** Combat shouldn't render when it can't happen (e.g. during Party Creation). **Answer given:** UI hiding **and** server-side enforcement on `POST /combat/start` (409 when not `Playing`).

**End of review round confirmed by repo owner.** Appearance default also confirmed during the round: **Notice Board becomes the default appearance, and everyone who previously chose Parchment explicitly is reset to Notice Board** (one-time forced migration).

---

## Cross-cutting: default appearance flip to Notice Board + forced migration

- `DEFAULT_APPEARANCE` in `apps/web/src/lib/appearances.ts:18` → change to `'noticeboard'`.
- Inline no-flash scripts: `apps/web/index.html:14` and `apps/web/harness.html:15` default to `'parchment'` → flip their no-param default to `'noticeboard'`.
  - **harness.html must keep its `?appearance=` priority logic** — the responsive-smoke/screenshot matrix (`harnessConfig.mjs`) navigates with `?appearance=` to force each appearance deterministically. Only the *no-param fallback* flips to `noticeboard`.
- **One-time forced migration** (repo-owner call: everyone who explicitly chose Parchment is reset to Notice Board):
  - Add a one-time migration marker, e.g. a new localStorage key `asohav.appearance.migrated` (or a version stamp).
  - On first load with the new default, if the marker is absent: ignore/clear an existing `'parchment'` stored value → treat as default (`noticeboard`), write it, set the marker. Respect the stored value thereafter.
  - This logic must run in **both** `index.html`'s inline script and `loadAppearance()` in `apps/web/src/store/appearanceStore.ts` (they are kept in sync by hand — see the file's own comment). `harness.html`'s script also needs the same migration so the no-param case is consistent.
- **Tests to update:**
  - `apps/web/src/store/appearanceStore.test.ts` — "defaults to Parchment when localStorage has nothing" now expects Notice Board; add a forced-migration test (stored `parchment` + no marker → `noticeboard`; marker present → respects stored value; stored `noticeboard` → unchanged even without marker).
  - `apps/web/src/lib/appearances.test.ts` — default-agnostic, likely fine; re-check.
- **Docs** describing Parchment as the default (`README.md`, `CHANGELOG.md`, `CLAUDE.md`'s appearance section, `AppThemeGuidelines.md`) need updating.
- **Readability consequence:** since Notice Board becomes the DEFAULT, the Motif dark-card text-readability bug (item 5) becomes the default first impression and **must** be fixed in the same pass.

---

## 1. Home page — screenspace, running/playing lanes, live tiles

### Server: expose `CampaignPhase` on `/me`
- `apps/server/src/repo.ts` `listMembershipsWithCampaignForUser` (line ~221): change the select from `campaigns(name, status)` to `campaigns(name, status, phase)`; return `CampaignPhase` on each membership (the table is `campaigns.phase`, snake_case → `Phase`).
- `apps/server/src/routes/auth.ts` `/me`: include the phase on each membership. Cleanest: add `CampaignPhase: CampaignPhase` to the `MeResponse['memberships']` row shape in `packages/shared/src/api.ts:32`, alongside `CampaignName`/`CampaignStatus`.
- **No migration needed** — `phase` already exists as a column (`0009_campaign_phase.sql`); this is a select widening.
- Verify the existing `/me` route tests in `apps/server/src/routes/auth.test.ts` (if present) still pass.

### HomePage: two column-lanes (running vs. playing)
- `apps/web/src/pages/HomePage.tsx:49-54` currently renders one flat `.grid` of all memberships.
- Split `me.memberships` by `Role`:
  - **Running** = `Role === 'GM'`.
  - **Playing** = `Role === 'Player'`.
- Render two sections, each with a heading and its own grid, and make them **two side-by-side columns at ≥768px** (`HomePage.module.css`); stack on narrow. This directly answers "distinguish running vs playing" + "columns not rows."
- Keep the empty-state, `PendingInvites`, and the `JoinByCode`/create-campaign bottom row.

### Live home tiles
- Home renders from the `['me']` TanStack Query cache (`useMe`). To live-update tiles, subscribe to Realtime and invalidate `['me']`.
- New hook `apps/web/src/lib/useLiveHome.ts` (mirror `useLiveCampaign.ts`):
  - Subscribe `postgres_changes` on `campaigns` (filter `id=in.(<the user's campaign ids>)`), `memberships` (filter `user_id=eq.<me>` or `campaign_id=in.(...)`), and `characters`/`party`/`bonds` (filter `campaign_id=in.(...)`).
  - Invalidate `['me']` (and, for tiles, prefetch/`['bootstrap', id]` where useful).
- **RLS verified Realtime-ready, no migration needed:** `campaigns` policy uses `private.is_campaign_member(id, auth.uid())`, `memberships` and `characters` use `campaign_id` on the row's own column — all joinless (`supabase/migrations/0002_private_rls_helpers.sql:69-82`).

---

## 2. Campaign state flow — central setup checklist

### New shared component: `CampaignSetupChecklist`
- New `apps/web/src/features/campaign/CampaignSetupChecklist.tsx` (+ `.module.css`), rendered on **both** `GmView` and `PlayerView` of `apps/web/src/pages/CampaignPage.tsx`.
- A shared "Where the campaign is" panel: lists the workflow steps (Signup → Party Creation → Playing) as **columns/lanes** (kanban feel), showing per-step who's done what.
- Inputs: `phase`, `readiness` (`partyReadiness`, already exists in `packages/shared/src/logic.ts`), `members`/`characters` (from `CampaignBootstrap`), `membership.Role`, and (player) `myCharacter`.
- **GM lane:** each roster member + their ready state; the "Close signup" / "Start playing" actions live here (consolidate the current banner buttons — see below).
- **Player lane:** "Waiting for GM to start party creation" / the **"Create your character" CTA** (make it unmissable) / "You're ready — tap to undo" / "Waiting for GM to start playing."
- This is **presentation + centralization only** — `partyReadiness`, `CAMPAIGN_PHASE_TRANSITIONS`, and the existing phase routes already exist; no new game logic.

### Banner refactor
- `CampaignPage.tsx:77-95` currently holds all phase buttons/ready tag in the top banner. Move the phase actions into the checklist (or keep them but de-emphasized). Keep the phase transitions reachable and the `partyReadiness` readout.

---

## 3. Live state updates (no refresh) — Campaign page

- `apps/web/src/lib/useLiveCampaign.ts:30-62` currently subscribes to `party`, `bonds`, `character_sheets`, `combat_encounters`, `clocks`, `library`.
- **Add** subscriptions for `campaigns` (filter `id=eq.<campaignId>`), `memberships` (filter `campaign_id=eq.<campaignId>`), and `characters` (filter `campaign_id=eq.<campaignId>`), each invalidating `['bootstrap', campaignId]`.
- Effect: phase, readiness, roster, and character-creation changes appear live without refresh — satisfies the "GM closes signup → phase updates live" requirement.
- RLS already joinless (see `0002`); **no migration needed**.
- **Do NOT subscribe `adventures`** — keep the deliberate exclusion documented at `useLiveCampaign.ts:16-25` intact.
- The setup checklist reads live `bootstrap`, so it updates automatically once these land.

---

## 4. Background / Motifs — 33/66 side-by-side + rework

### Layout: Motifs 66% left, Looks 33% right
- `apps/web/src/features/sheet/BackgroundPanel.tsx` currently stacks `LooksPanel` then `MotifPanel` inside one collapsible `Panel` (`#p-background`, collapse key `background`), rendered as a full-width `.sheet-stack` band (`CharacterSheetPage.tsx:177`).
- Convert the panel body to a grid `grid-template-columns: 66% 33%` (**Motifs | Looks** — Looks on the right is the explicit ask) using a **container query** (`@container sheet-panel`), exactly like `LoadPanel`'s 1/3–2/3 split and `AbilitiesSkillsPanel`'s two-up (`Panel.module.css:22` establishes the container).
- Below the threshold: stack (keep current render order). Pick the container-query breakpoint where 66% still gives usable Motif cards, verified by real rendering + the responsive smoke test — not guessed.
- Keep the single collapse unit intact — the grid lives inside the panel body.

### Motif cards rework (wasted space + readability)
- **Readability (must-fix, becomes default appearance):** the three `.motif` cards use `className="board …"` (`MotifPanel.tsx:86`), which under Notice Board sits directly on the dark corkboard (`--board-bg`), with `--ink-85`/`--ink` transparent-input text → dark-on-dark.
  - **Recommended fix:** make each Motif card a light surface (`.posting`-style on the light `--panel`, or an explicit light `--panel` background on `.motif` that works in both appearances) instead of `.board`. Mirrors how Looks' `.chip` items already render readably as `.posting`.
- **Wasted space:** each card stacks Name → Skill Tags → Flaw Tags → Quest → Act Breaks/Forsakes as one tall column; three cards = a very long band.
  - Add a container-queried two-column layout **inside each card** (e.g. Skill Tags | Flaw Tags side by side at sufficient width), tighten vertical rhythm.
- Keep `TrackStepper`'s deliberate avoidance of `Pips` (`MotifPanel.tsx:190-194` comment) — don't reintroduce that overlay geometry.

---

## 5. Columns-not-rows (kanban) — Statuses + general

### Statuses: Positive/Neutral/Negative as columns at wide widths (in grid)
- `apps/web/src/features/sheet/StatusesPanel.tsx:267-274` currently renders three stacked `.board` groups.
- Introduce a container-query-driven **3-column** layout: below the width threshold groups stack (current behavior); at a wide enough `@container sheet-panel` width the three polarity groups sit side by side. Per the repo owner's "keep in grid, columns only at wide widths" call, 3-up only activates where the `.sheet-col` is genuinely wide enough — likely a **high** container-query threshold (the Statuses column is only ~564px at 1024px viewport; three ~170px columns would be unusable slivers). Test with real rendering + smoke test.
- Within a column, rows keep the existing `.rowHead` structure (name + pips + rank + remove) — no new per-row layout risk.

### Apply column thinking to other sheet panels
- `AbilitiesSkillsPanel` (already 2-up), `LoadPanel` (already 1/3–2/3), `AdvancementPanel` (already Potential|Rapport pairing) — review each under the columns-not-rows principle but only change where it genuinely improves; don't force.

---

## 6. The Party Overview — `PeekCard` Potential labeling (bug fix)

- `apps/web/src/features/campaign/PeekCard.tsx:84-86` currently:
  ```tsx
  {summary.Motifs.map((m, i) => (
    <span key={i}>Potential {m.Potential} / 5</span>
  ))}
  ```
  → label each with its Motif name:
  ```tsx
  {summary.Motifs.map((m, i) => (
    <span key={i}>{m.Name}: Potential {m.Potential} / 5</span>
  ))}
  ```
  `CharacterSummary.Motifs` is `{ Name, Potential }[]` (`packages/shared/src/logic.ts:112`), and the card headers already render `m.Name` (`PeekCard.tsx:24`). Trivial.
- **Broader revamp of the GM "The party" section** (`CampaignPage.tsx:207-213`): apply the columns-not-rows direction — e.g. arrange the footer stats / peek cards into columns (Virtues, Statuses, Motifs-Potential) rather than the flat one-per-sheet stacked card. Keep aligned with the phase-gated setup checklist from item 2.

---

## 7. Combat — hide + server-enforce until `Playing`

### UI (both views)
- `GmView` (`CampaignPage.tsx:215-218`) and `PlayerView` (`:255-262`) currently render `SectionHead title="Combat"` + `CombatPanel` unconditionally.
- Guard the whole Combat block behind `phase === 'Playing'` (phase already derived at `CampaignPage.tsx:50` and passed into both views). When not `Playing`, render nothing for Combat (no heading, no "No Combat right now").
- Clocks stay as-is (legal pre-Playing; unchanged).
- Note the existing lazy-import comments assume "a GM always needs the start-Encounter form" — that reasoning is now superseded by phase gating; update the comments.

### Server
- `apps/server/src/routes/combat.ts` `POST /start` (line ~13): after the existing GM-role/`assertCampaignActive` checks, reject when `campaignPhase(campaign) !== 'Playing'` with `409`. Add an `assertPlayingPhase` helper in `packages/shared/src/logic.ts` (alongside `assertPartyCreationPhase`, line ~380) or inline the check.
- **Tests:** add/extend route tests in `apps/server/src/routes/combat.test.ts` and `logic.test.ts`, mirroring `assertPartyCreationPhase`'s existing coverage (`logic.test.ts:180-191`). A campaign in `Signup`/`PartyCreation` → 409; `Playing` → 201.

---

## 8. Design-token / appearance regression check

- Motif card fix and Statuses column layout must be verified under **both** appearances (Notice Board is now the default).
- Run the responsive smoke test (both appearances) after any CSS change — the `0.26.0` lesson: the doubled matrix exists because Parchment-only hand arithmetic missed real regressions (e.g. the `--posting-pad-x`/`--board-pad` squeeze breaking Statuses pips at 360px under Notice Board).
- `apps/web` unit tests (`appearances.test.ts`, `appearanceStore.test.ts`, `lib/api`/`lib/appearances`/`useGlossaryMatcher`/stores) must pass.

---

## 9. Docs (working convention)

Update, per the "author docs, not just code" convention:
- `CHANGELOG.md` — new version entry (bump all four `package.json`s together, tag `vX.Y.Z` per the versioning policy).
- `README.md` — architecture notes / judgment calls (appearance default flip + forced migration, Combat phase gating, Home lanes, Background 33/66, Statuses columns, PeekCard label).
- `HANDOFF.md` — close out this review round; note the plan is approved and implemented.

---

## Files touched (summary)

- `packages/shared/src/api.ts` (MeResponse membership gains `CampaignPhase`), `packages/shared/src/logic.ts` (new `assertPlayingPhase`), tests.
- `apps/server/src/repo.ts` (`+phase` select), `apps/server/src/routes/auth.ts` (pass Phase), `apps/server/src/routes/combat.ts` (phase gate), tests.
- `apps/web/src/lib/appearances.ts`, `apps/web/src/store/appearanceStore.ts`, `apps/web/index.html`, `apps/web/harness.html`, `appearanceStore.test.ts`.
- `apps/web/src/lib/useLiveCampaign.ts` (+3 subs), new `apps/web/src/lib/useLiveHome.ts`, `apps/web/src/pages/HomePage.tsx` + `.module.css`, `apps/web/src/pages/CampaignPage.tsx` + `.module.css`.
- `apps/web/src/features/sheet/BackgroundPanel.tsx`, `MotifPanel.tsx` + `.module.css`, `LooksPanel.tsx` + `.module.css`, `StatusesPanel.tsx` + `.module.css`.
- `apps/web/src/features/campaign/PeekCard.tsx` + `.module.css`, new `apps/web/src/features/campaign/CampaignSetupChecklist.tsx`.
- New handoff file (this document).

---

## Decisions to confirm during execution (not blocking review)

- Exact container-query breakpoints for the Statuses 3-column and Background 33/66 (verified via real rendering + responsive smoke test, not guessed).
- Whether the phase buttons move fully into the setup checklist or stay in the banner (presentation choice).
- The one-time appearance-migration mechanism's marker key (`asohav.appearance.migrated` or a version stamp).

---

## Verification

- `npm run typecheck`, `npm run build`, `npm test`, and the responsive smoke test (`apps/web/scripts/responsive-smoke.mjs`) across both appearances.
- Manual: Home lanes split correctly; phase changes appear live on Campaign page + Home without refresh; Combat hidden pre-`Playing`; `POST /combat/start` 409s pre-`Playing`; Background 66/33 renders; Motif text readable under Notice Board (now default); Statuses 3-up at wide widths; PeekCard labels each Motif's Potential.