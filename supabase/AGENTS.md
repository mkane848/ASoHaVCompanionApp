# Database guide (`supabase/`)

This file applies inside `supabase/`. Follow the root `AGENTS.md` unless this file gives a more
specific rule.

## Local commands

There is no local database step in this sandbox, because it has no raw TCP egress. Migrations apply
on push to `main` through `.github/workflows/apply-migrations.yml` (`supabase db push`). If that
workflow has not run, or its `SUPABASE_DB_URL` secret is missing, confirm with the Supabase
`list_migrations` tool and apply by hand.

## Local conventions

- **Read the header of `migrations/20260802163411_init.sql` before touching schema.** It explains
  the RLS strategy and the JSONB rationale.
- **Migration filenames are timestamp-versioned** (`YYYYMMDDHHMMSS_name.sql`), matching the
  Supabase CLI's tracking table.
- **RLS policies are `SELECT`-only for `authenticated`.** Every table has RLS enabled, and every
  write goes through the server with the service-role key. Don't add a write policy as a substitute
  for a server-side check.
- **A Realtime-synced table needs a joinless SELECT policy.** Realtime's `filter` supports only
  column equality, so the table needs a `campaign_id` column. The policy's `USING` clause must not
  join out to another table, because Realtime does not evaluate that reliably. Wrap any check beyond
  a plain membership match in a `private.*` SECURITY DEFINER function, called with columns already
  on the row.
- **`adventures` is deliberately not subscribed to Realtime.** A `postgres_changes` payload carries
  the row's whole `data` column, which would leak unrevealed GM Secrets at the wire level.
- **Play-state aggregates are JSONB columns** shaped like `packages/shared/src/types.ts`. A new
  field there needs no migration, but it does need a read-time default (see
  `packages/shared/AGENTS.md`). A field that must be queried or filtered independently needs a real
  column and a migration.

Detail: [`docs/architecture/data-and-access.md`](../docs/architecture/data-and-access.md).
Load the `supabase-postgres-best-practices` skill before writing SQL.

## Verification

For a new migration:

1. `npm run check-docs` and the root verification list.
2. After merge, confirm that `apply-migrations.yml` succeeded and the migration is live, using the
   `release-reliability-checklist` skill's step 5.
