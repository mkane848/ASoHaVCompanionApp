-- Move the RLS helper functions out of `public` and into a `private` schema.
--
-- PostgREST auto-exposes every function in `public` as a callable RPC endpoint
-- (/rest/v1/rpc/<fn>), including SECURITY DEFINER ones. `is_campaign_member` / `is_gm` /
-- `is_content_admin` / `handle_new_user` are only meant to be evaluated internally as part of
-- RLS policies and an auth trigger — they were never meant to be called directly by anon or
-- authenticated clients. Supabase's security advisor flags this
-- (anon/authenticated_security_definer_function_executable). `private` is not in PostgREST's
-- exposed schema list, so moving them there closes the RPC exposure while leaving RLS
-- evaluation untouched (Postgres functions are EXECUTE-able by PUBLIC by default, which
-- `authenticated`/`anon` still inherit for internal policy evaluation).

create schema if not exists private;

-- Policies reference these functions, so they must be dropped before the functions can move.
drop policy "members can view their campaigns" on public.campaigns;
drop policy "campaign members can view characters" on public.characters;
drop policy "campaign members can view memberships" on public.memberships;
drop policy "gm can view invites" on public.invites;
drop policy "owner or gm can view sheet" on public.character_sheets;
drop policy "campaign members can view party" on public.party;
drop policy "campaign members can view bonds" on public.bonds;
drop policy "content admins can view changelog" on public.changelog;

drop trigger on_auth_user_created on auth.users;

drop function public.is_campaign_member(uuid, uuid);
drop function public.is_gm(uuid, uuid);
drop function public.is_content_admin(uuid);
drop function public.handle_new_user();

create or replace function private.handle_new_user()
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
  for each row execute function private.handle_new_user();

create or replace function private.is_campaign_member(p_campaign_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where campaign_id = p_campaign_id and user_id = p_user_id
  );
$$;

create or replace function private.is_gm(p_campaign_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where campaign_id = p_campaign_id and user_id = p_user_id and role = 'GM'
  );
$$;

create or replace function private.is_content_admin(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = p_user_id), false);
$$;

create policy "members can view their campaigns"
  on public.campaigns for select
  to authenticated
  using (private.is_campaign_member(id, auth.uid()));

create policy "campaign members can view characters"
  on public.characters for select
  to authenticated
  using (private.is_campaign_member(campaign_id, auth.uid()));

create policy "campaign members can view memberships"
  on public.memberships for select
  to authenticated
  using (private.is_campaign_member(campaign_id, auth.uid()));

create policy "gm can view invites"
  on public.invites for select
  to authenticated
  using (private.is_gm(campaign_id, auth.uid()));

create policy "owner or gm can view sheet"
  on public.character_sheets for select
  to authenticated
  using (
    exists (
      select 1 from public.characters c
      where c.id = character_sheets.character_id
        and (c.user_id = auth.uid() or private.is_gm(c.campaign_id, auth.uid()))
    )
  );

create policy "campaign members can view party"
  on public.party for select
  to authenticated
  using (private.is_campaign_member(campaign_id, auth.uid()));

create policy "campaign members can view bonds"
  on public.bonds for select
  to authenticated
  using (private.is_campaign_member(campaign_id, auth.uid()));

create policy "content admins can view changelog"
  on public.changelog for select
  to authenticated
  using (private.is_content_admin(auth.uid()));
