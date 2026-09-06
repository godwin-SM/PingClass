-- Pin explicit Data API grants for all objects existing today.
--
-- CONTEXT: Supabase is phasing out automatic table exposure (see discussion
-- #45329). From 2026-10-30, NEW tables/functions/sequences in `public` are NOT
-- granted to anon/authenticated/service_role by default - they need explicit
-- GRANT statements or PostgREST returns 42501. Existing objects keep their
-- current grants, so this migration is belt-and-braces: it makes the intent
-- explicit, replayable (survives suipabase db reset / branches), and trims the
-- three privileges (TRIGGER, TRUNCATE, REFERENCES) that API roles never use
-- and TRUNCATE in particular bypasses RLS.
--
-- Idempotent. Only touches tables/functions that exist today.

-- 1) Tables: grant the CRUD privileges API roles need, matching live state.
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;

-- 2) Trim non-API privileges from client roles. service_role keeps them.
revoke trigger, truncate, references on all tables in schema public from anon, authenticated;

-- 3) Functions currently reachable through the Data API. Security-critical
--    functions (get_secret, check_*_limit, enforce_rate_limit,
--    enforce_*_interval, users_*_guard, record_subscription,
--    check_announcements_allowed, get_secret) are intentionally NOT included:
--    they stay callable by postgres/service_role only.
--
--    anon_accessible matches today's effective grants (incl. legacy PUBLIC-exec).
do $$
declare
  r record;
  anon_set constant text[] := array[
    'check_announcement_plan','check_auth_failures','enforce_parent_consent',
    'enforce_plan_limit','get_announcements','get_active_plan',
    'get_institute_name','get_invite_token','get_user_institute_id',
    'get_user_role','handle_admin_auth_deletion','health_check',
    'is_batch_teacher','is_institute_admin','is_parent_of',
    'set_attendance_institute_id','set_fees_institute_id',
    'soft_delete_announcement','soft_delete_batch','soft_delete_student',
    'update_updated_at'];
  auth_set constant text[] := array['check_email_exists','get_plan_limits','refresh_analytics','soft_delete'];
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (p.proname = any (anon_set) or p.proname = any (auth_set))
  loop
    execute format('grant execute on function %s to authenticated', r.sig);
    if r.proname = any (anon_set) then
      execute format('grant execute on function %s to anon', r.sig);
    end if;
  end loop;
end $$;