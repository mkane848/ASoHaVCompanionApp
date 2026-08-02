# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## Versioning policy

This is a private, unpublished monorepo (every package in `apps/*` and `packages/*` is
`"private": true`) — nothing here is installed as a dependency by anyone outside this repo, so
there's no external consumer whose builds break on a version bump. We still follow
[Semantic Versioning](https://semver.org/), synchronized across all four `package.json` files
(root, `@asohav/server`, `@asohav/web`, `@asohav/shared`) rather than versioned independently,
since they only ever ship together:

- **MAJOR** (`1.0.0` and up): reserved for once the app is in real use — a change that breaks
  existing data or existing users' sessions/accounts.
- **MINOR**: new functionality or a notable internal architecture change (a new feature, a swapped
  transport layer, a schema change).
- **PATCH**: backward-compatible fixes — a bug fix, a config/deploy fix, no behavior change a user
  would notice.
- Per [SemVer §4](https://semver.org/#spec-item-4), `0.y.z` means initial development: the surface
  is not yet considered stable, so a MINOR bump (not MAJOR) is used for breaking internal changes
  pre-1.0 — this is why `0.1.0 → 0.2.0` below covers a full auth/data-layer rewrite.

Bump all four `package.json` files together when cutting a version, add a entry below, and tag the
merge commit `vX.Y.Z`.

## [0.3.0] — 2026-08-02

- Bond handshake (`propose`/`accept`/`reject`) now takes a real Postgres row lock
  (`SELECT ... FOR UPDATE` in a transaction via a direct `pg` connection) instead of a
  check-then-write through `supabase-js`/PostgREST, closing a race where two concurrent requests
  against the same Bond could silently clobber each other.
- Real-time transport switched to Supabase Realtime; the hand-rolled server-side WebSocket layer
  is retired entirely. `character_sheets` gained a `campaign_id` column
  (`supabase/migrations/0005_sheet_campaign_id.sql`) so Realtime's equality-only filters can scope
  it by campaign.
- Added Render deployment config (`render.yaml`): a single Web Service (the server already serves
  the built client from the same origin, so no separate static site is needed), plus a build-step
  fix (`NPM_CONFIG_PRODUCTION=false`) for `NODE_ENV=production` silently stripping devDependencies
  npm needs to compile the server's TypeScript.
- `packages/shared` was still at `0.1.0` (missed in the 0.2.0 bump below, despite carrying real
  changes since) — synchronized to `0.3.0` along with the other three packages here.

## [0.2.0] — 2026-08-02

- Migrated auth from a hand-rolled scrypt+cookie system to Supabase Auth (`supabase-js` on the
  client; the Express server verifies the resulting JWT and still enforces all authorization
  itself).
- Migrated the data layer from `node:sqlite` to Postgres via Supabase (`repo.ts` rewritten against
  `supabase-js`, service-role client).
- WebSocket auth moved from a session cookie to a `?token=` query param, with message buffering for
  the now-async auth handshake.
- Seeding rewritten to create the five dev accounts through the Supabase Auth admin API.

## [0.1.0] — 2026-08-02

- Initial build: player Character Sheet, Content Admin panel, and Campaign Shell (roster, invites,
  GM live-peek, Bond handshake), against a `node:sqlite` + hand-rolled cookie-auth backend.
