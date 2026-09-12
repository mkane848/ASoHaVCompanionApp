# Tech stack audit — RSC, TanStack, and what actually pays

> **Status: section G's Order of work fully executed as of `0.27.0`, except D5 (deliberately
> skipped — see B5/HANDOFF.md).** Written in response to a direct repo-owner question about
> adopting React Server Components and/or TanStack Start. Sections A and B are answers; C's
> recommendations were approved and implemented in the same session that asked the question that
> follows section H below — see each of B1–B8's own **Fixed** lines and G's checked-off items for
> what landed and what was deliberately deferred, and CHANGELOG.md's `0.27.0` entry for the
> release-facing summary.
>
> Audited against `main @ e8faec4`, version `0.26.0`, on 2026-08-16. Implemented against the same
> branch the same day.

## Summary

**Neither React Server Components nor TanStack Start should be adopted.** Not because they are
immature — RSC is production-proven elsewhere and TanStack Start reached 1.0 in March 2026 — but
because this specific app is close to the worst possible fit for both. It is 100% authenticated, so
there is no SEO surface. Its session token lives only in `localStorage`, so a server render cannot
identify the user without a migration that would introduce a CSRF attack surface the app is currently
immune to by construction. And its hot path — optimistic local mutation reconciled by a Supabase
Realtime push — is architecturally opposed to RSC's model of streaming rendered output from the
server. RSC would make combat and live sheet editing *slower*.

That verdict took about a day to reach and is not the useful part of this document. The useful part
is section B: while tracing what RSC would need, the audit found the cold-load path costs two serial
round trips and ~212 kB gzip, the single hottest server route (`/bootstrap`) does 8–10 round trips
including an N+1, every campaign load ships **every user row in the database** to the client, and
8,729 lines of `apps/web` have zero unit coverage. Section C ranks sixteen candidate changes against
those findings. The top four are worth more than any framework migration and cost about 40 lines
between them.

**One honest caveat up front, stated because this repo's audit convention depends on it:**
`ResponsiveAudit.md` opens with "every number below was measured in a real Chromium."
This audit **cannot** make that claim. `node_modules` was not installed in the session that produced
it, no build ran, no bundle was weighed, and live QA and live DB access are both blocked (`HANDOFF.md`
open issue 5). Section H states exactly which findings are measured, which are read off the import
graph, and which are unverified.

---

## A — The question asked: RSC and TanStack Start

### A1 — What RSC would need from this app, and why that chain breaks

`apps/web/src/lib/supabaseClient.ts` is ten lines and ends with `createClient(url, anonKey)` — no
options object. That means `storage` defaults to `window.localStorage`. `grep -rn cookie` across
`apps/server/src` and `apps/web/src` returns **zero hits**. There is no cookie anywhere in this
application.

A server rendering HTML for a request therefore has no way to know who is asking. The first
authenticated byte can only be fetched after JS boots, reads `localStorage`, and issues
`/api/auth/me`. Server-rendering an authenticated route is not merely unhelpful here — it is not
possible without changing how sessions are stored.

The migration to make it possible is `@supabase/ssr` with a cookie storage adapter, applied to the
browser client, `apps/server/src/auth.ts`'s `attachUser`, **and** the Realtime WebSocket, which
authenticates with the same token (`apps/web/src/lib/useLiveCampaign.ts`).

### A2 — The security consequence, which is the argument that actually ends this

The cookie migration is not just "a large refactor." Today every mutating route is protected against
cross-site request forgery **structurally**: an attacker's page cannot make the browser attach an
`Authorization: Bearer` header it has to read out of this origin's `localStorage`. That is why this
codebase has no CSRF token anywhere, and why that absence is currently *correct*.

Move the session into cookies and the browser starts attaching credentials automatically to
same-origin requests. `PUT /api/campaigns/:id/sheets/:characterId`, `POST /.../combat/start`,
`POST /.../bonds/:bondId/accept` all become forgeable from any page a signed-in user visits, unless
CSRF defenses are added in the same change.

That is a **new security surface**, introduced by a solo maintainer, in a repo with no branch
protection on `main` (`HANDOFF.md` open issue 7) and no way to do live QA from its development
sandbox. The cost is not the refactor. The cost is that the refactor is unverifiable and the failure
mode is silent.

### A3 — RSC's update model inverts against this app's core loop

This is the strongest argument and it holds independently of auth.

RSC streams *rendered output* from the server. When data changes, the client requests a fresh flight
payload for the affected subtree.

This app's hot path is the opposite. A player marks a Condition; `useOptimisticCommit`
(`apps/web/src/lib/mutations.ts`) writes it into the TanStack Query cache synchronously, before any
network call, so the UI responds instantly. The write goes out; Supabase Realtime pushes the change
to every other client over an already-open WebSocket; each one calls `invalidateQueries` and refetches
JSON.

Under RSC, each of those steps becomes a server round trip returning re-rendered markup. The app
already has a persistent duplex channel to every participant and a local cache it can mutate
optimistically. RSC would replace both with request/response. **Combat and live sheet editing would
get slower.** This is not "the benefits don't apply" — it is "the benefits invert."

### A4 — The genuinely RSC-shaped surface, and why it still loses

It would be dishonest to claim nothing here fits. The content library does. `getLibrary()` returns
Moves, Skills, Themes, Virtues, and the glossary — static authored content, identical for every user,
changed only by an admin, already cached at `staleTime: 60_000`. That is textbook Server Component
material and it is a meaningful share of the payload.

It still loses, on a product ground rather than a technical one. The library is consumed by
`GlossaryText` / `useGlossaryMatcher` / `useTapReveal` — interactive tap-to-reveal machinery that
would have to stay client-side regardless — and it is the one payload that lets this app keep working
on the bad wifi of a physical table once loaded. Moving it server-side trades a real offline-resilience
property for bytes that section C recovers by code splitting instead.

### A5 — The one real upside, named and declined

A signed-out visitor currently downloads the full ~212 kB gzip main bundle — React, supabase-js,
TanStack Query, zod, react-hook-form — before seeing a login form. Server-rendering the login page
would genuinely fix that, and pretending otherwise would make this audit advocacy rather than
analysis.

Declined anyway, for two reasons. It is achievable with **zero** RSC by splitting everything else out
of the entry chunk (C3, C9). And the audience is a small group of friends who sign in once and stay
signed in; the cold signed-out paint is the least-repeated path in the app.

### A6 — TanStack Start v1.0 does not ship RSC

Worth stating plainly because the question paired them: **TanStack Start reached 1.0 in March 2026
without React Server Components support.** The team has said integration is in progress. So "adopt
Start to get RSC" is incoherent as of this audit — they are two separate decisions.

Evaluated on its own merits, Start also loses, for a reason distinct from all of the above. Start's
core value is server functions plus a typed client/server boundary. **This app already has one.**
`packages/shared` holds zod schemas consumed by both ends — `characterCreationSchema` is explicitly
documented as the mechanism that stopped the client and server copies of that validation from
drifting (`README.md` judgment call 22). Start would duplicate that with a second mechanism.

It also collides directly with the authorization-in-Express decision documented at the top of
`supabase/migrations/0001_init.sql` and in `CLAUDE.md`. Adopting Start means either running Start
*and* Express on one free Render instance, or porting all ten route modules. Both are worse than
today.

### A7 — The RSC toolchain, separately

Should the above ever be revisited: RSC on Vite means `@vitejs/plugin-rsc`, which as of this audit is
at **0.5.28, explicitly experimental**, with a published GHSA advisory. That is the wrong risk profile
for an app with no automated web tests and no live QA path. Next.js would mean abandoning the
single-service Render deploy (`render.yaml`) and the Vite-harness verification path
(`responsive-smoke.mjs` / `screenshot.mjs`) that the last four releases lean on entirely.

### A8 — TanStack Router alone — the one candidate that got a real evaluation

Separating the router from Start is the strongest version of the question, so it got a genuine look:
type-safe routes and params, native TanStack Query integration, loader-based prefetching, automatic
route-level code splitting. Those are real. It still loses, on measurement:

- **The router surface is ~20 call sites across 10 files, with one route param in the entire app**
  (`:campaignId`). Type-safe params solve a problem this codebase does not have at a scale that
  justifies a migration.
- **Loader prefetching does not fix this app's waterfall.** The waterfall is `App.tsx` blocking the
  entire tree on `useMe()` *above* the router (`App.tsx:19-28`). Route loaders run below that gate and
  cannot unblock it. The actual fix is six lines of `prefetchQuery` (C4). Migrating a router to obtain
  a benefit the router cannot deliver is the worst trade in this document.
- **Automatic route splitting buys one `lazy()` line here** (C3).
- **It taxes the only verification path this sandbox has.** `apps/web/src/harness.tsx` mounts
  `<MemoryRouter>`, and both `responsive-smoke.mjs` and `screenshot.mjs` drive all QA through it. A
  router migration rewrites the test instrument and the code in the same change, with no live QA to
  arbitrate a disagreement between them.
- **It adds a codegen step** to a build that is currently three plain `tsc`/`vite build` invocations.

Every underlying want — prefetching, split routes — is reachable inside react-router with no
migration at all.

### A9 — What would change this verdict

Recorded so this reads as a decision with conditions, not a permanent refusal:

- The app grows a genuinely public surface (shared read-only character sheets, a public campaign
  log, anything indexable).
- Supabase's cookie-based SSR auth becomes the default path *and* CSRF protection comes with it
  rather than being left to the integrator.
- TanStack Start ships RSC and a story for running alongside an existing Express API.
- `@vitejs/plugin-rsc` reaches 1.0 and this repo has web test coverage worth trusting a migration to.

---

## B — What the current stack actually costs

Findings, ordered by how much they matter. Each will get a **Fixed** line appended as it is addressed,
following `ResponsiveAudit.md`'s convention.

### B1 — Cold load is two serial round trips and ~212 kB gzip

`App.tsx:19-28` blocks the entire tree on `useMe()`. Only once that resolves does any page mount and
fire `useBootstrap` + `useLibrary` in parallel. So every cold load is: `/api/auth/me`, *then*
`/api/campaigns/:id/bootstrap` + `/api/library`.

`['library']` is user-independent — it does not need `/me` to resolve, and it is the larger of the two
second-round payloads. Fixed by C4.

Bundle: 726.69 kB raw / 211.64 kB gzip, measured at PR #87 (`README.md:400-404`; also recorded in
`HANDOFF.md`'s open-issue list — cited without a line number there deliberately, since that file's
numbering shifts every session).

**Fixed by C4/D4** (`0.27.0`): `main.tsx` now fires `['library']`'s prefetch alongside `useMe()`
rather than after it. Combined with C3/D3's lazy-load (below), first-load JS gzip measured
209.45 kB right after C3 landed — see B6's own "Fixed" note for the rest of the number's story
(React Compiler's C12 later raised it again, deliberately).

### B2 — `/bootstrap` does 8–10 round trips, one of them an N+1

`apps/server/src/repo.ts:384-388`:

```
export async function listSheetsForCampaign(campaignId: string): Promise<CharacterSheet[]> {
  const chars = await listCharacters(campaignId);
  const sheets = await Promise.all(chars.map((c) => getSheet(c.Id)));
  ...
```

Two problems. It re-fetches characters that `routes/campaign.ts:78` already loaded twenty lines
earlier — the "redundant re-derivation" pattern the project's own `perf-budget` skill names. And it
issues one query per character. `Promise.all` makes those concurrent, not fewer.

This runs on every GM bootstrap and every bootstrap during an active Encounter
(`routes/campaign.ts:123-124`) — and bootstrap is invalidated by every optimistic commit's
`onSettled` *and* by all four Realtime listeners in `useLiveCampaign.ts`. It is the most frequently
re-run query path in the application.

**Fixed (`0.27.0`)**: `listSheetsForCampaign` is one query scoped by `campaign_id` (a column every
row has carried since migration `0005`), no longer re-fetching characters or querying per-row.
`getSheet`'s self-heal write-back for a pre-`0.13.0`/pre-`0.18.0` sheet — the trap this finding's
own D2 spec called out — is preserved via a shared `normalizeAndCheckHeal` helper, not dropped.

### B3 — Every user row in the database, on every campaign load

`apps/server/src/repo.ts:92-96`:

```
export async function listUsers(): Promise<PublicUser[]> {
  const { data, error } = await supabaseAdmin.from('profiles').select('id, name');
```

No filter. `routes/campaign.ts:93` calls it inside `/bootstrap`. Every player opening any campaign
receives the id and display name of every registered user of the application. The rows are small, so
this is not urgent today — but it grows unbounded with signups and it is a low-grade information
disclosure, not merely a performance issue.

Two more N+1s of the same family: `routes/admin.ts:28-34` calls `listMemberships` per campaign when
the bulk form `listMembershipsForCampaigns` **already exists and is unused**; `routes/invites.ts:32-37`
calls `getCampaign` per pending invite.

**Fixed (`0.27.0`)**: `/bootstrap` now calls a new `listUsersByIds(members.map(m => m.UserId))`
instead of the unscoped `listUsers()` — verified first (not assumed) that the client only ever
resolves a user id from `members` for the GM's own name; Bond/Rapport History `.By` fields resolve
against `characters`, not `users`, so no wider id set was needed. `admin.ts`'s `/campaigns` now
uses the existing bulk `listMembershipsForCampaigns`. `invites.ts`'s `/mine` batches its per-invite
lookup into one new `listCampaignsByIds` call. `listUsers()`/`getCampaign()` themselves are
untouched — `/me` and `/admin` still legitimately want the unscoped forms.

### B4 — Every encounter's full JSONB, to find one

`apps/server/src/repo.ts:499-502`:

```
export async function getActiveEncounter(campaignId: string): Promise<Encounter | null> {
  const encounters = await listEncountersForCampaign(campaignId);
  return encounters.find((e) => e.Status === 'Active') ?? null;
}
```

`listEncountersForCampaign` selects `data` for every row matching the campaign — every *ended*
encounter too, each carrying its complete `History` array — and the filter happens in JS. A campaign
accumulates encounters forever, so this grows without bound over a campaign's life.

Confirmed against `supabase/migrations/0010_combat_encounters.sql`: the table has `id`, `campaign_id`,
`data`, `updated_at` and **no top-level `status` column**, so the fix is either a JSONB filter or a
migration (C6).

**Fixed (`0.27.0`), via a JSONB filter, no migration**: `getActiveEncounter` now filters on
`data->>Status` in Postgres rather than loading every encounter and filtering in JS. No index
added — proportionate to this app's actual per-campaign Encounter count (the `perf-budget`
skill's own "reasoning, not a hard threshold" framing), revisit if that changes. `.limit(1)`
rather than `.maybeSingle()` deliberately, to keep the old `.find()`'s tolerance of more than one
`Active` row — nothing enforces that uniqueness at the DB level, only the `/start` route's own
application-level check.

### B5 — Two network round trips per authenticated API request

`apps/server/src/auth.ts`'s `loadUser` calls `verifyAccessToken` (a single seam at
`apps/server/src/supabase.ts:24`, wrapping `supabaseAdmin.auth.getUser(token)` — a network call to
Supabase Auth) and then selects `profiles` for `name`/`is_admin`. Both happen before any route handler
runs, on every authenticated request.

**Correcting a claim that looked worse than it is:** `attachUser` is mounted globally at
`index.ts:38`, ahead of `express.static` at `:56`, which reads like it taxes every static asset
request too. It does not. `bearerToken()` returns `null` when there is no `Authorization` header,
browsers do not send that header on `<script src>` / `<link href>` loads, and `attachUser` calls
`next()` immediately. The cost is real but confined to API requests.

**Not fixed this pass (D5) — deliberately, a repo-owner decision, not an oversight.** Two
independent reasons, either alone sufficient: this sandbox still can't confirm whether the
Supabase project uses asymmetric JWT signing keys (the live dashboard host is on the same
blocklist as ever — see "Sandbox network constraints" below in this same document); and local
verification trades away `auth.getUser()`'s live "user still exists and is not banned" check for
latency — a security-relevant trade-off the repo owner chose to leave unmade rather than have a
session decide it alone. See `HANDOFF.md`'s open issues for this session for the full record.

### B6 — 8,729 lines of `apps/web` with zero unit coverage

`npm test` runs `@asohav/shared` and `@asohav/server` only. `apps/web` has no vitest suite at all —
93 TypeScript files, 8,729 lines, covered solely by the Playwright responsive smoke test, which
asserts layout properties and nothing about behavior. `HANDOFF.md` records this as a known structural
gap.

This is not only a quality finding. It is the gate on C10 (React Compiler), which cannot be adopted
responsibly without something that would catch a behavior change.

**Fixed, first slice (`0.27.0`, D9/G12)** — the structural gap, not the full 8,729 lines: a real
`apps/web` vitest suite now exists (`apps/web/vitest.config.ts`, 35 tests) covering `lib/api.ts`'s
`request()` error mapping, `lib/useGlossaryMatcher.ts`'s two-WeakMap cache split, `lib/appearances.ts`,
and `store/appearanceStore.ts`/`panelCollapseStore.ts`'s persistence logic — pure logic only, no
jsdom/component tests yet (still real future scope, per D9's own second-pass framing). This is
what actually gated C12/G13 (React Compiler): landed green immediately before it, per the audit's
own dependency ordering.

### B7 — No linter, no bundle ceiling, no cache headers

- **No ESLint, no Prettier, nothing.** Consequently nothing has ever verified Rules-of-React
  compliance — which matters for C10.
  **Fixed (`0.27.0`, D8/G11)**: `eslint.config.js`, typescript-eslint `recommended` +
  eslint-plugin-react-hooks (still no Prettier, on purpose). Still Prettier-free, as this line
  itself already called for.
- **No bundle budget.** The project's stated philosophy is to make regressions fail CI rather than be
  noticed visually (touch targets, horizontal overflow). Bundle size is exempt from that today, which
  is how a 104 kB regression shipped and was recorded in a doc instead of blocked.
  **Fixed (`0.27.0`, D1/G3/G5)**: `scripts/bundle-budget.mjs`, enforcing in CI's `build` job.
- **`express.static(webDist)` is called with no options at all** (`index.ts:56`) — no `maxAge`, no
  `immutable`, despite Vite emitting content-hashed filenames. No `compression` middleware either.
  **Cache headers fixed (`0.27.0`, D6/G9)**; **compression middleware deliberately not added** —
  can't verify from this sandbox whether Render's edge already compresses (would need a live
  `curl -sI -H 'Accept-Encoding: gzip'` against the deployed URL), and D6 itself warns adding it
  blind risks wasted CPU on a free instance if Render already does. See `HANDOFF.md`.
- **No lockfile-sync check.** `HANDOFF.md` records the four-package version bump missing
  `package-lock.json` as a recurring failure nothing in CI catches.
  **Fixed (`0.27.0`, D12/G2)**: `scripts/check-versions.mjs`, first step of CI's `build` job.

### B8 — Declared dependency ranges run ~a year behind what is installed

`typescript ^5.6.3` resolves to 5.9.3; `@supabase/supabase-js ^2.46.1` resolves to 2.111.0. Harmless
at runtime, but it makes every `package.json` misleading to read.

**Fixed (`0.27.0`, C14/G2)**: every declared range refreshed to its actually-installed floor
across all four `package.json` files. Also surfaced a pattern worth naming for future sessions,
not just this one finding: `react-router` and `vite` had each already moved a full major version
beyond what this same audit assumed as its target (see G14/G15's commits) — this stack moves fast
enough that even a same-day "current" ecosystem fact can read as stale by the time it's acted on.

---

## C — Recommendations, ranked

Ranked by value ÷ (risk × effort).

| # | Candidate | Value | Risk × effort | Verdict |
|---|---|---|---|---|
| **C1** | Bundle measurement (`build.manifest` + visualizer + report-only budget) | Turns every byte claim in this doc from guess to number | Trivial, additive, no runtime effect | **Do first.** Everything below that mentions bytes depends on it |
| **C2** | Bootstrap N+1 + `listUsers()` scoping + admin/invites batching | Removes N round trips from the most-invalidated route; stops shipping every user to every client | ~30 lines, server-only, existing vitest covers the routes | **Do.** Highest perf-per-line in the audit |
| **C3** | Lazy-load `CreateCharacterPage` | ~32 kB gzip off every player's cold load | One line; already inside `App.tsx`'s `<Suspense>` | **Do, right after C1** so it can be proven |
| **C4** | Prefetch `['library']` alongside `useMe()` | Removes one full serial round trip from every cold load | ~6 lines, no new dependency | **Do.** Best value/effort in the document |
| **C5** | Local JWT verification | Halves per-request auth latency; one call site | One function; unit-testable offline | **Do.** Cheaper than it looks — single seam |
| **C6** | `getActiveEncounter` JSONB filter | Stops transferring every ended encounter's `History` | Small; may want a migration + index | **Do** |
| **C7** | Version-sync CI check | Closes a named, recurring open issue | Pure-`node:fs` script, no dependencies | **Do.** The only item fully verifiable in-sandbox today |
| **C8** | Static cache headers (+ compression, conditionally) | Real repeat-visit win; prerequisite for C9 | Small, but has a stranding foot-gun — see D6 | **Do carefully.** Verify Render's edge first |
| **C9** | `manualChunks` | **Zero first-load bytes saved.** Cross-deploy cache reuse only | Small; real circular-init hazard if grouped wrong | **Only after C8.** Inert without cache headers |
| **C10** | ESLint flat config + `eslint-plugin-react-hooks@6` | Finds real Rules-of-React violations; **gates C12** | New CI job; expect a first-run backlog | **Do.** Explicitly *not* Prettier |
| **C11** | `apps/web` vitest suite, scoped | Largest structural gap in the repo | Highest effort here; must be scoped to stay finite | **Do, scoped.** Unblocks C12 |
| **C12** | React Compiler 1.0 | Auto-memoizes a tree that re-renders wholesale on every Realtime event | Zero-config on plugin-react v4 — but no tests and no lint to catch a behavior change | **Do — only after C10 and C11** |
| **C13** | `react-router-dom` 6 → `react-router` 7 | Future-proofing; deletes the `future` prop | ~20 mechanical import rewrites; both flags already on | **Do.** Fully verifiable in-sandbox |
| **C14** | Dependency range refresh | Stops `package.json` misleading readers | Mechanical | **Do, low priority.** Bundle with C7 |
| **C15** | Vite 6 → 7 | Incremental; keeps the Rolldown path open | Small | **Do, low priority** |
| **C16** | Vite 8 / Rolldown | 2–5× build speed | `css.modules.generateScopedName` runs through a different (Rust) implementation — every class name could change | **Defer until after C11** |
| — | Express 4 → 5 | ~Zero user-facing value | Makes `asyncHandler.ts`'s `wrap()` redundant across every route; `path-to-regexp` v8 risk on the SPA fallback regex | **Cut.** 4.22 is maintained |
| — | TanStack Router / Start / RSC | See section A | Harness rewrite / two servers / new CSRF surface | **Cut** |
| — | Prettier | Consistency the repo already has by hand | Repo-wide diff that would bury every real change for a release | **Cut** |
| — | zustand `persist` middleware | Would replace hand-rolled localStorage in 6 stores | `appearanceStore`'s read/write path is *deliberately* isolated for a future DB swap (`WorkPlan-0.26.0.md` decision 2) — `persist` fights that | **Cut,** for that reason |
| — | Tailwind | — | 65 CSS Modules + `@layer` + tokens + container queries is deliberate architecture behind `README.md` items 24, 25, 27 | **Cut.** Declined explicitly so it stops coming up |

---

## D — Change specs

### D1 — Bundle measurement (first, before anything that claims bytes)

`apps/web/vite.config.ts` has **no `build` block at all** today. Add one with `manifest: true`, plus
`rollup-plugin-visualizer` in `plugins` gated behind an env var so ordinary builds emit no stats file.

New `apps/web/scripts/bundle-budget.mjs`, hand-rolled to match `responsive-smoke.mjs`'s existing shape
(plain node script under `scripts/`, `node:` builtins only, non-zero exit, driven by an npm script):
read `dist/.vite/manifest.json`, find the `isEntry: true` record, transitively sum that chunk plus its
`imports[]` — **excluding `dynamicImports[]`**, since that is precisely "bytes before first paint" —
gzip each with `node:zlib`, print the total.

Wire it as one step appended to CI's existing **`build`** job rather than a new job; that job already
pays for `npm ci` + `npm run build`.

**Ship it report-only (always exit 0) in the first PR.** No number can be measured from the audit
sandbox. Read the ceiling off the first green CI run, add ~5% headroom, then flip to enforcing in a
follow-up with the number and its provenance in a comment.

Check while implementing: `dist/.vite/` is dot-prefixed and `express.static` ignores dotfiles by
default, so `manifest: true` should not expose anything — confirm rather than assume.

### D2 — Bootstrap N+1, `listUsers` scoping, admin/invites batching

**`repo.ts:384`** — `character_sheets` already carries `campaign_id` (`saveSheet` upserts it;
`listSheetTimestampsForCampaigns` at `:395-400` already selects on it, and is the precedent to copy).
So: `select('data, campaign_id').eq('campaign_id', campaignId)` — one query.

**The trap to avoid:** `getSheet` (`repo.ts:355-374`) does not merely read. It runs `normalizeSheet`
and **writes back** a self-healed sheet for pre-`0.13.0`/pre-`0.18.0` rows. That is a live migration
path (`CLAUDE.md` documents why it exists), and the naive one-query rewrite silently deletes it. The
batched version must normalize each row in-process and write back only the rows whose normalized form
differs. Steady state then becomes 1 round trip and 0 writes, against today's 1 + N.

**`routes/campaign.ts:124`** — once the sheet query is scoped by campaign, drop
`listSheetsForCampaign`'s internal `listCharacters` call, or pass in the `characters` already resolved
at `:78`.

**`routes/campaign.ts:93`** — replace `listUsers()` with a new `listUsersByIds(ids)` doing
`.in('id', ids)`. `members` is already resolved from the *first* `Promise.all` before the second one
runs, so the ids are free.

Do **not** change `listUsers` itself: `routes/auth.ts` (`/me`) needs users across all the caller's
campaigns, and `routes/admin.ts` legitimately wants everyone. Scope per call site.

**Verify before narrowing:** confirm the client's consumers of `bootstrap.users` only ever resolve
names for current members. Bond `History` entries may reference a user who has since left, and a
too-tight scope would render those as blanks. If so, the id set is members ∪ users referenced in
bonds, not members alone.

**`routes/admin.ts:28-34`** — swap in the already-existing, currently-unused
`listMembershipsForCampaigns`. **`routes/invites.ts:32-37`** — batch the per-invite `getCampaign`.

### D3 — Lazy-load `CreateCharacterPage`, and the barrel question

**`apps/web/src/App.tsx:8`** — change the eager import to `lazy(() => import('./pages/CreateCharacterPage.js'))`,
matching lines 15-16. It already renders inside the existing `<Suspense>` boundary at line 40, so no
other change is needed.

**The import graph confirms most of this works.** `apps/web/src/components/form/*` is imported by
exactly three files: `CombatMoveModal.tsx` and `AddParticipantModal.tsx` (both already inside the lazy
`/combat` chunk) and `CreateCharacterPage.tsx`. Nothing eagerly-loaded touches them. So
`react-hook-form`, `@hookform/resolvers`, and the form primitives evict cleanly.

**`zod` is the uncertain half, and it is worth understanding why.** `packages/shared/src/index.ts` is a
flat barrel that does `export * from './characterCreationSchema.js'`, and that module is the only
`zod` importer in the workspace. All 54 web files that import from `@asohav/shared` pull that barrel
into the eager graph. Two things work in favor of tree-shaking anyway: `characterCreationSchema.ts`'s
only top-level statements are imports and a **function declaration** — every `z.*` call is inside the
factory, so there is nothing to evaluate at module scope — and Rollup shakes pure ESM barrels well.

So this is probably fine. But `packages/shared/package.json` declares no `"sideEffects": false`, and
its `exports` map exposes only `"."`, so there is no deep path a consumer could use to bypass the
barrel if it turns out not to be fine. `seedLibrary.js` and `seedPlay.js` are re-exported from the
same barrel and are only genuinely needed by `harness.tsx` and the tests — the same exposure, never
previously flagged.

**Treat this as a hypothesis to measure, not a fact.** That is the whole reason D1 comes first. If the
measured drop is ~32 kB gzip, nothing more is needed. If it is materially less, add
`"sideEffects": false` to `packages/shared/package.json` (after confirming the package genuinely has
no module-level side effects) and consider subpath exports.

### D4 — Kill the cold-load waterfall

**`apps/web/src/main.tsx`** — fire the library prefetch alongside `useMe()` rather than after it:

```
queryClient.prefetchQuery({ queryKey: ['library'], queryFn: ..., staleTime: 60_000 });
```

The library is user-independent, so it does not need `/me` to resolve. `apps/web/src/lib/useLibrary.ts`
already uses the matching key and `staleTime`, so the in-flight query dedupes automatically and no
component changes.

Optional second step: prefetch `['bootstrap', campaignId]` on hover/focus of a `CampaignTile` link
(`apps/web/src/features/campaign/CampaignTile.tsx`). That is the "router loader prefetching" benefit
from A8, obtained without the router.

### D5 — Local JWT verification

**`apps/server/src/supabase.ts:24`** is the only call site — `loadUser` already goes through the
`verifyAccessToken(token) → { id, email } | null` seam. Replace the `supabaseAdmin.auth.getUser(token)`
body with JWKS verification: fetch `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` once, cache it,
verify with `jose`. Prefer this over the legacy `SUPABASE_JWT_SECRET` HS256 path — Supabase is
deprecating symmetric keys, and it would mean the server holding a shared secret.

Two things to record honestly rather than leave implicit:

- **This halves round trips, it does not eliminate them.** `loadUser` still selects `profiles` for
  `name`/`is_admin`. Reaching zero needs those claims in the JWT via a custom access token hook — a
  larger change; mention as a follow-on, do not bundle it.
- **`auth.getUser()` also confirms the user still exists and is not banned; local verification does
  not.** A deleted user's unexpired token stays valid until it expires (1h default). Acceptable for
  this app, but it belongs in `README.md`'s judgment-call list, not in a comment.

Requires the Supabase project to be on asymmetric signing keys — **cannot be confirmed from the audit
sandbox.**

### D6 — Cache headers and compression

**`apps/server/src/index.ts:56`.** The obvious `express.static(webDist, { maxAge: '1y', immutable: true })`
is a **stranding foot-gun**: `index.html` sits in the same directory as the hashed assets, and an
immutable-cached `index.html` pins users to asset hashes that stop existing after the next deploy. The
app is currently safe *by accident* — no headers means browsers revalidate.

Correct shape: `index: false` plus a `setHeaders` callback sending `no-cache` for `.html` and
`public, max-age=31536000, immutable` for everything else. The SPA fallback's `res.sendFile(index.html)`
needs its own explicit `Cache-Control: no-cache`, or the same bug returns through the other door.

**Compression: verify before adding.** Render's edge may already gzip/brotli, in which case
`compression` middleware is wasted CPU on a free instance. Check with
`curl -sI -H 'Accept-Encoding: gzip' https://<app>/assets/<hash>.js` against the live deploy — **not
possible from the audit sandbox.**

### D7 — `manualChunks`

Inside the `build` block added in D1:

```
rollupOptions: { output: { manualChunks: {
  react: ['react', 'react-dom', 'react-router-dom'],
  supabase: ['@supabase/supabase-js'],
  query: ['@tanstack/react-query'],
}}}
```

Three deliberate omissions, each of which matters:

- **React, react-dom and react-router-dom stay together.** They co-initialize; splitting them across
  chunks risks a "cannot access before initialization" error at runtime for zero benefit.
- **Do not name `zod` / `react-hook-form` / `@hookform/resolvers`.** Naming them hoists them into
  eagerly-referenced chunks and **undoes D3 entirely.** This is the easiest way to get this wrong.
- **Do not name `@asohav/shared`.** It is a workspace source dependency — pinning it into a vendor
  chunk makes the vendor hash change on every game-content edit, destroying the cache stability that
  is this change's only payoff.

State plainly when this lands: **it saves zero first-load bytes.** All three chunks are needed for
first paint. Its entire value is keeping hashes stable across deploys, which is worth nothing without
D6.

### D8 — ESLint (before React Compiler)

New `eslint.config.js` at repo root. Root dev deps: `eslint`, `typescript-eslint`,
`eslint-plugin-react-hooks@^6`. Use `reactHooks.configs['recommended-latest']` — **v6 folded the React
Compiler's rule set in**, so there is no separate `eslint-plugin-react-compiler` to install.

Scope discipline, matching this repo's culture: `typescript-eslint` recommended plus react-hooks only.
**No stylistic ruleset, no Prettier.** The goal is finding the Rules-of-React violations that would
make the compiler silently bail, not reformatting 93 files.

CI gets a 4th `lint` job mirroring `test`'s shape. It needs `npm run build -w @asohav/shared` first if
any rule is type-aware — same reason the `responsive` job needs it.

Expect a findings backlog on the first run. Land the config with whatever `--max-warnings` threshold
makes CI green on day one, then ratchet down. Do not fix forty lint findings in the PR that introduces
the linter.

### D9 — `apps/web` vitest suite, scoped

Do **not** open with component tests — that needs jsdom plus `@testing-library/react` plus a new
harness, and it will stall. Open with pure logic that already exists:

- `lib/api.ts` — `request<T>()`'s error mapping (timeout → `ApiError(0, …)`, non-ok → `body.error`,
  204 → `undefined`) against a stubbed `fetch`. Genuinely untested and genuinely user-facing.
- `lib/useGlossaryMatcher.ts` — real matching logic with real edge cases, including the two-`WeakMap`
  split that `0.24.1` added to fix a live bug.
- `store/*.ts` — zustand stores are plain functions, testable with no DOM. This closes the
  `appearanceStore` gap `HANDOFF.md` flags.
- `lib/appearances.ts`.

Second pass adds `jsdom` + `@testing-library/react` for `useTapReveal` / `useModalA11y` /
`useMediaQuery`. Root `package.json`'s `test` script extends to include `-w @asohav/web`.

**This is the one major recommendation fully verifiable in-sandbox** once `node_modules` exists.

### D10 — React Compiler

On plugin-react v4 (Babel-based, which this project has):

```
react({ babel: { plugins: [['babel-plugin-react-compiler', {}]] } })
```

Dev dep `babel-plugin-react-compiler@^1`. No `target` option — it defaults to React 19.

**The argument for this is the opposite of the usual one, and worth stating correctly.** The standard
pitch is "delete your manual memoization." That is nearly a no-op here: `apps/web` contains 8
`useMemo`, 2 `useCallback`, and **zero** `memo()` across 93 files. The real case is that the compiler
would *introduce* memoization this codebase has never had — on an app where every Realtime event
invalidates `['bootstrap', campaignId]` and re-renders the whole campaign tree from the root. That is
a genuine win on the hottest path.

It is also **higher** risk than it first appears, which is why it sits behind C10 and C11. With no web
tests and no lint, nothing has ever verified Rules-of-React compliance, and the compiler silently
bails on components it cannot prove safe. It could ship and do nothing, and there would be no signal
either way. `npx react-compiler-healthcheck` reports the actual compile rate — **not runnable from the
audit sandbox.**

Record the forward coupling: plugin-react v6 (Vite 8) dropped Babel for oxc, so this config becomes
`@rolldown/plugin-babel` after C16.

### D11 — react-router 7

~20 mechanical rewrites of `from 'react-router-dom'` → `from 'react-router'` across 10 files,
including `harness.tsx`'s `MemoryRouter`. Drop the `future={{...}}` prop from `main.tsx:25` — both
flags are default in v7, which may warn on unrecognized ones.

Low risk precisely because this is a non-data router: the data-router-only future flags
(`v7_fetcherPersist`, `v7_normalizeFormMethod`, `v7_partialHydration`) never applied. Fully verifiable
in-sandbox via `npm run typecheck` plus the full responsive smoke matrix.

### D12 — Version-sync check

New `scripts/check-versions.mjs` comparing the four `package.json` versions to each other and to
`package-lock.json`'s recorded workspace versions. Pure `node:fs`, no dependencies, no `node_modules`
required. Wire it as the first step of CI's `build` job so it fails in seconds rather than after a
full install.

**The only recommendation in this audit that can be both written and fully verified from the audit
sandbox today.**

---

## E — Deliberately not doing

Recorded so these stop coming up. Reasons are in section C's table.

RSC · TanStack Start · TanStack Router · Next.js · Express 5 · Prettier · Tailwind · zustand
`persist` middleware.

---

## F — What could not be verified from this sandbox

**Most of this table turned out to be about *this specific session's* sandbox, not this app's
sandboxes in general** — the `0.27.0` implementation session had working `npm install`/registry
access (this document's own session did not: "`node_modules` was not installed in the session
that produced it," above), so every row whose blocker was "no `node_modules`, no build" was
actually measured directly rather than estimated. Struck through below with the real number;
the genuinely environment-gated rows (Supabase dashboard, live HTTP to the Render deploy, real
browser QA) remain exactly as blocked as this document originally found them.

| Claim | Blocked by | Resolution |
|---|---|---|
| ~~D3's ~32 kB gzip win; whether `zod` tree-shakes through the shared barrel~~ | ~~No `node_modules`, no build~~ | **Measured, `0.27.0`**: 33.45 kB gzip (209.45 → 176.00 kB) — `zod` tree-shook cleanly, no `sideEffects:false` workaround needed |
| ~~Any absolute bundle number, hence D1's budget ceiling~~ | ~~Same~~ | **Measured, `0.27.0`**: real numbers throughout G's commits; see B1–B8's Fixed lines |
| ~~React Compiler's compile rate and re-render win~~ | ~~Same, plus no live QA~~ | **Compile rate measured, `0.27.0`**: `react-compiler-healthcheck` reports 88/88 components. Re-render win still not measured — that half genuinely needs a live Profiler session, not just `node_modules` |
| `/bootstrap` round-trip counts *in latency terms* | No DB access | Still open — the *reduction* is provable by reading the code (done, `0.27.0`); the latency is not |
| Whether the Supabase project uses asymmetric JWT signing keys | No dashboard access | Still open. Supabase dashboard → Auth → JWT Keys. **Blocks D5**, deliberately left unimplemented — see B5 |
| Whether Render's edge already compresses | No live HTTP to the deploy | Still open. `curl -sI -H 'Accept-Encoding: gzip'` against the live URL. **Blocks the compression half of D6** — cache headers landed without it, see B7 |
| That cache headers do not strand users on a stale `index.html` | No live QA | Still open — verified locally instead (an isolated Express instance + real HTTP requests against a fake `dist/`, not the real deploy); see G9's commit |
| ~~ESLint's finding count~~ | ~~No `node_modules`~~ | **Measured, `0.27.0`**: 123 problems on the first real run, 61 warnings/0 errors after config fixes and the deliberate backlog downgrade — see G11's commit |

D9 (web unit tests), D11 (router 7) and D12 (version check) **are** verifiable here — typecheck, unit
tests, and the Playwright harness all run offline against seed fixtures. All three landed in
`0.27.0`, plus C16's own deferred Vite 8 row: not attempted, staying deferred exactly as this
document called it — see G15's commit for why (Vite had already reached 8.2.1 by the time this
was implemented, and it was deliberately not adopted, matching the same react-router-8 call).

---

## G — Order of work

```
- [x] 1.  This document
- [x] 2.  Version-sync check + dependency range refresh      (offline-verifiable; warm-up)
- [x] 3.  Bundle measurement, report-only                    (MUST precede 4)
- [x] 4.  Lazy-load CreateCharacterPage + read the number
- [x] 5.  Flip the bundle budget to enforcing
- [x] 6.  Server: bootstrap N+1, listUsers scoping, getActiveEncounter, admin/invites batching
- [x] 7.  Client: library prefetch; optional tile-hover bootstrap prefetch
- [ ] 8.  Local JWT verification                             (blocked on: asymmetric keys confirmed)
- [x] 9.  Cache headers + compression                        (blocked on: Render edge check)
- [x] 10. manualChunks                                       (MUST follow 9)
- [x] 11. ESLint + react-hooks, landed green                 (MUST precede 13)
- [x] 12. apps/web vitest, first slice                       (MUST precede 13)
- [x] 13. React Compiler
- [x] 14. react-router-dom 6 → react-router 7
- [x] 15. Vite 6 → 7
- [x] 16. Docs + release
```

**Item 8 is the one deliberate exception, a repo-owner decision, not a missed step.** Still
blocked on confirming asymmetric JWT signing keys (this sandbox still can't reach the Supabase
dashboard), and the repo owner chose not to have a session make the underlying security trade-off
(trading `auth.getUser()`'s live user-exists/not-banned check for latency) unilaterally. Item 9
landed its cache-headers half only — the compression half is the same "blocked on: Render edge
check" this line already named, still genuinely unverifiable from this sandbox. See B5/B7 above
and `HANDOFF.md`'s open issues for this session for the full record of both.

Four hard dependencies, each worth stating inline rather than trusting to the numbering: **3 before 4**
(a split you cannot measure is a split you cannot prove), **9 before 10** (`manualChunks` is inert
without cache headers), and **11 and 12 before 13** (nothing else can catch a compiler-induced
behavior change in a repo with no web tests and no lint).

**Versioning.** None of this is `0.27.0` — `WorkPlan-0.26.0.md` already names the poster treatment on
card surfaces as that scope, and this document deliberately does not claim it. Most items here are
PATCH-shaped (perf, tooling, CI). React Compiler and the web test suite are MINOR-shaped ("a notable
internal architecture change," per the `CHANGELOG.md` policy). Suggest landing them as `0.26.x`
patches plus one MINOR.

**The durable artifact is not this document.** It is a new `decisions.md`
item recording that RSC and TanStack Start were evaluated and declined, with the reasons and the
reopen conditions from A9. Items 22, 24, 25 and 27 are all exactly that shape. That entry is what
stops this question being re-litigated in three versions; this audit is the working behind it.

---

## H — How this was measured

`ResponsiveAudit.md` opens by stating that every number in it was measured in a real
Chromium. This document cannot make that claim, and the convention only stays useful if that is said
plainly rather than glossed.

**Read directly from source, and reliable** — every file:line reference; the N+1 and redundant-fetch
patterns in B2/B3/B4; the absence of a `build` block, of cache headers, of ESLint, of a web test
suite; the localStorage-only auth chain in A1; the `combat_encounters` schema in B4; the memoization
counts in D10; the form-primitive import graph in D3; the single `verifyAccessToken` seam in B5/D5.

**Cited from prior measurement, not re-measured here** — the 726.69 kB raw / 211.64 kB gzip bundle
figure and the +104 kB regression (both measured at PR #87 and recorded in `README.md:400-404` and
in `HANDOFF.md`'s open-issue list); the 674 → 613 kB improvement from PR #70's route splitting
(`WorkPlan-0.23.0.md:96-97`).

**Ecosystem facts, verified against current sources in August 2026, not from training data** —
TanStack Start's 1.0 date and its lack of RSC support; `@vitejs/plugin-rsc` at 0.5.28 experimental;
React Compiler 1.0's October 2025 release and its plugin-react v4-vs-v6 Babel situation; Vite 8's
March 2026 Rolldown release; React Router v7's migration shape.

**Estimated, and flagged as such wherever it appears** — D3's ~32 kB gzip expected saving; every
statement about how much faster anything would be. Nothing in this audit was benchmarked.

**Not verified at all** — everything in section F.
