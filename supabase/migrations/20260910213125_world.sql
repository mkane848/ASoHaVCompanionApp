-- Creating the World (V0.6 slice 8): one row per campaign, JSONB blob shape matching
-- packages/shared/src/types.ts's `World`, following the exact single-row-per-campaign pattern
-- `party` (0001) established rather than the many-rows-per-campaign shape `clocks`/`adventures`
-- use — a campaign has exactly one shared World document, the same as it has exactly one Party.
-- `campaign_id` is the primary key itself (not a separate `id` column), matching `party`'s own
-- shape; a joinless SELECT policy calling private.is_campaign_member() so Realtime's authorization
-- check evaluates reliably (see 0006's writeup of why an inline join in the policy silently drops
-- live updates). Unlike `adventures`, this table IS added to the Realtime publication — World is
-- fully track-and-display content the whole table builds together, with none of the GM-only
-- unrevealed-Secret leak concern that keeps Adventures off Realtime (see useLiveCampaign.ts).

create table public.world (
  campaign_id text primary key references public.campaigns (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.world enable row level security;
create policy "campaign members can view world"
  on public.world for select
  to authenticated
  using (private.is_campaign_member(campaign_id, (select auth.uid())));

alter publication supabase_realtime add table public.world;
