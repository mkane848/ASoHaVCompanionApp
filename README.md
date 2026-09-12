# ASoHaV — Character Sheet, Content Admin & Campaign Shell

A Story of Heroes and Villains: the player-facing digital toolset built from the design
handoff in `Planning Docs/`. Three surfaces, one app: the player **Character Sheet**, the
designers' **Content Admin** panel, and the **Campaign Shell** (roster, invites, GM live-peek,
Bond handshake).

*A Story of Heroes and Villains is Powered by the Apocalypse — built on the Apocalypse Engine
design lineage originated by D. Vincent Baker and Meguey Baker (Apocalypse World). All Virtues,
Moves, Arcs, and other setting/rules content in this repository are original to this game.*

**Picking this project back up?** See [HANDOFF.md](HANDOFF.md) for current status, open issues,
and pending work before starting anything new.

## Stack

- **Client** (`apps/web`): Vite + React 19 + TypeScript, zustand-free (state lives in
  TanStack Query's cache — see *Architecture notes*), TanStack Query for all server state,
  a small hook (`useLiveCampaign`) subscribing to Supabase Realtime and feeding the query cache
  for real-time updates. Auth (sign up / sign in / sign out) goes straight to Supabase Auth from
  the browser via `@supabase/supabase-js`.
- **Server** (`apps/server`): Express + TypeScript, Postgres via Supabase (`supabase-js` with
  the service-role key — authorization is enforced here in the route handlers, not in RLS;
  see `supabase/migrations/0001_init.sql`). No custom real-time layer: the client subscribes to
  Supabase Realtime directly, scoped by the same RLS policies the REST routes rely on.
- **Shared** (`packages/shared`): the reconciled data model as TypeScript types, the seeded
  library content and demo campaign (ported from the handoff's `library.js`/`store.js`),
  the admin schema definitions, and pure helper functions (load capacity, damage tiers, the
  Bond handshake resolution logic) used by both client and server.
- **Database** (`supabase/migrations`): Postgres schema + RLS policies, applied to a Supabase
  project. Requires a Supabase project's URL/keys in `apps/server/.env` and
  `apps/web/.env` (see the `.env.example` files in each).

## Running it

```bash
npm install
npm run dev:server   # http://localhost:8787 — seeds Supabase Auth + Postgres on first run
npm run dev:web      # http://localhost:5173 — proxies /api to the server; talks to Supabase
                      # (Auth + Realtime) directly from the browser
```

Open http://localhost:5173. The server seeds eight dev accounts in Supabase Auth on first boot
(password `asohav-dev` for all of them):

| Email | Character | Role |
|---|---|---|
| mike@asohav.dev | — | GM, content admin |
| ryan@asohav.dev | Ember | Player, content admin |
| sam@asohav.dev | Matryoshka | Player |
| ivy@asohav.dev | Oleander | Player |
| dax@asohav.dev | Frostbite | Player |
| rob@asohav.dev | — | content admin |
| dave@asohav.dev | — | content admin |
| tyler@asohav.dev | — | content admin |

("The two game designers" from the handoff — Mike and Ryan — are seeded as content admins,
matching the admin panel prototype's "editing as" options. Rob, Dave, and Tyler are additional
content admin accounts following the same pattern.)

## Deployment

Hosted on [Render](https://render.com) as a single Web Service, defined declaratively in
[`render.yaml`](render.yaml) (a Render "Blueprint" — connect the repo and Render reads this file
directly, no manual service setup). One service, not two: `apps/server/src/index.ts` already
serves the built `apps/web/dist` client and falls back to it for client-side routes when
`NODE_ENV=production`, and the client only ever calls relative `/api/...` paths, so there's no
separate static site and no CORS to configure.

Env vars Render needs (set in its dashboard — `render.yaml` declares these with `sync: false` so
it prompts for them rather than storing them in git):

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API
- `DATABASE_URL` — Project Settings → Database → **Connection pooling** → URI (session or
  transaction pooler, `aws-*.pooler.supabase.com`). Must be the pooler, not the direct-connection
  hostname (`db.<ref>.supabase.co`) — that one's IPv6-only and won't resolve from an IPv4-only
  network.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — same Project Settings → API values, read at
  *build* time (Vite inlines them into the client bundle).

Two non-obvious build-time gotchas already hit and fixed (see `render.yaml` for the actual
config, and CHANGELOG.md 0.3.0 for the write-ups):

- `NODE_ENV=production` (needed for the app's own runtime — static-file serving) also governs
  `npm ci` during the build step, which by default omits devDependencies — silently dropping
  `@types/node` and breaking the server's `tsc` build. Fixed with `NPM_CONFIG_PRODUCTION=false`,
  which forces devDependencies to install regardless of `NODE_ENV` (an npm install setting only —
  it doesn't touch the running app's `process.env.NODE_ENV`).
- The first boot seeds eight dev accounts into Supabase Auth + Postgres if the database is empty
  (see *Running it* above) — expected on a fresh project, but worth knowing before it shows up
  unannounced in the deploy logs.

See [HANDOFF.md](HANDOFF.md) for what's actually been verified on the live deployment versus
what's still outstanding.


## Architecture notes, judgment calls, and what's not built

Both lists moved out of this file in `0.52.0`; between them they were 83% of it.

- **[`docs/decisions.md`](docs/decisions.md)** — the judgment-call record: why an ambiguous or
  self-contradictory source document was resolved the way it was. Item numbering is unchanged, so
  existing citations still resolve.
- **[`docs/not-built.md`](docs/not-built.md)** — what is deliberately absent, and why it is not a
  backlog.

For how the app actually works, start at **[`docs/architecture/`](docs/architecture/README.md)**.
`CLAUDE.md` carries the invariants a contributor must not violate.

## Versioning

All four `package.json` files (root, `@asohav/server`, `@asohav/web`, `@asohav/shared`) share one
[Semantic Versioning](https://semver.org/) number, bumped together — see [CHANGELOG.md](CHANGELOG.md)
for what's in each release and the policy for what counts as MAJOR/MINOR/PATCH pre-1.0.

## License & attribution

Code in this repository is licensed under the [MIT License](LICENSE). The repository itself
is currently private; the license governs the code's terms whenever it's shared.

ASoHaV is Powered by the Apocalypse, built on the Apocalypse Engine design lineage originated
by D. Vincent Baker and Meguey Baker (*Apocalypse World*). That credit covers the general
moves-based system (2d6 + stat, 10+/7–9/miss); the Virtues, Moves, Arcs, Bonds, and every other
piece of rules and setting content in `Planning Docs/` and `packages/shared` are original to
this game.
