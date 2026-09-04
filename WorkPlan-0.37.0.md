# Work plan — `0.37.0`

Three repo-owner improvement requests against `0.36.0`, the release that closed out the V0.5
migration. Each is independent; together they're one MINOR release. Written from a direct
repo-owner brief plus a codebase audit, not from `Planning Docs/Ruleset-V0.5.md` — nothing here is
a rules change.

> **Status: APPROVED by the repo owner (2026-09-04), not yet implemented.** This document is the
> only landed item; all three issues are unstarted. The decisions in "Decisions already locked"
> were put to the repo owner and answered — don't re-ask them. The audit findings in Issue 18 were
> verified against the actual code, not assumed — don't redo work the audit already established is
> unnecessary.

## Decisions already locked

Confirmed with the repo owner before this plan was written:

1. **Invite email uses a dual send path** — Supabase Auth `inviteUserByEmail` for an address with
   no account yet, Resend for an address that already has one. Not one or the other.
2. **The GM invite UI gains a copyable link and a resend button.** Persisted per-invite delivery
   status was offered and *not* selected — so this release needs no migration; the send response
   carries a transient result instead.
3. **"Write-in answers" means free text on fixed-choice fields only.** Custom user-defined fields
   per entry, glossary auto-linking on the three GM stat-block collections, and player-facing
   NPC/Location views were all offered and *not* selected. They stay unbuilt — read their absence
   as a decision, not an unfinished TODO.

---

## Issue 17 — Supabase invitations for the campaign invite system

### The problem

Sending a campaign invite writes an `invites` row and shows the GM a 4-digit code
(`InvitesPanel.tsx:29`). Nothing is emailed, and nothing tells the invitee. The GM has to read the
code off the screen and relay it by hand; there is no copy button and no shareable link.

Verified: the repo has **zero** email infrastructure — no `nodemailer`/`resend`/`sendgrid`/
`postmark` dependency, no SMTP env var, no `auth.admin.inviteUserByEmail` call anywhere.

### Why the send path has to branch

`inviteUserByEmail` *creates an auth user*, so it fails for someone who already has an account.
Resend can mail anyone but can't get a new user through signup. Neither alone covers both cases.

Supabase's built-in email service is documented as testing-only (best-effort delivery, a low hourly
rate limit, and in current projects restricted to project-team addresses), so **the Supabase leg
needs custom SMTP configured in the Supabase dashboard** before it delivers to real players. That's
a config-only step, not code — but the feature is not actually working until it's done.

### Server

- **`apps/server/src/email.ts`** (new) — the only place that talks to an email provider.
  - `sendInviteEmail({ to, campaignName, code, link })` →
    `Promise<{ delivered: boolean; via: 'supabase' | 'resend' | 'none'; error?: string }>`.
  - Looks the address up first to pick a leg. Prefer the existing `profiles` table (already queried
    by `admin.ts`) over paging `supabaseAdmin.auth.admin.listUsers`. Existing user → Resend;
    new → `inviteUserByEmail(email, { redirectTo: link })`.
  - **Never throws.** A provider failure returns `delivered: false` with the message. Sending an
    invite must not fail because email is down — the code still works by hand.
  - The Resend leg uses its **HTTPS API** via native `fetch`, not SMTP. Raw TCP is blocked in the
    sandboxes this project is developed in (see `CLAUDE.md`, "Sandbox network constraints"), so an
    SMTP client could never even be smoke-tested here. No new npm dependency — `fetch` is native on
    Node 22.
  - Reads `RESEND_API_KEY`, `INVITE_FROM_EMAIL`, `APP_BASE_URL`. **With `RESEND_API_KEY` unset the
    module no-ops with `via: 'none'`** — local dev and CI must not need a mail provider.
- **`apps/server/src/routes/campaign.ts`**
  - `POST /:id/invites` (line 152): after `insertInvite`, `await sendInviteEmail(...)`; respond
    `{ invite, delivery }` instead of `{ invite }`.
  - New `POST /:id/invites/:inviteId/resend` — same GM-only + `assertCampaignActive` guards as the
    two existing invite routes. Loads the invite, re-sends, responds `{ delivery }`. Refuses a
    non-`Pending` invite.
  - **Widen the invite code.** It's currently `'ROAD-' + Math.floor(1000 + Math.random() * 8999)`
    (line 169) — ~9,000 possibilities, looked up globally by `getInviteByCode`, with no uniqueness
    check. That's already thin; putting the code in an emailed URL makes a collision concretely
    reachable (two campaigns, one code, and `redeem` resolves to whichever row comes back). Move to
    a longer alphanumeric code with a retry on an existing hit. Existing codes keep working —
    `getInviteByCode` is an exact match and format-agnostic.
- **Link building** uses a new `APP_BASE_URL`, *not* the existing `WEB_ORIGIN` (which is the CORS
  origin and defaults to `http://localhost:5173`, wrong in production). Declare it in `render.yaml`
  alongside the two Resend vars.

### Web

- **`apps/web/src/lib/api.ts`** — `campaign.invite`'s return type gains `delivery`; add
  `campaign.resendInvite(id, inviteId)`.
- **`apps/web/src/features/campaign/InvitesPanel.tsx`** — per invite row, add a **Copy link**
  button (writes `${origin}/?invite=${Code}`), a **Resend** button (Pending invites only), and a
  transient success/failure line fed by the `delivery` result using the existing `Toast` component
  (`apps/web/src/components/Toast.tsx`, already used by `JoinByCode.tsx`). These are peers of equal
  weight → wrap them in **`.action-grid`** per the documented convention, not `flex-wrap`.
- **`apps/web/src/features/invites/JoinByCode.tsx`** — read `?invite=` via `useSearchParams` and
  prefill `code`. This is what makes the emailed link land somewhere useful: there is currently **no
  invite route at all** (`App.tsx` routes `/`, `/c/:id`, …, and `*` → `LoginPage` when signed out),
  so the link points at `/`, where `JoinByCode` already lives on `HomePage`. Prefilling beats adding
  a route — it reuses the entire existing redeem path, including
  `assertInviteActionable`'s email match.
- **`apps/web/src/App.tsx`** — signed-out case: line 37 sends `*` to `LoginPage` and drops the query
  string on sign-in. Preserve `?invite=` across auth, or a first-time player following the link
  loses the code at exactly the moment they need it.

### Docs (explicitly requested)

A `README.md` architecture-notes item and a `CLAUDE.md` section covering: the auto-email vs.
manual-relay split, that the code/link stays authoritative and email is best-effort, the Supabase
custom-SMTP prerequisite, and the three new env vars.

---

## Issue 18 — UI/UX cleanup in the Adventure panel

### Audit first — three of the six requested items are already satisfied

Verified against the code rather than assumed. Doing the requested work where it isn't needed would
be churn, so **don't**:

- **Touch targets are already fine.** `AdventuresPanel.module.css` sets `min-height`/`min-width:
  var(--tap-min)` on `.removeButton`, `.secretToggle`, and `.secretRemove`; the shared `.tap-inline`
  utility grows every other control to 44px on a coarse pointer. The responsive smoke test asserts
  this at seven viewports and CI is green. **No change.**
- **Appearance tokens are already clean.** `grep -E '#[0-9a-f]{3,8}|rgba?\(|hsla?\('` over both
  adventure stylesheets returns **zero** hardcoded colors; everything is `--ink-*`/`--gold`/
  `--panel`, and `AdventuresPage.module.css` correctly uses `--ink-on-ground` for text on the bare
  page background. **No change.** Note `.board`/`.posting` is deliberately scoped to the character
  sheet's tag collections (the appearance plan's decision 3) — its absence here is correct, don't
  add it.
- **Navigation/page chrome is already consistent.** `AdventuresPage.tsx`'s back link, `<h1>`,
  archived note, and shell class are a deliberate copy of `CombatPage.tsx`. The one real question is
  page *width* — see item 1 below.

### What actually needs doing

1. **The panel has no responsive layout at all.** `grep '@media\|@container'` over
   `AdventuresPanel.module.css` returns **nothing**. Every Adventure card is one stacked column from
   360px to 2560px, inside a page capped at `--content-form: 640px`. On a 1440p monitor that's a
   640px ribbon of stacked textareas with the rest of the screen empty — exactly the class of
   problem `npm run screenshot` exists to catch and the smoke test cannot.
   - Switch `AdventuresPage.module.css`'s `.page` from `page-shell-form` to **`page-shell`**
     (`--content-max: 1280px`). Adventure Prep is a multi-section working surface, not a form-shaped
     page like Create Character or the Combat deep link.
   - Give `.card` **`container-type: inline-size; container-name: adventure-card`** and pair its
     independent sections at a measured width via `@container` — the `0.24.0` precedent, where every
     `Panel` became its own container rather than hand-deriving a viewport breakpoint (see
     `AbilitiesSkillsPanel`/`LoadPanel`). Natural pairing: **NPCs | Locations** side by side (two
     equal ref-lists, both already `max-height: 220px` scrollers); Concept/Hook/Type stay full width.
   - Derive the threshold from the two ref-lists' real content width — don't guess it — then verify
     with the smoke test, per the `.pipsCell` lesson (two regressions, two full-matrix runs).
2. **Heading structure is flat.** The page has one `<h1>` and then nothing: card titles are
   `<span className={styles.title}>` (line 141) and every section is a
   `<div className={styles.sectionLabel}>` (Villain/NPCs/Locations/Secrets/Countdown), so
   screen-reader navigation by heading skips the whole surface. Make card titles `<h2>` and section
   labels `<h3>`, keeping the existing visual styling on those elements.
3. **The Villain `<select>` has no accessible name at all** (lines 189-199) — no `<label htmlFor>`,
   no `aria-label`, only a preceding unassociated `sectionLabel` div. Every other control in the file
   is correctly labelled, so this is a genuine miss, not a pattern. Associate it with its section
   heading (`id` + `aria-labelledby`), which item 2 provides for free.
4. **NPC/Location checkbox lists aren't grouped.** Wrap each `.refList` in `role="group"
   aria-labelledby={<its heading id>}` — the same shape `FieldEditor.tsx:164` already uses for
   `multiref`. Reuse that, don't invent one.
5. **Prose runs unbounded.** `.secretHint` renders `typeDef.summary` + `typeDef.elements`
   (line 174) — authored rules text, now full-width at 1280px. Apply the existing **`.prose`**
   utility (`layout.css`, `max-width: 68ch`) at the two hint call sites, matching how
   `ThemePanel`/`LoadPanel` handle the same problem.
6. **Local form styles duplicate the shared primitives.** `.textInput`/`.select`/`.textarea` are
   re-declared in `AdventuresPanel.module.css`, and the JSX uses raw `<label>`/`<textarea>`/
   `<select>` instead of `Field`/`Select`/`TextInput` from `apps/web/src/components/form/` (the
   `0.23.0` convention — the file already imports `CheckboxRow` from there, so it half-follows it).
   Migrate the labelled fields to `Field` + the primitives. **Scope guard**: the
   `onBlur`-commits-a-draft pattern these fields use is deliberate and load-bearing — keep it. This
   is a markup swap, not a move to react-hook-form.
7. **Countdown tick row.** `.tickRow`'s Advance/Back up are peers of equal weight → `.action-grid`.
   Disable Advance at max and Back up at 0 (`tickAdventureCountdown` already clamps, so this is
   affordance only, not a behavior change).

### Deliberately out of scope

**`GlossaryText` on Adventure prose.** The convention says every authored-prose render site gets it,
and this surface has several (Concept, Hook, Secrets, Countdown step text). But those fields are
*editable textareas*, not rendered prose — `GlossaryText` cannot wrap a `<textarea>`'s value. Adding
it would mean building a read/edit toggle per field, which is a feature, not a cleanup. Record it in
`HANDOFF.md` as a real known gap rather than half-doing it here.

---

## Issue 19 — Write-in answers for Villain, NPC, and Location

### Scope

**Free-text on fixed-choice fields only**, per the locked decision above.

### The important constraint: only *descriptive* enums get this

There are eight `type: 'enum'` fields in `schema.ts`, and they are not interchangeable:

| Field | Consumed by code? | Write-in? |
|---|---|---|
| `npcs.Type` (9 values) | No — `NPCType` appears only in `types.ts`/`schema.ts` | **Yes** |
| `locations.LocationType` (9) | No — only `types.ts`/`schema.ts`/seed data | **Yes** |
| `villains.Toughness`, `enemies.Toughness` | **Yes** — `applyToughness()` switches on `'Medium'`/`'Heavy'` | **No** |
| `moves.Kind`, `moves.AdvantageTrigger`, `improvementTrees.Category`, `items.Key` | Yes — all drive branching logic | **No** |

A write-in on `Toughness` would silently degrade to "no Toughness" in Combat with no error. So this
must be **opt-in per field**, never a blanket loosening of `FieldType: 'enum'`.

### Implementation

- **`packages/shared/src/schema.ts`** — add `allowCustom?: boolean` to `FieldDef`; set it on
  `npcs.Type` and `locations.LocationType` only. Update each field's `hint` to say a write-in is
  allowed.
- **`packages/shared/src/types.ts`** — widen the two field types to `NPCType | string | null` and
  `LocationType | string | null`, keeping the named unions exported so the nine canonical values stay
  documented and autocompletable. Additive wire-contract widening, not a rename — consistent with
  the "add fields, don't rename them" rule; existing JSONB rows stay valid.
- **`apps/web/src/features/admin/FieldEditor.tsx`** — for `allowCustom` enums render an
  `<input list="…">` + `<datalist>` instead of the `<select>` at line 146. **Reuse the exact pattern
  `AddCampAssetModal.tsx:46-58` already established** — the accessible, dependency-free "freeSolo
  autocomplete," native HTML, no combobox library. Plain enums keep the `<select>` unchanged.
- **`apps/server/src/adminLogic.ts`** — `validateLibrary()` currently does **not** validate enum
  values at all, so nothing rejects a write-in today and no validation needs loosening. Add a
  *warning* (not an error) for a non-canonical value on an `allowCustom` field, so the Validation
  panel surfaces "3 NPCs use a custom Type" as information — matching how it already reports dangling
  refs and unresolved glossary tags.

---

## Files touched

**New**: `apps/server/src/email.ts`, `apps/server/src/email.test.ts`.

**Modified**
- Invites: `apps/server/src/routes/campaign.ts`, `apps/web/src/lib/api.ts`,
  `apps/web/src/features/campaign/InvitesPanel.tsx` (+ its `.module.css`),
  `apps/web/src/features/invites/JoinByCode.tsx`, `apps/web/src/App.tsx`, `render.yaml`.
- Adventures: `apps/web/src/features/adventures/AdventuresPanel.tsx` (+ `.module.css`),
  `apps/web/src/pages/AdventuresPage.module.css`.
- Write-in: `packages/shared/src/schema.ts`, `packages/shared/src/types.ts`,
  `apps/web/src/features/admin/FieldEditor.tsx`, `apps/server/src/adminLogic.ts`.
- Docs + version: `CLAUDE.md`, `README.md`, `CHANGELOG.md`, `HANDOFF.md`, and the **four**
  `package.json` files bumped together to `0.37.0`.

**No migration.** Persisted delivery status wasn't selected, and the write-in change is a JSONB-blob
widening — neither needs a schema change. This release therefore skips the migration-not-applied
trap that has caused three real incidents (`HANDOFF.md` open issue 20).

---

## Verification

1. `npm run typecheck && npm run build && npm run test` — all green.
2. **New unit tests**, colocated `*.test.ts` per the existing convention:
   - `email.ts` with no `RESEND_API_KEY` returns `{ delivered: false, via: 'none' }` and does not
     throw; a provider error is caught and surfaced, never propagated.
   - The new resend route's GM-only + archived-campaign guards, following the route-authorization
     test pattern already in `apps/server/src/routes/*.test.ts`.
   - Invite-code generation: format, and that a collision triggers a retry.
   - The `allowCustom` validation warning.
3. **Responsive** — mandatory, since Issue 18 changes CSS:
   ```
   CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:responsive -w @asohav/web
   ```
   Full matrix, both appearances × seven viewports. Both adventure routes are already in
   `harnessConfig.mjs` (`adventure prep (empty, GM)`, `adventure prep (populated, GM)`), so the new
   container query and the width change are covered. Re-run after any fix, per the documented
   two-regressions-two-runs lesson.
4. **Screenshots** for the width/layout change, which the smoke test can't judge:
   ```
   SCREENSHOT_ROUTE=adventure npm run screenshot -w @asohav/web
   ```
   Compare 360 / 768 / 1024 / 1440 / 2560 before and after; confirm 640px → 1280px reads as
   deliberate rather than sparse at the widest widths.
5. **Email cannot be verified from the dev sandbox.** Raw TCP is blocked and headless Chromium can't
   complete a request to any external host through the proxy (`CLAUDE.md`'s measured table). Both
   provider legs get unit tests with a mocked `fetch`, and delivery must be **manually confirmed by
   the repo owner after deploy** — one invite to an address with an account, one without. Say this
   plainly in the PR rather than implying it was tested.
6. **Post-merge** (`release-reliability-checklist` step 5): confirm the Render deploy on service
   `srv-d9nqoqlaeets73ch25q0` reaches `live` with the merge commit — green CI is not a shipped
   change. Then set `RESEND_API_KEY` / `INVITE_FROM_EMAIL` / `APP_BASE_URL` in Render, and configure
   custom SMTP in the Supabase dashboard, before the email path will actually deliver.

## Order of work

Three commits, one per issue, then the docs/version bump. Sequenced smallest-and-most-verifiable
first:

- [ ] **PR 1** — this document.
- [ ] **PR 2** — Issue 19 (write-in `allowCustom`). Smallest, fully unit-testable.
- [ ] **PR 3** — Issue 18 (Adventure panel). CSS; needs the full smoke-test + screenshot loop.
- [ ] **PR 4** — Issue 17 (invite email). Largest surface; carries the manual post-deploy check.
- [ ] **PR 5** — `CLAUDE.md`/`README.md`/`CHANGELOG.md`/`HANDOFF.md` + the four-`package.json`
      bump to `0.37.0`.
