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

## Current state

- **Live at:** https://asohav.onrender.com (Render, single Web Service — see
  [README.md#deployment](README.md#deployment)). Not re-verified live this session (see the
  sandbox networking note in "Open issues" below) — the work above was validated against the dev
  harness/CI, not the deployed instance.
- **Version:** `0.5.0` (all four `package.json` files, synchronized — see CHANGELOG.md). Not
  git-tagged — see item 3 above.
- **Database:** live Supabase project (`ihrtdbknhpgysgwaqnfj`), all 5 migrations applied,
  security advisor clean. Untouched this session.
- CI (`.github/workflows/ci.yml`) has a `responsive` job in addition to `build`/`typecheck` as of
  this session (`apps/web/scripts/responsive-smoke.mjs`, driven by `apps/web/harness.html`). Green
  on `main` as of this writing, but **`main` has no branch protection requiring either check to
  pass before merge** — see item 7 below. That gap is exactly how a red `responsive` job merged
  to `main` once already this session (fixed immediately after, in a follow-up PR).

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

Flagged during a UX feedback pass, not yet investigated. The repo owner noticed clicking/tapping
things on the character sheet — Statuses specifically called out — doesn't reliably register on
the first interaction. Not yet root-caused; plausible candidates worth checking first, roughly in
order of likelihood:

- A double-click/double-tap requirement somewhere in `StatusesPanel.tsx` (e.g. an `onBlur` rename
  input racing a sibling `onClick`, or a stale closure in one of the `commit()` callbacks).
- Optimistic-update latency: `useCommitSheet` (`apps/web/src/lib/mutations.ts`) writes to the
  TanStack Query cache immediately but fires the PUT in the background — if a second tap lands
  before the first re-render settles, it may appear to "miss."
  `apps/web/src/features/sheet/Pips.tsx`'s tap-to-set/tap-again-to-drop semantics are a plausible
  place for this to show up as "I had to click twice."
- An event-handling issue specific to `.tap`'s `::after` overlay technique (`layout.css`) — if a
  status/condition control's real box and its invisible 44px hit area disagree about which element
  receives the click in some browser/input combination.

Needs the repo owner to reproduce and describe: which control, which browser/device, single vs.
double click, and whether it's Statuses only or wider. Deliberately not fixed in this session —
noted here so it isn't lost, per instruction to come back to it later.

## Everything else

- What's deliberately *not* built (combat, dice rolling, Bond-proposal expiry, etc.) is listed in
  [README.md#whats-not-built](README.md#whats-not-built) — those are scoped out by the original
  design handoff, not gaps from this work.
- Design decisions and judgment calls (why Realtime instead of WebSockets, why no
  character-creation flow, etc.) are in
  [README.md#architecture-notes--judgment-calls](README.md#architecture-notes--judgment-calls).
- Full version-by-version history: [CHANGELOG.md](CHANGELOG.md).
