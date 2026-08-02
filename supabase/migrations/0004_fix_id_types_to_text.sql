-- Fix a schema bug from 0001: campaigns/characters/memberships/invites/bonds primary keys
-- (and the columns that reference them) were declared `uuid`, but the app's actual ID scheme
-- (`newId()` in packages/shared/src/logic.ts, plus the literal seed IDs like `ch-ember`,
-- `cm-1`) produces short prefixed strings, not UUIDs. Only identity columns tied to Supabase
-- Auth (`auth.users.id`, and the `gm_user_id` / `user_id` columns that reference it) are
-- genuine UUIDs and stay that way.
--
-- All these tables are still empty (schema-only migration so far), so the simplest safe fix
-- is to drop and recreate them with corrected column types, rather than an in-place ALTER
-- COLUMN TYPE (which would require dropping/recreating the cross-table FK constraints anyway
-- since both sides of a FK must match type). Dropping with CASCADE also removes the RLS
-- policies and realtime-publication membership tied to these tables, so both are recreated
-- below to match the state from 0001/0002/0003.

drop table if exists public.bonds cascade;
drop table if exists public.character_sheets cascade;
drop table if exists public.party cascade;
drop table if exists public.invites cascade;
drop table if exists public.memberships cascade;
drop table if exists public.characters cascade;
drop table if exists public.campaigns cascade;

create table public.campaigns (
  id text primary key,
  name text not null,
  gm_user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.characters (
  id text primary key,
  name text not null,
  player_name text not null,
  user_id uuid not null references auth.users (id),
  campaign_id text not null references public.campaigns (id) on delete cascade
);

create table public.memberships (
  id text primary key,
  user_id uuid not null references auth.users (id),
  campaign_id text not null references public.campaigns (id) on delete cascade,
  role text not null check (role in ('GM', 'Player')),
  character_id text references public.characters (id) on delete set null,
  unique (user_id, campaign_id)
);

create table public.invites (
  id text primary key,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  email text not null,
  code text not null unique,
  sent_at timestamptz not null default now(),
  status text not null default 'Pending' check (status in ('Pending', 'Accepted', 'Revoked'))
);

create table public.character_sheets (
  character_id text primary key references public.characters (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.party (
  campaign_id text primary key references public.campaigns (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.bonds (
  id text primary key,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  character_a_id text not null references public.characters (id) on delete cascade,
  character_b_id text not null references public.characters (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  check (character_a_id <> character_b_id)
);

-- ---------- fix helper function signatures (campaign_id is now text, not uuid) ----------

drop function if exists private.is_campaign_member(uuid, uuid);
drop function if exists private.is_gm(uuid, uuid);

create or replace function private.is_campaign_member(p_campaign_id text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where campaign_id = p_campaign_id and user_id = p_user_id
  );
$$;

create or replace function private.is_gm(p_campaign_id text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where campaign_id = p_campaign_id and user_id = p_user_id and role = 'GM'
  );
$$;

-- ---------- indexes on FK columns (as in 0003) ----------

create index if not exists idx_bonds_campaign_id on public.bonds (campaign_id);
create index if not exists idx_bonds_character_a_id on public.bonds (character_a_id);
create index if not exists idx_bonds_character_b_id on public.bonds (character_b_id);
create index if not exists idx_campaigns_gm_user_id on public.campaigns (gm_user_id);
create index if not exists idx_characters_campaign_id on public.characters (campaign_id);
create index if not exists idx_characters_user_id on public.characters (user_id);
create index if not exists idx_invites_campaign_id on public.invites (campaign_id);
create index if not exists idx_memberships_campaign_id on public.memberships (campaign_id);
create index if not exists idx_memberships_character_id on public.memberships (character_id);

-- ---------- RLS: enable + policies (as in 0002/0003) ----------

alter table public.campaigns enable row level security;
create policy "members can view their campaigns"
  on public.campaigns for select
  to authenticated
  using (private.is_campaign_member(id, (select auth.uid())));

alter table public.characters enable row level security;
create policy "campaign members can view characters"
  on public.characters for select
  to authenticated
  using (private.is_campaign_member(campaign_id, (select auth.uid())));

alter table public.memberships enable row level security;
create policy "campaign members can view memberships"
  on public.memberships for select
  to authenticated
  using (private.is_campaign_member(campaign_id, (select auth.uid())));

alter table public.invites enable row level security;
create policy "gm can view invites"
  on public.invites for select
  to authenticated
  using (private.is_gm(campaign_id, (select auth.uid())));

alter table public.character_sheets enable row level security;
create policy "owner or gm can view sheet"
  on public.character_sheets for select
  to authenticated
  using (
    exists (
      select 1 from public.characters c
      where c.id = character_sheets.character_id
        and (c.user_id = (select auth.uid()) or private.is_gm(c.campaign_id, (select auth.uid())))
    )
  );

alter table public.party enable row level security;
create policy "campaign members can view party"
  on public.party for select
  to authenticated
  using (private.is_campaign_member(campaign_id, (select auth.uid())));

alter table public.bonds enable row level security;
create policy "campaign members can view bonds"
  on public.bonds for select
  to authenticated
  using (private.is_campaign_member(campaign_id, (select auth.uid())));

-- ---------- realtime publication (as in 0001) ----------

alter publication supabase_realtime add table public.character_sheets;
alter publication supabase_realtime add table public.party;
alter publication supabase_realtime add table public.bonds;
