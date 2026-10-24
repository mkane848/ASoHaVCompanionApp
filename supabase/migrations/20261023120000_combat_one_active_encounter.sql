-- Combat: at most one Active Encounter per campaign, enforced by the database.
--
-- Why: POST /campaigns/:id/combat/start checks getActiveEncounter() and then inserts. That is a
-- read followed by a write with nothing holding them together, so two near-simultaneous Start
-- Combat requests (a GM double-tap, or two GM tabs) can both see "none active" and both insert,
-- leaving two Active Encounters. getActiveEncounter() then silently takes whichever row Postgres
-- returns first. This partial unique index closes that race at the source: the second insert
-- fails with unique_violation (23505), which the route turns into a 409. The route's own
-- pre-check stays for the friendly common-case message; this index is the backstop.
--
-- The expression `(data->>'Status')` is the same JSONB path getActiveEncounter() filters on
-- (`.eq('data->>Status', 'Active')`), and `Status` is the only thing that makes an Encounter
-- "active": Ended rows are untouched, so a campaign keeps any number of past fights.
-- Nothing legitimately writes a second Active row: /start inserts a new id, the PUT route forces
-- Status to the stored value and upserts the same id (an UPDATE of the same row), /end flips
-- Active to Ended, and the Surrender log write re-saves the same row.
--
-- No data fix is needed: production was checked read-only before this migration and no campaign
-- has two Active Encounters. (If one ever did, this statement would fail loudly rather than
-- paper over it.) Idempotent via `if not exists`.

create unique index if not exists idx_combat_encounters_one_active
  on public.combat_encounters (campaign_id)
  where (data->>'Status') = 'Active';
