# Server guide (`@asohav/server`)

This file applies inside `apps/server/`. Follow the root `AGENTS.md` unless this file gives a more
specific rule.

## Local commands

- Run: `npm run dev -w @asohav/server` (tsx watch, port 8787)
- Test all: `npm test -w @asohav/server`. Build shared first (`npm run build -w @asohav/shared`),
  because tests import its `dist`.
- Test one file: `npx vitest run src/routes/bond.test.ts` (from `apps/server/`)
- Type check: `npm run typecheck -w @asohav/server`

`vitest.config.ts` stubs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, because `src/supabase.ts`
throws at import without them. There is no live-database integration testing. The tests cover
pure logic and route-level authorization.

## Local conventions

- **Authorization is your job, not Postgres's.** `src/repo.ts` writes with the service-role key,
  which bypasses RLS, and the only RLS policies are `SELECT` policies. Every mutating route checks
  `req.user` and `membershipFor()` explicitly and enforces GM-only and admin-only rules itself.
  Follow `src/routes/bond.ts`. Never assume RLS is authorizing a write.
- **The archive freeze.** Every mutating route that touches a campaign's play state calls
  `assertCampaignActive(campaign)` (from `@asohav/shared`). `CampaignArchivedError` and the
  phase-gate errors carry `status = 409`, which `errorMiddleware` in `src/index.ts` reads, so call
  it bare with no try/catch. Four routes once missed this guard while every test stayed green;
  write a test against an archived campaign. Declining an invite is the one deliberate exception,
  and the reasoning sits at its call site. An unexplained missing guard is a bug.
- **Phase gates.** Character creation is gated to `PartyCreation`, and starting Combat to
  `Playing`. Legacy campaigns default to `PartyCreation`, so before gating a new route on `Phase`,
  decide deliberately whether blocking them is wanted. It usually isn't.
- **Bond mutations happen inside `withBondLock()`.** It holds `SELECT ... FOR UPDATE` on a direct
  `pg` connection. Mutate inside the callback, and **throw** to abort and roll back; never return
  an error value. The whole-document saves of the sheet, Party, Encounter, Clock and World use a
  stale-save precondition instead.
- **Character creation validates server-side.** `src/routes/characters.ts` must validate every
  creation field against the library with `characterCreationSchema(library)` from
  `@asohav/shared`. This route has no other authorization layer.
- `src/repo.ts` is the only module that talks to Postgres or Supabase. New routes get their own
  file in `src/routes/` and are mounted in `src/index.ts`.

Detail: [`docs/architecture/data-and-access.md`](../../docs/architecture/data-and-access.md),
[`campaign-lifecycle.md`](../../docs/architecture/campaign-lifecycle.md),
[`party-and-bond.md`](../../docs/architecture/party-and-bond.md). Run the `perf-budget` skill when
you add or edit a route handler or a `repo.ts` function.

## Verification

For changes in this tree:

1. `npm test -w @asohav/server`
2. `npm run typecheck -w @asohav/server`
3. The root verification list before finishing.
