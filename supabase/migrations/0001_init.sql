-- ASoHaV — initial Postgres schema for Supabase.
--
-- Design notes:
--   * auth.users (managed by Supabase Auth) is the identity table. `profiles` carries the
--     app-specific fields (display name, content-admin flag) keyed to it 1:1.
--   * Every table has RLS enabled. This matters even for tables the app server always reads/
--     writes with the service-role key: Supabase auto-exposes every table over PostgREST to
--     the public anon key unless RLS is on, so enabling it is the default-deny switch, not an
--     optional hardening step.
--   * Only SELECT policies are defined for the `authenticated` role. All INSERT/UPDATE/DELETE
--     stays behind the service-role key in the Express server, which is where the actual
--     business rules live (Bond handshake, sheet ownership, admin-only library writes) — this
--     migration does not try to re-express those as RLS policies. SELECT policies exist so
--     that (a) Supabase Realtime can correctly scope which row-change events a browser client
--     receives, and (b) the anon/authenticated key can't read data it shouldn't via PostgREST.
--   * Play-state aggregates (a character's sheet, the shared Party record, a Bond) are stored
--     as JSONB, matching the shape in packages/shared/src/types.ts exactly — that TypeScript
--     stays the wire contract. The library (game content) is one JSONB singleton row, same as
--     the SQLite version, so the existing admin validate()/referencedBy() logic ports untouched.

create extension if not exists pgcrypto;

-- ---------- profiles (extends auth.users) ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- Auto-create a profile row on signup. `name` comes from the signUp() call's
-- options.data.name (Supabase stores arbitrary signup metadata on raw_user_meta_data);
-- falls back to the email's local part if that's missing.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- helper functions used by RLS policies ----------
-- security definer + fixed search_path so these can read `memberships`/`profiles` regardless
-- of the caller's own RLS visibility into those tables (the standard Supabase pattern for
-- avoiding "infinite recursion in policy" errors).

create or replace function public.is_campaign_member(p_campaign_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where campaign_id = p_campaign_id and user_id = p_user_id
  );
$$;

create or replace function public.is_gm(p_campaign_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where campaign_id = p_campaign_id and user_id = p_user_id and role = 'GM'
  );
$$;

create or replace function public.is_content_admin(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = p_user_id), false);
$$;

-- ---------- campaigns / characters / memberships / invites ----------

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gm_user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;

create policy "members can view their campaigns"
  on public.campaigns for select
  to authenticated
  using (public.is_campaign_member(id, auth.uid()));

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  player_name text not null,
  user_id uuid not null references auth.users (id),
  campaign_id uuid not null references public.campaigns (id) on delete cascade
);
alter table public.characters enable row level security;

create policy "campaign members can view characters"
  on public.characters for select
  to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  role text not null check (role in ('GM', 'Player')),
  character_id uuid references public.characters (id) on delete set null,
  unique (user_id, campaign_id)
);
alter table public.memberships enable row level security;

create policy "campaign members can view memberships"
  on public.memberships for select
  to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  email text not null,
  code text not null unique,
  sent_at timestamptz not null default now(),
  status text not null default 'Pending' check (status in ('Pending', 'Accepted', 'Revoked'))
);
alter table public.invites enable row level security;

create policy "gm can view invites"
  on public.invites for select
  to authenticated
  using (public.is_gm(campaign_id, auth.uid()));

-- ---------- play state ----------

create table public.character_sheets (
  character_id uuid primary key references public.characters (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.character_sheets enable row level security;

create policy "owner or gm can view sheet"
  on public.character_sheets for select
  to authenticated
  using (
    exists (
      select 1 from public.characters c
      where c.id = character_sheets.character_id
        and (c.user_id = auth.uid() or public.is_gm(c.campaign_id, auth.uid()))
    )
  );

create table public.party (
  campaign_id uuid primary key references public.campaigns (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.party enable row level security;

create policy "campaign members can view party"
  on public.party for select
  to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

create table public.bonds (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  character_a_id uuid not null references public.characters (id) on delete cascade,
  character_b_id uuid not null references public.characters (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  check (character_a_id <> character_b_id)
);
alter table public.bonds enable row level security;

create policy "campaign members can view bonds"
  on public.bonds for select
  to authenticated
  using (public.is_campaign_member(campaign_id, auth.uid()));

-- ---------- content library (global, not per-campaign) ----------

create table public.library (
  id text primary key default 'singleton',
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.library enable row level security;

create policy "authenticated users can view library"
  on public.library for select
  to authenticated
  using (true);

create table public.changelog (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  who text not null,
  action text not null,
  collection text not null,
  object_id text not null,
  object_name text not null,
  before jsonb,
  after jsonb
);
alter table public.changelog enable row level security;

create policy "content admins can view changelog"
  on public.changelog for select
  to authenticated
  using (public.is_content_admin(auth.uid()));

-- ---------- realtime ----------
-- Publish the tables the client subscribes to for live updates. Supabase's default
-- `supabase_realtime` publication starts empty; row-change events only go out for tables
-- explicitly added here, and RLS (above) further scopes which *rows* a given client sees.

alter publication supabase_realtime add table public.character_sheets;
alter publication supabase_realtime add table public.party;
alter publication supabase_realtime add table public.bonds;
alter publication supabase_realtime add table public.library;
