-- Performance follow-ups flagged by Supabase's advisor after 0001/0002:
--
--   1. Foreign-key columns used in RLS lookups (campaign_id, user_id, character_id, ...) had no
--      covering index, so every policy check would force a sequential scan as data grows.
--   2. RLS policies called `auth.uid()` directly, which Postgres re-evaluates once per row
--      instead of once per query. Wrapping it as `(select auth.uid())` lets the planner treat it
--      as a stable subquery result and cache it — same semantics, much cheaper at scale.
--      See https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

create index if not exists idx_bonds_campaign_id on public.bonds (campaign_id);
create index if not exists idx_bonds_character_a_id on public.bonds (character_a_id);
create index if not exists idx_bonds_character_b_id on public.bonds (character_b_id);
create index if not exists idx_campaigns_gm_user_id on public.campaigns (gm_user_id);
create index if not exists idx_characters_campaign_id on public.characters (campaign_id);
create index if not exists idx_characters_user_id on public.characters (user_id);
create index if not exists idx_invites_campaign_id on public.invites (campaign_id);
create index if not exists idx_memberships_campaign_id on public.memberships (campaign_id);
create index if not exists idx_memberships_character_id on public.memberships (character_id);

drop policy "members can view their campaigns" on public.campaigns;
create policy "members can view their campaigns"
  on public.campaigns for select
  to authenticated
  using (private.is_campaign_member(id, (select auth.uid())));

drop policy "campaign members can view characters" on public.characters;
create policy "campaign members can view characters"
  on public.characters for select
  to authenticated
  using (private.is_campaign_member(campaign_id, (select auth.uid())));

drop policy "campaign members can view memberships" on public.memberships;
create policy "campaign members can view memberships"
  on public.memberships for select
  to authenticated
  using (private.is_campaign_member(campaign_id, (select auth.uid())));

drop policy "gm can view invites" on public.invites;
create policy "gm can view invites"
  on public.invites for select
  to authenticated
  using (private.is_gm(campaign_id, (select auth.uid())));

drop policy "owner or gm can view sheet" on public.character_sheets;
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

drop policy "campaign members can view party" on public.party;
create policy "campaign members can view party"
  on public.party for select
  to authenticated
  using (private.is_campaign_member(campaign_id, (select auth.uid())));

drop policy "campaign members can view bonds" on public.bonds;
create policy "campaign members can view bonds"
  on public.bonds for select
  to authenticated
  using (private.is_campaign_member(campaign_id, (select auth.uid())));

drop policy "content admins can view changelog" on public.changelog;
create policy "content admins can view changelog"
  on public.changelog for select
  to authenticated
  using (private.is_content_admin((select auth.uid())));
