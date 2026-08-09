-- Combat: one row per Encounter (a live or past fight), JSONB blob shape matching
-- packages/shared/src/types.ts's `Encounter`, following the exact pattern `party`/`bonds`
-- established: text primary keys (0004's fix), a campaign_id column for both the FK and
-- Realtime's equality-only postgres_changes filter, and a joinless SELECT policy calling
-- private.is_campaign_member() so Realtime's authorization check evaluates reliably (see 0006's
-- writeup of why an inline join in the policy silently drops live updates).

create table public.combat_encounters (
  id text primary key,
  campaign_id text not null references public.campaigns (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_combat_encounters_campaign_id on public.combat_encounters (campaign_id);

alter table public.combat_encounters enable row level security;
create policy "campaign members can view combat encounters"
  on public.combat_encounters for select
  to authenticated
  using (private.is_campaign_member(campaign_id, (select auth.uid())));

alter publication supabase_realtime add table public.combat_encounters;
