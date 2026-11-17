-- profiles: each signed-in user may read only their own row (0.86.0, docs/Audit-2026-11-12.md
-- finding 11).
--
-- The init migration let any authenticated user SELECT every profile, which, with the public anon
-- key and a session, listed every account's display name and is_admin flag over PostgREST. Nothing
-- in the web client reads profiles directly: names reach it through the Express API, which uses the
-- service-role key and is unaffected by RLS. profiles is not in the Realtime publication, so no
-- live subscription depends on the old policy either.
--
-- RLS stays enabled, so with this policy a user still sees their own row and nobody else's.

drop policy if exists "profiles are viewable by authenticated users" on public.profiles;

create policy "users can view their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));
