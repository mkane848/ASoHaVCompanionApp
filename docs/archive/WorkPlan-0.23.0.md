> **COMPLETED — archived.** Plan for `0.23.0`; shipped. Records intent at the time, not current
> behaviour — see `docs/architecture/` for that.

# Work plan — `0.23.0`

A planning-only session (2026-08-13) turned six pieces of repo-owner testing feedback into an
executable plan. **No code was written.** This document is the handoff: it carries the scoped work,
the decisions already locked with the repo owner, and the things deliberately *not* decided, so a
fresh session can start at PR 1 without re-deriving any of it.

Scoped against `a91c7a0` on `main` (`0.22.0`). Branch: `claude/ui-layout-form-architecture-jc4wyt`.

A rendered version of this plan was published as an Artifact for the repo owner:
<https://claude.ai/code/artifact/fca7a6d8-4677-4ced-a0ba-71fb40719610>. This file is the source of
truth — if the two disagree, believe this one.

## Decisions already locked

Confirmed directly with the repo owner during planning. Don't re-litigate these; they're answers,
not defaults.

| Question | Answer |
| --- | --- |
| Does Combat move inline for players too, or GM only? | **Inline for both**, and `/c/:id/combat` keeps working as a deep link. |
| What goes on a home tile? | GM name, party roster, Rapport, Kin (only when there is any), last played. Your own character is marked in the roster and **is** the sheet link — no separate "Open character sheet" button. |
| react-hook-form: adopt or not? | **Both tracks** — scoped RHF + zod *and* the shared field primitives + `commit()` rework. |
| Which way does Rank sort? | **Descending.** Most severe Status leads its group, so the GM reads the most impactful one per group at a glance. |
| Do pending invites stay above the tile grid? | **Yes.** Only the join-by-code field moves into the bottom row. |
| Is the silent +1 Rapport at Combat start intentional? | **No** — but keep the bump and surface it. Confirming the rule itself is deferred (see Open items). |
| zod as `@asohav/shared`'s first runtime dependency? | **Approved.** Record it as a judgment call — it's inherited by both server and web. |

---

## A — Home screen tiles

*From feedback 1: "use a flex layout or something similar to display a user's active campaigns like
tiles… Move the Join/Start New sections to the bottom, and make them share a row."*

`HomePage.tsx` currently stacks campaigns in a vertical `.list`, with the create-campaign card and
`InviteInbox` both sitting *above* it. The blocker is data, not layout: `/api/auth/me`
(`apps/server/src/routes/auth.ts`) returns only `CampaignName` and `CampaignStatus` per membership,
so there is nothing to put in a tile yet.

**1. Widen the wire contract.** Add a `CampaignOverview` to `packages/shared/src/api.ts`, attached
per membership on `MeResponse`: GM name, roster (character name, player name, `IsYou`), Rapport,
your own character's Kin, `LastPlayedAt`. Additive only — `MeResponse` is also consumed by
`App.tsx`/`AppShell.tsx`, so don't rename existing fields.

**2. Fetch it without an N+1.** Collect the user's campaign ids once, then issue a fixed set of
`.in('campaign_id', ids)` reads — characters, memberships, party, bonds, plus profiles for GM names
— and group in JS. That's five or six queries regardless of how many campaigns the user is in.
Follow the batching pattern PR #63 used for the campaign bootstrap route; do **not** loop per
campaign.

**3. Derive "last played" rather than storing it.** No such column exists. `character_sheets`,
`party`, `bonds`, and `combat_encounters` all already carry both `updated_at` and `campaign_id`, so
the max across those four is a reasonable proxy. The accurate alternative — a real
`campaigns.last_played_at` touched by every mutating route — costs a migration plus edits to eight
route files, and isn't worth it unless the derived value proves misleading in practice.

**4. Kin, only when there is Kin.** `Bond.KinTrack` is per-Bond between two characters, so a tile
shows your own character's Bonds with `KinTrack > 0`, as name plus track. A GM membership has no
character, so the row is simply absent — which is the same rule as "only if there is Kin to
display," not a special case.

**5. The layout.** `.list` becomes a grid (`repeat(auto-fill, minmax(300px, 1fr))`). Each tile keeps
the campaign name, Archived badge, and role it already has, and gains GM, roster chips (own
character marked, acting as the sheet link), Rapport, Kin when present, and last played. "Join a
campaign" and "Start a new campaign" move below the grid into a two-up row that stacks below 768px.

**6. Split `InviteInbox`.** It currently holds *both* pending invites and the join-by-code input.
Pending invites are time-sensitive and stay above the grid; only join-by-code moves down. This means
pulling the component into two pieces rather than relocating it whole.

> **Watch for:** the responsive harness builds `MeResponse` by hand in `apps/web/src/harness.tsx`.
> Without new fixture data the tiles render empty and the smoke test passes for the wrong reason.

---

## B — Combat in the GM view, and Status ordering

*From feedback 2: "move the Combat button out of the navbar and into the page, in its own section
like 'The party' and 'Invites'… the 'Combat' workflow should live within the GM view. Also order the
PC's Statuses by group (positive, neutral, negative), then rank, then alphabetically."*

### B1 — Combat moves into the page

Extract the "start form vs. live Encounter" switch out of `apps/web/src/pages/CombatPage.tsx` into a
`CombatPanel` component under `apps/web/src/features/combat/`. `CombatPage` becomes a thin route
wrapper around it (so the deep link keeps working), and `CampaignPage.tsx` renders the same panel in
a section styled like "The party" and "Invites" (`.sectionHead` + `.sectionTitle` + `.rule`). Remove
`.combatLink` from the banner in `CampaignPage.tsx` and its CSS.

The **player view gets the same section**, not just the GM's — players are the ones who apply
incoming Status offers, Interpose, Recuperate, Defend, and Help, so removing the navbar link without
an inline entry point would strand them. Place it in `PlayerView` above `CampaignBonds`.

> **Bundle regression risk — the main thing to get right here.** `EncounterView` and its three modals
> live only in the lazy `/combat` chunk today; that split is what took the main bundle from 674 kB to
> 613 kB in PR #70. Importing it directly from `CampaignPage` — which every player loads — puts all
> of Combat straight back into the main bundle. Lazy-load `CombatPanel` from the campaign page too,
> and render a cheap inline stub for the no-Encounter case so the chunk only downloads once a fight
> is actually running or the GM starts one. **Measure the bundle before and after**, don't assume.

### B2 — Status ordering

Add a pure `sortStatuses()` to `packages/shared` (next to the Status helpers in `engine.ts`), unit
tested: Positive → Neutral → Negative, then **Rank descending**, then name A–Z case-insensitively.

Apply it at `apps/web/src/features/campaign/PeekCard.tsx` (the GM's live peek — what the feedback
names) and at `apps/web/src/features/combat/ParticipantCard.tsx`, which renders the same flat chip
row and will now sit on the same screen.

**Deliberately not applied** to `StatusesPanel`'s rows on the player's own sheet. Those rows are
editable and already grouped by polarity with headings; sorting by Rank there would slide a row out
from under the player's finger as they tap pips to change that very Rank. Easy to reverse if the
repo owner wants it consistent everywhere.

---

## C — Character sheet layout

*From feedback 3: "Have Theme and Looks share a row. Put Virtues and Statuses in the top row."*

`0.22.0` made Theme and Looks full-width bands and left Virtues/Statuses as the only two-column pair.
Target order inside `.sheet-stack` (`apps/web/src/pages/CharacterSheetPage.tsx`):

1. `.sheet-grid` → Virtues | Statuses
2. a new `.sheet-pair` → Theme | Looks
3. Abilities & Skills, Load, Advancement, footer — unchanged, full width

Update the `PANEL_IDS` "in render order" comment at the bottom of that file.

**Virtues | Statuses keeps `.sheet-grid` exactly as it is.** This matters: the grid's deliberately
lopsided `minmax(280px,1fr) minmax(0,1.5fr)` ratio is what `StatusesPanel.module.css`'s 1024px
breakpoint math was derived against (see CLAUDE.md's long note on the `.rowHead` grid and Pips
width). Leaving it alone means none of that needs re-deriving. Theme | Looks is a different pairing
that wants an even split, so it gets its own `.sheet-pair` class in `layout.css` rather than reusing
a grid tuned for something else — document why, next to the existing `.sheet-grid` comment.

> **Re-check, don't assume.** Theme and Looks go from full-width back to half-columns, reversing what
> `0.22.0` just did to them. Two consequences: `.prose`'s 68ch cap becomes inert on them (harmless,
> but the `layout.css` comment describing those panels as full-width goes stale and should be
> corrected), and ThemePanel's Quest chips plus LooksPanel's editable chip list now have to fit
> ~350px at a 768px viewport. This repo has been bitten twice by carrying a spacing number across a
> layout change — derive it from the actual column width and run the smoke test.

---

## D — Combat styling and UX

*From feedback 4: "Update the Combat form to have consistent styling, best practices for ui/ux, etc."*

Findings, all located in the current code:

1. **Two inline style overrides** in `EncounterView.tsx` (lines 464 and 478) exist purely to undo
   `.headerButton`'s on-dark colors when it's reused inside a light section — the tell that one class
   is doing two jobs. Split it: keep `.headerButton` for the dark Encounter header, compose
   `btnSecondary` from `buttons.module.css` for light-context buttons.
2. **`--danger` is painting non-destructive actions.** `.offerButton`/`.offerSelect` render "Apply"
   and "Resist first" in the danger color, and get reused wholesale for the Reactions and Interpose
   sections, which aren't danger contexts at all. Reserve the red for the incoming-attack card's own
   framing.
3. **Two different section-heading treatments** — EncounterView's `.sectionTitle` and CampaignPage's
   `.sectionHead` + `.rule` — which, after B1, render on the same screen. Extract a shared
   `SectionHead` component.
4. **The initiative input is unlabeled**: a 48px `type="number"` whose only affordance is a `2d6`
   placeholder, with no min/max. The `0.19.0` app-wide label pass missed it.
5. **`AddParticipantModal` carries an inline `style={{ maxWidth: 80 }}`**, and its three tabs are
   styled buttons with no `role="tab"`/`aria-selected` — the active state is visual only.
6. **`CombatMoveModal`'s Apply disables silently.** A player can't tell which of target, tier, or
   status name is still missing.
7. **`Encounter.History` is written on every action and rendered nowhere.** Every `log()` call pushes
   an entry and no component ever reads the array. Recommendation: surface it as a collapsible log —
   it's the shared record a table actually wants mid-fight. The alternative is to stop writing it.

### Announcing the Start-Combat Rapport

Starting Combat grants the party +1 Rapport (`CombatPage.tsx:58`) with nothing in the UI saying so.
Per the repo owner: **keep the bump, make it visible.** Three parts:

- **Move the bump server-side** into `POST /combat/start` (`apps/server/src/routes/combat.ts`). It's
  currently a separate client-side `commitParty()` call sitting next to `lifecycle.start()`, so a
  failure on either side leaves an Encounter without its Rapport or the reverse. Doing both in the
  start route makes them land together.
- **Log it to `Encounter.History`** as the durable record, which finding 7 above is already
  surfacing.
- **Raise a Toast on every client.** No broadcast layer is needed: `useLiveCampaign.ts` already
  subscribes to `combat_encounters`, so every member's client is invalidated the moment an Encounter
  is created. Each client detects the `null` → new-Encounter transition itself.

> **Two details decide whether this feels right.** The transition must be tracked against the *last
> seen Encounter id*, not just "an Encounter exists" — otherwise anyone opening the campaign
> mid-fight gets told Combat just started. And `Toast` (`apps/web/src/components/Toast.tsx`) is an
> *error* banner by construction (`role="alert"`, danger styling), so it needs a neutral tone variant
> with `role="status"`. Reusing it as-is would announce a good thing in the danger treatment — the
> same mistake finding 2 is fixing.

---

## E — Form architecture

*From feedback 5: "Should we use react-hook-forms for form state management? Does that integrate well
with our current zustand and tanstack-query implementations? Are there any improvements we can make
to this architecture…?"*

**The answer to the question:** yes, RHF integrates cleanly, because the three libraries own
different things and don't overlap — TanStack Query owns server state, zustand owns cross-component
UI state, RHF would own ephemeral draft state inside a single form. Standard wiring is
`useForm({ defaultValues: fromQuery })`, a mutation in `onSubmit`, `reset()` on success.

**The caveat is where *not* to use it.** RHF keeps values in a ref-based store and deliberately
avoids re-rendering on change, which is precisely wrong for any field the server can push a new value
into over Realtime. That rules out the character sheet and the Encounter — you'd need a `reset()` on
every incoming sync, wiping whatever the player was mid-way through typing. Note the sheet already
solved this by hand: `StatusesPanel`'s name input is `defaultValue` + `onBlur`, which is RHF's
philosophy without the library.

### E1 — The `commit()` rework (do this first)

Highest-value item in either track. `useCommitSheet`, `useCommitParty`, and `useCommitEncounter`
(`apps/web/src/lib/mutations.ts`) all fire the API write **inside** a `qc.setQueryData` updater
callback. Consequences today:

- the network call is a side effect in a function that's supposed to be a pure updater;
- there is no rollback if the PUT fails — the cache keeps the optimistic value;
- failures reach `console.error` and nowhere the player can see, even though `Toast` already exists;
- if the cache entry is missing, the save silently never happens at all;
- every commit is a full-document PUT with no coalescing.

Move to a real `useMutation`: `onMutate` cancels in-flight queries, snapshots, and writes
optimistically; `onError` rolls back and raises a Toast; `onSettled` invalidates. **Keep the
`(draft) => void` signature identical** so none of the ~15 call sites need to change.

### E2 — Shared field primitives

Nine stylesheets currently declare their own `.label`, with `.input`/`.select` similarly re-declared
per component. Build `apps/web/src/components/form/` — `Field`, `TextInput`, `Select`, `NumberInput`,
`CheckboxRow`.

One constraint from this repo's own history (`CHANGELOG.md` 0.4.2): **only byte-identical CSS gets
unified.** Near-duplicates differing in size or spacing are usually real per-context variation, and
collapsing them is a design decision rather than a dedup. Audit first, extract the exact matches, and
say plainly which were left alone and why.

### E3 — Scoped react-hook-form, with zod shared server-side

Three surfaces: `CreateCharacterPage` (twelve `useState`s and real cross-field rules — array to
assignments, theme to quests, caps on skills/abilities), `AddParticipantModal`, `CombatMoveModal`.

The larger win is putting the zod schemas in `packages/shared` and importing them into
`apps/server/src/routes/characters.ts`, so character-creation validation stops being written twice.
That route is explicitly documented as having no other authorization layer to catch a missing check.

**Approved, but record it:** `@asohav/shared` has *zero* runtime dependencies today — types and pure
functions, imported from `dist` by both server and web. zod becomes its first, inherited by both
consumers, at ~13 kB gzipped on the client. That's a one-way door and belongs in
`README.md#architecture-notes--judgment-calls` (next free number is **22**), not just a lockfile.

### E4 — Follow-up, named but not scheduled

Once zod schemas exist, `normalizeSheet()`/`normalizeLibrary()` could become schema defaults instead
of hand-written backfills — retiring a bug class that has already produced one live crash (`0.16.1`)
and four versions of silently wrong gameplay math (`0.17.0`). Real scope of its own.

---

## F — Tooling

*From feedback 6: "if there are any skills, tools, MCPs that we should create or install…"*

**Nothing new to install.** What's already available covers this work:

- **`web-design-guidelines`** is the right lens for D, alongside **`theme-tokens`** for the
  inline-style and `--danger` misuse, and **`responsive-device-qa`** for A, B, and C.
- **Figma MCP** is connected, and this repo has a track record with it — the `0.22.0` sheet layout
  shipped from a workshop where the repo owner picked Option A + Option C. The home tiles and the
  Combat section are the same kind of open-ended layout call; workshop both there before writing CSS
  rather than shipping one guess and iterating.
- **Render MCP works now** and the workspace is confirmed: "My Workspace"
  (`tea-d9hs81ernols73aknf00`). This closes HANDOFF open issue 6, which had been stale.
- **No new skill yet.** A `form-conventions` skill only earns its keep once E lands and there's a
  convention worth pinning down.

---

## Order of work

Small, frequent PRs per repo convention. This order is a dependency chain, not a preference: the
`commit()` rework underpins everything that writes state, and the form rewrite goes last because
items 4–6 are still moving the forms it would touch.

| # | Change | From | Verify |
| --- | --- | --- | --- |
| 1 | `commit()` → real mutations with rollback and Toast | E1 | typecheck, tests |
| 2 | `sortStatuses()` + PeekCard and ParticipantCard | B2 | unit tests |
| 3 | Sheet layout: Virtues \| Statuses first, Theme \| Looks paired | C | responsive smoke |
| 4 | Home tiles + widened `/me` + bottom row | A | server tests, responsive smoke |
| 5 | `CombatPanel` extraction, inline sections, banner link removed; Rapport bump moved server-side and announced, Toast gains a neutral tone | B1, D | bundle size, server tests, responsive smoke |
| 6 | Combat restyle, shared `SectionHead`, History log | D | responsive smoke |
| 7 | Field primitives, then RHF + zod on three surfaces | E2, E3 | typecheck, tests, responsive smoke |

---

## Verification and paperwork

Every code-touching PR runs `npm run typecheck` and the full unit suite. Anything touching layout or
DOM structure also runs:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:responsive -w @asohav/web
```

**New smoke-test coverage needed.** Combat now renders inside the campaign page, so the `ROUTES` list
in `apps/web/scripts/responsive-smoke.mjs` needs `campaign (GM, active encounter)` and
`campaign (player, active encounter)` — the existing `encounter=1` fixture flag already supports
this. The harness also needs fixture data for the widened `MeResponse`, or the home tiles pass empty.

**Process note carried forward:** the responsive run takes 8–10 minutes in this sandbox, not the
"under a minute" the skill describes, and switching git branches mid-run corrupts the result (the dev
server it spins up serves whatever is currently checked out). Let each run finish before touching
branches.

**Docs and versioning.** `0.22.0` → `0.23.0` (MINOR: new server field and new behavior, no breaking
wire change), synchronized across all four `package.json` files, plus a `CHANGELOG.md` entry and a
`HANDOFF.md` session note. Three `CLAUDE.md` sections go stale and need updating in the same pass:

- the **Combat architecture** note — Combat is no longer its own screen;
- the **frontend conventions** note on sheet layout — the new `.sheet-pair`;
- a new **form architecture** note if E3 lands.

Plus `README.md` judgment call **22** for the zod dependency.

---

## Open items

Deliberately unresolved. Don't guess at these.

1. **Should Combat start grant Rapport at all?** Deferred by explicit decision. This pass makes the
   existing +1 visible; whether the rule is right stays unconfirmed against the Combat Basics draft.
   Come back to it with the repo owner.
2. **Live QA still isn't possible from a sandbox like this one.** Neither the Render URL nor the
   Supabase host is reachable, so none of this gets clicked through before it ships — unchanged from
   every prior session, and the reason the responsive smoke test carries so much weight. The Render
   and Supabase MCP tools work regardless, since they run outside the sandbox.
3. **`main` still has no required status checks** (HANDOFF open issue 7). Seven PRs is a lot of merges
   against a branch where a red CI run can't block anything. Worth fixing before this batch rather
   than after — needs an account admin, not a session here.
