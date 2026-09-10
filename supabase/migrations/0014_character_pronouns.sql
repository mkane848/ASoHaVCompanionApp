-- V0.6 slice 5 (WorkPlan-V0.6.md Section A4 item 4): Hero Creation's own "Choose your Name,
-- Pronouns, and Physical Description" names Pronouns alongside Name, but `characters` had no
-- column for it. Backfilling existing rows to '' rather than requiring a value, since there's no
-- honest Pronouns to infer for a character created before this column existed — the same
-- "field stays freeform, no forced choice on old data" treatment every other freeform-text
-- backfill in this app gets (see CLAUDE.md's normalizeSheet/normalizeLibrary notes for the JSONB
-- equivalent of this same shape of change).
alter table public.characters
  add column pronouns text not null default '';
