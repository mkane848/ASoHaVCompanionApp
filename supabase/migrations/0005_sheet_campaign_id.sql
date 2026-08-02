-- Add campaign_id to character_sheets so Supabase Realtime's postgres_changes filter can scope
-- subscriptions by campaign the same way it already does for `party` and `bonds` (both of
-- which carry campaign_id directly). character_sheets was keyed only by character_id, and
-- Realtime filters only support equality on a column of the table itself — no joins — so
-- reaching campaign_id via characters.campaign_id isn't an option for a subscription filter.
--
-- Table is currently empty (no seed data has been written against this project yet), so this
-- adds the column directly as not null rather than needing a nullable-then-backfill step.

alter table public.character_sheets
  add column campaign_id text not null references public.campaigns (id) on delete cascade;

create index if not exists idx_character_sheets_campaign_id on public.character_sheets (campaign_id);
