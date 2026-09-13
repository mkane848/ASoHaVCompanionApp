# Handoff

Status snapshot and open threads for whoever (human or Claude) picks this project up next. If
you're starting new work here, read this first — especially "Open issues" below, so you don't
duplicate a fix or lose track of something already in flight.

Last updated: 2026-09-13, a **sixty-third session** — shipped **`0.52.0`**, the documentation
split-and-trim, which is the **third and last** of the three releases the full project audit
produced, and then **`0.53.0`**, a `steward` skill carrying this repo's own PR/merge/deploy
guidance (the six check-run names and the `responsive` gate job, the three ways branch protection
has silently blocked a green PR here, the three ways a merged PR still has not shipped, and what is
never a flake). `0.52.0` is merged as `9c51669` and `0.53.0` as `a6ba7ee`, both with their deploy
confirmed `live`. `0.50.0` (correctness and safety) and `0.51.0` (Content Admin) shipped in the
session before it. **The audit is now closed out end to end.**

The same session then **measured the live content library for the first time** and found it sixteen
releases stale — the `0.35.0` seed, predating the whole V0.6 migration — where open issue 19 had
recorded only that one `0.50.0` glossary edit was outstanding. **It has since been reset and the
live library is current.** Clicking that reset is also what surfaced `0.53.1`: the reset reported
failure while having already succeeded, because `appendChangeLog` has never been able to write a
row. **Open issues 19 and 14 were rewritten against the code and the live database rather than
carried forward**, and 14's second half turned out to be already done.

`0.52.0` took the repo root from 16 markdown files to 4: `CLAUDE.md` 3,386 lines to 249,
`README.md` 1,681 to 125, `HANDOFF.md` 3,446 to 1,255, with the detail moved into `docs/` and read
on demand. `CLAUDE.md` is now an index plus the invariants a session must not violate. It also
added `scripts/check-docs.mjs` (a step inside CI's `lint` job — never a new job, see item 7), which
immediately found two more dangling open-issue citations, now written up as items 21 and 22.

**What the audit found, in one paragraph.** Infrastructure is healthy — all 15 migrations applied,
the deploy `live` and matching its merge commit, versions synchronized, Realtime publication and
subscription exactly in sync. The debris is elsewhere. **The boot-crash bug that took production
down for four hours at `0.28.0` was still unguarded twenty-one releases later** (open issue 18,
correctly diagnosed down to the line and never scheduled). **`CharacterSheet.Hold` had been a
counter that only went up since slice 4** deleted its spends but kept the Move-level grants.
**The content library had no concurrency control at all** — every admin write a read-modify-write
of the whole blob, so two admins silently clobbered each other with the changelog recording both as
successful. **Four mutating campaign routes skipped the archive freeze**, and every test passed
throughout because none exercised them against an archived campaign. **Three JSONB aggregates had
no read-time normalize** and `Party`'s was bypassed by the reader behind Home. Docs are 1.26 MB
across 17 root files and growing +300/−15 lines per release — append-only at 20:1 — with README's
judgment-call list carrying six items that describe retired V0.5 behaviour in the present tense,
one citing two symbols that exist nowhere in the codebase. **Git tags stop at `v0.37.0`**, twelve
releases back.

`0.50.0` fixes the first five of those. `0.51.0` is the Content Admin track: the three destructive
one-click actions confirmed, unsaved edits guarded, a `bool` setting that had been silently
writing `null` to the live library fixed, `required`/`default` finally read, and the standard CRUD
the panel never had — search across the whole record, schema-derived filters, sort, duplicate,
restore-a-delete, a referential-integrity guard on delete, deep-linkable views, clickable
validation issues. **A docs split-and-trim (`0.52.0`) is the one track left.** See `CHANGELOG.md`
and "Architecture: Content Admin" in `CLAUDE.md`.

**Three things `0.51.0` found that weren't in the audit, all because nothing had ever looked.**
Content Admin had **zero** coverage in either browser pass — the at-rest pass only ever saw
`/admin`'s opening nav — and once the detail form was finally measured, *every* control in it was
under the 44×44 touch floor (Save 58×29, Delete 76×31, a text input 316×35 at 360px). And
`DELETE /library/:collection/:id` ignored `referencedBy()` entirely, so the "deleting this will
break these" warning the panel had shown since it was built was advice the server never enforced.
And the very first run of the new `content admin (history)` route found that view failing to boot
outright: the harness's changelog fixture had never carried the `Diffs` the real endpoint always
computes, and `HistoryView` reads it unguarded.

**Still outstanding from `0.50.0`, and neither can be done from a sandbox:** tag `v0.50.0` on
`79b369d` (the first tag since `v0.37.0`), and run Content Admin → Data → "Reset to seed" on the
live library for that release's `g-hold` glossary change. `0.51.0` changes no seed content and adds
no migration, so it needs neither.

**Deferred from the Content Admin plan, deliberately, not forgotten:** `library.loadTiers` as a
real editable collection (it has no schema entry at all despite being read by live gameplay code),
`IsAdmin` grant/revoke from the Users view, changelog entries for Play Data deletions,
per-collection import/export, bulk actions, and pagination.


**Earlier sessions** are in **[`docs/history/sessions.md`](docs/history/sessions.md)** as of
`0.52.0`. The chained "Previously (Nth session)" log had grown to 2,387 lines and sat *above*
"Current state" in this file, so every session read sixty-two sessions of narrative before
reaching the part it needed. It is kept verbatim, just not in the way.

## Current state

*Rewritten in `0.50.0`. It had said version `0.29.0`, "serving `0.28.0`", "all **10** migrations
applied", and "CI has **four** jobs" — five versions, five migrations and one job out of date,
because each release appended a session note below instead of correcting this block. Every figure
here was verified against the live services, not carried forward.*

- **Version:** `0.53.0`, synchronized across all four `package.json` files and the lockfile
  (`scripts/check-versions.mjs` is CI's first `build` step and fails fast if they disagree).
- **Live at:** https://asohav.onrender.com — deploy `dep-daiubeqjnfac73ejdkd0`, status **`live`**,
  matching the `0.53.0` merge commit `a6ba7ee`. Verified via the Render MCP tool on 2026-09-12,
  after the merge rather than assumed: a docs-only release still deploys, and a failed deploy
  silently keeps the previous build serving. The previous deploy flipping to `deactivated` in the
  same moment is the positive half of that check — it shows the *new* build is the one serving,
  which "the deploy succeeded" on its own does not.
- **Database:** Supabase project `ihrtdbknhpgysgwaqnfj`, `ACTIVE_HEALTHY`, **all 15 migrations
  applied** (`0001_init` through `0015_world`, confirmed with `list_migrations`). The
  migration-not-applied failure mode that caused three incidents is currently clean. One cosmetic
  wrinkle: the live row for `0006` is recorded as `sheet_realtime_rls` without its number prefix,
  so a name-based diff reports a false mismatch.
- **Git tags:** still stopping at **`v0.37.0`** — **sixteen** releases (`0.38.0`–`0.53.0`,
  including all eight V0.6 slices) shipped untagged despite CHANGELOG.md's own policy requiring a
  tag on the merge commit. Re-counted 2026-09-13 against `git ls-remote --tags origin`, which still
  returns the same ten; the previous figure of fourteen was correct when written and then went stale
  twice, which is what this block exists to stop. A tag push from a Claude session `403`s
  (re-tested at `0.52.0`); the ten tags that do exist were pushed from the repo owner's own machine.
  **Open issue 3 carries the bump commit for every untagged release** so this can be done locally in
  one pass — that table is the actionable part, not the streak itself.
- **The live `library` row is current as of 2026-09-13**, confirmed by query after the reset: 39
  glossary terms, `g-hold` carrying its `0.50.0` text, `m-levelup` named "Advance a Motif", and the
  retired `RecoveriesMax`/`StatusMaxRank` settings gone. Until that click it had been **the `0.35.0`
  seed — sixteen releases stale, predating the whole V0.6 migration**, not merely missing `0.50.0`'s
  `g-hold` edit as this block and open issue 19 both used to say. Every collection's *id* set
  matched throughout, so the drift lived inside records and an id-level check missed it entirely.
  **See open issue 19 for the measurement, the SQL that produced it, and why `library.updated_at`
  looked recent the whole time.**
- **Live browser QA** of the deployed app remains unverified from this sandbox — see items 5 and 11
  and CLAUDE.md's "Sandbox network constraints" table, which is a dated snapshot rather than a
  standing guarantee. Re-probe with both `curl` and a real `page.goto()` rather than assuming
  either direction still holds.

- CI (`.github/workflows/ci.yml`) has **five** jobs and produces **six check-run names** —
  `build`, `test`, `lint`, `responsive-matrix (parchment)`, `responsive-matrix (noticeboard)`
  and the `responsive` gate job. (This bullet said "four" from `0.27.0` until `0.50.0`; the
  appearance matrix split `responsive` in two back at `0.26.0`. The original description of
  each job, still accurate, follows.) Originally (`TechStackAudit.md`'s G11): `build` (`check-versions.mjs`, then `npm run typecheck` as a step before `npm run build`
  — typecheck is not a separate job — then `bundle-budget.mjs`, enforcing), `test` (`vitest`,
  now covering `@asohav/shared` + `@asohav/server` + a first `apps/web` suite — see the
  thirty-seventh session's note below), `lint` (new — ESLint, `--max-warnings=61`, a deliberate
  ratchet-down threshold for a never-before-linted codebase's real backlog, not a permanent
  number), and `responsive` (`apps/web/scripts/responsive-smoke.mjs`, driven by
  `apps/web/harness.html`, a two-entry matrix over `parchment`/`noticeboard` since `0.26.0`).
  Green on `main` as of this writing — the twenty-eighth session's seven PRs all merged with green
  CI, verified per PR rather than assumed — but **`main` still has no branch protection requiring
  any of them to pass before merge** — see item 7 below, still unresolved. That gap is exactly how
  a red `responsive` job merged to `main` once already in an earlier session (fixed immediately
  after, in a follow-up PR); seven more merges against an unprotected branch this session is seven
  more chances for that to recur, even though it didn't this time.

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

### 3. Most releases are untagged — but ten tags DO exist, and `git tag` will lie to you about it

**This item asserted the opposite until `0.52.0`, and the correction matters more than the fix.**
It was titled "No version has ever been git-tagged," its body said "None do," and it told future
sessions not to re-attempt because the push always `403`s. All of that is false:

```
$ git ls-remote --tags origin | grep -v '\^{}' | wc -l
10          # v0.28.0 … v0.37.0, all present
```

**Why it survived twenty-five releases:** this clone's fetch refspec is `+refs/heads/*:refs/remotes/origin/*`
with no `tagOpt`, so **`git tag` returns an empty list in every session** — silently confirming the
false claim to anyone who checked it the obvious way. A doc claim that agrees with a wrong local
observation is the hardest kind to dislodge. **Check tags with `git ls-remote --tags origin`, never
with `git tag`.**

What is actually true: **`v0.28.0` through `v0.37.0` are tagged.** Everything before `0.28.0` and
everything from `0.38.0` on is not — **14 untagged releases** as of `0.52.0` (`0.38.0`–`0.51.0`),
including all eight V0.6 slices.

**The ten that exist were pushed from the repo owner's own machine, by a separate agent running
locally — not from a session here.** So the `403` is not evidence of a repo-wide constraint that
later lifted; it is a limit on *this* environment. Don't restate it either way without saying which
environment you mean, and don't read "ten tags exist" as "a cloud session can make one." The
mechanics, for whoever has the access:

```bash
git fetch origin main
# derive each version's commit from the package.json bump, NOT the merge message — see below:
git log origin/main --format=%h -S'"version": "0.4X.0"' -- package.json | tail -1
git tag -a vX.Y.Z <sha> -m "vX.Y.Z"
git push origin vX.Y.Z   # repeat per version, or batch multiple tags onto one push
```

**Tested at `0.52.0`: pushing a tag from the Claude cloud environment fails.** `git push origin
v0.50.0` on the known-good merge commit `79b369d` returned `RPC failed; HTTP 403`. The local tag was
deleted again, so `git tag` here stays empty and keeps telling you the truth about this environment.

**Derive the commit from the `package.json` bump, not from branch names or merge messages.** The
`0.38.0`/`0.39.0` case shows why, and it is worse than "ambiguous": PR **#116**'s branch is named
`claude/workplans-0-38-0-and-0-39-0-p4x7qm` and contains **neither** version bump — it shipped the
work-plan documents. Both releases actually landed via PR **#117** (`256f0c0`). A reasonable
grep-the-merge-messages approach picks #116 and is wrong twice over.

`0.38.0` and `0.39.0` also share that one merge commit, so `CHANGELOG.md`'s "tag the merge commit"
is underdetermined for them — one commit cannot carry both tags. Their distinguishing commits are
the bumps themselves, `12f8bcc` and `fe3347c`.

Bump commits for the 14 untagged releases, derived by the `-S'"version": …'` walk above and
spot-checked on the `0.38.0`/`0.39.0` case (verify before tagging rather than trusting this table):

| Version | Bump commit | Merge |
|---|---|---|
| `v0.38.0` | `12f8bcc` | `256f0c0` (shared) |
| `v0.39.0` | `fe3347c` | `256f0c0` (shared) |
| `v0.40.0` | `57315a6` | `09026e0` |
| `v0.41.0` | `cd0eb40` | `297736c` |
| `v0.42.0` | `b45da70` | `f265dc3` |
| `v0.43.0` | `aecfc82` | `27e0bb7` |
| `v0.44.0` | `91ef5d8` | `39d4c12` |
| `v0.45.0` | `cfe828c` | `a331329` |
| `v0.46.0` | `f336e6c` | `d70ba75` |
| `v0.47.0` | `d44e9f4` | `0bb1db2` |
| `v0.48.0` | `a99c68a` | `4ce876a` |
| `v0.49.0` | `73a671c` | `8471904` |
| `v0.50.0` | `3615d3d` | `79b369d` |
| `v0.51.0` | not yet on `main` | PR #132 |

**Mapping a version to its merge commit gets genuinely ambiguous past `~0.5.0`** — several early
versions were renumbered mid-flight when two draft branches' PRs landed out of order, so a naive
"first commit with this `package.json` version" walk can land on the wrong side of a rename.
Whoever does this should re-derive each merge commit carefully from the PR list and CHANGELOG
timestamps rather than trust a mechanically-generated table — a tag on the wrong commit is worse
than no tag at all.

### 4. Commits from this environment are unsigned — diagnosed at `0.52.0`, and it briefly blocked a merge

**Every commit any session here has ever made is unsigned** — `git log --format='%G?'` reports `N`
(no signature), not merely "untrusted", on all of them, including the already-merged `0.48.0`,
`0.49.0` and `0.50.0` release commits. Only GitHub's own merge commits are signed, by its web-flow
key, which is why `main`'s history looks fine and this only ever bites on branch commits.

The cause is concrete, and is the execution environment's rather than this repo's:

```
file:/root/.gitconfig   commit.gpgsign  true
file:/root/.gitconfig   gpg.format      ssh
file:/root/.gitconfig   user.signingkey /home/claude/.ssh/commit_signing_key.pub   <- ZERO BYTES
```

Signing is switched on and points at an empty key, so it silently produces nothing. There is no
other key material in the container. `/root/.gitconfig` is regenerated per session and
`/home/claude/.ssh/` is part of the image, so **nothing written here survives the container** —
this is not a setting the repo owner can fix from the repository side.

**It became load-bearing once, briefly.** On 2026-09-12 the `main` ruleset gained a
require-verified-signatures rule, which made PR #132 un-mergeable with green CI and no failure
visible anywhere — the third distinct way branch protection has silently blocked a green PR here
(see item 7 for the other two). The repo owner removed the rule to merge it; the ruleset's
`updated_at` and the merge timestamp are 38 seconds apart. **If that rule is ever switched back on,
this item is the explanation for why nothing can merge from a Claude session.** The workaround that
does work without a local key: commits created through the GitHub API are signed by GitHub itself.

Note also that the `main` ruleset currently sets `require_extra_approval_for_unattributed_changes`
with `required_approving_review_count: 0`. A solo maintainer cannot approve their own PR, so a
commit GitHub cannot attribute to an account would be a standing deadlock. `0.52.0`'s commits are
authored `Mike Kane <mikekane848@gmail.com>` with a `Co-Authored-By: Claude Opus 5` trailer,
matching `0.51.0`'s merged precedent, as a precaution against that.

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

**Update, fortieth session — the allowlist has changed, and half of the above is no longer true.**
Measured directly rather than assumed:

| Host | Reachable via `curl` | Reachable via headless Chromium | Gates |
|---|---|---|---|
| `asohav.onrender.com` | **yes** (`/api/health` → `200`) | **no** (`ERR_CONNECTION_RESET`, forty-second session) | live app QA, the REST API |
| `fonts.googleapis.com` / `fonts.gstatic.com` | **yes** | untested via Chromium | real typography in `npm run screenshot` |
| `api.github.com` | yes | untested via Chromium | GitHub MCP |
| `ihrtdbknhpgysgwaqnfj.supabase.co` | **yes** as of the forty-second session (was `403` through the thirty-ninth) | **no** (`ERR_CONNECTION_RESET`, forty-second session) | browser sign-in, any bearer-token API call |
| `cdn.playwright.dev` | no | n/a | `playwright install` (use `CHROMIUM_PATH`) |

So the standing "this environment can't do live QA" caveat — repeated in a lot of notes across
this file — should now be **checked, not assumed, and checked with both tools**: a host that
answers `curl` isn't necessarily reachable from Playwright's Chromium through this same proxy, and
the forty-second session found exactly that split for both rows above. Probe `curl` reachability
with `curl -sS -m 12 -o /dev/null -w '%{http_code}' https://host/`; probe actual browser
reachability separately by having Playwright navigate to the same URL rather than assuming a green
`curl` implies a working `page.goto()`; read `curl -sS "$HTTPS_PROXY/__agentproxy/status"` for the
reason behind any denial either way.

What is still genuinely impossible: **raw TCP**, regardless of allowlist — so direct `pg`
connections to Supabase remain out (that's why item 2 above has never been runtime-verified). Both
the IPv6-only direct host and the 5432 port on `ihrtdbknhpgysgwaqnfj.supabase.co` itself were
re-probed this session (`nc -zv`) — one hangs to timeout, the other refuses — no change from the
picture above.

**Update, forty-second session — `ihrtdbknhpgysgwaqnfj.supabase.co` is reachable now, but that
alone doesn't unblock live browser QA.** The repo owner asked to re-check specifically because the
allowlist might have widened again. It has, partially:

- **`curl` reaches the Supabase Auth host directly** — `/auth/v1/health` returns a real `401` (a
  genuine Supabase "no API key" JSON body, not a proxy denial), `/auth/v1/settings` likewise, and
  `curl -sS "$HTTPS_PROXY/__agentproxy/status"` shows `recentRelayFailures: []` for it and
  Cloudflare response headers (`server: cloudflare`, a real `cf-ray`, a `supabase.co`-domained
  cookie) confirming the request actually reached Supabase's edge, not a proxy stub. This closes
  the specific gap the table below used to name.
- **A real headless-Chromium (Playwright) navigation cannot complete to *either* host right now** —
  tried both `https://asohav.onrender.com/` (the live app) and a bare JSON endpoint on each host
  (`/api/health`, `/auth/v1/health`); every attempt failed identically with
  `net::ERR_CONNECTION_RESET`, and the proxy's own status endpoint logs it as `ws_closed_mid_exchange`
  — "tunnel closed (code 1006...) after 6s; ...39 B received" — for both hosts alike. `curl` against
  the exact same URLs succeeds every time. This isn't a `403`/policy denial (which would mean don't
  retry) — it reproduced identically on a warm, already-responding origin (confirmed via a
  successful `curl` immediately before each attempt), so it isn't Render's free-tier cold start
  either. It looks like a proxy/tooling-level limitation specific to how headless Chromium
  negotiates a connection through this relay, not something fixable by retrying or by widening the
  destination allowlist further. Per `/root/.ccr/README.md`'s own troubleshooting guide, this is the
  kind of thing to report rather than route around.
- **Net effect on open issue 11**: still open, but for a different reason than before. The
  network-level block that used to stop *any* request to Supabase Auth is gone (confirmed by
  `curl`), but the specific tool this project would use for live QA (`Playwright`/headless
  Chromium) can't complete a request to *any* external host through this proxy right now, Supabase
  included — so "live browser QA" is blocked by a browser-through-proxy problem now, not a
  Supabase-specific egress denial. A future session should re-probe with the same two-step method
  (curl first, then an actual Chromium navigation) rather than assume either result carries over —
  this has now flipped at least once already.

Widening the destination allowlist further is a change to the **environment's own network policy**,
made by the repo owner where the environment was created (claude.ai/code → the environment's
settings; see https://code.claude.com/docs/en/claude-code-on-the-web) — but per the finding above,
that alone won't unblock item 11 anymore, since the remaining blocker is the Chromium-through-proxy
issue, not a destination-host denial. Don't try to route around either kind of block from inside
the sandbox.

### 6. RESOLVED: the Render MCP connector works now

Confirmed working in the twenty-seventh session, the first time any session has reached it. It
authenticates and returns the account's workspaces; the only step it won't take on its own is
picking one, which is deliberate (acting on the wrong workspace could touch unintended resources).
The repo owner confirmed **"My Workspace"** (`tea-d9hs81ernols73aknf00`,
mikekane848@gmail.com) — the account has exactly one.

Render deploy status, logs, metrics, and env-var changes are therefore available to a session here
for the first time. `render.yaml` should stay regardless — it's the actual source of truth Render
reads, and the Blueprint flow isn't replaced by the connector, just supplemented by it.

Original problem, for history: the repo owner hit a "failed to connect MCP" error, and a later
attempt showed it installed at the account level but not enabled for the chat. Deployment was done
manually instead — writing `render.yaml` as a Blueprint and pasting env vars into Render's dashboard
by hand.

### 7. Branch protection on `main` — now configured, and **this item's own advice was stale enough
to break it**

> **RESOLVED as of 2026-09-12 (`0.52.0`), verified by reading the live ruleset.** `main`'s ruleset
> (`Main Branch Rules`, id `20311307`) requires exactly **`build`, `test`, `lint` and
> `responsive`** — the four names this item and `CLAUDE.md` recommend, by exact check-run name,
> with no bare `responsive-matrix` leg among them. `required_approving_review_count` is `0`, so
> the standing-deadlock risk this item worried about is not present. Classic branch protection is
> separately `enabled: false`, so the ruleset is the only mechanism in play. Two cautions survive:
> a token without the protection-read scope gets `403` on `/branches/main/protection` and can see
> **nothing**, so "I checked and it's fine" needs the *rulesets* API; and a **third** way
> protection has silently blocked a green PR has since been recorded in item 4 (a
> require-verified-signatures rule, added and removed on 2026-09-12).

*Original issue:* the `responsive` job went red on a PR's head commit and the PR was merged anyway
— CI ran, caught a real bug (an app-bar touch-target overlap at 360px), and nobody was forced to
act on it before it reached `main`. The fix was to add branch protection.

**The advice this item gave was to require the `build` and `responsive` status checks. That
advice was correct when written and became wrong at `0.26.0`, and nobody noticed for fifteen
versions.** Commit `165f60e` gave the `responsive` job a two-entry appearance matrix, and a matrix
job does not report a check run under its bare job name — it reports one per matrix entry,
**`responsive (parchment)` and `responsive (noticeboard)`**. A required context named `responsive`
therefore waits forever for a report nothing will ever send, and the PR sits un-mergeable showing
"Expected — waiting for status to be reported" with green CI and no failure anywhere. That is
exactly what happened on PR #122 (the V0.6 ruleset adoption) in the fifty-third session: all six
check runs green, no reviews requested, no conflict, `mergeable_state: blocked`.

**RESOLVED in code, fifty-third session, at the repo owner's direction — `ci.yml` now produces a
check literally named `responsive` again, so the existing rule is satisfied without a settings
change.** Two options were put to the repo owner: edit the rule, or make CI report the name the
rule already wants. They chose the latter (with the settings fix optional afterwards), because a
gate job is durable in a way a settings list is not — it cannot go stale when the matrix changes.

The `responsive` job was renamed **`responsive-matrix`**, and a new job named **`responsive`** takes
its place: it runs no tests, `needs: responsive-matrix`, and passes only when every matrix leg
passed. It carries `if: always()`, which is load-bearing — without it the gate would be *skipped*
when the matrix fails, and a skipped check does not satisfy a required check, so the PR would block
with no visible failure explaining why.

**The six check-run names GitHub records**, and which to require:

| Name | Source | Require it? |
|---|---|---|
| `build` | the `build` job | yes |
| `test` | the `test` job | yes |
| `lint` | the `lint` job (added `814c488`, after this item was written) | yes |
| `responsive` | **the gate job** — no tests, passes iff every matrix leg passed | **yes — this is the one** |
| `responsive-matrix (parchment)` | `responsive-matrix`, matrix entry 1 | no |
| `responsive-matrix (noticeboard)` | `responsive-matrix`, matrix entry 2 | no |

`Supabase Preview` is a seventh check run, posted by the Supabase GitHub App rather than by
`ci.yml`. It reports `skipped` on branches with no preview branch configured — **do not make it
required**, since a `skipped` conclusion does not satisfy a required check.

**Why the gate job rather than just fixing the list:** a required status check is matched by exact
check-run name, so any rename or new matrix dimension in `ci.yml` silently breaks protection —
nothing in CI warns you, because the symptom is a check that never *appears* rather than one that
goes red. The gate job makes `responsive` a name that survives those changes. Add an appearance, a
viewport or a platform to `responsive-matrix` and protection keeps working untouched.

`CLAUDE.md`'s "Commands" section carried its own version of the original error until `0.41.0`,
asserting the four jobs were `typecheck`/`build`/`test`/`responsive`; there has never been a
`typecheck` job (it is a step inside `build`), so that list would have mis-configured protection two
different ways.

**Optional cleanup, whenever an account admin has a moment:** the rule as it stands names
`responsive` and is satisfied, but if `typecheck` is also in the required list it should be removed
— nothing will ever report it. Settings → Branches (or Rules → Rulesets) → the `main` rule → Require
status checks to pass. This cannot be done from inside a Claude Code session: the session token has
`admin: false` on the repo and gets a `403` from the branch-protection API. Leave "require branches
to be up to date" off unless you want every merge to force a rebase first.

### 8. RESOLVED: `AboutModal`'s header padding now matches the other two dialogs

Fixed in the `0.4.2` cleanup pass: `AboutModal.module.css`'s `.head` override (`24px 24px 4px`) was
dropped entirely, and the component now uses the shared `modal.head` from
`apps/web/src/styles/modal.module.css` (`20px 24px 12px`) directly, same as `ForgeBondModal` and
the Advancement picker.

### 9. PARKED: Datasworn (Ironsworn/Starforged JSON Schema) as a possible reference

Not an action item — a reading pointer raised once during a styling-strategy conversation, never
revisited since. [Datasworn](https://github.com/rsek/datasworn) models PbtA-lineage content
(Moves/Assets/Oracles) as an interchange format built to accommodate homebrew — ASoHaV's `Moves`
with `Tier3`/`Tier2`/`Tier1` results maps onto its move-outcome structure fairly directly
(`packages/shared/src/schema.ts`, `seedLibrary.ts`). Worth a look only if community tools or
homebrew content ever land on the roadmap — not a recommendation to adopt it, since ASoHaV's
schema is original and already reconciled from the design handoff.

### 10. DORMANT: reported inconsistent on-click behavior on Statuses — investigated twice, never reproduced, no reports since `0.5.1`

The repo owner reported clicks/taps on the character sheet — Statuses specifically — not always
registering on the first interaction. Two candidates were investigated in the `0.5.1` session and
neither panned out: the GM-view symptom turned out to be the separate, now-fixed joined-RLS-policy
Realtime bug (item 3's neighbor above — see `CHANGELOG.md` 0.5.1), not this; and a Playwright
script driving real touch `tap()` events against the flagged scenarios (a Condition toggle, a
Status rename-input racing a sibling Pip click) produced no double-fire or missed-tap in any case.
Doesn't rule out a device-specific quirk Playwright's touch emulation can't reproduce (real iOS
Safari being the likeliest gap) — just that it isn't a straightforward bug in the click-handling
code. No further reports from the repo owner since. Needs a fresh, specific repro (which control,
which device/browser, single vs. double tap) before another session can act on it.

### 11. The entire game engine and Combat system have never run in a real browser

**Update, fortieth session — this is now half-unblocked, and more urgent than it was.** The
sandbox can reach `asohav.onrender.com` (open issue 5 has the measured table), so Playwright can
load the live app for the first time; what it still cannot do is **sign in**, because Supabase
Auth is on the one blocked host. Adding `ihrtdbknhpgysgwaqnfj.supabase.co` to the environment's
egress allowlist is the single change that would close this issue outright.

**Update, forty-second session — that diagnosis was half right and is now superseded.** The repo
owner asked to re-check Supabase Auth specifically. It's reachable now (see open issue 5's updated
table — `curl` gets a real Supabase `401`/`200`, not a proxy denial), so the *allowlist* half of
the fortieth-session diagnosis is fixed. But adding that host did **not** close this issue: a
Playwright-driven Chromium navigation fails identically (`ERR_CONNECTION_RESET`) on
`asohav.onrender.com` itself, not just on Supabase — so the live app can no longer even be
*loaded* via headless Chromium in this sandbox, let alone signed into. This is a different,
proxy/tooling-level problem (see open issue 5), not a destination-host policy gap, and it isn't
something a further allowlist change would fix. **This issue is still fully open** — record it
that way rather than as "half-unblocked," which is no longer accurate in either direction (worse
for "can it load the app," better for "is Supabase itself blocked").

More urgent because slice 1 (`0.28.0`) rewrote exactly the mechanics this issue is about — the
Status model is now a row of marked boxes rather than an integer, Crumble is an event rather than
derived state, and Recoveries cascade into Exhausted and then possibly into Crumble. Those are
pure functions with real unit coverage, but the *wiring* (which modal opens, what the sheet commits,
what a second tab sees over Realtime) has never executed anywhere but a test harness. The live
database is also empty now (open issue 17), so the first real campaign and character created
through the UI **are** this pass — that was the plan's intent, not an afterthought.

**Update, `0.16.1`**: this risk was confirmed, not just theoretical — see the twenty-first
session's note above. Any character sheet saved before `0.13.0` crashed on load until that fix
shipped; the two bullets below (Combat's live Realtime sync, and whether the live `library`
singleton was re-seeded) are still open and unconfirmed.

Flagging this with more weight than the standing sandbox-network note (item 5) because of how much
new, genuinely interactive logic landed across the sixteenth–twentieth sessions with zero live
QA: the roll-breakdown engine, the full Status/Condition/Subdued flow, and — the biggest surface —
the entire Combat Encounter view (start/end, five Combat/Reaction Moves, Gambits, enemy stat
blocks, `PendingStatusOffer` redirection for Interpose). All of this is covered by unit tests
(pure functions in `packages/shared`) and the responsive smoke test (layout/touch-targets only,
against static seed fixtures) — neither exercises real multi-step user flows: opening a modal,
picking a target, applying a Gambit, watching another browser tab see the Realtime update. Two
concrete things worth a deliberate pass once someone has real browser access:

- Click through a full Combat Encounter end-to-end (start → add participants → Engage with
  Gambits → an Enemy's attack → the target applying a `PendingStatusOffer`, optionally resisted →
  Interpose → end) as both a GM and a player, ideally two browser sessions at once to verify
  Realtime sync actually delivers `combat_encounters` changes the way `useLiveCampaign.ts` assumes.
- ~~Confirm the live `library` singleton has actually been re-seeded/re-imported to pick up
  `0.13.0`'s new `GameSettings` fields and `0.14.0`'s `library.enemies`~~ **Done, twenty-second
  session (`0.17.0`)** — it hadn't been, and was silently breaking gameplay math rather than just
  missing Enemies content (see that session's note above and Open issue 12 below). Reseeded
  directly, plus `normalizeLibrary()` now self-heals this going forward. (Independently
  re-confirmed live via the Supabase MCP tool on 2026-08-11: `enemies`, `settings`, and `glossary`
  are all still current — no drift since that reseed.)

### 12. RESOLVED (Level-vs-Tier gate): rules/content gaps a full audit found — see the slice-4 update below for the last two pieces

The twenty-second session (`0.17.0`) cross-referenced `Planning Docs/*.md` (TheMoves.md,
TheGear.md, TheSkills.md, Advancements.md, etc.) against `packages/shared` line by line looking for
drift now that the game engine and Combat have both fully shipped. Track A (small, unambiguous
fixes) landed in that session — see its note above and `CHANGELOG.md` 0.17.0. Everything below was
"Track B" — real content/mechanic gaps, deliberately not guessed at in that session. The
twenty-third session (`0.18.0`, see below) scoped five decisions with the repo owner up front and
then built everything except the two items still marked open at the bottom:

- ~~Seven named Moves in `TheMoves.md` have no `seedLibrary.ts` entry at all~~ **Done, `0.18.0`**:
  Strike a Nerve, Recall a Flashback, Recuperate, Level Up, Progress the Party, and Forge a Bond
  are now seeded. Undertake a Journey and Enjoy Downtime are still un-seeded — see the open item
  below.
- ~~Character Level and Party Level don't exist as fields anywhere~~ **Deliberately still not
  built** — see the open item below; this turned out to be inseparable from the Tier-unlock formula
  question, not just a missing field.
- **`Advancements.md`'s Potential-tier contradiction (2-tier vs. 4-tier) is still open** — not
  resolved by the `0.18.0` session; it compounds with the Level/Tier-unlock formula question below
  rather than being independent of it.
- ~~Wealth and Treasure are named spendable resources with zero representation in the data
  model~~ **Done, `0.18.0`**: `CharacterSheet.Wealth`/`Treasure`, per-character, freely
  player/GM-adjusted (no earn mechanic yet — confirmed with the repo owner as an explicit "decide
  later" rather than an oversight).
- ~~Advantage/Disadvantage rolls are referenced three times in the doc... but the engine has no
  concept of them~~ **Done, `0.18.0`**, informational-only per the repo owner's explicit call —
  `AdvantageToggle.tsx`.
- ~~Make Camp is missing its "clear 1D6 Conditions" component~~ **Done, `0.18.0`** —
  `MakeCampModal.tsx`.
- ~~End the Session is missing its branching Rapport formula... and its entire per-player
  hold/spend subsystem~~ **Done, `0.18.0`** — `EndSessionModal.tsx`.

**Still open, deliberately deferred (not guessed at) — see `CLAUDE.md`'s "Wealth, Treasure,
Advantage, and End the Session" section for the full reasoning:**

- **The Level Up/Progress the Party Tier-unlock formula.** "4 Tier-1 advancements *and* Level 5"
  can't be made internally consistent if Level is just the count of Advancement picks taken (the
  only reading the rest of the doc supports) — a 4th pick is Level 4, and a 5th pick (still Tier 1,
  since Tier 2 isn't unlocked yet) is 5 Tier-1 picks, not 4. No `Level`/`PartyLevel` field exists;
  `unlockedTier()` still gates purely on count, unchanged since `0.13.0`.
- **Undertake a Journey and Enjoy Downtime** — both full multi-step flows (Scout Ahead → Venture
  Forth with GM-chosen complication lists; five distinct Downtime activities). Whether either needs
  guided UI beyond a generic library Move-text entry wasn't decided before this pass.

**Update, thirty-eighth session (V0.5 adoption, documentation only):** V0.5 does **not** resolve
the Potential-tier contradiction above — the same "4 Tier-1 advancements *and* Level 5" compound
gate is reproduced in the new draft unchanged (see "Known gaps in V0.5" item 3 below, which also
notes it now **blocks slice 4**). This item stays open. Every citation above to `Advancements.md`
now needs to be read as `Planning Docs/archive/Advancements.md` — the file moved there, superseded,
in this session's file reorganization — with `Planning Docs/Ruleset-V0.5.md` as the current source
for the same rule. The other still-open bullet directly above — Undertake a Journey and Enjoy
Downtime having no seeded Move entries or guided UI — is now fully specified by V0.5 (Scout Ahead/
Venture Forth, and the five named Downtime activities, both spelled out in the new draft) and moves
from "deferred, undecided" to **planned, slice 7** in `WorkPlan-V0.5.md`.

Two smaller, lower-confidence notes from the same pass, included for completeness rather than as
action items: `TheMoves.md` calls the middle Load tier "Medium" once, while `TheGear.md` and all of
the code call it "Normal" (looks like a doc-internal typo, not a code defect — the code correctly
follows the more authoritative, dedicated Load doc). And worth noting `TheMoves.md`'s own prose is
visibly an unfinished draft in places — bracketed author notes (e.g. a "[Mike Note: ...]"
reconsidering the Keep Watch mechanic) and undefined terms ("Kith" where "Kin" is presumably meant,
"Villain or Lieutenant (define those…)") — so not everything above necessarily deserves faithful
implementation as written; some of it may be exactly what the repo owner meant to flag as
still-in-flux when the doc was written.

**Update, forty-third session (slice 4, `0.31.0`) — RESOLVED, plus a deeper gap the resolution
uncovered.** Went looking in `Ruleset-V0.5.md` for where the Level-vs-Tier gate is actually stated,
to scope slice 4's Improvement Tree DAG. Found it stated **twice, contradicting itself**:

- **"Motif Advancement — Potential"** (the section this app has been built against since slice 2,
  under "Hero, Party, and Inter-Hero Advancement"): clear a full Motif Potential track, choose one
  of Add a Skill Tag / Add-or-Remove a Flaw Tag / **Gain a Hero Improvement — a Starting
  Improvement on any tree, or one connected to an Improvement you already hold on that same tree.**
  No Tier, no Level, anywhere in this section. "Party Advancement — Rapport" states the identical
  shape for Party Improvements.
- **"Level Up"/"Progress the Party"** (under Make Camp, further down the same document): "you may
  reduce your Potential by 5 to increase your Level by 1... you are restricted to Tier 1 options at
  first; however, once you have taken four advancements from Tier 1 and reach level 5, you unlock
  Tier 2..." — the exact "4 Tier-1 *and* Level 5" contradiction this item has carried since
  `0.18.0`, reproduced verbatim from the pre-V0.5 `Advancements.md`.

Put to the repo owner directly (not inferred): **treat the Tier/Level section as leftover,
unreconciled draft text and gate purely on the DAG** — the same call already made for Bond/Kin/Kith
(open issue 1 in "Known gaps in V0.5" below). `CharacterSheet.Level`/`Party.PartyLevel` still exist
as plain counters (incremented on every Motif-Potential-track/Rapport-track clear respectively),
since both doc sections agree *something* called Level should increase — they just gate nothing.
`improvementState()` (`packages/shared/src/logic.ts`) implements the DAG check;
`validateImprovementDag()` (`apps/server/src/adminLogic.ts`) validates the graph in Content Admin
(no cross-tree prerequisites, no cycles, every node reachable from a Starting Improvement).

**The deeper gap, found while trying to seed the 25 trees to test the DAG against:**
`Ruleset-V0.5.md`'s "Hero Improvements" section names all 11 Combat + 14 Narrative trees with a
one-line theme each, but **authors zero actual nodes on any of them** — no Starting Improvement, no
prerequisite line, nothing. Also asked the repo owner directly rather than inventing content:
**build the real mechanism now against clearly-labeled placeholder nodes** (a Starting Improvement
plus one chained node per tree, `Effect` text reading "Placeholder…"), so the DAG gate and its
validation are exercised end to end without pretending unwritten game design is real. This is a
bigger gap than the Level-vs-Tier one, since even a resolved gating rule needs real nodes to gate —
and it's *worse* for Party and Bond: "Party Motif + Improvements" and "Bond Track + Improvements"
are each one line ("Here that is!") with **no tree names at all**, unlike Hero's 25. Neither got a
placeholder tree, since there's nothing — not even a name — to hang one off of; both stay unbuilt
with no slice assigned (this corrects a `README.md` item 8 prediction from the `0.28.0`-era session
that "V0.5 adds tiered Bond Improvements keyed to Bond Level" — that turned out to be an inference
from the section *header* that the section's actual, empty content doesn't support).

This item is resolved for the Level-vs-Tier question specifically. The Hero-tree-content gap is
recorded, not resolved — someone needs to author real Improvement nodes before the placeholders can
be replaced — and the Party/Bond content gap has no path forward until the repo owner writes
something for either to build against.

**Update, forty-sixth session (slice 7, `0.34.0`) — RESOLVED: Undertake a Journey and Enjoy
Downtime shipped real guided flows.** The "planned, slice 7" bullet from the thirty-eighth
session's update above is now built: `UndertakeJourneyModal.tsx` (Loadout, Scout Ahead, Venture
Forth) and `EnjoyDowntimeModal.tsx` (all seven named activities). See `README.md` item 37 and
`CLAUDE.md`'s "Architecture: Party Identity & Camp" section for what shipped and what stayed
narrower than the doc's own wording.

### 13. RESOLVED (surfacing only): starting Combat grants the party +1 Rapport — now visible, rule itself still unconfirmed

Found during the twenty-seventh session's planning research: `CombatPage.tsx:58` bumped
`Party.Rapport` by 1 when the GM started an Encounter, with nothing anywhere in the UI saying so and
no note in `CHANGELOG.md`/`README.md` explaining where the rule came from. It had been there since
Combat shipped in `0.14.0`.

The repo owner confirmed it was **not** a deliberate, documented rule, but chose to keep the bump and
make it visible rather than remove a mechanic that might be real — "make a note to come back to this
later for confirmation, but this is a good enough fix for now." The twenty-eighth session's PR #85
did exactly that: the bump moved server-side into `POST /combat/start` (lands atomically with the
Encounter instead of as a separate client-side write), logs one `Encounter.History` entry, and a new
`useAnnounceCombatStart()` hook raises a client-side Toast the first time a client observes the new
Encounter via the existing `combat_encounters` Realtime subscription.

**Still to resolve — unchanged by the above, and not attempted this session:** whether the Combat
Basics V2.2 draft in `Planning Docs/` actually calls for Rapport on Combat start, and if so under
what conditions. Check the doc before either keeping it permanently or removing it — this is the
same class of "shipped code and rules doc were never cross-checked" gap the `0.17.0` audit found
several of.

**Update, thirty-eighth session (V0.5 adoption, documentation only):** the rule itself is now
**confirmed** — V0.5's Combat Loop step 1 states the same +1 Rapport on entering Combat this app
already ships. Downgrade this item from "unconfirmed rule" to **confirmed; two modifiers missing**.
V0.5 attaches two further conditions the app does not implement: +1 more (so +2 total) if every
Hero shares the same goal for the fight, and -1 if the party is ill-prepared or off-balance going
in. Building both is scoped to slice 5 in `WorkPlan-V0.5.md`, alongside the rest of the Combat
update — not attempted this session.

**Update, forty-third session (slice 5, `0.32.0`): fully RESOLVED, not just surfaced.**
`combatStartRapportDelta()` (`packages/shared/src/combat.ts`) implements both modifiers exactly as
V0.5 states them — the two branches are mutually exclusive, not three independent bonuses, so
initiating always yields +1 or +2 (never -1 regardless of preparedness) and not-initiating only
ever yields -1 or 0 (never +1/+2). `CombatPanel.tsx`'s start form asks the GM the two underlying
questions (did the Heroes initiate; do they share a goal / are they ill-prepared, whichever
applies) via `CheckboxRow`, and `apps/server/src/routes/combat.ts`'s `/start` route computes and
applies the delta server-side in the same request that creates the Encounter. Nothing further to
resolve on this item.

### 14. TODO: a full Advancement track silently swallows every further mark

Recorded at the repo owner's request in the twenty-ninth session ("we don't currently handle the
situation where we try to add to something that's already capped"). Confirmed against the code, not
assumed: every path that marks Potential, Rapport, or Kin clamps with `Math.min()` and drops the
excess with no record, no carry-over, and nothing shown to the player.

| Site | Code |
| --- | --- |
| `apps/web/src/features/sheet/EndSessionModal.tsx:59` | `Math.min(RapportTrackLength, d.Rapport + n)` |
| `apps/web/src/features/sheet/EndSessionModal.tsx:94` | `Math.min(PotentialTrackLength, d.Advancement.Potential + 1)` |
| `apps/server/src/routes/combat.ts:52` | `Math.min(5, party.Rapport + 1)` |
| `packages/shared/src/logic.ts:179` | `Math.min(5, bond.KinTrack + Delta)` on an accepted Mark Kin |

The UI can't even express the situation. `Pips` treats a tap on the currently-filled pip as *drop to
n−1* (`Pips.tsx:39`), so there's no gesture for "I earned another Potential while my track was
already full." And `AdvancementPicker`'s "Not yet — keep the track full" dismissal
(`AdvancementPicker.tsx:248`) deliberately leaves the track at max, which makes every subsequent
mark a silent loss until the player takes the Advancement.

**The rule question to settle before building anything:** does a mark on a full track **carry over**
after the Advancement is taken, **queue** a second Advancement, or is it **lost by rule**? Note the
Bond Kin-lock (`isBondLocked()`, `0.17.0`) is a close cousin that *does* have defined behavior, so
there may well be an answer in `Advancements.md` — check the doc before guessing.

Two smaller findings worth fixing in the same pass: three of the four sites above hardcode `5`
instead of reading `GameSettings.RapportTrackLength` / `KinTrackLength`, and
`AdvancementPanel.tsx:82`/`:113` hardcode `count={5}` rather than the configured track length — so
raising a track length in Content Admin today would only half-work.

**Update, thirty-eighth session (V0.5 adoption, documentation only):** V0.5 is **silent** on this —
nothing in the new draft addresses what happens when a mark lands on an already-full Advancement
(renamed Improvement, per the V0.5 delta) track. This item stays open exactly as before; it still
needs a rules answer, not a guess in code, and V0.5 gave no occasion to make one.

**Update, 2026-09-13 — the second half of this item is done; only the rules question is left.**
Re-checked against the code rather than the line numbers above, which are all pre-V0.6 and no longer
resolve. The "raising a track length in Content Admin only half-works" finding **no longer holds**:

- **No `count={<literal>}` remains anywhere** in `apps/web/src` — `AdvancementPanel` reads
  `rapportLen`/`bondLen` off `library.settings`, and every other `Pips` row takes its count from a
  setting (e.g. `StatusesPanel.tsx:216` uses `HealingTrackLength`).
- **Every clamp reads the setting**: `routes/party.ts:38` (`RapportTrackLength`),
  `routes/bond.ts:70`/`:107` (`BondTrackLength`), `routes/characters.ts:69` (`StrainTrackLength`),
  and each `addMotifPotential` call site passes `PotentialTrackLength`. `logic.ts`'s
  `DEFAULT_BOND_CAP` comment dates the Bond half of the fix to `0.50.0`.
- **`combat.ts`'s `Math.min(5, party.Rapport + 1)` is gone, and deliberately so** — V0.6 slice 7 made
  Rapport uncapped, banking overflow until the next Make Camp, so it is now
  `Math.max(0, party.Rapport + rapportDelta)` with the reasoning at the call site and on
  `types.ts:793`. Do not "restore" a cap here.
- The `?? 5` fallbacks that remain are read-time defaults in `normalizeLibrary` (`logic.ts:623-628`)
  and a null-library guard (`HomePage.tsx:24-25`), which are the correct pattern, not the bug.

Also note the item's "`KinTrackLength`" no longer exists under that name — V0.5 renamed Kin to Bond,
so the setting is `BondTrackLength`.

**What is still open is only the rules question** at the top of this item: does a mark on a full
track carry over, queue a second Advancement, or is it lost by rule? V0.5 was silent and V0.6 is
too. That still needs an answer from the ruleset or the repo owner, not a guess in code.

### 15. TODO: the advancement-options workflow kickoff

Also recorded at the repo owner's request in the twenty-ninth session, confirmed as covering **both**
halves below:

1. **The deferred Level / Tier-unlock formula** — this is open issue 12's still-open bullet,
   unchanged since `0.18.0`: "4 Tier-1 advancements *and* Level 5" can't both hold if Level is the
   count of picks taken; no `Level`/`PartyLevel` field exists; `unlockedTier()` still gates purely on
   count. Compounds with `Advancements.md`'s separate 2-tier-vs-4-tier contradiction.
2. **A guided flow when a track fills** — today `AdvancementPicker` appears the instant a track hits
   5, triggered by a pip tap (`AdvancementPanel.tsx:87`, `:118`) or from `EndSessionModal`. A modal
   materializing under the player's finger mid-tap is the wrong kickoff for what is a significant
   character moment; this wants a real announce → consider → choose → confirm flow.

**Update, thirty-eighth session (V0.5 adoption, documentation only):** the rules half of this item
(bullet 1 above) is the same open question as open issue 12's Level/Tier-unlock bullet, and lands
wherever that one lands — see the update appended there. The UX half (bullet 2, a real announce →
consider → choose → confirm flow) is untouched by V0.5 and stays open regardless of how the rules
question resolves.

**Update, forty-third session (slice 4, `0.31.0`):** bullet 1 is resolved — see open issue 12's
update above. Gating is DAG-only, no Tier/Level formula to unlock, so there's no longer a
Tier-unlock question for a guided flow to key off of. Bullet 2 (the UX half — an instant popup
instead of a considered "you've earned something" moment) is **still open and untouched**: the
Motif "Gain an Improvement" flow still opens `MotifAdvanceModal`/`ImprovementTreePicker` the
instant a pip tap fills the track, same as before this slice.

### 16. TWO ITEMS: `TechStackAudit.md`'s local JWT verification and compression middleware, both deliberately left unbuilt

The thirty-seventh session (`0.27.0`) executed `TechStackAudit.md`'s full section G "Order of work"
except these two — not oversights, and not the same reason as each other:

- **Local JWT verification (D5).** Would replace `apps/server/src/supabase.ts:24`'s
  `supabaseAdmin.auth.getUser(token)` (a network call to Supabase Auth on every authenticated
  request) with local JWKS verification. Two independent blockers: this sandbox still can't reach
  the Supabase dashboard to confirm the project uses asymmetric signing keys, which the change
  requires (same standing constraint as item 5 below — the live Supabase *host* is reachable via
  the MCP tool, but the *dashboard* isn't a thing the MCP tool exposes); and, separately, local
  verification trades away `auth.getUser()`'s live check that the user still exists and isn't
  banned for lower latency — a real security-relevant trade-off. Asked directly, the repo owner
  chose to leave this trade-off unmade rather than have a session decide it alone, independent of
  whether the sandbox blocker gets resolved. Needs both a "yes, make this trade-off" decision and
  dashboard access before a future session should attempt it.
- **Compression middleware (D6, half of it)** — the cache-headers half of this recommendation
  landed (`index.html` always `no-cache`, hashed assets `immutable`); adding `compression`
  middleware on top did not, because whether Render's free-tier edge already compresses responses
  can't be checked from this sandbox (no live HTTP to the deployed URL — same item-5 constraint).
  Adding it blind risks wasted CPU on a free instance if Render already handles this. Resolve with
  `curl -sI -H 'Accept-Encoding: gzip' https://asohav.onrender.com/assets/<any-hashed-file>` from
  somewhere with real network access to the deploy, then add the middleware only if that comes
  back without a `content-encoding: gzip`/`br` header already present.

Two related, smaller things worth a future session's attention, surfaced by the same pass but not
themselves blocked on anything — genuine scope, not urgent:

- **`react-router` and `vite` have each already moved a further major version** (to 8 and 8.2.1
  respectively) beyond what `TechStackAudit.md` itself assumed as current when it was written —
  within the *same day* the audit was written and then implemented. This session deliberately
  stayed on the audit's actually-approved targets (react-router 7, Vite 7) rather than chasing an
  unplanned, unreviewed major version; Vite 8 in particular is the audit's own explicitly deferred
  step (C16: Rolldown's Rust-based `css.modules.generateScopedName` could change every class name,
  and the audit's own reasoning was to wait until this session's new `apps/web` vitest suite and
  the existing responsive smoke test both exist to catch a real break — they now do, but Vite 8
  itself is still unattempted). Worth a fresh look, not a stale audit's numbers, next time either
  comes up.
- **The bundle budget has much thinner headroom than when it was first set.** `scripts/
  bundle-budget.mjs`'s ceiling started at 185 kB gzip (176.00 kB measured + 5%) and was raised
  twice in the same session for real, deliberate reasons (`manualChunks`, then React Compiler's
  runtime helper) to 208 kB — but the actual measured total after also landing react-router 7 and
  Vite 7 is ~200 kB, only a few kB of real margin left. Not a problem today, but the next
  first-load-JS addition (a new eagerly-loaded dependency, a route that shouldn't have been lazy
  in the first place) is more likely to need a real, justified budget bump than the last several
  changes were — check the number before assuming it's still comfortable.

**17. The V0.5 clean-break wipe is one-way — `seed.ts` can't regenerate a demo campaign** — TODO

Slice 1 changed `CharacterSheet`/`Bond`/`Party` shapes with no translation path, so existing rows
in the live Supabase project are unreadable by the new code and need deleting. That much is
expected and was the owner's explicit call.

What is *not* obvious: **wiping play data does not get you back to a seeded state.**
`runSeedIfEmpty()` (`apps/server/src/seed.ts`) gates the play-data block on
`profiles.count === 0`, not on campaigns or characters. Profiles are created by the
`on_auth_user_created` trigger on `auth.users`, and deleting every campaign deletes zero of them.
So after a wipe you get an empty app with eight working sign-ins and no campaign, and restarting
the server re-seeds nothing.

Two further findings from the same investigation, both pre-existing:

- **Delete campaigns, not characters.** `DELETE /api/campaigns/:id` cascades cleanly across all
  seven play-state tables including `combat_encounters`. The character-level path does not: the
  `party` row survives (it is keyed to the campaign), `combat_encounters` keeps participants whose
  `RefId` resolves to nothing (there is no FK — participants live inside the JSONB), and
  `memberships.ready` is stranded `true` with a null `character_id`, which the ready-toggle route
  then refuses to let the player clear.
- **Neither delete writes a changelog entry**, unlike every library mutation, so a play-data wipe
  is invisible in the admin audit trail.

The fix, if a re-seedable reset is wanted, is to loosen the gate to something play-data-shaped
(`campaigns.count === 0`) and make the user-creation block idempotent. Deliberately not done in
slice 1 — the owner chose "wipe only, no demo data", so this is recorded rather than built.

**Update, fortieth session: the wipe has now actually run, and this played out exactly as
described.** All seven play-state tables are at 0; `profiles` still has its 8 rows; the campaign-
level `delete` cascaded cleanly with no orphans, confirming the "delete campaigns, not characters"
finding from the right side. The live app is now an empty shell with eight working sign-ins, and
restarting the server will not change that.

**18. A transient Supabase blip at boot takes down a whole deploy** — **RESOLVED in `0.50.0`**

`apps/server/src/index.ts:23` calls `await runSeedIfEmpty()` at module top level, **before**
`app.listen`. Its first act (`libraryExists()`, `apps/server/src/seed.ts:30`) is an unguarded
Supabase call, and nothing catches a throw — so any upstream hiccup during boot kills the process
and Render marks the deploy `update_failed`.

This is not hypothetical: it is exactly what happened to the slice-1 merge deploy
(`dep-dac0gduq1p3s739r5nmg`, 2026-09-02 11:28 UTC). Supabase answered a Cloudflare **521 "Web
server is down"**, the seed check threw the HTML error page as an exception, node exited, and
Render silently kept the previous (2026-08-16) deploy live. `main` looked green the whole time.
A manual re-trigger four hours later succeeded with no code change.

The failure mode is worse than a crash: it is **a crash that presents as a healthy site**, because
Render's behavior on a failed deploy is to keep serving the old one.

The fix is small and the tradeoff is worth stating: seeding is a **development convenience**, not
a production invariant, so the server refusing to boot because a seed *check* failed is incidental,
not deliberate. Either wrap the call (`try { await runSeedIfEmpty() } catch (e) { console.error(...) }`)
or move it after `app.listen` so the health check can come up regardless. Wrapping is preferred —
it keeps the ordering guarantee for a genuinely empty database while making an unreachable one
non-fatal.

**Fixed in `0.50.0`** with the preferred wrapping: `apps/server/src/index.ts` catches, logs
`[boot] Seed check failed — starting the server anyway.`, and proceeds to `app.listen`, so the
health check and the real build come up regardless. Twenty-one releases elapsed between the
incident and the fix, which is the part worth remembering: the issue was correctly diagnosed, the
fix was correctly specified down to the line, and it still sat here through eight ruleset slices
because no release was ever scoped to it. The note above about wanting a boot-path test still
stands and is still unaddressed — `index.ts` has no test, and adding one means restructuring the
module's top-level await into something callable.

**19. The live `library` row is stale against slice 1's seed — one click in Content Admin** — TODO

The wipe deliberately kept `library` (it is content, not play data). But slice 1 **changed the
seed content**, and nothing re-seeds a library row that already exists — `runSeedIfEmpty()` skips
it whenever `libraryExists()` is true. So the live row is still the pre-slice-1 content.

Verified by diffing the live row against `seedLibrary()`'s current output. The differences are
**exactly** slice 1's own seed changes and nothing else, which also proves the row carries **zero
repo-owner-authored content** — it is the untouched original seed, so refreshing it loses nothing:

- `settings`: has `KinTrackLength: 5`, no `BondTrackLength`. Mechanically harmless —
  `normalizeLibrary()` backfills the default on every read — but the dead key persists.
- `glossary`: still has `g-kin` and `g-dishonored`; **missing `g-crumble`, `g-aid` and
  `g-unstable`**; and `g-bond`/`g-rapport`/`g-recovery`/`g-status`/`g-subdued` still carry their
  pre-V0.5 definitions.
- `moves` `m-forge`/`m-solace`/`m-strike`/`m-sway` and skill `s-ward`: still Kin-worded prose.

**User-visible consequence right now:** `VirtuesPanel`'s Crumble control looks its term up by
`Id === 'g-crumble'` with a Name fallback, and neither resolves — so the app's headline new
mechanic renders with no definition, while a dead "Kin" term and a "Dishonored" term describing a
mechanic that no longer exists both still appear in the Glossary drawer.

**The fix is one click: Content Admin → Data → "Reset to seed"**, which `POST`s to
`/api/library/reset` (`apps/server/src/routes/library.ts:55`, admin-only), writes `seedLibrary()`
and logs a changelog entry attributed to whoever clicked it. Not done from the fortieth session's
sandbox because both remote paths were closed: the Supabase host is egress-blocked (open issue 5),
and the reset endpoint needs an admin bearer token that can only be obtained through that same
blocked host. Hand-transcribing ~40KB of seed JSON into a SQL literal was rejected as exactly the
kind of thing that introduces silent content drift.

**Generalise this past slice 1:** every later slice that touches `seedLibrary()` will leave the
live row stale the same way, and — as the `0.17.0` audit found the hard way — a stale library
degrades *silently* into wrong gameplay math rather than erroring. Make "reset the live library"
an explicit step in any slice that changes seed content.

**20. A committed migration is not an applied one, and this has now happened three times — most
recently causing a real, hours-long production outage of a shipped feature** — the `release-
reliability-checklist` skill already named this exact risk in its step 3, and it was still missed
twice more after being named.

Render's deploy pipeline (`render.yaml`'s `buildCommand`/`startCommand`) never runs
`supabase db push` or any equivalent — applying a `supabase/migrations/*.sql` file to the live
Supabase project has always been a fully separate, manual action from merging and deploying the
code that depends on it. Three incidents, in order:

- **`0010_combat_encounters.sql`** (`0.14.0`, Combat) shipped unapplied; caught and fixed by the
  eighteenth session (2026-08-09) via the Supabase MCP tool, closing the gap flagged in the
  seventeenth session's note and PR #39.
- **`0011_clocks.sql`** (`0.33.0`, slice 6 — Clocks) shipped unapplied and **stayed that way for
  8+ hours in production**, from the `0.33.0` merge deploy (`dep-dacmq0ek1f9s7389063g`,
  2026-09-03 12:50 UTC) until this gap was found and fixed. Render's own logs show the concrete
  cost: starting at `19:07:03Z`, the server logged `"Could not find the table 'public.clocks' in
  the schema cache"` on every attempt to read Clocks for a campaign — a hard, repeating runtime
  error on a shipped, merged, CI-green feature, for anyone who opened a campaign with an open
  Clock in that window. Not found by any session's own release checklist; found by the repo owner
  reading Render's logs directly and asking a session to check.
- **`0012_adventures.sql`** (`0.36.0`, slice 9) shipped unapplied in the same PR that fixed the
  `0011` gap above — the forty-eighth session ran its full local verification suite
  (typecheck/build/test/lint/responsive) before merging and still never ran the "confirm applied
  to the live project" check its own release checklist already documented, because the checklist
  itself was never invoked as a named step. Caught in the same pass as `0011` only because the
  repo owner asked about `0011` specifically and the session then thought to check for *other*
  pending migrations too — a single explicit prompt closed both gaps at once, which is exactly the
  kind of check a mechanical step doesn't need a prompt for.

**The pattern underneath the pattern**: the fix has never been "write down that this needs
checking" — that was already done, twice, before this item existed. `release-reliability-
checklist`'s step 3 named this risk from the session that introduced the skill itself. What was
actually missing is a step 5 bullet with the same unconditional, mandatory framing the "live
library reset" check already has (which itself has never recurred since gaining that framing) —
step 3's version is phrased as a conditional aside ("if you have Supabase MCP access"), easy to
read as optional, and step 3 runs *before* the merge, when the migration that matters most (this
release's own) may not even be the thing being checked. Fixed this session: the skill now carries
a mandatory step 5 bullet, phrased with the same force as the library-reset one and citing this
item by number, plus a "Migrations applied" line in the report-shape template so a session that
runs the checklist can't silently skip past it the way three sessions in a row apparently did
despite the step existing. See `.claude/skills/release-reliability-checklist/SKILL.md` step 5 and
`CLAUDE.md`'s "Deployment" section for the reworded checks.

**21. `GlossaryText` doesn't wrap Adventure prose — a real, deliberately-recorded gap, not an oversight in `0.37.0`'s Adventure-panel cleanup** — TODO

This app's own convention is that every authored-or-player-authored prose render site gets
`GlossaryText`'s auto-linking (see `CLAUDE.md`'s "Frontend conventions"), and `AdventuresPanel.tsx`
has several candidates — Concept, Hook, each Secret's text, each Countdown step's text. `0.37.0`'s
Issue 18 (UI/UX cleanup pass) looked at this directly and didn't add it: every one of those fields
is a live, `onBlur`-committing `<textarea>`, and `GlossaryText` renders a read-only span with
tap-to-reveal term definitions — it cannot wrap a `<textarea>`'s editable value. Doing this properly
means a read/edit toggle per field (render `GlossaryText` when not focused/editing, swap to the
plain `<textarea>` on focus), which is a real feature, not a cleanup-pass line item. Left undone on
purpose rather than half-built as a permanent read-only render replacing the editable field.

**22. Invite email delivery (`0.37.0`, Issue 17) has never been verified end-to-end — needs a manual check after deploy, plus one Supabase dashboard step** — TODO

Both provider legs (`apps/server/src/email.ts`) have real unit-test coverage with a mocked `fetch`/
mocked Supabase Auth admin client, but neither has ever actually sent an email from this sandbox —
raw TCP is blocked, and (per the sandbox-reachability table in "Sandbox network constraints") a
headless-Chromium request to any external host currently fails identically to a live one, so there
is no way to drive the real UI against a live server from here either. Two things need the repo
owner's own hands after this ships and deploys:

- **Send one real invite to an address with no Supabase account and one to an address that already
  has one**, confirming the Supabase leg and the Resend leg both actually land a message (not just
  that `sendInviteEmail()` returns `{ delivered: true, ... }` — a provider can accept a request and
  still never deliver it).
- **Configure custom SMTP for the Supabase project** (Supabase dashboard → Auth → Emails) before the
  `inviteUserByEmail` leg will deliver to a real inbox at all — Supabase's own built-in email
  service is documented as testing-only (low rate limit, restricted to project-team addresses in
  current projects). Until this is done, every new-user invite silently no-ops from the *recipient's*
  side even though the server reports `delivered: true` (Supabase accepted the request; its own
  send just never reaches a real inbox) — the code/link still work by hand regardless, so this
  doesn't block using the feature, only its automated-email half.

Also needs `RESEND_API_KEY`/`INVITE_FROM_EMAIL`/`APP_BASE_URL` set in Render (see `render.yaml`) —
without them the Resend leg no-ops (`via: 'none'`) and the emailed link would point at
`http://localhost:5173`, respectively. None of this blocks CI or the deploy itself; it blocks the
*feature*, silently, the same way an unapplied migration or a stale seed library has before (open
issues 19/20 above) — check it explicitly rather than assuming a green deploy means invite emails
are actually going out.

### 17. Combat's Slice 1 adaptation is a forced-minimal compile fix, not Slice 3's real rebuild —
don't extend it as if it were

`0.42.0` had to touch `EncounterView.tsx`/`CombatMoveModal.tsx`/`ParticipantCard.tsx` because
retyping `CharacterStatus` broke their compilation, not because Slice 3 ("Combat on Strain",
`0.44.0`) started early. What shipped applies `WorkPlan-V0.6.md` Section B1's mapping table at the
primitive level only — see CLAUDE.md's "Architecture: Strain & Statuses (V0.6 slice 1)" and
`README.md` item 44 for the full list of what changed and why. Specific things a future session
should not assume are settled just because the code compiles and the smoke test is clean:

- **RESOLVED, Slice 3 (`0.44.0`): Cover is a real mechanic now**, not a static reminder banner — see
  CLAUDE.md's "Architecture: Combat on Strain (V0.6 slice 3)". The bullet that used to stand here
  (recording that Slice 2 didn't touch `CombatMoveModal.tsx`) is left below as history rather than
  deleted, since it explains the sequencing, but don't read it as still-current: `computeRollBreakdown()`
  now takes real `RollExtras` in `CombatMoveModal.tsx` too, and Cover counts as an extra Bane against
  the attacker.
- **Halt/Impede's PC-ally-target branch is unreachable in the current UI** (Gambits only attach to
  a PC's own Engage roll, which only ever targets the opposing side) and, if a GM-driven Encounter
  ever does reach it, only logs a note rather than granting anything — this app still has no
  generalized cross-character Bane-offer mechanism. **Still true after Slice 3** — not touched.
- **`markEnemyStrain()`'s "which named track" picker in `CombatMoveModal.tsx` is still a stopgap,
  even after Slice 3.** B1 doesn't say how an attacker picks among an Enemy's several Strain
  tracks, and Slice 3's own scope was the mapping table's *remaining* items (Cover, Brace, Combat
  Loop) — it deliberately didn't reopen or reconsider this part of B1. Still the pre-migration
  shape (a GM-picked/typed track name). Revisit only on a fresh repo-owner decision, not by default
  just because a later slice touches Combat again.
- **The responsive smoke test has now been run on both the character-sheet and Combat routes, both
  clean.** The Combat-route run (all three encounter states — no active encounter, active as
  player, active as GM — at all seven viewports, both appearances) finished after this session's
  context first ran out mid-check; it came back "All routes clean at every viewport" with no
  overflow/hit-area/overlap findings, so the `ParticipantCard.tsx`/`EncounterView.tsx`/
  `CombatMoveModal.tsx` layout changes needed no follow-up fix. Re-run it yourself if you touch
  those files again — a clean run today doesn't cover a future edit.

### 18. RESOLVED (`0.50.0`): an unguarded boot seed could stop the server from starting

**This item was cited from four places for twenty-two releases without ever existing here.**
`CLAUDE.md`'s Deployment section, `apps/server/src/index.ts` and this file's own item 16 all pointed
at "open issue 18"; the numbered list stopped at 17. Written up properly in `0.52.0` so the
citations resolve.

`apps/server/src/index.ts` opened with a bare top-level `await runSeedIfEmpty()`. At `0.28.0` a
transient Supabase 521 threw out of it, the process died before `app.listen`, Render's failed deploy
silently kept serving the previous build, and **production served a two-week-old build for about
four hours** before anyone looked. Correctly diagnosed at the time, down to the line — and left
unfixed for twenty-one releases. `0.50.0` wrapped it in a try/catch that logs and starts the server
anyway. Seeding can now fail without taking the app down.

### 19. The live `library` row goes stale whenever `seedLibrary.ts` changes

`runSeedIfEmpty()` skips a library that already exists, so seed-content changes **never reach
production on their own**. Someone has to click Content Admin → Data → "Reset to seed" after the
deploy.

The failure mode is what makes this worth an item: per the `0.17.0` audit, a stale library degrades
*silently into wrong gameplay math* — 0 Recoveries on new characters, an unenforced Skill cap,
Advancement Tiers stuck at 1 — rather than erroring. Nothing points back at the cause.

**Measured on 2026-09-13, and it was far worse than this item claimed.** Until then this item said
only that `0.50.0`'s `g-hold` edit was outstanding. The live row was actually **the `0.35.0` seed —
sixteen releases behind, predating the entire V0.6 migration** (`0.42.0`–`0.49.0`). The understatement
is the lesson: nobody had measured, so the item recorded the one seed change a session happened to
remember making.

How it was established, so it can be repeated in one pass:

```sql
-- 1. the whole authoring history of the live library
select at, who, action, collection, object_id from changelog order by at desc;
-- 2. per-collection id sets, to diff against seedLibrary() locally
select key, jsonb_array_length(value),
       (select string_agg(e->>'Id', ',' order by e->>'Id') from jsonb_array_elements(value) e)
from library, jsonb_each(data) where jsonb_typeof(value) = 'array';
```

The changelog returned **exactly one row for all time** — `reset` / `Whole library` /
`mikekane848@gmail.com` / `2026-09-03 16:26:06+00`, with no create, update or delete entry before or
since. That timestamp sits between `0.35.0` (15:58) and `0.36.0` (17:21) in `CHANGELOG.md`, which is
what dates the row.

**Do not read that empty changelog as "nothing was ever authored" — that inference was made here and
it was wrong.** `0.53.1` found that `appendChangeLog` could never write a row at all (it sent a
`log-`-prefixed id into a `uuid` column), so the table is empty because it was unwritable, not
because the panel went unused. The lone Sept 3 row has a real uuid and byte-identical code on that
date, so it was not written by the app either. What actually established that a reset was safe was
the id-set comparison below plus the character-sheet check at the end of this item — evidence about
the data itself, not about an audit trail that turned out to be broken.

What was actually stale:

| | Live (`0.35.0` seed) | `seedLibrary()` at `0.53.0` |
|---|---|---|
| `glossary` | 29 terms | 39 terms |
| — missing from live | `g-strain`, `g-healing-track`, `g-boon`, `g-bane`, `g-consequence`, `g-push-yourself`, `g-set-out`, `g-opposition-clock`, `g-threat-clock`, `g-project-clock`, `g-development`, `g-headway` | |
| — retired, still live | `g-attrition`, `g-recovery` (the pre-V0.6 vocabulary Strain and the Healing Track replaced) | |
| `settings` | carries `RecoveriesMax: 6`, `StatusMaxRank: 6` | both retired; no code reads either |
| `m-levelup` | named **"Level Up"** | named **"Advance a Motif"** |
| `m-camp` | 571 bytes | 1,291 bytes |

Every *other* collection's id set matched the seed exactly — `moves` 22, `improvements` 50,
`improvementTrees` 25, and so on. That is the trap: an id-level check looks clean, and the drift is
almost entirely *inside* records whose ids never changed. `m-assess`, `m-strike`, `m-recuperate` and
`m-camp` all differ in body text while keeping their ids.

**Why it looked maintained.** `library.updated_at` read `2026-09-12 18:52:08+00` — nine days after
the reset and after `0.51.0` deployed — with no changelog entry to match. That write is
`getLibraryWithVersion()`'s self-heal (`repo.ts:58-73`), which re-`normalizeLibrary()`s the row and
saves it back when a key is missing. It deliberately writes no changelog entry, because it is a
read-path schema heal rather than an authored change. **It backfills structure, never content** —
so it will keep a sixteen-release-old library structurally valid forever while every word in it
stays frozen. A recent `updated_at` on this row is therefore not evidence the library is current.

A reset was confirmed safe for live play before recommending it: all three live `character_sheets`
hold **zero** `Improvements` and **zero** `Items`, and their `Motifs` are embedded snapshots with no
`Id` field — so no live character references the library at all, and nothing can dangle.

**Reset and verified on 2026-09-13.** The live row now carries 39 glossary terms, `g-hold` with its
`0.50.0` text, `m-levelup` as "Advance a Motif", and no `RecoveriesMax`/`StatusMaxRank`. The click
itself is what uncovered `0.53.1`: it returned *"Reset failed — invalid input syntax for type uuid:
`log-2mks435g`"* while the library write had **already succeeded**, because every one of these
routes saves the library before appending its audit entry. So the standing advice for this item
gains a caveat — after a reset that reports failure, **query the row before clicking again**. It may
well have worked.

### 20. A merged migration is not an applied migration — Render never runs them

`render.yaml`'s `buildCommand`/`startCommand` build and start the Node server. Neither runs
`supabase db push` or anything equivalent, and neither ever has. Applying a new
`supabase/migrations/*.sql` to the live project is a separate, manual action.

Three real incidents, all the same shape — CI green (it never touches the live database), deploy
`live`, feature broken anyway:

- `0010_combat_encounters.sql` (`0.14.0`) — caught by a dedicated live-ops session.
- `0011_clocks.sql` (`0.33.0`) — shipped unapplied, stayed that way **8+ hours in production**, with
  Render's logs repeating `"Could not find the table 'public.clocks' in the schema cache"` on every
  read of a campaign's Clocks.
- `0012_adventures.sql` (`0.36.0`) — shipped unapplied **in the very merge that fixed the `0011`
  gap**, because that session's release verification didn't include this check either.

After merging any PR that adds a migration file, apply it via the Supabase MCP `apply_migration`
tool and confirm with `list_migrations`. This is a mandatory step 5 item in the
`release-reliability-checklist` skill, not an optional aside — a conditional pre-merge mention was
demonstrably easy enough to miss twice. All 15 migrations are currently applied.

### 21. `GlossaryText` cannot wrap Adventure prose, because every candidate field is an editable control

Cited by `CHANGELOG.md`'s `0.37.0` entry as "a real, recorded gap" — and then never recorded here.
Found by `scripts/check-docs.mjs` during the `0.52.0` docs split, which is the same tooling that
found 18/19/20 missing, catching the same mistake one release-set later.

`CLAUDE.md`'s own frontend convention is that *any* authored or player-authored prose rendered
anywhere in the app goes through `GlossaryText`, so glossary terms auto-link into their own
tap-to-reveal definitions. Adventure Prep is the one surface that cannot comply: Concept, Hook and
every Secret are live, `onBlur`-committing `<textarea>` elements, and `GlossaryText` wraps text
nodes — it has nothing to attach to inside an editable control.

Not a bug with a small fix. The options are a read-only/edit toggle per field, rendering a
glossary-linked shadow copy beside the editor, or accepting that GM prep prose is the one place
terms do not auto-link. Nobody has chosen; the app currently does the last of those implicitly.

### 22. Invite email delivery has never been verified live, and cannot be from this sandbox

Cited by `CHANGELOG.md`'s `0.37.0` entry as needing "a manual post-deploy check," never recorded
here. Same origin as item 21.

`0.37.0` added best-effort email delivery to campaign invites on top of the unchanged code/link
flow. Two legs, neither exercised end to end: Resend (for an address that already has an account)
and Supabase's `inviteUserByEmail` (for one that does not). The invite code and link remain
authoritative, so nothing is *broken* — email is a convenience that may simply be silently
no-op'ing in production.

Two specific things to confirm, both config rather than code:

- **`RESEND_API_KEY` and `INVITE_FROM_EMAIL` must be set on the live service**, and the From
  address verified in the Resend dashboard. With the key unset the Resend leg no-ops by design
  (`via: 'none'`), which looks identical to success from the app's side.
- **Supabase's built-in email service is documented as testing-only** — best-effort delivery, a low
  hourly rate limit, and in current projects restricted to project-team addresses. The
  `inviteUserByEmail` leg needs **custom SMTP configured in the Supabase dashboard** before it
  reaches a real player's inbox. That is a one-time dashboard step, not code, and until it is done
  this leg does not actually work for anyone outside the project team.

It could not be tested from the environments this project is developed in: outbound mail is not
reachable, and as of the forty-second session headless Chromium cannot reach the deployed app at
all through the sandbox proxy, so there is no browser path to it either.

## Known gaps in V0.6

These are questions the ruleset itself leaves open — several are marked with a literal "??" in
`Planning Docs/Ruleset-V0.6.md`'s own text, not inferred by a reading of it. Recorded here,
resolved nowhere, so no future session guesses at an answer in code before the repo owner actually
settles one. Per the standing rule for this kind of list, filling one of these in is separate work,
not something to do unprompted just because a slice touches the area.

**This list replaced "Known gaps in V0.5" in the fifty-third session, when V0.6 was adopted.** Four
items closed on their own — V0.6 either deleted the contradictory text or made the question moot —
and they are recorded below as closed rather than silently dropped, because a reader who had
internalised the old list needs to know why an item vanished. Everything else carried forward
unchanged, plus eleven new fences V0.6 opens for the first time. The full delta, with slice
references, is `Planning Docs/WorkPlan-V0.6.md` Section D.

### Closed by V0.6

1. **The Level-vs-Tier gate — CLOSED.** V0.5 stated the Hero Improvement gating rule twice, in two
   contradictory ways, and slice 4 (`0.31.0`) resolved it for code by gating purely on the DAG and
   treating the Tier/Level section as leftover draft text. **V0.6 deletes that section outright.**
   The DAG reading is now simply what the document says; the judgment call became the plain text.
   Note the consequence for stranded code: `CharacterSheet.Level` was kept in `0.31.0` *only*
   because the deleted section named it, so it now has no doc support at all. `Party.PartyLevel` is
   different — its increment loses support too, but its use survives (`campActionsAllowed =
   PartyLevel + 1`, still in Make Camp).
2. **"Shot in the Dark" — CLOSED by deletion.** The Bond-0 Move that V0.5 referenced but never
   defined is gone from V0.6 entirely.
3. **Recoveries start at 6 or 8 — MOOT.** V0.5 literally wrote "6 (or 8?)" and never picked. V0.6
   replaces Recoveries with the Healing Track, so there is nothing left to pick.
4. **The Hero Status Rank cap — MOOT for Heroes.** V0.5's design note asked whether the cap of 6
   should scale with Level. Under V0.6's severity slots a Hero has no Status Ranks. The design note
   survives verbatim in V0.6 only because the Combat chapter was never rewritten (see item 20).

**Half closed:** V0.5's "Roll + an appropriate Ability" appeared in both Invoke Expertise and Take a
Risk, leftover vocabulary from a draft that had Abilities rather than Virtues. V0.6 fixes **Invoke
Expertise** (now "an appropriate Virtue"). **Take a Risk still says Ability.**

### Carried forward, unchanged

5. **Crumble / Fall / Dishonored.** V0.6 still says "you Fall / are Dishonored" in one section and
   "you Crumble" two sections later, with no stated relationship between the terms.
6. **The Countdown lists five named steps (Seed/Bloom/Wilt/Wither/Rot) under prose promising six.**
   Surfaced in code in slice 9 (`0.36.0`) and still unresolved by design —
   `ADVENTURE_COUNTDOWN_STEP_NAMES` ships exactly the five named steps and no invented sixth.
7. **The Party Skill Tag economy.** "Do Party Skill Tags only get used once between Camping? Maybe
   they are stronger than Hero? +2? Advantage? Do you start with one for each party member? What
   about weaknesses?" — verbatim, still unanswered, and now **more** pressing than it was: slice 2
   of the V0.6 migration makes Hero tags mechanical, and party tags would sit right beside them.
8. **"Depleted: expend a resource."** Renamed from "Attrition" in V0.6, but "resource" is still
   never defined — Wealth, Hold, a Condition mark and an item Charge are all candidates.
9. **"Any rolls made with a Virtue marked with a Condition award 1 Potential (optional??)."** Still
   marked optional. V0.5 had two instances of this; V0.6 dropped one, so at least it now appears once.
10. **Tree Specializations vs. Improvement Trees.** The 24-entry specialization list is now labelled
    "Crows Tree Specialization" — an attribution, not a resolution. Still no stated relationship to
    the 25 Improvement Trees beside it.
11. **XP and Potential** are still used interchangeably in one surviving place: Bond spending's
    "Offer them an **experience point** to do what you want." Every other instance was cleaned up.
12. **Subdued's duration**, and whether a downed Hero can be finished off. Still unanswered — and now
    load-bearing in a way it wasn't, because V0.6 deletes Scars / Risk Death / Blaze of Glory and
    leaves Subdued as the *only* defeat state.
13. **All 50 seeded Improvements are still placeholders.** V0.6 authors zero nodes across all 25
    trees, exactly as V0.5 did. Party Improvements gains its first four authored examples; Bond
    Improvements is still an empty header.

### New in V0.6

14. **Strain track size.** The document asks itself, in the text: "is 5 the right number for these?
    Could be 3 + Mettle? Is there a Body and Mind Strain track, or just one? Depends on what other
    things will ask you to use Strain."
15. **Resist balance.** Nothing makes *taking a Status* worthwhile versus simply rolling to Resist
    again. Flagged as a real concern in the 2026-09-03 design meeting; a resource cost on repeated
    resistance was suggested and explicitly not decided.
16. **Scene-boundary abuse.** Strain clears at the end of a scene and Recuperate costs Strain, so
    nothing in the text stops a party ending scenes repeatedly to clear Strain and keep healing.
    Named in the meeting as needing testing.
17. **"Need a name for *the* standard roll."** The document asks for a term it does not have. This
    one has a direct cost in the app: the roll control needs a label.
18. **"You typically take a Condition due to….?"** The sentence trails off mid-thought in the
    Conditions chapter.
19. **Recuperate's "Improvement on 12+??"** — an unresolved bracket inside the Move text.
20. **Enemy Status Limits under Strain: `Set Status Limits. !! UPDATE`.** Ryan's own marker on the
    Villain template. The Combat chapter was never migrated (see below), so enemy Limits have no
    stated relationship to Strain at all. `WorkPlan-V0.6.md` Section B1 supplies the app's working
    answer — treating them as **Strain Limits** on a counting track — and that answer is explicitly
    ours, not the document's.
21. **"Is 5 the right number for these? Maybe 3 like Act Breaks? Or is 5 keeping it from going TOO
    fast?"** — asked of the Bond and Rapport track lengths.
22. **Forge a Bond's effect is literally "TO BE DETERMINED."** A regression in specificity from V0.5,
    which at least said "increase your Bond Level by 1 and take a move available at that level".
23. **The "In Some Order" character-creation block** — Party Motif and Quest, a starting Party
    Improvement, starting Camp Assets, the Bond Track, starting Load — is a TODO list in the
    document, not rules. Character creation cannot be extended to cover it yet.
24. **`GameSettings.ConditionFloor`.** V0.6 drops the "(with a floor of −3 total)" clause from the
    Conditions chapter. This reads more like an editing slip than a rules change — the clause simply
    isn't there any more, and nothing replaces it — but it is a deliberate-looking deletion and the
    app has a live setting for it. Flagged, not acted on.

### The one that isn't a gap so much as a known state of the document

25. **V0.6's Combat Basics chapter is byte-identical to V0.5's.** Verified by diffing the two ranges
    directly. It was never rewritten for Strain: it still says "Apply *Status 5*", still spends
    Recoveries, still defines Unstable at Rank 4, still treats Cover as a ranked Positive Status, and
    still has Defend negate "a Status". None of that is compatible with the Strain chapter twelve
    pages earlier. The 2026-09-03 meeting's own process note was "update the rules throughout to use
    the new Strain and Status terminology," which has not happened. **Per a repo-owner decision the
    app reconciles this itself** rather than blocking or running two harm systems — the mapping is
    fixed once in `WorkPlan-V0.6.md` Section B1 and recorded as a `README.md` judgment call. Unlike
    every other item in this list, this one has an answer in code; it just isn't the document's answer.

## Project documentation gaps

Identified during this session's V0.5 adoption pass and deliberately **not** filled — recording a
gap is this session's job, closing it is separate work the repo owner hasn't scoped, prioritized, or
asked for yet. Don't treat any item below as an implicit task list.

1. **No rules-to-code traceability map exists.** Nothing in this repo states which rule in
   `Ruleset-V0.5.md` (or, before it, the six archived rules files) lives in which function — the
   mapping is reconstructed by hand each time a session needs it, the way this file and `README.md`
   already do informally.
2. **No content-authoring guide for Content Admin**, despite the repo owner being the one actually
   authoring library content there — still true, though the raw-JSON half of this gap that used to
   motivate it most is now closed. Of the three collections named at the time this item was written
   (`Move.Results`, `Ability.Effects`, `EnemyTemplate.StatusLimits`), `Move.Results` got real schema
   validation in slice 3 (`0.30.0`), `Ability` was retired outright in slice 2 (`0.29.0`, V0.5 has no
   Abilities), and `EnemyTemplate.StatusLimits` got the same treatment in slice 8 (`0.35.0`, see
   `README.md` item 38) — so no collection in the schema still uses raw, unvalidated `json` for a
   structured shape. A content-authoring *guide* (prose explaining Content Admin's fields to the
   repo owner) is still genuinely unwritten; only the "no schema guard" half is resolved.
3. **`loadTiers` has no admin screen**, and until now that gap itself was undocumented — `LoadPanel`
   consumes it but it's absent from `schema.ts`'s `collections`, so there's no Content Admin CRUD
   surface for it at all.
4. **No record of what the test suite actually pins.** `logic.test.ts`/`engine.test.ts` encode real
   rules decisions — that a roll's `Total` excludes the highest Status, the Condition floor at -3,
   the Bond-rollover behavior at Level 5 — that read, to an unfamiliar reader, as implementation
   detail rather than as the settled rules calls they actually are.
5. **Deliberate-omission records are scattered.** What this app has chosen not to build lives across
   README's "What's not built," this file's own Open issues, and prose buried in `CLAUDE.md` —
   there's no single list a session can check before assuming a gap is new.
6. **No doc explains the seed/demo data's relationship to the live database.** `seedPlay.ts` still
   uses a retired Virtue array that current validation would reject outright if run through today's
   character-creation schema — nothing states whether the seed is meant to be regenerated, hand-
   patched, or left as a known-stale fixture.
7. **`CHANGELOG.md` entries `0.13.0`-`0.18.0` cite a source document that was never in this repo** —
   the same missing "14,000+ line working design doc" the thirty-eighth-session note above closes
   as history. `CHANGELOG.md` is explicitly out of scope for this pass (it's history, not living
   documentation), so those citations were deliberately left exactly as written; a reader who
   follows one today finds nothing at the far end.
8. **No version has ever been git-tagged** — this is the existing open issue 3 above, listed here
   again only because it's also, independently, a documentation-process gap rather than purely a
   permissions problem.

## Everything else

- What's deliberately *not* built (dice rolling — a permanent decision, not a gap — Hero Moves, a
  Combat grid, Bond-proposal expiry, etc.) is listed in
  [`docs/not-built.md`](docs/not-built.md), kept current as of `0.16.0`.
- Design decisions and judgment calls (why Realtime instead of WebSockets, why no
  character-creation flow, etc.) are in
  [`docs/decisions.md`](docs/decisions.md).
- Full version-by-version history: [CHANGELOG.md](CHANGELOG.md).
