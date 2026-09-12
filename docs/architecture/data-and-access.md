# Data and access

How this app authorizes requests, what Realtime will and will not deliver, and the rule that every JSONB aggregate needs a read-time default. **The most important file here** — the authorization model is the single thing to know before touching data access.

_Part of `docs/architecture/`. Index: [`docs/architecture/README.md`](README.md). The invariants a session must not violate stay in `CLAUDE.md`; this file is the detail behind them._

---

## Architecture: authorization is in the Express layer, not RLS

This is the single most important thing to know before touching data access. Every table has RLS
enabled (Supabase auto-exposes tables over PostgREST to the anon key otherwise), but **only
`SELECT` policies exist** for the `authenticated` role. All INSERT/UPDATE/DELETE goes through
`apps/server/src/repo.ts`, which uses the Supabase **service-role key** (bypasses RLS entirely) —
business rules (membership checks, GM-only actions, admin-only library writes, Bond handshake
rules) are enforced in the Express route handlers, not in Postgres policies. Don't add new
mutating routes that assume RLS is doing authorization for you; check `req.user` /
`membershipFor()` explicitly, following the pattern in `apps/server/src/routes/bond.ts`.

The SELECT policies exist for a second reason beyond direct anon reads: they scope what
**Supabase Realtime** delivers. There is no server-side broadcast/WebSocket layer — the client's
`useLiveCampaign` hook (`apps/web/src/lib/useLiveCampaign.ts`) subscribes directly to
`postgres_changes` on `party`/`bonds`/`character_sheets` (filtered by `campaign_id`) and `library`
(global), and Realtime evaluates each table's SELECT policy per subscribing client — so a player
only receives events for campaigns/sheets they can already see, for free, using the same
authorization the REST routes enforce. If you add a new play-state table that should sync live,
give it a `campaign_id` column and a matching SELECT policy (see migration `0005` for why
`character_sheets` needed one retrofitted — Realtime's `filter` only supports equality on a
column, so the table needs the FK to filter on even if it's otherwise reached via
`character_id`).

A second, easy-to-miss Realtime constraint: **the SELECT policy itself also needs to be joinless**,
not just the subscription filter. Realtime's `postgres_changes` authorization check does not
reliably evaluate an RLS policy whose `USING` clause joins out to another table (an inline
`exists (select ... from other_table ...)`) — `party`/`bonds` never hit this because their policies
were always a single `private.is_campaign_member(campaign_id, uid)` call over a column already on
the row, but `character_sheets`' policy kept an inline join to `characters` even after `0005` added
`campaign_id` directly to the row, and this caused GM live-peek to intermittently miss a just-marked
Condition until some later sheet write happened to deliver (fixed in migration `0006` with
`private.can_view_sheet(campaign_id, character_id, user_id)`, a joinless function-call policy in
the same shape as `is_campaign_member`/`is_gm`). If you add a Realtime-synced table whose SELECT
policy needs to check anything beyond a plain campaign-membership match, wrap the check in a
`private.*` SECURITY DEFINER function called with columns already on the row — never write the
join inline in the policy body.

**Adding a new required field to `CharacterSheet` needs a read-time default, not just a type
change.** `Recoveries`/`Scars` shipped in `0.13.0` with no backfill for sheets already saved to
Postgres — an old sheet's JSONB blob has no such keys, so they deserialize as `undefined`, and an
unguarded read (`sheet.Scars.length`, etc.) crashes on render. Fixed in `0.16.1` with
`normalizeSheet()` (`packages/shared/src/logic.ts`), called from `apps/server/src/repo.ts`'s
`getSheet()` on every read — the same self-heal-on-read pattern `campaign.ts`'s bootstrap route
already uses for a missing `Party` row. If you add another required field to `CharacterSheet` (or
any other JSONB-blob type with rows already live in Postgres — `Party`, `Bond`, `Library`), extend
`normalizeSheet()` (or add its equivalent) rather than trusting the TypeScript type to guarantee
the field is actually present on data written before the field existed.

**This rule wasn't actually followed for `Library` until a `0.17.0` audit caught it.** Every
`GameSettings` field added across `0.13.0`/`0.14.0` (`SkillsAtCreation`, `AdvancementTier2At`/
`3At`/`4At`, `RecoveriesMax`) plus `0.9.0`'s `glossary` and `0.14.0`'s `enemies` had no read-time
default, and the live project's `library` singleton predated all of them — silently breaking real
gameplay math (0 Recoveries on new characters, an unenforced Skill-count cap, Advancement Tiers
stuck at 1 forever) rather than crashing, which is *why* it went unnoticed for four versions: no
error ever pointed back to the cause. Fixed with `normalizeLibrary()` (`packages/shared/src/
logic.ts`, unit tested), called from `repo.ts`'s `getLibrary()`, same shape as `normalizeSheet()`.
That warning turned out to be worth heeding, and wasn't: by `0.49.0` **four** JSONB aggregates had
gained required fields with no read-time default — `Bond`, `Encounter` and `Adventure` had no
normalize at all, and `Party`'s existed but was bypassed by `listPartiesForCampaigns()`, the reader
behind Home's Rapport tiles. `0.50.0` added `normalizeBond()`/`normalizeEncounter()`/
`normalizeAdventure()` and wired all four properly. Every JSONB aggregate now has one; the rule for
the next field addition is unchanged, and the lesson is that "haven't needed this yet" ages badly.

## Data shapes: JSONB blobs keyed by TypeScript

Play-state aggregates — a character's `CharacterSheet`, the campaign's `Party`, each `Bond` — are
stored as single JSONB columns matching `packages/shared/src/types.ts` exactly, not normalized
into columns. The library (game content: virtues, moves, items, abilities, etc.) is one JSONB
singleton row (`library` table, `id='singleton'`). This means most repo functions are thin
`select ... .data` / `upsert({ data: obj })` wrappers — when adding a field, add it to the
TypeScript interface in `packages/shared/src/types.ts` and it flows through without a migration,
*except* when the field needs to be independently queried/filtered (e.g. `campaign_id` on
`character_sheets`, added in migration `0005` specifically so Realtime could filter on it) —
those need a real column plus a migration.

Field naming is PascalCase in TypeScript (`CharacterId`, `UpdatedAt`) but snake_case in Postgres
columns (`character_id`, `updated_at`); the `repo.ts` `map*()` functions do this translation by
hand for row-shaped tables. JSONB blob fields keep their TypeScript PascalCase as-is inside the
JSON.
