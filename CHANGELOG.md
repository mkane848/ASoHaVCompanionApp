# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## Versioning policy

This is a private, unpublished monorepo (every package in `apps/*` and `packages/*` is
`"private": true`) — nothing here is installed as a dependency by anyone outside this repo, so
there's no external consumer whose builds break on a version bump. We still follow
[Semantic Versioning](https://semver.org/), synchronized across all four `package.json` files
(root, `@asohav/server`, `@asohav/web`, `@asohav/shared`) rather than versioned independently,
since they only ever ship together:

- **MAJOR** (`1.0.0` and up): reserved for once the app is in real use — a change that breaks
  existing data or existing users' sessions/accounts.
- **MINOR**: new functionality or a notable internal architecture change (a new feature, a swapped
  transport layer, a schema change).
- **PATCH**: backward-compatible fixes — a bug fix, a config/deploy fix, no behavior change a user
  would notice.
- Per [SemVer §4](https://semver.org/#spec-item-4), `0.y.z` means initial development: the surface
  is not yet considered stable, so a MINOR bump (not MAJOR) is used for breaking internal changes
  pre-1.0 — this is why `0.1.0 → 0.2.0` below covers a full auth/data-layer rewrite.

Bump all four `package.json` files together when cutting a version, add a entry below, and tag the
merge commit `vX.Y.Z`.

Entries carry a full UTC timestamp (`YYYY-MM-DDTHH:MM:SSZ`) as of `0.4.0`, not just a date —
the About modal displays it converted to the viewer's own local time. Entries before `0.4.0`
stay date-only; that's what shipped, and rewriting history to add a fabricated time would be
worse than leaving it alone.

## [0.5.1] — 2026-08-04T01:18:55Z

Bug fix, prompted by the repo owner's own testing: the GM live-peek view (Campaign Shell) would
sometimes fail to reflect a player marking a Condition (or any other sheet change) until some
later, unrelated write to that same sheet went through — the change was always saved correctly,
it just didn't show up live.

- **Root cause**: `character_sheets`' RLS SELECT policy ("owner or gm can view sheet") was the one
  Realtime-subscribed table whose policy still did an inline join out to `characters`
  (`exists (select ... from characters c where c.id = character_sheets.character_id ...)`), left
  over from before migration `0005` added a `campaign_id` column directly to `character_sheets`.
  `0005` updated the Realtime subscription *filter* (`useLiveCampaign.ts`) to use the new column,
  but never updated this SELECT policy to match — it kept the join. `party`/`bonds`, whose
  policies were always a single joinless `private.is_campaign_member(campaign_id, uid)` call, never
  had this problem. Realtime's `postgres_changes` authorization check does not reliably evaluate an
  RLS policy that joins out to another table, so the GM's live-peek subscription could silently
  miss a `character_sheets` change; the next `GET /bootstrap` — triggered by literally any other
  Realtime event — would always pick up the true (already-saved) state, which is exactly the
  "shows up on the next change" symptom reported.
- **Fix**: migration `0006_sheet_realtime_rls.sql` adds `private.can_view_sheet(campaign_id,
  character_id, user_id)`, a joinless SECURITY DEFINER function in the same shape as
  `is_campaign_member`/`is_gm`, and repoints the `character_sheets` SELECT policy at it. Applied
  directly to the live Supabase project and confirmed against `pg_policy` that the new policy body
  is join-free; the security advisor shows no new findings. See `CLAUDE.md`'s Realtime section for
  the general rule this establishes (SELECT policies backing a Realtime subscription must be
  joinless, not just the subscription filter).
- Investigated `HANDOFF.md` item 10 (inconsistent on-click behavior, Statuses specifically) at the
  same time, since it was flagged as a plausible contributor to "latency with live updates." Built
  a Playwright repro against `harness.html` driving real touch `tap()` events (not synthetic
  `.click()`) at the Virtues Condition toggle and at a Status's rename-input-then-Pip sequence
  (the specific "onBlur races onClick" scenario item 10 called out) — every case produced exactly
  one state change per physical tap, with no double-fire or missed-tap behavior reproduced. Not
  fixed here because nothing reproduced to fix; still needs the repo owner to reproduce and
  describe (device/browser, single vs. double tap) if it recurs — see `HANDOFF.md` item 10.

## [0.5.0] — 2026-08-04T00:03:43Z

First round of post-audit UX/product feedback, across all three surfaces:

- **Character Sheet**
  - Virtue scores are now read-only on the sheet — the `VirtuesPanel` +/- steppers are gone.
    Raising a Virtue only happens by taking the "Raise a Virtue by 1" Potential Advancement, which
    now actually applies (previously it just recorded that you'd taken it and left `sheet.Virtues`
    untouched — the player had to separately use the stepper, with nothing stopping them from
    stepping up a Virtue without ever taking the Advancement).
  - Theme is likewise locked — no more free `<select>`. Changing Theme only happens by taking the
    "Change your Theme" Advancement, which now opens a Theme picker and preserves completed Quests
    (previously the free-editing dropdown wiped `AcceptedQuests` entirely, contradicting the
    Advancement's own text).
  - Spending a Kin is now unilateral: it applies immediately with no handshake, while Mark Kin and
    Forge Bond still require the other player's Accept. See "Judgment calls" below.
  - Load & Item Charges: each item is now individually collapsible (plus a "Collapse/Expand all
    items" toggle), and the list sorts carried items first, alphabetically within each group.
  - Any button on the sheet that bulk-resets state — Make Camp, Refresh all Armor, Import JSON —
    now confirms first via a new shared `ConfirmModal` component.
  - The sheet's Kin & Bonds box can now Accept/Decline an incoming proposal or Withdraw an
    outgoing one directly — previously it only showed "answer it in the Campaign view."
  - The Moves drawer gained a Virtue filter row and groups moves by Virtue in collapsible sections
    (was a flat, search-only list).
  - Conditions got an explicit checkbox glyph on the tap target — it was a plain uppercase pill
    with no visual cue that it was clickable.
  - New `InfoTooltip` component surfaces description text that was already in the data model but
    never rendered: a Virtue's Essence and "use it when..." text, and an Armor Type's Description.
- **Campaign Shell**
  - The home screen can now create a new campaign (`POST /api/campaigns`, previously only wired
    up for the dev seed script) — a name field and a button, landing GM-side in the new campaign.
  - The GM's party roster is a capped 2-column grid above the tablet breakpoint instead of
    flex-wrap with a fixed 330px basis, which packed a 4-person party as 3-then-1; an odd leftover
    card centers instead of stretching full-width.
- **Content Admin**
  - Reorganized the nav from "Game objects" / "Tools" into **Core** (Abilities, Armor Types,
    Conditions, Items, Moves, Skills, Virtues), **Narrative** (Quests, Themes), **Advancements**
    (Potential, Rapport), and **Tools** (History, Import / export, Settings, Validation) — each
    group alphabetical. Advancements are still one `advancements` collection under the hood, split
    into two nav entries by `Track`; see "Judgment calls" below.
- **Navbar**: "ASoHaV" is now "A Story of Heroes and Villains" at tablet width and up. Below that
  it stays "ASoHaV" — the full name doesn't fit the phone-width budget documented in `layout.css`
  (the same constraint the "Content Admin"/"Admin" label swap already works around).
- Filed, not fixed: reported inconsistent on-click behavior on Statuses (and possibly other tap
  targets) — see `HANDOFF.md` item 10.

### Judgment calls

- **Spending Kin no longer goes through the Bond handshake.** `README.md`'s architecture notes
  (judgment call 1) previously treated Mark Kin, Spend Kin, and Forge Bond identically — every
  Bond change was a propose/accept/reject handshake, justified purely as a data-integrity measure
  ("two people can write one record"). The game's own rules text (`Planning Docs/.../Advancements.md`)
  draws a real distinction the software design didn't: "either PC on the Bond Track can spend Kin,"
  versus Forging, which needs both to agree. `SpendKin` now applies immediately
  (`applySpendKin()` in `packages/shared/src/logic.ts`, called directly from the `/propose` route
  in `apps/server/src/routes/bond.ts` rather than going through `PendingChange`) and is logged to
  `Bond.History` with a new `'spent'` action. Mark Kin and Forge Bond are unchanged. The row lock
  (`withBondLock`) still serializes concurrent writes to the same Bond, so this doesn't reopen the
  original race-condition concern — it just removes the *approval* requirement for this one action.
- **Admin nav grouping is presentation-only.** `packages/shared/src/schema.ts`'s `collections`
  array (and its order) is untouched — `DataView`'s library-contents summary and anything else
  that iterates it still sees the original dependency-ordered list. The Core/Narrative grouping and
  alphabetization live entirely in `AdminNav.tsx`.
- **Skills and Abilities went under Core**, and **Advancements split into Potential/Rapport only**
  (no separate "Kin" nav item — there's no Kin library content to administer; `KinTrackLength`
  stays where it already was, under Tools → Settings). The feedback that requested this reorg
  didn't place Skills/Abilities or say what to do about Kin explicitly; these were flagged back to
  the repo owner as open questions, but implemented with the choices above (rather than blocking)
  when the session was told to keep moving — worth a quick confirm that this is what was wanted.

## [0.4.2] — 2026-08-03T21:00:00Z

- CSS Modules follow-up cleanup pass, in four parts (no visual changes intended except where
  noted):
  - `AboutModal`'s header padding now matches the shared `modal.module.css` `.head` (`20px 24px
    12px`) instead of its own `24px 24px 4px` override — the inconsistency flagged in `HANDOFF.md`
    item 8.
  - Consolidated 30 of the 36 hardcoded `rgba(42, 32, 26, …)` ink-opacity literals across
    `apps/web/src` into `--ink-*` tokens: seven new stops added to `tokens.css` (`--ink-75` through
    `--ink-50`) for values that repeated 2+ times, plus two exact matches of pre-existing tokens
    fixed in place. The remaining 6 are genuine one-off decorative values (texture gradients, a
    couple of single-use tints) and were left as literals rather than forced into tokens they don't
    share with anything. `LoginPage.module.css`'s stray `background: #fff` (the only hex color
    outside `tokens.css`) now reads `var(--panel)`, matching the app's parchment palette instead of
    pure white.
  - Added the missing 44px coarse-pointer touch-target sizing to four interactive elements that had
    fallen through the responsive audit: `AdminListPane`'s clickable record row, `FieldEditor`'s
    multiref chip buttons, `LoadPanel`'s load-tier selector, and `adminShared`'s `.primaryButton`
    (used by both the admin export and settings-save buttons).
  - Extracted the CSS that was byte-identical across multiple components into two new shared
    stylesheets, composed in via CSS Modules `composes: ... from`: `apps/web/src/styles/buttons.module.css`
    (the solid dark "primary action" button treatment, used by 10 components) and a `.backLink`
    class added to `apps/web/src/features/admin/adminShared.module.css` (the admin back-navigation
    link, previously duplicated verbatim between `AdminPanelPage` and `AdminListPane`). Only
    properties that matched exactly across every consumer were extracted — near-duplicates that
    differed in font-size, letter-spacing, or color (an "eyebrow" uppercase label pattern used 40+
    times, an outlined "ghost" button pattern, and a card/panel wrapper pattern) were deliberately
    left alone; audited and found to encode real per-context variation rather than copy-paste drift,
    so unifying them would be a type-scale/design decision, not a mechanical dedup.

## [0.4.1] — 2026-08-03T19:23:10Z

- Fixed the seeded demo campaign (`cm-1`) crashing the Campaign page on load. `apps/server/src/seed.ts`
  inserted `memberships` before `characters`, but player memberships reference a `CharacterId` that
  doesn't exist yet at that point in the loop, tripping the `memberships_character_id_fkey`
  constraint and aborting the seed run right after the GM's own membership — characters, sheets,
  party, and bonds never got written. `apps/server/src/routes/campaign.ts` then force-cast the
  resulting `null` party with `party!` and shipped it to the client, which crashed reading
  `boot.party.Rapport` unguarded. This was the issue tracked as unresolved in `HANDOFF.md` item 1
  ("loading error" after login). Characters now insert before memberships, and `campaign.ts`
  self-heals a missing party row instead of lying about non-null. The live Supabase project's
  partially-seeded `cm-1` campaign was also repaired directly.

## [0.4.0] — 2026-08-03T17:51:25Z

- Full responsive audit and fixes across the Character Sheet, Campaign Shell, and Content Admin:
  44px touch targets everywhere without changing the design's visual density, a deliberate
  768px/1024px breakpoint set (replacing accidental ones that fell out of flex-wrap arithmetic),
  collapsible sheet panels with persisted state, and a nav → list → detail drill-down for Content
  Admin below 1024px. Added `apps/web/harness.html` (renders the real app against seed fixtures,
  no server) and a `test:responsive` check wired into CI so this can't silently regress.
- Fixed an app-bar bug the new check caught on `main` before this release: at 360px the bar wrapped
  onto two lines, and the brand's and Sign out's touch targets overlapped by 7px — a tap near the
  logo could sign a player out.
- Migrated the entire UI from inline `style={{...}}` objects to CSS Modules in cascade layers
  (`tokens → base → components → utilities`), removing every `!important` from the shared
  stylesheet in the process — all fourteen existed only to out-rank inline styles that no longer
  exist. Along the way: non-primary sheet panels regained a top border they'd silently lost to a
  React quirk (`borderTop: undefined` clears the property rather than no-op'ing), and the
  sign-in screen — never previously covered by the responsive check — turned out to overflow its
  viewport at 360px and had two sub-44px inputs; both fixed.
- The About modal's release date is now a full timestamp rather than a bare date (this entry).

## [0.3.0] — 2026-08-02

- Bond handshake (`propose`/`accept`/`reject`) now takes a real Postgres row lock
  (`SELECT ... FOR UPDATE` in a transaction via a direct `pg` connection) instead of a
  check-then-write through `supabase-js`/PostgREST, closing a race where two concurrent requests
  against the same Bond could silently clobber each other.
- Real-time transport switched to Supabase Realtime; the hand-rolled server-side WebSocket layer
  is retired entirely. `character_sheets` gained a `campaign_id` column
  (`supabase/migrations/0005_sheet_campaign_id.sql`) so Realtime's equality-only filters can scope
  it by campaign.
- Added Render deployment config (`render.yaml`): a single Web Service (the server already serves
  the built client from the same origin, so no separate static site is needed), plus a build-step
  fix (`NPM_CONFIG_PRODUCTION=false`) for `NODE_ENV=production` silently stripping devDependencies
  npm needs to compile the server's TypeScript.
- `packages/shared` was still at `0.1.0` (missed in the 0.2.0 bump below, despite carrying real
  changes since) — synchronized to `0.3.0` along with the other three packages here.

## [0.2.0] — 2026-08-02

- Migrated auth from a hand-rolled scrypt+cookie system to Supabase Auth (`supabase-js` on the
  client; the Express server verifies the resulting JWT and still enforces all authorization
  itself).
- Migrated the data layer from `node:sqlite` to Postgres via Supabase (`repo.ts` rewritten against
  `supabase-js`, service-role client).
- WebSocket auth moved from a session cookie to a `?token=` query param, with message buffering for
  the now-async auth handshake.
- Seeding rewritten to create the five dev accounts through the Supabase Auth admin API.

## [0.1.0] — 2026-08-02

- Initial build: player Character Sheet, Content Admin panel, and Campaign Shell (roster, invites,
  GM live-peek, Bond handshake), against a `node:sqlite` + hand-rolled cookie-auth backend.
