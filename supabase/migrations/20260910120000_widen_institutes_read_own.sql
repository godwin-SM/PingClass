-- Widen institutes_read_own so a brand-new signup can see its freshly-created
-- institute. The old policy (id = get_user_institute_id()) makes the owner's own
-- institute invisible before their users row exists, so the profile self-heal's
-- INSERT ... RETURNING (read-back) failed with 403 "new row violates row-level
-- security policy", aborting profile creation and locking new accounts out.
-- Owner-only visibility keeps this scoped (owner_id = auth.uid()).
alter policy "institutes_read_own" on public.institutes
  using (id = get_user_institute_id() or owner_id = auth.uid());