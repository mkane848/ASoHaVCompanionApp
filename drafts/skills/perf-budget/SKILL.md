---
name: perf-budget
description: >
  DRAFT — NOT YET IMPLEMENTED. Once finished, this skill should flag latency-risky
  patterns specific to the ASoHaVCompanionApp stack (TanStack Query cache/refetch
  behavior, Supabase Realtime subscription costs, Express route handlers in
  apps/server/src/routes/*.ts, and apps/server/src/repo.ts data-access calls) so a solo
  maintainer catches slow-request-input-to-confirmation regressions before they ship.
  Should trigger when the user adds/edits a route handler, a repo.ts function, a
  useQuery/useMutation hook, or a useLiveCampaign Realtime subscription — or asks about
  "why is this slow," "latency," "N+1," or "will this scale."
status: draft — TODO, do not install/register yet
---

# perf-budget (DRAFT)

> This is a scaffold, not a working skill. The body below is a TODO outline captured from
> a conversation with the repo owner (2026-08-11) — flesh it out before installing.

## What this skill should do (TODO: turn into real instructions)

- [ ] TODO: Define the actual "budget" — this needs real numbers from the repo owner
      (e.g. target p95 latency for a sheet save, an acceptable Realtime reconnect/refetch
      cadence) rather than vague "make it fast." Without concrete targets this skill is
      just a checklist, which may be fine but should be a deliberate choice.
- [ ] TODO: Server-side checklist items to define:
  - Spot `repo.ts` calls made in a loop (N+1 pattern) vs. batched Supabase queries
  - Spot routes doing sequential `await`s that could run in parallel
      (`Promise.all`) where there's no real data dependency
  - Flag any new mutating route that doesn't reuse the existing `assertCampaignActive` /
    `membershipFor()` authorization pattern efficiently (e.g. redundant extra fetches to
    re-derive something already loaded)
- [ ] TODO: Client-side checklist items to define:
  - New `useQuery` hooks: is the query key stable? Is `staleTime`/`gcTime` considered, or
    will this cause redundant refetches on every mount?
  - `useLiveCampaign`-driven invalidation: does a new Realtime-synced table/event
    invalidate too broad a set of query keys (over-fetching) vs. a narrow, correct one?
  - Per CLAUDE.md: Realtime is a signal to refetch, not a data source — flag any new code
    that tries to patch cache data directly from a Realtime payload instead of invalidating.
- [ ] TODO: Decide if this skill should include a lightweight static-analysis script
      (grep-based first pass for `await` in a `for`/`map` loop, etc.) or stay purely
      reasoning-based.

## Open questions for the repo owner before finishing this

- Do you want hard thresholds (e.g. "flag any route handler with 3+ sequential Supabase
  calls") or softer judgment-call guidance?
- Should this also cover the `withBondLock` raw-`pg` code path, given CLAUDE.md notes
  it's never been runtime-verified against live Postgres?
