-- Realtime for campaign/membership/character state (WorkPlan-0.38.0 item 2). Adds campaigns,
-- memberships and characters to the supabase_realtime publication so phase changes, readiness,
-- roster changes and character creation push live to the Campaign page and Home tiles, the same
-- way party/bonds/character_sheets/combat_encounters/clocks already do.
--
-- Three things worth recording so the next person doesn't have to re-derive them:
--
-- 1. Only publication membership was missing here. The SELECT policies for all three tables are
--    already the joinless `private.is_campaign_member()` shape (0004_fix_id_types_to_text.sql,
--    lines 114-130) that 0006_sheet_realtime_rls.sql established as the requirement for
--    Realtime's authorization check to evaluate reliably — no policy change is needed.
-- 2. `campaigns` is filtered on its own `id` column, not `campaign_id`, since it *is* the campaign
--    row. Realtime's `postgres_changes` filter only supports equality on a column already on the
--    row, which `id` satisfies.
-- 3. With `REPLICA IDENTITY DEFAULT`, a DELETE carries only the primary key, so RLS cannot
--    authorize it and delete events will not be delivered. This is accepted, not overlooked —
--    nothing in the app removes a membership or a campaign during normal play (campaign delete is
--    requireAdmin-only). Do NOT set `replica identity full` to fix it; that raises WAL volume for
--    every write on three hot tables, to deliver an event nothing currently needs.
--
-- This migration must be applied by hand after merge — Render's build/start commands never run
-- `supabase db push` or anything equivalent. See CLAUDE.md's Deployment section and HANDOFF.md
-- open issue 20 for the three prior incidents this exact gap has already caused.

alter publication supabase_realtime add table public.campaigns;
alter publication supabase_realtime add table public.memberships;
alter publication supabase_realtime add table public.characters;
