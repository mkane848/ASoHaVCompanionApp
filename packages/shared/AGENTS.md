# Shared package guide (`@asohav/shared`)

This file applies inside `packages/shared/`. Follow the root `AGENTS.md` unless this file gives a
more specific rule.

## Local commands

- Build: `npm run build -w @asohav/shared`. Server and web import this package from `dist`, not
  from source, so **rebuild after every edit**, or keep `npm run dev -w @asohav/shared` watching.
- Test: `npm test -w @asohav/shared`
- Test one file: `npx vitest run src/engine.test.ts` (from `packages/shared/`)
- Type check: `npm run typecheck -w @asohav/shared`

## Local conventions

- **Never add randomness to the rules engine.** Do not add `Math.random()`, a dice library or
  anything non-deterministic to `src/engine.ts` or its callers. The engine itemizes modifiers so the
  player knows what to roll. The table rolls, the player reports the tier, and the engine applies
  the consequence. `rollOdds()` (`src/odds.ts`) is not an exception: it enumerates every outcome,
  which is arithmetic, not a roll. This decision was confirmed with the repo owner.
- **`src/types.ts` is the wire contract.** JSONB columns store these shapes verbatim, so add fields
  and never rename them.
- **A new required field on a JSONB aggregate needs a read-time default.** Rows already in Postgres
  lack the key, so it deserializes as `undefined`. Extend the matching function:
  `normalizeSheet`, `normalizeLibrary`, `normalizeParty`, `normalizeBond`, `normalizeEncounter`,
  `normalizeAdventure`, `normalizeClock`, `normalizeWorld` (and `normalizeGmContentData`). Don't
  trust the TypeScript type. A missing default once caused four versions of silently wrong
  gameplay math. A field that must be queried or filtered needs a real column and a migration (see
  `supabase/AGENTS.md`).
- **A change to `src/seedLibrary.ts` bumps `SEED_VERSION`.** Existing libraries are never reseeded
  automatically, so the version mismatch is what shows the Content Admin banner.
- **Virtue scores change after creation only in `applyMotifAdvanceBonus()`** (`src/logic.ts`).
- **Read before changing rules code.** Read `Planning Docs/WorkPlan-V0.6.md` Section A and
  `WorkPlan-V0.6-Revision.md` Section A (the record of every migration judgment call) and the
  relevant entries in `docs/decisions.md`.

Detail: [`docs/architecture/rules-engine.md`](../../docs/architecture/rules-engine.md),
[`data-and-access.md`](../../docs/architecture/data-and-access.md).

## Verification

For changes in this tree:

1. `npm test -w @asohav/shared`
2. `npm run build -w @asohav/shared`, then the root `npm run typecheck`, because the consumers in
   server and web must still compile.
