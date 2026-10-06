-- GM-authored Villains and NPCs (0.67.0): one row per entry a GM writes from Adventure Prep, as
-- opposed to `library.villains`/`npcs`, which only a Content Admin can write.
--
-- Not a play-state table and not Realtime-synced — it is read over ordinary REST (GET /api/gm-content),
-- so the "joinless SELECT policy" constraint in CLAUDE.md does not bite, and there is no campaign_id
-- to filter on: an entry belongs to a user, not a campaign. A `Mine` entry is usable in every campaign
-- its author runs; a `SiteWide` one is readable by every GM.
--
-- Like every table here, RLS is enabled with only a SELECT policy for `authenticated`; all writes
-- go through apps/server/src/repo.ts on the service-role key, and ownership is enforced in the
-- Express route (apps/server/src/routes/gmContent.ts), not here.
--
-- `data` is the Villain/NPC JSONB shape from packages/shared/src/types.ts, minus `Id` and `Custom`
-- (those come from the row's own columns, so a client cannot spoof authorship or scope by editing
-- the blob). `kind` and `scope` are real columns because the list query filters on them.

create table public.gm_content (
  id text primary key,
  kind text not null check (kind in ('villain', 'npc')),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  scope text not null default 'Mine' check (scope in ('Mine', 'SiteWide')),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gm_content_owner on public.gm_content (owner_user_id);
create index if not exists idx_gm_content_site_wide on public.gm_content (scope) where scope = 'SiteWide';

alter table public.gm_content enable row level security;
create policy "owners and site-wide readers can view gm_content"
  on public.gm_content for select
  to authenticated
  using (owner_user_id = (select auth.uid()) or scope = 'SiteWide');
