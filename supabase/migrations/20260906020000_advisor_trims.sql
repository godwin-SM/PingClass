-- Security/perf trimming from Supabase advisors (2026-09-06).
--
-- SECURITY:
--   handle_admin_auth_deletion() is a TRIGGER function (fires on auth.users
--   DELETE via trigger on_admin_auth_deleted). It should not be callable over
--   the Data API: pin search_path (it is SECURITY DEFINER) and revoke EXECUTE
--   from anon/authenticated/PUBLIC. postgres + service_role keep EXECUTE so
--   the trigger keeps firing when the admin deletes an auth user.
--
--   pg_net: the "extension in public" lint is a FALSE POSITIVE - pg_net ships
--   its own `net` schema (its functions live there); the extension cannot be
--   moved into its own schema (ERROR 55000). No action.
--
-- PERF:
--   push_subscriptions.user_id is an unindexed FK (and queried by the
--   send-push-notifications edge function + RLS policy) -> add the index.

alter function public.handle_admin_auth_deletion()
  security definer set search_path = '';

revoke execute on function public.handle_admin_auth_deletion() from public, anon, authenticated;

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);