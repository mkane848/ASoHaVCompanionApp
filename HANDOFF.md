# Handoff

Status snapshot and open threads for whoever (human or Claude) picks this project up next. If
you're starting new work here, read this first — especially "Open issues" below, so you don't
duplicate a fix or lose track of something already in flight.

Last updated: 2026-08-03, end of the session that took the app from `0.3.0` to `0.4.0`: a full
responsive-UI audit and fix pass, then a follow-on migration of the entire UI from inline styles
to CSS Modules. See [CHANGELOG.md](CHANGELOG.md) for the version-by-version detail and
[README.md](README.md#architecture-notes--judgment-calls) for design decisions and rationale.

A follow-up session the same day added [CLAUDE.md](CLAUDE.md), no other changes — codebase
architecture and conventions written down for future Claude Code sessions to load automatically.
No version bump for this; it's documentation-only.

A third session the same day (`0.4.2`) did a CSS Modules follow-up cleanup pass, requested
explicitly to settle the styling foundation before the next round of work moves on to cosmetic/UX
feedback (colors, tooltips, controls). See `CHANGELOG.md` 0.4.2 for the full list. In short: fixed
the `AboutModal` padding inconsistency (item 8 below, now resolved), consolidated most of the
hardcoded ink-opacity `rgba()` literals into `--ink-*` tokens, added the 44px touch target to four
elements the responsive audit had missed, and extracted two small shared stylesheets
(`styles/buttons.module.css`, `adminShared.module.css`'s new `.backLink`) for CSS that was
byte-identical across components. Deliberately did *not* try to unify the "eyebrow" uppercase-label
pattern (40+ near-duplicate instances), the outlined "ghost" button, or the card/panel wrapper —
audited each and found real per-context variation in font-size/letter-spacing/color, not copy-paste
drift, so collapsing them would be a type-scale decision, not a mechanical dedup. Worth revisiting
deliberately if/when a formal type scale comes up during the upcoming UX pass.

A fourth session (2026-08-04, `0.5.0`) implemented the first round of post-audit UX/product
feedback — the "cosmetic/UX feedback (colors, tooltips, controls)" flagged as upcoming above. See
`CHANGELOG.md` 0.5.0 for the full list (Virtue/Theme locking tied to Advancements, unilateral Spend
Kin, collapsible/sorted Load items, confirmation modals on destructive sheet buttons, Bond
accept/reject from the sheet, a Moves Virtue filter with collapsible grouping, a checkbox affordance
on Conditions, new Virtue/Armor-Type tooltips, a Create Campaign flow, an evenly-spread GM party
grid, the Admin nav reorg into Core/Narrative/Advancements/Tools, and the navbar's full game-title
text above tablet width) and `README.md#architecture-notes--judgment-calls` items 7 for the Spend
Kin rationale. Two feedback items from that pass are explicitly **not** done yet:
- Item 10 below (inconsistent on-click behavior on Statuses) — investigation deferred on purpose.
- The Admin nav's exact grouping of Skills/Abilities and whether Advancements needed a "Kin" entry
  weren't specified by the feedback; implemented with a stated best guess (see `CHANGELOG.md`
  0.5.0's "Judgment calls") rather than left half-done, but worth a quick confirm from the repo
  owner that the guess landed right.

A fifth session (2026-08-04, `0.5.1`) tracked down the repo owner's report of "latency with live
updates when marking a Condition" plus fresh testing that found the GM live-peek view sometimes
missing a marked Condition until a later, unrelated sheet change. Root-caused as a single bug:
`character_sheets`' RLS SELECT policy was the one Realtime-subscribed table whose policy still did
an inline join out to `characters` (left over from before `0005` added `campaign_id` directly to
the row — `0005` fixed the Realtime *filter* but never updated this policy to match), and
Realtime's `postgres_changes` authorization check doesn't reliably evaluate a joined policy. Fixed
in migration `0006_sheet_realtime_rls.sql` (applied directly to the live Supabase project via the
Supabase MCP tool and confirmed via `pg_policy`) — see `CHANGELOG.md` 0.5.1 for the full writeup
and `CLAUDE.md`'s Realtime section for the general rule this establishes. Also investigated item 10
below (inconsistent on-click behavior) as a possible second contributor: built a Playwright repro
against `harness.html` using real touch `tap()` events at the specific scenarios item 10 flagged
(Condition toggle, Status rename-input racing a sibling Pip click) and found no double-fire or
missed-tap in any case — so item 10 stays open and unconfirmed, not folded into this fix.

A sixth session (2026-08-04, `0.6.0`) closes out the open question from the fourth session's note
above ("whether Advancements needed a 'Kin' entry ... worth a quick confirm from the repo owner").
The repo owner raised it themselves: Kin wasn't being classified as an Advancement track at all,
and `Planning Docs/.../Advancements.md` backs that up — confirmed with the repo owner and fixed.
See `README.md#architecture-notes--judgment-calls` item 8 and `CHANGELOG.md` 0.6.0 for the detail.
Short version: `AdvancementTrack` now includes `'Kin'`, and Content Admin's Advancements nav group
has a third **Kin** entry explaining it's handled live through the Bond handshake rather than
authored content. Forging a Bond deliberately stays freeform (confirmed with the repo owner, not
changed to a library-content pick) — this was a classification/nav fix, not a new mechanic.

A seventh session (2026-08-04, `0.7.0`) is the first of a four-PR batch of campaign-management
features requested by the repo owner: user account admin, an invite join flow + character
creation, Bond pending-confirmation badges + player-authored Kin reasons, and campaign
archive/admin-delete, each its own PR held for approval before the next starts. This PR is the
invite join flow, character creation, and the "Seelie" seed campaign — see `CHANGELOG.md` 0.7.0
for the full list and `README.md#architecture-notes--judgment-calls` item 2 for the
character-creation scoping rationale. Also added `vitest` to the monorepo for the first time (see
`CLAUDE.md`'s Commands section) — CI now has four jobs (`build`, `typecheck`, `test`,
`responsive`) instead of three. Landed as `0.7.0` rather than `0.6.0` (as originally drafted)
because the sixth session's Kin-Advancement-track PR merged to `main` first and claimed `0.6.0` —
this branch was rebased on top of it and renumbered rather than colliding. **Not yet applied to
the live Supabase project**: migration `0007_invite_declined_status.sql` is committed but unrun
against the live database — same sandbox networking constraint as always (see "Sandbox network
constraints" below), so it needs to be applied (directly via the Supabase MCP tool, or via the
Supabase dashboard) before this reaches production, the same way `0006` was in the fifth session.

An eighth session (2026-08-04, `0.8.0`) is the second of the four-PR campaign-management batch
(see the seventh session above): admin user account management and admin-only deletion of
Campaigns/Character Sheets, both new "Accounts"/"Play Data" groups in the Content Admin nav. Users
are listed by joining Supabase Auth's identity with `profiles`; password reset generates a
one-time recovery link for the admin to relay (no outbound email is configured for this app, so it
can't send it itself), never a settable password field. Campaign/character delete rely on the FK
cascades already in `supabase/migrations/0001_init.sql` — no new migration needed this session.
See `CHANGELOG.md` 0.8.0 for the full list.

A ninth session (2026-08-04, `0.9.0` — renumbered from a `0.8.0` draft that collided with the
eighth session's PR merging first, same as the seventh session's renumbering before it) adds the
Glossary feature requested by the repo owner: tap-to-reveal inline definitions for rules
terms/phrases, auto-linked into authored sheet text (move/skill/ability descriptions, etc.) as the
glossary is filled out, rather than hand-annotated per field. New `glossary` library collection
(`packages/shared/src/types.ts`, `schema.ts`, seeded with 8 starting terms), a pure matching/
linking engine (`packages/shared/src/glossary.ts`, unit tested), and a `GlossaryText` component
wired into every authored description/effect/rules-text field on the sheet plus the
character-creation Theme preview. See `README.md#architecture-notes--judgment-calls` item 9 for
the full rationale, including why the glossary is its own collection rather than reusing existing
entities' `Description` fields, and why a linked term is a `<span role="button">` rather than a
real `<button>`. No new migration — this is a JSONB-blob field addition (`Library.glossary`), same
pattern as every other library field. **One catch for a live project seeded before this version**:
the `library` singleton row's JSON won't have a `glossary` key until it's re-seeded (Content Admin
→ Import/export → Reset to seed) or re-imported — `useGlossaryMatcher` defaults a missing
`glossary` to `[]` rather than crashing, so this fails soft (no links render, nothing else breaks)
rather than needing a migration before deploy, but the live Render/Supabase project won't actually
show any glossary links until that reseed happens.

## Current state

- **Live at:** https://asohav.onrender.com (Render, single Web Service — see
  [README.md#deployment](README.md#deployment)). Not re-verified live this session (see the
  sandbox networking note in "Open issues" below) — the work above was validated against the dev
  harness/CI, not the deployed instance.
- **Version:** `0.9.0` (all four `package.json` files, synchronized — see CHANGELOG.md). Not
  git-tagged — see item 3 above.
- **Database:** live Supabase project (`ihrtdbknhpgysgwaqnfj`), 6 of 7 migrations applied,
  security advisor clean as of the last check. Migration `0007` (adds the `'Declined'` invite
  status, from the seventh session) is **not yet applied live** — see that session's note above.
  Neither the eighth session (`0.8.0`) nor the ninth (`0.9.0`, the Glossary) added a new
  migration — the Glossary's `library.glossary` field needs the live library row re-seeded or
  re-imported to appear, not a migration (see the ninth-session note above).
- CI (`.github/workflows/ci.yml`) has four jobs as of this session: `build`, `typecheck`, `test`
  (new — `vitest`, see above), and `responsive`
  (`apps/web/scripts/responsive-smoke.mjs`, driven by `apps/web/harness.html`). Green on `main` as
  of this writing, but **`main` has no branch protection requiring any of them to pass before
  merge** — see item 7 below. That gap is exactly how a red `responsive` job merged to `main` once
  already in an earlier session (fixed immediately after, in a follow-up PR).

## Open issues

Ordered roughly by how much they matter.

### 1. RESOLVED: "loading error" after login was a seed-order FK bug crashing the campaign page

Root-caused and fixed this session: `apps/server/src/seed.ts` inserted `memberships` before
`characters`, but `seedMemberships()` (`packages/shared/src/seedPlay.ts`) assigns player
memberships a `CharacterId` that doesn't exist yet at that point in the loop — the
`memberships_character_id_fkey` constraint rejected the first player membership insert, throwing
and aborting the seed run right after the GM's own membership (the only one with `CharacterId:
null`). Everything after that in the seed — characters, sheets, party, bonds — never got written.

Confirmed directly against the live Supabase project (`ihrtdbknhpgysgwaqnfj`) via the Supabase MCP
tool: `cm-1` had exactly 1 campaign row, 1 membership (GM only), 0 characters, 0 sheets, 0 party,
0 bonds. `apps/server/src/routes/campaign.ts` then shipped `party: null` to the client via a
`party!` non-null assertion (the wire type `CampaignBootstrap.party` is non-nullable), and
`apps/web/src/pages/CampaignPage.tsx` dereferenced `boot.party.Rapport` unguarded — crashing the
page for anyone loading the seeded campaign.

Fixes applied:
- `seed.ts`: characters are now inserted before memberships, matching the FK direction.
- `campaign.ts`: `getParty` returning `null` no longer gets force-cast; the route now self-heals by
  creating a default `Party` row rather than shipping a null the client isn't guarded against.
- Live data repaired directly via SQL against the production project: inserted the missing 4
  characters, 4 remaining memberships, 4 sheets, 1 party, and 6 bonds for `cm-1` so the demo
  campaign now matches `packages/shared/src/seedPlay.ts` exactly.

Not yet done: no automated test covers the seed insert order, so a future edit to `seed.ts` could
reintroduce an ordering bug silently — worth a lightweight integration test if this recurs.

### 2. Bond handshake row-locking (PR #5) is merged but never runtime-verified

`withBondLock()` (`apps/server/src/repo.ts`) opens a direct `pg` connection and runs
`SELECT ... FOR UPDATE` inside a transaction for propose/accept/reject. The logic was written and
reviewed carefully, and the *build* was verified end-to-end locally, but the actual live
transaction/locking behavior against Supabase's Postgres was never smoke-tested — same sandbox
networking blocker as above. Worth a real test once someone has network access to the live app:
in particular, two concurrent requests against the same Bond (e.g. two accepts, or an
accept + reject race) should serialize correctly rather than one silently overwriting the other.

### 3. `v0.3.0` git tag exists locally only — never pushed

Per the versioning policy in CHANGELOG.md ("tag the merge commit vX.Y.Z"), a `v0.3.0` annotated
tag was created locally on the PR #8 merge commit. Pushing it failed with a `403` — this
session's git credentials were scoped to push the `main-2coxec` branch only, not arbitrary refs
like tags. Someone with full push access needs to run:

```bash
git fetch origin main
git tag -a v0.3.0 bb91dba23252d5ec27427f1991a8822676703199 -m "v0.3.0"
git push origin v0.3.0
```

(`bb91dba` is the PR #8 merge commit — where the `0.3.0` CHANGELOG entry landed.) Future releases
should keep tagging their merge commit; check `git tag -l` isn't falling behind `CHANGELOG.md`
again.

Confirmed still broken as of the `0.5.0` merge (PR #21, commit `5c9163a`): tagging and pushing
`v0.5.0` from a Claude Code session hit the identical `403`. So `git tag -l` is now missing
`v0.3.0` through `v0.5.0` entirely (`0.4.0`/`0.4.1`/`0.4.2` were never tagged either, same root
cause) — someone with full push access should batch all of them:

```bash
git fetch origin main
git tag -a v0.3.0 bb91dba23252d5ec27427f1991a8822676703199 -m "v0.3.0"
# find the 0.4.0/0.4.1/0.4.2/0.5.0 merge commits (git log --oneline --grep, or the PR list) and repeat
git push origin v0.3.0 v0.4.0 v0.4.1 v0.4.2 v0.5.0
```

### 4. Commits from this session are unsigned

The container's commit-signing key was empty/misconfigured partway through the session. The repo
owner explicitly authorized pushing unsigned commits to keep moving ("we'll figure out git auth
issue after we finish the work plan") — but the underlying signing setup itself was never fixed.
GitHub shows these commits as "Unverified." Worth sorting out the signing key/environment config
if verified commits matter going forward.

### 5. Sandbox network constraints (context for future sessions, not a bug to fix)

The Claude Code environment this work was done in has a locked-down egress policy: outbound HTTPS
only reaches a small allowlist (GitHub, npm registry, Anthropic, a few others), and raw TCP
(anything that isn't proxied HTTP/HTTPS) is blocked entirely. Confirmed concretely during this
session:

- Direct `pg` connections to Supabase (both the IPv6-only direct-connection hostname *and* the
  IPv4 pooler) hang/fail — raw Postgres wire protocol isn't proxied HTTP.
- Plain `curl`/browser (Playwright) requests to `asohav.onrender.com` and to
  `ihrtdbknhpgysgwaqnfj.supabase.co` both get a `403` from the sandbox's own proxy — these hosts
  simply aren't on the allowlist.
- The Supabase MCP tool still works fine for schema/migration/query work, since that tool runs
  outside this sandbox's network entirely.

Net effect: **this kind of environment cannot do live browser QA or live database smoke-testing of
this app.** A future session working on "does X actually work" tasks either needs a different
environment/network policy, or needs the repo owner to run it themselves and relay results
(console errors, screenshots, network tab, `psql` output, etc.).

### 6. Render MCP connector never worked in this session

The repo owner tried connecting Render's official MCP connector (for driving deploys/env vars
directly) but hit a "failed to connect MCP" error, and a later attempt showed it installed at the
account level but not enabled for the chat. Deployment was done manually instead: writing
`render.yaml` as a Blueprint and having the repo owner paste env vars into Render's dashboard by
hand. If the connector gets working in a future session, Render changes could go through it
directly instead of this git-based Blueprint flow (though `render.yaml` should stay either way —
it's the actual source of truth Render reads).

### 7. `main` has no branch protection on required status checks

The `responsive` job (added this session) went red on a PR's head commit and the PR was merged
anyway — CI ran, caught a real bug (an app-bar touch-target overlap at 360px), and nobody was
forced to act on it before it reached `main`. It was fixed immediately after in a follow-up PR,
but the gap that let it merge red is still open. Needs an account admin — the session token used
for this work has `admin: false` on the repo and gets a `403` from the branch-protection API, so
this can't be done from inside a Claude Code session:

Settings → Branches → add a ruleset (or classic branch protection) on `main`, requiring the
`build` and `responsive` status checks. Leave "require branches to be up to date" off unless you
want every merge to force a rebase first.

### 8. RESOLVED: `AboutModal`'s header padding now matches the other two dialogs

Fixed in the `0.4.2` cleanup pass: `AboutModal.module.css`'s `.head` override (`24px 24px 4px`) was
dropped entirely, and the component now uses the shared `modal.head` from
`apps/web/src/styles/modal.module.css` (`20px 24px 12px`) directly, same as `ForgeBondModal` and
the Advancement picker.

### 9. Worth a read before ASoHaV's content schema hardens further: the Datasworn project

Not a task — a recommendation to read something, made during a conversation about styling
strategy and not yet acted on. [Datasworn](https://github.com/rsek/datasworn) is a JSON Schema
for Ironsworn/Starforged (Moves, Assets, Oracles, Meters, Stats) explicitly designed as an
interchange format that accommodates homebrew and third-party content, with generated TypeScript
(and five other languages') typings. ASoHaV's content shape is close enough — both are
PbtA-lineage, and ASoHaV's `Moves` with `Tier3`/`Tier2`/`Tier1` results maps onto Datasworn's
move-outcome structure fairly directly (`packages/shared/src/schema.ts`,
`packages/shared/src/seedLibrary.ts`).

This is not a recommendation to adopt Datasworn — ASoHaV's content is original and its schema is
already reconciled from the design handoff, so wholesale adoption would be a real migration for
little gain right now. But if community tools or homebrew content ever end up on the roadmap,
borrowing Datasworn's *conventions* — how it models a move's outcomes, how it namespaces
homebrew — is far cheaper to do now, before other tooling or data depends on the current shape,
than after.

### 10. Reported: inconsistent on-click behavior on Statuses (and possibly other tap targets)

Flagged during a UX feedback pass. The repo owner noticed clicking/tapping things on the character
sheet — Statuses specifically called out — doesn't reliably register on the first interaction. Not
yet root-caused. Three candidates were on the list:

- ~~Optimistic-update latency / live-update propagation.~~ **Investigated and ruled out as the
  cause of the GM-view symptom** in the `0.5.1` session — that turned out to be a separate,
  confirmed bug (a joined RLS policy silently dropping Realtime events for `character_sheets`; see
  the `0.5.1` session note above and `CHANGELOG.md` 0.5.1) — now fixed. The player's *own* toggle
  is optimistic-local and doesn't touch the network before rendering, so it was never a strong
  candidate for "my own click didn't register" specifically.
- A double-click/double-tap requirement somewhere in `StatusesPanel.tsx` (e.g. an `onBlur` rename
  input racing a sibling `onClick`, or a stale closure in one of the `commit()` callbacks), or an
  event-handling issue specific to `.tap`'s `::after` overlay technique (`layout.css`) disagreeing
  with the real element about which one receives the click. **Tested and not reproduced** in the
  `0.5.1` session: a Playwright script drove real touch `tap()` events (not synthetic `.click()`)
  against `harness.html` — one tap on the Virtues Condition toggle, and a Status rename-input edit
  immediately followed by a same-row Pip click with no intervening blur — and every case produced
  exactly one state change with no double-fire or drop. This doesn't rule out a device/browser-
  specific quirk Playwright's touch emulation doesn't reproduce (real iOS Safari being the most
  likely gap), just that it isn't a straightforward bug in the click-handling code itself.

Still needs the repo owner to reproduce and describe: which control, which browser/device, single
vs. double click, and whether it's Statuses only or wider now that the live-update angle is closed
off. Not fixed in this session because nothing reproduced to fix — noted here so it isn't lost.

## Everything else

- What's deliberately *not* built (combat, dice rolling, Bond-proposal expiry, etc.) is listed in
  [README.md#whats-not-built](README.md#whats-not-built) — those are scoped out by the original
  design handoff, not gaps from this work.
- Design decisions and judgment calls (why Realtime instead of WebSockets, why no
  character-creation flow, etc.) are in
  [README.md#architecture-notes--judgment-calls](README.md#architecture-notes--judgment-calls).
- Full version-by-version history: [CHANGELOG.md](CHANGELOG.md).
