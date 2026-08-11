---
name: release-reliability-checklist
description: >
  DRAFT — NOT YET IMPLEMENTED. Once finished, this skill should codify the
  ASoHaVCompanionApp Render deployment gotchas already documented in CLAUDE.md into a
  pre-deploy checklist for a solo maintainer with no second reviewer. Should trigger
  when the user says they're about to deploy, cut a release, bump the version, merge to
  main, or asks "is this ready to ship" / "ready to deploy" / "am I missing anything
  before release."
status: draft — TODO, do not install/register yet
---

# release-reliability-checklist (DRAFT)

> This is a scaffold, not a working skill. The body below is a TODO outline captured from
> a conversation with the repo owner (2026-08-11) — flesh it out before installing.

## What this skill should do (TODO: turn into real instructions)

- [ ] TODO: Turn the following known gotchas (from CLAUDE.md's "Deployment" section) into
      an actual checklist format, not just a restatement:
  - `NODE_ENV=production` makes `npm ci` skip devDependencies by default, which breaks
    the server's `tsc` build (`@types/node` missing) — confirm `NPM_CONFIG_PRODUCTION=false`
    is still set in `render.yaml`, don't assume it silently stays correct
  - First boot seeds eight dev accounts into Supabase Auth + Postgres if the database is
    empty (`apps/server/src/seed.ts`) — expected on a *fresh* project; the checklist
    should help distinguish "expected on fresh deploy" from "unexpected on a deploy to an
    already-seeded production project"
  - Migration ordering: new `supabase/migrations` files must be applied in order; confirm
    any new migration this release actually got applied before assuming the deploy is done
- [ ] TODO: Fold in the versioning policy from CLAUDE.md's "Workspace layout" section —
      one synchronized version across all four `package.json` files (root, `@asohav/server`,
      `@asohav/web`, `@asohav/shared`), a CHANGELOG.md entry, and tagging the merge commit
      `vX.Y.Z`. Should the skill actually check these are all in sync, or just remind?
- [ ] TODO: Should this include running the actual verification commands
      (`npm run typecheck`, `npm run build`, `npm run test`, `npm run test:responsive`)
      as a final pre-deploy gate, mirroring what CI does in `.github/workflows/ci.yml` —
      given CLAUDE.md explicitly warns `main` has no branch protection requiring CI to pass?
- [ ] TODO: Should it check `HANDOFF.md` for any open issue that's release-blocking, or is
      that out of scope for a mechanical checklist?

## Open questions for the repo owner before finishing this

- Is this meant to run *before* merging to main, *before* the Render deploy specifically,
  or both (two checkpoints)?
- Want this to actually execute the verification commands itself, or just prompt you
  through the checklist and trust you to run them?
