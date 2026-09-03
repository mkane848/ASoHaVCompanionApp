-- Adventures (V0.5 slice 9): one row per Adventure, JSONB blob shape matching
-- packages/shared/src/types.ts's `Adventure`, following the exact pattern `clocks` (0011) and
-- `combat_encounters` (0010) established — text primary key, a campaign_id column for both the FK
-- and Realtime's equality-only postgres_changes filter, and a joinless SELECT policy calling
-- private.is_campaign_member() so Realtime's authorization check evaluates reliably (see 0006's
-- writeup of why an inline join in the policy silently drops live updates).
--
-- The RLS policy below is still added for the same repo-wide reason every other play-state table
-- gets one (see 0001_init.sql's design note: every table has RLS enabled, with only a SELECT
-- policy for `authenticated` — writes go through the service-role key in apps/server/src/repo.ts),
-- even though apps/web deliberately does NOT subscribe to this table over Realtime the way it does
-- clocks/combat_encounters — see useLiveCampaign.ts's comment for why: a postgres_changes payload
-- carries the full row regardless of whether the client's handler reads it, which would leak an
-- Adventure's unrevealed Secret text to every subscribed campaign member, not just the GM who
-- authored it. Adventures reach the client only through the ordinary GM-gated bootstrap REST
-- response (campaign.ts only fetches this table for a GM membership, same as `invites`).
--
-- Like clocks, a campaign can have several Adventures over its life (one Concluded, a new one
-- Active) — no "at most one live row" assumption here either.

create table public.adventures (
  id text primary key,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_adventures_campaign_id on public.adventures (campaign_id);

alter table public.adventures enable row level security;
create policy "campaign members can view adventures"
  on public.adventures for select
  to authenticated
  using (private.is_campaign_member(campaign_id, (select auth.uid())));
