-- Adds 'Declined' as a distinct invite outcome from 'Revoked' (GM cancels it) — a player
-- explicitly turning an invite down via the new redeem/decline flow (apps/server/src/routes/
-- invites.ts) should be visible as its own status rather than looking identical to a GM revoke.

alter table public.invites drop constraint invites_status_check;
alter table public.invites add constraint invites_status_check
  check (status in ('Pending', 'Accepted', 'Declined', 'Revoked'));
