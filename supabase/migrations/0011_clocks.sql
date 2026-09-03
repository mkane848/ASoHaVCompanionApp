-- Clocks (V0.5 slice 6): one row per Clock, JSONB blob shape matching packages/shared/src/types.ts's
-- `Clock`, following the exact pattern `combat_encounters` established (0010) — text primary key,
-- a campaign_id column for both the FK and Realtime's equality-only postgres_changes filter, and a
-- joinless SELECT policy calling private.is_campaign_member() so Realtime's authorization check
-- evaluates reliably (see 0006's writeup of why an inline join in the policy silently drops live
-- updates). Unlike combat_encounters, a campaign can have many open Clocks at once (layered
-- obstacles, a Threat alongside a Basic Clock, ...) — this table already supports that with no
-- extra work, since it was never assumed to hold at most one live row per campaign.

create table public.clocks (
  id text primary key,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_clocks_campaign_id on public.clocks (campaign_id);

alter table public.clocks enable row level security;
create policy "campaign members can view clocks"
  on public.clocks for select
  to authenticated
  using (private.is_campaign_member(campaign_id, (select auth.uid())));

alter publication supabase_realtime add table public.clocks;
