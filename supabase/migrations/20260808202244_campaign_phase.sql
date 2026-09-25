-- Adds the campaign-setup lifecycle (Signup -> PartyCreation -> Playing), orthogonal to the
-- existing `status` archive/freeze flag added in 0008 — see apps/server/src/routes/campaign.ts's
-- PATCH /:id/phase and packages/shared/src/logic.ts's CAMPAIGN_PHASE_TRANSITIONS. New campaigns
-- start at 'Signup' (set explicitly by POST /campaigns); existing rows default to
-- 'PartyCreation' rather than 'Signup' or 'Playing' so an already-running campaign keeps letting
-- a newly-invited player create a character the way it always could, instead of the new gate
-- retroactively locking that out.
alter table public.campaigns add column phase text not null default 'PartyCreation'
  check (phase in ('Signup', 'PartyCreation', 'Playing'));

-- A player's self-reported readiness during the Party Creation phase (character complete, any
-- multi-user setup choices confirmed) — read by the GM's "N / M ready" view before starting play.
alter table public.memberships add column ready boolean not null default false;
