# ASoHaV Companion App

The player-facing digital toolset for *A Story of Heroes and Villains*, a Powered-by-the-Apocalypse
tabletop game. Version `0.79.1`. The canonical ruleset is V0.7 (`Planning Docs/Ruleset-V0.7.md`).

## Surfaces

- **Character Sheet**: the player's Hero sheet.
- **Campaign Shell**: roster, invites, setup phases, Bonds, Combat, Clocks, GM sheet peek.
- **Adventure Prep**: GM-only adventure, villain, NPC and location planning.
- **Content Admin**: the designers' panel for the game library.

Every campaign member also has a Safety Tools page.

## Stack

- **Client** (`apps/web`): Vite, React 19, TypeScript, TanStack Query, zustand for small UI stores,
  Supabase Realtime.
- **Server** (`apps/server`): Express and TypeScript. Authorization is in the route handlers, not RLS.
- **Shared** (`packages/shared`): the data model (the wire contract), rules logic and seed content.
- **Database**: Supabase Postgres. Migrations are in `supabase/migrations`.

## Quick start

Requires Node 22 or later and a Supabase project.

```bash
npm install
cp apps/server/.env.example apps/server/.env       # Supabase values
cp apps/web/.env.example apps/web/.env.local       # VITE_ values
npm run dev:server   # http://localhost:8787, seeds Supabase Auth and Postgres on first run
npm run dev:web      # http://localhost:5173
```

```bash
npm run test
npm run typecheck
npm run lint
npm run check-docs
npm run test:responsive -w @asohav/web   # needs Chromium, see docs/operations.md
```

### Seeded dev accounts

Created on first boot, password `asohav-dev`.

| Email | Role in the seed |
|---|---|
| mike@asohav.dev | Content admin. GM of "The Long Road South". Pending invite to "Seelie". |
| ryan@asohav.dev | Content admin. Plays Ember. GM of "Seelie". |
| sam@asohav.dev | Plays Matryoshka. |
| ivy@asohav.dev | Plays Oleander. |
| dax@asohav.dev | Plays Frostbite. |
| rob@, dave@, tyler@asohav.dev | Content admin. |

Source: `packages/shared/src/seedPlay.ts` (campaigns, characters, invite) and `apps/server/src/seed.ts` (admin flags).

## Deployment

One Render Web Service, defined by [`render.yaml`](render.yaml). The server also serves the built
client, so there is no separate static site and no CORS setup. Set these in the Render dashboard:

- **Server:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (the
  Supabase connection-pooler URI, not the direct `db.<ref>` host).
- **Client, at build time:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Invite email (optional):** `RESEND_API_KEY`, `INVITE_FROM_EMAIL`, `APP_BASE_URL`. Without
  `RESEND_API_KEY` the email step is skipped; invite codes still work.

Render does not apply migrations. See [`docs/operations.md`](docs/operations.md).

## Documentation

- [`docs/architecture/`](docs/architecture/README.md): how each subsystem works today. Start here.
- [`docs/decisions.md`](docs/decisions.md): judgment calls where the ruleset was ambiguous.
- [`docs/not-built.md`](docs/not-built.md): features deliberately left out.
- [`docs/operations.md`](docs/operations.md): commands, CI, deployment, sandbox limits.
- [`CHANGELOG.md`](CHANGELOG.md): release history and the versioning policy.
- [`HANDOFF.md`](HANDOFF.md): current status and open issues.
- [`CLAUDE.md`](CLAUDE.md): invariants for contributors and coding agents.

## License and attribution

Code is licensed under the [MIT License](LICENSE), Copyright 2026 Mike Kane.

*A Story of Heroes and Villains* is Powered by the Apocalypse, built on the Apocalypse Engine design
lineage of D. Vincent Baker and Meguey Baker (*Apocalypse World*). The Virtues, Moves, Arcs, Bonds and
other setting and rules content are original to this game.
