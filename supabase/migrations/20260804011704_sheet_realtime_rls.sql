-- Realtime's postgres_changes authorization check re-evaluates each subscribing client's SELECT
-- RLS policy per changed row. party/bonds' "campaign members can view ..." policies call
-- private.is_campaign_member(campaign_id, uid) -- a function call over columns already on the
-- row -- and their live updates work. character_sheets' "owner or gm can view sheet" policy
-- instead does an inline `exists (select ... from characters c where c.id =
-- character_sheets.character_id ...)` join, left over from before 0005 added campaign_id
-- directly to character_sheets (that migration updated the Realtime subscription *filter* to use
-- the new column but never updated this SELECT policy to match). Realtime's postgres_changes
-- does not reliably evaluate RLS policies that join out to another table, so a GM's live-peek
-- subscription could silently miss a character_sheets change -- explaining reports that a
-- just-marked Condition sometimes didn't show up in the GM view until a later, unrelated sheet
-- write happened to deliver successfully.
--
-- Fix: give character_sheets the same joinless, function-call policy shape as party/bonds, using
-- the campaign_id and character_id columns already on the row (character_id was already there;
-- campaign_id since 0005).

create or replace function private.can_view_sheet(p_campaign_id text, p_character_id text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.campaign_id = p_campaign_id
      and m.user_id = p_user_id
      and (m.role = 'GM' or m.character_id = p_character_id)
  );
$$;

drop policy "owner or gm can view sheet" on public.character_sheets;
create policy "owner or gm can view sheet"
  on public.character_sheets for select
  to authenticated
  using (private.can_view_sheet(campaign_id, character_id, (select auth.uid())));
