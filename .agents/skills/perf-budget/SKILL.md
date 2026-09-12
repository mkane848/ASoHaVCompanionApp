---
name: perf-budget
description: >
  Flags latency-risky patterns specific to the ASoHaVCompanionApp stack — Express route
  handlers in apps/server/src/routes/*.ts, apps/server/src/repo.ts data-access calls,
  TanStack Query cache/refetch behavior, and Supabase Realtime subscription costs in
  useLiveCampaign — so a solo maintainer with no load-testing setup catches
  slow-request-input-to-confirmation regressions before they ship. Use when adding or
  editing a route handler, a repo.ts function, a useQuery/useMutation hook, or a
  useLiveCampaign subscription — or when asked "why is this slow," "latency," "N+1," or
  "will this scale."
---

# perf-budget

## No hard numbers — this is reasoning, not a lint rule

There's no profiling data or load-testing setup behind this project (a single-Render-
instance, pre-1.0, low-traffic app — see `docs/operations.md`'s Deployment section), so a threshold
like "flag any route with 3+ sequential awaits" would be an arbitrary number dressed up as
a rule. Use the patterns below as things to reason about and flag with a stated reason,
not a checklist to mechanically pass/fail. If a route does five sequential Supabase calls
but each one genuinely depends on the last (e.g. loading a campaign to check membership
before touching a Bond), that's correct, not a violation — the *pattern* to catch is doing
work sequentially or repeatedly that has no real data dependency forcing it.

**Out of scope: `withBondLock`'s raw-`pg` transaction.** CLAUDE.md is explicit this code
path has never been runtime-verified against live Postgres in this project's sandboxes.
Its real risk is concurrency correctness (a locking bug), not latency — reasoning about
its performance without ever having run it against a live database risks manufacturing
false confidence on the wrong axis. Leave it to whatever actually exercises Bond
concurrency, not this skill.

## Server-side: apps/server/src/routes/*.ts and repo.ts

- **N+1 in a loop.** Look for a `repo.ts` call (or any Supabase query) invoked inside a
  `for`/`.map`/`.forEach` over a list that was itself just fetched — that's a per-row round
  trip that should usually be one batched query instead. The codebase already has the
  right pattern to point to when this comes up: `admin.ts`'s campaign-rows and
  character-rows handlers batch their per-item enrichment with `Promise.all`
  (`apps/server/src/routes/admin.ts`) rather than awaiting one at a time in a loop; `invites.ts`
  does the same for its `withCampaign` list. A new route doing the sequential-`await`-in-a-
  loop version of the same shape is worth flagging even though it'll "work."
- **Sequential awaits with no real dependency.** If a handler does `await a(); await b();`
  and `b` doesn't use anything `a` returned, that's a candidate for `Promise.all([a(), b()])`.
  Don't reflexively parallelize everything, though — most of this app's routes have a real
  chain (load campaign → check membership → mutate), and forcing that into `Promise.all`
  would be wrong, not just unnecessary.
- **Redundant re-derivation in the authorization pattern.** Every mutating route follows
  the same shape: load the resource, check `req.user`/`membershipFor()`/
  `assertCampaignActive()`, then write (see `CLAUDE.md`'s authorization-in-Express-layer
  section). Watch for a route that re-fetches something it already loaded a few lines
  earlier just to check a field on it again — that's an easy one to introduce when adding
  a new guard to an existing handler without noticing the data's already in scope.

## Client-side: TanStack Query and Realtime

- **Unstable query keys.** A `useQuery` key that includes a fresh object/array literal
  computed inline (instead of primitive IDs or a memoized value) defeats caching entirely —
  every render looks like a new query. Check that a new hook's key is built the same way
  existing ones in `apps/web/src/lib/` are (stable primitives: `['bootstrap', campaignId]`,
  `['library']`, etc.).
- **staleTime/gcTime not considered.** Not every query needs a custom value — the default is
  often fine — but a query that's known to change rarely (e.g. `library`, which only changes
  via Content Admin writes and is already Realtime-invalidated) refetching on every mount
  with no `staleTime` is worth a second look, since a shorter effective cache than the data's
  actual change frequency just adds needless round trips.
- **Over-broad Realtime invalidation.** `useLiveCampaign.ts` invalidates
  `['bootstrap', campaignId]` for `party`/`bonds`/`character_sheets`/`combat_encounters`
  changes — a single broad key today, not per-resource keys, which is a real existing
  tradeoff (simpler, but every Realtime event refetches the whole bootstrap payload). If
  you're adding a new Realtime-synced table, follow that existing pattern rather than
  inventing a narrower one solo — but if the bootstrap payload is growing large enough that
  this tradeoff itself is now the bottleneck, that's worth flagging as a real conversation,
  not silently working around it in one new hook.
- **Patching cache instead of invalidating.** Per `docs/architecture/frontend.md`: "treat Realtime as a signal to
  refetch, not a data source." Flag any new code that tries to hand-construct the post-
  change state and write it directly into the TanStack Query cache from a Realtime payload
  instead of calling `invalidateQueries` — this app has deliberately avoided that pattern
  everywhere so far, and one hook doing it differently is a maintenance trap, not an
  optimization.

## Report shape

```
Server: <ok, or the specific route/repo.ts function and pattern found>
Client: <ok, or the specific hook/key and pattern found>
```

For anything flagged, name the file/function and explain the *reasoning* (what's
sequential that doesn't need to be, what's refetching that doesn't need to) — not just
"this looks slow." A flag with no reasoning attached isn't actionable and this skill has
no hard threshold to point to instead.

## Reference files

- `apps/server/src/routes/admin.ts`, `apps/server/src/routes/invites.ts` — existing
  `Promise.all` batching patterns to match
- `apps/server/src/repo.ts` — the only place that talks to Postgres/Supabase directly
- `apps/web/src/lib/useLiveCampaign.ts` — the Realtime invalidation pattern
- `apps/web/src/lib/mutations.ts` — existing `useMutation` wrappers
