-- Lets a GM archive their own campaign (a label, not a delete) — see apps/server/src/routes/
-- campaign.ts's PATCH /:id/status. Archiving also freezes further play-state mutations on that
-- campaign (invites, Bond propose/accept/reject, sheet/party edits, character creation),
-- enforced in the Express route handlers via packages/shared/src/logic.ts's
-- assertCampaignActive() — same authorization-in-the-app-layer pattern as everything else here,
-- not a new RLS policy.

alter table public.campaigns add column status text not null default 'Active'
  check (status in ('Active', 'Archived'));
